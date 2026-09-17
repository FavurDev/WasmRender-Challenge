/**
 * @fileoverview Framebuffer store: sole pixel-memory owner (four color attachments + depth + stencil).
 *
 * Single-writer pixel store backing the default framebuffer. Depends only on
 * gl-constants limits and bit masks; single-threaded with no allocation in
 * fill loops. Color layout matches 2D ImageData RGBA order so presentation
 * needs no conversion.
 */
// CHANGELOG:
// - Sprint 1: Created framebuffer triple with masked clear, readPixels, and putImageData presentation.
// - Sprint 2: Added scissor confinement param to clear (Task 5).
// - Sprint 4: Verified exact readPixels readback supporting sampler/readback wiring.
// - Sprint 5: Added 4-attachment drawBuffers config with masked per-attachment writes and draw-plane helpers.
import { COLOR_ATTACHMENT0, COLOR_BUFFER_BIT, DEPTH_BUFFER_BIT, MAX_COLOR_ATTACHMENTS, MAX_VIEWPORT_DIMS, STENCIL_BUFFER_BIT } from './gl-constants';
import { InvalidOperationError, InvalidValueError, OutOfMemoryError } from './errors';

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
 * Sole owner of color-attachment, depth, and stencil pixel memory.
 *
 * Invariants: each of the four color attachments has length width*height*4 in
 * RGBA order with index 0 aliasing the default color target, depth and stencil
 * lengths are width*height; width/height stay within the 4096 guard. Public
 * pixel fields are intentionally writable so the rasterizer can write pixels
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
  private attachments: Uint8ClampedArray[] = [];
  private drawConfig: number[] = [COLOR_ATTACHMENT0];

  constructor(w: number, h: number) {
    checkDims(w, h);
    this.width = w;
    this.height = h;
    this.color = new Uint8ClampedArray(w * h * 4);
    this.attachments = [this.color];
    for (let i = 1; i < MAX_COLOR_ATTACHMENTS; i++) {
      this.attachments.push(new Uint8ClampedArray(w * h * 4));
    }
    this.depth = new Float32Array(w * h).fill(1.0);
    this.stencil = new Uint8Array(w * h);
  }

  /**
   * Live attachment total, at most MAX_COLOR_ATTACHMENTS.
   * @returns Always MAX_COLOR_ATTACHMENTS (4).
   */
  attachmentCount(): number {
    return this.attachments.length;
  }

  /**
   * Per-attachment pixel bytes; index 0 is the existing default target.
   * @param index Attachment slot 0..3.
   * @returns Live byte store for the slot.
   * @throws InvalidValueError-shaped Error when index is out of range.
   */
  attachmentBuffer(index: number): Uint8ClampedArray {
    const buf = this.attachments[index];
    if (buf === undefined) throw invalidValue(`attachmentBuffer out of range ${String(index)}`);
    return buf;
  }

  /**
   * Validate-then-swap draw-buffer list; guard-then-swap preservation.
   * @param list Candidate attachment enum list.
   * @throws InvalidOperationError on over-length, out-of-range, or duplicate entry with stored config untouched.
   */
  configureDrawBuffers(list: number[]): void {
    if (list.length > MAX_COLOR_ATTACHMENTS) {
      throw new InvalidOperationError('drawBuffers: over-length list');
    }
    const seen = new Set<number>();
    for (const e of list) {
      if (!Number.isInteger(e) || e < COLOR_ATTACHMENT0 || e > COLOR_ATTACHMENT0 + MAX_COLOR_ATTACHMENTS - 1) {
        throw new InvalidOperationError(`drawBuffers: out-of-range entry ${String(e)}`);
      }
      if (seen.has(e)) throw new InvalidOperationError(`drawBuffers: duplicate entry ${String(e)}`);
      seen.add(e);
    }
    this.drawConfig = [...list];
  }

  /**
   * Fresh copy of the stored draw-buffer configuration.
   * @returns Copy of the active draw-buffer enum list.
   */
  activeDrawBuffers(): number[] {
    return [...this.drawConfig];
  }
  /**
   * Count of configured draw planes without allocating a copy.
   * @returns Number of active draw-buffer entries.
   */
  drawPlaneCount(): number {
    return this.drawConfig.length;
  }
  /**
   * Draw-buffer enum at position k without allocating a copy.
   * @param k Position inside the stored configuration.
   * @returns Attachment enum at that position.
   */
  drawPlaneAt(k: number): number {
    return this.drawConfig[k] as number;
  }

  /**
   * Write one fragment position across all configured attachments honoring the shared color mask.
   * @param x Column inside live extent. @param y Row inside live extent.
   * @param colors One RGBA tuple per configured attachment, in stored order.
   */
  writeFragmentToAttachments(x: number, y: number, colors: Array<[number, number, number, number]>): void {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const n = this.drawConfig.length;
    for (let k = 0; k < n; k++) {
      const slot = (this.drawConfig[k] as number) - COLOR_ATTACHMENT0;
      const buf = this.attachments[slot];
      const c = colors[k];
      if (buf === undefined || c === undefined) continue;
      const i = (y * this.width + x) * 4;
      if (this.cmR) buf[i] = c[0] as number;
      if (this.cmG) buf[i + 1] = c[1] as number;
      if (this.cmB) buf[i + 2] = c[2] as number;
      if (this.cmA) buf[i + 3] = c[3] as number;
    }
  }

  /**
   * Exact-byte readback from a single attachment region.
   * @param x Left edge. @param y Top edge. @param w Width. @param h Height. @param index Attachment slot 0..3.
   * @returns Fresh byte store of length w*h*4 in RGBA order.
   * @throws InvalidValueError-shaped Error when rectangle or index is out of bounds.
   */
  readAttachment(x: number, y: number, w: number, h: number, index: number): Uint8Array {
    const buf = this.attachments[index];
    if (buf === undefined) throw new InvalidValueError(`readAttachment bad index ${String(index)}`);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(w) || !Number.isInteger(h) ||
        x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > this.width || y + h > this.height) {
      throw invalidValue('readAttachment out of bounds');
    }
    const out = new Uint8Array(w * h * 4);
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const src = ((y + row) * this.width + (x + col)) * 4;
        const dst = (row * w + col) * 4;
        out[dst] = buf[src] as number;
        out[dst + 1] = buf[src + 1] as number;
        out[dst + 2] = buf[src + 2] as number;
        out[dst + 3] = buf[src + 3] as number;
      }
    }
    return out;
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
   * @param scissor Optional [x, y, w, h] confinement box; omitted clears the full frame, out-of-range edges are clamped, zero-area writes nothing.
   * @returns Nothing; selected planes filled honoring write masks.
   */
  clear(mask: number, scissor?: readonly [number, number, number, number]): void {
    const rb = Math.round(clamp01(this.ccR) * 255);
    const gb = Math.round(clamp01(this.ccG) * 255);
    const bb = Math.round(clamp01(this.ccB) * 255);
    const ab = Math.round(clamp01(this.ccA) * 255);
    const dv = clamp01(this.cd);
    const sv = this.cs & 0xff;
    // Compute confined region: full frame by default, clamped scissor intersection otherwise.
    let x0 = 0;
    let y0 = 0;
    let x1 = this.width;
    let y1 = this.height;
    if (scissor !== undefined) {
      const sx = Math.floor(scissor[0]);
      const sy = Math.floor(scissor[1]);
      const sw = Math.floor(scissor[2]);
      const sh = Math.floor(scissor[3]);
      x0 = Math.max(0, sx);
      y0 = Math.max(0, sy);
      x1 = Math.min(this.width, sx + sw);
      y1 = Math.min(this.height, sy + sh);
      if (x1 <= x0 || y1 <= y0) return;
    }
    const full = x0 === 0 && y0 === 0 && x1 === this.width && y1 === this.height;
    if ((mask & COLOR_BUFFER_BIT) !== 0) {
      for (const e of this.drawConfig) {
        const slot = e - COLOR_ATTACHMENT0;
        const c = this.attachments[slot];
        if (c === undefined) continue;
        if (full) {
          for (let i = 0; i < c.length; i += 4) {
            if (this.cmR) c[i] = rb;
            if (this.cmG) c[i + 1] = gb;
            if (this.cmB) c[i + 2] = bb;
            if (this.cmA) c[i + 3] = ab;
          }
        } else {
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = (y * this.width + x) * 4;
              if (this.cmR) c[i] = rb;
              if (this.cmG) c[i + 1] = gb;
              if (this.cmB) c[i + 2] = bb;
              if (this.cmA) c[i + 3] = ab;
            }
          }
        }
      }
    }
    if ((mask & DEPTH_BUFFER_BIT) !== 0 && this.dm) {
      if (full) {
        this.depth.fill(dv);
      } else {
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            this.depth[y * this.width + x] = dv;
          }
        }
      }
    }
    if ((mask & STENCIL_BUFFER_BIT) !== 0) {
      const inv = (~this.sm) & 0xff;
      const s = this.stencil;
      const val = sv & this.sm;
      if (full) {
        for (let i = 0; i < s.length; i++) {
          s[i] = ((s[i] as number) & inv) | val;
        }
      } else {
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = y * this.width + x;
            s[i] = ((s[i] as number) & inv) | val;
          }
        }
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
    // IMPLEMENTATION DECISION: allocate-then-swap all 4 attachments first. Rationale: failed realloc keeps every prior buffer. Alternatives: in-place resize (risks partial state).
    const fresh: Uint8ClampedArray[] = [];
    for (let i = 0; i < MAX_COLOR_ATTACHMENTS; i++) {
      fresh.push(new Uint8ClampedArray(w * h * 4));
    }
    const nd = new Float32Array(w * h).fill(1.0);
    const ns = new Uint8Array(w * h);
    this.width = w;
    this.height = h;
    this.color = fresh[0] as Uint8ClampedArray;
    this.attachments = fresh;
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
