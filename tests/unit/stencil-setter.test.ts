import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  ALWAYS,
  CONTEXT_LOST_WEBGL,
  DECR,
  INCR,
  INVALID_ENUM,
  KEEP,
  LESS,
  NO_ERROR,
  REPLACE,
  STENCIL_FAIL,
  STENCIL_FUNC,
  STENCIL_PASS_DEPTH_FAIL,
  STENCIL_PASS_DEPTH_PASS,
  STENCIL_REF,
  STENCIL_VALUE_MASK,
} from '../../src/renderer/gl-constants';

function fresh(): ReturnType<typeof createSoftwareWebGLContext> {
  return createSoftwareWebGLContext({ width: 8, height: 8 } as never);
}

type StencilCtx = ReturnType<typeof createSoftwareWebGLContext> & {
  stencilFunc(func: number, ref: number, mask: number): void;
  stencilOp(fail: number, zfail: number, zpass: number): void;
};

describe('stencil setters (TDD red phase)', () => {
  it('stencilFunc clamps ref 300 to 44', () => {
    // Arrange
    const gl = fresh() as unknown as StencilCtx;
    // Act
    gl.stencilFunc(ALWAYS, 300, 0xff);
    // Assert
    expect(gl.getParameter(STENCIL_REF)).toBe(44);
  });

  it('stencilFunc clamps mask 0x1FF to 0xFF', () => {
    // Arrange
    const gl = fresh() as unknown as StencilCtx;
    // Act
    gl.stencilFunc(ALWAYS, 1, 0x1ff);
    // Assert
    expect(gl.getParameter(STENCIL_VALUE_MASK)).toBe(0xff);
  });

  it('stencilOp rejects 2-valid-1-invalid with exactly one error and no commit', () => {
    // Arrange
    const gl = fresh() as unknown as StencilCtx;
    // Act
    gl.stencilOp(KEEP, REPLACE, 0xdead);
    // Assert
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getParameter(STENCIL_FAIL)).toBe(KEEP);
    expect(gl.getParameter(STENCIL_PASS_DEPTH_FAIL)).toBe(KEEP);
    expect(gl.getParameter(STENCIL_PASS_DEPTH_PASS)).toBe(KEEP);
  });

  it('stencilFunc rejects invalid func with one error and unchanged state', () => {
    // Arrange
    const gl = fresh() as unknown as StencilCtx;
    const beforeFunc = gl.getParameter(STENCIL_FUNC);
    const beforeRef = gl.getParameter(STENCIL_REF);
    const beforeMask = gl.getParameter(STENCIL_VALUE_MASK);
    // Act
    gl.stencilFunc(0xdead, 1, 0xff);
    // Assert
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getParameter(STENCIL_FUNC)).toBe(beforeFunc);
    expect(gl.getParameter(STENCIL_REF)).toBe(beforeRef);
    expect(gl.getParameter(STENCIL_VALUE_MASK)).toBe(beforeMask);
  });

  it('stencilFunc round-trips via getParameter', () => {
    // Arrange
    const gl = fresh() as unknown as StencilCtx;
    // Act
    gl.stencilFunc(LESS, 42, 0x0f);
    // Assert
    expect(gl.getParameter(STENCIL_FUNC)).toBe(LESS);
    expect(gl.getParameter(STENCIL_REF)).toBe(42);
    expect(gl.getParameter(STENCIL_VALUE_MASK)).toBe(0x0f);
  });

  it('stencilOp round-trips via getParameter', () => {
    // Arrange
    const gl = fresh() as unknown as StencilCtx;
    // Act
    gl.stencilOp(REPLACE, INCR, DECR);
    // Assert
    expect(gl.getParameter(STENCIL_FAIL)).toBe(REPLACE);
    expect(gl.getParameter(STENCIL_PASS_DEPTH_FAIL)).toBe(INCR);
    expect(gl.getParameter(STENCIL_PASS_DEPTH_PASS)).toBe(DECR);
  });

  it('stencil setters guard lost context', () => {
    // Arrange
    const gl = fresh() as unknown as StencilCtx;
    gl.loseContext();
    // Act
    gl.stencilFunc(LESS, 1, 0xff);
    gl.stencilOp(KEEP, KEEP, KEEP);
    // Assert
    expect(gl.getError()).toBe(CONTEXT_LOST_WEBGL);
  });

  it('valid stencil calls queue no error', () => {
    // Arrange
    const gl = fresh() as unknown as StencilCtx;
    // Act
    gl.stencilFunc(LESS, 7, 0xff);
    gl.stencilOp(KEEP, REPLACE, INCR);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
