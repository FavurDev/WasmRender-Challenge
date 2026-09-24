/** Sprint 12 Task 4 Unit 1 — entry factory coverage (composition-root dispatcher). */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import { MAX_VIEWPORT_DIMS, NO_ERROR, RGBA, UNSIGNED_BYTE, VIEWPORT } from '../../src/gl/constants';

describe('sprint12 entry coverage', () => {
  it('creates a WebGL1 context for default type', () => {
    // Arrange
    const canvas = { width: 300, height: 150 };
    // Act
    const ctx = createSoftwareWebGLContext(canvas);
    // Assert
    expect(ctx).not.toBeNull();
    expect(ctx!.getError()).toBe(NO_ERROR);
  });

  it('creates a WebGL1 context for experimental-webgl type', () => {
    // Arrange
    const canvas = { width: 16, height: 16 };
    // Act
    const ctx = createSoftwareWebGLContext(canvas, null, 'experimental-webgl');
    // Assert
    expect(ctx).not.toBeNull();
  });

  it('trims whitespace around the type string', () => {
    // Arrange
    const canvas = { width: 8, height: 8 };
    // Act
    const ctx = createSoftwareWebGLContext(canvas, null, '  webgl  ');
    // Assert
    expect(ctx).not.toBeNull();
  });

  it('returns null for webgl2 type (no WebGL2 factory on this entry)', () => {
    // Arrange
    const canvas = { width: 8, height: 8 };
    // Act
    const ctx = createSoftwareWebGLContext(canvas, null, 'webgl2');
    // Assert
    expect(ctx).toBeNull();
  });

  it('returns null for unknown type strings', () => {
    // Arrange
    const canvas = { width: 8, height: 8 };
    // Act
    const ctx = createSoftwareWebGLContext(canvas, null, 'bogus-type');
    // Assert
    expect(ctx).toBeNull();
  });

  it('accepts undefined canvas and null attrs without throwing', () => {
    // Arrange
    // Act
    const ctx = createSoftwareWebGLContext(undefined, null, null);
    // Assert
    expect(ctx).not.toBeNull();
  });

  it('reports MAX_VIEWPORT_DIMS as [4096, 4096]', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext({ width: 300, height: 150 })!;
    // Act
    const dims = ctx.getParameter(MAX_VIEWPORT_DIMS) as Int32Array;
    // Assert
    expect(Array.from(dims)).toEqual([4096, 4096]);
  });

  it('reports default VIEWPORT matching canvas size', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext({ width: 300, height: 150 })!;
    // Act
    const vp = ctx.getParameter(VIEWPORT) as Int32Array;
    // Assert
    expect(Array.from(vp)).toEqual([0, 0, 300, 150]);
  });

  it('renders a clear color through the entry-created context', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext({ width: 4, height: 4 })!;
    // Act
    ctx.clearColor(1, 0, 0, 1);
    ctx.clear(0x00004000);
    const pixels = new Uint8Array(4 * 4 * 4);
    ctx.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, pixels);
    // Assert
    expect(ctx.getError()).toBe(NO_ERROR);
    expect([pixels[0], pixels[1], pixels[2], pixels[3]]).toEqual([255, 0, 0, 255]);
  });
});
