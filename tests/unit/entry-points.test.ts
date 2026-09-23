/** Sprint 9 Task 2 TDD RED-phase tests — finish, flush, lineWidth, getShaderPrecisionFormat. */
import { describe, expect, it } from 'vitest';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  CONTEXT_LOST_WEBGL,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  INVALID_VALUE,
  LINE_WIDTH,
  NO_ERROR,
  VERTEX_SHADER,
} from '../../src/gl/constants';

// Precision enums absent from src/gl/constants.ts (unimplemented surface) — local spec hex fallbacks.
const LOW_FLOAT = 0x8df0;
const MEDIUM_FLOAT = 0x8df1;
const HIGH_FLOAT = 0x8df2;
const LOW_INT = 0x8df3;
const MEDIUM_INT = 0x8df4;
const HIGH_INT = 0x8df5;

type PrecisionFormat = { readonly rangeMin: number; readonly rangeMax: number; readonly precision: number };
type EntryPointsFacade = {
  finish(): void;
  flush(): void;
  lineWidth(width: number): void;
  getShaderPrecisionFormat(shaderType: number, precisionType: number): PrecisionFormat | null;
};
type LoseExt = { loseContext(): void; restoreContext(): void };

function freshGl(): WebGL1Context & EntryPointsFacade {
  return new WebGL1Context({ width: 300, height: 150 }) as unknown as WebGL1Context & EntryPointsFacade;
}

function lose(gl: WebGL1Context): LoseExt {
  return gl.getExtension('WEBGL_lose_context') as unknown as LoseExt;
}

describe('entry-points RED: finish/flush/lineWidth/getShaderPrecisionFormat', () => {
  it('Test 1: finish and flush execute without error on healthy context', () => {
    // Arrange:
    const gl = freshGl();
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.finish();
    const err1 = gl.getError();
    gl.flush();
    const err2 = gl.getError();
    // Assert:
    expect(err1).toBe(NO_ERROR);
    expect(err2).toBe(NO_ERROR);
  });

  it('Test 2: finish and flush respect context loss without error', () => {
    // Arrange:
    const gl = freshGl();
    lose(gl).loseContext();
    const drain = gl.getError();
    // Act:
    gl.finish();
    const errFinish = gl.getError();
    gl.flush();
    const errFlush = gl.getError();
    // Assert:
    expect(drain).toBe(CONTEXT_LOST_WEBGL);
    expect(errFinish).toBe(NO_ERROR);
    expect(errFlush).toBe(NO_ERROR);
  });

  it('Test 3: lineWidth accepts width 1 and getParameter(LINE_WIDTH) reflects it', () => {
    // Arrange:
    const gl = freshGl();
    expect(gl.getParameter(LINE_WIDTH)).toBe(1);
    // Act:
    gl.lineWidth(1);
    const err = gl.getError();
    const queriedWidth = gl.getParameter(LINE_WIDTH);
    // Assert:
    expect(err).toBe(NO_ERROR);
    expect(queriedWidth).toBe(1);
  });

  it('Test 4: lineWidth accepts positive out-of-range width 2.5 without error', () => {
    // Arrange:
    const gl = freshGl();
    // Act:
    gl.lineWidth(2.5);
    const err = gl.getError();
    const queriedWidth = gl.getParameter(LINE_WIDTH);
    // Assert:
    expect(err).toBe(NO_ERROR);
    expect(queriedWidth).toBe(2.5);
  });

  it('Test 5: lineWidth rejects zero, negative, NaN, Infinity with INVALID_VALUE and preserves state', () => {
    // Arrange:
    const gl = freshGl();
    gl.lineWidth(1.5);
    const initialWidth = gl.getParameter(LINE_WIDTH);
    expect(initialWidth).toBe(1.5);
    // Act & Assert — zero:
    gl.lineWidth(0);
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getParameter(LINE_WIDTH)).toBe(initialWidth);
    // Act & Assert — negative:
    gl.lineWidth(-2.0);
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getParameter(LINE_WIDTH)).toBe(initialWidth);
    // Act & Assert — NaN:
    gl.lineWidth(NaN);
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getParameter(LINE_WIDTH)).toBe(initialWidth);
    // Act & Assert — Infinity:
    gl.lineWidth(Infinity);
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getParameter(LINE_WIDTH)).toBe(initialWidth);
  });

  it('Test 6: getShaderPrecisionFormat returns exact GLSL ES 1.00 Section 4.5 minima table', () => {
    // Arrange:
    const gl = freshGl();
    const table: Array<[number, { rangeMin: number; rangeMax: number; precision: number }]> = [
      [HIGH_FLOAT, { rangeMin: 127, rangeMax: 127, precision: 24 }],
      [MEDIUM_FLOAT, { rangeMin: 14, rangeMax: 14, precision: 10 }],
      [LOW_FLOAT, { rangeMin: 1, rangeMax: 1, precision: 8 }],
      [HIGH_INT, { rangeMin: 30, rangeMax: 30, precision: 0 }],
      [MEDIUM_INT, { rangeMin: 14, rangeMax: 14, precision: 0 }],
      [LOW_INT, { rangeMin: 8, rangeMax: 8, precision: 0 }],
    ];
    // Act & Assert:
    for (const shaderType of [VERTEX_SHADER, FRAGMENT_SHADER]) {
      for (const [precisionType, expected] of table) {
        const fmt = gl.getShaderPrecisionFormat(shaderType, precisionType);
        expect(fmt).not.toBeNull();
        expect(fmt?.rangeMin).toBe(expected.rangeMin);
        expect(fmt?.rangeMax).toBe(expected.rangeMax);
        expect(fmt?.precision).toBe(expected.precision);
      }
    }
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('Test 7: getShaderPrecisionFormat returns memoized object references', () => {
    // Arrange:
    const gl = freshGl();
    // Act:
    const fmt1 = gl.getShaderPrecisionFormat(VERTEX_SHADER, HIGH_FLOAT);
    const fmt2 = gl.getShaderPrecisionFormat(VERTEX_SHADER, HIGH_FLOAT);
    const fmt3 = gl.getShaderPrecisionFormat(FRAGMENT_SHADER, MEDIUM_FLOAT);
    const fmt4 = gl.getShaderPrecisionFormat(FRAGMENT_SHADER, MEDIUM_FLOAT);
    // Assert:
    expect(fmt1).toBe(fmt2);
    expect(fmt3).toBe(fmt4);
    expect(fmt1).not.toBe(fmt3);
  });

  it('Test 8: getShaderPrecisionFormat invalid enum paths and context loss', () => {
    // Arrange:
    const gl = freshGl();
    // Act & Assert — invalid shaderType:
    const res1 = gl.getShaderPrecisionFormat(0x1234, HIGH_FLOAT);
    expect(res1).toBeNull();
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act & Assert — invalid precisionType:
    const res2 = gl.getShaderPrecisionFormat(VERTEX_SHADER, 0x5678);
    expect(res2).toBeNull();
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act & Assert — context lost:
    lose(gl).loseContext();
    gl.getError();
    const resLost = gl.getShaderPrecisionFormat(VERTEX_SHADER, HIGH_FLOAT);
    expect(resLost).toBeNull();
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
