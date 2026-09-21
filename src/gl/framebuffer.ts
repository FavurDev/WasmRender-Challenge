// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial drawing buffer with clear/readPixels
// CHANGELOG: Sprint 7 Task 1 (2026-09-21): FramebufferObject/RenderbufferObject, attachment management, completeness checking, FBO draw adapter.
/** DrawingBuffer — default WebGL drawing buffer: RGBA8 color + packed DEPTH24_STENCIL8. L2: imports constants + errors + state only. */
import {
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  DEPTH_ATTACHMENT,
  DEPTH_BUFFER_BIT,
  DEPTH_COMPONENT16,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAMEBUFFER_INCOMPLETE_ATTACHMENT,
  FRAMEBUFFER_INCOMPLETE_DIMENSIONS,
  FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT,
  FRAMEBUFFER_UNSUPPORTED,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  RENDERBUFFER,
  RENDERBUFFER_ALPHA_SIZE,
  RENDERBUFFER_BLUE_SIZE,
  RENDERBUFFER_DEPTH_SIZE,
  RENDERBUFFER_GREEN_SIZE,
  RENDERBUFFER_HEIGHT,
  RENDERBUFFER_INTERNAL_FORMAT,
  RENDERBUFFER_RED_SIZE,
  RENDERBUFFER_STENCIL_SIZE,
  RENDERBUFFER_WIDTH,
  RGB5_A1,
  RGB565,
  RGBA,
  RGBA4,
  STENCIL_ATTACHMENT,
  STENCIL_BUFFER_BIT,
  STENCIL_INDEX8,
  TEXTURE_2D,
  UNSIGNED_BYTE,
} from './constants';
import type { GLenum } from './constants';
import type { CanvasDimensions, PipelineState } from './state';
import type { IErrorSink } from './errors';

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 150;
const BYTES_PER_PIXEL = 4;
const BYTE_SCALE = 255;
const DEPTH_MAX_24 = 16777215;
const STENCIL_MASK_8 = 255;

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function resolveDim(v: number | undefined, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return Math.trunc(v);
  return fallback;
}

export class DrawingBuffer {
  private readonly errorSink: IErrorSink;
  private width: number;
  private height: number;
  private colorBuffer: Uint8Array;
  private depthStencilBuffer: Uint32Array;

  constructor(errorSink: IErrorSink, canvas?: CanvasDimensions) {
    this.errorSink = errorSink;
    this.width = resolveDim(canvas?.width, DEFAULT_WIDTH);
    this.height = resolveDim(canvas?.height, DEFAULT_HEIGHT);
    this.colorBuffer = new Uint8Array(this.width * this.height * BYTES_PER_PIXEL);
    this.depthStencilBuffer = new Uint32Array(this.width * this.height);
    this.depthStencilBuffer.fill((DEPTH_MAX_24 * 256) >>> 0);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getColorBuffer(): Uint8Array {
    return this.colorBuffer;
  }

  getDepthStencilBuffer(): Uint32Array {
    return this.depthStencilBuffer;
  }

  clear(mask: number, state: PipelineState): void {
    const count = this.width * this.height;
    if ((mask & COLOR_BUFFER_BIT) !== 0) {
      const cc = state.clearValues.clearColor;
      const targetR = Math.round(clamp01(cc[0]) * BYTE_SCALE);
      const targetG = Math.round(clamp01(cc[1]) * BYTE_SCALE);
      const targetB = Math.round(clamp01(cc[2]) * BYTE_SCALE);
      const targetA = Math.round(clamp01(cc[3]) * BYTE_SCALE);
      const cm = state.colorMask;
      const scOn = state.scissorTestEnabled;
      const sb = state.scissorBox;
      const allTrue = cm[0] && cm[1] && cm[2] && cm[3];
      const writePixel = (i: number): void => {
        const px = i % this.width;
        const py = Math.trunc(i / this.width);
        if (scOn && (px < sb.x || px >= sb.x + sb.width || py < sb.y || py >= sb.y + sb.height)) return;
        const o = i * BYTES_PER_PIXEL;
        if (allTrue) {
          this.colorBuffer[o] = targetR;
          this.colorBuffer[o + 1] = targetG;
          this.colorBuffer[o + 2] = targetB;
          this.colorBuffer[o + 3] = targetA;
        } else {
          if (cm[0]) this.colorBuffer[o] = targetR;
          if (cm[1]) this.colorBuffer[o + 1] = targetG;
          if (cm[2]) this.colorBuffer[o + 2] = targetB;
          if (cm[3]) this.colorBuffer[o + 3] = targetA;
        }
      };
      if (cm[0] || cm[1] || cm[2] || cm[3]) {
        for (let i = 0; i < count; i++) writePixel(i);
      }
    }
    const scissorOn = state.scissorTestEnabled;
    const scBox = state.scissorBox;
    const insideScissor = (i: number): boolean => {
      if (!scissorOn) return true;
      const px = i % this.width;
      const py = Math.trunc(i / this.width);
      return px >= scBox.x && px < scBox.x + scBox.width && py >= scBox.y && py < scBox.y + scBox.height;
    };
    if ((mask & DEPTH_BUFFER_BIT) !== 0) {
      if (state.depth.mask) {
        const depth24 = Math.round(clamp01(state.clearValues.clearDepth) * DEPTH_MAX_24) & DEPTH_MAX_24;
        const depthShifted = (depth24 * 256) >>> 0;
        for (let i = 0; i < count; i++) {
          if (!insideScissor(i)) continue;
          const existingStencil = this.depthStencilBuffer[i] & STENCIL_MASK_8;
          this.depthStencilBuffer[i] = (depthShifted | existingStencil) >>> 0;
        }
      }
    }
    if ((mask & STENCIL_BUFFER_BIT) !== 0) {
      const writeMask = state.stencilFront.writeMask & STENCIL_MASK_8;
      if (writeMask !== 0) {
        const clearStencil = (state.clearValues.clearStencil & STENCIL_MASK_8) & writeMask;
        const preserveMask = ~writeMask & STENCIL_MASK_8;
        for (let i = 0; i < count; i++) {
          if (!insideScissor(i)) continue;
          const word = this.depthStencilBuffer[i];
          const existingDepth = word & (DEPTH_MAX_24 * 256);
          const existingStencil = word & STENCIL_MASK_8;
          const newStencil = (existingStencil & preserveMask) | clearStencil;
          this.depthStencilBuffer[i] = (existingDepth | newStencil) >>> 0;
        }
      }
    }
  }

  readPixels(
    x: number,
    y: number,
    width: number,
    height: number,
    format: GLenum,
    type: GLenum,
    dst: ArrayBufferView,
    dstOffset?: number,
  ): void {
    const offset = dstOffset !== undefined ? dstOffset : 0;
    if (width < 0 || height < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (format !== RGBA) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (type !== UNSIGNED_BYTE) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (!(dst instanceof Uint8Array)) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const destArray = dst as Uint8Array;
    const required = offset + width * height * BYTES_PER_PIXEL;
    if (destArray.byteLength < required) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (width === 0 || height === 0) return;
    const readX = Math.trunc(x);
    const readY = Math.trunc(y);
    const readW = Math.trunc(width);
    const readH = Math.trunc(height);
    const startX = Math.max(0, readX);
    const endX = Math.min(this.width, readX + readW);
    const intersectW = Math.max(0, endX - startX);
    const startY = Math.max(0, readY);
    const endY = Math.min(this.height, readY + readH);
    const intersectH = Math.max(0, endY - startY);
    if (intersectW === 0 || intersectH === 0) return;
    for (let row = 0; row < readH; row++) {
      const targetY = readY + row;
      if (targetY >= startY && targetY < endY) {
        const dstRowStart = offset + row * readW * BYTES_PER_PIXEL;
        const dstWriteIndex = dstRowStart + (startX - readX) * BYTES_PER_PIXEL;
        const srcRowStart = (targetY * this.width + startX) * BYTES_PER_PIXEL;
        const copyCount = intersectW * BYTES_PER_PIXEL;
        destArray.set(this.colorBuffer.subarray(srcRowStart, srcRowStart + copyCount), dstWriteIndex);
      }
    }
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const w = Math.trunc(width);
    const h = Math.trunc(height);
    this.width = w;
    this.height = h;
    this.colorBuffer = new Uint8Array(w * h * BYTES_PER_PIXEL);
    this.depthStencilBuffer = new Uint32Array(w * h);
    this.depthStencilBuffer.fill((DEPTH_MAX_24 * 256) >>> 0);
  }
}

/** Opaque framebuffer object handle. */
export class WebGLFramebuffer {
  readonly id: number;
  alive = true;
  constructor(id: number) {
    this.id = id;
  }
}

/** Opaque renderbuffer object handle. */
export class WebGLRenderbuffer {
  readonly id: number;
  alive = true;
  constructor(id: number) {
    this.id = id;
  }
}

/** Renderbuffer storage record. */
export interface RenderbufferStorage {
  internalFormat: GLenum;
  width: number;
  height: number;
  colorData: Uint8Array;
  depthData: Uint32Array;
}

/** Framebuffer attachment record. */
export type FramebufferAttachment =
  | { readonly kind: 'renderbuffer'; readonly renderbuffer: WebGLRenderbuffer }
  | { readonly kind: 'texture'; readonly texture: unknown; readonly level: number };

/** Framebuffer object record with attachments. */
export interface FramebufferObject {
  readonly handle: WebGLFramebuffer;
  alive: boolean;
  readonly attachments: Map<GLenum, FramebufferAttachment>;
}

/** Maximum renderbuffer dimension. */
export const MAX_RENDERBUFFER_SIZE_VALUE = 4096;

const COLOR_RENDERABLE_FORMATS: ReadonlySet<GLenum> = new Set<GLenum>([RGBA4, RGB5_A1, RGB565]);
const LEGAL_STORAGE_FORMATS: ReadonlySet<GLenum> = new Set<GLenum>([
  RGBA4,
  RGB5_A1,
  RGB565,
  DEPTH_COMPONENT16,
  STENCIL_INDEX8,
]);

function isColorRenderableFormat(format: GLenum): boolean {
  return COLOR_RENDERABLE_FORMATS.has(format);
}

/** Renderbuffer lifecycle + storage manager. L2: imports constants + errors only. */
export class RenderbufferManager {
  private readonly errorSink: IErrorSink;
  private nextId = 1;
  private readonly objects = new Map<number, { handle: WebGLRenderbuffer; storage: RenderbufferStorage | null }>();
  private bound: WebGLRenderbuffer | null = null;

  constructor(errorSink: IErrorSink) {
    this.errorSink = errorSink;
  }

  createRenderbuffer(): WebGLRenderbuffer | null {
    if (this.errorSink.isContextLost()) return null;
    const handle = new WebGLRenderbuffer(this.nextId);
    this.nextId += 1;
    this.objects.set(handle.id, { handle, storage: null });
    return handle;
  }

  deleteRenderbuffer(rb: WebGLRenderbuffer | null): void {
    if (rb === null || rb === undefined) return;
    const rec = this.objects.get((rb as WebGLRenderbuffer).id);
    if (rec === undefined) return;
    rec.handle.alive = false;
    this.objects.delete((rb as WebGLRenderbuffer).id);
    if (this.bound !== null && this.bound.id === (rb as WebGLRenderbuffer).id) this.bound = null;
  }

  isRenderbuffer(rb: unknown): boolean {
    if (rb === null || rb === undefined) return false;
    if (!(rb instanceof WebGLRenderbuffer)) return false;
    const rec = this.objects.get((rb as WebGLRenderbuffer).id);
    return rec !== undefined && (rb as WebGLRenderbuffer).alive === true;
  }

  bindRenderbuffer(target: GLenum, rb: WebGLRenderbuffer | null): void {
    if (this.errorSink.isContextLost()) return;
    if (target !== RENDERBUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (rb !== null && !(rb instanceof WebGLRenderbuffer)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (rb !== null) {
      const rec = this.objects.get(rb.id);
      if (rec === undefined || rb.alive !== true) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
    }
    this.bound = rb;
  }

  getBoundRenderbuffer(): WebGLRenderbuffer | null {
    return this.bound;
  }

  getStorage(rb: WebGLRenderbuffer | null): RenderbufferStorage | null {
    if (rb === null || rb === undefined) return null;
    const rec = this.objects.get((rb as WebGLRenderbuffer).id);
    if (rec === undefined) return null;
    return rec.storage;
  }

  renderbufferStorage(target: GLenum, internalFormat: GLenum, width: number, height: number): void {
    if (this.errorSink.isContextLost()) return;
    if (target !== RENDERBUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (this.bound === null || this.bound.alive !== true || !this.objects.has(this.bound.id)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (!LEGAL_STORAGE_FORMATS.has(internalFormat)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const w = Math.trunc(width);
    const h = Math.trunc(height);
    if (w < 0 || h < 0 || w > MAX_RENDERBUFFER_SIZE_VALUE || h > MAX_RENDERBUFFER_SIZE_VALUE) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const rec = this.objects.get(this.bound.id);
    if (rec === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const colorData = new Uint8Array(Math.max(0, w * h * BYTES_PER_PIXEL));
    const depthData = new Uint32Array(Math.max(0, w * h));
    depthData.fill((DEPTH_MAX_24 * 256) >>> 0);
    rec.storage = { internalFormat, width: w, height: h, colorData, depthData };
  }

  getParameter(pname: GLenum): number {
    const storage = this.bound === null ? null : this.getStorage(this.bound);
    const w = storage === null ? 0 : storage.width;
    const h = storage === null ? 0 : storage.height;
    const fmt = storage === null ? 0 : storage.internalFormat;
    if (pname === RENDERBUFFER_WIDTH) return w;
    if (pname === RENDERBUFFER_HEIGHT) return h;
    if (pname === RENDERBUFFER_INTERNAL_FORMAT) return fmt;
    if (pname === RENDERBUFFER_RED_SIZE) {
      if (fmt === RGBA4) return 4;
      if (fmt === RGB5_A1) return 5;
      if (fmt === RGB565) return 5;
      return 0;
    }
    if (pname === RENDERBUFFER_GREEN_SIZE) {
      if (fmt === RGBA4) return 4;
      if (fmt === RGB5_A1) return 5;
      if (fmt === RGB565) return 6;
      return 0;
    }
    if (pname === RENDERBUFFER_BLUE_SIZE) {
      if (fmt === RGBA4) return 4;
      if (fmt === RGB5_A1) return 5;
      if (fmt === RGB565) return 5;
      return 0;
    }
    if (pname === RENDERBUFFER_ALPHA_SIZE) {
      if (fmt === RGBA4) return 4;
      if (fmt === RGB5_A1) return 1;
      return 0;
    }
    if (pname === RENDERBUFFER_DEPTH_SIZE) return fmt === DEPTH_COMPONENT16 ? 16 : 0;
    if (pname === RENDERBUFFER_STENCIL_SIZE) return fmt === STENCIL_INDEX8 ? 8 : 0;
    this.errorSink.recordError(INVALID_ENUM);
    return 0;
  }
}

/** Texture dimension lookup for framebuffer completeness. */
export interface IAttachmentTextureLookup {
  getLevelSize(texture: unknown, level: number): { width: number; height: number } | null;
  isAlive(texture: unknown): boolean;
}

/** Framebuffer lifecycle + attachment + completeness manager. */
export class FramebufferManager {
  private readonly errorSink: IErrorSink;
  private nextId = 1;
  private readonly objects = new Map<number, FramebufferObject>();
  private bound: WebGLFramebuffer | null = null;

  constructor(errorSink: IErrorSink) {
    this.errorSink = errorSink;
  }

  createFramebuffer(): WebGLFramebuffer | null {
    if (this.errorSink.isContextLost()) return null;
    const handle = new WebGLFramebuffer(this.nextId);
    this.nextId += 1;
    this.objects.set(handle.id, { handle, alive: true, attachments: new Map<GLenum, FramebufferAttachment>() });
    return handle;
  }

  deleteFramebuffer(fb: WebGLFramebuffer | null): void {
    if (fb === null || fb === undefined) return;
    const rec = this.objects.get((fb as WebGLFramebuffer).id);
    if (rec === undefined) return;
    rec.alive = false;
    rec.handle.alive = false;
    rec.attachments.clear();
    this.objects.delete((fb as WebGLFramebuffer).id);
    if (this.bound !== null && this.bound.id === (fb as WebGLFramebuffer).id) this.bound = null;
  }

  isFramebuffer(fb: unknown): boolean {
    if (fb === null || fb === undefined) return false;
    if (!(fb instanceof WebGLFramebuffer)) return false;
    const rec = this.objects.get((fb as WebGLFramebuffer).id);
    return rec !== undefined && (fb as WebGLFramebuffer).alive === true;
  }

  bindFramebuffer(target: GLenum, fb: WebGLFramebuffer | null): void {
    if (this.errorSink.isContextLost()) return;
    if (target !== FRAMEBUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (fb !== null && !(fb instanceof WebGLFramebuffer)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (fb !== null) {
      const rec = this.objects.get(fb.id);
      if (rec === undefined || fb.alive !== true) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
    }
    this.bound = fb;
  }

  getBoundFramebuffer(): WebGLFramebuffer | null {
    return this.bound;
  }

  getRecord(fb: WebGLFramebuffer | null): FramebufferObject | null {
    if (fb === null || fb === undefined) return null;
    const rec = this.objects.get((fb as WebGLFramebuffer).id);
    if (rec === undefined) return null;
    return rec;
  }

  framebufferTexture2D(
    target: GLenum,
    attachment: GLenum,
    textarget: GLenum,
    texture: unknown,
    level: number,
    textureLookup: IAttachmentTextureLookup,
  ): void {
    if (this.errorSink.isContextLost()) return;
    if (target !== FRAMEBUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (attachment !== COLOR_ATTACHMENT0 && attachment !== DEPTH_ATTACHMENT && attachment !== STENCIL_ATTACHMENT) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (textarget !== TEXTURE_2D) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (this.bound === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const rec = this.objects.get(this.bound.id);
    if (rec === undefined || this.bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (!Number.isInteger(level) || level < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (texture === null || texture === undefined) {
      rec.attachments.delete(attachment);
      return;
    }
    if (!textureLookup.isAlive(texture)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    rec.attachments.set(attachment, { kind: 'texture', texture, level });
  }

  framebufferRenderbuffer(
    target: GLenum,
    attachment: GLenum,
    renderbuffertarget: GLenum,
    rb: WebGLRenderbuffer | null,
    isLive: (rb: unknown) => boolean,
  ): void {
    if (this.errorSink.isContextLost()) return;
    if (target !== FRAMEBUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (attachment !== COLOR_ATTACHMENT0 && attachment !== DEPTH_ATTACHMENT && attachment !== STENCIL_ATTACHMENT) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (renderbuffertarget !== RENDERBUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (this.bound === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const rec = this.objects.get(this.bound.id);
    if (rec === undefined || this.bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (rb === null || rb === undefined) {
      rec.attachments.delete(attachment);
      return;
    }
    if (!(rb instanceof WebGLRenderbuffer) || !isLive(rb)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    rec.attachments.set(attachment, { kind: 'renderbuffer', renderbuffer: rb });
  }

  checkStatus(
    target: GLenum,
    fb: WebGLFramebuffer | null,
    rbLookup: (rb: WebGLRenderbuffer) => RenderbufferStorage | null,
    textureLookup: IAttachmentTextureLookup,
  ): GLenum {
    if (target !== FRAMEBUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return 0;
    }
    if (fb === null || fb === undefined) return FRAMEBUFFER_COMPLETE;
    const rec = this.objects.get((fb as WebGLFramebuffer).id);
    if (rec === undefined || (fb as WebGLFramebuffer).alive !== true) {
      return FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
    }
    if (rec.attachments.size === 0) return FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT;
    const widths: number[] = [];
    const heights: number[] = [];
    let hasDepth = false;
    let hasStencil = false;
    for (const [attachment, att] of rec.attachments) {
      if (att.kind === 'renderbuffer') {
        const storage = rbLookup(att.renderbuffer);
        if (att.renderbuffer.alive !== true || storage === null) return FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        if (storage.width === 0 || storage.height === 0) return FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        if (attachment === COLOR_ATTACHMENT0 && !isColorRenderableFormat(storage.internalFormat)) {
          return FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        }
        if (attachment === DEPTH_ATTACHMENT && storage.internalFormat !== DEPTH_COMPONENT16) {
          return FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        }
        if (attachment === STENCIL_ATTACHMENT && storage.internalFormat !== STENCIL_INDEX8) {
          return FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        }
        widths.push(storage.width);
        heights.push(storage.height);
      } else {
        if (!textureLookup.isAlive(att.texture)) return FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        const size = textureLookup.getLevelSize(att.texture, att.level);
        if (size === null || size.width === 0 || size.height === 0) return FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
        widths.push(size.width);
        heights.push(size.height);
      }
      if (attachment === DEPTH_ATTACHMENT) hasDepth = true;
      if (attachment === STENCIL_ATTACHMENT) hasStencil = true;
    }
    if (hasDepth && hasStencil) return FRAMEBUFFER_UNSUPPORTED;
    const w0 = widths[0] as number;
    const h0 = heights[0] as number;
    for (let i = 1; i < widths.length; i += 1) {
      if ((widths[i] as number) !== w0 || (heights[i] as number) !== h0) return FRAMEBUFFER_INCOMPLETE_DIMENSIONS;
    }
    return FRAMEBUFFER_COMPLETE;
  }
}

/**
 * DrawingBuffer-compatible FBO draw target.
 *
 * Aliases the attached color renderbuffer storage so rasterizer writes persist
 * and readPixels observes them; owns a packed depth/stencil buffer sized to the FBO.
 */
export class FboTarget {
  private readonly width: number;
  private readonly height: number;
  private readonly color: Uint8Array;
  private readonly depthStencil: Uint32Array;

  constructor(width: number, height: number, color: Uint8Array) {
    this.width = width;
    this.height = height;
    this.color = color;
    this.depthStencil = new Uint32Array(Math.max(0, width * height));
    this.depthStencil.fill((DEPTH_MAX_24 * 256) >>> 0);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getColorBuffer(): Uint8Array {
    return this.color;
  }

  getDepthStencilBuffer(): Uint32Array {
    return this.depthStencil;
  }

  clear(mask: number, state: PipelineState): void {
    const w = this.width;
    const h = this.height;
    if (w <= 0 || h <= 0) return;
    if ((mask & COLOR_BUFFER_BIT) !== 0) {
      const cc = state.clearValues.clearColor;
      const r = Math.round(clamp01(cc[0]) * BYTE_SCALE);
      const g = Math.round(clamp01(cc[1]) * BYTE_SCALE);
      const b = Math.round(clamp01(cc[2]) * BYTE_SCALE);
      const a = Math.round(clamp01(cc[3]) * BYTE_SCALE);
      const buf = this.color;
      for (let i = 0; i < w * h; i += 1) {
        const o = i * BYTES_PER_PIXEL;
        buf[o] = r;
        buf[o + 1] = g;
        buf[o + 2] = b;
        buf[o + 3] = a;
      }
    }
    if ((mask & DEPTH_BUFFER_BIT) !== 0 || (mask & STENCIL_BUFFER_BIT) !== 0) {
      const depth24 = Math.round(clamp01(state.clearValues.clearDepth) * DEPTH_MAX_24);
      const stencil = state.clearValues.clearStencil & STENCIL_MASK_8;
      const packed = ((depth24 * 256) | stencil) >>> 0;
      this.depthStencil.fill(packed);
    }
  }
}
