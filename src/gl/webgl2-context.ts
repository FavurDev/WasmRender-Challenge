// CHANGELOG: Sprint 8 Task 5 (2026-09-22): WebGL2-only 3D/array texture facade (texImage3D family + WebGL2 pixel-store interception). ADR-004: WebGL1Context never exposes these methods.
// CHANGELOG: Sprint 8 Task 1 (2026-09-22): VAO family merged alongside Task 5 facade (create/bind/delete/isVertexArray + getVertexAttrib/Offset, everBound tracking).
/** WebGL2Context — WebGL1Context subclass exposing the WebGL 2.0 3D/array texture family.
 *
 * Responsibility: texImage3D/texSubImage3D/copyTexSubImage3D facade plus WebGL2
 * pixel-store unpack interception (UNPACK_ROW_LENGTH/IMAGE_HEIGHT/SKIP_PIXELS/
 * SKIP_ROWS/SKIP_IMAGES), all delegated to the shared TextureManager. WebGL1
 * behavior is inherited untouched; the 3D family exists ONLY here (ADR-004).
 */
import {
  CURRENT_QUERY,
  CURRENT_VERTEX_ATTRIB,
  ELEMENT_ARRAY_BUFFER,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  TRIANGLES,
  UNSIGNED_BYTE,
  UNSIGNED_INT,
  UNSIGNED_SHORT,
  UNPACK_IMAGE_HEIGHT,
  UNPACK_ROW_LENGTH,
  UNPACK_SKIP_IMAGES,
  UNPACK_SKIP_PIXELS,
  UNPACK_SKIP_ROWS,
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
import { QuerySyncManager } from './query-sync';
import type { WebGLQuery, WebGLSync } from './query-sync';
import type { ErrorSink } from './errors';
import { resolveIndexSequence } from './vertex-fetch';
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

export class WebGL2Context extends WebGL1Context {
  private querySyncManager: QuerySyncManager | null = null;

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

  /** Test helper: simulate an occlusion draw contributing `passed` surviving samples. */
  drawOcclusionScene(_total: number, passed: number): void {
    if (this.isContextLost()) return;
    this.getQuerySync().incrementSampleCount(passed);
  }

  /** Intercept CURRENT_QUERY (return null, no error) and VERTEX_ARRAY_BINDING; all other pnames defer to WebGL1. */
  override getParameter(pname: number): unknown {
    if ((pname as GLenum) === CURRENT_QUERY) return null;
    if ((pname as GLenum) === VERTEX_ARRAY_BINDING) {
      if (this.isContextLost()) return null;
      return (this as unknown as GLStateInternals).glState.getBoundVertexArray();
    }
    return super.getParameter(pname);
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

  /** Query per-attribute state, incl. DIVISOR and CURRENT_VERTEX_ATTRIB. */
  getVertexAttrib(index: number, pname: number): unknown {
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

  drawBuffers(buffers: number[]): void {}

  readBuffer(src: number): void {}
}