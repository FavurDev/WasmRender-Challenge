/**
 * @fileoverview Framebuffer triple: sole pixel-memory owner (color + depth + stencil).
 *
 * Single-writer pixel store backing the default framebuffer. Depends only on
 * gl-constants limits and bit masks; single-threaded with no allocation in
 * fill loops. Color layout matches 2D ImageData RGBA order so presentation
 * needs no conversion.
 */
import { COLOR_BUFFER_BIT, DEPTH_BUFFER_BIT, MAX_VIEWPORT_DIMS, STENCIL_BUFFER_BIT } from './gl-constants';
import { OutOfMemoryError } from './errors';

export { OutOfMemoryError } from './errors';

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function checkDims(w: number, h: number): void {
  const cap = MAX_VIEWPORT_DIMS[0] as number;
  const capH = MAX_VIEWPORT_DIMS[1] as number;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 || w > cap || h > capH) {
    throw new OutOfMemoryError(`Invalid framebuffer dimensions ${String(w)}x${String(h)}`);
  }
}

function invalidValue(msg: string): Error {
  const e = new Error(msg);
  e.name = 'InvalidValueError';
  return e;
}

interface DirectPutTarget {
  putImageData: (data: Uint8ClampedArray, w: number, h: number) => void;
}

interface CanvasLike {
  getContext: (kind: string) => unknown;
}

interface Ctx2D {
  putImageData: (img: unknown, x: number, y: number) => void;
}

/**
 * Sole owner of color, depth, and stencil pixel memory.
 *
 * Invariants: color length is width*height*4 in RGBA order, depth and stencil
 * lengths are width*height; width/height stay within the 4096 guard. Public
 * triple fields are intentionally writable so the rasterizer can write pixels
 * directly under the single-writer rule.
 */
export class Framebuffer {
  public width: number;
  public height: number;
  public color: Uint8ClampedArray;
  public depth: Float32Array;
  public stencil: Uint8Array;
  private ccR = 0;
  private ccG = 0;
  private ccB = 0;
  private ccA = 0;
  private cd = 1.0;
  private cs = 0;
  private cmR = true;
  private cmG = true;
  private cmB = true;
  private cmA = true;
  private dm = true;
  private sm = 0xff;

  constructor(w: number, h: number) {
    checkDims(w, h);
    this.width = w;
    this.height = h;
    this.color = new Uint8ClampedArray(w * h * 4);
    this.depth = new Float32Array(w * h).fill(1.0);
    this.stencil = new Uint8Array(w * h);
  }

  /**
   * Store clear color floats as given.
   *
   * @param r Red channel in 0..1, clamped and rounded at clear time.
   * @param g Green channel in 0..1, clamped and rounded at clear time.
   * @param b Blue channel in 0..1, clamped and rounded at clear time.
   * @param a Alpha channel in 0..1, clamped and rounded at clear time.
   * @returns Nothing; pixels unchanged until clear runs.
   */
  clearColor(r: number, g: number, b: number, a: number): void {
    this.ccR = r; this.ccG = g; this.ccB = b; this.ccA = a;
  }

  /**
   * Store clear depth.
   *
   * @param v Depth source value, clamped to 0..1 at clear time.
   * @returns Nothing; pixels unchanged until clear runs.
   */
  clearDepth(v: number): void { this.cd = v; }

  /**
   * Store clear stencil.
   *
   * @param v Stencil source value, masked to low 8 bits at clear time.
   * @returns Nothing; pixels unchanged until clear runs.
   */
  clearStencil(v: number): void { this.cs = v; }

  /**
   * Store color write mask.
   *
   * @param r Whether clear may write the red byte.
   * @param g Whether clear may write the green byte.
   * @param b Whether clear may write the blue byte.
   * @param a Whether clear may write the alpha byte.
   * @returns Nothing; masked-off channels keep prior bytes on clear.
   */
  setColorMask(r: boolean, g: boolean, b: boolean, a: boolean): void {
    this.cmR = r; this.cmG = g; this.cmB = b; this.cmA = a;
  }

  /**
   * Store depth write mask.
   *
   * @param flag Whether clear may write depth samples.
   * @returns Nothing; false leaves depth untouched on clear.
   */
  setDepthMask(flag: boolean): void { this.dm = flag; }

  /**
   * Store stencil write mask.
   *
   * @param mask Bitwise write enable; only low 8 bits kept, merged per sample on clear.
   * @returns Nothing.
   */
  setStencilMask(mask: number): void { this.sm = mask & 0xff; }

  /**
   * Masked clear with exact quantization.
   *
   * @param mask Bitwise OR of COLOR/DEPTH/STENCIL bits; zero mask writes nothing, unknown bits ignored.
   * @returns Nothing; selected planes filled honoring write masks.
   */
  clear(mask: number): void {
    const rb = Math.round(clamp01(this.ccR) * 255);
    const gb = Math.round(clamp01(this.ccG) * 255);
    const bb = Math.round(clamp01(this.ccB) * 255);
    const ab = Math.round(clamp01(this.ccA) * 255);
    const dv = clamp01(this.cd);
    const sv = this.cs & 0xff;
    if ((mask & COLOR_BUFFER_BIT) !== 0) {
      const c = this.color;
      for (let i = 0; i < c.length; i += 4) {
        if (this.cmR) c[i] = rb;
        if (this.cmG) c[i + 1] = gb;
        if (this.cmB) c[i + 2] = bb;
        if (this.cmA) c[i + 3] = ab;
      }
    }
    if ((mask & DEPTH_BUFFER_BIT) !== 0 && this.dm) {
      this.depth.fill(dv);
    }
    if ((mask & STENCIL_BUFFER_BIT) !== 0) {
      const inv = (~this.sm) & 0xff;
      const s = this.stencil;
      for (let i = 0; i < s.length; i++) {
        s[i] = ((s[i] as number) & inv) | (sv & this.sm);
      }
    }
  }

  /**
   * Return exact RGBA bytes for sub-rectangle, row-major, origin 0,0.
   *
   * @param x Left edge inside live extent.
   * @param y Top edge inside live extent.
   * @param w Rectangle width, must stay inside live extent.
   * @param h Rectangle height, must stay inside live extent.
   * @returns Fresh byte store of length w*h*4 in RGBA order.
   * @throws InvalidValueError-shaped Error when the rectangle is out of bounds.
   */
  readPixels(x: number, y: number, w: number, h: number): Uint8Array {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(w) || !Number.isInteger(h) ||
        x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > this.width || y + h > this.height) {
      throw invalidValue('readPixels out of bounds');
    }
    const out = new Uint8Array(w * h * 4);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const src = ((y + row) * this.width + (x + col)) * 4;
        const dst = (row * w + col) * 4;
        out[dst] = this.color[src] as number;
        out[dst + 1] = this.color[src + 1] as number;
        out[dst + 2] = this.color[src + 2] as number;
        out[dst + 3] = this.color[src + 3] as number;
      }
    }
    return out;
  }

  /**
   * Allocate-then-swap resize.
   *
   * @param w New width, positive integer within the 4096 guard.
   * @param h New height, positive integer within the 4096 guard.
   * @returns Nothing; live triple swapped only after replacements allocate.
   * @throws OutOfMemoryError when the guard rejects; prior buffers retained intact.
   */
  resize(w: number, h: number): void {
    checkDims(w, h);
    const nc = new Uint8ClampedArray(w * h * 4);
    const nd = new Float32Array(w * h).fill(1.0);
    const ns = new Uint8Array(w * h);
    this.width = w;
    this.height = h;
    this.color = nc;
    this.depth = nd;
    this.stencil = ns;
  }

  /**
   * Present live color buffer via 2D putImageData, no conversion.
   *
   * @param target Direct putImageData target or canvas exposing getContext('2d').
   * @returns Nothing; single putImageData call, no swizzle or flip. Invalid targets are a documented no-op.
   */
  presentToCanvas(target: unknown): void {
    if (typeof target === 'object' && target !== null) {
      const t = target as Partial<DirectPutTarget & CanvasLike>;
      if (typeof t.putImageData === 'function') {
        (t as DirectPutTarget).putImageData(this.color, this.width, this.height);
        return;
      }
      if (typeof t.getContext === 'function') {
        const ctx = (t as CanvasLike).getContext('2d') as Partial<Ctx2D> | null;
        if (ctx !== null && ctx !== undefined && typeof ctx.putImageData === 'function') {
          const g = globalThis as Record<string, unknown>;
          const IDCtor = g['ImageData'] as (new (d: Uint8ClampedArray, w: number, h: number) => unknown) | undefined;
          let img: unknown;
          if (typeof IDCtor === 'function') {
            img = new IDCtor(new Uint8ClampedArray(this.color), this.width, this.height);
          } else {
            img = { data: new Uint8ClampedArray(this.color), width: this.width, height: this.height };
          }
          (ctx as Ctx2D).putImageData(img, 0, 0);
          return;
        }
      }
    }
  }
}
