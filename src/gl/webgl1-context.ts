// CHANGELOG: Sprint 2 (2026-09-20): Sprint 2 T4 minimal WebGL1 context facade composition root
/** WebGL1Context — minimal WebGL 1.0 facade; composition root (ADR-013). */
import {
  COLOR_BUFFER_BIT,
  COLOR_CLEAR_VALUE,
  DEPTH_BUFFER_BIT,
  DEPTH_CLEAR_VALUE,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  SCISSOR_BOX,
  STENCIL_BUFFER_BIT,
  STENCIL_CLEAR_VALUE,
  TRIANGLES,
  VERSION,
  VERSION_STRING_WEBGL1,
  VIEWPORT,
} from './constants';
import type { GLenum } from './constants';
import { ErrorSink } from './errors';
import { GLState } from './state';
import type { CanvasDimensions } from './state';
import { DrawingBuffer } from './framebuffer';
import { resolveContextAttributes } from './context-attributes';
import type { WebGLContextAttributes } from './context-attributes';
import { clipTriangle } from '../raster/clipper';
import type { ClipVertex } from '../raster/clipper';
import { mapClipToScreen, rasterizeTriangle } from '../raster/rasterizer';

export interface DirectVertex {
  readonly position:
    | readonly [number, number, number, number]
    | readonly [number, number, number]
    | readonly [number, number];
  readonly color?: readonly [number, number, number, number] | readonly [number, number, number];
}

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 150;
const POINT_SIZE_DEFAULT = 1.0;
const DEFAULT_VARYING: readonly [number, number, number, number] = [1, 1, 1, 1];

/** Minimal WebGL 1.0 context facade composing ErrorSink, GLState, DrawingBuffer, raster core. */
export class WebGL1Context {
  readonly canvas: { width: number; height: number };
  private readonly errorSink: ErrorSink;
  private readonly glState: GLState;
  private readonly drawingBuffer: DrawingBuffer;
  private readonly contextAttributes: WebGLContextAttributes;

  /**
   * Construct the facade, resolving canvas dims and context attributes.
   *
   * Args:
   *   canvas: Optional dims stub; missing/non-positive/non-finite fall back to 300x150.
   *   attrs: Partial context attributes resolved via resolveContextAttributes.
   */
  constructor(canvas?: CanvasDimensions | null, attrs?: Partial<WebGLContextAttributes> | null) {
    let width = DEFAULT_WIDTH;
    let height = DEFAULT_HEIGHT;
    if (canvas !== undefined && canvas !== null && typeof canvas === 'object') {
      if (typeof canvas.width === 'number' && Number.isFinite(canvas.width) && canvas.width > 0) {
        width = Math.trunc(canvas.width);
      }
      if (typeof canvas.height === 'number' && Number.isFinite(canvas.height) && canvas.height > 0) {
        height = Math.trunc(canvas.height);
      }
    }
    this.canvas = { width, height };
    this.contextAttributes = resolveContextAttributes(attrs);
    this.errorSink = new ErrorSink();
    this.glState = new GLState(this.errorSink, this.canvas);
    this.drawingBuffer = new DrawingBuffer(this.errorSink, this.canvas);
  }

  /** Set the clear color. */
  clearColor(red: number, green: number, blue: number, alpha: number): void {
    this.glState.setClearColor(red, green, blue, alpha);
  }

  /** Clear buffers selected by mask; invalid bits record INVALID_VALUE. */
  clear(mask: number): void {
    const validBits = COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT | STENCIL_BUFFER_BIT;
    if ((mask & ~validBits) !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const pipelineState = this.glState.snapshot();
    this.drawingBuffer.clear(mask, pipelineState);
  }

  /** Set the viewport rectangle. */
  viewport(x: number, y: number, width: number, height: number): void {
    this.glState.setViewport(x, y, width, height);
  }

  /** Set the scissor rectangle. */
  scissor(x: number, y: number, width: number, height: number): void {
    this.glState.setScissor(x, y, width, height);
  }

  /** Enable a capability; invalid enums sink via GLState. */
  enable(cap: number): void {
    this.glState.setEnable(cap as GLenum, true);
  }

  /** Disable a capability; invalid enums sink via GLState. */
  disable(cap: number): void {
    this.glState.setEnable(cap as GLenum, false);
  }

  /**
   * Draw TRIANGLES from direct geometry through clip/map/rasterize.
   *
   * Args:
   *   mode: Must be TRIANGLES.
   *   first: First vertex index (must be >= 0).
   *   count: Vertex count (must be >= 0, multiple of 3).
   *   directGeometry: Direct vertex records; omitted means INVALID_OPERATION in M1.
   */
  drawArrays(mode: number, first: number, count: number, directGeometry?: readonly DirectVertex[]): void {
    if (mode !== TRIANGLES) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (first < 0 || count < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (count === 0) {
      return;
    }
    if (count % 3 !== 0) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (directGeometry === undefined || directGeometry === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (directGeometry.length < first + count) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const vertices = directGeometry.slice(first, first + count);
    const pipelineState = this.glState.snapshot();
    for (let index = 0; index < count; index += 3) {
      const g0 = vertices[index] as DirectVertex;
      const g1 = vertices[index + 1] as DirectVertex;
      const g2 = vertices[index + 2] as DirectVertex;
      const v0 = toClipVertex(g0);
      const v1 = toClipVertex(g1);
      const v2 = toClipVertex(g2);
      const clippedFan: ClipVertex[] = clipTriangle(v0, v1, v2);
      if (clippedFan.length < 3) {
        continue;
      }
      for (let fanIdx = 1; fanIdx < clippedFan.length - 1; fanIdx++) {
        const cv0 = clippedFan[0] as ClipVertex;
        const cv1 = clippedFan[fanIdx] as ClipVertex;
        const cv2 = clippedFan[fanIdx + 1] as ClipVertex;
        const sv0 = mapClipToScreen(cv0, pipelineState);
        const sv1 = mapClipToScreen(cv1, pipelineState);
        const sv2 = mapClipToScreen(cv2, pipelineState);
        rasterizeTriangle(sv0, sv1, sv2, pipelineState, this.drawingBuffer);
      }
    }
  }

  /**
   * Query context state.
   *
   * Args:
   *   pname: Parameter enum.
   *
   * Returns:
   *   Parameter value, or null with INVALID_ENUM for unsupported pnames.
   */
  getParameter(pname: number): unknown {
    if (pname === VERSION) {
      return VERSION_STRING_WEBGL1;
    }
    if (pname === VIEWPORT) {
      const vp = this.glState.getViewport();
      return new Int32Array([vp[0], vp[1], vp[2], vp[3]]);
    }
    if (pname === SCISSOR_BOX) {
      const sc = this.glState.getScissor();
      return new Int32Array([sc[0], sc[1], sc[2], sc[3]]);
    }
    if (pname === COLOR_CLEAR_VALUE) {
      const cc = this.glState.getClearColor();
      return new Float32Array([cc[0], cc[1], cc[2], cc[3]]);
    }
    if (pname === DEPTH_CLEAR_VALUE) {
      return this.glState.getClearDepth();
    }
    if (pname === STENCIL_CLEAR_VALUE) {
      return this.glState.getClearStencil();
    }
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  /** Drain the sticky error queue. */
  getError(): number {
    return this.errorSink.getError();
  }

  /** Return the resolved (frozen) context attributes. */
  getContextAttributes(): WebGLContextAttributes {
    return this.contextAttributes;
  }

  /**
   * Read pixels from the drawing buffer.
   *
   * Args:
   *   x, y, width, height: Source rectangle.
   *   format, type: Must be RGBA/UNSIGNED_BYTE (validated by DrawingBuffer).
   *   pixels: Destination view; null records INVALID_VALUE.
   *   dstOffset: Byte offset into destination.
   */
  readPixels(
    x: number,
    y: number,
    width: number,
    height: number,
    format: number,
    type: number,
    pixels: ArrayBufferView | null,
    dstOffset?: number,
  ): void {
    if (pixels === null || pixels === undefined) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.drawingBuffer.readPixels(x, y, width, height, format as GLenum, type as GLenum, pixels, dstOffset);
  }
}

function toClipVertex(g: DirectVertex): ClipVertex {
  const pos = g.position;
  const clip: [number, number, number, number] = [
    pos[0] as number,
    pos[1] as number,
    pos.length > 2 ? (pos[2] as number) : 0,
    pos.length > 3 ? (pos[3] as number) : 1,
  ];
  let varyings: Float32Array;
  if (g.color !== undefined) {
    const c = g.color;
    varyings = new Float32Array([
      c[0] as number,
      c[1] as number,
      c[2] as number,
      c.length > 3 ? (c[3] as number) : 1,
    ]);
  } else {
    varyings = new Float32Array([DEFAULT_VARYING[0], DEFAULT_VARYING[1], DEFAULT_VARYING[2], DEFAULT_VARYING[3]]);
  }
  return { clip, pointSize: POINT_SIZE_DEFAULT, varyings };
}
