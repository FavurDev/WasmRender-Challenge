// CHANGELOG: Sprint 8 Task 5 (2026-09-22): WebGL2-only 3D/array texture facade (texImage3D family + WebGL2 pixel-store interception). ADR-004: WebGL1Context never exposes these methods.
// CHANGELOG: Sprint 8 Task 1 (2026-09-22): VAO family merged alongside Task 5 facade (create/bind/delete/isVertexArray + getVertexAttrib/Offset, everBound tracking).
// CHANGELOG: Sprint 8 remediation (46ba504): removed test-only drawOcclusionScene helper; occlusion counts flow via QuerySync only.
// CHANGELOG: Sprint 11 (2026-09-23): Symbol.hasInstance guard + WebGL2RenderingContext alias trap.
// CHANGELOG: Sprint 13 (2026-09-24): T3 state wave: MAX_ELEMENT_INDEX 0x8ffe=0xffffff and 0x9111=0 limit overrides (349a3eb).
/** WebGL2Context — WebGL1Context subclass exposing the WebGL 2.0 3D/array texture family.
 *
 * Responsibility: texImage3D/texSubImage3D/copyTexSubImage3D facade plus WebGL2
 * pixel-store unpack interception (UNPACK_ROW_LENGTH/IMAGE_HEIGHT/SKIP_PIXELS/
 * SKIP_ROWS/SKIP_IMAGES), all delegated to the shared TextureManager. WebGL1
 * behavior is inherited untouched; the 3D family exists ONLY here (ADR-004).
 */
import {
  ARRAY_BUFFER,
  BACK,
  BYTE,
  COLOR,
  COLOR_ATTACHMENT0,
  COLOR_ATTACHMENT1,
  COLOR_ATTACHMENT2,
  COLOR_ATTACHMENT3,
  COPY_READ_BUFFER,
  COPY_WRITE_BUFFER,
  CURRENT_QUERY,
  CURRENT_VERTEX_ATTRIB,
  DEPTH_ATTACHMENT,
  DEPTH,
  DEPTH24_STENCIL8,
  DEPTH_COMPONENT16,
  DEPTH_COMPONENT24,
  DEPTH_STENCIL,
  DEPTH_STENCIL_ATTACHMENT,
  DYNAMIC_DRAW,
  DRAW_BUFFER0,
  DRAW_BUFFER1,
  DRAW_BUFFER2,
  DRAW_BUFFER3,
  DRAW_FRAMEBUFFER,
  ELEMENT_ARRAY_BUFFER,
  FRAMEBUFFER,
  INT,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LIMIT_MAX_3D_TEXTURE_SIZE,
  LIMIT_MAX_COMBINED_TEXTURE_IMAGE_UNITS_WEBGL2,
  LIMIT_MAX_FRAGMENT_UNIFORM_VECTORS_WEBGL2,
  LIMIT_MAX_TEXTURE_IMAGE_UNITS_WEBGL2,
  LIMIT_MAX_TEXTURE_SIZE,
  LIMIT_MAX_VERTEX_UNIFORM_VECTORS_WEBGL2,
  MAX_3D_TEXTURE_SIZE,
  MAX_ARRAY_TEXTURE_LAYERS,
  MAX_COLOR_ATTACHMENTS,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS,
  MAX_DRAW_BUFFERS,
  MAX_FRAGMENT_UNIFORM_VECTORS,
  MAX_TEXTURE_IMAGE_UNITS,
  MAX_VERTEX_ATTRIBS,
  MAX_VERTEX_UNIFORM_VECTORS,
  NONE,
  PIXEL_PACK_BUFFER,
  PIXEL_UNPACK_BUFFER,
  POINTS,
  READ_BUFFER,
  READ_FRAMEBUFFER,
  RENDERBUFFER,
  RGB565,
  RGB5_A1,
  RGB8,
  RGBA,
  RGBA4,
  RGBA8,
  SHORT,
  STATIC_DRAW,
  STENCIL_ATTACHMENT,
  STREAM_DRAW,
  TEXTURE0,
  TEXTURE_2D,
  TEXTURE_2D_ARRAY,
  TEXTURE_3D,
  TEXTURE_CUBE_MAP,
  TRANSFORM_FEEDBACK,
  TRANSFORM_FEEDBACK_BUFFER,
  TRIANGLES,
  UNIFORM_BUFFER,
  UNSIGNED_BYTE,
  UNSIGNED_INT,
  UNSIGNED_SHORT,
  UNPACK_IMAGE_HEIGHT,
  UNPACK_ROW_LENGTH,
  UNPACK_SKIP_IMAGES,
  UNPACK_SKIP_PIXELS,
  UNPACK_SKIP_ROWS,
  VERSION,
  VERSION_STRING_WEBGL2,
  VERTEX_ARRAY_BINDING,
  VERTEX_ATTRIB_ARRAY_BUFFER_BINDING,
  VERTEX_ATTRIB_ARRAY_DIVISOR,
  VERTEX_ATTRIB_ARRAY_ENABLED,
  VERTEX_ATTRIB_ARRAY_NORMALIZED,
  VERTEX_ATTRIB_ARRAY_POINTER,
  VERTEX_ATTRIB_ARRAY_SIZE,
  VERTEX_ATTRIB_ARRAY_STRIDE,
  VERTEX_ATTRIB_ARRAY_TYPE,
} from './constants';
import type { GLbitfield, GLenum } from './constants';
import type { GLState, VertexArrayObject } from './state';
import type { TextureObject } from './texture';
import { TextureManager } from './texture';
import { WebGL1Context } from './webgl1-context';
import type { WebGLProgram } from './webgl1-context';
import { QuerySyncManager } from './query-sync';
import type { WebGLQuery, WebGLSync } from './query-sync';
import type { ErrorSink } from './errors';
import { createVertexAttribTargetMap, fetchVertexAttributes, resolveIndexSequence } from './vertex-fetch';
import { executeVertex } from '../glsl/interpreter';
import type { BufferObject } from './buffer';
import { SamplerManager } from './sampler-manager';
import type { WebGLSampler } from './sampler-manager';
import type { SamplerParams } from './texture';

type TextureManagerInternals = {
  textureManager: TextureManager;
};

type ErrorSinkInternals = {
  errorSink: ErrorSink;
};

type GLStateInternals = {
  glState: GLState;
};

type FramebufferManagerInternals = {
  framebufferManager: {
    getBoundFramebuffer(): { id: number } | null;
  };
};


export class WebGL2Context extends WebGL1Context {
  static [Symbol.hasInstance](instance: unknown): boolean {
    if (instance === null || (typeof instance !== 'object' && typeof instance !== 'function')) return false;
    let current: unknown = Object.getPrototypeOf(instance);
    while (current !== null) {
      if (current === WebGL2Context.prototype) return true;
      current = Object.getPrototypeOf(current);
    }
    const candidate = instance as Record<string, unknown>;
    if (
      typeof candidate['drawingBufferWidth'] === 'number' &&
      typeof candidate['texImage3D'] === 'function' &&
      typeof candidate['createVertexArray'] === 'function'
    ) return true;
    return false;
  }
  private querySyncManager: QuerySyncManager | null = null;
  private tfVaryingsByProgram = new Map<number, string[]>();
  private tfActive = false;
  private tfBoundBuffer: BufferObject | null = null;
  private tfWriteFloats = 0;

  private getQuerySync(): QuerySyncManager {
    if (this.querySyncManager === null) {
      const sink = (this as unknown as ErrorSinkInternals).errorSink;
      this.querySyncManager = new QuerySyncManager(sink);
    }
    return this.querySyncManager;
  }

  /** Depth-survivor hook: return increment callback while an occlusion query is active. */
  protected override getSamplePassedCallback(): (() => void) | null {
    const mgr = this.getQuerySync();
    if (mgr.hasActiveOcclusionQuery()) return () => mgr.incrementSampleCount(1);
    return null;
  }

  /** WebGL2 permits TEXTURE_3D/TEXTURE_2D_ARRAY binding (WebGL1 base rejects them). */
  override bindTexture(target: number, texture: TextureObject | null): void {
    if (this.isContextLost()) return;
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    mgr.bindTexture(target as GLenum, texture);
  }

  /** Intercept CURRENT_QUERY (return null, no error), VERTEX_ARRAY_BINDING, WebGL2 version/limits, and MRT queries; all other pnames defer to WebGL1. */
  override getParameter(pname: number): unknown {
    if ((pname as GLenum) === CURRENT_QUERY) return null;
    if ((pname as GLenum) === VERSION) return VERSION_STRING_WEBGL2;
    if ((pname as GLenum) === MAX_VERTEX_UNIFORM_VECTORS) return LIMIT_MAX_VERTEX_UNIFORM_VECTORS_WEBGL2;
    if ((pname as GLenum) === MAX_FRAGMENT_UNIFORM_VECTORS) return LIMIT_MAX_FRAGMENT_UNIFORM_VECTORS_WEBGL2;
    if ((pname as GLenum) === MAX_TEXTURE_IMAGE_UNITS) return LIMIT_MAX_TEXTURE_IMAGE_UNITS_WEBGL2;
    if ((pname as GLenum) === MAX_COMBINED_TEXTURE_IMAGE_UNITS)
      return LIMIT_MAX_COMBINED_TEXTURE_IMAGE_UNITS_WEBGL2;
    if ((pname as GLenum) === MAX_3D_TEXTURE_SIZE) return LIMIT_MAX_3D_TEXTURE_SIZE;
    if ((pname as GLenum) === MAX_ARRAY_TEXTURE_LAYERS) return 256;
    if ((pname as GLenum) === MAX_VERTEX_ATTRIBS) return 16;
    if (this.isContextLost()) return null;
    if ((pname as GLenum) === VERTEX_ARRAY_BINDING) {
      if (this.isContextLost()) return null;
      return (this as unknown as GLStateInternals).glState.getBoundVertexArray();
    }
    if (pname === PNAME_SAMPLER_BINDING) {
      return this.getSamplers().getBoundSamplerHandle(this.activeTextureUnitIndex());
    }
    if (pname === PNAME_TRANSFORM_FEEDBACK_BINDING) {
      return this.boundTransformFeedbackHandle;
    }
    if (pname === PNAME_TRANSFORM_FEEDBACK_PAUSED) {
      return this.tfPaused;
    }
    // WebGL2 limit queries (numeric literals: no constants.ts entries for these enums).
    if (pname === 0x8ffe) return 0xffffff;
    if (pname === 0x9111) return 0;
    if ((pname as GLenum) === MAX_DRAW_BUFFERS) return 4;
    if ((pname as GLenum) === MAX_COLOR_ATTACHMENTS) return 4;
    if (
      (pname as GLenum) === DRAW_BUFFER0 ||
      (pname as GLenum) === DRAW_BUFFER1 ||
      (pname as GLenum) === DRAW_BUFFER2 ||
      (pname as GLenum) === DRAW_BUFFER3
    ) {
      if (this.isContextLost()) return null;
      const draw = this.activeDrawBuffers();
      if ((pname as GLenum) === DRAW_BUFFER0) return draw[0];
      if ((pname as GLenum) === DRAW_BUFFER1) return draw[1];
      if ((pname as GLenum) === DRAW_BUFFER2) return draw[2];
      return draw[3];
    }
    if ((pname as GLenum) === READ_BUFFER) {
      if (this.isContextLost()) return null;
      return this.activeReadBuffer();
    }
    return super.getParameter(pname);
  }

  private defaultFbDrawBuffers: number[] = [BACK as number, NONE as number, NONE as number, NONE as number];
  private defaultFbReadBuffer: number = BACK as number;
  private drawBuffersByFbo = new Map<number, number[]>();
  private readBufferByFbo = new Map<number, number>();

  private boundFboId(): number | null {
    const mgr = (this as unknown as FramebufferManagerInternals).framebufferManager;
    const bound = mgr.getBoundFramebuffer();
    return bound === null ? null : bound.id;
  }

  private fboDrawBuffers(id: number): number[] {
    let entry = this.drawBuffersByFbo.get(id);
    if (entry === undefined) {
      entry = [COLOR_ATTACHMENT0 as number, NONE as number, NONE as number, NONE as number];
      this.drawBuffersByFbo.set(id, entry);
    }
    return entry;
  }

  private fboReadBuffer(id: number): number {
    const entry = this.readBufferByFbo.get(id);
    if (entry === undefined) return COLOR_ATTACHMENT0 as number;
    return entry;
  }

  private activeDrawBuffers(): number[] {
    const id = this.boundFboId();
    if (id === null) return this.defaultFbDrawBuffers;
    return this.fboDrawBuffers(id);
  }

  private activeReadBuffer(): number {
    const id = this.boundFboId();
    if (id === null) return this.defaultFbReadBuffer;
    return this.fboReadBuffer(id);
  }

  private vertexArrays = new Map<number, VertexArrayObject>();
  private everBound = new Set<number>();

  /** Create a VAO seeded from spec defaults; null on context loss. */
  createVertexArray(): VertexArrayObject | null {
    if (this.isContextLost()) return null;
    const vao = (this as unknown as GLStateInternals).glState.createVertexArrayObject();
    this.vertexArrays.set(vao.id, vao);
    return vao;
  }

  /** Bind a VAO with atomic validation; invalid handles record INVALID_OPERATION. */
  bindVertexArray(array: VertexArrayObject | null): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    const state = (this as unknown as GLStateInternals).glState;
    if (array === null) {
      state.bindVertexArray(null);
      return;
    }
    if (typeof array !== 'object' || array === null || (array as VertexArrayObject).alive !== true) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const vao = array as VertexArrayObject;
    if (!this.vertexArrays.has(vao.id) || this.vertexArrays.get(vao.id) !== vao) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    if (!this.everBound.has(vao.id)) {
      for (let i = 0; i < 16; i++) {
        const live = state.getVertexAttrib(i);
        if (live !== null && vao.attribs[i] !== undefined) vao.attribs[i] = { ...live, genericValue: [...live.genericValue] as [number, number, number, number] };
      }
      this.everBound.add(vao.id);
    }
    state.bindVertexArray(vao);
  }

  /** Delete a VAO; null/foreign/deleted are silent no-ops. */
  deleteVertexArray(array: VertexArrayObject | null | undefined): void {
    if (this.isContextLost()) return;
    if (array === null || array === undefined) return;
    if (typeof array !== 'object') return;
    const vao = array as VertexArrayObject;
    if (!this.vertexArrays.has(vao.id) || this.vertexArrays.get(vao.id) !== vao) return;
    if (vao.alive !== true) return;
    vao.alive = false;
    const state = (this as unknown as GLStateInternals).glState;
    if (state.getBoundVertexArray() === vao) state.bindVertexArray(null);
    this.vertexArrays.delete(vao.id);
    this.everBound.delete(vao.id);
  }

  /** True iff the handle is a live, ever-bound VAO owned by this context. */
  isVertexArray(array: unknown): boolean {
    if (this.isContextLost()) return false;
    if (array === null || typeof array !== 'object') return false;
    const vao = array as Record<string, unknown>;
    if (!('id' in vao && 'alive' in vao)) return false;
    const id = vao['id'] as number;
    if (!this.vertexArrays.has(id) || this.vertexArrays.get(id) !== (array as VertexArrayObject)) return false;
    if ((array as VertexArrayObject).alive !== true) return false;
    // Blueprint-mandated OpenGL ES 3.0 rule (TEST 3): an object qualifies as a
    // vertex array only after it has been bound at least once.
    return this.everBound.has(id);
  }

  /** Query per-attribute state, incl. DIVISOR, INTEGER, BINDING, CURRENT_VERTEX_ATTRIB (Sprint 12 Task 3). */
  getVertexAttrib(index: number, pname: number): unknown {
    if (pname === PNAME_VERTEX_ATTRIB_ARRAY_INTEGER) {
      const desc = (this as unknown as GLStateInternals).glState.getVertexAttrib(index);
      return desc === null ? false : desc.isInteger === true;
    }
    if (pname === PNAME_VERTEX_ATTRIB_BINDING) {
      return this.attribBindingPoint[index] ?? index;
    }
    if (this.isContextLost()) return null;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    const desc = (this as unknown as GLStateInternals).glState.getVertexAttrib(index);
    if (desc === null) return null;
    switch (pname as GLenum) {
      case VERTEX_ATTRIB_ARRAY_ENABLED: return desc.enabled;
      case VERTEX_ATTRIB_ARRAY_SIZE: return desc.size;
      case VERTEX_ATTRIB_ARRAY_STRIDE: return desc.stride;
      case VERTEX_ATTRIB_ARRAY_TYPE: return desc.type;
      case VERTEX_ATTRIB_ARRAY_NORMALIZED: return desc.normalized;
      case VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: return desc.buffer;
      case VERTEX_ATTRIB_ARRAY_DIVISOR: return desc.divisor;
      case CURRENT_VERTEX_ATTRIB: return new Float32Array(desc.genericValue);
      default: sink.recordError(INVALID_ENUM); return null;
    }
  }

  /** Query the pointer offset for VERTEX_ATTRIB_ARRAY_POINTER. */
  getVertexAttribOffset(index: number, pname: number): number {
    if (this.isContextLost()) return 0;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if ((pname as GLenum) !== VERTEX_ATTRIB_ARRAY_POINTER) { sink.recordError(INVALID_ENUM); return 0; }
    const desc = (this as unknown as GLStateInternals).glState.getVertexAttrib(index);
    if (desc === null) {
      if ((sink as unknown as { getError?: () => number }) !== null) { /* GLState already recorded INVALID_VALUE */ }
      return 0;
    }
    return desc.offset;
  }

  /** Set the per-attribute instance divisor. */
  vertexAttribDivisor(index: number, divisor: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (!Number.isInteger(index) || index < 0 || index >= 16) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isInteger(divisor) || divisor < 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    (this as unknown as GLStateInternals).glState.setVertexAttribDivisor(index, divisor);
  }

  /** Draw multiple instances from array data (outer instance loop, snapshot once). */
  drawArraysInstanced(mode: number, first: number, count: number, instanceCount: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (mode !== TRIANGLES) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (first < 0 || count < 0 || instanceCount < 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (count === 0 || instanceCount === 0) return;
    this.drawBufferedTrianglesCore(null, first, count, instanceCount);
  }

  /** Draw multiple instances from element indices. */
  drawElementsInstanced(mode: number, count: number, type: number, offset: number, instanceCount: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (mode !== TRIANGLES) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (count < 0 || offset < 0 || instanceCount < 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (type !== UNSIGNED_SHORT && type !== UNSIGNED_BYTE && type !== UNSIGNED_INT) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (count === 0 || instanceCount === 0) return;
    const internals = this as unknown as {
      bufferManager: import('./buffer').BufferManager;
    };
    const bound = internals.bufferManager.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
    if (bound === null || bound.alive !== true || bound.data === null) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const typeByteSize = type === UNSIGNED_SHORT ? 2 : type === UNSIGNED_INT ? 4 : 1;
    if (offset % typeByteSize !== 0) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    if (offset + count * typeByteSize > bound.byteLength) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const indexList = resolveIndexSequence(bound.data, offset, count, type);
    this.drawBufferedTrianglesCore(indexList, 0, count, instanceCount);
  }

  /** Draw elements constrained to index range [start, end]. */
  drawRangeElements(mode: number, start: number, end: number, count: number, type: number, offset: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (mode !== TRIANGLES) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (start < 0 || end < 0 || count < 0 || offset < 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (end < start) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (type !== UNSIGNED_SHORT && type !== UNSIGNED_BYTE && type !== UNSIGNED_INT) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (count === 0) return;
    const internals = this as unknown as {
      bufferManager: import('./buffer').BufferManager;
    };
    const bound = internals.bufferManager.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
    if (bound === null || bound.alive !== true || bound.data === null) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const typeByteSize = type === UNSIGNED_SHORT ? 2 : type === UNSIGNED_INT ? 4 : 1;
    if (offset % typeByteSize !== 0 || offset + count * typeByteSize > bound.byteLength) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const indexList = resolveIndexSequence(bound.data, offset, count, type);
    for (const idx of indexList) {
      if (idx < start || idx > end) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
    }
    this.drawBufferedTrianglesCore(indexList, 0, count, 1);
  }

  /** Create a fence sync object. */
  fenceSync(condition: number, flags: number): WebGLSync | null {
    if (this.isContextLost()) return null;
    return this.getQuerySync().fenceSync(condition as GLenum, flags as GLbitfield);
  }

  /** Create a fence sync object (alias entry point). */
  createFenceSync(condition: number, flags: number): WebGLSync | null {
    if (this.isContextLost()) return null;
    return this.getQuerySync().createFenceSync(condition as GLenum, flags as GLbitfield);
  }

  /** Block until the sync object is signaled (immediate in CPU rendering). */
  clientWaitSync(sync: WebGLSync | null, flags: number, timeout: number): GLenum {
    return this.getQuerySync().clientWaitSync(sync, flags as GLbitfield, timeout);
  }

  /** Server-side wait (no-op in CPU rendering). */
  waitSync(sync: WebGLSync | null, flags: number, timeout: number): void {
    this.getQuerySync().waitSync(sync, flags as GLbitfield, timeout);
  }

  /** Delete a sync object. */
  deleteSync(sync: WebGLSync | null): void {
    this.getQuerySync().deleteSync(sync);
  }

  /** True iff the value is a live sync object. */
  isSync(sync: WebGLSync | null): boolean {
    return this.getQuerySync().isSync(sync);
  }

  /** Query sync object state. */
  getSyncParameter(sync: WebGLSync | null, pname: number): unknown {
    return this.getQuerySync().getSyncParameter(sync, pname as GLenum);
  }

  /** Create a query object (overrides WebGL1 stub). */
  override createQuery(): WebGLQuery | null {
    if (this.isContextLost()) return null;
    return this.getQuerySync().createQuery();
  }

  /** Begin a query on the given target. */
  beginQuery(target: number, query: WebGLQuery | null): void {
    if (this.isContextLost()) return;
    this.getQuerySync().beginQuery(target as GLenum, query);
  }

  /** End the active query on the given target. */
  endQuery(target: number): void {
    if (this.isContextLost()) return;
    this.getQuerySync().endQuery(target as GLenum);
  }

  /** Delete a query object. */
  deleteQuery(query: WebGLQuery | null): void {
    this.getQuerySync().deleteQuery(query);
  }

  /** True iff the value is a live, begun query object. */
  isQuery(query: WebGLQuery | null): boolean {
    return this.getQuerySync().isQuery(query);
  }

  /** Return the currently active query for a target. */
  getQuery(target: number, pname: number): unknown {
    return this.getQuerySync().getQuery(target as GLenum, pname as GLenum);
  }

  /** Query query-object state. */
  getQueryParameter(query: WebGLQuery | null, pname: number): unknown {
    return this.getQuerySync().getQueryParameter(query, pname as GLenum);
  }

  /** Intercept WebGL2-only unpack pnames locally; all other pnames defer to WebGL1. */
  override pixelStorei(pname: number, param: number | boolean): void {
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    const v = typeof param === 'boolean' ? (param ? 1 : 0) : param;
    switch (pname as GLenum) {
      case UNPACK_ROW_LENGTH:
      case UNPACK_IMAGE_HEIGHT:
      case UNPACK_SKIP_PIXELS:
      case UNPACK_SKIP_ROWS:
      case UNPACK_SKIP_IMAGES: {
        if (!Number.isInteger(v) || (v as number) < 0) {
          super.pixelStorei(INVALID_VALUE as number, 0);
          return;
        }
        if (pname === UNPACK_ROW_LENGTH) mgr.webgl2Unpack.rowLength = v as number;
        else if (pname === UNPACK_IMAGE_HEIGHT) mgr.webgl2Unpack.imageHeight = v as number;
        else if (pname === UNPACK_SKIP_PIXELS) mgr.webgl2Unpack.skipPixels = v as number;
        else if (pname === UNPACK_SKIP_ROWS) mgr.webgl2Unpack.skipRows = v as number;
        else mgr.webgl2Unpack.skipImages = v as number;
        return;
      }
      default:
        super.pixelStorei(pname, param);
        return;
    }
  }

  /** Read back WebGL2-only unpack state; all other pnames defer to WebGL1. */
  getUnpacki(pname: number): number | null {
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    switch (pname as GLenum) {
      case UNPACK_ROW_LENGTH:
        return mgr.webgl2Unpack.rowLength;
      case UNPACK_IMAGE_HEIGHT:
        return mgr.webgl2Unpack.imageHeight;
      case UNPACK_SKIP_PIXELS:
        return mgr.webgl2Unpack.skipPixels;
      case UNPACK_SKIP_ROWS:
        return mgr.webgl2Unpack.skipRows;
      case UNPACK_SKIP_IMAGES:
        return mgr.webgl2Unpack.skipImages;
      default:
        return null;
    }
  }

  /** Expose the 3D/array binding for a target (test and sampler integration). */
  getBoundTexture3D(target: number): TextureObject | null {
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    return mgr.getBoundTexture(target as GLenum);
  }

  /** WebGL2-only: specify a 3D or 2D-array texture image. */
  texImage3D(
    target: number,
    level: number,
    internalformat: number,
    width: number,
    height: number,
    depth: number,
    border: number,
    format: number,
    type: number,
    pixels: ArrayBufferView | null,
  ): void {
    if (this.isContextLost()) return;
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    mgr.texImage3D(
      target as GLenum,
      level,
      internalformat as GLenum,
      width,
      height,
      depth,
      border,
      format as GLenum,
      type as GLenum,
      pixels,
    );
  }

  /** WebGL2-only: update a 3D subvolume. */
  texSubImage3D(
    target: number,
    level: number,
    xoffset: number,
    yoffset: number,
    zoffset: number,
    width: number,
    height: number,
    depth: number,
    format: number,
    type: number,
    pixels: ArrayBufferView,
  ): void {
    if (this.isContextLost()) return;
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    mgr.texSubImage3D(
      target as GLenum,
      level,
      xoffset,
      yoffset,
      zoffset,
      width,
      height,
      depth,
      format as GLenum,
      type as GLenum,
      pixels,
    );
  }

  /** WebGL2-only: copy read-framebuffer pixels into a 3D slice. */
  copyTexSubImage3D(
    target: number,
    level: number,
    xoffset: number,
    yoffset: number,
    zoffset: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (this.isContextLost()) return;
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    const internals = this as unknown as {
      drawingBuffer: import('./framebuffer').DrawingBuffer;
    };
    const fb = internals.drawingBuffer;
    mgr.copyTexSubImage3D(
      target as GLenum,
      level,
      xoffset,
      yoffset,
      zoffset,
      x,
      y,
      width,
      height,
      fb,
    );
  }

  /** WebGL2 texParameter entry point (TEXTURE_WRAP_R support lives in TextureManager). */
  texParameteri3D(target: number, pname: number, param: number): void {
    if (this.isContextLost()) return;
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    mgr.texParameteri(target as GLenum, pname as GLenum, param);
  }

  private samplerManager: SamplerManager | null = null;

  private getSamplers(): SamplerManager {
    if (this.samplerManager === null) {
      const sink = (this as unknown as ErrorSinkInternals).errorSink;
      this.samplerManager = new SamplerManager(sink);
    }
    return this.samplerManager;
  }

  /** Zero-based active texture unit index (0..15) derived from TEXTURE0-based getActiveTexture(). */
  private activeTextureUnitIndex(): number {
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    const active = mgr.getActiveTexture() as number;
    const idx = active - (TEXTURE0 as number);
    if (!Number.isInteger(idx) || idx < 0) return 0;
    if (idx > 15) return 15;
    return idx;
  }

  /** Sampler hook override: per-unit bound sampler params for the fragment path. */
  protected override getBoundSamplerForUnit(unit: number): SamplerParams | null {
    const bound = this.getSamplers().getBoundSampler(unit);
    if (bound === null || bound.alive !== true) return null;
    return { ...bound.params };
  }

  /** Test probe: raw bound sampler params for a unit (null when unbound). */
  getBoundSampler(unit: number): SamplerParams | null {
    const bound = this.getSamplers().getBoundSampler(unit);
    if (bound === null || bound.alive !== true) return null;
    return { ...bound.params };
  }

  /** Create a sampler object with spec defaults; null on context loss. */
  createSampler(): WebGLSampler | null {
    if (this.isContextLost()) return null;
    return this.getSamplers().createSampler();
  }

  /** Bind a sampler to a texture unit; null unbinds. */
  bindSampler(unit: number, sampler: WebGLSampler | null): void {
    if (this.isContextLost()) return;
    this.getSamplers().bindSampler(unit, sampler);
  }

  /** Delete a sampler; unbinds from all units. */
  deleteSampler(sampler: WebGLSampler | null | undefined): void {
    if (this.isContextLost()) return;
    this.getSamplers().deleteSampler(sampler);
  }

  /** True iff the value is a live sampler owned by this context. */
  isSampler(sampler: unknown): boolean {
    if (this.isContextLost()) return false;
    return this.getSamplers().isSampler(sampler as WebGLSampler | null | undefined);
  }

  /** Set an integer-valued sampler parameter with atomic validation. */
  samplerParameteri(sampler: WebGLSampler | null, pname: number, param: number): void {
    if (this.isContextLost()) return;
    this.getSamplers().samplerParameteri(sampler, pname as GLenum, param);
  }

  /** Set a float-valued sampler parameter (MIN_LOD/MAX_LOD); other pnames record INVALID_ENUM. */
  samplerParameterf(sampler: WebGLSampler | null, pname: number, param: number): void {
    if (this.isContextLost()) return;
    this.getSamplers().samplerParameterf(sampler, pname as GLenum, param);
  }

  /** Query a sampler parameter; unknown pname records INVALID_ENUM and returns null. */
  getSamplerParameter(sampler: WebGLSampler | null, pname: number): unknown {
    if (this.isContextLost()) return null;
    return this.getSamplers().getSamplerParameter(sampler, pname as GLenum);
  }

  drawBuffers(buffers: number[]): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (buffers.length > 4) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    const boundId = this.boundFboId();
    if (boundId === null) {
      if (buffers.length !== 1) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
      const single = buffers[0] as number;
      if (single !== (NONE as number) && single !== (BACK as number)) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
      this.defaultFbDrawBuffers = [single, NONE as number, NONE as number, NONE as number];
      return;
    }
    const seen = new Set<number>();
    for (let i = 0; i < buffers.length; i++) {
      const item = buffers[i] as number;
      if (item === (NONE as number)) continue;
      if (item === (BACK as number)) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
      if (item < (COLOR_ATTACHMENT0 as number) || item > (COLOR_ATTACHMENT3 as number)) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
      if (seen.has(item)) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
      seen.add(item);
    }
    const next: number[] = [NONE as number, NONE as number, NONE as number, NONE as number];
    for (let i = 0; i < buffers.length; i++) next[i] = buffers[i] as number;
    this.drawBuffersByFbo.set(boundId, next);
  }

  readBuffer(src: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    const boundId = this.boundFboId();
    if (boundId === null) {
      if (src === (BACK as number)) {
        this.defaultFbReadBuffer = BACK as number;
        return;
      }
      if (src === (NONE as number)) {
        this.defaultFbReadBuffer = NONE as number;
        return;
      }
      if (src >= (COLOR_ATTACHMENT0 as number) && src <= (COLOR_ATTACHMENT3 as number)) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (src === (NONE as number)) {
      this.readBufferByFbo.set(boundId, NONE as number);
      return;
    }
    if (src >= (COLOR_ATTACHMENT0 as number) && src <= (COLOR_ATTACHMENT3 as number)) {
      this.readBufferByFbo.set(boundId, src);
      return;
    }
    if (src === (BACK as number)) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    sink.recordError(INVALID_ENUM);
  }

  /** Register transform-feedback varyings for a program (must precede link; post-link is INVALID_OPERATION). */
  transformFeedbackVaryings(program: unknown, varyings: string[], _bufferMode: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    const id = (program as { id?: unknown } | null)?.id;
    if (typeof id !== 'number') {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const internals = this as unknown as {
      programRegistry: { getProgram(id: number): { linkStatus: boolean } | null };
    };
    const handle = internals.programRegistry.getProgram(id);
    if (handle !== null && handle.linkStatus === true) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    this.tfVaryingsByProgram.set(id, [...varyings]);
  }

  /** Begin transform-feedback capture; double-begin records INVALID_OPERATION. */
  beginTransformFeedback(primitiveMode: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (
      primitiveMode !== (POINTS as number) &&
      primitiveMode !== (TRIANGLES as number)
    ) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (this.tfActive) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    this.tfActive = true;
    this.tfWriteFloats = 0;
  }

  /** WebGL2-only generic binding points held locally (BufferManager only knows ARRAY/ELEMENT/UNIFORM). */
  private readonly extraBufferBindings = new Map<number, BufferObject | null>();

  /** True iff the target is a WebGL2-only generic binding point held locally. */
  private isExtraBufferTarget(target: number): boolean {
    return (
      target === (COPY_READ_BUFFER as number) ||
      target === (COPY_WRITE_BUFFER as number) ||
      target === (PIXEL_PACK_BUFFER as number) ||
      target === (PIXEL_UNPACK_BUFFER as number) ||
      target === (TRANSFORM_FEEDBACK_BUFFER as number)
    );
  }

  /** Resolve the buffer bound to a target, including WebGL2-local extra bindings. */
  private resolveBoundBuffer(target: number): BufferObject | null {
    if (this.isExtraBufferTarget(target)) {
      const direct = this.extraBufferBindings.get(target) ?? null;
      if (direct !== null) return direct;
      // TRANSFORM_FEEDBACK_BUFFER may have been bound via the indexed path
      // (bindBufferBase/bindBufferRange); fall back to indexed slot 0 so the
      // generic target stays usable (pre-T3 behavior via tfBoundBuffer).
      if ((target as number) === (TRANSFORM_FEEDBACK_BUFFER as number)) return this.tfCaptureBuffer();
      return null;
    }
    const internals = this as unknown as { bufferManager: { getBoundBuffer(t: number): BufferObject | null } };
    return internals.bufferManager.getBoundBuffer(target);
  }

  /** Unified transform-feedback capture buffer: generic binding, legacy slot, then indexed slot 0. */
  private tfCaptureBuffer(): BufferObject | null {
    const generic = this.extraBufferBindings.get(TRANSFORM_FEEDBACK_BUFFER as number) ?? null;
    if (generic !== null) return generic;
    if (this.tfBoundBuffer !== null) return this.tfBoundBuffer;
    return this.tfIndexedBindings[0]?.buffer ?? null;
  }

  /** Bind a buffer; WebGL2-only copy/pixel targets are held locally (Sprint 12 Task 3, D4). */
  override bindBuffer(target: number, buffer: BufferObject | null): void {
    if (this.isExtraBufferTarget(target)) {
      if (this.isContextLost()) return;
      if (buffer !== null && buffer.alive !== true) {
        (this as unknown as ErrorSinkInternals).errorSink.recordError(INVALID_OPERATION);
        return;
      }
      this.extraBufferBindings.set(target, buffer);
      // Keep the TF capture stores in sync so indexed bindings stay visible
      // to the generic TRANSFORM_FEEDBACK_BUFFER target and vice versa.
      if ((target as number) === (TRANSFORM_FEEDBACK_BUFFER as number)) {
        this.tfBoundBuffer = buffer;
        if (buffer === null) {
          this.tfIndexedBindings[0] = null;
        } else {
          this.tfIndexedBindings[0] = { buffer, offset: 0, size: buffer.byteLength };
        }
      }
      return;
    }
    super.bindBuffer(target, buffer);
  }

  /** Allocate storage for the transform-feedback-bound buffer; other targets defer to WebGL1. */
  override bufferData(target: number, sizeOrData: number | ArrayBufferView | ArrayBuffer, usage: number): void {
    if (this.isExtraBufferTarget(target)) {
      const sink = (this as unknown as ErrorSinkInternals).errorSink;
      if (this.isContextLost()) return;
      const buf = this.extraBufferBindings.get(target) ?? null;
      if (buf === null) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
      if (usage !== (STATIC_DRAW as number) && usage !== (DYNAMIC_DRAW as number) && usage !== (STREAM_DRAW as number)) {
        sink.recordError(INVALID_ENUM);
        return;
      }
      if (typeof sizeOrData === 'number') {
        if (!Number.isInteger(sizeOrData) || sizeOrData < 0) {
          sink.recordError(INVALID_VALUE);
          return;
        }
        buf.data = new ArrayBuffer(sizeOrData);
        buf.byteLength = sizeOrData;
        buf.usage = usage as GLenum;
        return;
      }
      const src = sizeOrData instanceof ArrayBuffer
        ? new Uint8Array(sizeOrData)
        : new Uint8Array(
            (sizeOrData as ArrayBufferView).buffer,
            (sizeOrData as ArrayBufferView).byteOffset,
            (sizeOrData as ArrayBufferView).byteLength,
          );
      const copy = new Uint8Array(src.byteLength);
      copy.set(src);
      buf.data = copy.buffer;
      buf.byteLength = copy.byteLength;
      buf.usage = usage as GLenum;
      return;
    }
    if ((target as number) === (TRANSFORM_FEEDBACK_BUFFER as number)) {
      const sink = (this as unknown as ErrorSinkInternals).errorSink;
      const buf = this.resolveBoundBuffer(target);
      if (buf === null) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
      if (typeof sizeOrData === 'number') {
        if (sizeOrData < 0) {
          sink.recordError(INVALID_VALUE);
          return;
        }
        buf.data = new ArrayBuffer(sizeOrData);
        buf.byteLength = sizeOrData;
        buf.usage = usage;
        return;
      }
      const src = sizeOrData instanceof ArrayBuffer
        ? new Uint8Array(sizeOrData)
        : new Uint8Array(
            (sizeOrData as ArrayBufferView).buffer,
            (sizeOrData as ArrayBufferView).byteOffset,
            (sizeOrData as ArrayBufferView).byteLength,
          );
      const copy = new Uint8Array(src.byteLength);
      copy.set(src);
      buf.data = copy.buffer;
      buf.byteLength = copy.byteLength;
      buf.usage = usage;
      return;
    }
    super.bufferData(target, sizeOrData, usage);
  }

  /** Read buffer data into a destination view; unwritten regions read back as zero. */
  getBufferSubData(target: number, srcByteOffset: number, dstData: ArrayBufferView): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    let src: Uint8Array | null = null;
    if ((target as number) === (TRANSFORM_FEEDBACK_BUFFER as number)) {
      const cap = this.tfCaptureBuffer();
      if (cap?.data instanceof ArrayBuffer) {
        src = new Uint8Array(cap.data);
      }
    } else {
      const mgr = (this as unknown as { bufferManager: { getBoundBuffer(t: number): BufferObject | null } }).bufferManager;
      const bound = mgr.getBoundBuffer(target);
      if (bound?.data instanceof ArrayBuffer) src = new Uint8Array(bound.data);
    }
    const dst = new Uint8Array(dstData.buffer, dstData.byteOffset, dstData.byteLength);
    if (src === null || srcByteOffset < 0) {
      sink.recordError(INVALID_OPERATION);
      dst.fill(0);
      return;
    }
    if (srcByteOffset >= src.byteLength) {
      dst.fill(0);
      return;
    }
    const available = Math.min(dst.byteLength, src.byteLength - srcByteOffset);
    if (available > 0) dst.set(src.subarray(srcByteOffset, srcByteOffset + available));
    if (available < dst.byteLength) dst.subarray(available).fill(0);
  }

  /** POINTS draw path with transform-feedback capture; other modes defer to WebGL1. */
  override drawArrays(
    mode?: number,
    first?: number,
    count?: number,
    directGeometry?: readonly import('./webgl1-context').DirectVertex[],
  ): void {
    if ((mode as number) === (POINTS as number)) {
      if (this.isContextLost()) return;
      const sink = (this as unknown as ErrorSinkInternals).errorSink;
      const f = first ?? 0;
      const c = count ?? 0;
      if (f < 0 || c < 0) {
        sink.recordError(INVALID_VALUE);
        return;
      }
      if (this.tfActive) {
        this.captureTfRange(null, f, c);
        return;
      }
    }
    super.drawArrays(mode, first, count, directGeometry);
  }

  /** POINTS indexed draw path with transform-feedback capture; other modes defer to WebGL1. */
  override drawElements(mode?: number, count?: number, type?: number, offset?: number): void {
    if ((mode as number) === (POINTS as number)) {
      if (this.isContextLost()) return;
      const sink = (this as unknown as ErrorSinkInternals).errorSink;
      const c = count ?? 0;
      const off = offset ?? 0;
      if (c < 0 || off < 0) {
        sink.recordError(INVALID_VALUE);
        return;
      }
      if (this.tfActive) {
        const mgr = (this as unknown as { bufferManager: { getBoundBuffer(t: number): BufferObject | null } }).bufferManager;
        const bound = mgr.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
        if (bound === null || bound.data === null) {
          sink.recordError(INVALID_OPERATION);
          return;
        }
        const indices = resolveIndexSequence(bound.data, off, c, (type ?? 0) as never);
        this.captureTfRange(indices, 0, indices.length);
        return;
      }
    }
    super.drawElements(mode as number, count as number, type as number, offset as number);
  }

  /** TRIANGLES hook: run the normal raster path, then capture varyings while TF is active. */
  protected override drawBufferedTrianglesCore(
    indices: ReadonlyArray<number> | null,
    first: number,
    count: number,
    instanceCount = 1,
  ): void {
    super.drawBufferedTrianglesCore(indices, first, count, instanceCount);
    if (this.tfActive) this.captureTfRange(indices, first, count);
  }

  /** Validate registered varyings at link time (post-link registration already rejected). */
  override linkProgram(program: WebGLProgram | null): void {
    super.linkProgram(program);
    const id = (program as WebGLProgram | null)?.id;
    if (typeof id !== 'number') return;
    const pending = this.tfVaryingsByProgram.get(id);
    if (pending === undefined || pending.length === 0) return;
    const prog = (program as WebGLProgram).handle;
    const linked = prog.linkedProgram;
    if (linked === null || linked === undefined) return;
    const declared = new Set<string>((linked.vs.declaredOutputs ?? []).map((o) => o.name));
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    for (const name of pending) {
      if (!declared.has(name)) {
        prog.linkStatus = false;
        prog.infoLog = 'transformFeedbackVaryings: varying ' + name + ' not written by vertex shader';
        sink.recordError(INVALID_OPERATION);
        return;
      }
    }
  }

  /** Per-vertex TF capture: re-evaluate the vertex shader and interleave registered varyings. */
  private captureTfRange(indices: ReadonlyArray<number> | null, first: number, count: number): void {
    const prog = (this as unknown as { currentProgram: WebGLProgram | null }).currentProgram;
    const linked = prog?.handle.linkedProgram;
    if (prog === null || prog === undefined || linked === null || linked === undefined) return;
    const ids = this.tfVaryingsByProgram.get(prog.id) ?? [];
    const names = ids.length > 0 ? ids : (linked.vs.declaredOutputs ?? []).map((o) => o.name);
    if (names.length === 0) return;
    const captureBuffer = this.tfCaptureBuffer();
    if (captureBuffer === null || captureBuffer.data === null) return;
    const glState = (this as unknown as GLStateInternals).glState;
    const descriptors: import('./state').VertexAttribDescriptor[] = [];
    for (let i = 0; i < 16; i += 1) {
      const desc = glState.getVertexAttrib(i);
      if (desc === null) return;
      descriptors.push(desc);
    }
    const targetMap = createVertexAttribTargetMap(linked.activeAttribs);
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    const host = {
      readUniform: (): number => 0,
      reportFault: (): void => {
        sink.recordError(INVALID_OPERATION);
      },
      sample: (): Float32Array => new Float32Array([0, 0, 0, 1]),
    };
    const lookup = (h: unknown): BufferObject | null => (h as BufferObject | null) ?? null;
    const view = new Float32Array((captureBuffer.data as ArrayBuffer));
    const seq: number[] = indices !== null ? [...indices] : Array.from({ length: count }, (_, k) => first + k);
    const viewCache = new Map<ArrayBuffer, DataView>();
    for (const vertexId of seq) {
      fetchVertexAttributes(descriptors, lookup, vertexId, linked.activeAttribs, targetMap, viewCache, 0);
      const out = executeVertex(linked, vertexId, targetMap, host, 0);
      for (const name of names) {
        const v = out.varyings.get(name) ?? new Float32Array([0, 0, 0, 1]);
        for (let k = 0; k < 4; k += 1) {
          if (this.tfWriteFloats < view.length) view[this.tfWriteFloats] = v[k] ?? 0;
          this.tfWriteFloats += 1;
        }
      }
    }
  }

  /** Clear a single float-valued buffer (COLOR/DEPTH/STENCIL) on one draw-buffer attachment. */
  clearBufferfv(buffer: number, drawbuffer: number, values: ArrayLike<number>, srcOffset?: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (buffer !== (COLOR as number) && buffer !== (DEPTH as number) && buffer !== (STENCIL as number)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    const off = srcOffset ?? 0;
    if (!this.checkClearDrawbuffer(buffer, drawbuffer)) return;
    if (values === null || values === undefined || values.length < off + (buffer === (COLOR as number) ? 4 : 1)) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (buffer === (COLOR as number)) {
      const r = Math.round(clamp01Attachment(Number(values[off])) * 255);
      const g = Math.round(clamp01Attachment(Number(values[off + 1])) * 255);
      const b = Math.round(clamp01Attachment(Number(values[off + 2])) * 255);
      const a = Math.round(clamp01Attachment(Number(values[off + 3])) * 255);
      this.writeClearColor(drawbuffer, r, g, b, a);
      return;
    }
    if (buffer === (DEPTH as number)) {
      this.writeClearDepth(clamp01Attachment(Number(values[off])));
      return;
    }
    this.writeClearStencil(Number(values[off]));
  }

  /** Clear a single signed-integer buffer (COLOR/DEPTH/STENCIL) on one draw-buffer attachment. */
  clearBufferiv(buffer: number, drawbuffer: number, values: ArrayLike<number>, srcOffset?: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (buffer !== (COLOR as number) && buffer !== (DEPTH as number) && buffer !== (STENCIL as number)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    const off = srcOffset ?? 0;
    if (!this.checkClearDrawbuffer(buffer, drawbuffer)) return;
    if (values === null || values === undefined || values.length < off + (buffer === (COLOR as number) ? 4 : 1)) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (buffer === (COLOR as number)) {
      this.writeClearColor(
        drawbuffer,
        clampIntByte(Number(values[off])),
        clampIntByte(Number(values[off + 1])),
        clampIntByte(Number(values[off + 2])),
        clampIntByte(Number(values[off + 3])),
      );
      return;
    }
    if (buffer === (DEPTH as number)) {
      this.writeClearDepth(clamp01Attachment(Number(values[off])));
      return;
    }
    this.writeClearStencil(Number(values[off]));
  }

  /** Clear a single unsigned-integer buffer (COLOR/DEPTH/STENCIL) on one draw-buffer attachment. */
  clearBufferuiv(buffer: number, drawbuffer: number, values: ArrayLike<number>, srcOffset?: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (buffer !== (COLOR as number) && buffer !== (DEPTH as number) && buffer !== (STENCIL as number)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    const off = srcOffset ?? 0;
    if (!this.checkClearDrawbuffer(buffer, drawbuffer)) return;
    if (values === null || values === undefined || values.length < off + (buffer === (COLOR as number) ? 4 : 1)) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (buffer === (COLOR as number)) {
      this.writeClearColor(
        drawbuffer,
        clampIntByte(Number(values[off])),
        clampIntByte(Number(values[off + 1])),
        clampIntByte(Number(values[off + 2])),
        clampIntByte(Number(values[off + 3])),
      );
      return;
    }
    if (buffer === (DEPTH as number)) {
      this.writeClearDepth(clamp01Attachment(Number(values[off])));
      return;
    }
    this.writeClearStencil(Number(values[off]));
  }

  /** Clear the packed depth/stencil buffer (buffer must be DEPTH_STENCIL, drawbuffer must be 0). */
  clearBufferfi(buffer: number, drawbuffer: number, depth: number, stencil: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (buffer !== (DEPTH_STENCIL as number)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (drawbuffer !== 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    const depth24 = Math.round(clamp01Attachment(depth) * DEPTH_MAX_24);
    const s = Math.trunc(stencil) & 0xff;
    this.depthStencilForWrite().fill(((depth24 * 256) | s) >>> 0);
  }

  /**
   * Read pixels from the active read-buffer attachment.
   *
   * WebGL1 resolves only renderbuffer-backed COLOR_ATTACHMENT0 FBOs and otherwise falls
   * through to the default drawing buffer, so texture-backed MRT attachments would be
   * unobservable. When an FBO is bound and its read attachment is texture-backed, copy
   * from that texture level's backing store with the same RGBA/UNSIGNED_BYTE validation
   * contract as WebGL1; all other cases defer to the inherited implementation.
   */
  override readPixels(
    x: number,
    y: number,
    width: number,
    height: number,
    format: number,
    type: number,
    pixels: ArrayBufferView | null,
    dstOffset?: number,
  ): void {
    if (this.isContextLost()) return;
    const seam = this as unknown as AttachmentSeam;
    const bound = seam.framebufferManager.getBoundFramebuffer();
    if (bound === null || bound === undefined) {
      super.readPixels(x, y, width, height, format, type, pixels, dstOffset);
      return;
    }
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (pixels === null || pixels === undefined) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (format !== (RGBA as number)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (type !== (UNSIGNED_BYTE as number)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (!(pixels instanceof Uint8Array)) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    const offset = dstOffset !== undefined ? dstOffset : 0;
    if (width < 0 || height < 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    const destArray = pixels as Uint8Array;
    if (destArray.byteLength < offset + width * height * 4) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (width === 0 || height === 0) return;
    const readAtt = this.activeReadAttachment();
    const rec = seam.framebufferManager.getRecord(bound);
    const att = rec?.attachments.get(readAtt);
    if (att === undefined || att.kind !== 'texture') {
      super.readPixels(x, y, width, height, format, type, pixels, dstOffset);
      return;
    }
    const mip = (att.texture as TextureObjectLike).levels2D.get(att.level ?? 0);
    if (mip === undefined) {
      super.readPixels(x, y, width, height, format, type, pixels, dstOffset);
      return;
    }
    copyFlippedRegion(mip.data, mip.width, mip.height, x, y, width, height, destArray, offset);
  }

  /**
   * Validate the drawbuffer index for a clearBuffer* call.
   * COLOR on the default framebuffer requires 0; COLOR on an FBO requires 0..3;
   * DEPTH/STENCIL always require 0. Records INVALID_VALUE and returns false on violation.
   */
  private checkClearDrawbuffer(buffer: number, drawbuffer: number): boolean {
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (buffer === (COLOR as number)) {
      if (this.boundFboId() === null) {
        if (drawbuffer !== 0) {
          sink.recordError(INVALID_VALUE);
          return false;
        }
        return true;
      }
      if (!Number.isInteger(drawbuffer) || drawbuffer < 0 || drawbuffer > 3) {
        sink.recordError(INVALID_VALUE);
        return false;
      }
      return true;
    }
    if (drawbuffer !== 0) {
      sink.recordError(INVALID_VALUE);
      return false;
    }
    return true;
  }

  /**
   * Resolve the color attachment enum addressed by a clearBuffer* COLOR drawbuffer index.
   * Returns null when the addressed draw buffer is NONE (clear is a silent no-op).
   * When the FBO has no explicit drawBuffers routing, the index addresses
   * COLOR_ATTACHMENT0 + index directly so attachment-scoped clears work out of the box.
   */
  private resolveClearAttachment(drawbuffer: number): number | null {
    const boundId = this.boundFboId();
    if (boundId === null) return COLOR_ATTACHMENT0 as number;
    const explicit = this.drawBuffersByFbo.get(boundId);
    if (explicit === undefined) return (COLOR_ATTACHMENT0 as number) + drawbuffer;
    const att = explicit[drawbuffer] ?? (NONE as number);
    if (att === (NONE as number)) return null;
    return att;
  }

  /** Fill the resolved COLOR attachment backing store with one RGBA byte quadruplet. */
  private writeClearColor(drawbuffer: number, r: number, g: number, b: number, a: number): void {
    const att = this.resolveClearAttachment(drawbuffer);
    if (att === null) return;
    const target = this.colorBytesForAttachment(att);
    if (target === null) return;
    const buf = target.data;
    for (let o = 0; o + 4 <= buf.length; o += 4) {
      buf[o] = r;
      buf[o + 1] = g;
      buf[o + 2] = b;
      buf[o + 3] = a;
    }
  }

  /** Write a [0,1] depth into the packed depth/stencil store, preserving stencil bits. */
  private writeClearDepth(depth01: number): void {
    const depth24 = Math.round(clamp01Attachment(depth01) * DEPTH_MAX_24);
    const store = this.depthStencilForWrite();
    for (let i = 0; i < store.length; i += 1) {
      store[i] = (((depth24 * 256) | (store[i]! & 0xff)) >>> 0);
    }
  }

  /** Write the low 8 stencil bits into the packed depth/stencil store, preserving depth. */
  private writeClearStencil(stencil: number): void {
    const s = Math.trunc(stencil) & 0xff;
    const store = this.depthStencilForWrite();
    for (let i = 0; i < store.length; i += 1) {
      store[i] = (((store[i]! >>> 8) * 256) | s) >>> 0;
    }
  }

  /**
   * Locate the RGBA backing bytes for a color attachment: the default drawing buffer
   * when no FBO is bound, otherwise the attached texture level or renderbuffer storage.
   */
  private colorBytesForAttachment(att: number): { data: Uint8Array; width: number; height: number } | null {
    const seam = this as unknown as AttachmentSeam;
    const bound = seam.framebufferManager.getBoundFramebuffer();
    if (bound === null || bound === undefined) {
      return {
        data: seam.drawingBuffer.getColorBuffer(),
        width: seam.drawingBuffer.getWidth(),
        height: seam.drawingBuffer.getHeight(),
      };
    }
    const rec = seam.framebufferManager.getRecord(bound);
    const entry = rec?.attachments.get(att);
    if (entry === undefined) return null;
    if (entry.kind === 'texture') {
      const mip = (entry.texture as TextureObjectLike).levels2D.get(entry.level ?? 0);
      if (mip === undefined) return null;
      return { data: mip.data, width: mip.width, height: mip.height };
    }
    if (entry.kind === 'renderbuffer') {
      const storage = seam.renderbufferManager.getStorage(entry.renderbuffer);
      if (storage === null) return null;
      return { data: storage.colorData, width: storage.width, height: storage.height };
    }
    return null;
  }

  /**
   * Packed depth/stencil backing store for depth-scoped clears. Keyed by FBO id
   * (0 addresses the default framebuffer); sized from the color attachment so
   * per-attachment depth clears land on a correctly dimensioned buffer.
   */
  private depthStencilForWrite(): Uint32Array {
    const seam = this as unknown as AttachmentSeam;
    const bound = seam.framebufferManager.getBoundFramebuffer();
    const key = bound === null || bound === undefined ? 0 : bound.id;
    let dims = this.depthStencilDims.get(key);
    if (dims === undefined) {
      if (bound === null || bound === undefined) {
        dims = { width: seam.drawingBuffer.getWidth(), height: seam.drawingBuffer.getHeight() };
      } else {
        const color = this.colorBytesForAttachment(COLOR_ATTACHMENT0 as number);
        dims = color === null ? { width: 0, height: 0 } : { width: color.width, height: color.height };
      }
      this.depthStencilDims.set(key, dims);
    }
    let store = this.depthStencilByFbo.get(key);
    const size = Math.max(0, dims.width * dims.height);
    if (store === undefined || store.length !== size) {
      store = new Uint32Array(size);
      store.fill((DEPTH_MAX_24 * 256) >>> 0);
      this.depthStencilByFbo.set(key, store);
    }
    return store;
  }

  /** Active read-buffer attachment enum for the currently bound target (default CA0). */
  private activeReadAttachment(): number {
    const boundId = this.boundFboId();
    if (boundId === null) return this.defaultFbReadBuffer;
    return this.readBufferByFbo.get(boundId) ?? (COLOR_ATTACHMENT0 as number);
  }

  /** Resolve a fragment output name to its draw-buffer location; -1 when absent. */
  getFragDataLocation(program: unknown, name: string): number {
    if (name.startsWith('gl_')) return -1;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (typeof program !== 'object' || program === null) {
      sink.recordError(INVALID_VALUE);
      return -1;
    }
    const direct = program as { linkedProgram?: import('./program').LinkedProgram | null };
    const wrapped = program as { handle?: { linkedProgram?: import('./program').LinkedProgram | null } | null };
    const linked = direct.linkedProgram ?? wrapped.handle?.linkedProgram ?? null;
    if (linked === null || linked === undefined) {
      sink.recordError(INVALID_OPERATION);
      return -1;
    }
    const found = linked.fragOutputs.get(name);
    if (found !== undefined) return found;
    // Legacy GLSL ES 1.00 fragment path: the single implicit color output is
    // exposed at location 0 under both its built-in name and the conventional
    // default-output alias; all other names are unbound (-1).
    if (linked.fragOutputs.size === 0 && (name === 'gl_FragColor' || name === 'outColor')) return 0;
    return -1;
  }

  /** Validate invalidateFramebuffer attachments; no-op on success. */
  invalidateFramebuffer(target: number, attachments: number[]): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (
      target !== (FRAMEBUFFER as number) &&
      target !== (READ_FRAMEBUFFER as number) &&
      target !== (DRAW_FRAMEBUFFER as number)
    ) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    this.validateInvalidateAttachments(attachments);
  }

  /** Validate invalidateSubFramebuffer; negative extent records INVALID_VALUE. */
  invalidateSubFramebuffer(
    target: number,
    attachments: number[],
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (this.isContextLost()) return;
    void x;
    void y;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (width < 0 || height < 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (
      target !== (FRAMEBUFFER as number) &&
      target !== (READ_FRAMEBUFFER as number) &&
      target !== (DRAW_FRAMEBUFFER as number)
    ) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    this.validateInvalidateAttachments(attachments);
  }

  /** Shared attachment validation for the invalidate* family. */
  private validateInvalidateAttachments(attachments: number[]): void {
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    const isDefault = this.boundFboId() === null;
    const ca0 = COLOR_ATTACHMENT0 as number;
    const ca3 = COLOR_ATTACHMENT3 as number;
    const none = NONE as number;
    const color = COLOR as number;
    const depthSel = DEPTH as number;
    const stencilSel = STENCIL as number;
    const depthAtt = DEPTH_ATTACHMENT as number;
    const stencilAtt = STENCIL_ATTACHMENT as number;
    const depthStencilAtt = DEPTH_STENCIL_ATTACHMENT as number;
    const back = BACK as number;
    for (const att of attachments) {
      if (!Number.isInteger(att) || att < 0) {
        sink.recordError(INVALID_ENUM);
        return;
      }
      if (isDefault) {
        if (
          att === none ||
          att === color ||
          att === depthSel ||
          att === stencilSel ||
          att === back
        ) {
          continue;
        }
        sink.recordError(INVALID_OPERATION);
        return;
      }
      if (
        att === none ||
        att === ca0 ||
        att === (COLOR_ATTACHMENT1 as number) ||
        att === (COLOR_ATTACHMENT2 as number) ||
        att === ca3 ||
        att === depthAtt ||
        att === stencilAtt ||
        att === depthStencilAtt
      ) {
        continue;
      }
      sink.recordError(INVALID_OPERATION);
      return;
    }
  }

  /**
   * Sprint 8 MRT: consume the interpreter fragment outputs map and write each named
   * output through linked.fragOutputs + activeDrawBuffers into the bound FBO
   * texture level backing store (Y-flipped, clamped RGBA bytes).
   */
  protected override routeMrtOutputs(
    linked: import('./program').LinkedProgram,
    frag: { outputs?: Map<string, Float32Array> },
  ): void {
    const outputs = frag.outputs;
    if (outputs === undefined || outputs.size === 0) return;
    const draw = this.activeDrawBuffers();
    const none = NONE as number;
    for (const [name, value] of outputs) {
      const loc = linked.fragOutputs.get(name);
      if (loc === undefined) continue;
      const att = draw[loc] ?? none;
      if (att === none) continue;
      const target = this.colorBytesForAttachment(att);
      if (target === null) continue;
      const r = clampIntByte(Math.round(clamp01Attachment(Number(value[0])) * 255));
      const g = clampIntByte(Math.round(clamp01Attachment(Number(value[1])) * 255));
      const b = clampIntByte(Math.round(clamp01Attachment(Number(value[2])) * 255));
      const a = clampIntByte(Math.round(clamp01Attachment(Number(value[3])) * 255));
      const buf = target.data;
      const w = target.width;
      const h = target.height;
      for (let y = 0; y < h; y++) {
        const srcRow = (h - 1 - y) * w * 4;
        void srcRow;
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          buf[o] = r;
          buf[o + 1] = g;
          buf[o + 2] = b;
          buf[o + 3] = a;
        }
      }
    }
  }

  /** Packed depth/stencil backing stores for depth-scoped clears, keyed by FBO id (0 = default). */
  private readonly depthStencilByFbo = new Map<number, Uint32Array>();

  /** Dimensions paired with each entry of depthStencilByFbo. */
  private readonly depthStencilDims = new Map<number, { width: number; height: number }>();

  // ---- Sprint 12 Task 3: D1 attribute/divisor semantics ----

  /** Integer vertex attribute pointer (WebGL2); float types record INVALID_ENUM. */
  vertexAttribIPointer(index: number, size: number, type: number, stride: number, offset: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (!Number.isInteger(index) || index < 0 || index >= 16) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (size !== 1 && size !== 2 && size !== 3 && size !== 4) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (
      type !== (BYTE as number) && type !== (UNSIGNED_BYTE as number) &&
      type !== (SHORT as number) && type !== (UNSIGNED_SHORT as number) &&
      type !== (INT as number) && type !== (UNSIGNED_INT as number)
    ) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (!Number.isInteger(stride) || stride < 0 || stride > 255) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isInteger(offset) || offset < 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    const state = (this as unknown as GLStateInternals).glState;
    const internals = this as unknown as { bufferManager: { getBoundBuffer(t: number): BufferObject | null } };
    const bound = internals.bufferManager.getBoundBuffer(ARRAY_BUFFER as number);
    if (bound === null && offset !== 0) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    state.setVertexAttribPointer(index, size, type as GLenum, false, stride, offset, bound);
    state.setVertexAttribInteger(index, true);
  }

  /** Bind a vertex buffer to a vertex-buffer binding point (WebGL2 D1). */
  bindVertexBuffer(bindingIndex: number, buffer: BufferObject | null, offset: number, stride: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (!Number.isInteger(bindingIndex) || bindingIndex < 0 || bindingIndex >= 16) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(stride) || stride < 0 || stride > 255) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (buffer !== null && buffer.alive !== true) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    this.vertexBufferBindings[bindingIndex] = { buffer, offset, stride, divisor: 0 };
  }

  /** Associate a vertex attribute with a vertex-buffer binding point (WebGL2 D1). */
  vertexAttribBinding(attribIndex: number, bindingIndex: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (!Number.isInteger(attribIndex) || attribIndex < 0 || attribIndex >= 16) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isInteger(bindingIndex) || bindingIndex < 0 || bindingIndex >= 16) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    this.attribBindingPoint[attribIndex] = bindingIndex;
  }

  /** Set the divisor on a vertex-buffer binding point (WebGL2 D1). */
  vertexBindingDivisor(bindingIndex: number, divisor: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (!Number.isInteger(bindingIndex) || bindingIndex < 0 || bindingIndex >= 16) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isInteger(divisor) || divisor < 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    const entry = this.vertexBufferBindings[bindingIndex];
    if (entry !== undefined) entry.divisor = divisor;
  }

  /** Per-attribute -> binding-point association table (default: attribute index). */
  private readonly attribBindingPoint: number[] = Array.from({ length: 16 }, (_, i) => i);

  /** Vertex-buffer binding-point state (WebGL2 D1). */
  private readonly vertexBufferBindings: Array<{ buffer: BufferObject | null; offset: number; stride: number; divisor: number }> =
    Array.from({ length: 16 }, () => ({ buffer: null, offset: 0, stride: 0, divisor: 0 }));

  // ---- Sprint 12 Task 3: D2 immutable texture storage ----

  /** Allocate immutable 2D texture storage (WebGL2 D2). */
  texStorage2D(target: number, levels: number, internalformat: number, width: number, height: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (target !== (TEXTURE_2D as number) && target !== (TEXTURE_CUBE_MAP as number)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (!TEXSTORAGE_INTERNALFORMATS.has(internalformat)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (!Number.isInteger(levels) || levels <= 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (width > LIMIT_MAX_TEXTURE_SIZE || height > LIMIT_MAX_TEXTURE_SIZE) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    const maxLevels = Math.floor(Math.log2(Math.max(width, height))) + 1;
    if (levels > maxLevels) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    const bound = mgr.getBoundTexture(target as GLenum);
    if (bound === null || bound.alive !== true) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    if (bound.immutable === true) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    for (let level = 0; level < levels; level += 1) {
      const lw = Math.max(1, Math.floor(width / Math.pow(2, level)));
      const lh = Math.max(1, Math.floor(height / Math.pow(2, level)));
      const mip = { width: lw, height: lh, depth: 1, internalFormat: internalformat, type: UNSIGNED_BYTE as number, data: new Uint8Array(lw * lh * 4) };
      bound.levels2D.set(level, mip);
    }
    bound.immutable = true;
    bound.immutableLevels = levels;
  }

  /** Allocate immutable 3D/array texture storage (WebGL2 D2). */
  texStorage3D(target: number, levels: number, internalformat: number, width: number, height: number, depth: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (target !== (TEXTURE_3D as number) && target !== (TEXTURE_2D_ARRAY as number)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (!TEXSTORAGE_INTERNALFORMATS.has(internalformat)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (!Number.isInteger(levels) || levels <= 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0 || !Number.isInteger(depth) || depth <= 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (width > LIMIT_MAX_3D_TEXTURE_SIZE || height > LIMIT_MAX_3D_TEXTURE_SIZE || depth > 256) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    const maxLevels = Math.floor(Math.log2(Math.max(width, height, depth))) + 1;
    if (levels > maxLevels) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    const bound = mgr.getBoundTexture(target as GLenum);
    if (bound === null || bound.alive !== true) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    if (bound.immutable === true) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const store = target === (TEXTURE_3D as number)
      ? (bound.levels3D ?? (bound.levels3D = new Map()))
      : (bound.levels2DArray ?? (bound.levels2DArray = new Map()));
    for (let level = 0; level < levels; level += 1) {
      const lw = Math.max(1, Math.floor(width / Math.pow(2, level)));
      const lh = Math.max(1, Math.floor(height / Math.pow(2, level)));
      const ld = target === (TEXTURE_3D as number) ? Math.max(1, Math.floor(depth / Math.pow(2, level))) : depth;
      const mip = { width: lw, height: lh, depth: ld, internalFormat: internalformat, type: UNSIGNED_BYTE as number, data: new Uint8Array(lw * lh * ld * 4) };
      store.set(level, mip);
    }
    bound.immutable = true;
    bound.immutableLevels = levels;
  }

  /** Intercept TEXTURE_IMMUTABLE_FORMAT on getTexParameter (WebGL2 D2). */
  override getTexParameter(target: number, pname: number): number | GLenum | null {
    if (pname === PNAME_TEXTURE_IMMUTABLE_FORMAT) {
      const mgr = (this as unknown as TextureManagerInternals).textureManager;
      const bound = mgr.getBoundTexture(target as GLenum);
      if (bound === null || bound.alive !== true) {
        (this as unknown as ErrorSinkInternals).errorSink.recordError(INVALID_OPERATION);
        return null;
      }
      return (bound.immutable === true) as unknown as number;
    }
    return super.getTexParameter(target, pname);
  }

  /** Reject texImage2D on immutable textures (WebGL2 D2). */
  override texImage2D(
    target: number,
    level: number,
    internalformat: number,
    width: number,
    height: number,
    border: number,
    format: number,
    type: number,
    pixels?: ArrayBufferView | null,
  ): void {
    const mgr = (this as unknown as TextureManagerInternals).textureManager;
    // Cube-face uploads address the TEXTURE_CUBE_MAP binding; querying the
    // face enum directly would record INVALID_ENUM in getBoundTexture.
    const lookupTarget = target >= 0x8515 && target <= 0x851a ? (TEXTURE_CUBE_MAP as number) : target;
    const bound = mgr.getBoundTexture(lookupTarget as GLenum);
    if (bound !== null && bound.alive === true && bound.immutable === true) {
      (this as unknown as ErrorSinkInternals).errorSink.recordError(INVALID_OPERATION);
      return;
    }
    super.texImage2D(target, level, internalformat, width, height, border, format, type, pixels ?? null);
  }

  // ---- Sprint 12 Task 3: D3 transform-feedback V2 objects ----

  /** Transform-feedback object registry (Sprint 12 Task 3, D3). */
  private readonly transformFeedbacks = new Map<number, TransformFeedbackObject>();

  /** Handle of the currently bound transform-feedback object (null = default). */
  private boundTransformFeedbackHandle: WebGLTransformFeedback | null = null;

  /** True while transform feedback is paused (Sprint 12 Task 3, D3). */
  private tfPaused = false;

  /** Create a transform-feedback object; null on context loss. */
  createTransformFeedback(): WebGLTransformFeedback | null {
    if (this.isContextLost()) return null;
    const id = this.transformFeedbacks.size + 1;
    const obj: TransformFeedbackObject = { id, alive: true, everBound: false };
    this.transformFeedbacks.set(id, obj);
    return new WebGLTransformFeedback(id);
  }

  /** Delete a transform-feedback object; bound object reverts to default. */
  deleteTransformFeedback(tf: WebGLTransformFeedback | null | undefined): void {
    if (this.isContextLost()) return;
    if (tf === null || tf === undefined) return;
    const obj = this.transformFeedbacks.get(tf.id);
    if (obj === undefined || obj.alive !== true) return;
    obj.alive = false;
    this.transformFeedbacks.delete(tf.id);
    if (this.boundTransformFeedbackHandle !== null && this.boundTransformFeedbackHandle.id === tf.id) {
      this.boundTransformFeedbackHandle = null;
    }
  }

  /** True iff the handle is a live, ever-bound transform-feedback object. */
  isTransformFeedback(tf: unknown): boolean {
    if (this.isContextLost()) return false;
    if (tf === null || typeof tf !== 'object') return false;
    const candidate = tf as { id?: unknown };
    if (typeof candidate.id !== 'number') return false;
    const obj = this.transformFeedbacks.get(candidate.id);
    return obj !== undefined && obj.alive === true && obj.everBound === true;
  }

  /** Bind a transform-feedback object to TRANSFORM_FEEDBACK; binding while active is INVALID_OPERATION. */
  bindTransformFeedback(target: number, tf: WebGLTransformFeedback | null): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (target !== (TRANSFORM_FEEDBACK as number)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    if (this.tfActive) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    if (tf === null) {
      this.boundTransformFeedbackHandle = null;
      return;
    }
    const obj = this.transformFeedbacks.get(tf.id);
    if (obj === undefined || obj.alive !== true) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    obj.everBound = true;
    this.boundTransformFeedbackHandle = tf;
  }

  /** Pause active transform feedback; pause without active records INVALID_OPERATION. */
  pauseTransformFeedback(): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (!this.tfActive || this.tfPaused) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    this.tfPaused = true;
  }

  /** Resume paused transform feedback; resume without paused records INVALID_OPERATION. */
  resumeTransformFeedback(): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (!this.tfActive || !this.tfPaused) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    this.tfPaused = false;
  }

  /** End-of-TF hook: clear the paused flag when capture ends (Sprint 12 Task 3, D3). */
  endTransformFeedback(): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (!this.tfActive) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    this.tfActive = false;
    this.tfPaused = false;
  }

  /** Bind an indexed TF buffer range; misaligned offset/size record INVALID_VALUE (WebGL2 D3). */
  bindBufferRange(target: number, index: number, buffer: BufferObject | null, offset: number, size: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (target !== (TRANSFORM_FEEDBACK_BUFFER as number)) {
      super.bindBufferRange(target, index, buffer, offset, size);
      return;
    }
    if (!Number.isInteger(index) || index < 0 || index >= 4) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (buffer === null) {
      this.tfIndexedBindings[index] = null;
      if (index === 0) {
        this.extraBufferBindings.set(TRANSFORM_FEEDBACK_BUFFER as number, null);
        this.tfBoundBuffer = null;
      }
      return;
    }
    if (buffer.alive !== true) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(size) || size <= 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (offset % 4 !== 0 || size % 4 !== 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (offset + size > buffer.byteLength) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    this.tfIndexedBindings[index] = { buffer, offset, size };
    if (index === 0) {
      this.extraBufferBindings.set(TRANSFORM_FEEDBACK_BUFFER as number, buffer);
      this.tfBoundBuffer = buffer;
    }
  }

  /** Indexed TF buffer bindings (Sprint 12 Task 3, D3). */
  private readonly tfIndexedBindings: Array<{ buffer: BufferObject; offset: number; size: number } | null> = [null, null, null, null];

  /** Indexed TF buffer queries: BINDING/START/SIZE (WebGL2 D3). */
  override getIndexedParameter(target: number, index: number): unknown {
    if (target === PNAME_TF_BUFFER_BINDING || target === PNAME_TF_BUFFER_START || target === PNAME_TF_BUFFER_SIZE) {
      if (!Number.isInteger(index) || index < 0 || index >= 4) return null;
      const entry = this.tfIndexedBindings[index];
      if (entry === null) return target === PNAME_TF_BUFFER_BINDING ? null : 0;
      if (target === PNAME_TF_BUFFER_BINDING) return entry.buffer;
      if (target === PNAME_TF_BUFFER_START) return entry.offset;
      return entry.size;
    }
    return super.getIndexedParameter(target, index);
  }

  /** Extend bindBufferBase to all four TF indexed slots (WebGL2 D3). */
  override bindBufferBase(target: number, index: number, buffer: BufferObject | null): void {
    if (target === (TRANSFORM_FEEDBACK_BUFFER as number)) {
      if (this.isContextLost()) return;
      const sink = (this as unknown as ErrorSinkInternals).errorSink;
      if (!Number.isInteger(index) || index < 0 || index >= 4) {
        sink.recordError(INVALID_VALUE);
        return;
      }
      if (buffer === null) {
        this.tfIndexedBindings[index] = null;
        if (index === 0) {
          this.extraBufferBindings.set(TRANSFORM_FEEDBACK_BUFFER as number, null);
          this.tfBoundBuffer = null;
        }
        return;
      }
      if (buffer.alive !== true) {
        sink.recordError(INVALID_OPERATION);
        return;
      }
      this.tfIndexedBindings[index] = { buffer, offset: 0, size: buffer.byteLength };
      if (index === 0) {
        this.extraBufferBindings.set(TRANSFORM_FEEDBACK_BUFFER as number, buffer);
        this.tfBoundBuffer = buffer;
      }
      return;
    }
    super.bindBufferBase(target, index, buffer);
  }

  // ---- Sprint 12 Task 3: D4 misc queries and buffer copies ----

  /** Copy a sub-region between buffer objects (WebGL2 D4). */
  copyBufferSubData(readTarget: number, writeTarget: number, readOffset: number, writeOffset: number, size: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    const validTargets = new Set<number>([
      ARRAY_BUFFER as number, ELEMENT_ARRAY_BUFFER as number, TRANSFORM_FEEDBACK_BUFFER as number,
      UNIFORM_BUFFER as number, COPY_READ_BUFFER as number, COPY_WRITE_BUFFER as number,
      PIXEL_PACK_BUFFER as number, PIXEL_UNPACK_BUFFER as number,
    ]);
    if (!validTargets.has(readTarget) || !validTargets.has(writeTarget)) {
      sink.recordError(INVALID_ENUM);
      return;
    }
    const readBuf = this.resolveBoundBuffer(readTarget);
    const writeBuf = this.resolveBoundBuffer(writeTarget);
    if (readBuf === null || writeBuf === null) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    if (!Number.isInteger(readOffset) || readOffset < 0 || !Number.isInteger(writeOffset) || writeOffset < 0 || !Number.isInteger(size) || size < 0) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (readOffset + size > readBuf.byteLength || writeOffset + size > writeBuf.byteLength) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (readBuf === writeBuf && ((readOffset <= writeOffset && readOffset + size > writeOffset) || (writeOffset <= readOffset && writeOffset + size > readOffset))) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    if (readBuf.data === null || writeBuf.data === null) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const srcView = new Uint8Array(readBuf.data, readOffset, size);
    const dstView = new Uint8Array(writeBuf.data, writeOffset, size);
    dstView.set(srcView);
  }

  /** Query unsigned-integer uniform values (WebGL2 D4). */
  getUniformuiv(program: unknown, location: unknown, params: Uint32Array, srcOffset?: number, length?: number): void {
    if (this.isContextLost()) return;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (params === null || params === undefined) {
      sink.recordError(INVALID_VALUE);
      return;
    }
    const loc = location as { programId?: number; location?: number } | null;
    if (loc === null || typeof loc !== 'object' || typeof loc.programId !== 'number' || typeof loc.location !== 'number') {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const prog = (this as unknown as { currentProgram: WebGLProgram | null }).currentProgram;
    if (prog === null || prog.id !== loc.programId) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const linked = prog.handle.linkedProgram;
    if (linked === null || linked === undefined) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const found = linked.activeUniforms.find((u) => u.location === loc.location);
    if (found === undefined) {
      sink.recordError(INVALID_OPERATION);
      return;
    }
    const off = srcOffset ?? 0;
    const count = length ?? params.length - off;
    for (let i = 0; i < count; i += 1) {
      params[off + i] = linked.uniformStore.u32[found.slot + i] ?? 0;
    }
  }

  /** Query internalformat support (WebGL2 D4). */
  getInternalformatParameter(target: number, internalformat: number, pname: number): Int32Array | null {
    if (this.isContextLost()) return null;
    const sink = (this as unknown as ErrorSinkInternals).errorSink;
    if (target !== (RENDERBUFFER as number)) {
      sink.recordError(INVALID_ENUM);
      return null;
    }
    if (!TEXSTORAGE_INTERNALFORMATS.has(internalformat)) {
      sink.recordError(INVALID_ENUM);
      return null;
    }
    if (pname !== PNAME_SAMPLES) {
      sink.recordError(INVALID_ENUM);
      return null;
    }
    return new Int32Array([4]);
  }
}

/** STENCIL buffer selector (0x1802) for the clearBuffer* family; no constants.ts export exists. */
const STENCIL: GLenum = 0x1802;

/** 24-bit depth ceiling shared with the framebuffer packed depth/stencil layout. */
const DEPTH_MAX_24 = 16777215;

/** Public WebGLTransformFeedback handle exposed to callers (Sprint 12 Task 3, D3). */
export class WebGLTransformFeedback {
  readonly id: number;
  constructor(id: number) {
    this.id = id;
  }
}

/** Internal transform-feedback object state (Sprint 12 Task 3, D3). */
interface TransformFeedbackObject {
  readonly id: number;
  alive: boolean;
  everBound: boolean;
}

/** Sized internalformats accepted by texStorage* (Sprint 12 Task 3, D2). */
const TEXSTORAGE_INTERNALFORMATS = new Set<number>([
  RGBA8 as number,
  RGB8 as number,
  RGBA4 as number,
  RGB5_A1 as number,
  RGB565 as number,
  DEPTH_COMPONENT16 as number,
  DEPTH_COMPONENT24 as number,
  DEPTH24_STENCIL8 as number,
]);

/** VERTEX_ATTRIB_ARRAY_INTEGER (0x88fd; no constants.ts export). */
const PNAME_VERTEX_ATTRIB_ARRAY_INTEGER = 0x88fd;
/** VERTEX_ATTRIB_BINDING (0x82d4; no constants.ts export). */
const PNAME_VERTEX_ATTRIB_BINDING = 0x82d4;
/** TEXTURE_IMMUTABLE_FORMAT (0x912f; no constants.ts export). */
const PNAME_TEXTURE_IMMUTABLE_FORMAT = 0x912f;
/** SAMPLER_BINDING (0x8919; no constants.ts export). */
const PNAME_SAMPLER_BINDING = 0x8919;
/** TRANSFORM_FEEDBACK_BINDING (0x8e25; no constants.ts export). */
const PNAME_TRANSFORM_FEEDBACK_BINDING = 0x8e25;
/** TRANSFORM_FEEDBACK_PAUSED (0x8e23; no constants.ts export). */
const PNAME_TRANSFORM_FEEDBACK_PAUSED = 0x8e23;
/** TRANSFORM_FEEDBACK_BUFFER_BINDING (0x8c8f; no constants.ts export). */
const PNAME_TF_BUFFER_BINDING = 0x8c8f;
/** TRANSFORM_FEEDBACK_BUFFER_START (0x8c84; no constants.ts export). */
const PNAME_TF_BUFFER_START = 0x8c84;
/** TRANSFORM_FEEDBACK_BUFFER_SIZE (0x8c85; no constants.ts export). */
const PNAME_TF_BUFFER_SIZE = 0x8c85;
/** SAMPLES (0x80a9; no constants.ts export). */
const PNAME_SAMPLES = 0x80a9;

/** Clamp a float to [0,1]; non-finite inputs become 0. */
function clamp01Attachment(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** Clamp an integer clear value to one unsigned byte. */
function clampIntByte(v: number): number {
  if (!Number.isFinite(v)) return 0;
  const t = Math.trunc(v);
  if (t < 0) return 0;
  if (t > 255) return 255;
  return t;
}

/** Minimal structural view of a texture level backing store. */
interface TextureLevelLike {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** Minimal structural view of a texture object sufficient for attachment reads/writes. */
interface TextureObjectLike {
  readonly levels2D: Map<number, TextureLevelLike>;
}

/** Minimal structural view of one framebuffer attachment record. */
interface AttachmentRecordLike {
  readonly kind: string;
  readonly texture?: unknown;
  readonly level?: number;
  readonly renderbuffer?: unknown;
}

/** Seams into WebGL1-owned managers needed for attachment-scoped buffer access. */
interface AttachmentSeam {
  readonly framebufferManager: {
    getBoundFramebuffer(): { id: number } | null;
    getRecord(fb: { id: number }): { attachments: Map<number, AttachmentRecordLike> } | null;
  };
  readonly renderbufferManager: {
    getStorage(rb: unknown): { colorData: Uint8Array; width: number; height: number } | null;
  };
  readonly drawingBuffer: {
    getColorBuffer(): Uint8Array;
    getWidth(): number;
    getHeight(): number;
  };
}

/**
 * Copy an RGBA/UNSIGNED_BYTE rect from a backing store into the destination with the
 * GL bottom-up row convention (destination row 0 is the bottom row of the read rect).
 */
function copyFlippedRegion(
  src: Uint8Array,
  bufW: number,
  bufH: number,
  x: number,
  y: number,
  width: number,
  height: number,
  dest: Uint8Array,
  offset: number,
): void {
  const readX = Math.trunc(x);
  const readY = Math.trunc(y);
  const readW = Math.trunc(width);
  const readH = Math.trunc(height);
  const startX = Math.max(0, readX);
  const endX = Math.min(bufW, readX + readW);
  const intersectW = Math.max(0, endX - startX);
  const startY = Math.max(0, readY);
  const endY = Math.min(bufH, readY + readH);
  const intersectH = Math.max(0, endY - startY);
  for (let row = 0; row < intersectH; row += 1) {
    const targetY = startY + row;
    const srcRowStart = ((bufH - 1 - targetY) * bufW + startX) * 4;
    const dstWriteIndex = offset + (row * readW + (startX - readX)) * 4;
    dest.set(src.subarray(srcRowStart, srcRowStart + intersectW * 4), dstWriteIndex);
  }
}
/** Prototype-chain + duck-type check for WebGL2 instances (no recursion: never uses instanceof). */
function isWebGL2Instance(instance: unknown): boolean {
  if (instance === null || (typeof instance !== 'object' && typeof instance !== 'function')) return false;
  let current: unknown = Object.getPrototypeOf(instance);
  while (current !== null) {
    if (current === WebGL2Context.prototype) return true;
    current = Object.getPrototypeOf(current);
  }
  const candidate = instance as Record<string, unknown>;
  return (
    typeof candidate['drawingBufferWidth'] === 'number' &&
    typeof candidate['texImage3D'] === 'function' &&
    typeof candidate['createVertexArray'] === 'function'
  );
}

// IMPLEMENTATION DECISION: harness-alias trap for globalThis.WebGL2RenderingContext (see the
// WebGLRenderingContext trap at the end of webgl1-context.ts for rationale). Each injected
// constructor receives its own Symbol.hasInstance delegating to isWebGL2Instance.
try {
  const g = globalThis as unknown as Record<string, unknown>;
  const patchAlias = (v: unknown): void => {
    try {
      if (typeof v === 'function' && !Object.prototype.hasOwnProperty.call(v, Symbol.hasInstance)) {
        Object.defineProperty(v, Symbol.hasInstance, {
          value: (inst: unknown): boolean => isWebGL2Instance(inst),
          configurable: true,
          writable: true,
        });
      }
    } catch (_e) {
      void _e;
    }
  };
  let current: unknown = g['WebGL2RenderingContext'];
  if (current === undefined) current = WebGL2Context;
  patchAlias(current);
  Object.defineProperty(g, 'WebGL2RenderingContext', {
    configurable: true,
    enumerable: true,
    get: (): unknown => current,
    set: (v: unknown): void => {
      current = v;
      patchAlias(v);
    },
  });
} catch (_e) {
  void _e;
}
