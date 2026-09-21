// CHANGELOG: Sprint 2 (2026-09-20): Sprint 2 T4 minimal WebGL1 context facade composition root
// CHANGELOG: Sprint 4 Task 6: additive shader/program/uniform-setter API surface (compile/link/useProgram/reflection/uniform setters)
// CHANGELOG: Sprint 5 (2026-09-21): vertexAttribPointer/drawArrays orchestrator, validateUniform extraction (TD-009), depth-state facade methods
/** WebGL1Context — minimal WebGL 1.0 facade; composition root (ADR-013). */
import {
  ACTIVE_ATTRIBUTES,
  ACTIVE_UNIFORMS,
  ARRAY_BUFFER,
  ATTACHED_SHADERS,
  BYTE,
  COLOR_BUFFER_BIT,
  COLOR_CLEAR_VALUE,
  COMPILE_STATUS,
  DELETE_STATUS,
  DEPTH_BUFFER_BIT,
  DEPTH_CLEAR_VALUE,
  FIXED,
  FLOAT,
  FLOAT_MAT2,
  FLOAT_MAT3,
  FLOAT_MAT4,
  FLOAT_VEC2,
  FLOAT_VEC3,
  FLOAT_VEC4,
  FRAGMENT_SHADER,
  FRAMEBUFFER_COMPLETE,
  INVALID_ENUM,
  INVALID_FRAMEBUFFER_OPERATION,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINK_STATUS,
  SCISSOR_BOX,
  SHADER_TYPE,
  SHORT,
  STENCIL_BUFFER_BIT,
  STENCIL_CLEAR_VALUE,
  TRIANGLES,
  VALID_DEPTH_FUNC_SET,
  VALIDATE_STATUS,
  VERSION,
  VERSION_STRING_WEBGL1,
  UNSIGNED_BYTE,
  UNSIGNED_INT_VEC2,
  UNSIGNED_INT_VEC3,
  UNSIGNED_INT_VEC4,
  UNSIGNED_SHORT,
  INT_VEC2,
  INT_VEC3,
  INT_VEC4,
  BOOL_VEC2,
  BOOL_VEC3,
  BOOL_VEC4,
  VERTEX_SHADER,
  VIEWPORT,
} from './constants';
import type { GLenum } from './constants';
import { ErrorSink } from './errors';
import { GLState } from './state';
import type { CanvasDimensions, VertexAttribDescriptor } from './state';
import { BufferManager } from './buffer';
import type { BufferObject } from './buffer';
import { TextureManager } from './texture';
import type { TextureObject } from './texture';
import { DrawingBuffer } from './framebuffer';
import { resolveContextAttributes } from './context-attributes';
import type { WebGLContextAttributes } from './context-attributes';
import { clipTriangle } from '../raster/clipper';
import type { ClipVertex } from '../raster/clipper';
import { mapClipToScreen, rasterizeTriangle } from '../raster/rasterizer';
import { tokenize } from '../glsl/tokenizer';
import { runPreprocessor } from '../glsl/preprocessor';
import { parse } from '../glsl/parser';
import { check, registerCheckedAST } from '../glsl/checker';
import type { CheckedShader } from '../glsl/checker';
import { link, ProgramRegistry } from './program';
import type { ActiveUniformInfo, LinkedProgram, ProgramHandle } from './program';
import { createVertexAttribTargetMap, fetchVertexAttributes, validateVertexAttribRange } from './vertex-fetch';
import { executeFragment, executeVertex } from '../glsl/interpreter';
import type { InterpreterHost } from '../glsl/interpreter';

export interface DirectVertex {
  readonly position:
    | readonly [number, number, number, number]
    | readonly [number, number, number]
    | readonly [number, number];
  readonly color?: readonly [number, number, number, number] | readonly [number, number, number];
}

/** WebGLShader handle — also satisfies program.ts ShaderHandle ({id, alive, type, checked}). */
export class WebGLShader {
  public alive = true;
  public deleteStatus = false;
  public source = '';
  public compiled = false;
  public infoLog = '';
  public checked: CheckedShader | null = null;
  public constructor(
    public readonly id: number,
    public readonly type: GLenum,
  ) {}
}

/** WebGLProgram handle wrapping a ProgramRegistry ProgramHandle. */
export class WebGLProgram {
  public deleteStatus = false;
  public constructor(
    public readonly id: number,
    public readonly handle: ProgramHandle,
  ) {}
}

/** WebGLUniformLocation carrying owning program id + linker location. */
export class WebGLUniformLocation {
  public constructor(
    public readonly programId: number,
    public readonly location: number,
    public readonly name: string,
  ) {}
}

/** WebGLActiveInfo reflection record. */
export class WebGLActiveInfo {
  public constructor(
    public readonly name: string,
    public readonly size: number,
    public readonly type: number,
  ) {}
}

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 150;
const POINT_SIZE_DEFAULT = 1.0;
const DEFAULT_VARYING: readonly [number, number, number, number] = [1, 1, 1, 1];
const MAX_VERTEX_ATTRIBS = 16;

/** Minimal WebGL 1.0 context facade composing ErrorSink, GLState, DrawingBuffer, raster core. */
export class WebGL1Context {
  readonly canvas: { width: number; height: number };
  private readonly errorSink: ErrorSink;
  private readonly glState: GLState;
  private readonly drawingBuffer: DrawingBuffer;
  private readonly contextAttributes: WebGLContextAttributes;
  private readonly programRegistry = new ProgramRegistry();
  private readonly bufferManager: BufferManager;
  private readonly textureManager: TextureManager;
  private readonly shaders = new Map<number, WebGLShader>();
  private readonly programs = new Map<number, WebGLProgram>();
  private nextShaderId = 1;
  private currentProgram: WebGLProgram | null = null;

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
    this.bufferManager = new BufferManager(this.errorSink);
    this.textureManager = new TextureManager(this.errorSink);
  }

  /** Set the clear color. */
  clearColor(red: number, green: number, blue: number, alpha: number): void {
    this.glState.setClearColor(red, green, blue, alpha);
  }

  /** Set the depth range mapping; values clamp to [0, 1] per spec (no error). */
  depthRange(zNear: number, zFar: number): void {
    this.glState.setDepthRange(zNear, zFar);
  }

  /** Set the depth comparison function; invalid enums record INVALID_ENUM with no state change. */
  depthFunc(func: number): void {
    if (!VALID_DEPTH_FUNC_SET.has(func as GLenum)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    this.glState.setDepthFunc(func as GLenum);
  }

  /** Set the clear depth value; clamps to [0, 1] per spec (no error). */
  clearDepth(depth: number): void {
    this.glState.setClearDepth(depth);
  }

  /** Enable or disable depth buffer writes. */
  depthMask(flag: boolean): void {
    this.glState.setDepthMask(flag);
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
   *   directGeometry: Direct vertex records; omitted routes to the buffered draw path.
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
    if (directGeometry === undefined || directGeometry === null) {
      this.drawBufferedTriangles(first, count);
      return;
    }
    if (count % 3 !== 0) {
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
   * Draw TRIANGLES from bound buffer objects through fetch, vertex execution, clip, and rasterize.
   *
   * Precondition matrix (first failing check wins): context loss is silent; a
   * non-TRIANGLES mode records INVALID_ENUM; negative first/count records
   * INVALID_VALUE; a missing or unlinked current program records
   * INVALID_OPERATION; an enabled array with no bound buffer records
   * INVALID_OPERATION; an out-of-range attribute range records
   * INVALID_OPERATION; an incomplete framebuffer records
   * INVALID_FRAMEBUFFER_OPERATION. A zero count is a silent no-op.
   *
   * Args:
   *   first: First vertex index (must be >= 0).
   *   count: Vertex count (must be >= 0; trailing vertices not forming a full triangle are ignored).
   */
  private drawBufferedTriangles(first: number, count: number): void {
    if (this.errorSink.isContextLost()) return;
    const prog = this.currentProgram;
    if (prog === null || prog.handle.linkStatus !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const linked = prog.handle.linkedProgram;
    if (linked === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const descriptors: VertexAttribDescriptor[] = [];
    for (let index = 0; index < MAX_VERTEX_ATTRIBS; index++) {
      const desc = this.glState.getVertexAttrib(index);
      if (desc === null) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      descriptors.push(desc);
    }
    for (const desc of descriptors) {
      if (desc.enabled && (desc.buffer === null || desc.buffer === undefined)) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
    }
    const bufferLookup = (handle: unknown): BufferObject | null => (handle as BufferObject | null) ?? null;
    const range = validateVertexAttribRange(descriptors, bufferLookup, first, count, linked.activeAttribs);
    if (!range.ok) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const fb = this.drawingBuffer as unknown as { checkStatus?: () => number };
    const fbStatus = typeof fb.checkStatus === 'function' ? fb.checkStatus() : FRAMEBUFFER_COMPLETE;
    if (fbStatus !== FRAMEBUFFER_COMPLETE) {
      this.errorSink.recordError(INVALID_FRAMEBUFFER_OPERATION);
      return;
    }
    if (count === 0) {
      return;
    }
    const pipelineState = this.glState.snapshot();
    const targetMap = createVertexAttribTargetMap(linked.activeAttribs);
    const host: InterpreterHost = {
      readUniform: (slot: number) => this.readDrawUniform(linked, slot),
      sample: () => new Float32Array([0, 0, 0, 1]),
    };
    const layout = linked.varyingLayout;
    const flatWidth = layout.length > 0 ? layout.length * 4 : 4;
    let flatColor: Float32Array | null = null;
    if (layout.length === 0) {
      const frag = executeFragment(linked, new Map<string, Float32Array>(), host);
      flatColor = new Float32Array([frag.color[0] as number, frag.color[1] as number, frag.color[2] as number, frag.color[3] as number]);
    }
    const shells: ClipVertex[] = [0, 1, 2].map(() => ({
      clip: [0, 0, 0, 1] as [number, number, number, number],
      pointSize: 1,
      varyings: new Float32Array(flatWidth),
    }));
    const triCount = Math.floor(count / 3);
    for (let tri = 0; tri < triCount; tri++) {
      for (let corner = 0; corner < 3; corner++) {
        const vertexId = first + tri * 3 + corner;
        fetchVertexAttributes(descriptors, bufferLookup, vertexId, linked.activeAttribs, targetMap);
        const out = executeVertex(linked, vertexId, targetMap, host);
        const shell = shells[corner] as ClipVertex;
        shell.clip[0] = out.clipPos[0] as number;
        shell.clip[1] = out.clipPos[1] as number;
        shell.clip[2] = out.clipPos[2] as number;
        shell.clip[3] = out.clipPos[3] as number;
        shell.pointSize = out.pointSize;
        const dst = shell.varyings;
        if (layout.length === 0) {
          const flat = flatColor as Float32Array;
          dst[0] = flat[0] as number;
          dst[1] = flat[1] as number;
          dst[2] = flat[2] as number;
          dst[3] = flat[3] as number;
        } else {
          for (let slot = 0; slot < layout.length; slot++) {
            const item = layout[slot] as { name: string };
            const vec = out.varyings.get(item.name);
            const o = slot * 4;
            if (vec !== undefined) {
              dst[o] = vec[0] as number;
              dst[o + 1] = vec[1] as number;
              dst[o + 2] = vec[2] as number;
              dst[o + 3] = vec[3] as number;
            } else {
              dst[o] = 0;
              dst[o + 1] = 0;
              dst[o + 2] = 0;
              dst[o + 3] = 1;
            }
          }
        }
      }
      const clippedFan: ClipVertex[] = clipTriangle(shells[0] as ClipVertex, shells[1] as ClipVertex, shells[2] as ClipVertex);
      if (clippedFan.length < 3) {
        continue;
      }
      for (let fanIdx = 1; fanIdx < clippedFan.length - 1; fanIdx++) {
        const sv0 = mapClipToScreen(clippedFan[0] as ClipVertex, pipelineState);
        const sv1 = mapClipToScreen(clippedFan[fanIdx] as ClipVertex, pipelineState);
        const sv2 = mapClipToScreen(clippedFan[fanIdx + 1] as ClipVertex, pipelineState);
        rasterizeTriangle(sv0, sv1, sv2, pipelineState, this.drawingBuffer);
      }
    }
  }

  /**
   * Read a uniform slot for the vertex/fragment interpreter host.
   *
   * Args:
   *   linked: Linked program owning the uniform store.
   *   slot: Per-kind slot assigned at link time.
   *
   * Returns:
   *   Scalar number for single values, otherwise a view into the matching store.
   */
  private readDrawUniform(linked: LinkedProgram, slot: number): number | Float32Array | Int32Array | Uint32Array {
    const info = linked.activeUniforms.find((u) => u.slot === slot) ?? null;
    if (info === null) return 0;
    const width = uniformElementWidth(info.type) * Math.max(info.size, 1);
    if (info.typeKind === 'int' || info.typeKind === 'sampler') {
      if (width <= 1) return linked.uniformStore.i32[slot] as number;
      return linked.uniformStore.i32.subarray(slot, slot + width);
    }
    if (info.typeKind === 'uint') {
      if (width <= 1) return linked.uniformStore.u32[slot] as number;
      return linked.uniformStore.u32.subarray(slot, slot + width);
    }
    if (width <= 1) return linked.uniformStore.f32[slot] as number;
    return linked.uniformStore.f32.subarray(slot, slot + width);
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

  // ---- Sprint 5 Task 3: buffer facade + vertex attribute API ----

  /** Create a buffer via BufferManager. */
  createBuffer(): BufferObject | null {
    return this.bufferManager.createBuffer();
  }

  /** Delete a buffer via BufferManager. */
  deleteBuffer(buffer: BufferObject | null): void {
    this.bufferManager.deleteBuffer(buffer);
  }

  /** True iff buffer is a live managed buffer. */
  isBuffer(buffer: unknown): boolean {
    return this.bufferManager.isBuffer(buffer);
  }

  /** Bind a buffer via BufferManager. */
  bindBuffer(target: number, buffer: BufferObject | null): void {
    this.bufferManager.bindBuffer(target as GLenum, buffer);
  }

  /** Allocate/fill bound buffer storage via BufferManager. */
  bufferData(target: number, dataOrSize: number | ArrayBufferView | ArrayBuffer | null, usage: number): void {
    this.bufferManager.bufferData(target as GLenum, dataOrSize, usage as GLenum);
  }

  /** Update a sub-range of bound buffer storage via BufferManager. */
  bufferSubData(target: number, offset: number, data: ArrayBufferView | ArrayBuffer): void {
    this.bufferManager.bufferSubData(target as GLenum, offset, data);
  }

  /** Query bound buffer parameter via BufferManager. */
  getBufferParameter(target: number, pname: number): number | GLenum | null {
    return this.bufferManager.getBufferParameter(target as GLenum, pname as GLenum);
  }

  /** Create a texture via TextureManager. */
  createTexture(): TextureObject | null {
    return this.textureManager.createTexture();
  }

  /** Delete a texture via TextureManager. */
  deleteTexture(texture: TextureObject | null): void {
    this.textureManager.deleteTexture(texture);
  }

  /** True iff texture is a live managed texture. */
  isTexture(texture: unknown): boolean {
    return this.textureManager.isTexture(texture);
  }

  /** Bind a texture via TextureManager. */
  bindTexture(target: number, texture: TextureObject | null): void {
    this.textureManager.bindTexture(target as GLenum, texture);
  }

  /** Set the active texture unit via TextureManager. */
  activeTexture(unit: number): void {
    this.textureManager.setActiveTexture(unit as GLenum);
  }

  /** Specify a texture image via TextureManager. */
  texImage2D(target: number, level: number, internalformat: number, width: number, height: number, border: number, format: number, type: number, pixels?: ArrayBufferView | null): void {
    this.textureManager.texImage2D(target as GLenum, level, internalformat as GLenum, width, height, border, format as GLenum, type as GLenum, pixels ?? null);
  }

  /** Update a texture sub-image via TextureManager. */
  texSubImage2D(target: number, level: number, xoffset: number, yoffset: number, width: number, height: number, format: number, type: number, pixels: ArrayBufferView | null): void {
    this.textureManager.texSubImage2D(target as GLenum, level, xoffset, yoffset, width, height, format as GLenum, type as GLenum, pixels);
  }

  /** Copy drawing buffer rect into texture via TextureManager. */
  copyTexImage2D(target: number, level: number, internalformat: number, x: number, y: number, width: number, height: number, border: number): void {
    this.textureManager.copyTexImage2D(target as GLenum, level, internalformat as GLenum, x, y, width, height, border, this.drawingBuffer);
  }

  /** Set integer texture parameter via TextureManager. */
  texParameteri(target: number, pname: number, param: number): void {
    this.textureManager.texParameteri(target as GLenum, pname as GLenum, param);
  }

  /** Set float texture parameter via TextureManager. */
  texParameterf(target: number, pname: number, param: number): void {
    this.textureManager.texParameterf(target as GLenum, pname as GLenum, param);
  }

  /** Query texture parameter via TextureManager. */
  getTexParameter(target: number, pname: number): number | GLenum | null {
    return this.textureManager.getTexParameter(target as GLenum, pname as GLenum);
  }

  /** Return the vertex attribute descriptor for index (delegates to GLState). */
  getVertexAttribDescriptor(index: number): Readonly<VertexAttribDescriptor> | null {
    return this.glState.getVertexAttrib(index);
  }

  /**
   * Set a vertex attribute pointer with strict WebGL 1.0 validation.
   * Validates everything before any mutation (atomic).
   */
  vertexAttribPointer(index: number, size: number, type: number, normalized: boolean, stride: number, offset: number): void {
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isInteger(size) || size < 1 || size > 4) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (type !== BYTE && type !== UNSIGNED_BYTE && type !== SHORT && type !== UNSIGNED_SHORT && type !== FIXED && type !== FLOAT) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    let componentSize = 4;
    if (type === BYTE || type === UNSIGNED_BYTE) componentSize = 1;
    else if (type === SHORT || type === UNSIGNED_SHORT) componentSize = 2;
    if (!Number.isFinite(stride) || stride < 0 || stride > 255) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (stride % componentSize !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isFinite(offset) || offset < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (offset % componentSize !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const boundBuffer = this.bufferManager.getBoundBuffer(ARRAY_BUFFER);
    if (boundBuffer === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    this.glState.setVertexAttribPointer(index, size, type as GLenum, normalized, stride, offset, boundBuffer);
  }

  /** Enable a vertex attribute array; out-of-range records INVALID_VALUE. */
  enableVertexAttribArray(index: number): void {
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.enableVertexAttribArray(index);
  }

  /** Disable a vertex attribute array; out-of-range records INVALID_VALUE. */
  disableVertexAttribArray(index: number): void {
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.disableVertexAttribArray(index);
  }

  /** Set generic attrib to [x, 0, 0, 1]. */
  vertexAttrib1f(index: number, x: number): void {
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.setVertexAttribGeneric(index, [x, 0, 0, 1]);
  }

  /** Set generic attrib to [x, y, 0, 1]. */
  vertexAttrib2f(index: number, x: number, y: number): void {
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.setVertexAttribGeneric(index, [x, y, 0, 1]);
  }

  /** Set generic attrib to [x, y, z, 1]. */
  vertexAttrib3f(index: number, x: number, y: number, z: number): void {
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.setVertexAttribGeneric(index, [x, y, z, 1]);
  }

  /** Set generic attrib to [x, y, z, w]. */
  vertexAttrib4f(index: number, x: number, y: number, z: number, w: number): void {
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.setVertexAttribGeneric(index, [x, y, z, w]);
  }

  /** Vector form of vertexAttrib1f; short arrays record INVALID_VALUE. */
  vertexAttrib1fv(index: number, values: ArrayLike<number>): void {
    if (values === null || values === undefined || values.length < 1) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.vertexAttrib1f(index, values[0] as number);
  }

  /** Vector form of vertexAttrib2f; short arrays record INVALID_VALUE. */
  vertexAttrib2fv(index: number, values: ArrayLike<number>): void {
    if (values === null || values === undefined || values.length < 2) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.vertexAttrib2f(index, values[0] as number, values[1] as number);
  }

  /** Vector form of vertexAttrib3f; short arrays record INVALID_VALUE. */
  vertexAttrib3fv(index: number, values: ArrayLike<number>): void {
    if (values === null || values === undefined || values.length < 3) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.vertexAttrib3f(index, values[0] as number, values[1] as number, values[2] as number);
  }

  /** Vector form of vertexAttrib4f; short arrays record INVALID_VALUE. */
  vertexAttrib4fv(index: number, values: ArrayLike<number>): void {
    if (values === null || values === undefined || values.length < 4) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.vertexAttrib4f(index, values[0] as number, values[1] as number, values[2] as number, values[3] as number);
  }

  // ---- Sprint 4 Task 6: shader/program/uniform-setter surface (additive) ----

  /** Create a shader of the given type; invalid type records INVALID_ENUM and returns null. */
  createShader(type: number): WebGLShader | null {
    if (this.errorSink.isContextLost()) return null;
    if (type !== VERTEX_SHADER && type !== FRAGMENT_SHADER) {
      this.errorSink.recordError(INVALID_ENUM);
      return null;
    }
    const shader = new WebGLShader(this.nextShaderId++, type as GLenum);
    this.shaders.set(shader.id, shader);
    return shader;
  }

  /** Set shader source; invalid shader records INVALID_OPERATION. */
  shaderSource(shader: WebGLShader | null, source: string): void {
    if (this.errorSink.isContextLost()) return;
    if (!this.isAliveShader(shader)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    (shader as WebGLShader).source = String(source);
  }

  /** Drive tokenize->preprocess->parse->check; failures set COMPILE_STATUS false + ERROR: 0: log, no GL error. */
  compileShader(shader: WebGLShader | null): void {
    if (this.errorSink.isContextLost()) return;
    if (!this.isAliveShader(shader)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const sh = shader as WebGLShader;
    const source = sh.source;
    const version = source.startsWith('#version 300 es') ? 300 : 100;
    let stage: 'vertex' | 'fragment';
    if (sh.type === VERTEX_SHADER) stage = 'vertex';
    else if (sh.type === FRAGMENT_SHADER) stage = 'fragment';
    else {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const tres = tokenize(source, version);
    if (!tres.ok) {
      sh.compiled = false;
      sh.infoLog = tres.log;
      sh.checked = null;
      return;
    }
    const pres = runPreprocessor(tres.tokens, version);
    if (!pres.ok) {
      sh.compiled = false;
      sh.infoLog = pres.log;
      sh.checked = null;
      return;
    }
    const pares = parse(pres.tokens, version);
    if (!pares.ok) {
      sh.compiled = false;
      sh.infoLog = pares.log;
      sh.checked = null;
      return;
    }
    const cres = check(pares.tokens, stage, version);
    if (!cres.ok) {
      sh.compiled = false;
      sh.infoLog = cres.log;
      sh.checked = null;
      return;
    }
    registerCheckedAST(cres.tokens, pares.tokens);
    sh.compiled = true;
    sh.infoLog = '';
    sh.checked = cres.tokens;
  }

  /** Query shader parameter (COMPILE_STATUS/SHADER_TYPE/DELETE_STATUS). */
  getShaderParameter(shader: WebGLShader | null, pname: number): unknown {
    if (this.errorSink.isContextLost()) return null;
    if (!this.isKnownShader(shader)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const sh = shader as WebGLShader;
    if (pname === COMPILE_STATUS) return sh.compiled;
    if (pname === SHADER_TYPE) return sh.type;
    if (pname === DELETE_STATUS) return sh.deleteStatus;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  /** Return shader info log; unknown shader records INVALID_OPERATION. */
  getShaderInfoLog(shader: WebGLShader | null): string {
    if (this.errorSink.isContextLost()) return '';
    if (!this.isKnownShader(shader)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return '';
    }
    return (shader as WebGLShader).infoLog;
  }

  /** Flag shader for deferred deletion. */
  deleteShader(shader: WebGLShader | null): void {
    if (this.errorSink.isContextLost()) return;
    if (shader === null || shader === undefined) return;
    const known = this.shaders.get((shader as WebGLShader).id);
    if (known !== shader) return;
    shader.deleteStatus = true;
    shader.alive = false;
  }

  /** True iff shader is a known, alive shader object. */
  isShader(shader: unknown): boolean {
    if (this.errorSink.isContextLost()) return false;
    return this.isAliveShader(shader as WebGLShader | null);
  }

  /** Create a program handle. */
  createProgram(): WebGLProgram | null {
    if (this.errorSink.isContextLost()) return null;
    const handle = this.programRegistry.createProgram();
    const program = new WebGLProgram(handle.id, handle);
    this.programs.set(program.id, program);
    return program;
  }

  /** Attach a shader; invalid handles record INVALID_OPERATION. */
  attachShader(program: WebGLProgram | null, shader: WebGLShader | null): void {
    if (this.errorSink.isContextLost()) return;
    if (!this.isAliveProgram(program) || !this.isAliveShader(shader)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const ok = this.programRegistry.attachShader(
      (program as WebGLProgram).handle,
      shader as unknown as Parameters<ProgramRegistry['attachShader']>[1],
    );
    if (!ok) this.errorSink.recordError(INVALID_OPERATION);
  }

  /** Detach a shader; invalid handles record INVALID_OPERATION. */
  detachShader(program: WebGLProgram | null, shader: WebGLShader | null): void {
    if (this.errorSink.isContextLost()) return;
    if (!this.isAliveProgram(program) || !this.isKnownShader(shader)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    this.programRegistry.detachShader(
      (program as WebGLProgram).handle,
      shader as unknown as Parameters<ProgramRegistry['detachShader']>[1],
    );
  }

  /** Link attached compiled shaders; missing/uncompiled records INVALID_OPERATION, cross-stage failure sets log only. */
  linkProgram(program: WebGLProgram | null): void {
    if (this.errorSink.isContextLost()) return;
    if (!this.isAliveProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const prog = program as WebGLProgram;
    const attached = [...prog.handle.attachedShaders] as unknown as WebGLShader[];
    const vs = attached.find((s) => s.type === VERTEX_SHADER) ?? null;
    const fs = attached.find((s) => s.type === FRAGMENT_SHADER) ?? null;
    if (vs === null || fs === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      prog.handle.linkStatus = false;
      prog.handle.infoLog = 'ERROR: 0:1: Program requires both an attached vertex shader and fragment shader';
      return;
    }
    if (!vs.compiled || !fs.compiled || vs.checked === null || fs.checked === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      prog.handle.linkStatus = false;
      prog.handle.infoLog = 'ERROR: 0:1: Attached shaders must be compiled before linking';
      return;
    }
    // Facade-level cross-stage varying check (AC-3): the frozen checker records
    // ES 1.00 fragment `varying` declarations in declaredOutputs (not
    // declaredInputs), which link() never inspects — so an FS-consumed varying
    // with no VS writer would link clean. Validate here; info log is the
    // diagnostic channel (no GL error).
    const vsWritten = new Set((vs.checked.declaredOutputs ?? []).map((o) => o.name));
    const fsConsumed = [
      ...(fs.checked.declaredInputs ?? []),
      ...(fs.checked.declaredOutputs ?? []).filter((o) => o.storage === 'varying'),
    ];
    const unwritten = fsConsumed.find((v) => !vsWritten.has(v.name));
    if (unwritten !== undefined) {
      prog.handle.linkStatus = false;
      prog.handle.infoLog =
        "ERROR: 0:1: Varying '" + unwritten.name + "' is consumed by fragment shader but never written by vertex shader";
      return;
    }
    const result = link(vs.checked, fs.checked, prog.handle.boundAttribLocations);
    if (!result.ok) {
      prog.handle.linkStatus = false;
      prog.handle.infoLog = result.log;
      return;
    }
    prog.handle.linkedProgram = result.program ?? null;
    prog.handle.linkStatus = true;
    prog.handle.infoLog = '';
  }

  /** Query program parameter (LINK_STATUS/VALIDATE_STATUS/DELETE_STATUS/ATTACHED_SHADERS/ACTIVE_UNIFORMS/ACTIVE_ATTRIBUTES). */
  getProgramParameter(program: WebGLProgram | null, pname: number): unknown {
    if (this.errorSink.isContextLost()) return null;
    if (!this.isKnownProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const prog = program as WebGLProgram;
    if (pname === LINK_STATUS) return prog.handle.linkStatus;
    if (pname === VALIDATE_STATUS) return prog.handle.linkStatus;
    if (pname === DELETE_STATUS) return prog.deleteStatus;
    if (pname === ATTACHED_SHADERS) return prog.handle.attachedShaders.size;
    if (pname === ACTIVE_UNIFORMS) return prog.handle.linkedProgram?.activeUniforms.length ?? 0;
    if (pname === ACTIVE_ATTRIBUTES) return prog.handle.linkedProgram?.activeAttribs.length ?? 0;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  /** Return program info log. */
  getProgramInfoLog(program: WebGLProgram | null): string {
    if (this.errorSink.isContextLost()) return '';
    if (!this.isKnownProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return '';
    }
    return (program as WebGLProgram).handle.infoLog;
  }

  /** Install a linked program; null detaches. Unlinked/dead records INVALID_OPERATION. */
  useProgram(program: WebGLProgram | null): void {
    if (this.errorSink.isContextLost()) return;
    if (program === null) {
      this.currentProgram = null;
      return;
    }
    if (!this.isAliveProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const prog = program as WebGLProgram;
    if (!prog.handle.linkStatus || prog.handle.linkedProgram === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    this.currentProgram = prog;
  }

  /** Flag program for deferred deletion; stays bound until replaced. */
  deleteProgram(program: WebGLProgram | null): void {
    if (this.errorSink.isContextLost()) return;
    if (program === null || program === undefined) return;
    const known = this.programs.get((program as WebGLProgram).id);
    if (known !== program) return;
    (program as WebGLProgram).deleteStatus = true;
    this.programRegistry.deleteProgram((program as WebGLProgram).handle);
  }

  /** True iff program is a known, alive program object. */
  isProgram(program: unknown): boolean {
    if (this.errorSink.isContextLost()) return false;
    return this.isAliveProgram(program as WebGLProgram | null);
  }

  /** Return attached shaders array. */
  getAttachedShaders(program: WebGLProgram | null): WebGLShader[] | null {
    if (this.errorSink.isContextLost()) return null;
    if (!this.isKnownProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    return [...(program as WebGLProgram).handle.attachedShaders] as unknown as WebGLShader[];
  }

  /** Return location of a uniform, or null if inactive/unknown/unlinked. */
  getUniformLocation(program: WebGLProgram | null, name: string): WebGLUniformLocation | null {
    if (this.errorSink.isContextLost()) return null;
    if (!this.isAliveProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const prog = program as WebGLProgram;
    if (!prog.handle.linkStatus || prog.handle.linkedProgram === null) return null;
    let base = String(name);
    if (base.endsWith('[0]')) base = base.slice(0, -3);
    const found = prog.handle.linkedProgram.activeUniforms.find((u) => u.name === base || u.name === name);
    if (found === undefined) return null;
    return new WebGLUniformLocation(prog.id, found.location, found.name);
  }

  /** Return active uniform info by index, or null. */
  getActiveUniform(program: WebGLProgram | null, index: number): WebGLActiveInfo | null {
    if (this.errorSink.isContextLost()) return null;
    if (!this.isKnownProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const prog = program as WebGLProgram;
    const list = prog.handle.linkedProgram?.activeUniforms;
    if (list === undefined || list === null) return null;
    if (!Number.isInteger(index) || index < 0 || index >= list.length) return null;
    const u = list[index] as ActiveUniformInfo;
    return new WebGLActiveInfo(u.name, u.size, u.type);
  }

  /** Return active attrib info by index, or null. */
  getActiveAttrib(program: WebGLProgram | null, index: number): WebGLActiveInfo | null {
    if (this.errorSink.isContextLost()) return null;
    if (!this.isKnownProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const prog = program as WebGLProgram;
    const list = prog.handle.linkedProgram?.activeAttribs;
    if (list === undefined || list === null) return null;
    if (!Number.isInteger(index) || index < 0 || index >= list.length) return null;
    const a = list[index] as { name: string; size: number; type: number };
    return new WebGLActiveInfo(a.name, a.size, a.type);
  }

  /** Bind an attrib name to an index pre-link; out-of-range records INVALID_VALUE, gl_ prefix INVALID_OPERATION. */
  bindAttribLocation(program: WebGLProgram | null, index: number, name: string): void {
    if (this.errorSink.isContextLost()) return;
    if (!this.isAliveProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (String(name).startsWith('gl_')) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    (program as WebGLProgram).handle.boundAttribLocations.set(String(name), index);
  }

  /** Return bound attrib location, or -1 if unknown. */
  getAttribLocation(program: WebGLProgram | null, name: string): number {
    if (this.errorSink.isContextLost()) return -1;
    if (!this.isAliveProgram(program)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return -1;
    }
    const prog = program as WebGLProgram;
    if (!prog.handle.linkStatus || prog.handle.linkedProgram === null) return -1;
    const found = prog.handle.linkedProgram.activeAttribs.find((a) => a.name === String(name));
    return found?.location ?? -1;
  }

  public uniform1f(location: WebGLUniformLocation | null, x: number): void {
    this.writeFloatUniform(location, 1, [x]);
  }

  public uniform2f(location: WebGLUniformLocation | null, x: number, y: number): void {
    this.writeFloatUniform(location, 2, [x, y]);
  }

  public uniform3f(location: WebGLUniformLocation | null, x: number, y: number, z: number): void {
    this.writeFloatUniform(location, 3, [x, y, z]);
  }

  public uniform4f(location: WebGLUniformLocation | null, x: number, y: number, z: number, w: number): void {
    this.writeFloatUniform(location, 4, [x, y, z, w]);
  }

  public uniform1i(location: WebGLUniformLocation | null, x: number): void {
    this.writeIntUniform(location, 1, [x]);
  }

  public uniform2i(location: WebGLUniformLocation | null, x: number, y: number): void {
    this.writeIntUniform(location, 2, [x, y]);
  }

  public uniform3i(location: WebGLUniformLocation | null, x: number, y: number, z: number): void {
    this.writeIntUniform(location, 3, [x, y, z]);
  }

  public uniform4i(location: WebGLUniformLocation | null, x: number, y: number, z: number, w: number): void {
    this.writeIntUniform(location, 4, [x, y, z, w]);
  }

  public uniform1fv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeFloatUniform(location, 1, v);
  }

  public uniform2fv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeFloatUniform(location, 2, v);
  }

  public uniform3fv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeFloatUniform(location, 3, v);
  }

  public uniform4fv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeFloatUniform(location, 4, v);
  }

  public uniform1iv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeIntUniform(location, 1, v);
  }

  public uniform2iv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeIntUniform(location, 2, v);
  }

  public uniform3iv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeIntUniform(location, 3, v);
  }

  public uniform4iv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeIntUniform(location, 4, v);
  }

  public uniformMatrix2fv(location: WebGLUniformLocation | null, transpose: boolean, value: ArrayLike<number>): void {
    this.writeMatrixUniform(location, transpose, value, 4);
  }

  public uniformMatrix3fv(location: WebGLUniformLocation | null, transpose: boolean, value: ArrayLike<number>): void {
    this.writeMatrixUniform(location, transpose, value, 9);
  }

  public uniformMatrix4fv(location: WebGLUniformLocation | null, transpose: boolean, value: ArrayLike<number>): void {
    this.writeMatrixUniform(location, transpose, value, 16);
  }

  private isKnownShader(shader: WebGLShader | null | undefined): shader is WebGLShader {
    if (shader === null || shader === undefined) return false;
    return this.shaders.get((shader as WebGLShader).id) === shader;
  }

  private isAliveShader(shader: WebGLShader | null | undefined): shader is WebGLShader {
    if (!this.isKnownShader(shader)) return false;
    return (shader as WebGLShader).alive;
  }

  private isKnownProgram(program: WebGLProgram | null | undefined): program is WebGLProgram {
    if (program === null || program === undefined) return false;
    return this.programs.get((program as WebGLProgram).id) === program;
  }

  private isAliveProgram(program: WebGLProgram | null | undefined): program is WebGLProgram {
    if (!this.isKnownProgram(program)) return false;
    return (program as WebGLProgram).handle.alive;
  }

  private validateUniform(
    location: WebGLUniformLocation | null,
    components: number,
    rawValues: ArrayLike<number>,
    expectedKind: 'float' | 'int_or_sampler' | 'matrix_float',
    transpose?: boolean,
  ): { values: number[]; uniform: ActiveUniformInfo; linkedProgram: LinkedProgram } | null {
    if (this.errorSink.isContextLost()) return null;
    if (location === null || location === undefined) return null;
    if (expectedKind === 'matrix_float' && transpose !== false) {
      this.errorSink.recordError(INVALID_VALUE);
      return null;
    }
    let values: number[];
    try {
      values = Array.from(rawValues as ArrayLike<number>);
    } catch {
      this.errorSink.recordError(INVALID_VALUE);
      return null;
    }
    const uniform = this.resolveUniform(location);
    if (uniform === null) return null;
    if (expectedKind === 'float' || expectedKind === 'matrix_float') {
      if (uniform.typeKind !== 'float') {
        this.errorSink.recordError(INVALID_OPERATION);
        return null;
      }
    } else {
      if (uniform.typeKind !== 'int' && uniform.typeKind !== 'sampler' && uniform.typeKind !== 'uint') {
        this.errorSink.recordError(INVALID_OPERATION);
        return null;
      }
    }
    if (values.length === 0 || values.length % components !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return null;
    }
    if (values.length > uniform.size * components) {
      this.errorSink.recordError(INVALID_VALUE);
      return null;
    }
    const linkedProgram = (this.currentProgram as WebGLProgram).handle.linkedProgram;
    if (linkedProgram === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    return { values, uniform, linkedProgram };
  }

  private resolveUniform(location: WebGLUniformLocation | null): ActiveUniformInfo | null {
    if (this.currentProgram === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    if (location === null || location === undefined || !(location instanceof WebGLUniformLocation)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    if (location.programId !== this.currentProgram.id) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const linked = this.currentProgram.handle.linkedProgram;
    if (linked === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const found = linked.activeUniforms.find((u) => u.location === location.location) ?? null;
    if (found === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    return found;
  }

  private writeFloatUniform(location: WebGLUniformLocation | null, components: number, v: ArrayLike<number>): void {
    const validated = this.validateUniform(location, components, v, 'float');
    if (validated === null) return;
    for (let i = 0; i < validated.values.length; i++) {
      validated.linkedProgram.uniformStore.f32[validated.uniform.slot + i] = validated.values[i] as number;
    }
  }

  private writeIntUniform(location: WebGLUniformLocation | null, components: number, v: ArrayLike<number>): void {
    const validated = this.validateUniform(location, components, v, 'int_or_sampler');
    if (validated === null) return;
    const ints = validated.values.map((n) => Math.trunc(Number(n)));
    if (validated.uniform.typeKind === 'uint') {
      for (let i = 0; i < ints.length; i++) validated.linkedProgram.uniformStore.u32[validated.uniform.slot + i] = ints[i] as number;
    } else if (validated.uniform.typeKind === 'sampler') {
      for (let i = 0; i < ints.length; i++) validated.linkedProgram.uniformStore.samplerUnits[validated.uniform.slot + i] = ints[i] as number;
    } else {
      for (let i = 0; i < ints.length; i++) validated.linkedProgram.uniformStore.i32[validated.uniform.slot + i] = ints[i] as number;
    }
  }

  private writeMatrixUniform(
    location: WebGLUniformLocation | null,
    transpose: boolean,
    value: ArrayLike<number>,
    components: number,
  ): void {
    const validated = this.validateUniform(location, components, value, 'matrix_float', transpose);
    if (validated === null) return;
    for (let i = 0; i < validated.values.length; i++) {
      validated.linkedProgram.uniformStore.f32[validated.uniform.slot + i] = validated.values[i] as number;
    }
  }
}

function uniformElementWidth(type: GLenum): number {
  if (type === FLOAT_VEC2 || type === INT_VEC2 || type === UNSIGNED_INT_VEC2 || type === BOOL_VEC2) return 2;
  if (type === FLOAT_VEC3 || type === INT_VEC3 || type === UNSIGNED_INT_VEC3 || type === BOOL_VEC3) return 3;
  if (type === FLOAT_VEC4 || type === INT_VEC4 || type === UNSIGNED_INT_VEC4 || type === BOOL_VEC4) return 4;
  if (type === FLOAT_MAT2) return 4;
  if (type === FLOAT_MAT3) return 9;
  if (type === FLOAT_MAT4) return 16;
  return 1;
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
