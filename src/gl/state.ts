// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial GL state store with snapshot/restore
/** GLState — mutable WebGL 1.0 state vector with frozen PipelineState snapshots. L1: imports constants + errors only. */
import {
  ACTIVE_TEXTURE,
  ALWAYS,
  ARRAY_BUFFER,
  BACK,
  BLEND,
  BROWSER_DEFAULT_WEBGL,
  CCW,
  CULL_FACE,
  CW,
  DEPTH_TEST,
  DITHER,
  ELEMENT_ARRAY_BUFFER,
  FRAMEBUFFER,
  FRONT,
  FRONT_AND_BACK,
  FUNC_ADD,
  INVALID_ENUM,
  INVALID_VALUE,
  KEEP,
  LESS,
  ONE,
  PACK_ALIGNMENT,
  POLYGON_OFFSET_FILL,
  RENDERBUFFER,
  SAMPLE_ALPHA_TO_COVERAGE,
  SAMPLE_COVERAGE,
  SCISSOR_TEST,
  STENCIL_TEST,
  TEXTURE0,
  TEXTURE31,
  TEXTURE_2D,
  TEXTURE_CUBE_MAP,
  UNPACK_ALIGNMENT,
  UNPACK_COLORSPACE_CONVERSION_WEBGL,
  UNPACK_FLIP_Y_WEBGL,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL,
  VALID_BLEND_EQUATION_SET,
  VALID_BLEND_FACTOR_SET,
  VALID_BUFFER_TARGET_SET,
  VALID_CAPABILITY_SET,
  VALID_DEPTH_FUNC_SET,
  VALID_STENCIL_FUNC_SET,
  VALID_STENCIL_OP_SET,
  ZERO,
} from './constants';
import { FLOAT } from './constants';
import type { GLenum } from './constants';
import type { IErrorSink as IErrSink } from './errors';

export interface VertexAttribDescriptor {
  enabled: boolean;
  size: number;
  type: GLenum;
  normalized: boolean;
  stride: number;
  offset: number;
  buffer: unknown | null;
  divisor: number;
  genericValue: [number, number, number, number];
}

export interface ViewportRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BlendState {
  readonly srcRGB: GLenum;
  readonly dstRGB: GLenum;
  readonly srcAlpha: GLenum;
  readonly dstAlpha: GLenum;
  readonly equationRGB: GLenum;
  readonly equationAlpha: GLenum;
  readonly blendColor: readonly [number, number, number, number];
}

export interface DepthState {
  readonly func: GLenum;
  readonly mask: boolean;
  readonly range: readonly [number, number];
}

export interface StencilFaceState {
  readonly func: GLenum;
  readonly ref: number;
  readonly valueMask: number;
  readonly writeMask: number;
  readonly sfail: GLenum;
  readonly dpfail: GLenum;
  readonly dppass: GLenum;
}

export interface RasterState {
  readonly cullFaceMode: GLenum;
  readonly frontFace: GLenum;
  readonly lineWidth: number;
  readonly polygonOffsetFactor: number;
  readonly polygonOffsetUnits: number;
  readonly sampleCoverageValue: number;
  readonly sampleCoverageInvert: boolean;
}

export interface ClearValues {
  readonly clearColor: readonly [number, number, number, number];
  readonly clearDepth: number;
  readonly clearStencil: number;
}

export interface PipelineState {
  readonly viewport: ViewportRect;
  readonly scissorBox: ViewportRect;
  readonly scissorTestEnabled: boolean;
  readonly blend: BlendState;
  readonly blendEnabled: boolean;
  readonly depth: DepthState;
  readonly depthTestEnabled: boolean;
  readonly stencilFront: StencilFaceState;
  readonly stencilBack: StencilFaceState;
  readonly stencilTestEnabled: boolean;
  readonly raster: RasterState;
  readonly cullFaceEnabled: boolean;
  readonly ditherEnabled: boolean;
  readonly polygonOffsetFillEnabled: boolean;
  readonly sampleAlphaToCoverageEnabled: boolean;
  readonly sampleCoverageEnabled: boolean;
  readonly colorMask: readonly [boolean, boolean, boolean, boolean];
  readonly clearValues: ClearValues;
}

export interface CanvasDimensions {
  readonly width?: number;
  readonly height?: number;
}

export interface IGLState {
  setEnable(cap: GLenum, on: boolean): void;
  isEnabled(cap: GLenum): boolean;
  setViewport(x: number, y: number, width: number, height: number): void;
  getViewport(): readonly [number, number, number, number];
  setScissor(x: number, y: number, width: number, height: number): void;
  getScissor(): readonly [number, number, number, number];
  setClearColor(r: number, g: number, b: number, a: number): void;
  getClearColor(): readonly [number, number, number, number];
  setClearDepth(depth: number): void;
  getClearDepth(): number;
  setClearStencil(s: number): void;
  getClearStencil(): number;
  setColorMask(r: boolean, g: boolean, b: boolean, a: boolean): void;
  getColorMask(): readonly [boolean, boolean, boolean, boolean];
  setBlendFunc(sfactor: GLenum, dfactor: GLenum): void;
  setBlendFuncSeparate(srcRGB: GLenum, dstRGB: GLenum, srcAlpha: GLenum, dstAlpha: GLenum): void;
  setBlendEquation(mode: GLenum): void;
  setBlendEquationSeparate(modeRGB: GLenum, modeAlpha: GLenum): void;
  setBlendColor(red: number, green: number, blue: number, alpha: number): void;
  setDepthFunc(func: GLenum): void;
  setDepthMask(flag: boolean): void;
  setDepthRange(zNear: number, zFar: number): void;
  setStencilFunc(func: GLenum, ref: number, mask: number): void;
  setStencilFuncSeparate(face: GLenum, func: GLenum, ref: number, mask: number): void;
  setStencilOp(fail: GLenum, zfail: GLenum, zpass: GLenum): void;
  setStencilOpSeparate(face: GLenum, fail: GLenum, zfail: GLenum, zpass: GLenum): void;
  setStencilMask(mask: number): void;
  setStencilMaskSeparate(face: GLenum, mask: number): void;
  setCullFace(mode: GLenum): void;
  setFrontFace(mode: GLenum): void;
  setLineWidth(width: number): void;
  setPolygonOffset(factor: number, units: number): void;
  setSampleCoverage(value: number, invert: boolean): void;
  setPixelStorei(pname: GLenum, param: number | boolean): void;
  getPixelStorei(pname: GLenum): number | boolean;
  bindBuffer(target: GLenum, buffer: unknown | null): void;
  getBoundBuffer(target: GLenum): unknown | null;
  bindFramebuffer(target: GLenum, framebuffer: unknown | null): void;
  getBoundFramebuffer(target: GLenum): unknown | null;
  bindRenderbuffer(target: GLenum, renderbuffer: unknown | null): void;
  getBoundRenderbuffer(target: GLenum): unknown | null;
  bindTexture(target: GLenum, texture: unknown | null): void;
  getBoundTexture(target: GLenum): unknown | null;
  setActiveTexture(textureUnit: GLenum): void;
  getActiveTexture(): GLenum;
  useProgram(program: unknown | null): void;
  getCurrentProgram(): unknown | null;
  getVertexAttrib(index: number): Readonly<VertexAttribDescriptor> | null;
  setVertexAttribPointer(index: number, size: number, type: GLenum, normalized: boolean, stride: number, offset: number, buffer: unknown | null): void;
  enableVertexAttribArray(index: number): void;
  disableVertexAttribArray(index: number): void;
  setVertexAttribGeneric(index: number, value: readonly [number, number, number, number]): void;
  snapshot(): PipelineState;
  restore(snapshot: PipelineState): void;
}

const FULL_MASK = 4294967295;
const MAX_REF = 255;

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function toUint32(v: number): number {
  return v >>> 0;
}

function deepFreeze(obj: unknown): void {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) return;
  if (Object.isFrozen(obj)) return;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && (typeof val === 'object' || typeof val === 'function')) {
      deepFreeze(val);
    }
  }
}

export class GLState implements IGLState {
  private readonly errorSink: IErrSink;
  private capabilities = new Set<GLenum>();
  private viewport = { x: 0, y: 0, width: 300, height: 150 };
  private scissorBox = { x: 0, y: 0, width: 300, height: 150 };
  private clearColor: [number, number, number, number] = [0, 0, 0, 0];
  private clearDepth = 1;
  private clearStencil = 0;
  private colorMask: [boolean, boolean, boolean, boolean] = [true, true, true, true];
  private blendState = {
    srcRGB: ONE as GLenum,
    dstRGB: ZERO as GLenum,
    srcAlpha: ONE as GLenum,
    dstAlpha: ZERO as GLenum,
    equationRGB: FUNC_ADD as GLenum,
    equationAlpha: FUNC_ADD as GLenum,
    blendColor: [0, 0, 0, 0] as [number, number, number, number],
  };
  private depthState = { func: LESS as GLenum, mask: true, range: [0, 1] as [number, number] };
  private stencilFront = {
    func: ALWAYS as GLenum, ref: 0, valueMask: FULL_MASK, writeMask: FULL_MASK,
    sfail: KEEP as GLenum, dpfail: KEEP as GLenum, dppass: KEEP as GLenum,
  };
  private stencilBack = {
    func: ALWAYS as GLenum, ref: 0, valueMask: FULL_MASK, writeMask: FULL_MASK,
    sfail: KEEP as GLenum, dpfail: KEEP as GLenum, dppass: KEEP as GLenum,
  };
  private rasterState = {
    cullFaceMode: BACK as GLenum, frontFace: CCW as GLenum, lineWidth: 1,
    polygonOffsetFactor: 0, polygonOffsetUnits: 0, sampleCoverageValue: 1, sampleCoverageInvert: false,
  };
  private pixelStore = {
    packAlignment: 4, unpackAlignment: 4, unpackFlipY: false,
    unpackPremultiplyAlpha: false, unpackColorspaceConversion: BROWSER_DEFAULT_WEBGL as GLenum,
  };
  private activeTexture: GLenum = TEXTURE0;
  private boundArrayBuffer: unknown | null = null;
  private boundElementArrayBuffer: unknown | null = null;
  private boundFramebuffer: unknown | null = null;
  private boundRenderbuffer: unknown | null = null;
  private currentProgram: unknown | null = null;
  private attribs: VertexAttribDescriptor[] = [];
  private textureUnits: Array<{ binding2D: unknown | null; bindingCube: unknown | null }> = [];
  private canvasWidth = 300;
  private canvasHeight = 150;

  constructor(errorSink: IErrSink, canvas?: CanvasDimensions) {
    this.errorSink = errorSink;
    let w = 300;
    let h = 150;
    if (canvas !== undefined) {
      if (typeof canvas.width === 'number' && Number.isFinite(canvas.width) && canvas.width > 0) w = Math.trunc(canvas.width);
      if (typeof canvas.height === 'number' && Number.isFinite(canvas.height) && canvas.height > 0) h = Math.trunc(canvas.height);
    }
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.viewport = { x: 0, y: 0, width: w, height: h };
    this.scissorBox = { x: 0, y: 0, width: w, height: h };
    this.textureUnits = Array.from({ length: 32 }, () => ({ binding2D: null, bindingCube: null }));
    this.attribs = Array.from({ length: 16 }, () => ({
      enabled: false, size: 4, type: FLOAT as GLenum, normalized: false,
      stride: 0, offset: 0, buffer: null, divisor: 0, genericValue: [0, 0, 0, 1] as [number, number, number, number],
    }));
    void ACTIVE_TEXTURE; void ARRAY_BUFFER; void ELEMENT_ARRAY_BUFFER; void FRAMEBUFFER;
    void RENDERBUFFER; void TEXTURE_2D; void TEXTURE_CUBE_MAP;
  }

  setEnable(cap: GLenum, on: boolean): void {
    if (!VALID_CAPABILITY_SET.has(cap)) { this.errorSink.recordError(INVALID_ENUM); return; }
    if (on) this.capabilities.add(cap); else this.capabilities.delete(cap);
  }

  isEnabled(cap: GLenum): boolean {
    if (!VALID_CAPABILITY_SET.has(cap)) { this.errorSink.recordError(INVALID_ENUM); return false; }
    return this.capabilities.has(cap);
  }

  setViewport(x: number, y: number, width: number, height: number): void {
    if (width < 0 || height < 0) { this.errorSink.recordError(INVALID_VALUE); return; }
    this.viewport = { x: Math.trunc(x), y: Math.trunc(y), width: Math.trunc(width), height: Math.trunc(height) };
  }

  getViewport(): readonly [number, number, number, number] {
    return [this.viewport.x, this.viewport.y, this.viewport.width, this.viewport.height];
  }

  setScissor(x: number, y: number, width: number, height: number): void {
    if (width < 0 || height < 0) { this.errorSink.recordError(INVALID_VALUE); return; }
    this.scissorBox = { x: Math.trunc(x), y: Math.trunc(y), width: Math.trunc(width), height: Math.trunc(height) };
  }

  getScissor(): readonly [number, number, number, number] {
    return [this.scissorBox.x, this.scissorBox.y, this.scissorBox.width, this.scissorBox.height];
  }

  setClearColor(r: number, g: number, b: number, a: number): void {
    this.clearColor = [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
  }

  getClearColor(): readonly [number, number, number, number] {
    return [this.clearColor[0], this.clearColor[1], this.clearColor[2], this.clearColor[3]];
  }

  setClearDepth(depth: number): void {
    this.clearDepth = clamp01(depth);
  }

  getClearDepth(): number { return this.clearDepth; }

  setClearStencil(s: number): void {
    this.clearStencil = toUint32(Math.trunc(s));
  }

  getClearStencil(): number { return this.clearStencil; }

  setColorMask(r: boolean, g: boolean, b: boolean, a: boolean): void {
    this.colorMask = [Boolean(r), Boolean(g), Boolean(b), Boolean(a)];
  }

  getColorMask(): readonly [boolean, boolean, boolean, boolean] {
    return [this.colorMask[0], this.colorMask[1], this.colorMask[2], this.colorMask[3]];
  }

  setBlendFunc(sfactor: GLenum, dfactor: GLenum): void {
    this.setBlendFuncSeparate(sfactor, dfactor, sfactor, dfactor);
  }

  setBlendFuncSeparate(srcRGB: GLenum, dstRGB: GLenum, srcAlpha: GLenum, dstAlpha: GLenum): void {
    if (!VALID_BLEND_FACTOR_SET.has(srcRGB) || !VALID_BLEND_FACTOR_SET.has(dstRGB) ||
        !VALID_BLEND_FACTOR_SET.has(srcAlpha) || !VALID_BLEND_FACTOR_SET.has(dstAlpha)) {
      this.errorSink.recordError(INVALID_ENUM); return;
    }
    this.blendState.srcRGB = srcRGB; this.blendState.dstRGB = dstRGB;
    this.blendState.srcAlpha = srcAlpha; this.blendState.dstAlpha = dstAlpha;
  }

  setBlendEquation(mode: GLenum): void {
    this.setBlendEquationSeparate(mode, mode);
  }

  setBlendEquationSeparate(modeRGB: GLenum, modeAlpha: GLenum): void {
    if (!VALID_BLEND_EQUATION_SET.has(modeRGB) || !VALID_BLEND_EQUATION_SET.has(modeAlpha)) {
      this.errorSink.recordError(INVALID_ENUM); return;
    }
    this.blendState.equationRGB = modeRGB; this.blendState.equationAlpha = modeAlpha;
  }

  setBlendColor(red: number, green: number, blue: number, alpha: number): void {
    this.blendState.blendColor = [clamp01(red), clamp01(green), clamp01(blue), clamp01(alpha)];
  }

  setDepthFunc(func: GLenum): void {
    if (!VALID_DEPTH_FUNC_SET.has(func)) { this.errorSink.recordError(INVALID_ENUM); return; }
    this.depthState.func = func;
  }

  setDepthMask(flag: boolean): void {
    this.depthState.mask = Boolean(flag);
  }

  setDepthRange(zNear: number, zFar: number): void {
    this.depthState.range = [clamp01(zNear), clamp01(zFar)];
  }

  setStencilFunc(func: GLenum, ref: number, mask: number): void {
    this.setStencilFuncSeparate(FRONT_AND_BACK, func, ref, mask);
  }

  setStencilFuncSeparate(face: GLenum, func: GLenum, ref: number, mask: number): void {
    if (face !== FRONT && face !== BACK && face !== FRONT_AND_BACK) { this.errorSink.recordError(INVALID_ENUM); return; }
    if (!VALID_STENCIL_FUNC_SET.has(func)) { this.errorSink.recordError(INVALID_ENUM); return; }
    const refC = Math.min(Math.max(Math.trunc(ref), 0), MAX_REF);
    const maskU = toUint32(Math.trunc(mask));
    if (face === FRONT || face === FRONT_AND_BACK) {
      this.stencilFront.func = func; this.stencilFront.ref = refC; this.stencilFront.valueMask = maskU;
    }
    if (face === BACK || face === FRONT_AND_BACK) {
      this.stencilBack.func = func; this.stencilBack.ref = refC; this.stencilBack.valueMask = maskU;
    }
  }

  setStencilOp(fail: GLenum, zfail: GLenum, zpass: GLenum): void {
    this.setStencilOpSeparate(FRONT_AND_BACK, fail, zfail, zpass);
  }

  setStencilOpSeparate(face: GLenum, fail: GLenum, zfail: GLenum, zpass: GLenum): void {
    if (face !== FRONT && face !== BACK && face !== FRONT_AND_BACK) { this.errorSink.recordError(INVALID_ENUM); return; }
    if (!VALID_STENCIL_OP_SET.has(fail) || !VALID_STENCIL_OP_SET.has(zfail) || !VALID_STENCIL_OP_SET.has(zpass)) {
      this.errorSink.recordError(INVALID_ENUM); return;
    }
    if (face === FRONT || face === FRONT_AND_BACK) {
      this.stencilFront.sfail = fail; this.stencilFront.dpfail = zfail; this.stencilFront.dppass = zpass;
    }
    if (face === BACK || face === FRONT_AND_BACK) {
      this.stencilBack.sfail = fail; this.stencilBack.dpfail = zfail; this.stencilBack.dppass = zpass;
    }
  }

  setStencilMask(mask: number): void {
    this.setStencilMaskSeparate(FRONT_AND_BACK, mask);
  }

  setStencilMaskSeparate(face: GLenum, mask: number): void {
    if (face !== FRONT && face !== BACK && face !== FRONT_AND_BACK) { this.errorSink.recordError(INVALID_ENUM); return; }
    const maskU = toUint32(Math.trunc(mask));
    if (face === FRONT || face === FRONT_AND_BACK) this.stencilFront.writeMask = maskU;
    if (face === BACK || face === FRONT_AND_BACK) this.stencilBack.writeMask = maskU;
  }

  setCullFace(mode: GLenum): void {
    if (mode !== FRONT && mode !== BACK && mode !== FRONT_AND_BACK) { this.errorSink.recordError(INVALID_ENUM); return; }
    this.rasterState.cullFaceMode = mode;
  }

  setFrontFace(mode: GLenum): void {
    if (mode !== CW && mode !== CCW) { this.errorSink.recordError(INVALID_ENUM); return; }
    this.rasterState.frontFace = mode;
  }

  setLineWidth(width: number): void {
    if (!Number.isFinite(width) || width <= 0) { this.errorSink.recordError(INVALID_VALUE); return; }
    this.rasterState.lineWidth = width;
  }

  setPolygonOffset(factor: number, units: number): void {
    this.rasterState.polygonOffsetFactor = factor;
    this.rasterState.polygonOffsetUnits = units;
  }

  setSampleCoverage(value: number, invert: boolean): void {
    this.rasterState.sampleCoverageValue = clamp01(value);
    this.rasterState.sampleCoverageInvert = Boolean(invert);
  }

  setPixelStorei(pname: GLenum, param: number | boolean): void {
    if (pname === UNPACK_ALIGNMENT || pname === PACK_ALIGNMENT) {
      if (param !== 1 && param !== 2 && param !== 4 && param !== 8) { this.errorSink.recordError(INVALID_VALUE); return; }
      if (pname === UNPACK_ALIGNMENT) this.pixelStore.unpackAlignment = param as number;
      else this.pixelStore.packAlignment = param as number;
      return;
    }
    if (pname === UNPACK_FLIP_Y_WEBGL) { this.pixelStore.unpackFlipY = Boolean(param); return; }
    if (pname === UNPACK_PREMULTIPLY_ALPHA_WEBGL) { this.pixelStore.unpackPremultiplyAlpha = Boolean(param); return; }
    if (pname === UNPACK_COLORSPACE_CONVERSION_WEBGL) {
      if (param !== BROWSER_DEFAULT_WEBGL && param !== ZERO) { this.errorSink.recordError(INVALID_VALUE); return; }
      this.pixelStore.unpackColorspaceConversion = param as GLenum;
      return;
    }
    this.errorSink.recordError(INVALID_ENUM);
  }

  getPixelStorei(pname: GLenum): number | boolean {
    if (pname === UNPACK_ALIGNMENT) return this.pixelStore.unpackAlignment;
    if (pname === PACK_ALIGNMENT) return this.pixelStore.packAlignment;
    if (pname === UNPACK_FLIP_Y_WEBGL) return this.pixelStore.unpackFlipY;
    if (pname === UNPACK_PREMULTIPLY_ALPHA_WEBGL) return this.pixelStore.unpackPremultiplyAlpha;
    if (pname === UNPACK_COLORSPACE_CONVERSION_WEBGL) return this.pixelStore.unpackColorspaceConversion;
    this.errorSink.recordError(INVALID_ENUM);
    return 0;
  }

  bindBuffer(target: GLenum, buffer: unknown | null): void {
    if (!VALID_BUFFER_TARGET_SET.has(target)) { this.errorSink.recordError(INVALID_ENUM); return; }
    if (target === ARRAY_BUFFER) this.boundArrayBuffer = buffer;
    else if (target === ELEMENT_ARRAY_BUFFER) this.boundElementArrayBuffer = buffer;
    else { this.errorSink.recordError(INVALID_ENUM); return; }
  }

  getBoundBuffer(target: GLenum): unknown | null {
    if (target === ARRAY_BUFFER) return this.boundArrayBuffer;
    if (target === ELEMENT_ARRAY_BUFFER) return this.boundElementArrayBuffer;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  bindFramebuffer(target: GLenum, framebuffer: unknown | null): void {
    if (target !== FRAMEBUFFER) { this.errorSink.recordError(INVALID_ENUM); return; }
    this.boundFramebuffer = framebuffer;
  }

  getBoundFramebuffer(target: GLenum): unknown | null {
    if (target !== FRAMEBUFFER) { this.errorSink.recordError(INVALID_ENUM); return null; }
    return this.boundFramebuffer;
  }

  bindRenderbuffer(target: GLenum, renderbuffer: unknown | null): void {
    if (target !== RENDERBUFFER) { this.errorSink.recordError(INVALID_ENUM); return; }
    this.boundRenderbuffer = renderbuffer;
  }

  getBoundRenderbuffer(target: GLenum): unknown | null {
    if (target !== RENDERBUFFER) { this.errorSink.recordError(INVALID_ENUM); return null; }
    return this.boundRenderbuffer;
  }

  bindTexture(target: GLenum, texture: unknown | null): void {
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP) { this.errorSink.recordError(INVALID_ENUM); return; }
    const idx = this.activeTexture - TEXTURE0;
    if (idx < 0 || idx >= 32) { this.errorSink.recordError(INVALID_ENUM); return; }
    const unit = this.textureUnits[idx];
    if (unit === undefined) { this.errorSink.recordError(INVALID_ENUM); return; }
    if (target === TEXTURE_2D) unit.binding2D = texture;
    else unit.bindingCube = texture;
  }

  getBoundTexture(target: GLenum): unknown | null {
    const idx = this.activeTexture - TEXTURE0;
    if (idx < 0 || idx >= 32) { this.errorSink.recordError(INVALID_ENUM); return null; }
    const unit = this.textureUnits[idx];
    if (unit === undefined) { this.errorSink.recordError(INVALID_ENUM); return null; }
    if (target === TEXTURE_2D) return unit.binding2D;
    if (target === TEXTURE_CUBE_MAP) return unit.bindingCube;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  setActiveTexture(textureUnit: GLenum): void {
    if (textureUnit < TEXTURE0 || textureUnit > TEXTURE31) { this.errorSink.recordError(INVALID_ENUM); return; }
    this.activeTexture = textureUnit;
  }

  getActiveTexture(): GLenum { return this.activeTexture; }

  useProgram(program: unknown | null): void {
    this.currentProgram = program;
  }

  getCurrentProgram(): unknown | null { return this.currentProgram; }

  getVertexAttrib(index: number): Readonly<VertexAttribDescriptor> | null {
    if (!Number.isInteger(index) || index < 0 || index >= 16) { this.errorSink.recordError(INVALID_VALUE); return null; }
    return this.attribs[index] as VertexAttribDescriptor;
  }

  setVertexAttribPointer(index: number, size: number, type: GLenum, normalized: boolean, stride: number, offset: number, buffer: unknown | null): void {
    if (!Number.isInteger(index) || index < 0 || index >= 16) { this.errorSink.recordError(INVALID_VALUE); return; }
    const desc = this.attribs[index] as VertexAttribDescriptor;
    desc.size = size; desc.type = type; desc.normalized = normalized;
    desc.stride = stride; desc.offset = offset; desc.buffer = buffer;
  }

  enableVertexAttribArray(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= 16) { this.errorSink.recordError(INVALID_VALUE); return; }
    (this.attribs[index] as VertexAttribDescriptor).enabled = true;
  }

  disableVertexAttribArray(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= 16) { this.errorSink.recordError(INVALID_VALUE); return; }
    (this.attribs[index] as VertexAttribDescriptor).enabled = false;
  }

  setVertexAttribGeneric(index: number, value: readonly [number, number, number, number]): void {
    if (!Number.isInteger(index) || index < 0 || index >= 16) { this.errorSink.recordError(INVALID_VALUE); return; }
    (this.attribs[index] as VertexAttribDescriptor).genericValue = [value[0], value[1], value[2], value[3]];
  }

  snapshot(): PipelineState {
    const snap: PipelineState = {
      viewport: { ...this.viewport },
      scissorBox: { ...this.scissorBox },
      scissorTestEnabled: this.capabilities.has(SCISSOR_TEST),
      blend: {
        srcRGB: this.blendState.srcRGB, dstRGB: this.blendState.dstRGB,
        srcAlpha: this.blendState.srcAlpha, dstAlpha: this.blendState.dstAlpha,
        equationRGB: this.blendState.equationRGB, equationAlpha: this.blendState.equationAlpha,
        blendColor: [...this.blendState.blendColor] as [number, number, number, number],
      },
      blendEnabled: this.capabilities.has(BLEND),
      depth: {
        func: this.depthState.func, mask: this.depthState.mask,
        range: [...this.depthState.range] as [number, number],
      },
      depthTestEnabled: this.capabilities.has(DEPTH_TEST),
      stencilFront: { ...this.stencilFront },
      stencilBack: { ...this.stencilBack },
      stencilTestEnabled: this.capabilities.has(STENCIL_TEST),
      raster: {
        cullFaceMode: this.rasterState.cullFaceMode, frontFace: this.rasterState.frontFace,
        lineWidth: this.rasterState.lineWidth, polygonOffsetFactor: this.rasterState.polygonOffsetFactor,
        polygonOffsetUnits: this.rasterState.polygonOffsetUnits,
        sampleCoverageValue: this.rasterState.sampleCoverageValue,
        sampleCoverageInvert: this.rasterState.sampleCoverageInvert,
      },
      cullFaceEnabled: this.capabilities.has(CULL_FACE),
      ditherEnabled: this.capabilities.has(DITHER),
      polygonOffsetFillEnabled: this.capabilities.has(POLYGON_OFFSET_FILL),
      sampleAlphaToCoverageEnabled: this.capabilities.has(SAMPLE_ALPHA_TO_COVERAGE),
      sampleCoverageEnabled: this.capabilities.has(SAMPLE_COVERAGE),
      colorMask: [...this.colorMask] as [boolean, boolean, boolean, boolean],
      clearValues: {
        clearColor: [...this.clearColor] as [number, number, number, number],
        clearDepth: this.clearDepth, clearStencil: this.clearStencil,
      },
    };
    deepFreeze(snap);
    return snap;
  }

  /**
   * Reset all mutable state to WebGL 1.0 spec defaults.
   *
   * Restores viewport/scissor to [0, 0, w, h], clears capabilities,
   * clear values, blend/depth/stencil/raster/pixel-store state, all
   * bindings, and vertex attribute descriptors.
   */
  resetToDefaults(): void {
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    this.capabilities.clear();
    this.viewport = { x: 0, y: 0, width: w, height: h };
    this.scissorBox = { x: 0, y: 0, width: w, height: h };
    this.clearColor = [0, 0, 0, 0];
    this.clearDepth = 1;
    this.clearStencil = 0;
    this.colorMask = [true, true, true, true];
    this.depthState = { func: LESS as GLenum, mask: true, range: [0, 1] as [number, number] };
    this.blendState = {
      srcRGB: ONE as GLenum,
      dstRGB: ZERO as GLenum,
      srcAlpha: ONE as GLenum,
      dstAlpha: ZERO as GLenum,
      equationRGB: FUNC_ADD as GLenum,
      equationAlpha: FUNC_ADD as GLenum,
      blendColor: [0, 0, 0, 0] as [number, number, number, number],
    };
    this.stencilFront = {
      func: ALWAYS as GLenum, ref: 0, valueMask: FULL_MASK, writeMask: FULL_MASK,
      sfail: KEEP as GLenum, dpfail: KEEP as GLenum, dppass: KEEP as GLenum,
    };
    this.stencilBack = {
      func: ALWAYS as GLenum, ref: 0, valueMask: FULL_MASK, writeMask: FULL_MASK,
      sfail: KEEP as GLenum, dpfail: KEEP as GLenum, dppass: KEEP as GLenum,
    };
    this.rasterState = {
      cullFaceMode: BACK as GLenum, frontFace: CCW as GLenum, lineWidth: 1,
      polygonOffsetFactor: 0, polygonOffsetUnits: 0, sampleCoverageValue: 1, sampleCoverageInvert: false,
    };
    this.pixelStore = {
      packAlignment: 4, unpackAlignment: 4, unpackFlipY: false,
      unpackPremultiplyAlpha: false, unpackColorspaceConversion: BROWSER_DEFAULT_WEBGL as GLenum,
    };
    this.boundArrayBuffer = null;
    this.boundElementArrayBuffer = null;
    this.boundFramebuffer = null;
    this.boundRenderbuffer = null;
    this.currentProgram = null;
    this.activeTexture = TEXTURE0;
    for (const unit of this.textureUnits) {
      unit.binding2D = null;
      unit.bindingCube = null;
    }
    for (const attrib of this.attribs) {
      attrib.enabled = false;
      attrib.size = 4;
      attrib.type = FLOAT as GLenum;
      attrib.normalized = false;
      attrib.stride = 0;
      attrib.offset = 0;
      attrib.buffer = null;
      attrib.divisor = 0;
      attrib.genericValue = [0, 0, 0, 1];
    }
  }

  restore(snapshot: PipelineState): void {
    this.viewport = { ...snapshot.viewport };
    this.scissorBox = { ...snapshot.scissorBox };
    const setCap = (cap: GLenum, on: boolean): void => {
      if (on) this.capabilities.add(cap); else this.capabilities.delete(cap);
    };
    setCap(SCISSOR_TEST, snapshot.scissorTestEnabled);
    setCap(BLEND, snapshot.blendEnabled);
    setCap(DEPTH_TEST, snapshot.depthTestEnabled);
    setCap(STENCIL_TEST, snapshot.stencilTestEnabled);
    setCap(CULL_FACE, snapshot.cullFaceEnabled);
    setCap(DITHER, snapshot.ditherEnabled);
    setCap(POLYGON_OFFSET_FILL, snapshot.polygonOffsetFillEnabled);
    setCap(SAMPLE_ALPHA_TO_COVERAGE, snapshot.sampleAlphaToCoverageEnabled);
    setCap(SAMPLE_COVERAGE, snapshot.sampleCoverageEnabled);
    this.blendState = {
      srcRGB: snapshot.blend.srcRGB, dstRGB: snapshot.blend.dstRGB,
      srcAlpha: snapshot.blend.srcAlpha, dstAlpha: snapshot.blend.dstAlpha,
      equationRGB: snapshot.blend.equationRGB, equationAlpha: snapshot.blend.equationAlpha,
      blendColor: [...snapshot.blend.blendColor] as [number, number, number, number],
    };
    this.depthState = {
      func: snapshot.depth.func, mask: snapshot.depth.mask,
      range: [...snapshot.depth.range] as [number, number],
    };
    this.stencilFront = { ...snapshot.stencilFront };
    this.stencilBack = { ...snapshot.stencilBack };
    this.rasterState = { ...snapshot.raster };
    this.colorMask = [...snapshot.colorMask] as [boolean, boolean, boolean, boolean];
    this.clearColor = [...snapshot.clearValues.clearColor] as [number, number, number, number];
    this.clearDepth = snapshot.clearValues.clearDepth;
    this.clearStencil = snapshot.clearValues.clearStencil;
  }
}
