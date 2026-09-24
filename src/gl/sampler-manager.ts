// CHANGELOG: Sprint 8 Task 2 (2026-09-22): WebGL2 sampler objects — SamplerManager with 16-slot binding table and atomic validation matrix (ADR-013 constructor injection).
/** SamplerManager — WebGL2 sampler object lifecycle, binding table, parameter validation. L2: imports constants + errors only. */
import {
  ALWAYS,
  CLAMP_TO_EDGE,
  COMPARE_REF_TO_TEXTURE,
  EQUAL,
  GEQUAL,
  GREATER,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LEQUAL,
  LESS,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST,
  MIRRORED_REPEAT,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
  NEVER,
  NONE,
  NOTEQUAL,
  REPEAT,
  TEXTURE_COMPARE_FUNC,
  TEXTURE_COMPARE_MODE,
  TEXTURE_MAG_FILTER,
  TEXTURE_MAX_LOD,
  TEXTURE_MIN_FILTER,
  TEXTURE_MIN_LOD,
  TEXTURE_WRAP_R,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
} from './constants';
import type { GLenum } from './constants';
import type { IErrorSink } from './errors';

/** Extended sampler parameter state (texture SamplerParams plus LOD/compare state). */
export interface SamplerParamsExtended {
  wrapS: GLenum;
  wrapT: GLenum;
  wrapR: GLenum;
  minFilter: GLenum;
  magFilter: GLenum;
  minLod: number;
  maxLod: number;
  compareMode: GLenum;
  compareFunc: GLenum;
}

/** Internal sampler object state. */
export interface SamplerObject {
  readonly id: number;
  alive: boolean;
  params: SamplerParamsExtended;
  readonly handle: WebGLSampler;
}

/** Public WebGLSampler handle exposed to callers. */
export class WebGLSampler {
  readonly id: number;
  constructor(id: number) {
    this.id = id;
  }
}

/** Number of texture image units addressable by bindSampler. */
export const SAMPLER_BINDING_UNITS = 16;

function defaultParams(): SamplerParamsExtended {
  return {
    wrapS: REPEAT,
    wrapT: REPEAT,
    wrapR: REPEAT,
    minFilter: NEAREST_MIPMAP_LINEAR,
    magFilter: LINEAR,
    minLod: Math.fround(-1000),
    maxLod: Math.fround(1000),
    compareMode: NONE,
    compareFunc: LEQUAL,
  };
}

/** Sampler object manager with constructor-injected ErrorSink (ADR-013). */
export class SamplerManager {
  private readonly errorSink: IErrorSink;
  private nextSamplerId = 1;
  private readonly samplers = new Map<number, SamplerObject>();
  private readonly samplerBindings: Array<SamplerObject | null>;

  constructor(errorSink: IErrorSink) {
    this.errorSink = errorSink;
    this.samplerBindings = new Array<SamplerObject | null>(SAMPLER_BINDING_UNITS).fill(null);
  }

  /** Create a sampler with spec defaults; returns a public handle. */
  createSampler(): WebGLSampler {
    const id = this.nextSamplerId;
    this.nextSamplerId += 1;
    const handle = new WebGLSampler(id);
    const samplerObj: SamplerObject = { id, alive: true, params: defaultParams(), handle };
    this.samplers.set(id, samplerObj);
    return handle;
  }

  /** True iff candidate is a live sampler owned by this manager. */
  isSampler(candidate: WebGLSampler | null | undefined): boolean {
    if (candidate === null || candidate === undefined) return false;
    if (typeof candidate !== 'object' || typeof (candidate as WebGLSampler).id !== 'number') return false;
    const obj = this.samplers.get((candidate as WebGLSampler).id);
    return obj !== undefined && obj.alive === true;
  }

  /** Delete a sampler; unbinds all referencing units. Silent no-op for null/foreign/dead. */
  deleteSampler(candidate: WebGLSampler | null | undefined): void {
    if (candidate === null || candidate === undefined) return;
    if (!this.isSampler(candidate)) return;
    const obj = this.samplers.get((candidate as WebGLSampler).id);
    if (obj !== undefined) obj.alive = false;
    this.samplers.delete((candidate as WebGLSampler).id);
    for (let i = 0; i < this.samplerBindings.length; i++) {
      if (this.samplerBindings[i] !== null && this.samplerBindings[i]!.id === (candidate as WebGLSampler).id) {
        this.samplerBindings[i] = null;
      }
    }
  }

  /** Bind a sampler (or null to unbind) to a texture unit. */
  bindSampler(unit: number, candidate: WebGLSampler | null | undefined): void {
    if (!Number.isInteger(unit) || unit < 0 || unit >= SAMPLER_BINDING_UNITS) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (candidate === null || candidate === undefined) {
      this.samplerBindings[unit] = null;
      return;
    }
    if (!this.isSampler(candidate)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    this.samplerBindings[unit] = this.samplers.get(candidate.id) ?? null;
  }

  /** Return the bound sampler object for a unit (or null). No error semantics. */
  getBoundSampler(unit: number): SamplerObject | null {
    if (!Number.isInteger(unit) || unit < 0 || unit >= SAMPLER_BINDING_UNITS) return null;
    return this.samplerBindings[unit];
  }

  /** Return the bound sampler's public handle for a unit (SAMPLER_BINDING query; Sprint 12 Task 3). */
  getBoundSamplerHandle(unit: number): WebGLSampler | null {
    const bound = this.getBoundSampler(unit);
    return bound === null ? null : bound.handle;
  }

  /** Integer-valued parameter entry point. */
  samplerParameteri(sampler: WebGLSampler | null | undefined, pname: number, param: number): void {
    this.applySamplerParam(sampler, pname as GLenum, param, false);
  }

  /** Float-valued parameter entry point. */
  samplerParameterf(sampler: WebGLSampler | null | undefined, pname: number, param: number): void {
    this.applySamplerParam(sampler, pname as GLenum, param, true);
  }

  /** Query a sampler parameter; records errors per spec. */
  getSamplerParameter(sampler: WebGLSampler | null | undefined, pname: number): number | null {
    if (!this.isSampler(sampler as WebGLSampler)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const obj = this.samplers.get((sampler as WebGLSampler).id);
    if (obj === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const p = pname as GLenum;
    if (p === TEXTURE_WRAP_S) return obj.params.wrapS;
    if (p === TEXTURE_WRAP_T) return obj.params.wrapT;
    if (p === TEXTURE_WRAP_R) return obj.params.wrapR;
    if (p === TEXTURE_MIN_FILTER) return obj.params.minFilter;
    if (p === TEXTURE_MAG_FILTER) return obj.params.magFilter;
    if (p === TEXTURE_MIN_LOD) return obj.params.minLod;
    if (p === TEXTURE_MAX_LOD) return obj.params.maxLod;
    if (p === TEXTURE_COMPARE_MODE) return obj.params.compareMode;
    if (p === TEXTURE_COMPARE_FUNC) return obj.params.compareFunc;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  /** Atomic validated parameter store; no mutation on failure. */
  private applySamplerParam(
    sampler: WebGLSampler | null | undefined,
    pname: GLenum,
    param: number,
    _isFloat: boolean,
  ): void {
    void _isFloat;
    if (!this.isSampler(sampler as WebGLSampler)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const obj = this.samplers.get((sampler as WebGLSampler).id);
    if (obj === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (pname === TEXTURE_WRAP_S || pname === TEXTURE_WRAP_T || pname === TEXTURE_WRAP_R) {
      if (param !== CLAMP_TO_EDGE && param !== REPEAT && param !== MIRRORED_REPEAT) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      if (pname === TEXTURE_WRAP_S) obj.params.wrapS = param;
      else if (pname === TEXTURE_WRAP_T) obj.params.wrapT = param;
      else obj.params.wrapR = param;
      return;
    }
    if (pname === TEXTURE_MIN_FILTER) {
      if (
        param !== NEAREST &&
        param !== LINEAR &&
        param !== NEAREST_MIPMAP_NEAREST &&
        param !== LINEAR_MIPMAP_NEAREST &&
        param !== NEAREST_MIPMAP_LINEAR &&
        param !== LINEAR_MIPMAP_LINEAR
      ) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      obj.params.minFilter = param;
      return;
    }
    if (pname === TEXTURE_MAG_FILTER) {
      if (param !== NEAREST && param !== LINEAR) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      obj.params.magFilter = param;
      return;
    }
    if (pname === TEXTURE_MIN_LOD) {
      if (typeof param !== 'number' || !Number.isFinite(param)) {
        this.errorSink.recordError(INVALID_VALUE);
        return;
      }
      obj.params.minLod = Math.fround(param);
      return;
    }
    if (pname === TEXTURE_MAX_LOD) {
      if (typeof param !== 'number' || !Number.isFinite(param)) {
        this.errorSink.recordError(INVALID_VALUE);
        return;
      }
      obj.params.maxLod = Math.fround(param);
      return;
    }
    if (pname === TEXTURE_COMPARE_MODE) {
      if (param !== NONE && param !== COMPARE_REF_TO_TEXTURE) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      obj.params.compareMode = param;
      return;
    }
    if (pname === TEXTURE_COMPARE_FUNC) {
      if (
        param !== LEQUAL &&
        param !== GEQUAL &&
        param !== LESS &&
        param !== GREATER &&
        param !== EQUAL &&
        param !== NOTEQUAL &&
        param !== ALWAYS &&
        param !== NEVER
      ) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      obj.params.compareFunc = param;
      return;
    }
    this.errorSink.recordError(INVALID_ENUM);
  }
}
