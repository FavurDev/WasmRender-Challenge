// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial rasterizer suite
/** DrawingBuffer unit tests (Sprint 1 Task 7 green suite) — verifies allocation, clear, and readPixels against src/gl/framebuffer.ts. */
import { describe, expect, it } from 'vitest';
import { DrawingBuffer } from '../../src/gl/framebuffer';
import { ErrorSink } from '../../src/gl/errors';
import { GLState } from '../../src/gl/state';
import {
  COLOR_BUFFER_BIT,
  DEPTH_BUFFER_BIT,
  FLOAT,
  INVALID_ENUM,
  INVALID_VALUE,
  NO_ERROR,
  RGB,
  RGBA,
  STENCIL_BUFFER_BIT,
  UNSIGNED_BYTE,
} from '../../src/gl/constants';

describe('DrawingBuffer - allocation (Group 1)', () => {
  it('allocates RGBA8 color and DEPTH24_STENCIL8 buffers matching canvas dimensions', () => {
    // Arrange:
    const sink = new ErrorSink();
    // Act:
    const buf = new DrawingBuffer(sink, { width: 64, height: 64 });
    // Assert:
    expect(buf.getWidth()).toBe(64);
    expect(buf.getHeight()).toBe(64);
    expect(buf.getColorBuffer().byteLength).toBe(64 * 64 * 4);
    expect(buf.getDepthStencilBuffer().length).toBe(64 * 64);
    expect(buf.getDepthStencilBuffer()[0]).toBe((0x00ffffff << 8) >>> 0);
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('falls back to 300x150 default on missing or non-positive canvas dims', () => {
    // Arrange:
    const sink = new ErrorSink();
    // Act:
    const buf1 = new DrawingBuffer(sink);
    const buf2 = new DrawingBuffer(sink, { width: 0, height: -10 });
    const buf3 = new DrawingBuffer(sink, { width: NaN, height: 50 });
    // Assert:
    expect(buf1.getWidth()).toBe(300);
    expect(buf1.getHeight()).toBe(150);
    expect(buf2.getWidth()).toBe(300);
    expect(buf2.getHeight()).toBe(150);
    expect(buf3.getWidth()).toBe(300);
    expect(buf3.getHeight()).toBe(50);
    expect(sink.getError()).toBe(NO_ERROR);
  });
});

describe('DrawingBuffer - clear round-trip (Group 2, M1 test 5)', () => {
  it('clear fills all channels per mask and readPixels round-trips exactly', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 64, height: 64 });
    const buf = new DrawingBuffer(sink, { width: 64, height: 64 });
    glState.setClearColor(0.25, 0.5, 0.75, 1.0);
    glState.setClearDepth(0.5);
    glState.setClearStencil(42);
    const snapshot = glState.snapshot();
    // Act:
    buf.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT | STENCIL_BUFFER_BIT, snapshot);
    const dst = new Uint8Array(64 * 64 * 4);
    buf.readPixels(0, 0, 64, 64, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    for (let i = 0; i < 4096; i++) {
      expect(dst[i * 4 + 0]).toBe(64);
      expect(dst[i * 4 + 1]).toBe(128);
      expect(dst[i * 4 + 2]).toBe(191);
      expect(dst[i * 4 + 3]).toBe(255);
    }
    expect(sink.getError()).toBe(NO_ERROR);
  });
});

describe('DrawingBuffer - masked clear (Group 3)', () => {
  it('masked clear leaves masked color channels untouched', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 4, height: 4 });
    const buf = new DrawingBuffer(sink, { width: 4, height: 4 });
    glState.setClearColor(1.0, 1.0, 1.0, 1.0);
    buf.clear(COLOR_BUFFER_BIT, glState.snapshot());
    glState.setColorMask(true, false, false, true);
    glState.setClearColor(0.0, 0.0, 0.0, 0.0);
    const snapshot = glState.snapshot();
    // Act:
    buf.clear(COLOR_BUFFER_BIT, snapshot);
    const dst = new Uint8Array(4 * 4 * 4);
    buf.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    for (let i = 0; i < 16; i++) {
      expect(dst[i * 4 + 0]).toBe(0);
      expect(dst[i * 4 + 1]).toBe(255);
      expect(dst[i * 4 + 2]).toBe(255);
      expect(dst[i * 4 + 3]).toBe(0);
    }
  });

  it('masked clear honors depth mask and stencil writeMasks', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 2, height: 2 });
    const buf = new DrawingBuffer(sink, { width: 2, height: 2 });
    glState.setDepthMask(false);
    glState.setClearDepth(0.0);
    glState.setStencilMask(0x0f);
    glState.setClearStencil(0xff);
    const snapshot = glState.snapshot();
    // Act:
    buf.clear(DEPTH_BUFFER_BIT | STENCIL_BUFFER_BIT, snapshot);
    const ds = buf.getDepthStencilBuffer();
    // Assert:
    for (let i = 0; i < 4; i++) {
      expect((ds[i] as number) >>> 8).toBe(0x00ffffff);
      expect((ds[i] as number) & 0xff).toBe(0x0f);
    }
  });

  it('clear ignores unknown bitmask flags without throwing or recording errors', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 2, height: 2 });
    const buf = new DrawingBuffer(sink, { width: 2, height: 2 });
    glState.setClearColor(0.5, 0.5, 0.5, 1.0);
    const snapshot = glState.snapshot();
    // Act:
    buf.clear(COLOR_BUFFER_BIT | 0x8000, snapshot);
    // Assert:
    expect(sink.getError()).toBe(NO_ERROR);
    const dst = new Uint8Array(2 * 2 * 4);
    buf.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, dst);
    for (let i = 0; i < 4; i++) {
      expect(dst[i * 4 + 0]).toBe(128);
      expect(dst[i * 4 + 1]).toBe(128);
      expect(dst[i * 4 + 2]).toBe(128);
      expect(dst[i * 4 + 3]).toBe(255);
    }
  });
});

describe('DrawingBuffer - readPixels validation (Group 4)', () => {
  it('negative width or height records INVALID_VALUE and writes nothing', () => {
    // Arrange:
    const sink = new ErrorSink();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    const dst = new Uint8Array(100);
    dst.fill(42);
    // Act:
    buf.readPixels(0, 0, -1, 10, RGBA, UNSIGNED_BYTE, dst);
    const err1 = sink.getError();
    buf.readPixels(0, 0, 10, -5, RGBA, UNSIGNED_BYTE, dst);
    const err2 = sink.getError();
    // Assert:
    expect(err1).toBe(INVALID_VALUE);
    expect(err2).toBe(INVALID_VALUE);
    for (const v of dst) expect(v).toBe(42);
  });

  it('invalid format or type records INVALID_ENUM and writes nothing', () => {
    // Arrange:
    const sink = new ErrorSink();
    const buf = new DrawingBuffer(sink, { width: 4, height: 4 });
    const dst = new Uint8Array(64);
    dst.fill(99);
    // Act:
    buf.readPixels(0, 0, 4, 4, RGB, UNSIGNED_BYTE, dst);
    const err1 = sink.getError();
    buf.readPixels(0, 0, 4, 4, RGBA, FLOAT, dst);
    const err2 = sink.getError();
    // Assert:
    expect(err1).toBe(INVALID_ENUM);
    expect(err2).toBe(INVALID_ENUM);
    for (const v of dst) expect(v).toBe(99);
  });

  it('undersized destination records INVALID_VALUE and writes nothing', () => {
    // Arrange:
    const sink = new ErrorSink();
    const buf = new DrawingBuffer(sink, { width: 4, height: 4 });
    const small = new Uint8Array(63);
    small.fill(77);
    // Act:
    buf.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, small);
    // Assert:
    expect(sink.getError()).toBe(INVALID_VALUE);
    for (const v of small) expect(v).toBe(77);
  });
});

describe('DrawingBuffer - clipping (Group 5)', () => {
  it('partial-rect clipping reads only in-bounds pixels leaving outside bytes untouched', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 4, height: 4 });
    const buf = new DrawingBuffer(sink, { width: 4, height: 4 });
    glState.setClearColor(0.2, 0.4, 0.6, 0.8);
    buf.clear(COLOR_BUFFER_BIT, glState.snapshot());
    const dst = new Uint8Array(4 * 4 * 4);
    dst.fill(170);
    // Act:
    buf.readPixels(-2, -2, 4, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    expect(sink.getError()).toBe(NO_ERROR);
    const px = (row: number, col: number): number[] => [
      dst[(row * 4 + col) * 4] as number,
      dst[(row * 4 + col) * 4 + 1] as number,
      dst[(row * 4 + col) * 4 + 2] as number,
      dst[(row * 4 + col) * 4 + 3] as number,
    ];
    for (const r of [0, 1]) for (const c of [0, 1, 2, 3]) expect(px(r, c)).toEqual([170, 170, 170, 170]);
    for (const r of [2, 3]) {
      for (const c of [0, 1]) expect(px(r, c)).toEqual([170, 170, 170, 170]);
      for (const c of [2, 3]) expect(px(r, c)).toEqual([51, 102, 153, 204]);
    }
  });

  it('completely out-of-bounds readPixels leaves dst unchanged with no error', () => {
    // Arrange:
    const sink = new ErrorSink();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    const dst = new Uint8Array(16);
    dst.fill(88);
    // Act:
    buf.readPixels(20, 20, 2, 2, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    expect(sink.getError()).toBe(NO_ERROR);
    for (const v of dst) expect(v).toBe(88);
  });

  it('zero-width or zero-height readPixels is a no-op', () => {
    // Arrange:
    const sink = new ErrorSink();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    const dst = new Uint8Array(16);
    dst.fill(55);
    // Act:
    buf.readPixels(0, 0, 0, 5, RGBA, UNSIGNED_BYTE, dst);
    buf.readPixels(0, 0, 5, 0, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    expect(sink.getError()).toBe(NO_ERROR);
    for (const v of dst) expect(v).toBe(55);
  });
});

describe('DrawingBuffer - resize (Group 6)', () => {
  it('resize reallocates buffers and resets depth-stencil', () => {
    // Arrange:
    const sink = new ErrorSink();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    // Act:
    buf.resize(20, 30);
    // Assert:
    expect(buf.getWidth()).toBe(20);
    expect(buf.getHeight()).toBe(30);
    expect(buf.getColorBuffer().byteLength).toBe(20 * 30 * 4);
    expect(buf.getDepthStencilBuffer().length).toBe(20 * 30);
    expect((buf.getDepthStencilBuffer()[0] as number) >>> 8).toBe(0x00ffffff);
    expect(sink.getError()).toBe(NO_ERROR);
  });
});

import { interpolateDepth, perspectiveCorrect } from '../../src/raster/interpolate';

describe('Interpolator - perspectiveCorrect at triangle center (TEST 1, AC-1)', () => {
  it('matches analytic values at triangle center (11/7 within 1/255)', () => {
    // Arrange:
    const bary: [number, number, number] = [1 / 3, 1 / 3, 1 / 3];
    const invW: [number, number, number] = [1.0, 0.5, 0.25];
    const sources = [new Float32Array([1.0]), new Float32Array([2.0]), new Float32Array([3.0])];
    const out = new Float32Array(1);
    // Act:
    perspectiveCorrect(bary, invW, sources, out);
    // Assert:
    expect(Math.abs(out[0] as number - 11 / 7)).toBeLessThan(1 / 255);
    expect(out[0]).toBeCloseTo(11 / 7, 5);
  });
});

describe('Interpolator - vertex recovery (TEST 2-4, AC-4)', () => {
  it('at vertex 0 evaluates to vertex 0 varyings exactly', () => {
    // Arrange:
    const bary: [number, number, number] = [1.0, 0.0, 0.0];
    const invW: [number, number, number] = [0.8, 0.4, 0.2];
    const sources = [new Float32Array([1.5, 2.5]), new Float32Array([10.0, 20.0]), new Float32Array([100.0, 200.0])];
    const out = new Float32Array(2);
    // Act:
    perspectiveCorrect(bary, invW, sources, out);
    // Assert:
    expect(out[0]).toBe(Math.fround(1.5));
    expect(out[1]).toBe(Math.fround(2.5));
  });

  it('at vertex 1 evaluates to vertex 1 varyings exactly', () => {
    // Arrange:
    const bary: [number, number, number] = [0.0, 1.0, 0.0];
    const invW: [number, number, number] = [0.8, 0.4, 0.2];
    const sources = [new Float32Array([1.5, 2.5]), new Float32Array([10.0, 20.0]), new Float32Array([100.0, 200.0])];
    const out = new Float32Array(2);
    // Act:
    perspectiveCorrect(bary, invW, sources, out);
    // Assert:
    expect(out[0]).toBe(Math.fround(10.0));
    expect(out[1]).toBe(Math.fround(20.0));
  });

  it('at vertex 2 evaluates to vertex 2 varyings exactly', () => {
    // Arrange:
    const bary: [number, number, number] = [0.0, 0.0, 1.0];
    const invW: [number, number, number] = [0.8, 0.4, 0.2];
    const sources = [new Float32Array([1.5, 2.5]), new Float32Array([10.0, 20.0]), new Float32Array([100.0, 200.0])];
    const out = new Float32Array(2);
    // Act:
    perspectiveCorrect(bary, invW, sources, out);
    // Assert:
    expect(out[0]).toBe(Math.fround(100.0));
    expect(out[1]).toBe(Math.fround(200.0));
  });
});

describe('Interpolator - depth linearity (TEST 5-6, AC-2)', () => {
  it('computes linear window-space depth at interior point (0.55)', () => {
    // Arrange:
    const bary: [number, number, number] = [0.25, 0.5, 0.25];
    const z: [number, number, number] = [0.2, 0.6, 0.8];
    // Act:
    const depth = interpolateDepth(bary, z);
    // Assert:
    expect(depth).toBe(Math.fround(0.55));
  });

  it('at triangle vertices returns vertex depths', () => {
    // Arrange:
    const z: [number, number, number] = [0.125, 0.5, 0.875];
    // Act:
    const d0 = interpolateDepth([1.0, 0.0, 0.0], z);
    const d1 = interpolateDepth([0.0, 1.0, 0.0], z);
    const d2 = interpolateDepth([0.0, 0.0, 1.0], z);
    // Assert:
    expect(d0).toBe(Math.fround(0.125));
    expect(d1).toBe(Math.fround(0.5));
    expect(d2).toBe(Math.fround(0.875));
  });
});

describe('Interpolator - flat varyings (TEST 7-8, AC-3)', () => {
  it('flat varying bypasses interpolation and takes provoking vertex value', () => {
    // Arrange:
    const bary: [number, number, number] = [0.2, 0.5, 0.3];
    const invW: [number, number, number] = [1.0, 0.5, 0.25];
    const sources = [new Float32Array([10.0, 1.0]), new Float32Array([20.0, 2.0]), new Float32Array([30.0, 3.0])];
    const out = new Float32Array(2);
    // Act:
    perspectiveCorrect(bary, invW, sources, out, 1, 0);
    // Assert:
    expect(out[0]).toBe(Math.fround(10.0));
    expect(out[1]).not.toBe(Math.fround(1.0));
  });

  it('flat varying honors provokingIndex', () => {
    // Arrange:
    const bary: [number, number, number] = [0.2, 0.5, 0.3];
    const invW: [number, number, number] = [1.0, 0.5, 0.25];
    const sources = [new Float32Array([10.0, 1.0]), new Float32Array([20.0, 2.0]), new Float32Array([30.0, 3.0])];
    const out = new Float32Array(2);
    // Act:
    perspectiveCorrect(bary, invW, sources, out, 1, 2);
    // Assert:
    expect(out[0]).toBe(Math.fround(30.0));
  });
});

describe('Interpolator - multi-component vectors (TEST 9, AC-1/AC-5)', () => {
  it('applies perspective correction across 4-element vectors', () => {
    // Arrange:
    const bary: [number, number, number] = [1 / 3, 1 / 3, 1 / 3];
    const invW: [number, number, number] = [1.0, 0.5, 0.25];
    const sources = [
      new Float32Array([1.0, 2.0, 3.0, 4.0]),
      new Float32Array([2.0, 4.0, 6.0, 8.0]),
      new Float32Array([3.0, 6.0, 9.0, 12.0]),
    ];
    const out = new Float32Array(4);
    // Act:
    perspectiveCorrect(bary, invW, sources, out);
    // Assert:
    expect(Math.abs((out[0] as number) - ((11 / 7) * 1))).toBeLessThan(1 / 255);
    expect(Math.abs((out[1] as number) - ((11 / 7) * 2))).toBeLessThan(1 / 255);
    expect(Math.abs((out[2] as number) - ((11 / 7) * 3))).toBeLessThan(1 / 255);
    expect(Math.abs((out[3] as number) - ((11 / 7) * 4))).toBeLessThan(1 / 255);
  });
});

describe('Interpolator - degenerate zero-denominator (TEST 10, AC-5)', () => {
  it('handles zero denominator without throwing and writes zero', () => {
    // Arrange:
    const bary: [number, number, number] = [0.0, 0.0, 0.0];
    const invW: [number, number, number] = [0.0, 0.0, 0.0];
    const sources = [new Float32Array([5.0]), new Float32Array([5.0]), new Float32Array([5.0])];
    const out = new Float32Array(1);
    // Act:
    const act = (): void => perspectiveCorrect(bary, invW, sources, out);
    // Assert:
    expect(act).not.toThrow();
    act();
    expect(Number.isNaN(out[0] as number)).toBe(false);
    expect(out[0]).toBe(0.0);
  });
});

import type { ClipVertex } from '../../src/raster/clipper';
import { clipTriangle } from '../../src/raster/clipper';

function makeVertex(x: number, y: number, z: number, w: number, varyings: number[] = [0, 0]): ClipVertex {
  return {
    clip: [Math.fround(x), Math.fround(y), Math.fround(z), Math.fround(w)],
    pointSize: 1.0,
    varyings: new Float32Array(varyings.map((v) => Math.fround(v))),
  };
}

describe('Clipper - Sutherland-Hodgman frustum clip', () => {
  it('TEST 1: fully-inside passthrough returns original 3 vertices unchanged', () => {
    // Arrange:
    const v0 = makeVertex(-0.5, -0.5, 0.0, 1.0, [1.0, 2.0]);
    const v1 = makeVertex(0.5, -0.5, 0.0, 1.0, [3.0, 4.0]);
    const v2 = makeVertex(0.0, 0.5, 0.0, 1.0, [5.0, 6.0]);
    // Act:
    const result = clipTriangle(v0, v1, v2);
    // Assert:
    expect(result.length).toBe(3);
    expect(Array.from(result[0]!.clip)).toEqual([-0.5, -0.5, 0.0, 1.0]);
    expect(Array.from(result[1]!.clip)).toEqual([0.5, -0.5, 0.0, 1.0]);
    expect(Array.from(result[2]!.clip)).toEqual([0.0, 0.5, 0.0, 1.0]);
    expect(Array.from(result[0]!.varyings)).toEqual([1.0, 2.0]);
    expect(Array.from(result[1]!.varyings)).toEqual([3.0, 4.0]);
    expect(Array.from(result[2]!.varyings)).toEqual([5.0, 6.0]);
  });

  it('TEST 2: fully-outside triangle rejected with empty array', () => {
    // Arrange:
    const v0 = makeVertex(2.0, 0.0, 0.0, 1.0);
    const v1 = makeVertex(3.0, 0.0, 0.0, 1.0);
    const v2 = makeVertex(2.5, 1.0, 0.0, 1.0);
    // Act:
    const result = clipTriangle(v0, v1, v2);
    // Assert:
    expect(result.length).toBe(0);
    expect(Array.isArray(result)).toBe(true);
  });

  it('TEST 3: degenerate identical vertices returns empty array', () => {
    // Arrange:
    const vSame = makeVertex(0.1, 0.2, 0.3, 1.0, [1.0]);
    // Act:
    const res = clipTriangle(vSame, vSame, vSame);
    // Assert:
    expect(res.length).toBe(0);
  });

  it('TEST 4: degenerate collinear triangle returns empty array', () => {
    // Arrange:
    const v0Col = makeVertex(0.0, 0.0, 0.0, 1.0);
    const v1Col = makeVertex(0.2, 0.2, 0.0, 1.0);
    const v2Col = makeVertex(0.4, 0.4, 0.0, 1.0);
    // Act:
    const res = clipTriangle(v0Col, v1Col, v2Col);
    // Assert:
    expect(res.length).toBe(0);
  });

  it('TEST 5: plane-straddling edge interpolates position and varyings linearly', () => {
    // Arrange:
    const v0 = makeVertex(0.0, 0.0, 0.0, 1.0, [10.0, 20.0]);
    const v1 = makeVertex(2.0, 0.0, 0.0, 1.0, [30.0, 40.0]);
    const v2 = makeVertex(0.0, 1.0, 0.0, 1.0, [50.0, 60.0]);
    // Act:
    const result = clipTriangle(v0, v1, v2);
    // Assert:
    expect(result.length).toBe(4);
    expect(Array.from(result[0]!.clip)).toEqual([0.0, 0.0, 0.0, 1.0]);
    expect(Array.from(result[1]!.clip)).toEqual([1.0, 0.0, 0.0, 1.0]);
    expect(Array.from(result[1]!.varyings)).toEqual([20.0, 30.0]);
    expect(Array.from(result[2]!.clip)).toEqual([1.0, 0.5, 0.0, 1.0]);
    expect(Array.from(result[2]!.varyings)).toEqual([40.0, 50.0]);
    expect(Array.from(result[3]!.clip)).toEqual([0.0, 1.0, 0.0, 1.0]);
  });

  it('TEST 6: triangle crossing two planes yields fan within 3-9 vertices', () => {
    // Arrange:
    const v0 = makeVertex(0.0, 0.0, 0.0, 1.0);
    const v1 = makeVertex(2.0, 0.0, 0.0, 1.0);
    const v2 = makeVertex(0.0, 2.0, 0.0, 1.0);
    // Act:
    const result = clipTriangle(v0, v1, v2);
    // Assert:
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(9);
    for (const v of result) {
      const [x, y, z, w] = v.clip;
      expect(x!).toBeLessThanOrEqual(w!);
      expect(x!).toBeGreaterThanOrEqual(-(w as number));
      expect(y!).toBeLessThanOrEqual(w!);
      expect(y!).toBeGreaterThanOrEqual(-(w as number));
      expect(z!).toBeLessThanOrEqual(w!);
      expect(z!).toBeGreaterThanOrEqual(-(w as number));
    }
  });

  it('TEST 7: near-w guard rejects vertices behind w <= epsilon', () => {
    // Arrange:
    const v0 = makeVertex(0.0, 0.0, 0.0, 0.0);
    const v1 = makeVertex(0.1, 0.0, 0.0, -1.0);
    const v2 = makeVertex(0.0, 0.1, 0.0, 1e-7);
    // Act:
    const result = clipTriangle(v0, v1, v2);
    // Assert:
    expect(result.length).toBe(0);
  });

  it('TEST 8: bottom-plane crossing interpolates negative coordinate edge correctly', () => {
    // Arrange:
    const v0 = makeVertex(0.0, 0.0, 0.0, 1.0, [100.0]);
    const v1 = makeVertex(0.0, -2.0, 0.0, 1.0, [200.0]);
    const v2 = makeVertex(0.5, 0.0, 0.0, 1.0, [300.0]);
    // Act:
    const result = clipTriangle(v0, v1, v2);
    // Assert:
    expect(result.length).toBe(4);
    for (const v of result) {
      const [, y, , w] = v.clip;
      expect((y as number) + (w as number)).toBeGreaterThanOrEqual(0);
    }
    const found = result.some(
      (v) =>
        v.clip[1] === Math.fround(-1.0) &&
        v.clip[3] === Math.fround(1.0) &&
        v.varyings[0] === Math.fround(150.0),
    );
    expect(found).toBe(true);
  });
});
