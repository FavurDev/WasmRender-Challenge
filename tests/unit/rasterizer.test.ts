// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial rasterizer suite
/** DrawingBuffer TDD RED-phase tests (Sprint 1 Task 7). Expects src/gl/framebuffer.ts (absent). */
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
