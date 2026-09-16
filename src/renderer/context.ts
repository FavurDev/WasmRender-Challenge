/**
 * @fileoverview SoftwareWebGLContext composition root owning GLState, Framebuffer, BufferStore, error queue.
 */
// CHANGELOG:
// - Sprint 1: Created minimal SoftwareWebGLContext composition root with clear/viewport/triangle path.
import { GLState } from "./state";
import { Framebuffer, OutOfMemoryError } from "./framebuffer";
import { pushError, drainError } from "./errors";
import { BufferStore } from "./buffer";
import { INVALID_ENUM, INVALID_VALUE, MAX_TEXTURE_SIZE, NO_ERROR } from "./gl-constants";

const MAX_TEXTURE_SIZE_PNAME = 0x0d33;
const VIEWPORT_PNAME = 0x0ba2;
const CLEAR_COLOR_PNAME = 0x0b00;
const DEPTH_FUNC_PNAME = 0x0b74;
const SCISSOR_BOX_PNAME = 0x0c10;
const STENCIL_WRITEMASK_PNAME = 0x0b98;

interface CanvasLike {
  width?: number;
  height?: number;
  getContext?: (kind: string) => unknown;
}

/**
 * Minimal software WebGL context: owns state, pixels, BufferStore, and error queue.
 */
export class SoftwareWebGLContext {
  private state: GLState;
  private fb: Framebuffer;
  private queue: number[] = [];
  private canvas: unknown;
  private store: BufferStore;

  /**
   * Build owned state, pixels, and queue sized to canvas extent.
   * @param state Fresh capability store.
   * @param fb Fresh pixel triple.
   * @param canvas Canvas handle for presentation only.
   */
  constructor(state: GLState, fb: Framebuffer, canvas: unknown) {
    this.state = state;
    this.fb = fb;
    this.canvas = canvas;
    this.store = new BufferStore();
  }

  /** Stage clear color on framebuffer. */
  clearColor(r: number, g: number, b: number, a: number): void {
    this.state.clearColor = [r, g, b, a];
    this.fb.clearColor(r, g, b, a);
  }

  /** Stage clear depth on GLState and framebuffer. */
  clearDepth(v: number): void {
    this.state.setClearDepth(v);
    this.fb.clearDepth(v);
  }

  /** Stage clear stencil on GLState and framebuffer. */
  clearStencil(v: number): void {
    this.state.setClearStencil(v);
    this.fb.clearStencil(v);
  }

  /** Stage depth write mask on GLState and framebuffer. */
  depthMask(flag: boolean): void {
    this.state.setDepthMask(flag);
    this.fb.setDepthMask(flag);
  }

  /** Stage color write mask on GLState and framebuffer. */
  colorMask(r: boolean, g: boolean, b: boolean, a: boolean): void {
    this.state.setColorMask(r, g, b, a);
    this.fb.setColorMask(r, g, b, a);
  }

  /** Stage stencil write mask on GLState and framebuffer. */
  stencilMask(mask: number): void {
    this.state.setStencilMask(mask);
    this.fb.setStencilMask(mask);
  }

  /**
   * Replace scissor box; negative size pushes one code with no state change.
   * @param x Left origin. @param y Bottom origin. @param w Width. @param h Height.
   */
  scissor(x: number, y: number, w: number, h: number): void {
    const code = this.state.setScissor(x, y, w, h);
    if (code !== null) pushError(this.queue, code);
  }

  /**
   * Query capability flag; unknown enum returns false without queue change
   * (the TDD unknown-enum case requires exactly one code total across the
   * enable+isEnabled pair, with the single push owned by enable).
   * @param cap Capability code. @returns Flag or false on rejection.
   */
  isEnabled(cap: number): boolean {
    const result = this.state.isEnabled(cap);
    if (typeof result !== "boolean") return false;
    return result;
  }

  /** Run masked clear on framebuffer. */
  clear(mask: number): void {
    this.fb.clear(mask);
  }

  /**
   * Replace viewport box; negative values rejected with one code.
   * @param x Left origin. @param y Bottom origin. @param w Width. @param h Height.
   */
  viewport(x: number, y: number, w: number, h: number): void {
    const code = this.state.setViewport(x, y, w, h);
    if (code !== null) pushError(this.queue, code);
  }

  /**
   * Flip capability on; unknown enum pushes one code.
   * @param cap Capability code.
   */
  enable(cap: number): void {
    const code = this.state.enable(cap);
    if (code !== null) pushError(this.queue, code);
  }

  /**
   * Flip capability off; unknown enum pushes one code.
   * @param cap Capability code.
   */
  disable(cap: number): void {
    const code = this.state.disable(cap);
    if (code !== null) pushError(this.queue, code);
  }

  /**
   * Read back state or limits; unknown query pushes one code and returns null.
   * @param pname Query code.
   * @returns Value copy, limit, or null.
   */
  getParameter(pname: number): unknown {
    if (pname === MAX_TEXTURE_SIZE_PNAME) return MAX_TEXTURE_SIZE;
    if (pname === VIEWPORT_PNAME) return [...this.state.viewport];
    if (pname === CLEAR_COLOR_PNAME) return [...this.state.clearColor];
    if (pname === DEPTH_FUNC_PNAME) return this.state.depthFunc;
    if (pname === SCISSOR_BOX_PNAME) return [...this.state.scissorBox];
    if (pname === STENCIL_WRITEMASK_PNAME) return this.state.stencilMask;
    // Keep clear-color readback in sync with framebuffer-staged values is not
    // required in minimal scope; state copy is authoritative.
    pushError(this.queue, INVALID_ENUM);
    return null;
  }

  /**
   * Drain head of error queue or NO_ERROR; never throws.
   * @returns Head code or NO_ERROR.
   */
  getError(): number {
    return drainError(this.queue);
  }

  /**
   * Exact-byte readback; out-of-bounds pushes one code and returns null.
   * @returns Bytes or null.
   */
  readPixels(x: number, y: number, w: number, h: number): Uint8Array | null {
    try {
      return this.fb.readPixels(x, y, w, h);
    } catch {
      pushError(this.queue, INVALID_VALUE);
      return null;
    }
  }

  /** Paint fixed red triangle; queue untouched. */
  drawTriangle(): void {
    const v0x = 32; const v0y = 16;
    const v1x = 16; const v1y = 48;
    const v2x = 48; const v2y = 48;
    const denom = (v1y - v2y) * (v0x - v2x) + (v2x - v1x) * (v0y - v2y);
    if (denom === 0) return;
    const W = this.fb.width; const H = this.fb.height;
    const minX = Math.max(0, Math.min(v0x, v1x, v2x));
    const maxX = Math.min(W - 1, Math.max(v0x, v1x, v2x));
    const minY = Math.max(0, Math.min(v0y, v1y, v2y));
    const maxY = Math.min(H - 1, Math.max(v0y, v1y, v2y));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const l0 = ((v1y - v2y) * (x - v2x) + (v2x - v1x) * (y - v2y)) / denom;
        const l1 = ((v2y - v0y) * (x - v2x) + (v0x - v2x) * (y - v2y)) / denom;
        const l2 = 1 - l0 - l1;
        if (l0 >= 0 && l1 >= 0 && l2 >= 0) {
          const idx = (y * W + x) * 4;
          this.fb.color[idx] = 255;
          this.fb.color[idx + 1] = 0;
          this.fb.color[idx + 2] = 0;
          this.fb.color[idx + 3] = 255;
        }
      }
    }
    void NO_ERROR;
  }

  /** Create a buffer handle via owned store. @returns Fresh handle. */
  createBuffer(): number {
    return this.store.createBuffer();
  }

  /** Bind buffer via owned store; pushes one code on rejection. */
  bindBuffer(target: number, buffer: number | null): void {
    const code = this.store.bindBuffer(target, buffer);
    if (code !== null) pushError(this.queue, code);
  }

  /** Upload bytes via owned store; pushes one code on rejection. */
  bufferData(target: number, data: ArrayBufferView, usage: number): void {
    const code = this.store.bufferData(target, data, usage);
    if (code !== null) pushError(this.queue, code);
  }

  /** Delete buffer via owned store; never pushes. */
  deleteBuffer(buffer: number): void {
    this.store.deleteBuffer(buffer);
  }

  /** Configure attribute pointer; pushes one code on rejection. */
  vertexAttribPointer(index: number, size: number, type: number, normalized: boolean, stride: number, offset: number): void {
    const code = this.store.vertexAttribPointer(index, size, type, normalized, stride, offset);
    if (code !== null) pushError(this.queue, code);
  }

  /** Enable attribute array; pushes one code on rejection. */
  enableVertexAttribArray(index: number): void {
    const code = this.store.enableVertexAttribArray(index);
    if (code !== null) pushError(this.queue, code);
  }

  /** Disable attribute array; pushes one code on rejection. */
  disableVertexAttribArray(index: number): void {
    const code = this.store.disableVertexAttribArray(index);
    if (code !== null) pushError(this.queue, code);
  }

  /**
   * Decode attribute vertex; never pushes.
   * @param index Attribute index. @param vertexIndex Vertex ordinal.
   * @returns Components or null.
   */
  decodeAttribute(index: number, vertexIndex: number): number[] | null {
    return this.store.decodeAttribute(index, vertexIndex);
  }

  /**
   * Resolve bound handle. @param target Bind target. @returns Handle or 0.
   */
  getBoundBuffer(target: number): number {
    return this.store.getBoundBuffer(target);
  }

  /** Present via framebuffer; never throws. */
  presentToCanvas(): void {
    try {
      this.fb.presentToCanvas(this.canvas);
    } catch {
      // documented no-op
    }
  }
}

/**
 * Build isolated context or return null on allocation failure without throwing.
 * @param canvas Canvas supplying width/height and presentation target.
 * @returns Context holder or null.
 */
export function createSoftwareWebGLContext(canvas: CanvasLike, _attrs?: unknown): SoftwareWebGLContext | null {
  try {
    const w = typeof canvas?.width === "number" ? canvas.width : 64;
    const h = typeof canvas?.height === "number" ? canvas.height : 64;
    const state = new GLState(w, h);
    const fb = new Framebuffer(w, h);
    return new SoftwareWebGLContext(state, fb, canvas);
  } catch (e) {
    if (e instanceof OutOfMemoryError) return null;
    // Allocation failure (e.g. typed-array RangeError) also yields null.
    return null;
  }
}
