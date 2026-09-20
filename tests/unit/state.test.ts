// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial/extended state suite
/** Context-attribute resolution tests (Sprint 1 Task 4, TDD red phase). */
import { describe, expect, it } from 'vitest';
import { resolveContextAttributes } from '../../src/gl/context-attributes';
import { ErrorSink } from '../../src/gl/errors';
import {
  CONTEXT_LOST_WEBGL,
  INVALID_ENUM,
  INVALID_FRAMEBUFFER_OPERATION,
  INVALID_OPERATION,
  INVALID_VALUE,
  NO_ERROR,
  OUT_OF_MEMORY,
} from '../../src/gl/constants';
import type { GLenum } from '../../src/gl/constants';

const SPEC_DEFAULTS = {
  alpha: true,
  depth: true,
  stencil: false,
  antialias: true,
  premultipliedAlpha: true,
  preserveDrawingBuffer: false,
  powerPreference: 'default',
  failIfMajorPerformanceCaveat: false,
} as const;

describe('resolveContextAttributes', () => {
  it('returns all eight spec defaults when called with no arguments', () => {
    // Arrange: no input.
    // Act:
    const result = resolveContextAttributes();
    // Assert:
    expect(result.alpha).toBe(true);
    expect(result.depth).toBe(true);
    expect(result.stencil).toBe(false);
    expect(result.antialias).toBe(true);
    expect(result.premultipliedAlpha).toBe(true);
    expect(result.preserveDrawingBuffer).toBe(false);
    expect(result.powerPreference).toBe('default');
    expect(result.failIfMajorPerformanceCaveat).toBe(false);
  });

  it('returns all eight spec defaults when called with an empty object', () => {
    // Arrange:
    const input = {};
    // Act:
    const result = resolveContextAttributes(input);
    // Assert:
    expect(result).toEqual({ ...SPEC_DEFAULTS });
  });

  it('resolves null and undefined inputs to spec defaults without throwing', () => {
    // Arrange:
    const inputs = [null, undefined];
    // Act:
    const results = inputs.map((inp) => resolveContextAttributes(inp as unknown as undefined));
    // Assert:
    for (const result of results) {
      expect(result).toEqual({ ...SPEC_DEFAULTS });
    }
  });

  it('honors explicit valid boolean overrides for each boolean attribute', () => {
    // Arrange:
    const input = {
      alpha: false,
      depth: false,
      stencil: true,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: true,
    };
    // Act:
    const result = resolveContextAttributes(input);
    // Assert:
    expect(result.alpha).toBe(false);
    expect(result.depth).toBe(false);
    expect(result.stencil).toBe(true);
    expect(result.antialias).toBe(false);
    expect(result.premultipliedAlpha).toBe(false);
    expect(result.preserveDrawingBuffer).toBe(true);
    expect(result.failIfMajorPerformanceCaveat).toBe(true);
    expect(result.powerPreference).toBe('default');
  });

  it('honors each valid powerPreference literal', () => {
    // Arrange:
    const validValues = ['default', 'low-power', 'high-performance'] as const;
    // Act:
    const results = validValues.map((pref) => resolveContextAttributes({ powerPreference: pref }));
    // Assert:
    expect(results[0]?.powerPreference).toBe('default');
    expect(results[1]?.powerPreference).toBe('low-power');
    expect(results[2]?.powerPreference).toBe('high-performance');
  });

  it('coerces non-boolean values for boolean attributes to spec defaults without throwing', () => {
    // Arrange:
    const malformedInput = {
      alpha: 'yes',
      depth: 0,
      stencil: 1,
      antialias: null,
      premultipliedAlpha: {},
      preserveDrawingBuffer: [],
      failIfMajorPerformanceCaveat: 'false',
    };
    // Act:
    const result = resolveContextAttributes(malformedInput as unknown as Record<string, never>);
    // Assert:
    expect(result.alpha).toBe(true);
    expect(result.depth).toBe(true);
    expect(result.stencil).toBe(false);
    expect(result.antialias).toBe(true);
    expect(result.premultipliedAlpha).toBe(true);
    expect(result.preserveDrawingBuffer).toBe(false);
    expect(result.failIfMajorPerformanceCaveat).toBe(false);
  });

  it("coerces invalid powerPreference values to 'default'", () => {
    // Arrange:
    const invalidPrefs = ['ultra-high-performance', 'custom', '', 123, true, false, null, {}, []];
    // Act:
    const results = invalidPrefs.map((pref) =>
      resolveContextAttributes({ powerPreference: pref as unknown as 'default' }),
    );
    // Assert:
    for (const result of results) {
      expect(result.powerPreference).toBe('default');
    }
  });

  it('returns a frozen object whose fields cannot be mutated', () => {
    // Arrange:
    const attrs = resolveContextAttributes();
    // Act:
    const isFrozen = Object.isFrozen(attrs);
    // Assert:
    expect(isFrozen).toBe(true);
    expect(() => {
      (attrs as { stencil: boolean }).stencil = true;
    }).toThrow(TypeError);
    expect(attrs.stencil).toBe(false);
  });

  it('round-trips field-for-field through a getContextAttributes simulation', () => {
    // Arrange:
    const initial = { stencil: true, alpha: false };
    const resolved = resolveContextAttributes(initial);
    // Act:
    const simulatedGetContextAttributes = (): typeof resolved => resolved;
    const retrieved = simulatedGetContextAttributes();
    // Assert:
    expect(retrieved).toEqual(resolved);
    expect(Object.isFrozen(retrieved)).toBe(true);
    expect(retrieved.stencil).toBe(true);
    expect(retrieved.alpha).toBe(false);
    expect(retrieved.depth).toBe(true);
  });
});

describe('ErrorSink', () => {
  it('two different errors returns first code then NO_ERROR (M1 unit test 3)', () => {
    // Arrange:
    const sink = new ErrorSink();
    // Act:
    sink.recordError(INVALID_ENUM);
    sink.recordError(INVALID_VALUE);
    const first = sink.getError();
    const second = sink.getError();
    // Assert:
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
  });

  it('record on already-pending retains original code and discards subsequent', () => {
    // Arrange:
    const sink = new ErrorSink();
    // Act:
    sink.recordError(INVALID_OPERATION);
    sink.recordError(OUT_OF_MEMORY);
    sink.recordError(INVALID_FRAMEBUFFER_OPERATION);
    const result = sink.getError();
    // Assert:
    expect(result).toBe(INVALID_OPERATION);
    const nextResult = sink.getError();
    expect(nextResult).toBe(NO_ERROR);
  });

  it('empty slot yields NO_ERROR on multiple consecutive calls', () => {
    // Arrange:
    const sink = new ErrorSink();
    // Act:
    const r1 = sink.getError();
    const r2 = sink.getError();
    // Assert:
    expect(r1).toBe(NO_ERROR);
    expect(r2).toBe(NO_ERROR);
  });

  it('context-lost interaction returns CONTEXT_LOST_WEBGL once then NO_ERROR', () => {
    // Arrange:
    const sink = new ErrorSink();
    sink.recordError(INVALID_ENUM);
    sink.setContextLost(true);
    // Act:
    const first = sink.getError();
    const second = sink.getError();
    const third = sink.getError();
    // Assert:
    expect(first).toBe(CONTEXT_LOST_WEBGL);
    expect(second).toBe(NO_ERROR);
    expect(third).toBe(NO_ERROR);
    expect(sink.isContextLost()).toBe(true);
  });

  it('recordError is ignored while context is lost', () => {
    // Arrange:
    const sink = new ErrorSink();
    sink.setContextLost(true);
    const first = sink.getError();
    // Act:
    sink.recordError(INVALID_VALUE);
    const second = sink.getError();
    // Assert:
    expect(first).toBe(CONTEXT_LOST_WEBGL);
    expect(second).toBe(NO_ERROR);
  });

  it('reset empties slot and clears context-lost state for fresh-context isolation', () => {
    // Arrange:
    const sink = new ErrorSink();
    sink.setContextLost(true);
    sink.recordError(OUT_OF_MEMORY);
    // Act:
    sink.reset();
    // Assert:
    expect(sink.isContextLost()).toBe(false);
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('recordError with NO_ERROR is a no-op', () => {
    // Arrange:
    const sink = new ErrorSink();
    // Act:
    sink.recordError(NO_ERROR);
    // Assert:
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('no thrown exceptions on arbitrary numeric or invalid inputs', () => {
    // Arrange:
    const sink = new ErrorSink();
    // Act & Assert:
    expect(() => sink.recordError(99999 as GLenum)).not.toThrow();
    expect(sink.getError()).toBe(99999);
    expect(sink.getError()).toBe(NO_ERROR);
  });
});

/** GLState + PipelineState TDD RED-phase tests (Sprint 1 Task 6). Appended; lines 1-260 untouched. */
import { GLState } from '../../src/gl/state';
import {
  ALWAYS,
  BLEND,
  CULL_FACE,
  DEPTH_TEST,
  DITHER,
  FRONT,
  KEEP,
  ONE,
  PACK_ALIGNMENT,
  POLYGON_OFFSET_FILL,
  SAMPLE_ALPHA_TO_COVERAGE,
  SAMPLE_COVERAGE,
  SCISSOR_TEST,
  STENCIL_TEST,
  ZERO,
} from '../../src/gl/constants';

const ALL_CAPS = [
  BLEND,
  DEPTH_TEST,
  SCISSOR_TEST,
  CULL_FACE,
  STENCIL_TEST,
  DITHER,
  POLYGON_OFFSET_FILL,
  SAMPLE_ALPHA_TO_COVERAGE,
  SAMPLE_COVERAGE,
] as const;

describe('GLState - spec defaults (M1 test 1)', () => {
  it('initializes all fields to spec defaults with 64x64 canvas', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink, { width: 64, height: 64 });
    // Act:
    const vp = state.getViewport();
    const sc = state.getScissor();
    // Assert:
    expect(vp).toEqual([0, 0, 64, 64]);
    expect(sc).toEqual([0, 0, 64, 64]);
    expect(state.getClearColor()).toEqual([0, 0, 0, 0]);
    expect(state.getClearDepth()).toBe(1);
    expect(state.getClearStencil()).toBe(0);
    expect(state.getColorMask()).toEqual([true, true, true, true]);
    for (const cap of ALL_CAPS) {
      expect(state.isEnabled(cap)).toBe(false);
    }
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('falls back to 300x150 for missing or non-positive canvas dims', () => {
    // Arrange:
    const sink = new ErrorSink();
    const a = new GLState(sink);
    const b = new GLState(sink, { width: 0, height: -10 });
    // Act:
    const vp1 = a.getViewport();
    const vp2 = b.getViewport();
    // Assert:
    expect(vp1).toEqual([0, 0, 300, 150]);
    expect(vp2).toEqual([0, 0, 300, 150]);
  });

  it('toggles all nine capabilities on and off', () => {
    // Arrange:
    const state = new GLState(new ErrorSink(), { width: 100, height: 100 });
    // Act & Assert:
    for (const cap of ALL_CAPS) {
      state.setEnable(cap, true);
      expect(state.isEnabled(cap)).toBe(true);
      state.setEnable(cap, false);
      expect(state.isEnabled(cap)).toBe(false);
    }
  });
});

describe('GLState - atomic validation (M1 tests 2, 4)', () => {
  it('setEnable with invalid enum records INVALID_ENUM with zero mutation (M1 test 2)', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink, { width: 100, height: 100 });
    // Act:
    state.setEnable(0xffff as GLenum, true);
    // Assert:
    expect(sink.getError()).toBe(INVALID_ENUM);
    for (const cap of ALL_CAPS) {
      expect(state.isEnabled(cap)).toBe(false);
    }
    expect(state.isEnabled(0xffff as GLenum)).toBe(false);
    expect(sink.getError()).toBe(INVALID_ENUM);
  });

  it('viewport with negative dims records INVALID_VALUE preserving prior rect (M1 test 4)', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink, { width: 200, height: 150 });
    state.setViewport(10, 20, 80, 90);
    // Act:
    state.setViewport(0, 0, -1, 10);
    // Assert:
    expect(sink.getError()).toBe(INVALID_VALUE);
    expect(state.getViewport()).toEqual([10, 20, 80, 90]);
  });

  it('scissor with negative dims records INVALID_VALUE preserving prior rect', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink, { width: 200, height: 150 });
    state.setScissor(5, 5, 50, 50);
    // Act:
    state.setScissor(0, 0, 10, -5);
    // Assert:
    expect(sink.getError()).toBe(INVALID_VALUE);
    expect(state.getScissor()).toEqual([5, 5, 50, 50]);
  });

  it('invalid blend factor records INVALID_ENUM with zero mutation', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink);
    // Act:
    state.setBlendFunc(ONE, 0x9999 as GLenum);
    // Assert:
    expect(sink.getError()).toBe(INVALID_ENUM);
    const snap = state.snapshot();
    expect(snap.blend.srcRGB).toBe(ONE);
    expect(snap.blend.dstRGB).toBe(ZERO);
  });

  it('invalid stencil face and func record INVALID_ENUM with zero mutation', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink);
    // Act:
    state.setStencilOpSeparate(0x1234 as GLenum, KEEP, KEEP, KEEP);
    const err1 = sink.getError();
    state.setStencilFuncSeparate(FRONT, 0x9999 as GLenum, 0, 0xff);
    const err2 = sink.getError();
    // Assert:
    expect(err1).toBe(INVALID_ENUM);
    expect(err2).toBe(INVALID_ENUM);
    const snap = state.snapshot();
    expect(snap.stencilFront.func).toBe(ALWAYS);
    expect(snap.stencilFront.sfail).toBe(KEEP);
  });

  it('multiple rejected setters leave snapshot deep-equal to before', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink, { width: 100, height: 100 });
    const before = state.snapshot();
    // Act:
    state.setViewport(-10, 0, -100, 50);
    state.setEnable(0xdead as GLenum, true);
    state.setBlendEquation(0xbeef as GLenum);
    state.setPixelStorei(PACK_ALIGNMENT, 5);
    const after = state.snapshot();
    // Assert:
    expect(after).toEqual(before);
  });
});

describe('PipelineState - immutability', () => {
  it('snapshot is deeply frozen and mutations throw TypeError', () => {
    // Arrange:
    const state = new GLState(new ErrorSink(), { width: 100, height: 100 });
    const snap = state.snapshot();
    // Act & Assert:
    expect(Object.isFrozen(snap)).toBe(true);
    expect(Object.isFrozen(snap.viewport)).toBe(true);
    expect(Object.isFrozen(snap.blend)).toBe(true);
    expect(Object.isFrozen(snap.blend.blendColor)).toBe(true);
    expect(Object.isFrozen(snap.depth)).toBe(true);
    expect(Object.isFrozen(snap.stencilFront)).toBe(true);
    expect(Object.isFrozen(snap.clearValues)).toBe(true);
    expect(() => {
      (snap.viewport as { width: number }).width = 500;
    }).toThrow(TypeError);
    expect(() => {
      (snap as { scissorTestEnabled: boolean }).scissorTestEnabled = true;
    }).toThrow(TypeError);
  });

  it('snapshot contains no bindings or setters', () => {
    // Arrange:
    const state = new GLState(new ErrorSink(), { width: 100, height: 100 });
    // Act:
    const snap = state.snapshot();
    // Assert:
    expect((snap as unknown as Record<string, unknown>).boundArrayBuffer).toBeUndefined();
    expect((snap as unknown as Record<string, unknown>).boundFramebuffer).toBeUndefined();
    expect((snap as unknown as Record<string, unknown>).currentProgram).toBeUndefined();
    expect((snap as unknown as Record<string, unknown>).setViewport).toBeUndefined();
    expect((snap as unknown as Record<string, unknown>).setEnable).toBeUndefined();
  });
});

describe('PipelineState - restore', () => {
  it('restore round-trip reinstates every field overriding mutations', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink, { width: 100, height: 100 });
    state.setViewport(10, 10, 50, 60);
    state.setClearColor(0.2, 0.4, 0.6, 0.8);
    state.setEnable(BLEND, true);
    state.setEnable(DEPTH_TEST, true);
    const original = state.snapshot();
    // Act:
    state.setViewport(0, 0, 300, 150);
    state.setClearColor(1, 1, 1, 1);
    state.setEnable(BLEND, false);
    state.restore(original);
    // Assert:
    expect(state.getViewport()).toEqual([10, 10, 50, 60]);
    expect(state.getClearColor()).toEqual([0.2, 0.4, 0.6, 0.8]);
    expect(state.isEnabled(BLEND)).toBe(true);
    expect(state.isEnabled(DEPTH_TEST)).toBe(true);
    expect(state.snapshot()).toEqual(original);
  });
});
