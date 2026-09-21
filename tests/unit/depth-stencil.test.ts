/** Depth/stencil per-fragment pipeline TDD suite (Sprint 7 Task 2, red phase) — targets src/raster/depth-stencil.ts. */
import { describe, expect, it } from 'vitest';
import {
  ALWAYS,
  BACK,
  CCW,
  COLOR_BUFFER_BIT,
  DECR,
  DECR_WRAP,
  DEPTH_BUFFER_BIT,
  DEPTH_TEST,
  EQUAL,
  FRONT,
  FRONT_AND_BACK,
  GEQUAL,
  GREATER,
  INCR,
  INCR_WRAP,
  INVERT,
  KEEP,
  LEQUAL,
  LESS,
  NEVER,
  NOTEQUAL,
  REPLACE,
  RGBA,
  SCISSOR_TEST,
  STENCIL_TEST,
  UNSIGNED_BYTE,
  ZERO,
} from '../../src/gl/constants';
import { DrawingBuffer } from '../../src/gl/framebuffer';
import { ErrorSink } from '../../src/gl/errors';
import { GLState } from '../../src/gl/state';
import type { PipelineState } from '../../src/gl/state';
import { rasterizeTriangle } from '../../src/raster/rasterizer';
import type { ScreenVertex } from '../../src/raster/rasterizer';
import {
  computeStencilOp,
  evaluateStencilTest,
  executeFragmentDepthStencil,
  passesDepthTest,
  passesScissorTest,
} from '../../src/raster/depth-stencil';

const DEPTH_FUNCS = [NEVER, LESS, EQUAL, LEQUAL, GREATER, NOTEQUAL, GEQUAL, ALWAYS] as const;
const STENCIL_FUNCS = [NEVER, LESS, LEQUAL, GREATER, GEQUAL, EQUAL, NOTEQUAL, ALWAYS] as const;
const STENCIL_OPS = [KEEP, ZERO, REPLACE, INCR, INCR_WRAP, DECR, DECR_WRAP, INVERT] as const;

// Analytic expectation helpers (computed in-test per pseudocode branch tables).
function expectedDepth(func: number, incoming: number, stored: number): boolean {
  if (func === NEVER) return false;
  if (func === LESS) return incoming < stored;
  if (func === EQUAL) return incoming === stored;
  if (func === LEQUAL) return incoming <= stored;
  if (func === GREATER) return incoming > stored;
  if (func === NOTEQUAL) return incoming !== stored;
  if (func === GEQUAL) return incoming >= stored;
  if (func === ALWAYS) return true;
  return false;
}

function expectedStencil(func: number, ref: number, mask: number, stored: number): boolean {
  const r = (ref & mask) >>> 0;
  const s = (stored & mask) >>> 0;
  if (func === NEVER) return false;
  if (func === LESS) return r < s;
  if (func === LEQUAL) return r <= s;
  if (func === GREATER) return r > s;
  if (func === GEQUAL) return r >= s;
  if (func === EQUAL) return r === s;
  if (func === NOTEQUAL) return r !== s;
  if (func === ALWAYS) return true;
  return false;
}

function expectedOp(op: number, current: number, ref: number): number {
  const c = current & 0xff;
  const r = ref & 0xff;
  if (op === KEEP) return c;
  if (op === ZERO) return 0;
  if (op === REPLACE) return r;
  if (op === INCR) return c < 255 ? c + 1 : 255;
  if (op === INCR_WRAP) return (c + 1) & 0xff;
  if (op === DECR) return c > 0 ? c - 1 : 0;
  if (op === DECR_WRAP) return (c - 1) & 0xff;
  if (op === INVERT) return (~c) & 0xff;
  return c;
}

function baseSnapshot(): PipelineState {
  const sink = new ErrorSink();
  const gl = new GLState(sink, { width: 8, height: 8 });
  return gl.snapshot();
}

function sv(x: number, y: number, z = 0.5, color: [number, number, number, number] = [1, 0, 0, 1]): ScreenVertex {
  return { x: Math.round(x * 16), y: Math.round(y * 16), z, invW: 1.0, varyings: new Float32Array(color) };
}

describe('Spec-Matrix Suite (AC-1)', () => {
  it('depth matrix: enabled/disabled x depthMask on/off x 8 funcs matches analytic expectations', () => {
    // Arrange:
    const incoming = 100;
    const stored = 200;
    // Act & Assert:
    for (const enabled of [false, true]) {
      for (const mask of [false, true]) {
        for (const func of DEPTH_FUNCS) {
          const sink = new ErrorSink();
          const gl = new GLState(sink, { width: 4, height: 4 });
          gl.setEnable(DEPTH_TEST, enabled);
          gl.setDepthFunc(func);
          gl.setDepthMask(mask);
          const state = gl.snapshot();
          const ds = new Uint32Array([(stored * 256) | 0x00]);
          const passed = executeFragmentDepthStencil(0, 0, incoming, true, state, ds, 0);
          const analyticPass = !enabled || expectedDepth(func, incoming, stored);
          expect(passed).toBe(analyticPass);
          const afterDepth = ((ds[0] as number) >>> 8) & 0xffffff;
          if (!analyticPass) {
            expect(afterDepth).toBe(stored);
          } else if (mask) {
            expect(afterDepth).toBe(incoming);
          } else {
            expect(afterDepth).toBe(stored);
          }
          // Direct predicate cross-check:
          expect(passesDepthTest(func, incoming, stored)).toBe(expectedDepth(func, incoming, stored));
        }
      }
    }
  });

  it('stencil matrix: enabled/disabled x writeMask on/off x 8 funcs matches analytic expectations', () => {
    // Arrange:
    const ref = 10;
    const stored = 20;
    // Act & Assert:
    for (const enabled of [false, true]) {
      for (const writeOn of [false, true]) {
        for (const func of STENCIL_FUNCS) {
          const sink = new ErrorSink();
          const gl = new GLState(sink, { width: 4, height: 4 });
          gl.setEnable(STENCIL_TEST, enabled);
          gl.setStencilFunc(func, ref, 0xff);
          gl.setStencilOp(KEEP, KEEP, REPLACE);
          gl.setStencilMask(writeOn ? 0xff : 0x00);
          const state = gl.snapshot();
          const ds = new Uint32Array([(0xffffff * 256) | stored]);
          const passed = executeFragmentDepthStencil(0, 0, 0xffffff, true, state, ds, 0);
          const analyticStencil = !enabled || expectedStencil(func, ref, 0xff, stored);
          expect(passed).toBe(analyticStencil);
          expect(evaluateStencilTest(func, ref, 0xff, stored)).toBe(expectedStencil(func, ref, 0xff, stored));
          const afterStencil = (ds[0] as number) & 0xff;
          if (!enabled || !writeOn) {
            expect(afterStencil).toBe(stored);
          } else if (!analyticStencil) {
            expect(afterStencil).toBe(expectedOp(KEEP, stored, ref));
          } else {
            expect(afterStencil).toBe(expectedOp(REPLACE, stored, ref));
          }
        }
      }
    }
  });
});

describe('Stencil Operations Truth Table (M3 Unit Test 10, AC-3)', () => {
  it('all 8 ops produce analytic values across boundary stencil values', () => {
    // Arrange:
    const currents = [0, 1, 127, 254, 255];
    const ref = 42;
    // Act & Assert:
    for (const op of STENCIL_OPS) {
      for (const c of currents) {
        expect(computeStencilOp(op, c, ref)).toBe(expectedOp(op, c, ref));
      }
    }
  });

  it('front/back faces apply separately configured ops by winding', () => {
    // Arrange:
    const sink = new ErrorSink();
    const gl = new GLState(sink, { width: 4, height: 4 });
    gl.setEnable(STENCIL_TEST, true);
    gl.setStencilFuncSeparate(FRONT, ALWAYS, 7, 0xff);
    gl.setStencilOpSeparate(FRONT, KEEP, KEEP, REPLACE);
    gl.setStencilFuncSeparate(BACK, ALWAYS, 9, 0xff);
    gl.setStencilOpSeparate(BACK, KEEP, KEEP, ZERO);
    gl.setStencilMaskSeparate(FRONT_AND_BACK, 0xff);
    const state = gl.snapshot();
    const dsF = new Uint32Array([(0xffffff * 256) | 5]);
    const dsB = new Uint32Array([(0xffffff * 256) | 5]);
    // Act:
    const passF = executeFragmentDepthStencil(0, 0, 0xffffff, true, state, dsF, 0);
    const passB = executeFragmentDepthStencil(0, 0, 0xffffff, false, state, dsB, 0);
    // Assert:
    expect(passF).toBe(true);
    expect(passB).toBe(true);
    expect((dsF[0] as number) & 0xff).toBe(7);
    expect((dsB[0] as number) & 0xff).toBe(0);
    expect(state.stencilFront.func).toBe(ALWAYS);
    expect(state.stencilBack.func).toBe(ALWAYS);
    void BACK;
    void FRONT;
    void CCW;
  });
});

describe('Depth Ordering Integration (M3 Unit Test 8, AC-2)', () => {
  it('depthFunc LESS: near-then-far preserves near, far-then-near overwrites', () => {
    // Arrange:
    const mk = (w: number, h: number): { gl: GLState; buf: DrawingBuffer } => {
      const sink = new ErrorSink();
      const gl = new GLState(sink, { width: w, height: h });
      gl.setViewport(0, 0, w, h);
      gl.setEnable(DEPTH_TEST, true);
      gl.setDepthFunc(LESS);
      gl.setDepthMask(true);
      return { gl, buf: new DrawingBuffer(sink, { width: w, height: h }) };
    };
    const near = [sv(1, 1, 0.2, [1, 0, 0, 1]), sv(6, 1, 0.2, [1, 0, 0, 1]), sv(1, 6, 0.2, [1, 0, 0, 1])] as const;
    const far = [sv(1, 1, 0.8, [0, 0, 1, 1]), sv(6, 1, 0.8, [0, 0, 1, 1]), sv(1, 6, 0.8, [0, 0, 1, 1])] as const;
    const read = (buf: DrawingBuffer, w: number, h: number): Uint8Array => {
      const dst = new Uint8Array(w * h * 4);
      buf.readPixels(0, 0, w, h, RGBA, UNSIGNED_BYTE, dst);
      return dst;
    };
    // Act: near-then-far
    const a = mk(8, 8);
    rasterizeTriangle(near[0], near[1], near[2], a.gl.snapshot(), a.buf);
    rasterizeTriangle(far[0], far[1], far[2], a.gl.snapshot(), a.buf);
    const pxA = read(a.buf, 8, 8);
    // Act: far-then-near
    const b = mk(8, 8);
    rasterizeTriangle(far[0], far[1], far[2], b.gl.snapshot(), b.buf);
    rasterizeTriangle(near[0], near[1], near[2], b.gl.snapshot(), b.buf);
    const pxB = read(b.buf, 8, 8);
    // Assert:
    const o = (2 * 8 + 2) * 4;
    expect([pxA[o], pxA[o + 1], pxA[o + 2]]).toEqual([255, 0, 0]);
    expect([pxB[o], pxB[o + 1], pxB[o + 2]]).toEqual([255, 0, 0]);
    const dsA = a.buf.getDepthStencilBuffer();
    const nearDepth = Math.round(0.2 * 16777215) & 16777215;
    expect((((dsA[o / 4] as number) >>> 8) & 0xffffff)).toBe(nearDepth);
  });
});

describe('Scissor Box Rejection for Draw and Clear (M3 Unit Test 11, AC-4)', () => {
  it('passesScissorTest accepts inside pixels and rejects outside pixels', () => {
    // Arrange:
    const box = { x: 2, y: 2, width: 3, height: 3 };
    // Act & Assert:
    expect(passesScissorTest(2, 2, box)).toBe(true);
    expect(passesScissorTest(4, 4, box)).toBe(true);
    expect(passesScissorTest(1, 2, box)).toBe(false);
    expect(passesScissorTest(5, 4, box)).toBe(false);
    expect(passesScissorTest(2, 5, box)).toBe(false);
  });

  it('pixels outside scissor box untouched by draws', () => {
    // Arrange:
    const sink = new ErrorSink();
    const gl = new GLState(sink, { width: 8, height: 8 });
    gl.setViewport(0, 0, 8, 8);
    gl.setScissor(2, 2, 2, 2);
    gl.setEnable(SCISSOR_TEST, true);
    const state = gl.snapshot();
    const buf = new DrawingBuffer(sink, { width: 8, height: 8 });
    // Act:
    rasterizeTriangle(sv(0, 0), sv(7, 0), sv(0, 7), state, buf);
    const dst = new Uint8Array(8 * 8 * 4);
    buf.readPixels(0, 0, 8, 8, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    const at = (x: number, y: number): number[] => {
      const oo = (y * 8 + x) * 4;
      return [dst[oo] as number, dst[oo + 1] as number, dst[oo + 2] as number, dst[oo + 3] as number];
    };
    expect(at(0, 0)).toEqual([0, 0, 0, 0]);
    expect(at(7, 7)).toEqual([0, 0, 0, 0]);
  });

  it('pixels outside scissor box untouched by clear', () => {
    // Arrange:
    const sink = new ErrorSink();
    const gl = new GLState(sink, { width: 4, height: 4 });
    gl.setClearColor(1, 0, 0, 1);
    gl.setScissor(0, 0, 2, 2);
    gl.setEnable(SCISSOR_TEST, true);
    const buf = new DrawingBuffer(sink, { width: 4, height: 4 });
    // Act:
    buf.clear(DEPTH_BUFFER_BIT, gl.snapshot());
    buf.clear(COLOR_BUFFER_BIT, gl.snapshot());
    const dst = new Uint8Array(4 * 4 * 4);
    buf.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    const at = (x: number, y: number): number[] => {
      const oo = (y * 4 + x) * 4;
      return [dst[oo] as number, dst[oo + 1] as number, dst[oo + 2] as number, dst[oo + 3] as number];
    };
    expect(at(0, 0)).toEqual([255, 0, 0, 255]);
    expect(at(3, 3)).toEqual([0, 0, 0, 0]);
  });
});

describe('depthMask Gating Suite (AC-5)', () => {
  it('passing fragment with depthMask false leaves depth buffer unwritten', () => {
    // Arrange:
    const sink = new ErrorSink();
    const gl = new GLState(sink, { width: 4, height: 4 });
    gl.setEnable(DEPTH_TEST, true);
    gl.setDepthFunc(ALWAYS);
    gl.setDepthMask(false);
    const state = gl.snapshot();
    const stored = 12345;
    const ds = new Uint32Array([(stored * 256) | 0xab]);
    // Act:
    const passed = executeFragmentDepthStencil(1, 1, 99999, true, state, ds, 0);
    // Assert:
    expect(passed).toBe(true);
    expect((((ds[0] as number) >>> 8) & 0xffffff)).toBe(stored);
    expect(((ds[0] as number) & 0xff)).toBe(0xab);
    void baseSnapshot();
  });
});
