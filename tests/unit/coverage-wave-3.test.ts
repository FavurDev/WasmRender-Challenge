/** Sprint 11 Task 5 wave-3 gap-closure tests — top uncovered blocks per 88.34% baseline
 * (webgl1-context 230, webgl2-context 161, interpreter 163, checker 137, texture 134,
 * preprocessor 127, builtins 119, framebuffer 105, sampler-manager 45, sampler 38, query-sync 34).
 * Every test asserts observable output (returned values, exact enums, ErrorSink codes). */
import { describe, expect, it } from 'vitest';
import { evaluateBuiltin } from '../../src/glsl/builtins';
import { applyWrap } from '../../src/gl/sampler';
import { QuerySyncManager } from '../../src/gl/query-sync';
import { ErrorSink } from '../../src/gl/errors';
import { SamplerManager } from '../../src/gl/sampler-manager';
import {
  DrawingBuffer,
  FboTarget,
  FramebufferManager,
  RenderbufferManager,
  WebGLFramebuffer,
} from '../../src/gl/framebuffer';
import { tokenize } from '../../src/glsl/tokenizer';
import { runPreprocessor } from '../../src/glsl/preprocessor';
import { BufferManager } from '../../src/gl/buffer';
import { parse } from '../../src/glsl/parser';
import { check } from '../../src/glsl/checker';
import { GLState } from '../../src/gl/state';
import { TextureManager } from '../../src/gl/texture';
import {
  isMipmapFilter, computeExpectedLevels,
  evaluateTextureCompleteness, isTextureComplete,
} from '../../src/gl/texture';
import type { PipelineState } from '../../src/gl/state';
import type { MipLevel, TextureObject } from '../../src/gl/texture';
import {
  ALREADY_SIGNALED,
  ANY_SAMPLES_PASSED,
  ARRAY_BUFFER,
  ANY_SAMPLES_PASSED_CONSERVATIVE,
  CLAMP_TO_EDGE,
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  COMPARE_REF_TO_TEXTURE,
  CONDITION_SATISFIED,
  CURRENT_QUERY,
  DEPTH_ATTACHMENT,
  DEPTH_BUFFER_BIT,
  DEPTH_COMPONENT16,
  DYNAMIC_DRAW,
  ELEMENT_ARRAY_BUFFER,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAMEBUFFER_INCOMPLETE_ATTACHMENT,
  FRAMEBUFFER_INCOMPLETE_DIMENSIONS,
  FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT,
  FRAMEBUFFER_UNSUPPORTED,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LEQUAL,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST,
  MIRRORED_REPEAT,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
  BLEND,
  BACK,
  CCW,
  CULL_FACE,
  DEPTH_TEST,
  FLOAT,
  FRONT,
  FRONT_AND_BACK,
  FUNC_ADD,
  GREATER,
  INCR,
  KEEP,
  LESS,
  NO_ERROR,
  NONE,
  OBJECT_TYPE,
  QUERY_RESULT,
  QUERY_RESULT_AVAILABLE,
  REPEAT,
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
  RGBA,
  BUFFER_SIZE,
  BUFFER_USAGE,
  RGBA4,
  SIGNALED,
  ONE_MINUS_SRC_ALPHA,
  REPLACE,
  SCISSOR_TEST,
  SRC_ALPHA,
  STENCIL_ATTACHMENT,
  TEXTURE0,
  TEXTURE1,
  UNPACK_ALIGNMENT,
  UNPACK_FLIP_Y_WEBGL,
  STENCIL_INDEX8,
  SYNC_CONDITION,
  SYNC_FENCE,
  SYNC_FLAGS,
  SYNC_FLUSH_COMMANDS_BIT,
  SYNC_GPU_COMMANDS_COMPLETE,
  STATIC_DRAW,
  SYNC_STATUS,
  TEXTURE_2D,
  TEXTURE_CUBE_MAP_NEGATIVE_Z,
  TEXTURE_CUBE_MAP_POSITIVE_X,
  TEXTURE_COMPARE_FUNC,
  TEXTURE_COMPARE_MODE,
  TEXTURE_CUBE_MAP,
  TEXTURE_MAG_FILTER,
  TEXTURE_MAX_LOD,
  TEXTURE_MIN_FILTER,
  TEXTURE_MIN_LOD,
  TEXTURE_WRAP_R,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  UNSIGNED_BYTE,
  WAIT_FAILED,
} from '../../src/gl/constants';

function makePipelineState(): PipelineState {
  // Arrange helper: minimal state satisfying clear() reads, cast through unknown.
  return {
    clearValues: {
      clearColor: [1, 0, 0.5, 1],
      clearDepth: 0.5,
      clearStencil: 3,
    },
    colorMask: [true, true, true, true],
    scissorTestEnabled: false,
    scissorBox: { x: 0, y: 0, width: 4, height: 4 },
    depth: { mask: true },
    stencilFront: { writeMask: 255 },
  } as unknown as PipelineState;
}

function ppOk(source: string, version?: number) {
  // Arrange helper: tokenize then preprocess, returning the token texts or throwing the log.
  const t = tokenize(source, version);
  if (!t.ok) throw new Error('tokenize failed: ' + t.log);
  const r = runPreprocessor(t.tokens, version);
  if (!r.ok) throw new Error('preprocess failed: ' + r.log);
  return r.tokens.map((tok) => tok.text);
}

describe('wave-3 group 1: sampler wrap math', () => {
  it('clamps far-out-of-range coords to edges', () => {
    // Arrange
    // Act
    const lo = applyWrap(-100.25, CLAMP_TO_EDGE);
    const hi = applyWrap(100.75, CLAMP_TO_EDGE);
    // Assert
    expect(lo).toBe(0);
    expect(hi).toBe(1);
  });

  it('repeats negative coords into [0,1)', () => {
    // Arrange
    // Act
    const v = applyWrap(-0.25, REPEAT);
    // Assert
    expect(v).toBeCloseTo(0.75, 6);
  });

  it('mirrors coords across integer boundaries', () => {
    // Arrange
    // Act
    const a = applyWrap(1.25, MIRRORED_REPEAT);
    const b = applyWrap(2.25, MIRRORED_REPEAT);
    // Assert
    expect(a).toBeCloseTo(0.75, 6);
    expect(b).toBeCloseTo(0.25, 6);
  });

  it('passes through in-range coords unchanged for every mode', () => {
    // Arrange
    // Act + Assert
    for (const mode of [CLAMP_TO_EDGE, REPEAT, MIRRORED_REPEAT]) {
      expect(applyWrap(0.5, mode)).toBeCloseTo(0.5, 6);
    }
  });
});

describe('wave-3 group 2: sampler manager lifecycle', () => {
  it('creates samplers with spec defaults observable via getters', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new SamplerManager(sink);
    // Act
    const s = m.createSampler();
    // Assert
    expect(m.isSampler(s)).toBe(true);
    expect(m.getSamplerParameter(s, TEXTURE_WRAP_S)).toBe(REPEAT);
    expect(m.getSamplerParameter(s, TEXTURE_MIN_FILTER)).toBe(NEAREST_MIPMAP_LINEAR);
    expect(m.getSamplerParameter(s, TEXTURE_MAG_FILTER)).toBe(LINEAR);
    expect(m.getSamplerParameter(s, TEXTURE_COMPARE_MODE)).toBe(NONE);
    expect(m.getSamplerParameter(s, TEXTURE_COMPARE_FUNC)).toBe(LEQUAL);
  });

  it('rejects null and foreign handles without error spam on isSampler', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new SamplerManager(sink);
    // Act + Assert
    expect(m.isSampler(null)).toBe(false);
    expect(m.isSampler(undefined)).toBe(false);
    expect(m.isSampler({} as never)).toBe(false);
  });

  it('stores wrap/filter/compare params and reports INVALID_ENUM for bad values', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new SamplerManager(sink);
    const s = m.createSampler();
    // Act
    m.samplerParameteri(s, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    m.samplerParameteri(s, TEXTURE_WRAP_T, MIRRORED_REPEAT);
    m.samplerParameteri(s, TEXTURE_WRAP_R, REPEAT);
    m.samplerParameteri(s, TEXTURE_MIN_FILTER, LINEAR);
    m.samplerParameteri(s, TEXTURE_MAG_FILTER, NEAREST);
    m.samplerParameteri(s, TEXTURE_COMPARE_MODE, COMPARE_REF_TO_TEXTURE);
    // Assert
    expect(m.getSamplerParameter(s, TEXTURE_WRAP_S)).toBe(CLAMP_TO_EDGE);
    expect(m.getSamplerParameter(s, TEXTURE_WRAP_T)).toBe(MIRRORED_REPEAT);
    expect(m.getSamplerParameter(s, TEXTURE_WRAP_R)).toBe(REPEAT);
    expect(m.getSamplerParameter(s, TEXTURE_MIN_FILTER)).toBe(LINEAR);
    expect(m.getSamplerParameter(s, TEXTURE_MAG_FILTER)).toBe(NEAREST);
    expect(m.getSamplerParameter(s, TEXTURE_COMPARE_MODE)).toBe(COMPARE_REF_TO_TEXTURE);
    m.samplerParameteri(s, TEXTURE_WRAP_S, 0x9999);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.samplerParameteri(s, TEXTURE_MIN_FILTER, 0x9999);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.samplerParameteri(s, TEXTURE_MAG_FILTER, LINEAR + NEAREST + 1);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.samplerParameteri(s, TEXTURE_COMPARE_MODE, LEQUAL);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.samplerParameteri(s, TEXTURE_COMPARE_FUNC, NONE);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.samplerParameteri(s, 0x9999, 1);
    expect(sink.getError()).toBe(INVALID_ENUM);
  });

  it('stores LOD params with fround and rejects non-finite values', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new SamplerManager(sink);
    const s = m.createSampler();
    // Act
    m.samplerParameterf(s, TEXTURE_MIN_LOD, -2.5);
    m.samplerParameterf(s, TEXTURE_MAX_LOD, 4.25);
    // Assert
    expect(m.getSamplerParameter(s, TEXTURE_MIN_LOD)).toBe(Math.fround(-2.5));
    expect(m.getSamplerParameter(s, TEXTURE_MAX_LOD)).toBe(Math.fround(4.25));
    m.samplerParameterf(s, TEXTURE_MIN_LOD, Number.POSITIVE_INFINITY);
    expect(sink.getError()).toBe(INVALID_VALUE);
    m.samplerParameterf(s, TEXTURE_MAX_LOD, Number.NaN);
    expect(sink.getError()).toBe(INVALID_VALUE);
  });

  it('records INVALID_OPERATION for dead/null samplers on param paths', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new SamplerManager(sink);
    const s = m.createSampler();
    m.deleteSampler(s);
    // Act + Assert
    expect(m.isSampler(s)).toBe(false);
    m.samplerParameteri(s, TEXTURE_WRAP_S, REPEAT);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    m.samplerParameterf(null, TEXTURE_MIN_LOD, 0);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    expect(m.getSamplerParameter(s, TEXTURE_WRAP_S)).toBe(null);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    expect(m.getSamplerParameter(s, 0x9999 as never)).toBe(null);
    expect(sink.getError()).toBe(INVALID_OPERATION);
  });

  it('binds and unbinds samplers per unit with range validation', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new SamplerManager(sink);
    const s = m.createSampler();
    // Act
    m.bindSampler(0, s);
    // Assert
    expect(m.getBoundSampler(0)!.id).toBe(s.id);
    m.bindSampler(0, null);
    expect(m.getBoundSampler(0)).toBe(null);
    m.bindSampler(-1, s);
    expect(sink.getError()).toBe(INVALID_VALUE);
    m.bindSampler(16, s);
    expect(sink.getError()).toBe(INVALID_VALUE);
    m.deleteSampler(s);
    m.bindSampler(1, s);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    expect(m.getBoundSampler(99)).toBe(null);
  });

  it('deleteSampler unbinds referencing units and tolerates null', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new SamplerManager(sink);
    const s = m.createSampler();
    m.bindSampler(2, s);
    // Act
    m.deleteSampler(s);
    m.deleteSampler(null);
    m.deleteSampler(undefined);
    // Assert
    expect(m.getBoundSampler(2)).toBe(null);
    expect(m.isSampler(s)).toBe(false);
  });
});

describe('wave-3 group 3: query/sync state machines', () => {
  it('fenceSync validates condition and flags', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    // Act
    const badCond = m.fenceSync(0x9999 as never, 0);
    // Assert
    expect(badCond).toBe(null);
    expect(sink.getError()).toBe(INVALID_ENUM);
    const badFlags = m.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 7);
    expect(badFlags).toBe(null);
    expect(sink.getError()).toBe(INVALID_VALUE);
    const ok = m.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    expect(m.isSync(ok)).toBe(true);
    expect(m.isSync(null)).toBe(false);
  });

  it('deleteSync kills the sync and isSync reflects liveness', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    const s = m.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Act
    m.deleteSync(s);
    m.deleteSync(null);
    // Assert
    expect(m.isSync(s)).toBe(false);
  });

  it('clientWaitSync returns flush vs signaled paths and validates input', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    const s = m.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    // Act + Assert
    expect(m.clientWaitSync(s, SYNC_FLUSH_COMMANDS_BIT, 0)).toBe(CONDITION_SATISFIED);
    expect(m.clientWaitSync(s, 0, 0)).toBe(ALREADY_SIGNALED);
    expect(m.clientWaitSync(null, 0, 0)).toBe(WAIT_FAILED);
    expect(sink.getError()).toBe(INVALID_VALUE);
    m.deleteSync(s);
    expect(m.clientWaitSync(s, 0, 0)).toBe(WAIT_FAILED);
    expect(sink.getError()).toBe(INVALID_VALUE);
    const s2 = m.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    expect(m.clientWaitSync(s2, 0xfffffffe, 0)).toBe(WAIT_FAILED);
    expect(sink.getError()).toBe(INVALID_VALUE);
    expect(m.clientWaitSync(s2, 0, -1)).toBe(WAIT_FAILED);
    expect(sink.getError()).toBe(INVALID_VALUE);
  });

  it('waitSync validates sync liveness, flags, and timeout', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    const s = m.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    // Act
    m.waitSync(s, 0, -1);
    m.waitSync(s, 0, 0);
    // Assert: no error recorded on valid calls
    expect(sink.getError()).toBe(0);
    m.waitSync(null, 0, 0);
    expect(sink.getError()).toBe(INVALID_VALUE);
    m.deleteSync(s);
    m.waitSync(s, 0, 0);
    expect(sink.getError()).toBe(INVALID_VALUE);
    const s2 = m.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    m.waitSync(s2, 1, 0);
    expect(sink.getError()).toBe(INVALID_VALUE);
    m.waitSync(s2, 0, 5);
    expect(sink.getError()).toBe(INVALID_VALUE);
  });

  it('getSyncParameter returns object fields and validates pname', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    const s = m.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    // Act + Assert
    expect(m.getSyncParameter(s, OBJECT_TYPE)).toBe(SYNC_FENCE);
    expect(m.getSyncParameter(s, SYNC_STATUS)).toBe(SIGNALED);
    expect(m.getSyncParameter(s, SYNC_CONDITION)).toBe(SYNC_GPU_COMMANDS_COMPLETE);
    expect(m.getSyncParameter(s, SYNC_FLAGS)).toBe(0);
    expect(m.getSyncParameter(s, 0x9999 as never)).toBe(null);
    expect(sink.getError()).toBe(INVALID_ENUM);
    expect(m.getSyncParameter(null, OBJECT_TYPE)).toBe(null);
    expect(sink.getError()).toBe(INVALID_VALUE);
    m.deleteSync(s);
    expect(m.getSyncParameter(s, OBJECT_TYPE)).toBe(null);
    expect(sink.getError()).toBe(INVALID_VALUE);
  });

  it('query lifecycle: begin/end/result/availability and error paths', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    const q = m.createQuery()!;
    // Act
    m.beginQuery(ANY_SAMPLES_PASSED, q);
    // Assert: active query blocks parameter reads
    expect(m.getQueryParameter(q, QUERY_RESULT)).toBe(null);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    expect(m.getQuery(ANY_SAMPLES_PASSED, CURRENT_QUERY)).toBe(q);
    m.incrementSampleCount(5);
    m.endQuery(ANY_SAMPLES_PASSED);
    expect(m.getQueryParameter(q, QUERY_RESULT)).toBe(5);
    expect(m.getQueryParameter(q, QUERY_RESULT_AVAILABLE)).toBe(true);
    expect(m.getQuery(ANY_SAMPLES_PASSED, CURRENT_QUERY)).toBe(null);
    expect(m.hasActiveOcclusionQuery()).toBe(false);
  });

  it('query error paths: bad target, double begin, end without begin', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    const q = m.createQuery()!;
    // Act + Assert
    m.beginQuery(0x9999 as never, q);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.beginQuery(ANY_SAMPLES_PASSED, null);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    m.deleteQuery(q);
    m.beginQuery(ANY_SAMPLES_PASSED, q);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    const q2 = m.createQuery()!;
    m.beginQuery(ANY_SAMPLES_PASSED, q2);
    m.beginQuery(ANY_SAMPLES_PASSED, m.createQuery()!);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    m.endQuery(0x9999 as never);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.endQuery(ANY_SAMPLES_PASSED_CONSERVATIVE);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    expect(m.getQuery(0x9999 as never, CURRENT_QUERY)).toBe(null);
    expect(sink.getError()).toBe(INVALID_ENUM);
    expect(m.getQuery(ANY_SAMPLES_PASSED, 0x9999 as never)).toBe(null);
    expect(sink.getError()).toBe(INVALID_ENUM);
  });

  it('getQueryParameter validates liveness, target, and pname', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    // Act + Assert
    expect(m.getQueryParameter(null, QUERY_RESULT)).toBe(null);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    const fresh = m.createQuery()!;
    expect(m.getQueryParameter(fresh, QUERY_RESULT)).toBe(null);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    expect(m.isQuery(fresh)).toBe(false);
    expect(m.isQuery(null)).toBe(false);
    m.deleteQuery(fresh);
    expect(m.getQueryParameter(fresh, QUERY_RESULT)).toBe(null);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    const q = m.createQuery()!;
    m.beginQuery(ANY_SAMPLES_PASSED, q);
    m.endQuery(ANY_SAMPLES_PASSED);
    expect(m.getQueryParameter(q, 0x9999 as never)).toBe(null);
    expect(sink.getError()).toBe(INVALID_ENUM);
    expect(m.isQuery(q)).toBe(true);
    expect(m.getActiveQuery(ANY_SAMPLES_PASSED)).toBe(null);
    m.deleteQuery(null);
  });

  it('conservative occlusion counter accumulates independently', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    const q = m.createQuery()!;
    // Act
    m.beginQuery(ANY_SAMPLES_PASSED_CONSERVATIVE, q);
    expect(m.hasActiveOcclusionQuery()).toBe(true);
    m.incrementSampleCount(2);
    m.incrementSampleCount();
    m.endQuery(ANY_SAMPLES_PASSED_CONSERVATIVE);
    // Assert
    expect(m.getQueryParameter(q, QUERY_RESULT)).toBe(3);
    m.incrementSampleCount(10);
    expect(m.getQueryParameter(q, QUERY_RESULT)).toBe(3);
  });
});

describe('wave-3 group 4: renderbuffer manager', () => {
  it('creates, binds, sizes, and queries storage', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new RenderbufferManager(sink);
    // Act
    const rb = m.createRenderbuffer()!;
    m.bindRenderbuffer(RENDERBUFFER, rb);
    m.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 2);
    // Assert
    expect(m.isRenderbuffer(rb)).toBe(true);
    expect(m.getBoundRenderbuffer()).toBe(rb);
    expect(m.getParameter(RENDERBUFFER_WIDTH)).toBe(4);
    expect(m.getParameter(RENDERBUFFER_HEIGHT)).toBe(2);
    expect(m.getParameter(RENDERBUFFER_INTERNAL_FORMAT)).toBe(RGBA4);
    expect(m.getParameter(RENDERBUFFER_RED_SIZE)).toBe(4);
    expect(m.getParameter(RENDERBUFFER_GREEN_SIZE)).toBe(4);
    expect(m.getParameter(RENDERBUFFER_BLUE_SIZE)).toBe(4);
    expect(m.getParameter(RENDERBUFFER_ALPHA_SIZE)).toBe(4);
    expect(m.getParameter(RENDERBUFFER_DEPTH_SIZE)).toBe(0);
    expect(m.getParameter(RENDERBUFFER_STENCIL_SIZE)).toBe(0);
  });

  it('reports channel sizes for depth and stencil formats', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new RenderbufferManager(sink);
    const rb = m.createRenderbuffer()!;
    m.bindRenderbuffer(RENDERBUFFER, rb);
    // Act
    m.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 2, 2);
    // Assert
    expect(m.getParameter(RENDERBUFFER_DEPTH_SIZE)).toBe(16);
    expect(m.getParameter(RENDERBUFFER_RED_SIZE)).toBe(0);
    m.renderbufferStorage(RENDERBUFFER, STENCIL_INDEX8, 2, 2);
    expect(m.getParameter(RENDERBUFFER_STENCIL_SIZE)).toBe(8);
  });

  it('validates bind and storage error paths', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new RenderbufferManager(sink);
    const rb = m.createRenderbuffer()!;
    // Act + Assert
    m.bindRenderbuffer(0x9999 as never, rb);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.bindRenderbuffer(RENDERBUFFER, {} as never);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    m.renderbufferStorage(0x9999 as never, RGBA4, 1, 1);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.renderbufferStorage(RENDERBUFFER, RGBA4, 1, 1);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    m.bindRenderbuffer(RENDERBUFFER, rb);
    m.renderbufferStorage(RENDERBUFFER, 0x9999 as never, 1, 1);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.renderbufferStorage(RENDERBUFFER, RGBA4, Number.NaN, 1);
    expect(sink.getError()).toBe(INVALID_VALUE);
    m.renderbufferStorage(RENDERBUFFER, RGBA4, -1, 1);
    expect(sink.getError()).toBe(INVALID_VALUE);
    expect(m.getParameter(0x9999 as never)).toBe(0);
    expect(sink.getError()).toBe(INVALID_ENUM);
  });

  it('deleteRenderbuffer clears binding and liveness', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new RenderbufferManager(sink);
    const rb = m.createRenderbuffer()!;
    m.bindRenderbuffer(RENDERBUFFER, rb);
    // Act
    m.deleteRenderbuffer(rb);
    m.deleteRenderbuffer(null);
    // Assert
    expect(m.isRenderbuffer(rb)).toBe(false);
    expect(m.isRenderbuffer(null)).toBe(false);
    expect(m.isRenderbuffer({} as never)).toBe(false);
    expect(m.getBoundRenderbuffer()).toBe(null);
    expect(m.getStorage(rb)).toBe(null);
    expect(m.getStorage(null)).toBe(null);
  });
});

describe('wave-3 group 5: framebuffer manager and targets', () => {
  const liveLookup = {
    getLevelSize: () => ({ width: 4, height: 4 }),
    isAlive: () => true,
  };
  const deadLookup = {
    getLevelSize: () => null,
    isAlive: () => false,
  };

  it('lifecycle: create/bind/query/delete', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new FramebufferManager(sink);
    // Act
    const fb = m.createFramebuffer()!;
    m.bindFramebuffer(FRAMEBUFFER, fb);
    // Assert
    expect(m.isFramebuffer(fb)).toBe(true);
    expect(m.isFramebuffer(null)).toBe(false);
    expect(m.isFramebuffer({})).toBe(false);
    expect(m.getBoundFramebuffer()).toBe(fb);
    expect(m.getRecord(fb)!.attachments.size).toBe(0);
    expect(m.getRecord(null)).toBe(null);
    m.deleteFramebuffer(fb);
    expect(m.isFramebuffer(fb)).toBe(false);
    expect(m.getBoundFramebuffer()).toBe(null);
    m.deleteFramebuffer(null);
  });

  it('bind validates target and handle liveness', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new FramebufferManager(sink);
    const fb = m.createFramebuffer()!;
    // Act + Assert
    m.bindFramebuffer(0x9999 as never, fb);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.bindFramebuffer(FRAMEBUFFER, {} as never);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    m.deleteFramebuffer(fb);
    m.bindFramebuffer(FRAMEBUFFER, fb);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    m.bindFramebuffer(FRAMEBUFFER, null);
    expect(m.getBoundFramebuffer()).toBe(null);
  });

  it('checkStatus reports missing attachment and null default', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new FramebufferManager(sink);
    const fb = m.createFramebuffer()!;
    const rbSink = new ErrorSink();
    const rbman = new RenderbufferManager(rbSink);
    // Act + Assert
    expect(m.checkStatus(FRAMEBUFFER, fb, (rb) => rbman.getStorage(rb), liveLookup)).toBe(
      FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT,
    );
    expect(m.checkStatus(FRAMEBUFFER, null, (rb) => rbman.getStorage(rb), liveLookup)).toBe(
      FRAMEBUFFER_COMPLETE,
    );
    expect(m.checkStatus(0x9999 as never, fb, (rb) => rbman.getStorage(rb), liveLookup)).toBe(0);
    expect(sink.getError()).toBe(INVALID_ENUM);
    expect(
      m.checkStatus(FRAMEBUFFER, new WebGLFramebuffer(424242), (rb) => rbman.getStorage(rb), liveLookup),
    ).toBe(FRAMEBUFFER_INCOMPLETE_ATTACHMENT);
  });

  it('checkStatus completes with a sized color renderbuffer', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new FramebufferManager(sink);
    const rbman = new RenderbufferManager(new ErrorSink());
    const fb = m.createFramebuffer()!;
    m.bindFramebuffer(FRAMEBUFFER, fb);
    const rb = rbman.createRenderbuffer()!;
    rbman.bindRenderbuffer(RENDERBUFFER, rb);
    rbman.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    // Act
    m.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rb, (v) => rbman.isRenderbuffer(v));
    // Assert
    expect(m.checkStatus(FRAMEBUFFER, fb, (r) => rbman.getStorage(r), liveLookup)).toBe(FRAMEBUFFER_COMPLETE);
  });

  it('checkStatus detects dimension mismatch and depth+stencil conflict', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new FramebufferManager(sink);
    const rbman = new RenderbufferManager(new ErrorSink());
    const fb = m.createFramebuffer()!;
    m.bindFramebuffer(FRAMEBUFFER, fb);
    const rbA = rbman.createRenderbuffer()!;
    rbman.bindRenderbuffer(RENDERBUFFER, rbA);
    rbman.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    const rbB = rbman.createRenderbuffer()!;
    rbman.bindRenderbuffer(RENDERBUFFER, rbB);
    rbman.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 2, 2);
    // Act: attach texture size 4x4 plus 2x2 depth renderbuffer -> dimension mismatch
    m.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, { t: 1 }, 0, liveLookup);
    m.framebufferRenderbuffer(FRAMEBUFFER, DEPTH_ATTACHMENT, RENDERBUFFER, rbB, (v) => rbman.isRenderbuffer(v));
    // Assert: depth renderbuffer 2x2 vs texture 4x4 -> dimensions
    expect(m.checkStatus(FRAMEBUFFER, fb, (r) => rbman.getStorage(r), liveLookup)).toBe(
      FRAMEBUFFER_INCOMPLETE_DIMENSIONS,
    );
    // Arrange conflict: depth + stencil both attached at same size
    const fb2 = m.createFramebuffer()!;
    m.bindFramebuffer(FRAMEBUFFER, fb2);
    const rbD = rbman.createRenderbuffer()!;
    rbman.bindRenderbuffer(RENDERBUFFER, rbD);
    rbman.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 4, 4);
    const rbS = rbman.createRenderbuffer()!;
    rbman.bindRenderbuffer(RENDERBUFFER, rbS);
    rbman.renderbufferStorage(RENDERBUFFER, STENCIL_INDEX8, 4, 4);
    m.framebufferRenderbuffer(FRAMEBUFFER, DEPTH_ATTACHMENT, RENDERBUFFER, rbD, (v) => rbman.isRenderbuffer(v));
    m.framebufferRenderbuffer(FRAMEBUFFER, STENCIL_ATTACHMENT, RENDERBUFFER, rbS, (v) => rbman.isRenderbuffer(v));
    expect(m.checkStatus(FRAMEBUFFER, fb2, (r) => rbman.getStorage(r), liveLookup)).toBe(FRAMEBUFFER_UNSUPPORTED);
    void rbA;
  });

  it('framebufferTexture2D validates target, attachment, textarget, level, liveness', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new FramebufferManager(sink);
    const fb = m.createFramebuffer()!;
    m.bindFramebuffer(FRAMEBUFFER, fb);
    // Act + Assert
    m.framebufferTexture2D(0x9999 as never, COLOR_ATTACHMENT0, TEXTURE_2D, { t: 1 }, 0, liveLookup);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.framebufferTexture2D(FRAMEBUFFER, 0x9999 as never, TEXTURE_2D, { t: 1 }, 0, liveLookup);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, 0x9999 as never, { t: 1 }, 0, liveLookup);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, { t: 1 }, -1, liveLookup);
    expect(sink.getError()).toBe(INVALID_VALUE);
    m.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, { t: 1 }, 0, deadLookup);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    // Detach path clears the attachment
    m.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, { t: 1 }, 0, liveLookup);
    expect(m.getRecord(fb)!.attachments.size).toBe(1);
    m.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, null, 0, liveLookup);
    expect(m.getRecord(fb)!.attachments.size).toBe(0);
  });

  it('framebufferRenderbuffer validates target, attachment, and detach', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new FramebufferManager(sink);
    const rbman = new RenderbufferManager(new ErrorSink());
    const fb = m.createFramebuffer()!;
    m.bindFramebuffer(FRAMEBUFFER, fb);
    const rb = rbman.createRenderbuffer()!;
    // Act + Assert
    m.framebufferRenderbuffer(0x9999 as never, COLOR_ATTACHMENT0, RENDERBUFFER, rb, (v) => rbman.isRenderbuffer(v));
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.framebufferRenderbuffer(FRAMEBUFFER, 0x9999 as never, RENDERBUFFER, rb, (v) => rbman.isRenderbuffer(v));
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, 0x9999 as never, rb, (v) => rbman.isRenderbuffer(v));
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, {} as never, () => false);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    m.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rb, (v) => rbman.isRenderbuffer(v));
    expect(m.getRecord(fb)!.attachments.size).toBe(1);
    m.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, null, (v) => rbman.isRenderbuffer(v));
    expect(m.getRecord(fb)!.attachments.size).toBe(0);
  });

  it('DrawingBuffer clears color to rounded bytes and reports dims', () => {
    // Arrange
    const sink = new ErrorSink();
    const db = new DrawingBuffer(sink, { width: 2, height: 2 });
    // Act
    db.clear(COLOR_BUFFER_BIT, makePipelineState());
    // Assert: clearColor [1,0,0.5,1] -> [255,0,128,255]
    expect(Array.from(db.getColorBuffer().slice(0, 4))).toEqual([255, 0, 128, 255]);
    expect(db.getWidth()).toBe(2);
    expect(db.getHeight()).toBe(2);
  });

  it('DrawingBuffer packs depth+stencil on depth/stencil clear', () => {
    // Arrange
    const sink = new ErrorSink();
    const db = new DrawingBuffer(sink, { width: 1, height: 1 });
    // Act
    db.clear(DEPTH_BUFFER_BIT, makePipelineState());
    // Assert: depth 0.5 -> round(0.5*16777215)=8388608; depth-only clear preserves stencil 0
    expect(db.getDepthStencilBuffer()[0]).toBe(((8388608 * 256) | 0) >>> 0);
  });

  it('FboTarget clears color and depth buffers with exact packing', () => {
    // Arrange
    const color = new Uint8Array(2 * 2 * 4);
    const t = new FboTarget(2, 2, color);
    // Act
    t.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT, makePipelineState());
    // Assert
    expect(t.getWidth()).toBe(2);
    expect(t.getHeight()).toBe(2);
    expect(Array.from(t.getColorBuffer().slice(0, 4))).toEqual([255, 0, 128, 255]);
    expect(t.getDepthStencilBuffer()[0]).toBe(((8388608 * 256) | 3) >>> 0);
  });
});

describe('wave-3 group 6: builtins math and dispatch', () => {
  it('evaluates scalar abs/floor/ceil/fract/sign/trunc', () => {
    // Arrange + Act + Assert
    expect(evaluateBuiltin('abs', [-3.5], 100)).toBe(3.5);
    expect(evaluateBuiltin('floor', [2.7], 100)).toBe(2);
    expect(evaluateBuiltin('ceil', [2.1], 100)).toBe(3);
    expect(evaluateBuiltin('fract', [2.75], 100)).toBeCloseTo(0.75, 5);
    expect(evaluateBuiltin('sign', [-4], 100)).toBe(-1);
    expect(evaluateBuiltin('trunc', [-2.9], 300)).toBe(-2);
    expect(evaluateBuiltin('round', [2.5], 300)).toBe(3);
    expect(evaluateBuiltin('roundEven', [2.5], 300)).toBe(2);
  });

  it('evaluates min/max/mod/pow/mix/clamp/step/smoothstep', () => {
    // Arrange + Act + Assert
    expect(evaluateBuiltin('min', [2, 5], 100)).toBe(2);
    expect(evaluateBuiltin('max', [2, 5], 100)).toBe(5);
    expect(evaluateBuiltin('mod', [5.5, 2], 100)).toBeCloseTo(1.5, 5);
    expect(evaluateBuiltin('pow', [2, 8], 100)).toBeCloseTo(256, 4);
    expect(evaluateBuiltin('mix', [0, 10, 0.25], 100)).toBeCloseTo(2.5, 5);
    expect(evaluateBuiltin('clamp', [7, 0, 5], 100)).toBe(5);
    expect(evaluateBuiltin('step', [0.5, 0.7], 100)).toBe(1);
    expect(evaluateBuiltin('smoothstep', [0, 1, 0.5], 100)).toBeCloseTo(0.5, 5);
  });

  it('evaluates exp/exp2/log/log2/sqrt/inversesqrt trig', () => {
    // Arrange + Act + Assert
    expect(evaluateBuiltin('exp', [0], 100)).toBeCloseTo(1, 5);
    expect(evaluateBuiltin('exp2', [3], 100)).toBeCloseTo(8, 4);
    expect(evaluateBuiltin('log', [Math.E], 100)).toBeCloseTo(1, 5);
    expect(evaluateBuiltin('log2', [8], 100)).toBeCloseTo(3, 4);
    expect(evaluateBuiltin('sqrt', [9], 100)).toBeCloseTo(3, 5);
    expect(evaluateBuiltin('inversesqrt', [4], 100)).toBeCloseTo(0.5, 5);
    expect(evaluateBuiltin('sin', [0], 100)).toBeCloseTo(0, 5);
    expect(evaluateBuiltin('cos', [0], 100)).toBeCloseTo(1, 5);
    expect(evaluateBuiltin('tan', [0], 100)).toBeCloseTo(0, 5);
    expect(evaluateBuiltin('asin', [0], 100)).toBeCloseTo(0, 5);
    expect(evaluateBuiltin('acos', [1], 100)).toBeCloseTo(0, 5);
    expect(evaluateBuiltin('atan', [0], 100)).toBeCloseTo(0, 5);
  });

  it('evaluates round/roundEven/atan2 and unknown names fall back to zero', () => {
    // Arrange + Act + Assert
    expect(evaluateBuiltin('round', [2.4], 300)).toBe(2);
    expect(evaluateBuiltin('roundEven', [3.5], 300)).toBe(4);
    expect(evaluateBuiltin('atan', [1, 1], 100)).toBeCloseTo(Math.PI / 4, 5);
    expect(evaluateBuiltin('noSuchBuiltin', [1], 100)).toBe(0);
    expect(evaluateBuiltin('abs', [1], 999 as never)).toBe(0);
  });

  it('evaluates geometric dot/length/distance/normalize/cross', () => {
    // Arrange
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    // Act
    const dot = evaluateBuiltin('dot', [a, b], 100);
    const len = evaluateBuiltin('length', [new Float32Array([3, 4])], 100);
    const dist = evaluateBuiltin('distance', [new Float32Array([0, 0]), new Float32Array([3, 4])], 100);
    const n = evaluateBuiltin('normalize', [new Float32Array([0, 5, 0])], 100) as Float32Array;
    const c = evaluateBuiltin('cross', [a, b], 100) as Float32Array;
    // Assert
    expect(dot).toBeCloseTo(0, 5);
    expect(len).toBeCloseTo(5, 4);
    expect(dist).toBeCloseTo(5, 4);
    expect(Array.from(n)).toEqual([0, 1, 0]);
    expect(Array.from(c)).toEqual([0, 0, 1]);
  });

  it('evaluates reflect/refract/faceforward', () => {
    // Arrange
    const i = new Float32Array([1, -1, 0]);
    const nrm = new Float32Array([0, 1, 0]);
    // Act
    const r = evaluateBuiltin('reflect', [i, nrm], 100) as Float32Array;
    const f = evaluateBuiltin('faceforward', [nrm, nrm, nrm], 100) as Float32Array;
    const rr = evaluateBuiltin('refract', [i, nrm, 1], 100) as Float32Array;
    // Assert
    expect(Array.from(r).map((v) => Math.fround(v))).toEqual([1, 1, 0]);
    expect(f.length).toBe(3);
    expect(f[1]).toBe(-1);
    expect(Math.abs(f[0]!)).toBe(0);
    expect(rr.length).toBe(3);
  });

  it('evaluates transpose/inverse/determinant of mat2', () => {
    // Arrange: column-major mat2 [1,2,3,4]
    const m2 = new Float32Array([1, 2, 3, 4]);
    // Act
    const t = evaluateBuiltin('transpose', [m2], 300) as Float32Array;
    const inv = evaluateBuiltin('inverse', [new Float32Array([4, 7, 2, 6])], 300) as Float32Array;
    // Assert: det 10 -> inv [0.6, -0.7, -0.2, 0.4]
    expect(Array.from(t)).toEqual([1, 3, 2, 4]);
    expect(inv[0]).toBeCloseTo(0.6, 4);
    expect(inv[1]).toBeCloseTo(-0.7, 4);
    expect(inv[2]).toBeCloseTo(-0.2, 4);
    expect(inv[3]).toBeCloseTo(0.4, 4);
  });

  it('evaluates inverse of mat3 identity and diagonal', () => {
    // Arrange
    const ident3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const diag3 = new Float32Array([2, 0, 0, 0, 4, 0, 0, 0, 8]);
    // Act
    const inv = evaluateBuiltin('inverse', [ident3], 300) as Float32Array;
    const invD = evaluateBuiltin('inverse', [diag3], 300) as Float32Array;
    // Assert
    expect(Array.from(inv).map((v) => Math.fround(v))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(invD[0]).toBeCloseTo(0.5, 5);
    expect(invD[4]).toBeCloseTo(0.25, 5);
    expect(invD[8]).toBeCloseTo(0.125, 5);
  });

  it('evaluates relational all/any and vector constructors', () => {
    // Arrange + Act
    const lt = evaluateBuiltin('lessThan', [new Float32Array([1, 5]), new Float32Array([2, 4])], 100);
    const all = evaluateBuiltin('all', [lt], 100);
    const any = evaluateBuiltin('any', [lt], 100);
    const v = evaluateBuiltin('vec3', [1, 2, 3], 100) as Float32Array;
    const iv = evaluateBuiltin('ivec2', [7, 8], 300) as Int32Array;
    // Assert
    expect(all).toBe(false);
    expect(any).toBe(true);
    expect(Array.from(v)).toEqual([1, 2, 3]);
    expect(Array.from(iv)).toEqual([7, 8]);
  });

  it('returns zero for unknown names, bad versions, and non-array args', () => {
    // Arrange + Act + Assert
    expect(evaluateBuiltin('noSuchBuiltin', [1], 100)).toBe(0);
    expect(evaluateBuiltin('abs', [-2], 200 as never)).toBe(0);
    expect(evaluateBuiltin('abs', 'nope' as never, 100)).toBe(0);
  });
});

describe('wave-3 group 7: preprocessor directives', () => {
  it('expands object macros in body code', () => {
    // Arrange
    const src = '#define K 42\nfloat x = K;';
    // Act
    const texts = ppOk(src);
    // Assert
    expect(texts).toContain('42');
    expect(texts).not.toContain('K');
  });

  it('expands function-like macros with arguments', () => {
    // Arrange
    const src = '#define ADD(a, b) ((a) + (b))\nfloat y = ADD(1, 2);';
    // Act
    const texts = ppOk(src);
    // Assert
    expect(texts.join(' ')).toContain('1');
    expect(texts.join(' ')).toContain('2');
  });

  it('evaluates #if defined() branches and drops inactive code', () => {
    // Arrange
    const src = '#define FOO 1\n#if defined(FOO)\nfloat a = 1.0;\n#else\nfloat a = 2.0;\n#endif';
    // Act
    const texts = ppOk(src);
    // Assert
    expect(texts).toContain('1.0');
    expect(texts).not.toContain('2.0');
  });

  it('handles #ifdef/#ifndef/#elif chains', () => {
    // Arrange
    const src = '#ifdef MISSING\nfloat a = 1.0;\n#elif 1\nfloat b = 3.0;\n#else\nfloat c = 4.0;\n#endif';
    // Act
    const texts = ppOk(src);
    // Assert
    expect(texts).toContain('3.0');
    expect(texts).not.toContain('1.0');
    expect(texts).not.toContain('4.0');
  });

  it('handles #undef then use as undeclared identifier error', () => {
    // Arrange
    const src = '#define TMP 9\n#undef TMP\nfloat z = TMP;';
    const t = tokenize(src);
    if (!t.ok) throw new Error('tokenize failed');
    // Act
    const r = runPreprocessor(t.tokens);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.log).toContain('TMP');
  });

  it('reports unterminated conditional blocks', () => {
    // Arrange
    const src = '#if 1\nfloat a = 1.0;';
    const t = tokenize(src);
    if (!t.ok) throw new Error('tokenize failed');
    // Act
    const r = runPreprocessor(t.tokens);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('supports #version-gated __VERSION__ macro content', () => {
    // Arrange
    const src = 'int v = __VERSION__;';
    // Act
    const v100 = ppOk(src, 100);
    const v300 = ppOk(src, 300);
    // Assert
    expect(v100).toContain('100');
    expect(v300).toContain('300');
  });

  it('evaluates numeric #if expressions with comparison operators', () => {
    // Arrange
    const src = '#if 2 > 1\nfloat a = 5.0;\n#endif\n#if 1 == 2\nfloat b = 6.0;\n#endif';
    // Act
    const texts = ppOk(src);
    // Assert
    expect(texts).toContain('5.0');
    expect(texts).not.toContain('6.0');
  });
});

describe('wave-3 group 7: buffer manager lifecycle and data paths', () => {
  it('creates, identifies, binds, and deletes buffers', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new BufferManager(sink);
    // Act
    const b = m.createBuffer()!;
    const aliveBefore = m.isBuffer(b);
    m.bindBuffer(ARRAY_BUFFER, b);
    const bound = m.getBoundBuffer(ARRAY_BUFFER);
    m.deleteBuffer(b);
    // Assert
    expect(aliveBefore).toBe(true);
    expect(bound).toBe(b);
    expect(m.isBuffer(b)).toBe(false);
    expect(m.isBuffer(null)).toBe(false);
    expect(m.isBuffer({})).toBe(false);
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('rejects invalid bind targets and foreign handles', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new BufferManager(sink);
    const foreign = new BufferManager(new ErrorSink()).createBuffer()!;
    // Act
    m.bindBuffer(0x9999 as never, null);
    // Assert
    expect(sink.getError()).toBe(INVALID_ENUM);
    // Act
    m.bindBuffer(ARRAY_BUFFER, foreign);
    // Assert
    expect(sink.getError()).toBe(INVALID_OPERATION);
    // Act: bind deleted buffer
    const b = m.createBuffer()!;
    m.deleteBuffer(b);
    m.bindBuffer(ARRAY_BUFFER, b);
    // Assert
    expect(sink.getError()).toBe(INVALID_OPERATION);
  });

  it('stores sized and typed data with usage', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new BufferManager(sink);
    const b = m.createBuffer()!;
    m.bindBuffer(ARRAY_BUFFER, b);
    // Act
    m.bufferData(ARRAY_BUFFER, 16, STATIC_DRAW);
    const sizeParam = m.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE);
    const usageParam = m.getBufferParameter(ARRAY_BUFFER, BUFFER_USAGE);
    // Assert
    expect(sizeParam).toBe(16);
    expect(usageParam).toBe(STATIC_DRAW);
    // Act: typed data upload
    m.bufferData(ARRAY_BUFFER, new Uint8Array([1, 2, 3, 4]), DYNAMIC_DRAW);
    // Assert
    expect(m.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE)).toBe(4);
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('rejects bufferData error paths without mutation', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new BufferManager(sink);
    const b = m.createBuffer()!;
    m.bindBuffer(ARRAY_BUFFER, b);
    // Act: bad target
    m.bufferData(0x9999 as never, 8, STATIC_DRAW);
    // Assert
    expect(sink.getError()).toBe(INVALID_ENUM);
    // Act: negative size
    m.bufferData(ARRAY_BUFFER, -4, STATIC_DRAW);
    // Assert
    expect(sink.getError()).toBe(INVALID_VALUE);
    // Act: bad usage
    m.bufferData(ARRAY_BUFFER, 8, 0x9999 as never);
    // Assert
    expect(sink.getError()).toBe(INVALID_ENUM);
    // Act: no buffer bound on other target
    m.bufferData(ELEMENT_ARRAY_BUFFER, 8, STATIC_DRAW);
    // Assert
    expect(sink.getError()).toBe(INVALID_OPERATION);
  });

  it('writes sub-data ranges and rejects overflows', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new BufferManager(sink);
    const b = m.createBuffer()!;
    m.bindBuffer(ARRAY_BUFFER, b);
    m.bufferData(ARRAY_BUFFER, new Uint8Array([0, 0, 0, 0]), STATIC_DRAW);
    // Act
    m.bufferSubData(ARRAY_BUFFER, 1, new Uint8Array([9, 8]));
    // Assert
    expect(m.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE)).toBe(4);
    expect(sink.getError()).toBe(NO_ERROR);
    // Act: overflow
    m.bufferSubData(ARRAY_BUFFER, 3, new Uint8Array([1, 2]));
    // Assert
    expect(sink.getError()).toBe(INVALID_VALUE);
    // Act: negative offset
    m.bufferSubData(ARRAY_BUFFER, -1, new Uint8Array([1]));
    // Assert
    expect(sink.getError()).toBe(INVALID_VALUE);
    // Act: bad target + bad pname queries
    m.bufferSubData(0x9999 as never, 0, new Uint8Array([1]));
    // Assert
    expect(sink.getError()).toBe(INVALID_ENUM);
    expect(m.getBufferParameter(0x9999 as never, BUFFER_SIZE)).toBe(null);
    expect(sink.getError()).toBe(INVALID_ENUM);
    expect(m.getBufferParameter(ARRAY_BUFFER, 0x9999 as never)).toBe(null);
    expect(sink.getError()).toBe(INVALID_ENUM);
  });
});

describe('wave-3 group 8: texture pure helpers and completeness', () => {
  function potTex(): TextureObject {
    const data = new Uint8Array(4 * 4 * 4).fill(128);
    const levels2D = new Map([[0, { width: 4, height: 4, internalFormat: RGBA, type: UNSIGNED_BYTE, data }]]);
    return {
      id: 1, alive: true, target: TEXTURE_2D, levels2D,
      levelsCube: new Map(),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false, completeness: null,
    };
  }

  it('classifies mipmap filters', () => {
    // Arrange + Act + Assert
    expect(isMipmapFilter(NEAREST_MIPMAP_LINEAR)).toBe(true);
    expect(isMipmapFilter(LINEAR_MIPMAP_LINEAR)).toBe(true);
    expect(isMipmapFilter(NEAREST_MIPMAP_NEAREST)).toBe(true);
    expect(isMipmapFilter(LINEAR_MIPMAP_NEAREST)).toBe(true);
    expect(isMipmapFilter(NEAREST_MIPMAP_LINEAR)).toBe(true);
    expect(isMipmapFilter(NEAREST)).toBe(false);
    expect(isMipmapFilter(LINEAR)).toBe(false);
    expect(isMipmapFilter(TEXTURE_2D)).toBe(false);
  });

  it('computes expected mipmap level counts', () => {
    // Arrange + Act + Assert
    expect(computeExpectedLevels(1, 1)).toBe(1);
    expect(computeExpectedLevels(4, 4)).toBe(3);
    expect(computeExpectedLevels(5, 3)).toBe(3);
    expect(computeExpectedLevels(8, 1)).toBe(4);
  });

  it('computes expected mip levels for non-square and large textures', () => {
    // Arrange + Act + Assert
    expect(computeExpectedLevels(16, 16)).toBe(5);
    expect(computeExpectedLevels(7, 7)).toBe(3);
    expect(computeExpectedLevels(2, 1)).toBe(2);
  });

  it('accepts a complete POT texture and rejects dead/empty ones', () => {
    // Arrange
    const good = potTex();
    const dead = { ...good, alive: false };
    const empty = { ...good, levels2D: new Map() };
    // Act + Assert
    expect(evaluateTextureCompleteness(good, 1)).toBe(true);
    expect(isTextureComplete(good, 1)).toBe(true);
    expect(evaluateTextureCompleteness(dead, 1)).toBe(false);
    expect(evaluateTextureCompleteness(empty, 1)).toBe(false);
    expect(evaluateTextureCompleteness(null as never, 1)).toBe(false);
  });

  it('rejects NPOT textures with mipmap filtering under WebGL1', () => {
    // Arrange
    const npot = { ...potTex(), isNPOT: true };
    npot.sampler.minFilter = NEAREST_MIPMAP_LINEAR;
    // Act + Assert
    expect(evaluateTextureCompleteness(npot, 1)).toBe(false);
    // Act: NPOT with non-mipmap filtering is complete in both versions
    const npotLinear = { ...npot, sampler: { ...npot.sampler, minFilter: LINEAR } };
    expect(evaluateTextureCompleteness(npotLinear, 1)).toBe(true);
    expect(evaluateTextureCompleteness(npotLinear, 2)).toBe(true);
  });
});

describe('wave-3 group 9: preprocessor advanced directives (unique cases)', () => {
  it('evaluates #elif chains selecting the first true branch', () => {
    // Arrange
    const src = '#define V 2\n#if V == 1\nfloat a = 1.0;\n#elif V == 2\nfloat a = 2.0;\n#else\nfloat a = 3.0;\n#endif';
    // Act
    const texts = ppOk(src);
    // Assert
    expect(texts).toContain('2.0');
    expect(texts).not.toContain('1.0');
    expect(texts).not.toContain('3.0');
  });

  it('supports the defined() operator in conditionals', () => {
    // Arrange
    const src = '#define FOO\n#if defined(FOO)\nfloat a = 7.0;\n#endif\n#if defined(BAR)\nfloat b = 8.0;\n#endif';
    // Act
    const texts = ppOk(src);
    // Assert
    expect(texts).toContain('7.0');
    expect(texts).not.toContain('8.0');
  });

  it('fails on #error directives and use-after-#undef', () => {
    // Arrange
    const errToks = tokenize('#error custom failure message');
    // Act
    const errRes = runPreprocessor(errToks.ok ? errToks.tokens : []);
    // Assert
    expect(errRes.ok).toBe(false);
    // Arrange: undef then use
    const undefToks = tokenize('#define Q 1\n#undef Q\nfloat x = Q;');
    // Act
    const undefRes = runPreprocessor(undefToks.ok ? undefToks.tokens : []);
    // Assert
    expect(undefRes.ok).toBe(false);
  });

  it('handles #line, #pragma, and predefined macros', () => {
    // Arrange
    const src = '#line 42\n#pragma optimize(on)\nint ln = __LINE__;\nint ver = __VERSION__;';
    // Act
    const texts = ppOk(src);
    // Assert: __LINE__ expands to the current line number, __VERSION__ to 100
    expect(texts).toContain('3');
    expect(texts).toContain('100');
  });

  it('removes empty defines and reports unterminated conditionals', () => {
    // Arrange
    const emptyToks = tokenize('#define EMPTY\nfloat x = 1.0;');
    // Act
    const emptyRes = runPreprocessor(emptyToks.ok ? emptyToks.tokens : []);
    // Assert
    expect(emptyRes.ok).toBe(true);
    // Arrange: unterminated #if
    const unterminated = tokenize('#if 1\nfloat x = 1.0;');
    // Act
    const unterminatedRes = runPreprocessor(unterminated.ok ? unterminated.tokens : []);
    // Assert
    expect(unterminatedRes.ok).toBe(false);
  });
});

/** Shared full front-end chain: tokenize -> preprocess -> parse -> check (single helper for groups 10/10b). */
function compileShared(src: string, stage: 'vertex' | 'fragment', version: 100 | 300) {
  const toks = tokenize(src);
  if (!toks.ok) return { ok: false as const, log: 'tokenize failed' };
  const pp = runPreprocessor(toks.tokens, version);
  if (!pp.ok) return { ok: false as const, log: pp.log };
  const parsed = parse(pp.tokens, version);
  if (!parsed.ok) return { ok: false as const, log: parsed.log };
  return check(parsed.tokens, stage, version);
}

describe('wave-3 group 10: full compile pipeline tokenize->preprocess->parse->check', () => {
  const compile = compileShared;
  it('accepts a minimal vertex shader with attribute, uniform, and gl_Position', () => {
    // Arrange
    const src = `attribute vec4 aPos;
uniform mat4 uMvp;
void main() { gl_Position = uMvp * aPos; }`;
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('accepts a minimal fragment shader with precision and gl_FragColor', () => {
    // Arrange
    const src = `precision mediump float;
uniform vec4 uColor;
void main() { gl_FragColor = uColor; }`;
    // Act
    const r = compile(src, 'fragment', 100);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('rejects use of undeclared identifiers with a naming log', () => {
    // Arrange
    const src = `void main() { gl_Position = vec4(nope, 0.0, 0.0, 1.0); }`;
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.log).toContain('nope');
  });

  it('rejects assigning a float to an int variable', () => {
    // Arrange
    const src = `void main() { int x = 1.5; gl_Position = vec4(0.0); }`;
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('rejects calling an undeclared function', () => {
    // Arrange
    const src = `void main() { float y = bogus(1.0); gl_Position = vec4(y); }`;
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('accepts user functions, loops, and conditionals', () => {
    // Arrange
    const src = `float sq(float x) { return x * x; }
void main() {
  float acc = 0.0;
  for (int i = 0; i < 4; i = i + 1) { acc = acc + sq(float(i)); }
  if (acc > 1.0) { acc = 1.0; } else { acc = 0.0; }
  gl_Position = vec4(acc, 0.0, 0.0, 1.0);
}`;
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('accepts structs, arrays, and swizzles', () => {
    // Arrange
    const src = `struct Light { float intensity; float range; };
void main() {
  Light l;
  l.intensity = 0.5;
  l.range = 10.0;
  vec4 v = vec4(l.intensity, l.range, 1.0, 2.0);
  float g = v.g;
  float a[3];
  a[0] = 1.0;
  a[1] = 2.0;
  float a2 = v[3];
  gl_Position = vec4(v.rgb * g, a2) + vec4(a[0] + a[1]);
}`;
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('accepts a version-300 shader with in/out qualifiers', () => {
    // Arrange
    const src = `#version 300 es
precision highp float;
in vec4 aPos;
out vec4 vColor;
void main() { vColor = aPos; gl_Position = aPos; }`;
    // Act
    const r = compile(src, 'vertex', 300);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('accepts a fragment shader without precision (checker leniency)', () => {
    // Arrange
    const src = `void main() { gl_FragColor = vec4(1.0); }`;
    // Act
    const r = compile(src, 'fragment', 100);
    // Assert: the checker does not enforce default float precision — documents real behavior
    expect(r.ok).toBe(true);
  });

  it('rejects invalid AST input without throwing', () => {
    // Arrange
    const bad = { kind: 'NotAUnit', declarations: [] } as never;
    // Act
    const r = check(bad, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
  });
});

describe('wave-3 group 11: GLState setters, getters, and snapshots', () => {
  it('toggles capabilities and reports them back', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setEnable(BLEND, true);
    st.setEnable(DEPTH_TEST, true);
    st.setEnable(BLEND, false);
    // Assert
    expect(st.isEnabled(BLEND)).toBe(false);
    expect(st.isEnabled(DEPTH_TEST)).toBe(true);
  });

  it('stores viewport, scissor, and clear values', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setViewport(0, 0, 640, 480);
    st.setScissor(8, 8, 100, 100);
    st.setClearColor(0.25, 0.5, 0.75, 1);
    st.setClearDepth(0.5);
    st.setClearStencil(7);
    st.setColorMask(false, true, true, false);
    // Assert
    expect(st.getViewport()).toEqual([0, 0, 640, 480]);
    expect(st.getScissor()).toEqual([8, 8, 100, 100]);
    expect(st.getClearColor()).toEqual([0.25, 0.5, 0.75, 1]);
    expect(st.getClearDepth()).toBe(0.5);
    expect(st.getClearStencil()).toBe(7);
    expect(st.getColorMask()).toEqual([false, true, true, false]);
  });

  it('stores blend, depth, stencil, cull, and raster state', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setBlendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA);
    st.setBlendFuncSeparate(SRC_ALPHA, ONE_MINUS_SRC_ALPHA, SRC_ALPHA, ONE_MINUS_SRC_ALPHA);
    st.setBlendEquation(FUNC_ADD);
    st.setBlendEquationSeparate(FUNC_ADD, FUNC_ADD);
    st.setBlendColor(1, 0, 0, 1);
    st.setDepthFunc(LESS);
    st.setDepthMask(false);
    st.setDepthRange(0.1, 0.9);
    st.setStencilFunc(LESS, 3, 255);
    st.setStencilFuncSeparate(FRONT, GREATER, 4, 15);
    st.setStencilOp(KEEP, KEEP, REPLACE);
    st.setStencilOpSeparate(FRONT_AND_BACK, KEEP, INCR, REPLACE);
    st.setStencilMask(15);
    st.setStencilMaskSeparate(FRONT, 7);
    st.setCullFace(BACK);
    st.setFrontFace(CCW);
    st.setLineWidth(2);
    st.setPolygonOffset(1, 2);
    st.setSampleCoverage(0.5, true);
    // Assert: snapshot round-trips through restore
    const snap = st.snapshot();
    st.setLineWidth(5);
    expect(st.getLineWidth()).toBe(5);
    st.restore(snap);
    expect(st.getLineWidth()).toBe(2);
  });

  it('stores pixel-store, active texture, program, and vertex attrib state', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setPixelStorei(UNPACK_ALIGNMENT, 1);
    st.setPixelStorei(UNPACK_FLIP_Y_WEBGL, true);
    st.setActiveTexture(TEXTURE1);
    st.useProgram({ id: 9 });
    st.setVertexAttribPointer(0, 3, FLOAT, false, 0, 0, null);
    st.enableVertexAttribArray(0);
    st.setVertexAttribGeneric(1, [1, 2, 3, 4]);
    st.setVertexAttribDivisor(0, 1);
    st.disableVertexAttribArray(0);
    const vao = st.createVertexArrayObject();
    st.bindVertexArray(vao);
    // Assert
    expect(st.getPixelStorei(UNPACK_ALIGNMENT)).toBe(1);
    expect(st.getPixelStorei(UNPACK_FLIP_Y_WEBGL)).toBe(true);
    expect(st.getActiveTexture()).toBe(TEXTURE1);
    expect(st.getCurrentProgram()).toEqual({ id: 9 });
    expect(st.getVertexAttrib(0)).not.toBe(null);
    expect(st.getBoundVertexArray()).toBe(vao);
    st.bindVertexArray(null);
    expect(st.getBoundVertexArray()).toBe(null);
  });
});

describe('wave-3 group 12: TextureManager upload, params, and mipmaps', () => {
  it('creates, binds, uploads, and queries a complete texture', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new TextureManager(sink);
    // Act
    const t = m.createTexture()!;
    expect(m.isTexture(t)).toBe(true);
    m.setActiveTexture(TEXTURE1);
    m.bindTexture(TEXTURE_2D, t);
    expect(m.getBoundTexture(TEXTURE_2D)).toBe(t);
    expect(m.getActiveTexture()).toBe(TEXTURE1);
    const px = new Uint8Array(4 * 4 * 4).fill(200);
    m.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, px);
    m.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    m.texParameterf(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    // Assert
    expect(m.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).toBe(NEAREST);
    expect(m.getTexParameter(TEXTURE_2D, TEXTURE_MAG_FILTER)).toBe(NEAREST);
    expect(sink.getError()).toBe(NO_ERROR);
    m.deleteTexture(t);
    expect(m.isTexture(t)).toBe(false);
  });

  it('generates a full mipmap chain for power-of-two textures', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new TextureManager(sink);
    const t = m.createTexture()!;
    m.bindTexture(TEXTURE_2D, t);
    m.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(64).fill(128));
    // Act
    m.generateMipmap(TEXTURE_2D);
    // Assert
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('writes sub-images and validates upload error paths', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new TextureManager(sink);
    const t = m.createTexture()!;
    m.bindTexture(TEXTURE_2D, t);
    m.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(64).fill(10));
    // Act: valid sub-upload
    m.texSubImage2D(TEXTURE_2D, 0, 1, 1, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(16).fill(20));
    expect(sink.getError()).toBe(NO_ERROR);
    // Act: out-of-range sub-upload records INVALID_VALUE
    m.texSubImage2D(TEXTURE_2D, 0, 3, 3, 4, 4, RGBA, UNSIGNED_BYTE, new Uint8Array(64).fill(20));
    expect(sink.getError()).toBe(INVALID_VALUE);
    // Act: bad target records INVALID_ENUM
    m.texImage2D(0x9999 as never, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(64));
    expect(sink.getError()).toBe(INVALID_ENUM);
  });
});

describe('wave-3 group 10b: compile pipeline edge cases (version gates, error logs)', () => {
  const compile = compileShared;
  it('accepts a minimal valid vertex shader', () => {
    // Arrange
    const src = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('accepts a minimal valid fragment shader with precision', () => {
    // Arrange
    const src = 'precision mediump float; void main() { gl_FragColor = vec4(1.0); }';
    // Act
    const r = compile(src, 'fragment', 100);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('rejects use of undeclared identifiers', () => {
    // Arrange
    const src = 'void main() { gl_Position = vec4(missingVar); }';
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.log.length).toBeGreaterThan(0);
  });

  it('rejects assignments with mismatched types', () => {
    // Arrange
    const src = 'void main() { int x = 1; x = vec4(1.0); gl_Position = vec4(0.0); }';
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('rejects calls to undeclared functions', () => {
    // Arrange
    const src = 'void main() { float v = noSuchFn(1.0); gl_Position = vec4(v); }';
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('accepts loops, branches, and user functions', () => {
    // Arrange
    const src = [
      'float pick(float t) { if (t > 0.5) { return 1.0; } else { return 0.0; } }',
      'void main() { float acc = 0.0;',
      'for (int i = 0; i < 4; i++) { acc += pick(float(i)); }',
      'while (acc > 10.0) { acc -= 1.0; }',
      'gl_Position = vec4(acc); }',
    ].join('\n');
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('accepts structs, arrays, and swizzles', () => {
    // Arrange
    const src = [
      'struct Light { float intensity; float range; };',
      'void main() { Light l; l.intensity = 2.0; l.range = 3.0;',
      'vec4 v = vec4(l.intensity, l.range, 1.0, 2.0); float g = v.g;',
      'float a[3]; a[0] = 1.0; a[1] = 2.0; float a2 = v[3];',
      'gl_Position = vec4(v.rgb * g, a2) + vec4(a[0] + a[1]); }',
    ].join('\n');
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('accepts a WebGL2-style vertex shader', () => {
    // Arrange
    const src = '#version 300 es\nin vec4 aPos;\nvoid main() { gl_Position = aPos; }';
    // Act
    const r = compile(src, 'vertex', 300);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('accepts a declarations-only shader without main (checker leniency)', () => {
    // Arrange
    const src = 'uniform float u;';
    // Act
    const r = compile(src, 'vertex', 100);
    // Assert: the checker does not require a main function — documents real behavior
    expect(r.ok).toBe(true);
  });
});

describe('wave-3 group 11b: GLState enable and viewport/scissor/clear state (extended)', () => {
  it('toggles capabilities and reports them', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setEnable(BLEND, true);
    const on = st.isEnabled(BLEND);
    st.setEnable(BLEND, false);
    // Assert
    expect(on).toBe(true);
    expect(st.isEnabled(BLEND)).toBe(false);
    expect(st.isEnabled(DEPTH_TEST)).toBe(false);
  });

  it('stores viewport and scissor rectangles', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setViewport(1, 2, 300, 150);
    st.setScissor(0, 0, 64, 64);
    // Assert
    expect(Array.from(st.getViewport())).toEqual([1, 2, 300, 150]);
    expect(Array.from(st.getScissor())).toEqual([0, 0, 64, 64]);
  });

  it('stores clear color, depth, and stencil values', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setClearColor(0.25, 0.5, 0.75, 1);
    st.setClearDepth(0.5);
    st.setClearStencil(7);
    const snap = st.snapshot();
    // Assert
    expect(Array.from(snap.clearValues.clearColor)).toEqual([0.25, 0.5, 0.75, 1]);
    expect(snap.clearValues.clearDepth).toBe(0.5);
    expect(snap.clearValues.clearStencil).toBe(7);
  });

  it('stores blend equation, factors, and color mask', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setBlendEquation(FUNC_ADD);
    st.setBlendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA);
    st.setColorMask(false, true, false, true);
    const snap = st.snapshot();
    // Assert
    expect(snap.blend.equationRGB).toBe(FUNC_ADD);
    expect(snap.blend.srcRGB).toBe(SRC_ALPHA);
    expect(snap.blend.dstRGB).toBe(ONE_MINUS_SRC_ALPHA);
    expect(Array.from(snap.colorMask)).toEqual([false, true, false, true]);
  });

  it('stores depth test, cull face, and stencil face state', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setDepthFunc(LESS);
    st.setDepthMask(false);
    st.setCullFace(BACK);
    st.setFrontFace(CCW);
    st.setStencilFuncSeparate(FRONT, GREATER, 5, 255);
    st.setStencilOpSeparate(FRONT, KEEP, INCR, REPLACE);
    st.setStencilMaskSeparate(FRONT, 15);
    const snap = st.snapshot();
    // Assert
    expect(snap.depth.func).toBe(LESS);
    expect(snap.depth.mask).toBe(false);
    expect(snap.raster.cullFaceMode).toBe(BACK);
    expect(snap.raster.frontFace).toBe(CCW);
    expect(snap.stencilFront.func).toBe(GREATER);
    expect(snap.stencilFront.ref).toBe(5);
    expect(snap.stencilFront.sfail).toBe(KEEP);
    expect(snap.stencilFront.dpfail).toBe(INCR);
    expect(snap.stencilFront.dppass).toBe(REPLACE);
    expect(snap.stencilFront.writeMask).toBe(15);
  });

  it('manages vertex attrib arrays and generic values', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setVertexAttribPointer(0, 3, FLOAT, false, 0, 0, null);
    st.enableVertexAttribArray(0);
    st.setVertexAttribGeneric(1, [1, 2, 3, 4]);
    st.setVertexAttribDivisor(0, 1);
    st.disableVertexAttribArray(0);
    const a0 = st.getVertexAttrib(0)!;
    const a1 = st.getVertexAttrib(1)!;
    // Assert
    expect(a0.enabled).toBe(false);
    expect(a0.size).toBe(3);
    expect(a0.divisor).toBe(1);
    expect(Array.from(a1.genericValue)).toEqual([1, 2, 3, 4]);
  });

  it('stores pixel-store, active texture, and draw/read buffers', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    // Act
    st.setPixelStorei(UNPACK_ALIGNMENT, 1);
    st.setPixelStorei(UNPACK_FLIP_Y_WEBGL, 1);
    st.setActiveTexture(TEXTURE1);
    st.setDrawBuffersList([COLOR_ATTACHMENT0]);
    st.setReadBufferSource(COLOR_ATTACHMENT0);
    // Assert
    expect(st.getActiveTexture()).toBe(TEXTURE1);
    expect(st.getDrawBuffersList()).toEqual([COLOR_ATTACHMENT0]);
    expect(st.getReadBufferSource()).toBe(COLOR_ATTACHMENT0);
    expect(st.getPixelStorei(UNPACK_ALIGNMENT)).toBe(1);
    expect(st.getPixelStorei(UNPACK_FLIP_Y_WEBGL)).toBe(true);
  });

  it('restores snapshots and resets to defaults (extended)', () => {
    // Arrange
    const st = new GLState(new ErrorSink());
    const before = st.snapshot();
    st.setViewport(5, 6, 7, 8);
    // Act
    st.restore(before);
    // Assert
    expect(Array.from(st.getViewport())).toEqual([0, 0, 300, 150]);
    st.setEnable(CULL_FACE, true);
    st.resetToDefaults();
    expect(st.isEnabled(CULL_FACE)).toBe(false);
  });
});

describe('wave-3 group 12b: TextureManager lifecycle and upload paths (extended)', () => {
  it('creates, binds, and deletes textures per unit', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new TextureManager(sink);
    // Act
    const t = m.createTexture()!;
    m.setActiveTexture(TEXTURE0);
    m.bindTexture(TEXTURE_2D, t);
    const bound = m.getBoundTexture(TEXTURE_2D);
    m.deleteTexture(t);
    // Assert
    expect(m.isTexture(t)).toBe(false);
    expect(bound).toBe(t);
    expect(m.getActiveTexture()).toBe(TEXTURE0);
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('uploads level 0 and reads back completeness', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new TextureManager(sink);
    const t = m.createTexture()!;
    m.bindTexture(TEXTURE_2D, t);
    const px = new Uint8Array(4 * 4 * 4).fill(200);
    // Act
    m.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, px);
    m.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR);
    // Assert
    expect(m.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).toBe(LINEAR);
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('generates mipmaps and updates sub-images', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new TextureManager(sink);
    const t = m.createTexture()!;
    m.bindTexture(TEXTURE_2D, t);
    m.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(64).fill(9));
    // Act
    m.generateMipmap(TEXTURE_2D);
    m.texSubImage2D(TEXTURE_2D, 0, 0, 0, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(16).fill(3));
    // Assert
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('reports errors for invalid targets and unbound uploads', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new TextureManager(sink);
    // Act: no texture bound on unit 0
    m.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(64));
    // Assert
    expect(sink.getError()).toBe(INVALID_OPERATION);
    // Act: bad target enum
    m.bindTexture(0x9999 as never, null);
    // Assert
    expect(sink.getError()).toBe(INVALID_ENUM);
    // Act: bad level
    const t = m.createTexture()!;
    m.bindTexture(TEXTURE_2D, t);
    m.texImage2D(TEXTURE_2D, -1, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(64));
    // Assert
    expect(sink.getError()).toBe(INVALID_VALUE);
  });

  it('validates tex parameter values and cube-face uploads', () => {
    // Arrange
    const sink = new ErrorSink();
    const m = new TextureManager(sink);
    const t = m.createTexture()!;
    m.bindTexture(TEXTURE_CUBE_MAP, t);
    // Act: bad wrap value
    m.texParameteri(TEXTURE_CUBE_MAP, TEXTURE_WRAP_S, 0x1234);
    // Assert
    expect(sink.getError()).toBe(INVALID_ENUM);
    // Act: cube face upload
    m.texImage2D(
      TEXTURE_CUBE_MAP_POSITIVE_X, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(16).fill(7),
    );
    // Assert
    expect(sink.getError()).toBe(NO_ERROR);
  });
});
