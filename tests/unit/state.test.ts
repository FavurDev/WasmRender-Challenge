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
