/** Sprint 5 Task 7 depth-test TDD RED-phase tests — per-fragment depth gating, depthMask, funcs, stencil preservation. */
import { describe, expect, it } from 'vitest';
import { DrawingBuffer } from '../../src/gl/framebuffer';
import { ErrorSink } from '../../src/gl/errors';
import { GLState } from '../../src/gl/state';
import { rasterizeTriangle } from '../../src/raster/rasterizer';
import type { ScreenVertex } from '../../src/raster/rasterizer';
import type { PipelineState } from '../../src/gl/state';
import {
  ALWAYS,
  DEPTH_TEST,
  EQUAL,
  GEQUAL,
  GREATER,
  LEQUAL,
  LESS,
  NEVER,
  NOTEQUAL,
} from '../../src/gl/constants';

const W = 8;
const H = 8;
const DEPTH_MAX_24 = 16777215;

function sv(x: number, y: number, z: number, color: [number, number, number, number]): ScreenVertex {
  return { x: Math.round(x * 16), y: Math.round(y * 16), z, invW: 1.0, varyings: new Float32Array(color) };
}

function tri(z: number, color: [number, number, number, number]): [ScreenVertex, ScreenVertex, ScreenVertex] {
  return [sv(1, 1, z, color), sv(6, 1, z, color), sv(1, 6, z, color)];
}

function setup(depthEnabled: boolean, func: number, mask: boolean): { state: PipelineState; fb: DrawingBuffer } {
  const sink = new ErrorSink();
  const glState = new GLState(sink, { width: W, height: H });
  glState.setViewport(0, 0, W, H);
  glState.setEnable(DEPTH_TEST, depthEnabled);
  glState.setDepthFunc(func);
  glState.setDepthMask(mask);
  const state = glState.snapshot();
  const fb = new DrawingBuffer(sink, { width: W, height: H });
  return { state, fb };
}

function pxColor(fb: DrawingBuffer, x: number, y: number): [number, number, number, number] {
  const c = fb.getColorBuffer();
  const o = (y * W + x) * 4;
  return [c[o] as number, c[o + 1] as number, c[o + 2] as number, c[o + 3] as number];
}

function depth24At(fb: DrawingBuffer, x: number, y: number): number {
  return Math.floor((fb.getDepthStencilBuffer()[y * W + x] as number) / 256);
}

function q(z: number): number {
  return Math.round(Math.min(1, Math.max(0, z)) * DEPTH_MAX_24) & DEPTH_MAX_24;
}

// Seed stored depth with the exact quantized value the rasterizer writes for
// a flat-z triangle (avoids 1-ulp float32 interpolation mismatch on EQUAL).
function seedMatchingDepth(fb: DrawingBuffer, z: number): void {
  const w = setup(false, LESS, true);
  rasterizeTriangle(...tri(z, [0, 0, 0, 0]), w.state, fb);
  fb.getColorBuffer().fill(0);
}

describe('Sprint 5 Task 7 RED: depth-test fix Test Cases 3-8', () => {
  it('TC3 disabled depth test overwrites farther fragment regardless of depth', () => {
    // Arrange:
    const { state, fb } = setup(false, LESS, true);
    // Act:
    rasterizeTriangle(...tri(0.2, [1, 0, 0, 1]), state, fb);
    rasterizeTriangle(...tri(0.8, [0, 1, 0, 1]), state, fb);
    // Assert:
    expect(pxColor(fb, 2, 2)).toEqual([0, 255, 0, 255]);
  });

  it('TC4 depthMask(false) suppresses depth write but color still gated by test', () => {
    // Arrange:
    const { state, fb } = setup(true, LESS, false);
    // Act:
    rasterizeTriangle(...tri(0.5, [0, 1, 0, 1]), state, fb);
    // Assert:
    expect(pxColor(fb, 2, 2)).toEqual([0, 255, 0, 255]);
    expect(depth24At(fb, 2, 2)).toBe(q(1.0));
  });

  it('TC5 NEVER rejects all fragments', () => {
    // Arrange:
    const { state, fb } = setup(true, NEVER, true);
    // Act:
    rasterizeTriangle(...tri(0.1, [1, 0, 0, 1]), state, fb);
    // Assert:
    expect(pxColor(fb, 2, 2)).toEqual([0, 0, 0, 0]);
    expect(depth24At(fb, 2, 2)).toBe(q(1.0));
  });

  it('TC6 ALWAYS accepts all fragments even when incoming is farther', () => {
    // Arrange:
    const { state, fb } = setup(true, ALWAYS, true);
    const ds = fb.getDepthStencilBuffer();
    ds.fill(((q(0.2) * 256) >>> 0) as number);
    // Act:
    rasterizeTriangle(...tri(0.8, [0, 0, 1, 1]), state, fb);
    // Assert:
    expect(pxColor(fb, 2, 2)).toEqual([0, 0, 255, 255]);
    expect(depth24At(fb, 2, 2)).toBe(q(0.8));
  });

  it('TC7 EQUAL accepts matching depth and rejects mismatched depth', () => {
    // Arrange:
    const mk = (): { state: PipelineState; fb: DrawingBuffer } => setup(true, EQUAL, true);
    const a = mk();
    seedMatchingDepth(a.fb, 0.5);
    const b = mk();
    b.fb.getDepthStencilBuffer().fill(((q(0.5) * 256) >>> 0) as number);
    // Act:
    rasterizeTriangle(...tri(0.5, [1, 0, 0, 1]), a.state, a.fb);
    rasterizeTriangle(...tri(0.6, [1, 0, 0, 1]), b.state, b.fb);
    // Assert:
    expect(pxColor(a.fb, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pxColor(b.fb, 2, 2)).toEqual([0, 0, 0, 0]);
  });

  it('TC7 NOTEQUAL rejects matching depth and accepts mismatched depth', () => {
    // Arrange:
    const mk = (): { state: PipelineState; fb: DrawingBuffer } => setup(true, NOTEQUAL, true);
    const a = mk();
    seedMatchingDepth(a.fb, 0.5);
    const b = mk();
    b.fb.getDepthStencilBuffer().fill(((q(0.5) * 256) >>> 0) as number);
    // Act:
    rasterizeTriangle(...tri(0.5, [1, 0, 0, 1]), a.state, a.fb);
    rasterizeTriangle(...tri(0.6, [1, 0, 0, 1]), b.state, b.fb);
    // Assert:
    expect(pxColor(a.fb, 2, 2)).toEqual([0, 0, 0, 0]);
    expect(pxColor(b.fb, 2, 2)).toEqual([255, 0, 0, 255]);
  });

  it('TC7 LEQUAL GEQUAL GREATER predicate gating', () => {
    // Arrange:
    const mk = (func: number): { state: PipelineState; fb: DrawingBuffer } => setup(true, func, true);
    const lePass = mk(LEQUAL);
    seedMatchingDepth(lePass.fb, 0.5);
    const leFail = mk(LEQUAL);
    leFail.fb.getDepthStencilBuffer().fill(((q(0.5) * 256) >>> 0) as number);
    const gePass = mk(GEQUAL);
    seedMatchingDepth(gePass.fb, 0.5);
    const geFail = mk(GEQUAL);
    geFail.fb.getDepthStencilBuffer().fill(((q(0.5) * 256) >>> 0) as number);
    const grPass = mk(GREATER);
    grPass.fb.getDepthStencilBuffer().fill(((q(0.5) * 256) >>> 0) as number);
    const grFail = mk(GREATER);
    seedMatchingDepth(grFail.fb, 0.5);
    // Act:
    rasterizeTriangle(...tri(0.5, [1, 0, 0, 1]), lePass.state, lePass.fb);
    rasterizeTriangle(...tri(0.6, [1, 0, 0, 1]), leFail.state, leFail.fb);
    rasterizeTriangle(...tri(0.5, [1, 0, 0, 1]), gePass.state, gePass.fb);
    rasterizeTriangle(...tri(0.4, [1, 0, 0, 1]), geFail.state, geFail.fb);
    rasterizeTriangle(...tri(0.6, [1, 0, 0, 1]), grPass.state, grPass.fb);
    rasterizeTriangle(...tri(0.5, [1, 0, 0, 1]), grFail.state, grFail.fb);
    // Assert:
    expect(pxColor(lePass.fb, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pxColor(leFail.fb, 2, 2)).toEqual([0, 0, 0, 0]);
    expect(pxColor(gePass.fb, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pxColor(geFail.fb, 2, 2)).toEqual([0, 0, 0, 0]);
    expect(pxColor(grPass.fb, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(pxColor(grFail.fb, 2, 2)).toEqual([0, 0, 0, 0]);
  });

  it('TC8 depth write preserves stencil low 8 bits', () => {
    // Arrange:
    const { state, fb } = setup(true, LESS, true);
    const ds = fb.getDepthStencilBuffer();
    ds.fill((((q(1.0) * 256) | 0x42) >>> 0) as number);
    // Act:
    rasterizeTriangle(...tri(0.2, [1, 0, 0, 1]), state, fb);
    // Assert:
    const word = fb.getDepthStencilBuffer()[2 * W + 2] as number;
    expect(word >>> 0).toBe((((q(0.2) * 256) | 0x42) >>> 0) as number);
  });

  it('TC9 depthMask(false) prevents depth write when DEPTH_TEST is disabled', () => {
    // Arrange:
    const { state, fb } = setup(false, LESS, false);
    const ds = fb.getDepthStencilBuffer();
    const clearWord = ((q(1.0) * 256) >>> 0) as number;
    ds.fill(clearWord);
    // Act:
    rasterizeTriangle(...tri(0.5, [1, 0, 0, 1]), state, fb);
    // Assert:
    expect(pxColor(fb, 2, 2)).toEqual([255, 0, 0, 255]);
    expect((ds[2 * W + 2] as number) >>> 0).toBe(clearWord >>> 0);
  });
});
describe('Sprint 6 Task 7: depth-write mask gating regression', () => {
  it('enabled depth test with mask true writes q(0.5) and green pixel', () => {
    // Arrange:
    const { state, fb } = setup(true, LESS, true);
    // Act:
    rasterizeTriangle(...tri(0.5, [0, 1, 0, 1]), state, fb);
    // Assert:
    expect(pxColor(fb, 2, 2)).toEqual([0, 255, 0, 255]);
    expect(Math.abs(depth24At(fb, 2, 2) - q(0.5))).toBeLessThanOrEqual(1);
  });

  it('disabled depth test with mask true writes q(0.3) and color', () => {
    // Arrange:
    const { state, fb } = setup(false, LESS, true);
    // Act:
    rasterizeTriangle(...tri(0.3, [0, 0, 1, 1]), state, fb);
    // Assert:
    expect(pxColor(fb, 2, 2)).toEqual([0, 0, 255, 255]);
    expect(Math.abs(depth24At(fb, 2, 2) - q(0.3))).toBeLessThanOrEqual(1);
  });
});
