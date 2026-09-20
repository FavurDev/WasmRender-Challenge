// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial drawing buffer with clear/readPixels
/** DrawingBuffer — default WebGL drawing buffer: RGBA8 color + packed DEPTH24_STENCIL8. L2: imports constants + errors + state only. */
import {
  COLOR_BUFFER_BIT,
  DEPTH_BUFFER_BIT,
  INVALID_ENUM,
  INVALID_VALUE,
  RGBA,
  STENCIL_BUFFER_BIT,
  UNSIGNED_BYTE,
} from './constants';
import type { GLenum } from './constants';
import type { CanvasDimensions, PipelineState } from './state';
import type { IErrorSink } from './errors';

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 150;
const BYTES_PER_PIXEL = 4;
const DEPTH_MAX_24 = 16777215;
const STENCIL_MASK_8 = 255;
const DEPTH_SHIFT = 8;
const CHANNEL_COUNT = 4;

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
    this.depthStencilBuffer.fill((DEPTH_MAX_24 * (DEPTH_SHIFT === 8 ? 256 : 256)) >>> 0);
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
      const targetR = Math.round(clamp01(cc[0]) * STENCIL_MASK_8);
      const targetG = Math.round(clamp01(cc[1]) * STENCIL_MASK_8);
      const targetB = Math.round(clamp01(cc[2]) * STENCIL_MASK_8);
      const targetA = Math.round(clamp01(cc[3]) * STENCIL_MASK_8);
      const cm = state.colorMask;
      const allTrue = cm[0] && cm[1] && cm[2] && cm[3];
      if (allTrue) {
        for (let i = 0; i < count; i++) {
          const o = i * CHANNEL_COUNT;
          this.colorBuffer[o] = targetR;
          this.colorBuffer[o + 1] = targetG;
          this.colorBuffer[o + 2] = targetB;
          this.colorBuffer[o + 3] = targetA;
        }
      } else if (cm[0] || cm[1] || cm[2] || cm[3]) {
        for (let i = 0; i < count; i++) {
          const o = i * CHANNEL_COUNT;
          if (cm[0]) this.colorBuffer[o] = targetR;
          if (cm[1]) this.colorBuffer[o + 1] = targetG;
          if (cm[2]) this.colorBuffer[o + 2] = targetB;
          if (cm[3]) this.colorBuffer[o + 3] = targetA;
        }
      }
    }
    if ((mask & DEPTH_BUFFER_BIT) !== 0) {
      if (state.depth.mask) {
        const depth24 = Math.round(clamp01(state.clearValues.clearDepth) * DEPTH_MAX_24) & DEPTH_MAX_24;
        const depthShifted = (depth24 * 256) >>> 0;
        for (let i = 0; i < count; i++) {
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
