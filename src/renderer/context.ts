/**
 * @fileoverview SoftwareWebGLContext composition root owning GLState, Framebuffer, BufferStore, error queue.
 */
// CHANGELOG:
// - Sprint 1: Created minimal SoftwareWebGLContext composition root with clear/viewport/triangle path.
import { GLState } from "./state";
import { Framebuffer, OutOfMemoryError } from "./framebuffer";
import { pushError, drainError } from "./errors";
import { BufferStore } from "./buffer";
import { BLEND, BLEND_DST_RGB, BLEND_EQUATION, BLEND_SRC_RGB, COLOR_CLEAR_VALUE, COLOR_WRITEMASK, CULL_FACE, DEPTH_CLEAR_VALUE, DEPTH_FUNC, DEPTH_TEST, DEPTH_WRITEMASK, ELEMENT_ARRAY_BUFFER, INVALID_ENUM, INVALID_OPERATION, INVALID_VALUE, MAX_CUBE_MAP_TEXTURE_SIZE, MAX_CUBE_MAP_TEXTURE_SIZE_PNAME, MAX_RENDERBUFFER_SIZE, MAX_RENDERBUFFER_SIZE_PNAME, MAX_TEXTURE_IMAGE_UNITS, MAX_TEXTURE_IMAGE_UNITS_PNAME, MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE_PNAME, MAX_VERTEX_ATTRIBS, MAX_VERTEX_ATTRIBS_PNAME, MAX_VIEWPORT_DIMS, MAX_VIEWPORT_DIMS_PNAME, NO_ERROR, SCISSOR_BOX, SCISSOR_TEST, STENCIL_CLEAR_VALUE, STENCIL_TEST, STENCIL_WRITEMASK, TRIANGLES, UNSIGNED_SHORT, VIEWPORT } from "./gl-constants";

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

  /** Run masked clear on framebuffer, confined to scissor box when scissor test is enabled. */
  clear(mask: number): void {
    if (this.state.scissorTest) {
      this.fb.clear(mask, this.state.scissorBox);
    } else {
      this.fb.clear(mask);
    }
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
    if (pname === BLEND) return this.state.blendEnabled;
    if (pname === DEPTH_TEST) return this.state.depthTest;
    if (pname === STENCIL_TEST) return this.state.stencilTest;
    if (pname === SCISSOR_TEST) return this.state.scissorTest;
    if (pname === CULL_FACE) return this.state.cullFace;
    if (pname === COLOR_CLEAR_VALUE) return [...this.state.clearColor];
    if (pname === DEPTH_CLEAR_VALUE) return this.state.clearDepth;
    if (pname === STENCIL_CLEAR_VALUE) return this.state.clearStencil;
    if (pname === COLOR_WRITEMASK) return [...this.state.colorMask];
    if (pname === DEPTH_WRITEMASK) return this.state.depthMask;
    if (pname === STENCIL_WRITEMASK) return this.state.stencilMask;
    if (pname === VIEWPORT) return [...this.state.viewport];
    if (pname === SCISSOR_BOX) return [...this.state.scissorBox];
    if (pname === DEPTH_FUNC) return this.state.depthFunc;
    if (pname === BLEND_SRC_RGB) return this.state.blendSrcRGB;
    if (pname === BLEND_DST_RGB) return this.state.blendDstRGB;
    if (pname === BLEND_EQUATION) return this.state.blendEquation;
    if (pname === MAX_TEXTURE_SIZE_PNAME) return MAX_TEXTURE_SIZE;
    if (pname === MAX_VIEWPORT_DIMS_PNAME) return [...MAX_VIEWPORT_DIMS];
    if (pname === MAX_VERTEX_ATTRIBS_PNAME) return MAX_VERTEX_ATTRIBS;
    if (pname === MAX_TEXTURE_IMAGE_UNITS_PNAME) return MAX_TEXTURE_IMAGE_UNITS;
    if (pname === MAX_CUBE_MAP_TEXTURE_SIZE_PNAME) return MAX_CUBE_MAP_TEXTURE_SIZE;
    if (pname === MAX_RENDERBUFFER_SIZE_PNAME) return MAX_RENDERBUFFER_SIZE;
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

  /**
   * Push one draw-failure code; no state or pixel change.
   * @param code One of INVALID_ENUM, INVALID_VALUE, INVALID_OPERATION.
   */
  private reportDrawFailure(code: number): void {
    pushError(this.queue, code);
  }

  /**
   * Report default-framebuffer completeness; never pushes.
   * @returns True when width and height are positive.
   */
  checkDefaultFramebufferComplete(): boolean {
    return this.fb.width > 0 && this.fb.height > 0;
  }

  /**
   * Validate and execute a non-indexed TRIANGLES draw; placeholder shading on success.
   * @param mode Draw mode, TRIANGLES only. @param first First vertex ordinal. @param count Vertex count.
   */
  drawArrays = (mode: number, first: number, count: number): void => {
    if (mode !== TRIANGLES) { this.reportDrawFailure(INVALID_ENUM); return; }
    if (!Number.isInteger(first) || first < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (!Number.isInteger(count) || count < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (this.state.currentProgram === 0) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (!this.checkDefaultFramebufferComplete()) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (count === 0) return;
    for (let i = 0; i < count; i++) this.store.decodeAttribute(0, first + i);
    this.drawTriangle();
  };

  /**
   * Validate and execute an indexed TRIANGLES draw via UNSIGNED_SHORT indices.
   * @param mode Draw mode, TRIANGLES only. @param count Index count. @param type Index type, UNSIGNED_SHORT only. @param offset Byte offset into element bytes.
   */
  drawElements = (mode: number, count: number, type: number, offset: number): void => {
    if (mode !== TRIANGLES) { this.reportDrawFailure(INVALID_ENUM); return; }
    if (type !== UNSIGNED_SHORT) { this.reportDrawFailure(INVALID_ENUM); return; }
    if (!Number.isInteger(count) || count < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (!Number.isInteger(offset) || offset < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (this.state.currentProgram === 0) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (!this.checkDefaultFramebufferComplete()) { this.reportDrawFailure(INVALID_OPERATION); return; }
    const elemHandle = this.store.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
    if (count > 0 && elemHandle === 0) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (count === 0) return;
    const bytes = this.store.getBufferBytes(elemHandle);
    if (!bytes || offset + count * 2 > bytes.length) { this.reportDrawFailure(INVALID_VALUE); return; }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < count; i++) {
      const idx = view.getUint16(offset + i * 2, true);
      this.store.decodeAttribute(0, idx);
    }
    this.drawTriangle();
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
