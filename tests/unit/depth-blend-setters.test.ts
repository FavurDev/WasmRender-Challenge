import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  ALWAYS, BLEND_DST_RGB, BLEND_EQUATION, BLEND_SRC_RGB, COLOR_BUFFER_BIT,
  CONTEXT_LOST_WEBGL, DEPTH_FUNC, EQUAL, FUNC_ADD, FUNC_REVERSE_SUBTRACT,
  FUNC_SUBTRACT, GEQUAL, GREATER, INVALID_ENUM, LEQUAL, LESS, NEVER, NOTEQUAL,
  NO_ERROR, ONE, SRC_ALPHA, ZERO,
} from '../../src/renderer/gl-constants';

type SetterCtx = ReturnType<typeof createSoftwareWebGLContext> & object;

function freshCtx(): NonNullable<ReturnType<typeof createSoftwareWebGLContext>> {
  const ctx = createSoftwareWebGLContext({ width: 8, height: 8 });
  if (!ctx) throw new Error('factory returned null');
  return ctx;
}

describe('depth-blend setters (TDD red phase)', () => {
  it('depth round-trip: 8 modes via depthFunc/getParameter', () => {
    // Arrange
    const ctx = freshCtx() as SetterCtx & { depthFunc(f: number): void };
    const modes = [NEVER, LESS, EQUAL, LEQUAL, GREATER, NOTEQUAL, GEQUAL, ALWAYS];
    // Act + Assert
    for (const m of modes) {
      ctx.depthFunc(m);
      expect(ctx.getParameter(DEPTH_FUNC)).toBe(m);
    }
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('blend equation round-trip: 3 modes', () => {
    // Arrange
    const ctx = freshCtx() as SetterCtx & { blendEquation(m: number): void };
    // Act + Assert
    for (const m of [FUNC_ADD, FUNC_SUBTRACT, FUNC_REVERSE_SUBTRACT]) {
      ctx.blendEquation(m);
      expect(ctx.getParameter(BLEND_EQUATION)).toBe(m);
    }
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('blend all-or-nothing: one valid + 0x9999 yields exactly one INVALID_ENUM, factors unchanged', () => {
    // Arrange
    const ctx = freshCtx() as SetterCtx & { blendFunc(s: number, d: number): void };
    const priorSrc = ctx.getParameter(BLEND_SRC_RGB);
    const priorDst = ctx.getParameter(BLEND_DST_RGB);
    // Act
    ctx.blendFunc(ONE, 0x9999);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
    expect(ctx.getParameter(BLEND_SRC_RGB)).toBe(priorSrc);
    expect(ctx.getParameter(BLEND_DST_RGB)).toBe(priorDst);
  });

  it('per-setter invalid-enum rejection leaves state unchanged', () => {
    // Arrange depth
    const a = freshCtx() as SetterCtx & { depthFunc(f: number): void };
    const priorDepth = a.getParameter(DEPTH_FUNC);
    // Act
    a.depthFunc(0x9999);
    // Assert
    expect(a.getError()).toBe(INVALID_ENUM);
    expect(a.getError()).toBe(NO_ERROR);
    expect(a.getParameter(DEPTH_FUNC)).toBe(priorDepth);

    // Arrange blend
    const b = freshCtx() as SetterCtx & { blendFunc(s: number, d: number): void };
    const priorS = b.getParameter(BLEND_SRC_RGB);
    const priorD = b.getParameter(BLEND_DST_RGB);
    // Act
    b.blendFunc(0x9999, 0x9999);
    // Assert
    expect(b.getError()).toBe(INVALID_ENUM);
    expect(b.getError()).toBe(NO_ERROR);
    expect(b.getParameter(BLEND_SRC_RGB)).toBe(priorS);
    expect(b.getParameter(BLEND_DST_RGB)).toBe(priorD);

    // Arrange equation
    const c = freshCtx() as SetterCtx & { blendEquation(m: number): void };
    const priorEq = c.getParameter(BLEND_EQUATION);
    // Act
    c.blendEquation(0x9999);
    // Assert
    expect(c.getError()).toBe(INVALID_ENUM);
    expect(c.getError()).toBe(NO_ERROR);
    expect(c.getParameter(BLEND_EQUATION)).toBe(priorEq);
  });

  it('lost-context guard: setters push CONTEXT_LOST_WEBGL and commit nothing', () => {
    // Arrange
    const ctx = freshCtx() as SetterCtx & { depthFunc(f: number): void; blendFunc(s: number, d: number): void; blendEquation(m: number): void };
    const priorDepth = ctx.getParameter(DEPTH_FUNC);
    const priorEq = ctx.getParameter(BLEND_EQUATION);
    ctx.loseContext();
    // Act + Assert depth
    ctx.depthFunc(LESS);
    expect(ctx.getError()).toBe(CONTEXT_LOST_WEBGL);
    expect(ctx.getParameter(DEPTH_FUNC)).toBe(priorDepth);
    // Act + Assert blend
    ctx.blendFunc(SRC_ALPHA, ONE);
    expect(ctx.getError()).toBe(CONTEXT_LOST_WEBGL);
    // Act + Assert equation
    ctx.blendEquation(FUNC_ADD);
    expect(ctx.getError()).toBe(CONTEXT_LOST_WEBGL);
    expect(ctx.getParameter(BLEND_EQUATION)).toBe(priorEq);
  });

  it('integration: setter-to-draw analytic outcome', () => {
    // Arrange
    const ctx = freshCtx() as SetterCtx & { depthFunc(f: number): void; blendFunc(s: number, d: number): void; blendEquation(m: number): void };
    // Act
    ctx.depthFunc(LESS);
    ctx.blendFunc(SRC_ALPHA, ZERO);
    ctx.blendEquation(FUNC_ADD);
    ctx.clearColor(1, 0, 0, 1);
    ctx.clear(COLOR_BUFFER_BIT);
    const px = ctx.readPixels(0, 0, 1, 1);
    // Assert
    expect([...px!]).toEqual([255, 0, 0, 255]);
    expect(ctx.getParameter(DEPTH_FUNC)).toBe(LESS);
    expect(ctx.getError()).toBe(NO_ERROR);
  });
});
