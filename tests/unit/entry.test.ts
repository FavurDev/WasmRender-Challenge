/** Entry + minimal WebGL1 facade RED-phase tests (Sprint 2 Task 4) — expects src/entry.ts to exist. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import {
  COLOR_BUFFER_BIT,
  COLOR_CLEAR_VALUE,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINES,
  NO_ERROR,
  RGBA,
  SCISSOR_BOX,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERSION,
  VERSION_STRING_WEBGL1,
  VIEWPORT,
} from '../../src/gl/constants';

describe('Entry - version string and attribute round-trip (Test 1, AC-1)', () => {
  it("version string and attribute round-trip for 'webgl' and 'experimental-webgl'", () => {
    // Arrange:
    const canvasStub = { width: 64, height: 64 };
    const attrs = { alpha: true, depth: false, stencil: true, antialias: false };
    // Act:
    const gl1 = createSoftwareWebGLContext(canvasStub, attrs, 'webgl');
    const gl2 = createSoftwareWebGLContext(canvasStub, attrs, 'experimental-webgl');
    const version1 = gl1!.getParameter(VERSION);
    const version2 = gl2!.getParameter(VERSION);
    const resAttrs1 = gl1!.getContextAttributes();
    const resAttrs2 = gl2!.getContextAttributes();
    // Assert:
    expect(gl1).not.toBeNull();
    expect(gl2).not.toBeNull();
    expect(version1).toBe(VERSION_STRING_WEBGL1);
    expect(version2).toBe(VERSION_STRING_WEBGL1);
    expect(resAttrs1.depth).toBe(false);
    expect(resAttrs1.stencil).toBe(true);
    expect(resAttrs2.depth).toBe(false);
    expect(resAttrs2.stencil).toBe(true);
    expect(gl1!.getError()).toBe(NO_ERROR);
  });
});

describe('Entry - default sizing (Test 2, AC-2)', () => {
  it('300x150 default sizing for dimension-less canvas stubs', () => {
    // Arrange:
    const emptyStub = {};
    const zeroStub = { width: 0, height: -20 };
    const nanStub = { width: NaN, height: 100 };
    // Act:
    const ctx1 = createSoftwareWebGLContext(emptyStub);
    const ctx2 = createSoftwareWebGLContext(zeroStub);
    const ctx3 = createSoftwareWebGLContext(nanStub);
    const vp1 = Array.from(ctx1!.getParameter(VIEWPORT) as Int32Array);
    const vp2 = Array.from(ctx2!.getParameter(VIEWPORT) as Int32Array);
    const vp3 = Array.from(ctx3!.getParameter(VIEWPORT) as Int32Array);
    // Assert:
    expect(vp1).toEqual([0, 0, 300, 150]);
    expect(vp2).toEqual([0, 0, 300, 150]);
    expect(vp3).toEqual([0, 0, 300, 100]);
    expect(ctx1!.getError()).toBe(NO_ERROR);
  });
});

describe('Entry - null dispatch (Test 3, AC-3)', () => {
  it("null returns for 'webgl2', '2d', and unknown types with no error recorded", () => {
    // Arrange:
    const canvas = { width: 64, height: 64 };
    const types = ['webgl2', '2d', 'experimental-webgl2', 'bitmaprenderer', 'invalid_string', ''];
    // Act:
    const results = types.map((t) => createSoftwareWebGLContext(canvas, {}, t));
    // Assert:
    for (const res of results) expect(res).toBeNull();
  });
});

describe('Entry - drawArrays pipeline (Test 4, AC-4)', () => {
  it('drawArrays TRIANGLES writes expected pixels through composed pipeline', () => {
    // Arrange:
    const ctx = createSoftwareWebGLContext({ width: 4, height: 4 }, {}, 'webgl')!;
    ctx.clearColor(0.0, 0.0, 0.0, 1.0);
    ctx.clear(COLOR_BUFFER_BIT);
    const geometry = [
      { position: [-0.5, -0.5, 0.0, 1.0] as const, color: [1.0, 0.0, 0.0, 1.0] as const },
      { position: [0.5, -0.5, 0.0, 1.0] as const, color: [1.0, 0.0, 0.0, 1.0] as const },
      { position: [-0.5, 0.5, 0.0, 1.0] as const, color: [1.0, 0.0, 0.0, 1.0] as const },
    ];
    // Act:
    ctx.drawArrays(TRIANGLES, 0, 3, geometry);
    const dst = new Uint8Array(4 * 4 * 4);
    ctx.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    const px = (x: number, y: number): number[] => Array.from(dst.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
    expect(px(1, 1)).toEqual([255, 0, 0, 255]);
    expect(px(3, 3)).toEqual([0, 0, 0, 255]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });
});

describe('Entry - state mutations (Test 5, AC-5)', () => {
  it('viewport/scissor/clear state mutations observable through the facade', () => {
    // Arrange:
    const ctx = createSoftwareWebGLContext({ width: 32, height: 32 })!;
    // Act:
    ctx.viewport(2, 4, 16, 20);
    ctx.scissor(1, 2, 8, 10);
    ctx.clearColor(0.2, 0.4, 0.6, 0.8);
    const vp = Array.from(ctx.getParameter(VIEWPORT) as Int32Array);
    const sc = Array.from(ctx.getParameter(SCISSOR_BOX) as Int32Array);
    const cc = Array.from(ctx.getParameter(COLOR_CLEAR_VALUE) as Float32Array);
    ctx.clear(COLOR_BUFFER_BIT);
    const readback = new Uint8Array(4);
    ctx.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, readback);
    // Assert:
    expect(vp).toEqual([2, 4, 16, 20]);
    expect(sc).toEqual([1, 2, 8, 10]);
    expect(cc[0]).toBeCloseTo(0.2, 5);
    expect(cc[1]).toBeCloseTo(0.4, 5);
    expect(cc[2]).toBeCloseTo(0.6, 5);
    expect(cc[3]).toBeCloseTo(0.8, 5);
    expect(Array.from(readback)).toEqual([51, 102, 153, 204]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });
});

describe('Entry - error sinks (Test 6, AC-6)', () => {
  it('spec error paths sink without throwing exceptions', () => {
    // Arrange:
    const ctx = createSoftwareWebGLContext({ width: 16, height: 16 })!;
    // Act & Assert:
    expect(() => ctx.enable(0x9999)).not.toThrow();
    expect(ctx.getError()).toBe(INVALID_ENUM);
    expect(ctx.getParameter(0x9999)).toBeNull();
    expect(ctx.getError()).toBe(INVALID_ENUM);
    expect(() => ctx.clear(0x12345678)).not.toThrow();
    expect(ctx.getError()).toBe(INVALID_VALUE);
    expect(() => ctx.drawArrays(LINES, 0, 2)).not.toThrow();
    expect(ctx.getError()).toBe(INVALID_ENUM);
    expect(() => ctx.drawArrays(TRIANGLES, -1, 3)).not.toThrow();
    expect(ctx.getError()).toBe(INVALID_VALUE);
    expect(() => ctx.drawArrays(TRIANGLES, 0, 2)).not.toThrow();
    expect(ctx.getError()).toBe(INVALID_OPERATION);
    expect(() => ctx.readPixels(0, 0, -1, 4, RGBA, UNSIGNED_BYTE, new Uint8Array(16))).not.toThrow();
    expect(ctx.getError()).toBe(INVALID_VALUE);
    expect(ctx.getError()).toBe(NO_ERROR);
  });
});

describe('Entry - window assignment (Test 7, AC-7)', () => {
  it('entry imports only facade and assigns window.__createSoftwareWebGLContext', () => {
    // Arrange:
    const globalScope = typeof window !== 'undefined' ? (window as any) : (globalThis as any);
    // Act:
    const fn = globalScope.__createSoftwareWebGLContext;
    const ctx = globalScope.__createSoftwareWebGLContext({ width: 10, height: 10 });
    // Assert:
    expect(typeof fn).toBe('function');
    expect(ctx.getParameter(VERSION)).toBe(VERSION_STRING_WEBGL1);
  });
});

describe('Entry - no-op draws (Test 8)', () => {
  it('drawArrays zero-count and clipped-out degenerate no-op', () => {
    // Arrange:
    const ctx = createSoftwareWebGLContext({ width: 8, height: 8 })!;
    ctx.clearColor(0.1, 0.2, 0.3, 1.0);
    ctx.clear(COLOR_BUFFER_BIT);
    const v = { position: [10.0, 10.0, 0.0, 1.0] as const };
    // Act:
    ctx.drawArrays(TRIANGLES, 0, 0);
    const err1 = ctx.getError();
    ctx.drawArrays(TRIANGLES, 0, 3, [v, v, v]);
    const err2 = ctx.getError();
    const pixels = new Uint8Array(8 * 8 * 4);
    ctx.readPixels(0, 0, 8, 8, RGBA, UNSIGNED_BYTE, pixels);
    // Assert:
    expect(err1).toBe(NO_ERROR);
    expect(err2).toBe(NO_ERROR);
    for (let i = 0; i < 64; i++) {
      expect(Array.from(pixels.slice(i * 4, i * 4 + 4))).toEqual([26, 51, 77, 255]);
    }
  });
});
