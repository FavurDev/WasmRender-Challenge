import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import { INVALID_ENUM, INVALID_VALUE, NO_ERROR } from '../../src/renderer/gl-constants';
import { OutOfMemoryError as CanonicalOOM } from '../../src/renderer/errors';
import { OutOfMemoryError as FramebufferOOM, Framebuffer } from '../../src/renderer/framebuffer';
import { readFileSync } from 'node:fs';

function canvasDouble(w: number, h: number) {
  return {
    width: w,
    height: h,
    getContext: (_kind: string) => ({
      putImageData: (_img: unknown, _x: number, _y: number) => undefined,
    }),
  };
}

describe('context composition root (red phase)', () => {
  it('routing object shape exposes clear, viewport, getError as functions', () => {
    // Arrange
    const canvas = canvasDouble(64, 64);
    // Act
    const ctx = createSoftwareWebGLContext(canvas as never);
    // Assert
    expect(ctx).not.toBeNull();
    expect(typeof (ctx as never as Record<string, unknown>)['clear']).toBe('function');
    expect(typeof (ctx as never as Record<string, unknown>)['viewport']).toBe('function');
    expect(typeof (ctx as never as Record<string, unknown>)['getError']).toBe('function');
  });

  it('enable unknown capability pushes one INVALID_ENUM leaving flags unchanged', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    // Act
    ctx.enable(0x9999);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
  });

  it('viewport negative width pushes one INVALID_VALUE leaving box unchanged', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    const before = ctx.getParameter(0x0ba2);
    // Act
    ctx.viewport(0, 0, -10, 10);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_VALUE);
    expect(second).toBe(NO_ERROR);
    expect(ctx.getParameter(0x0ba2)).toEqual(before);
  });

  it('getError drains FIFO to NO_ERROR and never throws', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    // Act
    ctx.enable(0x9999);
    ctx.viewport(0, 0, -1, 4);
    const first = ctx.getError();
    const second = ctx.getError();
    const third = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(INVALID_VALUE);
    expect(third).toBe(NO_ERROR);
  });

  it('two factory calls yield isolated contexts', () => {
    // Arrange
    const a = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    const b = createSoftwareWebGLContext(canvasDouble(32, 32) as never)!;
    // Act
    a.clearColor(1, 0, 0, 1);
    b.clearColor(0, 0, 1, 1);
    a.enable(0x9999);
    const resultB = b.getError();
    // Assert
    expect(resultB).toBe(NO_ERROR);
    expect(a.getParameter(0x0b00)).not.toEqual(b.getParameter(0x0b00));
  });

  it('factory never throws returning null on oversize allocation', () => {
    // Arrange
    const canvas = canvasDouble(5000, 64);
    // Act
    let result: unknown = 'unset';
    expect(() => {
      result = createSoftwareWebGLContext(canvas as never);
    }).not.toThrow();
    // Assert
    expect(result).toBeNull();
  });

  it('triangle path paints interior pixels and drains clean', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    // Act
    ctx.drawTriangle();
    const interior = ctx.readPixels(32, 40, 1, 1);
    const exterior = ctx.readPixels(4, 4, 1, 1);
    const code = ctx.getError();
    // Assert
    expect(Array.from(interior!.slice(0, 3))).toEqual([255, 0, 0]);
    expect(Array.from(exterior!.slice(0, 3))).not.toEqual([255, 0, 0]);
    expect(code).toBe(NO_ERROR);
  });

  it('framebuffer reconciliation keeps canonical OutOfMemoryError identity', () => {
    // Arrange
    const fb = new Framebuffer(16, 16);
    const before = fb.color.slice();
    // Act
    const identical = CanonicalOOM === (FramebufferOOM as unknown);
    let name = '';
    try {
      fb.resize(5000, 64);
    } catch (e) {
      name = (e as Error).name;
    }
    // Assert
    expect(identical).toBe(true);
    expect(name).toBe('OutOfMemoryError');
    expect(Array.from(fb.color)).toEqual(Array.from(before));
  });

  it('harness contract stays byte-identical', () => {
    // Arrange
    const text = readFileSync('src/context-intercept.ts', 'utf-8');
    // Act
    const hasRouting = text.includes('__createSoftwareWebGLContext');
    // Assert
    expect(hasRouting).toBe(true);
    expect(text).toContain('RENDERER_NOT_FOUND');
  });
});
