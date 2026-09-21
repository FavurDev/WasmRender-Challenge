// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial/extended state suite
/** Context-attribute and GLState unit tests (Sprint 1 Tasks 4 and 6 green suite) — verifies attributes, error queue, state setters, and PipelineState snapshots. */
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
/** Sprint 5 Task 3 TDD RED-phase tests — vertex attrib state + buffer facade wiring. Appended; lines above untouched. */
import { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ARRAY_BUFFER,
  BUFFER_SIZE,
  BUFFER_USAGE,
  FLOAT,
  SHORT,
  STATIC_DRAW,
} from '../../src/gl/constants';

function createBoundContext(): WebGL1Context {
  // Arrange helper: fresh context with an ARRAY_BUFFER bound.
  const gl = new WebGL1Context();
  const buf = (gl as unknown as { createBuffer: () => unknown }).createBuffer() as never;
  (gl as unknown as { bindBuffer: (t: number, b: unknown) => void }).bindBuffer(ARRAY_BUFFER, buf);
  return gl;
}

describe('Sprint 5 Task 3 - vertex attrib state (RED)', () => {
  it('TEST 1: descriptor capture at pointer time records size/stride/offset/buffer', () => {
    // Arrange:
    const gl = new WebGL1Context();
    const buf = (gl as unknown as { createBuffer: () => unknown }).createBuffer();
    (gl as unknown as { bindBuffer: (t: number, b: unknown) => void }).bindBuffer(ARRAY_BUFFER, buf);
    // Act:
    (gl as unknown as { vertexAttribPointer: (...a: unknown[]) => void }).vertexAttribPointer(0, 3, FLOAT, false, 12, 4);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    const desc = (gl as unknown as { getVertexAttribDescriptor: (i: number) => { size: number; type: number; normalized: boolean; stride: number; offset: number; buffer: unknown } }).getVertexAttribDescriptor(0);
    expect(desc.size).toBe(3);
    expect(desc.type).toBe(FLOAT);
    expect(desc.normalized).toBe(false);
    expect(desc.stride).toBe(12);
    expect(desc.offset).toBe(4);
    expect(desc.buffer).toBe(buf);
  });

  it('TEST 2: stride 256 rejected with INVALID_VALUE, descriptor stays default', () => {
    // Arrange:
    const gl = createBoundContext();
    // Act:
    (gl as unknown as { vertexAttribPointer: (...a: unknown[]) => void }).vertexAttribPointer(0, 3, FLOAT, false, 256, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    const desc = (gl as unknown as { getVertexAttribDescriptor: (i: number) => { buffer: unknown } }).getVertexAttribDescriptor(0);
    expect(desc.buffer).toBeNull();
  });

  it('TEST 3: misaligned offset on FLOAT rejected with INVALID_VALUE', () => {
    // Arrange:
    const gl = createBoundContext();
    // Act:
    (gl as unknown as { vertexAttribPointer: (...a: unknown[]) => void }).vertexAttribPointer(0, 3, FLOAT, false, 16, 2);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    const desc = (gl as unknown as { getVertexAttribDescriptor: (i: number) => { buffer: unknown } }).getVertexAttribDescriptor(0);
    expect(desc.buffer).toBeNull();
  });

  it('TEST 4: misaligned stride on SHORT rejected with INVALID_VALUE', () => {
    // Arrange:
    const gl = createBoundContext();
    // Act:
    (gl as unknown as { vertexAttribPointer: (...a: unknown[]) => void }).vertexAttribPointer(0, 2, SHORT, false, 3, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    const desc = (gl as unknown as { getVertexAttribDescriptor: (i: number) => { buffer: unknown } }).getVertexAttribDescriptor(0);
    expect(desc.buffer).toBeNull();
  });

  it('TEST 5: index 16 rejected with INVALID_VALUE across all four method families', () => {
    // Arrange:
    const gl = createBoundContext();
    const g = gl as unknown as {
      vertexAttribPointer: (...a: unknown[]) => void;
      enableVertexAttribArray: (i: number) => void;
      disableVertexAttribArray: (i: number) => void;
      vertexAttrib4f: (...a: unknown[]) => void;
    };
    // Act:
    g.vertexAttribPointer(16, 4, FLOAT, false, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act:
    g.enableVertexAttribArray(16);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act:
    g.disableVertexAttribArray(16);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act:
    g.vertexAttrib4f(16, 1, 2, 3, 4);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TEST 6: bad size 0 and 5 rejected with INVALID_VALUE', () => {
    // Arrange:
    const gl = createBoundContext();
    const g = gl as unknown as { vertexAttribPointer: (...a: unknown[]) => void };
    // Act:
    g.vertexAttribPointer(0, 0, FLOAT, false, 0, 0);
    const err1 = gl.getError();
    g.vertexAttribPointer(0, 5, FLOAT, false, 0, 0);
    const err2 = gl.getError();
    // Assert:
    expect(err1).toBe(INVALID_VALUE);
    expect(err2).toBe(INVALID_VALUE);
  });

  it('TEST 7: bad type rejected with INVALID_ENUM', () => {
    // Arrange:
    const gl = createBoundContext();
    // Act:
    (gl as unknown as { vertexAttribPointer: (...a: unknown[]) => void }).vertexAttribPointer(0, 3, 0x1234, false, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TEST 8: no ARRAY_BUFFER bound records INVALID_OPERATION', () => {
    // Arrange:
    const gl = new WebGL1Context();
    // Act:
    (gl as unknown as { vertexAttribPointer: (...a: unknown[]) => void }).vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TEST 9: enable and disable vertex attrib array toggles enabled flag', () => {
    // Arrange:
    const gl = new WebGL1Context();
    const g = gl as unknown as {
      enableVertexAttribArray: (i: number) => void;
      disableVertexAttribArray: (i: number) => void;
      getVertexAttribDescriptor: (i: number) => { enabled: boolean };
    };
    // Act:
    g.enableVertexAttribArray(2);
    const state1 = g.getVertexAttribDescriptor(2).enabled;
    g.disableVertexAttribArray(2);
    const state2 = g.getVertexAttribDescriptor(2).enabled;
    // Assert:
    expect(state1).toBe(true);
    expect(state2).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TEST 10: generic value writes include component defaults', () => {
    // Arrange:
    const gl = new WebGL1Context();
    const g = gl as unknown as {
      vertexAttrib1f: (i: number, x: number) => void;
      vertexAttrib2f: (i: number, x: number, y: number) => void;
      vertexAttrib3f: (i: number, x: number, y: number, z: number) => void;
      vertexAttrib4f: (i: number, x: number, y: number, z: number, w: number) => void;
      getVertexAttribDescriptor: (i: number) => { genericValue: readonly number[] };
    };
    // Act:
    g.vertexAttrib1f(1, 5.0);
    const val1 = g.getVertexAttribDescriptor(1).genericValue;
    g.vertexAttrib2f(2, 3.0, 4.0);
    const val2 = g.getVertexAttribDescriptor(2).genericValue;
    g.vertexAttrib3f(3, 1.0, 2.0, 3.0);
    const val3 = g.getVertexAttribDescriptor(3).genericValue;
    g.vertexAttrib4f(4, 7.0, 8.0, 9.0, 10.0);
    const val4 = g.getVertexAttribDescriptor(4).genericValue;
    // Assert:
    expect([...val1]).toEqual([5.0, 0.0, 0.0, 1.0]);
    expect([...val2]).toEqual([3.0, 4.0, 0.0, 1.0]);
    expect([...val3]).toEqual([1.0, 2.0, 3.0, 1.0]);
    expect([...val4]).toEqual([7.0, 8.0, 9.0, 10.0]);
  });

  it('TEST 11: atomicity - rejected call leaves prior descriptor intact', () => {
    // Arrange:
    const gl = createBoundContext();
    const g = gl as unknown as {
      vertexAttribPointer: (...a: unknown[]) => void;
      getVertexAttribDescriptor: (i: number) => Record<string, unknown>;
    };
    g.vertexAttribPointer(0, 2, FLOAT, false, 8, 0);
    const originalDesc = JSON.parse(JSON.stringify(g.getVertexAttribDescriptor(0))) as Record<string, unknown>;
    // Act:
    g.vertexAttribPointer(0, 5, FLOAT, false, 8, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(JSON.parse(JSON.stringify(g.getVertexAttribDescriptor(0))) as Record<string, unknown>).toEqual(originalDesc);
  });

  it('TEST 12: buffer facade delegation smoke cases', () => {
    // Arrange:
    const gl = new WebGL1Context();
    const g = gl as unknown as {
      createBuffer: () => unknown;
      isBuffer: (b: unknown) => boolean;
      bindBuffer: (t: number, b: unknown) => void;
      bufferData: (t: number, d: unknown, u: number) => void;
      bufferSubData: (t: number, o: number, d: unknown) => void;
      getBufferParameter: (t: number, p: number) => unknown;
      deleteBuffer: (b: unknown) => void;
    };
    // Act:
    const buf = g.createBuffer();
    const isBuf = g.isBuffer(buf);
    g.bindBuffer(ARRAY_BUFFER, buf);
    const data = new Float32Array([1.0, 2.0, 3.0, 4.0]);
    g.bufferData(ARRAY_BUFFER, data, STATIC_DRAW);
    const size = g.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE);
    const usage = g.getBufferParameter(ARRAY_BUFFER, BUFFER_USAGE);
    const sub = new Float32Array([9.0]);
    g.bufferSubData(ARRAY_BUFFER, 0, sub);
    g.deleteBuffer(buf);
    const isBufAfter = g.isBuffer(buf);
    // Assert:
    expect(isBuf).toBe(true);
    expect(size).toBe(16);
    expect(usage).toBe(STATIC_DRAW);
    expect(isBufAfter).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
