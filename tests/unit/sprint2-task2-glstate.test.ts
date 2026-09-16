import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  BLEND,
  COLOR_BUFFER_BIT,
  CULL_FACE,
  DEPTH_TEST,
  INVALID_ENUM,
  INVALID_VALUE,
  NO_ERROR,
  SCISSOR_TEST,
  STENCIL_TEST,
} from '../../src/renderer/gl-constants';

function canvasDouble(w: number, h: number) {
  return {
    width: w,
    height: h,
    getContext: (_kind: string) => ({
      putImageData: (_img: unknown, _x: number, _y: number) => undefined,
    }),
  };
}

type Ctx = NonNullable<ReturnType<typeof createSoftwareWebGLContext>>;

function freshCtx(w = 64, h = 64): Ctx {
  const ctx = createSoftwareWebGLContext(canvasDouble(w, h) as never);
  if (!ctx) throw new Error('factory returned null');
  return ctx;
}

describe('sprint2 task2 GLState extension (TDD red phase)', () => {
  it('BLEND toggle isolation: enable flips true, disable returns false, others unaffected', () => {
    // Arrange
    const ctx = freshCtx();
    const anyCtx = ctx as unknown as Record<string, (cap: number) => boolean>;
    // Act
    const d0 = anyCtx['isEnabled'](DEPTH_TEST);
    const s0 = anyCtx['isEnabled'](STENCIL_TEST);
    const sc0 = anyCtx['isEnabled'](SCISSOR_TEST);
    const c0 = anyCtx['isEnabled'](CULL_FACE);
    ctx.enable(BLEND);
    const on = anyCtx['isEnabled'](BLEND);
    ctx.disable(BLEND);
    const off = anyCtx['isEnabled'](BLEND);
    const d1 = anyCtx['isEnabled'](DEPTH_TEST);
    const s1 = anyCtx['isEnabled'](STENCIL_TEST);
    const sc1 = anyCtx['isEnabled'](SCISSOR_TEST);
    const c1 = anyCtx['isEnabled'](CULL_FACE);
    const err = ctx.getError();
    // Assert
    expect([d0, s0, sc0, c0]).toEqual([false, false, false, false]);
    expect(on).toBe(true);
    expect(off).toBe(false);
    expect([d1, s1, sc1, c1]).toEqual([false, false, false, false]);
    expect(err).toBe(NO_ERROR);
  });

  it('negative scissor rejected: one INVALID_VALUE, box unchanged, second drain NO_ERROR', () => {
    // Arrange
    const ctx = freshCtx();
    const anyCtx = ctx as unknown as Record<string, (...a: number[]) => unknown>;
    const baseline = (ctx.getParameter(0x0c10) as number[] | null) ?? (anyCtx['getScissor'] as () => number[])?.();
    while (ctx.getError() !== NO_ERROR) { /* drain */ }
    // Act
    (anyCtx['scissor'] as (x: number, y: number, w: number, h: number) => void)(0, 0, -5, 10);
    const after = (ctx.getParameter(0x0c10) as number[] | null) ?? (anyCtx['getScissor'] as () => number[])?.();
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(after).toEqual(baseline);
    expect(first).toBe(INVALID_VALUE);
    expect(second).toBe(NO_ERROR);
  });

  it('colorMask confinement: mask(true,false,false,true) clear updates red+alpha only', () => {
    // Arrange
    const ctx = freshCtx(8, 8);
    const anyCtx = ctx as unknown as Record<string, (...a: never[]) => void>;
    (anyCtx['colorMask'] as (r: boolean, g: boolean, b: boolean, a: boolean) => void)(true, true, true, true);
    ctx.clearColor(0, 0, 0, 0);
    ctx.clear(COLOR_BUFFER_BIT);
    const before = ctx.readPixels(0, 0, 8, 8)!;
    ctx.clearColor(1, 1, 1, 1);
    (anyCtx['colorMask'] as (r: boolean, g: boolean, b: boolean, a: boolean) => void)(true, false, false, true);
    // Act
    ctx.clear(COLOR_BUFFER_BIT);
    const px = ctx.readPixels(0, 0, 8, 8)!;
    // Assert
    expect(px[0]).toBe(255);
    expect(px[3]).toBe(255);
    expect(px[1]).toBe(before[1]);
    expect(px[2]).toBe(before[2]);
  });

  it('fresh defaults: CULL_FACE false, stencilMask 0xff, preserved defaults hold', () => {
    // Arrange
    const ctx = freshCtx(64, 48);
    const anyCtx = ctx as unknown as Record<string, (cap: number) => boolean>;
    // Act
    const cull = anyCtx['isEnabled'](CULL_FACE);
    const stencilMask =
      (ctx.getParameter(0x0b98) as number | null) ??
      (ctx as unknown as { state?: { stencilMask?: number } }).state?.stencilMask;
    const clearColor = ctx.getParameter(0x0b00);
    const viewport = ctx.getParameter(0x0ba2);
    const err = ctx.getError();
    // Assert
    expect(cull).toBe(false);
    expect(stencilMask).toBe(0xff);
    expect(clearColor).toEqual([0, 0, 0, 0]);
    expect(viewport).toEqual([0, 0, 64, 48]);
    expect(err).toBe(NO_ERROR);
  });

  it('unknown-enum rejection: enable 0x9999 pushes one INVALID_ENUM, isEnabled false', () => {
    // Arrange
    const ctx = freshCtx();
    const anyCtx = ctx as unknown as Record<string, (cap: number) => boolean>;
    // Act
    ctx.enable(0x9999);
    const q = anyCtx['isEnabled'](0x9999);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(q).toBe(false);
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
  });
});
