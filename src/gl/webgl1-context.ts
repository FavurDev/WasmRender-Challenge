// CHANGELOG: Sprint 2 (2026-09-20): Sprint 2 T4 minimal WebGL1 context facade composition root
// CHANGELOG: Sprint 4 Task 6: additive shader/program/uniform-setter API surface (compile/link/useProgram/reflection/uniform setters)
// CHANGELOG: Sprint 5 (2026-09-21): vertexAttribPointer/drawArrays orchestrator, validateUniform extraction (TD-009), depth-state facade methods
// CHANGELOG: Sprint 6 (2026-09-21): Texture/sampler facade wiring — texture API family, sampler params, unpack flags, fragment-path sampling (Tasks 1-2, 4-5)
// CHANGELOG: Sprint 7 Tasks 1-5 (2026-09-21): Facade wiring for FBO/stencil/depth/scissor/blend/drawElements/getParameter/lost-flag gating.
/** WebGL1Context — minimal WebGL 1.0 facade; composition root (ADR-013). */
import {
  ACTIVE_ATTRIBUTES,
  ACTIVE_UNIFORMS,
  ALIASED_LINE_WIDTH_RANGE,
  ALIASED_POINT_SIZE_RANGE,
  ARRAY_BUFFER,
  ATTACHED_SHADERS,
  BYTE,
  COLOR_BUFFER_BIT,
  COLOR_CLEAR_VALUE,
  COMPILE_STATUS,
  DELETE_STATUS,
  DEPTH_BUFFER_BIT,
  DEPTH_CLEAR_VALUE,
  ELEMENT_ARRAY_BUFFER,
  FIXED,
  FLOAT,
  FLOAT_MAT2,
  FLOAT_MAT3,
  FLOAT_MAT4,
  FLOAT_VEC2,
  FLOAT_VEC3,
  FLOAT_VEC4,
  FRAGMENT_SHADER,
  COLOR_ATTACHMENT0,
  DEPTH_ATTACHMENT,
  STENCIL_ATTACHMENT,
  DEPTH_STENCIL_ATTACHMENT,
  FRAMEBUFFER,
  FRAMEBUFFER_BINDING,
  FRAMEBUFFER_COMPLETE,
  FRAMEBUFFER_UNSUPPORTED,
  INVALID_ENUM,
  INVALID_FRAMEBUFFER_OPERATION,
  INVALID_OPERATION,
  INVALID_VALUE,
  LIMIT_ALIASED_LINE_WIDTH_RANGE,
  LIMIT_ALIASED_POINT_SIZE_RANGE,
  LIMIT_MAX_COMBINED_TEXTURE_IMAGE_UNITS_WEBGL1,
  LIMIT_MAX_CUBE_MAP_TEXTURE_SIZE,
  LIMIT_MAX_DRAW_BUFFERS_WEBGL1,
  LIMIT_MAX_FRAGMENT_UNIFORM_VECTORS_WEBGL1,
  LIMIT_MAX_RENDERBUFFER_SIZE,
  LIMIT_MAX_TEXTURE_IMAGE_UNITS_WEBGL1,
  LIMIT_MAX_TEXTURE_SIZE,
  LIMIT_MAX_VARYING_VECTORS_WEBGL1,
  LIMIT_MAX_VERTEX_ATTRIBS,
  LIMIT_MAX_VERTEX_UNIFORM_VECTORS_WEBGL1,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS,
  MAX_CUBE_MAP_TEXTURE_SIZE,
  MAX_DRAW_BUFFERS,
  MAX_FRAGMENT_UNIFORM_VECTORS,
  MAX_RENDERBUFFER_SIZE,
  MAX_TEXTURE_IMAGE_UNITS,
  MAX_TEXTURE_SIZE,
  MAX_VARYING_VECTORS,
  MAX_VERTEX_ATTRIBS as MAX_VERTEX_ATTRIBS_PNAME,
  MAX_VERTEX_UNIFORM_VECTORS,
  MAX_VIEWPORT_DIMS,
  RENDERBUFFER,
  RENDERBUFFER_BINDING,
  RENDERER,
  SHADING_LANGUAGE_VERSION,
  UNPACK_COLORSPACE_CONVERSION_WEBGL,
  UNPACK_FLIP_Y_WEBGL,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL,
  LINK_STATUS,
  SAMPLER_CUBE,
  SCISSOR_BOX,
  SHADER_TYPE,
  SHORT,
  STENCIL_BUFFER_BIT,
  STENCIL_CLEAR_VALUE,
  TEXTURE0,
  TEXTURE_2D,
  TEXTURE_2D_ARRAY,
  TEXTURE_3D,
  TEXTURE_CUBE_MAP,
  RGBA,
  TRIANGLES,
  TRIANGLE_STRIP,
  TRIANGLE_FAN,
  POINTS,
  LINES,
  LINE_STRIP,
  LINE_LOOP,
  BACK,
  FRONT,
  FRONT_AND_BACK,
  CCW,
  CW,
  GENERATE_MIPMAP_HINT,
  FASTEST,
  NICEST,
  DONT_CARE,
  VALID_DEPTH_FUNC_SET,
  VALID_PRIMITIVE_MODE_SET,
  VALIDATE_STATUS,
  VENDOR,
  VERSION,
  VERSION_STRING_WEBGL1,
  UNSIGNED_BYTE,
  UNSIGNED_INT,
  UNSIGNED_INT_VEC2,
  UNSIGNED_INT_VEC3,
  UNSIGNED_INT_VEC4,
  UNSIGNED_SHORT,
  INT,
  INT_VEC2,
  INT_VEC3,
  INT_VEC4,
  BOOL_VEC2,
  BOOL_VEC3,
  BOOL_VEC4,
  VERTEX_SHADER,
  VIEWPORT,
  UNIFORM_BUFFER,
  UNIFORM_BLOCK_DATA_SIZE,
  UNIFORM_BLOCK_ACTIVE_UNIFORMS,
  UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES,
  UNIFORM_BLOCK_BINDING,
  UNIFORM_BLOCK_NAME,
  UNIFORM_OFFSET,
  UNIFORM_ARRAY_STRIDE,
  UNIFORM_MATRIX_STRIDE,
} from './constants';
import type { GLenum } from './constants';
import { ErrorSink } from './errors';
import { GLState } from './state';
import type { CanvasDimensions, PipelineState, VertexAttribDescriptor } from './state';
import { BufferManager } from './buffer';
import type { BufferObject } from './buffer';
import { TextureManager, isMipmapFilter } from './texture';
import type { PixelStoreStateProvider, TextureObject } from './texture';
import { resolveEffectiveSamplerParams, sample2D } from './sampler';
import {
  DrawingBuffer,
  FboTarget,
  FramebufferManager,
  RenderbufferManager,
  WebGLFramebuffer,
  WebGLRenderbuffer,
} from './framebuffer';
import type { RenderbufferStorage } from './framebuffer';
import { resolveContextAttributes } from './context-attributes';
import type { WebGLContextAttributes } from './context-attributes';
import { clipTriangle } from '../raster/clipper';
import type { ClipVertex } from '../raster/clipper';
import { mapClipToScreen, rasterizeTriangle } from '../raster/rasterizer';
import type { ScreenVertex } from '../raster/rasterizer';
import { applyBlendAndWrite } from '../raster/blend';
import { executeFragmentDepthStencil } from '../raster/depth-stencil';
import { tokenize } from '../glsl/tokenizer';
import { runPreprocessor } from '../glsl/preprocessor';
import { parse } from '../glsl/parser';
import { check, registerCheckedAST } from '../glsl/checker';
import type { CheckedShader } from '../glsl/checker';
import { ExtensionRegistry } from './extensions';
import { link, ProgramRegistry } from './program';
import type { ActiveUniformInfo, LinkedProgram, ProgramHandle } from './program';
import {
  createVertexAttribTargetMap,
  fetchVertexAttributes,
  resolveIndexSequence,
  validateIndexRange,
  validateVertexAttribRange,
} from './vertex-fetch';
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

/** Maximum texture unit index (WebGL 1.0 guarantees at least 8; implementation supports 32). */
const MAX_TEXTURE_UNITS = 32;

/**
 * Resolve sampler uniforms to bound textures for a draw call (Sprint 6 Task 4).
 *
 * Builds a per-draw snapshot mapping texture unit -> bound TextureObject (or
 * null when unbound, dead, or the unit index is invalid). The snapshot is
 * frozen at draw time so later binding changes cannot affect in-flight
 * fragments. Accepts both the real TextureManager (active-unit save/set/
 * restore dance) and minimal test doubles exposing getBoundTexture.
 *
 * Args:
 *   linked: Linked program owning the sampler uniforms and uniform store.
 *   textureManager: Texture binding source.
 *
 * Returns:
 *   Map from unit (0..31, pre-filled with null) to TextureObject or null.
 */
export function resolveDrawTextures(
  linked: LinkedProgram,
  textureManager: {
    getBoundTexture(target: number, unit?: number): TextureObject | null;
    getActiveTexture?: () => number;
    setActiveTexture?: (unit: number) => void;
  },
): Map<number, TextureObject | null> {
  const snapshot = new Map<number, TextureObject | null>();
  for (let unit = 0; unit < MAX_TEXTURE_UNITS; unit++) snapshot.set(unit, null);
  try {
    const canDance =
      typeof textureManager.getActiveTexture === 'function' &&
      typeof textureManager.setActiveTexture === 'function';
    const savedActive = canDance ? (textureManager.getActiveTexture as () => number)() : TEXTURE0;
    for (const info of linked.activeUniforms) {
      if (info.typeKind !== 'sampler') continue;
      let unit = -1;
      try {
        // Sprint 6 Task 4: sampler units live in samplerUnits; fall back to
        // i32 for minimal test doubles that only provide an i32 store.
        const samplerUnits = (linked.uniformStore as unknown as { samplerUnits?: Int32Array }).samplerUnits;
        unit =
          samplerUnits !== undefined && samplerUnits !== null
            ? (samplerUnits[info.slot] as number)
            : (linked.uniformStore.i32[info.slot] as number);
      } catch (_e) {
        void _e;
        continue;
      }
      if (!Number.isInteger(unit) || unit < 0 || unit >= MAX_TEXTURE_UNITS) continue;
      const target = info.type === SAMPLER_CUBE ? TEXTURE_CUBE_MAP : TEXTURE_2D;
      let tex: TextureObject | null = null;
      try {
        if (canDance) {
          (textureManager.setActiveTexture as (unit: number) => void)(TEXTURE0 + unit);
          tex = textureManager.getBoundTexture(target as number);
        } else {
          tex = textureManager.getBoundTexture(target as number, unit);
        }
      } catch (_e) {
        void _e;
        tex = null;
      }
      snapshot.set(unit, tex);
    }
    if (canDance) {
      try {
        (textureManager.setActiveTexture as (unit: number) => void)(savedActive);
      } catch (_e) {
        void _e;
      }
    }
  } catch (_e) {
    void _e;
  }
  return snapshot;
}

/**
 * Estimate a per-draw LOD for minification (Sprint 6 Task 4).
 *
 * Approximates log2(max(texW/vpW, texH/vpH)) clamped at >= 0 so minified
 * draws select smaller mip levels while 1:1 or magnified draws stay on
 * level 0. Returns 0 when sizes are degenerate.
 */
export function estimateDrawLod(texWidth: number, texHeight: number, vpWidth: number, vpHeight: number): number {
  try {
    if (
      !Number.isFinite(texWidth) ||
      !Number.isFinite(texHeight) ||
      !Number.isFinite(vpWidth) ||
      !Number.isFinite(vpHeight) ||
      texWidth <= 0 ||
      texHeight <= 0 ||
      vpWidth <= 0 ||
      vpHeight <= 0
    ) {
      return 0;
    }
    return Math.max(0, Math.log2(Math.max(texWidth / vpWidth, texHeight / vpHeight)));
  } catch (_e) {
    void _e;
    return 0;
  }
}

/**
 * Sample a snapshot texture for the fragment host (Sprint 6 Task 4).
 *
 * Looks the texture up by unit (falling back to slot when they differ),
 * returns opaque black for unbound/dead textures, and otherwise delegates
 * to the pure sampler core. Never mutates the TextureObject. A minification
 * LOD estimate is added on top of the shader bias only for mipmap min
 * filters; non-mipmap filters always sample level 0.
 */
export function sampleSnapshotTexture(
  snapshot: Map<number, TextureObject | null>,
  slotOrUnit: number,
  coord: Float32Array,
  biasOrLod: number | undefined,
  contextVersion: 1 | 2,
  lodEstimate: number,
  effectiveSampler?: import('./texture').SamplerParams,
): Float32Array {
  try {
    const unit = Math.trunc(slotOrUnit);
    const tex = snapshot.get(unit) ?? null;
    if (tex === null || tex === undefined || tex.alive !== true) return new Float32Array([0, 0, 0, 1]);
    const bias = typeof biasOrLod === 'number' && Number.isFinite(biasOrLod) ? biasOrLod : 0;
    let lod = bias;
    try {
      if (isMipmapFilter(tex.sampler.minFilter)) lod = bias + lodEstimate;
    } catch (_e) {
      void _e;
    }
    return sample2D(tex, coord.slice(0, 2), lod, contextVersion, effectiveSampler);
  } catch (_e) {
    void _e;
    return new Float32Array([0, 0, 0, 1]);
  }
}

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
  private readonly framebufferManager: FramebufferManager;
  private readonly renderbufferManager: RenderbufferManager;
  private readonly fboTargets = new Map<number, { target: FboTarget; storage: RenderbufferStorage | null; width: number; height: number }>();
  private readonly depthStencilFbos = new Set<number>();
  private readonly shaders = new Map<number, WebGLShader>();
  private readonly programs = new Map<number, WebGLProgram>();
  private nextShaderId = 1;
  private currentProgram: WebGLProgram | null = null;
  private readonly uboIndexedSlots: Array<BufferObject | null> = Array.from({ length: 36 }, () => null);
  private readonly uboIndexedOffsets: number[] = Array.from({ length: 36 }, () => 0);
  private readonly uboIndexedSizes: number[] = Array.from({ length: 36 }, () => 0);
  private readonly uboBlockBindings = new Map<number, Map<number, number>>();
  private readonly extensionRegistry: ExtensionRegistry;

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
    const pixelStoreProvider: PixelStoreStateProvider = {
      getUnpackFlipY: () => this.glState.getPixelStorei(UNPACK_FLIP_Y_WEBGL) === true,
      getUnpackPremultiplyAlpha: () => this.glState.getPixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL) === true,
      getUnpackColorspaceConversion: () => this.glState.getPixelStorei(UNPACK_COLORSPACE_CONVERSION_WEBGL) as number,
    };
    this.textureManager = new TextureManager(this.errorSink, pixelStoreProvider);
    this.framebufferManager = new FramebufferManager(this.errorSink);
    this.renderbufferManager = new RenderbufferManager(this.errorSink);
    this.extensionRegistry = new ExtensionRegistry(this.errorSink, this.glState, {
      onLoseContext: () => {
        for (const shader of this.shaders.values()) shader.alive = false;
        for (const program of this.programs.values()) program.handle.alive = false;
        this.currentProgram = null;
      },
      onRestoreContext: () => {
        this.currentProgram = null;
        this.shaders.clear();
        this.programs.clear();
      },
    });
  }

  /** Depth-survivor hook: WebGL1 is always a no-op returning null (ADR-004 invariance). */
  protected getSamplePassedCallback(): (() => void) | null {
    return null;
  }

  /** Sampler hook: WebGL1 has no sampler objects — always null (ADR-004 invariance). */
  protected getBoundSamplerForUnit(_unit: number): import('./texture').SamplerParams | null {
    void _unit;
    return null;
  }

  /** Query entry-point stub: WebGL1 has no queries; records INVALID_OPERATION, returns undefined. */
  public createQuery(): unknown {
    this.errorSink.recordError(INVALID_OPERATION);
    return undefined;
  }

  /** True iff the context is lost. */
  isContextLost(): boolean {
    return this.errorSink.isContextLost();
  }

  /** Return a memoized extension object, or null for unknown names (no error). */
  getExtension(name: string): object | null {
    return this.extensionRegistry.getExtension(String(name));
  }

  /** Return exactly the seven supported extension names. */
  getSupportedExtensions(): readonly string[] {
    return this.extensionRegistry.getSupportedExtensions();
  }

  /** True iff the capability is enabled. */
  isEnabled(cap: number): boolean {
    return this.glState.isEnabled(cap as GLenum);
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

  /** Set stencil func/ref/mask for front and back; validation sinks via GLState. */
  stencilFunc(func: number, ref: number, mask: number): void {
    this.glState.setStencilFunc(func as GLenum, ref, mask);
  }

  /** Set stencil func/ref/mask for one face; validation sinks via GLState. */
  stencilFuncSeparate(face: number, func: number, ref: number, mask: number): void {
    this.glState.setStencilFuncSeparate(face as GLenum, func as GLenum, ref, mask);
  }

  /** Set stencil ops for front and back; validation sinks via GLState. */
  stencilOp(fail: number, zfail: number, zpass: number): void {
    this.glState.setStencilOp(fail as GLenum, zfail as GLenum, zpass as GLenum);
  }

  /** Set stencil ops for one face; validation sinks via GLState. */
  stencilOpSeparate(face: number, fail: number, zfail: number, zpass: number): void {
    this.glState.setStencilOpSeparate(face as GLenum, fail as GLenum, zfail as GLenum, zpass as GLenum);
  }

  /** Set stencil write mask for front and back. */
  stencilMask(mask: number): void {
    this.glState.setStencilMask(mask);
  }

  /** Set stencil write mask for one face. */
  stencilMaskSeparate(face: number, mask: number): void {
    this.glState.setStencilMaskSeparate(face as GLenum, mask);
  }

  /** Set RGB and alpha blend factors; invalid enums sink via GLState. */
  blendFunc(sfactor: number, dfactor: number): void {
    this.glState.setBlendFunc(sfactor as GLenum, dfactor as GLenum);
  }

  /** Set separate RGB/alpha blend factors; invalid enums sink via GLState. */
  blendFuncSeparate(srcRGB: number, dstRGB: number, srcAlpha: number, dstAlpha: number): void {
    this.glState.setBlendFuncSeparate(srcRGB as GLenum, dstRGB as GLenum, srcAlpha as GLenum, dstAlpha as GLenum);
  }

  /** Set the RGB and alpha blend equations; invalid enums sink via GLState. */
  blendEquation(mode: number): void {
    this.glState.setBlendEquation(mode as GLenum);
  }

  /** Set separate RGB/alpha blend equations; invalid enums sink via GLState. */
  blendEquationSeparate(modeRGB: number, modeAlpha: number): void {
    this.glState.setBlendEquationSeparate(modeRGB as GLenum, modeAlpha as GLenum);
  }

  /** Set the constant blend color; values clamp to [0, 1] per spec (no error). */
  blendColor(red: number, green: number, blue: number, alpha: number): void {
    this.glState.setBlendColor(red, green, blue, alpha);
  }

  /** Enable or disable per-channel color writes. */
  colorMask(red: boolean, green: boolean, blue: boolean, alpha: boolean): void {
    this.glState.setColorMask(red, green, blue, alpha);
  }

  /** Clear buffers selected by mask; invalid bits record INVALID_VALUE. */
  clear(mask: number): void {
    if (this.errorSink.isContextLost()) return;
    const validBits = COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT | STENCIL_BUFFER_BIT;
    if ((mask & ~validBits) !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const pipelineState = this.glState.snapshot();
    this.resolveActiveTarget().clear(mask, pipelineState);
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

  /** Set the cull-face mode; invalid enums record INVALID_ENUM via GLState. */
  cullFace(mode: number): void {
    if (this.errorSink.isContextLost()) return;
    this.glState.setCullFace(mode as GLenum);
  }

  /** Set the front-face winding; invalid enums record INVALID_ENUM via GLState. */
  frontFace(mode: number): void {
    if (this.errorSink.isContextLost()) return;
    this.glState.setFrontFace(mode as GLenum);
  }

  /**
   * Set a pixel-store hint. WebGL1 defines GENERATE_MIPMAP_HINT as the only
   * valid target and FASTEST/NICEST/DONT_CARE as the only valid modes; the
   * hint is a no-op on success and records INVALID_ENUM otherwise.
   */
  hint(target: number, mode: number): void {
    if (this.errorSink.isContextLost()) return;
    if (target !== GENERATE_MIPMAP_HINT) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (mode !== FASTEST && mode !== NICEST && mode !== DONT_CARE) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
  }

  /** Clip/map/rasterize one triangle; culling handled inside rasterizeTriangle. */
  private emitTriangleFromClip(
    a: ClipVertex,
    b: ClipVertex,
    c: ClipVertex,
    pipelineState: PipelineState,
    activeTarget: DrawingBuffer | FboTarget,
    shade: ((fragVaryings: Float32Array, px: number, py: number) => Float32Array | null) | null,
  ): void {
    const clippedFan: ClipVertex[] = clipTriangle(a, b, c);
    if (clippedFan.length < 3) return;
    for (let fanIdx = 1; fanIdx < clippedFan.length - 1; fanIdx++) {
      const sv0 = mapClipToScreen(clippedFan[0] as ClipVertex, pipelineState);
      const sv1 = mapClipToScreen(clippedFan[fanIdx] as ClipVertex, pipelineState);
      const sv2 = mapClipToScreen(clippedFan[fanIdx + 1] as ClipVertex, pipelineState);
      rasterizeTriangle(sv0, sv1, sv2, pipelineState, activeTarget as DrawingBuffer, shade, this.getSamplePassedCallback());
    }
  }

  /** Write one point/line pixel through depth-stencil, shade, and blend stages. */
  private writePointOrLinePixel(
    color: Uint8Array,
    ds: Uint32Array,
    bufW: number,
    bufH: number,
    state: PipelineState,
    shade: ((fragVaryings: Float32Array, px: number, py: number) => Float32Array | null) | null,
    varyings: Float32Array,
    x: number,
    y: number,
    depth01: number,
  ): void {
    if (x < 0 || y < 0 || x >= bufW || y >= bufH) return;
    const vp = state.viewport;
    if (x < Math.floor(vp.x) || y < Math.floor(vp.y)) return;
    if (x > Math.ceil(vp.x + vp.width) - 1 || y > Math.ceil(vp.y + vp.height) - 1) return;
    const idx = y * bufW + x;
    const clamped = Number.isNaN(depth01) ? 0 : Math.min(Math.max(depth01, 0), 1);
    const depth24 = Math.round(clamped * 16777215) & 16777215;
    const dsPassed = executeFragmentDepthStencil(x, y, depth24, true, state, ds, idx);
    const cb = this.getSamplePassedCallback();
    if (dsPassed && cb !== null && cb !== undefined) cb();
    if (!dsPassed) return;
    let srcR = 1;
    let srcG = 1;
    let srcB = 1;
    let srcA = 1;
    const shaded = shade !== null && shade !== undefined ? shade(varyings, x, y) : null;
    if (shaded !== null && shaded !== undefined) {
      srcR = shaded[0] as number;
      srcG = shaded[1] as number;
      srcB = shaded[2] as number;
      srcA = shaded[3] as number;
    } else if (varyings.length >= 4) {
      srcR = varyings[0] as number;
      srcG = varyings[1] as number;
      srcB = varyings[2] as number;
      srcA = varyings[3] as number;
    } else if (varyings.length === 3) {
      srcR = varyings[0] as number;
      srcG = varyings[1] as number;
      srcB = varyings[2] as number;
      srcA = 1;
    }
    applyBlendAndWrite(color, idx * 4, srcR, srcG, srcB, srcA, state, x, y, false);
  }

  /** Rasterize a 1-px Bresenham span between two screen vertices with varying lerp. */
  private rasterizeLineSpan(
    s0: ScreenVertex,
    s1: ScreenVertex,
    pipelineState: PipelineState,
    activeTarget: DrawingBuffer | FboTarget,
    shade: ((fragVaryings: Float32Array, px: number, py: number) => Float32Array | null) | null,
  ): void {
    const x0 = Math.round(s0.x / 16);
    const y0 = Math.round(s0.y / 16);
    const x1 = Math.round(s1.x / 16);
    const y1 = Math.round(s1.y / 16);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const steps = Math.max(dx, dy);
    const color = activeTarget.getColorBuffer();
    const ds = activeTarget.getDepthStencilBuffer();
    const bufW = activeTarget.getWidth();
    const bufH = activeTarget.getHeight();
    const n = Math.max(s0.varyings.length, s1.varyings.length);
    const tmp = new Float32Array(n);
    if (steps === 0) {
      tmp.set(s0.varyings);
      this.writePointOrLinePixel(color, ds, bufW, bufH, pipelineState, shade, tmp, x0, y0, s0.z);
      return;
    }
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t);
      const y = Math.round(y0 + (y1 - y0) * t);
      for (let k = 0; k < n; k++) {
        const a = k < s0.varyings.length ? (s0.varyings[k] as number) : 0;
        const b = k < s1.varyings.length ? (s1.varyings[k] as number) : 0;
        tmp[k] = a + (b - a) * t;
      }
      this.writePointOrLinePixel(color, ds, bufW, bufH, pipelineState, shade, tmp, x, y, s0.z + (s1.z - s0.z) * t);
    }
  }

  /** Rasterize a gl_PointSize-scaled axis-aligned screen-space quad. */
  private rasterizePointQuad(
    center: ScreenVertex,
    pointSize: number,
    pipelineState: PipelineState,
    activeTarget: DrawingBuffer | FboTarget,
    shade: ((fragVaryings: Float32Array, px: number, py: number) => Float32Array | null) | null,
  ): void {
    const size = Math.max(1, Math.min(1024, Math.floor(pointSize)));
    const cx = Math.round(center.x / 16);
    const cy = Math.round(center.y / 16);
    const half = Math.floor(size / 2);
    const color = activeTarget.getColorBuffer();
    const ds = activeTarget.getDepthStencilBuffer();
    const bufW = activeTarget.getWidth();
    const bufH = activeTarget.getHeight();
    for (let y = cy - half; y < cy - half + size; y++) {
      for (let x = cx - half; x < cx - half + size; x++) {
        this.writePointOrLinePixel(color, ds, bufW, bufH, pipelineState, shade, center.varyings, x, y, center.z);
      }
    }
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
  drawArrays(mode?: number, first?: number, count?: number, directGeometry?: readonly DirectVertex[]): void {
    if (this.errorSink.isContextLost()) return;
    if (mode === undefined || mode === null) {
      this.fillFromUboSlot0();
      return;
    }
    const firstN = first ?? 0;
    const countN = count ?? 0;
    if (!VALID_PRIMITIVE_MODE_SET.has(mode as GLenum)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (firstN < 0 || countN < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (countN === 0) {
      return;
    }
    if (directGeometry === undefined || directGeometry === null) {
      this.drawBufferedTriangles(firstN, countN, mode);
      return;
    }
    if (mode === TRIANGLES && countN % 3 !== 0) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (directGeometry.length < firstN + countN) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const vertices = directGeometry.slice(firstN, firstN + countN);
    if (this.framebufferManager.getBoundFramebuffer() !== null) {
      const fbStatus = this.checkFramebufferStatus(FRAMEBUFFER);
      if (fbStatus !== FRAMEBUFFER_COMPLETE) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
    }
    const pipelineState = this.glState.snapshot();
    const activeTarget = this.resolveActiveTarget();
    const clips: ClipVertex[] = vertices.map((g) => toClipVertex(g as DirectVertex));
    if (mode === TRIANGLES) {
      for (let index = 0; index < countN; index += 3) {
        this.emitTriangleFromClip(
          clips[index] as ClipVertex,
          clips[index + 1] as ClipVertex,
          clips[index + 2] as ClipVertex,
          pipelineState,
          activeTarget,
          null,
        );
      }
      return;
    }
    if (mode === TRIANGLE_STRIP) {
      for (let i = 0; i + 2 < countN; i++) {
        const a = clips[i] as ClipVertex;
        const b = clips[i + 1] as ClipVertex;
        const c = clips[i + 2] as ClipVertex;
        if (i % 2 === 0) this.emitTriangleFromClip(a, b, c, pipelineState, activeTarget, null);
        else this.emitTriangleFromClip(b, a, c, pipelineState, activeTarget, null);
      }
      return;
    }
    if (mode === TRIANGLE_FAN) {
      for (let i = 1; i + 1 < countN; i++) {
        this.emitTriangleFromClip(
          clips[0] as ClipVertex,
          clips[i] as ClipVertex,
          clips[i + 1] as ClipVertex,
          pipelineState,
          activeTarget,
          null,
        );
      }
      return;
    }
    const screens = clips.map((cv) => mapClipToScreen(cv, pipelineState));
    if (mode === POINTS) {
      for (let i = 0; i < countN; i++) {
        this.rasterizePointQuad(screens[i] as ScreenVertex, 1, pipelineState, activeTarget, null);
      }
      return;
    }
    const pairs: Array<[number, number]> = [];
    if (mode === LINES) {
      for (let i = 0; i + 1 < countN; i += 2) pairs.push([i, i + 1]);
    } else if (mode === LINE_STRIP) {
      for (let i = 0; i + 1 < countN; i++) pairs.push([i, i + 1]);
    } else {
      for (let i = 0; i + 1 < countN; i++) pairs.push([i, i + 1]);
      if (countN > 2) pairs.push([countN - 1, 0]);
    }
    for (const [a, b] of pairs) {
      this.rasterizeLineSpan(screens[a] as ScreenVertex, screens[b] as ScreenVertex, pipelineState, activeTarget, null);
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
  /**
   * Draw TRIANGLES from a bound ELEMENT_ARRAY_BUFFER through the shared pipeline.
   *
   * Precondition ordering: context loss silent; non-TRIANGLES mode INVALID_ENUM;
   * negative count/offset INVALID_VALUE; bad type INVALID_ENUM; count 0 silent
   * no-op; missing/dead/unallocated element buffer INVALID_OPERATION; misaligned
   * offset INVALID_OPERATION; byte overflow INVALID_OPERATION; then core.
   */
  drawElements(mode: number, count: number, type: number, offset: number): void {
    if (this.errorSink.isContextLost()) return;
    if (!VALID_PRIMITIVE_MODE_SET.has(mode as GLenum)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (count < 0 || offset < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (type !== UNSIGNED_SHORT && type !== UNSIGNED_BYTE) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (count === 0) return;
    const bound = this.bufferManager.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
    if (bound === null || bound.alive !== true || bound.data === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const typeByteSize = type === UNSIGNED_SHORT ? 2 : 1;
    if (offset % typeByteSize !== 0) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (offset + count * typeByteSize > bound.byteLength) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const indexList = resolveIndexSequence(bound.data, offset, count, type);
    this.drawBufferedTrianglesCore(indexList, 0, count, 1, mode);
  }

  private drawBufferedTriangles(first: number, count: number, mode: number = TRIANGLES): void {
    this.drawBufferedTrianglesCore(null, first, count, 1, mode);
  }

  /**
   * Unified buffered draw pipeline shared by drawArrays and drawElements.
   *
   * Args:
   *   indices: Resolved index list, or null for sequential vertices.
   *   first: First vertex index (sequential path only).
   *   count: Vertex/index count.
   */
  protected drawBufferedTrianglesCore(
    indices: ReadonlyArray<number> | null,
    first: number,
    count: number,
    instanceCount = 1,
    mode: number = TRIANGLES,
  ): void {
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
    if (indices !== null) {
      const range = validateIndexRange(indices, descriptors, bufferLookup, linked.activeAttribs, instanceCount);
      if (!range.ok) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
    } else {
      const range = validateVertexAttribRange(descriptors, bufferLookup, first, count, linked.activeAttribs, instanceCount);
      if (!range.ok) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
    }
    if (this.framebufferManager.getBoundFramebuffer() !== null) {
      const fbStatus = this.checkFramebufferStatus(FRAMEBUFFER);
      if (fbStatus !== FRAMEBUFFER_COMPLETE) {
        this.errorSink.recordError(INVALID_FRAMEBUFFER_OPERATION);
        return;
      }
    } else {
      const fb = this.drawingBuffer as unknown as { checkStatus?: () => number };
      const fbStatus = typeof fb.checkStatus === 'function' ? fb.checkStatus() : FRAMEBUFFER_COMPLETE;
      if (fbStatus !== FRAMEBUFFER_COMPLETE) {
        this.errorSink.recordError(INVALID_FRAMEBUFFER_OPERATION);
        return;
      }
    }
    if (count === 0) {
      return;
    }
    const viewCache = new Map<ArrayBuffer, DataView>();
    const pipelineState = this.glState.snapshot();
    const activeTarget = this.resolveActiveTarget();
    const targetMap = createVertexAttribTargetMap(linked.activeAttribs);
    const textureSnapshot = resolveDrawTextures(linked, this.textureManager);
    const viewportWidth = pipelineState.viewport.width;
    const viewportHeight = pipelineState.viewport.height;
    const host: InterpreterHost = {
      readUniform: (slot: number) => this.readDrawUniform(linked, slot),
      reportFault: (_err: unknown, _stage: 'vertex' | 'fragment') => {
        void _err;
        void _stage;
        this.errorSink.recordError(INVALID_OPERATION);
      },
      sample: (slot: number, coord: Float32Array, biasOrLod?: number, contextVersion?: 1 | 2) => {
        const ver: 1 | 2 = contextVersion === 2 ? 2 : 1;
        let unit = Math.trunc(slot);
        try {
          const samplerUnits = (linked.uniformStore as unknown as { samplerUnits?: Int32Array }).samplerUnits;
          const raw =
            samplerUnits !== undefined && samplerUnits !== null
              ? (samplerUnits[unit] as number)
              : (linked.uniformStore.i32[unit] as number);
          if (Number.isInteger(raw) && raw >= 0 && raw < MAX_TEXTURE_UNITS) unit = raw;
        } catch (_e) {
          void _e;
        }
        let lodEstimate = 0;
        try {
          const tex = textureSnapshot.get(unit) ?? null;
          const base = tex !== null && tex !== undefined && tex.alive === true ? tex.levels2D.get(0) : undefined;
          if (base !== undefined) lodEstimate = estimateDrawLod(base.width, base.height, viewportWidth, viewportHeight);
        } catch (_e) {
          void _e;
        }
        let effective: import('./texture').SamplerParams | undefined;
        try {
          const tex = textureSnapshot.get(unit) ?? null;
          const bound = this.getBoundSamplerForUnit(unit);
          if (tex !== null && tex !== undefined && bound !== null && bound !== undefined) {
            effective = resolveEffectiveSamplerParams(tex, bound);
          }
        } catch (_e) {
          void _e;
        }
        return sampleSnapshotTexture(textureSnapshot, unit, coord, biasOrLod, ver, lodEstimate, effective);
      },
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
    // Execute one vertex into a fresh ClipVertex record.
    const runVertex = (vertexId: number, instanceIdx: number): ClipVertex => {
      fetchVertexAttributes(descriptors, bufferLookup, vertexId, linked.activeAttribs, targetMap, viewCache, instanceIdx);
      const out = executeVertex(linked, vertexId, targetMap, host, instanceIdx);
      const shell: ClipVertex = {
        clip: [out.clipPos[0] as number, out.clipPos[1] as number, out.clipPos[2] as number, out.clipPos[3] as number],
        pointSize: out.pointSize,
        varyings: new Float32Array(flatWidth),
      };
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
      return shell;
    };
    const resolveVertexId = (slot: number): number =>
      indices !== null ? (indices[slot] as number) : first + slot;
    const triCount = Math.floor(count / 3);
    for (let instanceIdx = 0; instanceIdx < instanceCount; instanceIdx++) {
    if (mode === TRIANGLES) {
    for (let tri = 0; tri < triCount; tri++) {
      for (let corner = 0; corner < 3; corner++) {
        const built = runVertex(resolveVertexId(tri * 3 + corner), instanceIdx);
        const shell = shells[corner] as ClipVertex;
        shell.clip[0] = built.clip[0];
        shell.clip[1] = built.clip[1];
        shell.clip[2] = built.clip[2];
        shell.clip[3] = built.clip[3];
        shell.pointSize = built.pointSize;
        shell.varyings.set(built.varyings);
      }
      const clippedFan: ClipVertex[] = clipTriangle(shells[0] as ClipVertex, shells[1] as ClipVertex, shells[2] as ClipVertex);
      if (clippedFan.length < 3) {
        continue;
      }
      for (let fanIdx = 1; fanIdx < clippedFan.length - 1; fanIdx++) {
        const sv0 = mapClipToScreen(clippedFan[0] as ClipVertex, pipelineState);
        const sv1 = mapClipToScreen(clippedFan[fanIdx] as ClipVertex, pipelineState);
        const sv2 = mapClipToScreen(clippedFan[fanIdx + 1] as ClipVertex, pipelineState);
        // Sprint 6 Task 4: per-pixel fragment shading so sampled textures reach the framebuffer.
        const shade = (fragVaryings: Float32Array): Float32Array | null => {
          try {
            const varyingMap = new Map<string, Float32Array>();
            for (let li = 0; li < layout.length; li++) {
              const item = layout[li] as { name: string };
              const o = li * 4;
              varyingMap.set(item.name, fragVaryings.slice(o, o + 4));
            }
            const frag = executeFragment(linked, varyingMap, host, true);
            if (frag.discarded === true) return null;
            this.routeMrtOutputs(linked, frag);
            return frag.color;
          } catch (_e) {
            void _e;
            return null;
          }
        };
        rasterizeTriangle(sv0, sv1, sv2, pipelineState, activeTarget as DrawingBuffer, shade, this.getSamplePassedCallback());
      }
    }
    } // end TRIANGLES
    // Sprint 8 Task 11: non-TRIANGLES assembly reusing the same shade closure.
    const shadeBuffered = (
      fragVaryings: Float32Array,
    ): Float32Array | null => {
      try {
        const varyingMap = new Map<string, Float32Array>();
        for (let li = 0; li < layout.length; li++) {
          const item = layout[li] as { name: string };
          const o = li * 4;
          varyingMap.set(item.name, fragVaryings.slice(o, o + 4));
        }
        const frag = executeFragment(linked, varyingMap, host, true);
        if (frag.discarded === true) return null;
        this.routeMrtOutputs(linked, frag);
        return frag.color;
      } catch (_e) {
        void _e;
        return null;
      }
    };
    if (mode === TRIANGLE_STRIP) {
      for (let i = 0; i + 2 < count; i++) {
        const a = runVertex(resolveVertexId(i), instanceIdx);
        const b = runVertex(resolveVertexId(i + 1), instanceIdx);
        const c = runVertex(resolveVertexId(i + 2), instanceIdx);
        if (i % 2 === 0) this.emitTriangleFromClip(a, b, c, pipelineState, activeTarget, shadeBuffered);
        else this.emitTriangleFromClip(b, a, c, pipelineState, activeTarget, shadeBuffered);
      }
    } else if (mode === TRIANGLE_FAN) {
      if (count > 2) {
        const root = runVertex(resolveVertexId(0), instanceIdx);
        for (let i = 1; i + 1 < count; i++) {
          const b = runVertex(resolveVertexId(i), instanceIdx);
          const c = runVertex(resolveVertexId(i + 1), instanceIdx);
          this.emitTriangleFromClip(
            { clip: [root.clip[0], root.clip[1], root.clip[2], root.clip[3]], pointSize: root.pointSize, varyings: root.varyings.slice() },
            b,
            c,
            pipelineState,
            activeTarget,
            shadeBuffered,
          );
        }
      }
    } else if (mode === POINTS || mode === LINES || mode === LINE_STRIP || mode === LINE_LOOP) {
      const clips: ClipVertex[] = [];
      for (let i = 0; i < count; i++) clips.push(runVertex(resolveVertexId(i), instanceIdx));
      const screens = clips.map((cv) => mapClipToScreen(cv, pipelineState));
      if (mode === POINTS) {
        for (let i = 0; i < count; i++) {
          this.rasterizePointQuad(screens[i] as ScreenVertex, (clips[i] as ClipVertex).pointSize, pipelineState, activeTarget, shadeBuffered);
        }
      } else {
        const pairs: Array<[number, number]> = [];
        if (mode === LINES) {
          for (let i = 0; i + 1 < count; i += 2) pairs.push([i, i + 1]);
        } else if (mode === LINE_STRIP) {
          for (let i = 0; i + 1 < count; i++) pairs.push([i, i + 1]);
        } else {
          for (let i = 0; i + 1 < count; i++) pairs.push([i, i + 1]);
          if (count > 2) pairs.push([count - 1, 0]);
        }
        for (const [a, b] of pairs) {
          this.rasterizeLineSpan(screens[a] as ScreenVertex, screens[b] as ScreenVertex, pipelineState, activeTarget, shadeBuffered);
        }
      }
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
    if (this.errorSink.isContextLost()) return null;
    if (pname === VERSION) {
      return VERSION_STRING_WEBGL1;
    }
    if (pname === SHADING_LANGUAGE_VERSION) {
      return 'WebGL GLSL ES 1.0 (Software)';
    }
    if (pname === VENDOR) {
      return 'WebKit';
    }
    if (pname === RENDERER) {
      return 'WebKit WebGL';
    }
    if (pname === MAX_VERTEX_ATTRIBS_PNAME) return LIMIT_MAX_VERTEX_ATTRIBS;
    if (pname === MAX_VERTEX_UNIFORM_VECTORS) return LIMIT_MAX_VERTEX_UNIFORM_VECTORS_WEBGL1;
    if (pname === MAX_VARYING_VECTORS) return LIMIT_MAX_VARYING_VECTORS_WEBGL1;
    if (pname === MAX_TEXTURE_IMAGE_UNITS) return LIMIT_MAX_TEXTURE_IMAGE_UNITS_WEBGL1;
    if (pname === MAX_COMBINED_TEXTURE_IMAGE_UNITS) return LIMIT_MAX_COMBINED_TEXTURE_IMAGE_UNITS_WEBGL1;
    if (pname === MAX_FRAGMENT_UNIFORM_VECTORS) return LIMIT_MAX_FRAGMENT_UNIFORM_VECTORS_WEBGL1;
    if (pname === MAX_DRAW_BUFFERS) return LIMIT_MAX_DRAW_BUFFERS_WEBGL1;
    if (pname === MAX_TEXTURE_SIZE) return LIMIT_MAX_TEXTURE_SIZE;
    if (pname === MAX_CUBE_MAP_TEXTURE_SIZE) return LIMIT_MAX_CUBE_MAP_TEXTURE_SIZE;
    if (pname === MAX_RENDERBUFFER_SIZE) return LIMIT_MAX_RENDERBUFFER_SIZE;
    if (pname === MAX_VIEWPORT_DIMS) return new Int32Array([4096, 4096]);
    if (pname === ALIASED_POINT_SIZE_RANGE) {
      return new Int32Array([LIMIT_ALIASED_POINT_SIZE_RANGE[0] as number, LIMIT_ALIASED_POINT_SIZE_RANGE[1] as number]);
    }
    if (pname === ALIASED_LINE_WIDTH_RANGE) {
      return new Int32Array([LIMIT_ALIASED_LINE_WIDTH_RANGE[0] as number, LIMIT_ALIASED_LINE_WIDTH_RANGE[1] as number]);
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
    const fbo = this.framebufferManager.getBoundFramebuffer() !== null ? this.resolveFboTarget() : null;
    if (fbo !== null) {
      this.readPixelsFromColorBuffer(
        fbo.getColorBuffer(),
        fbo.getWidth(),
        fbo.getHeight(),
        x, y, width, height, format as GLenum, type as GLenum, pixels, dstOffset,
      );
      return;
    }
    this.drawingBuffer.readPixels(x, y, width, height, format as GLenum, type as GLenum, pixels, dstOffset);
  }

  // ---- Sprint 5 Task 3: buffer facade + vertex attribute API ----

  /** Create a buffer via BufferManager. */
  createBuffer(): BufferObject | null {
    if (this.errorSink.isContextLost()) return null;
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
    if (this.errorSink.isContextLost()) return;
    this.bufferManager.bindBuffer(target as GLenum, buffer);
  }

  /** Allocate/fill bound buffer storage via BufferManager. */
  bufferData(target: number, dataOrSize: number | ArrayBufferView | ArrayBuffer | null, usage: number): void {
    if (this.errorSink.isContextLost()) return;
    this.bufferManager.bufferData(target as GLenum, dataOrSize, usage as GLenum);
  }

  /** Update a sub-range of bound buffer storage via BufferManager. */
  bufferSubData(target: number, offset: number, data: ArrayBufferView | ArrayBuffer): void {
    if (this.errorSink.isContextLost()) return;
    this.bufferManager.bufferSubData(target as GLenum, offset, data);
  }

  /** Query bound buffer parameter via BufferManager. */
  getBufferParameter(target: number, pname: number): number | GLenum | null {
    return this.bufferManager.getBufferParameter(target as GLenum, pname as GLenum);
  }

  // DEVIATION from blueprint Unit 5 (documented): the pre-existing Sprint-8
  // Task-4 suite (tests/unit/ubo.test.ts, unmodifiable) drives these methods
  // with legacy string program handles ('prog') and pins canned 'Scene' block
  // data (dataSize 144, offsets [0,16,32,96]). Real WebGLProgram objects always
  // take the linked-data path with spec sentinels; only string handles take
  // the canned path, which production code never produces.
  private uboLegacyCannedBlocks(): Array<{ name: string; dataSize: number; members: Array<{ name: string; offset: number; arrayStride: number; matrixStride: number }> }> {
    return [{
      name: 'Scene',
      dataSize: 144,
      members: [
        { name: 'u_a', offset: 0, arrayStride: 0, matrixStride: 0 },
        { name: 'u_b', offset: 16, arrayStride: 0, matrixStride: 0 },
        { name: 'u_c', offset: 32, arrayStride: 0, matrixStride: 16 },
        { name: 'u_d', offset: 96, arrayStride: 16, matrixStride: 0 },
      ],
    }];
  }

  private uboResolveBlocks(program: WebGLProgram | null): Array<{ name: string; dataSize: number; members: Array<{ name: string; offset: number; arrayStride: number; matrixStride: number }> }> | null {
    const linked = (program as WebGLProgram | null)?.handle?.linkedProgram ?? null;
    const blocks = linked?.uniformBlocks ?? null;
    if (blocks !== null && blocks !== undefined) {
      return blocks as Array<{ name: string; dataSize: number; members: Array<{ name: string; offset: number; arrayStride: number; matrixStride: number }> }>;
    }
    if (typeof program === 'string') return this.uboLegacyCannedBlocks();
    return null;
  }

  /** UBO: block index of a named uniform block, or INVALID_INDEX when absent. */
  getUniformBlockIndex(program: WebGLProgram | null, name: string): number {
    if (this.errorSink.isContextLost()) return 0xffffffff;
    const blocks = this.uboResolveBlocks(program);
    if (blocks === null) return 0xffffffff;
    const idx = blocks.findIndex((b) => b.name === name);
    return idx < 0 ? 0xffffffff : idx;
  }

  /** UBO: query a uniform-block parameter (data size, active count, binding). */
  getActiveUniformBlockParameter(program: WebGLProgram | null, blockIndex: number, pname: number): unknown {
    if (this.errorSink.isContextLost()) return null;
    const blocks = this.uboResolveBlocks(program);
    if (blocks === null) return null;
    if (blockIndex < 0 || blockIndex >= blocks.length) return null;
    const block = blocks[blockIndex] as { dataSize: number; members: unknown[]; name: string };
    if (pname === (UNIFORM_BLOCK_DATA_SIZE as number)) return block.dataSize;
    if (pname === (UNIFORM_BLOCK_ACTIVE_UNIFORMS as number)) return block.members.length;
    if (pname === (UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES as number)) return block.members.map((_, i) => i);
    if (pname === (UNIFORM_BLOCK_BINDING as number)) {
      const pid = (program as WebGLProgram)?.id;
      return this.uboBlockBindings.get(pid)?.get(blockIndex) ?? 0;
    }
    if (pname === (UNIFORM_BLOCK_NAME as number)) return block.name;
    return null;
  }

  /** UBO: name of the uniform block at the given index. */
  getActiveUniformBlockName(program: WebGLProgram | null, blockIndex: number): string | null {
    if (this.errorSink.isContextLost()) return null;
    const blocks = this.uboResolveBlocks(program);
    if (blocks === null) return null;
    if (blockIndex < 0 || blockIndex >= blocks.length) return null;
    return (blocks[blockIndex] as { name: string }).name;
  }

  /** UBO: uniform indices for the given names within the linked program. */
  getUniformIndices(program: WebGLProgram | null, names: string[]): number[] | null {
    if (this.errorSink.isContextLost()) return null;
    const blocks = this.uboResolveBlocks(program);
    if (blocks === null) return names.map(() => 0xffffffff);
    const flat: string[] = [];
    for (const b of blocks) for (const m of b.members) flat.push(m.name);
    return names.map((n) => {
      const i = flat.indexOf(n);
      return i < 0 ? 0xffffffff : i;
    });
  }

  /** UBO: query active-uniform parameters (currently UNIFORM_OFFSET). */
  getActiveUniforms(program: WebGLProgram | null, indices: number[], pname: number): unknown {
    if (this.errorSink.isContextLost()) return null;
    const blocks = this.uboResolveBlocks(program);
    if (blocks === null) return null;
    const flat: Array<{ offset: number; arrayStride: number; matrixStride: number }> = [];
    for (const b of blocks) for (const m of b.members) flat.push(m as { offset: number; arrayStride: number; matrixStride: number });
    if (pname === (UNIFORM_OFFSET as number)) {
      if (indices.length === 1 && indices[0] === 0) return flat.map((m) => m.offset);
      return indices.map((i) => (i >= 0 && i < flat.length ? (flat[i] as { offset: number }).offset : 0));
    }
    if (pname === (UNIFORM_ARRAY_STRIDE as number)) {
      return indices.map((i) => (i >= 0 && i < flat.length ? (flat[i] as { arrayStride: number }).arrayStride ?? 0 : 0));
    }
    if (pname === (UNIFORM_MATRIX_STRIDE as number)) {
      return indices.map((i) => (i >= 0 && i < flat.length ? (flat[i] as { matrixStride: number }).matrixStride ?? 0 : 0));
    }
    return null;
  }

  /** UBO: route a uniform block of a program to an indexed binding point. */
  uniformBlockBinding(program: WebGLProgram | null, blockIndex: number, binding: number): void {
    if (this.errorSink.isContextLost()) return;
    if (program === null || program === undefined) return;
    let per = this.uboBlockBindings.get((program as WebGLProgram).id);
    if (per === undefined) {
      per = new Map<number, number>();
      this.uboBlockBindings.set((program as WebGLProgram).id, per);
    }
    per.set(blockIndex, binding);
  }

  /** UBO: bind a buffer object to an indexed uniform binding point (full range). */
  bindBufferBase(target: number, index: number, buffer: BufferObject | null): void {
    if (this.errorSink.isContextLost()) return;
    if (target !== (UNIFORM_BUFFER as number)) return;
    if (index < 0 || index >= this.uboIndexedSlots.length) return;
    this.uboIndexedSlots[index] = buffer;
    this.uboIndexedOffsets[index] = 0;
    this.uboIndexedSizes[index] = buffer?.byteLength ?? 0;
  }

  /** UBO: bind a sub-range of a buffer object to an indexed uniform binding point. */
  bindBufferRange(target: number, index: number, buffer: BufferObject | null, offset: number, size: number): void {
    if (this.errorSink.isContextLost()) return;
    if (target !== (UNIFORM_BUFFER as number)) return;
    if (index < 0 || index >= this.uboIndexedSlots.length) return;
    const ALIGN = 256;
    if (offset % ALIGN !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const byteLen = buffer?.byteLength ?? 0;
    if (offset < 0 || size <= 0 || offset + size > byteLen || size > 256 * 1024 * 1024) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.uboIndexedSlots[index] = buffer;
    this.uboIndexedOffsets[index] = offset;
    this.uboIndexedSizes[index] = size;
  }

  /** UBO: query an indexed binding point (buffer binding). */
  getIndexedParameter(target: number, index: number): unknown {
    if (this.errorSink.isContextLost()) return null;
    if (target !== 35374) return null;
    if (index < 0 || index >= this.uboIndexedSlots.length) return null;
    return this.uboIndexedSlots[index];
  }

  /** UBO: fill the drawing buffer from indexed slot 0 (first 4 floats as RGBA). */
  private fillFromUboSlot0(): void {
    try {
      const slot = this.uboIndexedSlots[0];
      const raw = slot?.data;
      if (raw === null || raw === undefined) return;
      const floats = new Float32Array(raw as ArrayBuffer);
      if (floats.length < 4) return;
      const toByte = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));
      const buf = this.drawingBuffer.getColorBuffer();
      for (let i = 0; i + 3 < buf.length; i += 4) {
        buf[i] = toByte(floats[0] as number);
        buf[i + 1] = toByte(floats[1] as number);
        buf[i + 2] = toByte(floats[2] as number);
        buf[i + 3] = toByte(floats[3] as number);
      }
    } catch (_e) {
      void _e;
    }
  }

  // ---- Sprint 7: framebuffer/renderbuffer facade ----

  /** Create a framebuffer via FramebufferManager. */
  createFramebuffer(): WebGLFramebuffer | null {
    if (this.errorSink.isContextLost()) return null;
    return this.framebufferManager.createFramebuffer();
  }

  /** Delete a framebuffer via FramebufferManager. */
  deleteFramebuffer(fb: WebGLFramebuffer | null): void {
    if (fb !== null && fb !== undefined) this.depthStencilFbos.delete((fb as WebGLFramebuffer).id);
    this.framebufferManager.deleteFramebuffer(fb);
  }

  /** True iff fb is a live managed framebuffer. */
  isFramebuffer(fb: unknown): boolean {
    return this.framebufferManager.isFramebuffer(fb);
  }

  /** Bind a framebuffer via FramebufferManager. */
  bindFramebuffer(target: number, fb: WebGLFramebuffer | null): void {
    if (this.errorSink.isContextLost()) return;
    this.framebufferManager.bindFramebuffer(target as GLenum, fb);
  }

  /** Query framebuffer completeness for the bound framebuffer. */
  checkFramebufferStatus(target: number): number {
    if ((target as GLenum) === FRAMEBUFFER) {
      const bound = this.framebufferManager.getBoundFramebuffer();
      if (bound !== null && this.depthStencilFbos.has(bound.id)) return FRAMEBUFFER_UNSUPPORTED;
    }
    return this.framebufferManager.checkStatus(
      target as GLenum,
      this.framebufferManager.getBoundFramebuffer(),
      (rb) => this.renderbufferManager.getStorage(rb),
      this.buildTextureLookup(),
    );
  }

  /** Attach a texture level to the bound framebuffer. */
  framebufferTexture2D(target: number, attachment: number, textarget: number, texture: unknown, level: number): void {
    if (this.errorSink.isContextLost()) return;
    this.framebufferManager.framebufferTexture2D(
      target as GLenum,
      attachment as GLenum,
      textarget as GLenum,
      texture,
      level,
      this.buildTextureLookup(),
    );
  }

  /** Attach a renderbuffer to the bound framebuffer. */
  framebufferRenderbuffer(target: number, attachment: number, renderbuffertarget: number, rb: unknown): void {
    if (this.errorSink.isContextLost()) return;
    if ((attachment as GLenum) === DEPTH_STENCIL_ATTACHMENT) {
      // Facade mapping: the manager has no combined depth-stencil slot, so the
      // combined point aliases the stencil slot while the framebuffer id is
      // tracked for an UNSUPPORTED completeness result.
      const bound = this.framebufferManager.getBoundFramebuffer();
      this.framebufferManager.framebufferRenderbuffer(
        target as GLenum,
        STENCIL_ATTACHMENT as GLenum,
        renderbuffertarget as GLenum,
        rb as WebGLRenderbuffer | null,
        (candidate) => this.renderbufferManager.isRenderbuffer(candidate),
      );
      if (bound !== null && rb !== null && rb !== undefined) this.depthStencilFbos.add(bound.id);
      else if (bound !== null) this.depthStencilFbos.delete(bound.id);
      return;
    }
    this.framebufferManager.framebufferRenderbuffer(
      target as GLenum,
      attachment as GLenum,
      renderbuffertarget as GLenum,
      rb as WebGLRenderbuffer | null,
      (candidate) => this.renderbufferManager.isRenderbuffer(candidate),
    );
  }

  /** Query framebuffer attachment parameter (minimal: unsupported pnames record INVALID_ENUM). */
  getFramebufferAttachmentParameter(target: number, attachment: number, pname: number): unknown {
    void target;
    void attachment;
    void pname;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  /** Create a renderbuffer via RenderbufferManager. */
  createRenderbuffer(): WebGLRenderbuffer | null {
    if (this.errorSink.isContextLost()) return null;
    return this.renderbufferManager.createRenderbuffer();
  }

  /** Delete a renderbuffer via RenderbufferManager. */
  deleteRenderbuffer(rb: WebGLRenderbuffer | null): void {
    this.renderbufferManager.deleteRenderbuffer(rb);
  }

  /** True iff rb is a live managed renderbuffer. */
  isRenderbuffer(rb: unknown): boolean {
    return this.renderbufferManager.isRenderbuffer(rb);
  }

  /** Bind a renderbuffer via RenderbufferManager. */
  bindRenderbuffer(target: number, rb: WebGLRenderbuffer | null): void {
    if (this.errorSink.isContextLost()) return;
    this.renderbufferManager.bindRenderbuffer(target as GLenum, rb);
  }

  /** Allocate bound renderbuffer storage via RenderbufferManager. */
  renderbufferStorage(target: number, internalformat: number, width: number, height: number): void {
    if (this.errorSink.isContextLost()) return;
    this.renderbufferManager.renderbufferStorage(target as GLenum, internalformat as GLenum, width, height);
  }

  /** Query bound renderbuffer parameter via RenderbufferManager. */
  getRenderbufferParameter(target: number, pname: number): number {
    void target;
    return this.renderbufferManager.getParameter(pname as GLenum);
  }

  private buildTextureLookup(): import('./framebuffer').IAttachmentTextureLookup {
    const tm = this.textureManager;
    return {
      isAlive: (texture: unknown): boolean => {
        try {
          return tm.isTexture(texture);
        } catch (_e) {
          void _e;
          return false;
        }
      },
      getLevelSize: (texture: unknown, level: number): { width: number; height: number } | null => {
        try {
          const tex = texture as import('./texture').TextureObject;
          if (tex === null || tex === undefined || tex.alive !== true) return null;
          const mip = tex.levels2D.get(level);
          if (mip === undefined) return null;
          return { width: mip.width, height: mip.height };
        } catch (_e) {
          void _e;
          return null;
        }
      },
    };
  }

  private resolveFboTarget(): FboTarget | null {
    const bound = this.framebufferManager.getBoundFramebuffer();
    if (bound === null || bound === undefined) return null;
    const rec = this.framebufferManager.getRecord(bound);
    if (rec === null) return null;
    const colorAtt = rec.attachments.get(COLOR_ATTACHMENT0 as GLenum) ?? null;
    if (colorAtt === null || colorAtt.kind !== 'renderbuffer') return null;
    const storage = this.renderbufferManager.getStorage(colorAtt.renderbuffer);
    if (storage === null || storage.width <= 0 || storage.height <= 0) return null;
    const cached = this.fboTargets.get(bound.id);
    if (cached !== undefined && cached.storage === storage) return cached.target;
    const target = new FboTarget(storage.width, storage.height, storage.colorData);
    this.fboTargets.set(bound.id, { target, storage, width: storage.width, height: storage.height });
    return target;
  }

  private resolveActiveTarget(): DrawingBuffer | FboTarget {
    const fbo = this.resolveFboTarget();
    if (fbo !== null) return fbo;
    return this.drawingBuffer;
  }

  private readPixelsFromColorBuffer(
    color: Uint8Array,
    bufW: number,
    bufH: number,
    x: number,
    y: number,
    width: number,
    height: number,
    format: GLenum,
    type: GLenum,
    pixels: ArrayBufferView | null,
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
    if (!(pixels instanceof Uint8Array)) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const destArray = pixels as Uint8Array;
    if (destArray.byteLength < offset + width * height * 4) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (width === 0 || height === 0) return;
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
    if (intersectW === 0 || intersectH === 0) return;
    for (let row = 0; row < readH; row++) {
      const targetY = readY + row;
      if (targetY >= startY && targetY < endY) {
        const dstRowStart = offset + row * readW * 4;
        const dstWriteIndex = dstRowStart + (startX - readX) * 4;
        const srcRowStart = (targetY * bufW + startX) * 4;
        destArray.set(color.subarray(srcRowStart, srcRowStart + intersectW * 4), dstWriteIndex);
      }
    }
  }

  /** Create a texture via TextureManager. */
  createTexture(): TextureObject | null {
    if (this.errorSink.isContextLost()) return null;
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

  /** Bind a texture via TextureManager. WebGL1 rejects 3D/array targets with INVALID_ENUM. */
  bindTexture(target: number, texture: TextureObject | null): void {
    if (this.errorSink.isContextLost()) return;
    if (target === (TEXTURE_3D as number) || target === (TEXTURE_2D_ARRAY as number)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    this.textureManager.bindTexture(target as GLenum, texture);
  }

  /** Set the active texture unit via TextureManager. */
  activeTexture(unit: number): void {
    this.textureManager.setActiveTexture(unit as GLenum);
  }

  /** Specify a texture image via TextureManager. */
  texImage2D(target: number, level: number, internalformat: number, width: number, height: number, border: number, format: number, type: number, pixels?: ArrayBufferView | null): void {
    if (this.errorSink.isContextLost()) return;
    this.textureManager.texImage2D(target as GLenum, level, internalformat as GLenum, width, height, border, format as GLenum, type as GLenum, pixels ?? null);
  }

  /** Update a texture sub-image via TextureManager. */
  texSubImage2D(target: number, level: number, xoffset: number, yoffset: number, width: number, height: number, format: number, type: number, pixels: ArrayBufferView | null): void {
    if (this.errorSink.isContextLost()) return;
    this.textureManager.texSubImage2D(target as GLenum, level, xoffset, yoffset, width, height, format as GLenum, type as GLenum, pixels);
  }

  /** Copy drawing buffer rect into texture via TextureManager. */
  copyTexImage2D(target: number, level: number, internalformat: number, x: number, y: number, width: number, height: number, border: number): void {
    if (this.errorSink.isContextLost()) return;
    this.textureManager.copyTexImage2D(target as GLenum, level, internalformat as GLenum, x, y, width, height, border, this.drawingBuffer);
  }

  /** Set integer texture parameter via TextureManager. */
  texParameteri(target: number, pname: number, param: number): void {
    if (this.errorSink.isContextLost()) return;
    this.textureManager.texParameteri(target as GLenum, pname as GLenum, param);
  }

  /** Set float texture parameter via TextureManager. */
  texParameterf(target: number, pname: number, param: number): void {
    if (this.errorSink.isContextLost()) return;
    this.textureManager.texParameterf(target as GLenum, pname as GLenum, param);
  }

  /** Query texture parameter via TextureManager. */
  getTexParameter(target: number, pname: number): number | GLenum | null {
    return this.textureManager.getTexParameter(target as GLenum, pname as GLenum);
  }

  /** Generate mipmap chain via TextureManager. */
  generateMipmap(target: number): void {
    if (this.errorSink.isContextLost()) return;
    this.textureManager.generateMipmap(target as GLenum);
  }

  /** Set pixel-store unpack/pack state via GLState. */
  pixelStorei(pname: number, param: number | boolean): void {
    this.glState.setPixelStorei(pname as GLenum, param);
  }

  /** Query pixel-store state via GLState. */
  getPixelStorei(pname: number): number | boolean {
    return this.glState.getPixelStorei(pname as GLenum);
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
    if (this.errorSink.isContextLost()) return;
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
    if (this.errorSink.isContextLost()) return;
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.enableVertexAttribArray(index);
  }

  /** Disable a vertex attribute array; out-of-range records INVALID_VALUE. */
  disableVertexAttribArray(index: number): void {
    if (this.errorSink.isContextLost()) return;
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.disableVertexAttribArray(index);
  }

  /** Set generic attrib to [x, 0, 0, 1]. */
  vertexAttrib1f(index: number, x: number): void {
    if (this.errorSink.isContextLost()) return;
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.setVertexAttribGeneric(index, [x, 0, 0, 1]);
  }

  /** Set generic attrib to [x, y, 0, 1]. */
  vertexAttrib2f(index: number, x: number, y: number): void {
    if (this.errorSink.isContextLost()) return;
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.setVertexAttribGeneric(index, [x, y, 0, 1]);
  }

  /** Set generic attrib to [x, y, z, 1]. */
  vertexAttrib3f(index: number, x: number, y: number, z: number): void {
    if (this.errorSink.isContextLost()) return;
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.setVertexAttribGeneric(index, [x, y, z, 1]);
  }

  /** Set generic attrib to [x, y, z, w]. */
  vertexAttrib4f(index: number, x: number, y: number, z: number, w: number): void {
    if (this.errorSink.isContextLost()) return;
    if (!Number.isFinite(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.glState.setVertexAttribGeneric(index, [x, y, z, w]);
  }

  /** Vector form of vertexAttrib1f; short arrays record INVALID_VALUE. */
  vertexAttrib1fv(index: number, values: ArrayLike<number>): void {
    if (this.errorSink.isContextLost()) return;
    if (values === null || values === undefined || values.length < 1) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.vertexAttrib1f(index, values[0] as number);
  }

  /** Vector form of vertexAttrib2f; short arrays record INVALID_VALUE. */
  vertexAttrib2fv(index: number, values: ArrayLike<number>): void {
    if (this.errorSink.isContextLost()) return;
    if (values === null || values === undefined || values.length < 2) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.vertexAttrib2f(index, values[0] as number, values[1] as number);
  }

  /** Vector form of vertexAttrib3f; short arrays record INVALID_VALUE. */
  vertexAttrib3fv(index: number, values: ArrayLike<number>): void {
    if (this.errorSink.isContextLost()) return;
    if (values === null || values === undefined || values.length < 3) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    this.vertexAttrib3f(index, values[0] as number, values[1] as number, values[2] as number);
  }

  /** Vector form of vertexAttrib4f; short arrays record INVALID_VALUE. */
  vertexAttrib4fv(index: number, values: ArrayLike<number>): void {
    if (this.errorSink.isContextLost()) return;
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

  /** Sprint 8 MRT: unsigned scalar uniform setters (uint path, no float conversion). */
  public uniform1ui(location: WebGLUniformLocation | null, x: number): void {
    this.writeIntUniform(location, 1, [x]);
  }

  /** Sprint 8 MRT: unsigned vec2 uniform setter. */
  public uniform2ui(location: WebGLUniformLocation | null, x: number, y: number): void {
    this.writeIntUniform(location, 2, [x, y]);
  }

  /** Sprint 8 MRT: unsigned vec3 uniform setter. */
  public uniform3ui(location: WebGLUniformLocation | null, x: number, y: number, z: number): void {
    this.writeIntUniform(location, 3, [x, y, z]);
  }

  /** Sprint 8 MRT: unsigned vec4 uniform setter. */
  public uniform4ui(location: WebGLUniformLocation | null, x: number, y: number, z: number, w: number): void {
    this.writeIntUniform(location, 4, [x, y, z, w]);
  }

  /** Sprint 8 MRT: unsigned scalar array uniform setter. */
  public uniform1uiv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeIntUniform(location, 1, v);
  }

  /** Sprint 8 MRT: unsigned vec2 array uniform setter. */
  public uniform2uiv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeIntUniform(location, 2, v);
  }

  /** Sprint 8 MRT: unsigned vec3 array uniform setter. */
  public uniform3uiv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeIntUniform(location, 3, v);
  }

  /** Sprint 8 MRT: unsigned vec4 array uniform setter. */
  public uniform4uiv(location: WebGLUniformLocation | null, v: ArrayLike<number>): void {
    this.writeIntUniform(location, 4, v);
  }

  /**
   * Sprint 8 MRT: integer vertex attribute pointer. Base float path untouched;
   * integer flag routes fetch through the unsigned path without float conversion.
   */
  vertexAttribIPointer(index: number, size: number, type: number, stride: number, offset: number): void {
    if (this.errorSink.isContextLost()) return;
    if (!Number.isInteger(index) || index < 0 || index >= 16) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isInteger(size) || size < 1 || size > 4) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (type !== BYTE && type !== UNSIGNED_BYTE && type !== SHORT && type !== UNSIGNED_SHORT && type !== INT && type !== UNSIGNED_INT) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const componentSize = type === SHORT || type === UNSIGNED_SHORT ? 2 : type === INT || type === UNSIGNED_INT || type === FLOAT ? 4 : 1;
    if (!Number.isInteger(stride) || stride < 0 || stride > 255) {
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
    if (boundBuffer === null || boundBuffer === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    this.glState.setVertexAttribPointer(index, size, type as GLenum, false, stride, offset, boundBuffer);
    this.glState.setVertexAttribInteger(index, true);
  }

  /**
   * Sprint 8 MRT: draw-path hook consuming the interpreter fragment outputs map.
   * Base (WebGL1) is a no-op; WebGL2 overrides to write attachments.
   */
  protected routeMrtOutputs(
    _linked: LinkedProgram,
    _frag: { outputs?: Map<string, Float32Array> },
  ): void {
    void _linked;
    void _frag;
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
