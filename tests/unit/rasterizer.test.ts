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

import { mapClipToScreen, rasterizeTriangle } from '../../src/raster/rasterizer';
import type { ScreenVertex } from '../../src/raster/rasterizer';
import { BACK, CCW, CULL_FACE, CW, FRONT, FRONT_AND_BACK, SCISSOR_TEST } from '../../src/gl/constants';

function sv(x: number, y: number, z = 0.5, color: [number, number, number, number] = [1, 0, 0, 1]): ScreenVertex {
  return { x: Math.round(x * 16), y: Math.round(y * 16), z, invW: 1.0, varyings: new Float32Array(color) };
}

function pxColor(buf: DrawingBuffer, w: number, x: number, y: number): [number, number, number, number] {
  const c = buf.getColorBuffer();
  const o = (y * w + x) * 4;
  return [c[o] as number, c[o + 1] as number, c[o + 2] as number, c[o + 3] as number];
}

describe('Rasterizer - shared-edge quad single coverage (Group 7, SOW-REQ-008)', () => {
  it('shared-edge quad coverage is exactly one per pixel', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setViewport(0, 0, 10, 10);
    const state = glState.snapshot();
    const red = new DrawingBuffer(sink, { width: 10, height: 10 });
    const green = new DrawingBuffer(sink, { width: 10, height: 10 });
    const t1a = sv(2, 2, 0.5, [1, 0, 0, 1]);
    const t1b = sv(8, 2, 0.5, [1, 0, 0, 1]);
    const t1c = sv(8, 8, 0.5, [1, 0, 0, 1]);
    const t2a = sv(2, 2, 0.5, [0, 1, 0, 1]);
    const t2b = sv(8, 8, 0.5, [0, 1, 0, 1]);
    const t2c = sv(2, 8, 0.5, [0, 1, 0, 1]);
    // Act:
    rasterizeTriangle(t1a, t1b, t1c, state, red);
    rasterizeTriangle(t2a, t2b, t2c, state, green);
    // Assert:
    let redCount = 0;
    let greenCount = 0;
    let overlap = 0;
    for (let y = 2; y < 8; y++) {
      for (let x = 2; x < 8; x++) {
        const r = pxColor(red, 10, x, y);
        const g = pxColor(green, 10, x, y);
        const rHit = r[0] === 255 && r[1] === 0;
        const gHit = g[1] === 255 && g[0] === 0;
        if (rHit) redCount++;
        if (gHit) greenCount++;
        if (rHit && gHit) overlap++;
        expect(rHit || gHit).toBe(true);
      }
    }
    expect(overlap).toBe(0);
    expect(redCount + greenCount).toBe(36);
  });
});

describe('Rasterizer - degenerate rejection (Group 8)', () => {
  it('zero-area collinear triangle emits no fragments', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    const state = glState.snapshot();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    const before = Array.from(buf.getColorBuffer());
    const beforeDS = Array.from(buf.getDepthStencilBuffer());
    // Act:
    rasterizeTriangle(sv(2, 2), sv(4, 4), sv(6, 6), state, buf);
    // Assert:
    expect(Array.from(buf.getColorBuffer())).toEqual(before);
    expect(Array.from(buf.getDepthStencilBuffer())).toEqual(beforeDS);
  });

  it('identical vertices triangle emits no fragments', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    const state = glState.snapshot();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    const before = Array.from(buf.getColorBuffer());
    // Act:
    rasterizeTriangle(sv(3, 3), sv(3, 3), sv(3, 3), state, buf);
    // Assert:
    expect(Array.from(buf.getColorBuffer())).toEqual(before);
  });
});

describe('Rasterizer - back-face culling (Group 9)', () => {
  it('cullFaceMode BACK with frontFace CCW rejects CW triangle', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setEnable(CULL_FACE, true);
    glState.setFrontFace(CCW);
    glState.setCullFace(BACK);
    const state = glState.snapshot();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    const before = Array.from(buf.getColorBuffer());
    // Act: CW triangle (2,2),(2,8),(8,2)
    rasterizeTriangle(sv(2, 2), sv(2, 8), sv(8, 2), state, buf);
    // Assert:
    expect(Array.from(buf.getColorBuffer())).toEqual(before);
  });

  it('disabling cullFace renders CW triangle', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    const state = glState.snapshot();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    // Act:
    rasterizeTriangle(sv(2, 2), sv(2, 8), sv(8, 2), state, buf);
    // Assert:
    const c = pxColor(buf, 10, 4, 4);
    expect(c).toEqual([255, 0, 0, 255]);
  });

  it('cullFaceMode FRONT with frontFace CCW rejects CCW triangle', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setEnable(CULL_FACE, true);
    glState.setFrontFace(CCW);
    glState.setCullFace(FRONT);
    const state = glState.snapshot();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    const before = Array.from(buf.getColorBuffer());
    // Act: CCW triangle (2,2),(8,2),(8,8)
    rasterizeTriangle(sv(2, 2), sv(8, 2), sv(8, 8), state, buf);
    // Assert:
    expect(Array.from(buf.getColorBuffer())).toEqual(before);
  });

  it('cullFaceMode FRONT_AND_BACK rejects both CW and CCW triangles', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setEnable(CULL_FACE, true);
    glState.setFrontFace(CCW);
    glState.setCullFace(FRONT_AND_BACK);
    const state = glState.snapshot();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    const before = Array.from(buf.getColorBuffer());
    // Act:
    rasterizeTriangle(sv(2, 2), sv(8, 2), sv(8, 8), state, buf);
    rasterizeTriangle(sv(2, 2), sv(2, 8), sv(8, 2), state, buf);
    // Assert:
    expect(Array.from(buf.getColorBuffer())).toEqual(before);
  });
});

describe('Rasterizer - viewport bounds clamping (Group 10)', () => {
  it('triangle crossing viewport boundary clamps traversal', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setViewport(0, 0, 10, 10);
    const state = glState.snapshot();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    // Act:
    const act = (): void => rasterizeTriangle(sv(-5, 2), sv(15, 2), sv(5, 12), state, buf);
    // Assert:
    expect(act).not.toThrow();
    act();
    let written = 0;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      const c = pxColor(buf, 10, x, y);
      if (c[0] !== 0 || c[1] !== 0 || c[2] !== 0) written++;
    }
    expect(written).toBeGreaterThan(0);
  });
});

describe('Rasterizer - scissor box clamping (Group 11)', () => {
  it('scissor box restricts rasterization to scissorBox intersection', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 20, height: 20 });
    glState.setViewport(0, 0, 20, 20);
    glState.setScissor(5, 5, 6, 6);
    glState.setEnable(SCISSOR_TEST, true);
    const state = glState.snapshot();
    const buf = new DrawingBuffer(sink, { width: 20, height: 20 });
    // Act:
    rasterizeTriangle(sv(2, 2), sv(18, 2), sv(2, 18), state, buf);
    // Assert:
    expect(pxColor(buf, 20, 3, 3)).toEqual([0, 0, 0, 0]);
    expect(pxColor(buf, 20, 15, 15)).toEqual([0, 0, 0, 0]);
    let inside = 0;
    for (let y = 5; y <= 10; y++) for (let x = 5; x <= 10; x++) {
      const c = pxColor(buf, 20, x, y);
      if (c[0] !== 0 || c[1] !== 0 || c[2] !== 0) inside++;
    }
    expect(inside).toBeGreaterThan(0);
  });
});

describe('Rasterizer - fragment depth writes (Group 12)', () => {
  it('interpolateDepth writes correct depth values into depthStencilBuffer', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    const state = glState.snapshot();
    const buf = new DrawingBuffer(sink, { width: 10, height: 10 });
    // Act:
    rasterizeTriangle(sv(2, 2, 0.2), sv(8, 2, 0.6), sv(2, 8, 0.8), state, buf);
    // Assert:
    const ds = buf.getDepthStencilBuffer();
    let touched = 0;
    for (let i = 0; i < ds.length; i++) {
      const depth = (ds[i] as number) >>> 8;
      if (depth !== 0x00ffffff) {
        touched++;
        expect(depth).toBeGreaterThanOrEqual(Math.round(0.2 * 16777215));
        expect(depth).toBeLessThanOrEqual(Math.round(0.8 * 16777215));
        expect((ds[i] as number) & 0xff).toBe(0);
      }
    }
    expect(touched).toBeGreaterThan(0);
  });
});

describe('Rasterizer - determinism regression (Group 13)', () => {
  it('identical triangle rasterized into two fresh buffers produces byte-identical output', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 32, height: 32 });
    const state = glState.snapshot();
    const b1 = new DrawingBuffer(sink, { width: 32, height: 32 });
    const b2 = new DrawingBuffer(sink, { width: 32, height: 32 });
    // Act:
    rasterizeTriangle(sv(4, 4, 0.3), sv(28, 6, 0.6), sv(10, 28, 0.9), state, b1);
    rasterizeTriangle(sv(4, 4, 0.3), sv(28, 6, 0.6), sv(10, 28, 0.9), state, b2);
    // Assert:
    expect(Array.from(b1.getColorBuffer())).toEqual(Array.from(b2.getColorBuffer()));
    expect(Array.from(b1.getDepthStencilBuffer())).toEqual(Array.from(b2.getDepthStencilBuffer()));
  });
});

describe('Rasterizer - mapClipToScreen (AC-1)', () => {
  it('mapClipToScreen converts clip coordinates to 1/16th subpixels and depth', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setViewport(0, 0, 10, 10);
    const state = glState.snapshot();
    // Act:
    const s = mapClipToScreen({ clip: [0, 0, 0, 1], pointSize: 1, varyings: new Float32Array([1, 0, 0, 1]) }, state);
    // Assert:
    expect(s.x).toBe(Math.round(5 * 16));
    expect(s.y).toBe(Math.round(5 * 16));
    expect(s.z).toBeCloseTo(0.5, 5);
    expect(s.invW).toBeCloseTo(1.0, 5);
  });
});

describe('Sprint 5 Task 1 - TD-002 depthRange mapping (TEST 1)', () => {
  it('maps ndcZ=0 through range [0.25,0.75] to z=0.5', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setDepthRange(0.25, 0.75);
    const state = glState.snapshot();
    const clipVertex = { clip: [0, 0, 0, 1] as [number, number, number, number], pointSize: 1, varyings: new Float32Array(4) };
    // Act:
    const result = mapClipToScreen(clipVertex, state);
    // Assert:
    const expectedZ01 = Math.fround(Math.fround(0.0 * 0.5) + 0.5);
    const expectedDiff = Math.fround(Math.fround(0.75) - Math.fround(0.25));
    const expectedScaled = Math.fround(expectedDiff * expectedZ01);
    const expectedZ = Math.fround(Math.fround(0.25) + expectedScaled);
    expect(result.z).toBeCloseTo(expectedZ, 6);
    expect(result.z).toBeCloseTo(0.5, 6);
  });
});

describe('Sprint 5 Task 1 - TD-002 non-symmetric mapping (TEST 2)', () => {
  it('maps ndcZ=1 through range [0.1,0.9] to z=0.9', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setDepthRange(0.1, 0.9);
    const state = glState.snapshot();
    const clipVertex = { clip: [0, 0, 1, 1] as [number, number, number, number], pointSize: 1, varyings: new Float32Array(4) };
    // Act:
    const result = mapClipToScreen(clipVertex, state);
    // Assert:
    expect(result.z).toBeCloseTo(0.9, 6);
  });
});

describe('Sprint 5 Task 1 - TD-002 default bit-identity (TEST 3)', () => {
  it('default range [0,1] is bit-identical to prior hardcoded formula', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    const state = glState.snapshot();
    const inputs = [-1.0, -0.75, -0.5, 0.0, 0.333, 0.5, 0.99, 1.0];
    // Act & Assert:
    for (const zVal of inputs) {
      const vertex = { clip: [0, 0, zVal, 1] as [number, number, number, number], pointSize: 1, varyings: new Float32Array(0) };
      const screenVertex = mapClipToScreen(vertex, state);
      const priorFormulaZ = Math.fround(Math.fround(Math.fround(zVal * 1.0) * 0.5) + 0.5);
      expect(Object.is(screenVertex.z, priorFormulaZ)).toBe(true);
    }
  });
});

describe('Sprint 5 Task 1 - TD-004 w-guard positive (TEST 4)', () => {
  it('treats w=1e-7 as zero with invW=0 and no NaN', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink, { width: 10, height: 10 }).snapshot();
    const clipVertex = { clip: [1.0, 2.0, 0.5, 1e-7] as [number, number, number, number], pointSize: 1, varyings: new Float32Array(4) };
    // Act:
    const result = mapClipToScreen(clipVertex, state);
    // Assert:
    expect(result.invW).toBe(0);
    expect(Number.isNaN(result.x)).toBe(false);
    expect(Number.isNaN(result.y)).toBe(false);
    expect(Number.isNaN(result.z)).toBe(false);
  });
});

describe('Sprint 5 Task 1 - TD-004 w-guard negative (TEST 5)', () => {
  it('treats w=-1e-7 as zero with invW=0 and no NaN', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink, { width: 10, height: 10 }).snapshot();
    const clipVertex = { clip: [1.0, 2.0, 0.5, -1e-7] as [number, number, number, number], pointSize: 1, varyings: new Float32Array(4) };
    // Act:
    const result = mapClipToScreen(clipVertex, state);
    // Assert:
    expect(result.invW).toBe(0);
    expect(Number.isNaN(result.x)).toBe(false);
    expect(Number.isNaN(result.y)).toBe(false);
  });
});

describe('Sprint 5 Task 1 - TD-004 valid small w (TEST 6)', () => {
  it('w=1e-5 above epsilon yields nonzero invW', () => {
    // Arrange:
    const sink = new ErrorSink();
    const state = new GLState(sink, { width: 10, height: 10 }).snapshot();
    const clipVertex = { clip: [0, 0, 0, 1e-5] as [number, number, number, number], pointSize: 1, varyings: new Float32Array(4) };
    // Act:
    const result = mapClipToScreen(clipVertex, state);
    // Assert:
    expect(result.invW).toBe(Math.fround(1 / 1e-5));
    expect(result.invW).not.toBe(0);
  });
});

describe('Sprint 5 Task 1 - TD-004 bary reuse (TEST 7)', () => {
  it('rasterizes covered triangle with correct color and depth', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 16, height: 16 });
    glState.setViewport(0, 0, 16, 16);
    const state = glState.snapshot();
    const fb = new DrawingBuffer(sink, { width: 16, height: 16 });
    const v0 = sv(2, 2, 0.5, [1, 0, 0, 1]);
    const v1 = sv(13, 2, 0.5, [1, 0, 0, 1]);
    const v2 = sv(2, 13, 0.5, [1, 0, 0, 1]);
    // Act:
    rasterizeTriangle(v0, v1, v2, state, fb);
    // Assert:
    expect(pxColor(fb, 16, 4, 4)).toEqual([255, 0, 0, 255]);
    const ds = fb.getDepthStencilBuffer();
    const depth = (ds[4 * 16 + 4] as number) >>> 8;
    expect(depth).not.toBe(0x00ffffff);
  });
});

describe('Sprint 5 Task 1 - TD-005 zero-varying white (TEST 8)', () => {
  it('0 varyings shades covered pixel white and writes depth', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setViewport(0, 0, 10, 10);
    const state = glState.snapshot();
    const fb = new DrawingBuffer(sink, { width: 10, height: 10 });
    const mk = (x: number, y: number): ScreenVertex => ({ x: x * 16, y: y * 16, z: 0.5, invW: 1, varyings: new Float32Array(0) });
    // Act:
    rasterizeTriangle(mk(2, 2), mk(8, 2), mk(2, 8), state, fb);
    // Assert:
    const color = fb.getColorBuffer();
    const offset = (3 * 10 + 3) * 4;
    expect(color[offset]).toBe(255);
    expect(color[offset + 1]).toBe(255);
    expect(color[offset + 2]).toBe(255);
    expect(color[offset + 3]).toBe(255);
    const ds = fb.getDepthStencilBuffer();
    expect((ds[3 * 10 + 3] as number) >>> 8).not.toBe(0x00ffffff);
  });
});

describe('Sprint 5 Task 1 - TD-005 two-varying white (TEST 9)', () => {
  it('2 varyings shades covered pixel white without bounds errors', () => {
    // Arrange:
    const sink = new ErrorSink();
    const glState = new GLState(sink, { width: 10, height: 10 });
    glState.setViewport(0, 0, 10, 10);
    const state = glState.snapshot();
    const fb = new DrawingBuffer(sink, { width: 10, height: 10 });
    const mk = (x: number, y: number): ScreenVertex => ({ x: x * 16, y: y * 16, z: 0.5, invW: 1, varyings: new Float32Array([0.2, 0.8]) });
    // Act:
    const act = (): void => rasterizeTriangle(mk(2, 2), mk(8, 2), mk(2, 8), state, fb);
    // Assert:
    expect(act).not.toThrow();
    act();
    expect(pxColor(fb, 10, 3, 3)).toEqual([255, 255, 255, 255]);
  });
});

describe('Sprint 5 Task 1 - TD-006 clipper preservation (TEST 10)', () => {
  it('near-plane straddle clips to in-frustum polygon', () => {
    // Arrange:
    const a = makeVertex(0.0, 0.0, 0.0, 1.0, [1.0]);
    const b = makeVertex(0.0, 0.0, -2.0, 1.0, [2.0]);
    const c = makeVertex(0.5, 0.0, 0.0, 1.0, [3.0]);
    // Act:
    const result = clipTriangle(a, b, c);
    // Assert:
    expect(result.length).toBeGreaterThanOrEqual(3);
    for (const v of result) {
      const z = v.clip[2] as number;
      const w = v.clip[3] as number;
      expect(z).toBeLessThanOrEqual(w);
      expect(z).toBeGreaterThanOrEqual(-w);
    }
  });
});
