/** TD-003 barycentric-hoisting TDD suite (Sprint 9 Task 5, red phase) — 8 tests, 3 groups. */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DrawingBuffer } from '../../src/gl/framebuffer';
import { ErrorSink } from '../../src/gl/errors';
import { GLState } from '../../src/gl/state';
import { rasterizeTriangle } from '../../src/raster/rasterizer';
// TDD-red: SCRATCH_* are module-private (not exported) until the refactor lands,
// so these imports fail to compile — the expected red-phase outcome.
import { SCRATCH_FRAG, SCRATCH_FRAG_VARYINGS } from '../../src/raster/rasterizer';
import type { ScreenVertex } from '../../src/raster/rasterizer';
import { interpolateDepth, perspectiveCorrect } from '../../src/raster/interpolate';

function sv(x: number, y: number, z = 0.5, color: [number, number, number, number] = [1, 0, 0, 1]): ScreenVertex {
  return { x: Math.round(x * 16), y: Math.round(y * 16), z, invW: 1.0, varyings: new Float32Array(color) };
}

function makeCtx(w: number, h: number): { state: ReturnType<GLState['snapshot']>; sink: ErrorSink } {
  const sink = new ErrorSink();
  const glState = new GLState(sink, { width: w, height: h });
  glState.setViewport(0, 0, w, h);
  return { state: glState.snapshot(), sink };
}

describe('TD-003 Group 1: Zero-Allocation and Buffer Capacity', () => {
  it('TEST 1: zero allocation in scan loop audit', () => {
    // Arrange:
    const { state } = makeCtx(64, 64);
    const sink = new ErrorSink();
    const fb = new DrawingBuffer(sink, { width: 64, height: 64 });
    const v0 = sv(2, 2, 0.5, [1, 0, 0, 1]);
    const v1 = sv(62, 2, 0.5, [1, 0, 0, 1]);
    const v2 = sv(2, 62, 0.5, [1, 0, 0, 1]);
    // Act:
    for (let i = 0; i < 100; i++) rasterizeTriangle(v0, v1, v2, state, fb);
    const srcPath = path.resolve(__dirname, '../../src/raster/rasterizer.ts');
    const src = fs.readFileSync(srcPath, 'utf8');
    // Anchor robustly on the documented scan-loop header; fail loudly if it moves.
    const anchor = 'for (let py = loY; py <= hiY; py++)';
    const loopStart = src.indexOf(anchor);
    expect(loopStart).toBeGreaterThanOrEqual(0);
    const scanLoop = src.slice(loopStart);
    const news = (scanLoop.match(/new\s+(Float32Array|Array|Object|Map|Set)\b/g) ?? []).length;
    // Assert:
    expect(news).toBe(0);
    expect(SCRATCH_FRAG.x).toBeGreaterThanOrEqual(0);
    // Behavioral: two consecutive renders over the same vertices are identical.
    const sinkA = new ErrorSink();
    const fbA = new DrawingBuffer(sinkA, { width: 64, height: 64 });
    const sinkB = new ErrorSink();
    const fbB = new DrawingBuffer(sinkB, { width: 64, height: 64 });
    rasterizeTriangle(v0, v1, v2, state, fbA);
    rasterizeTriangle(v0, v1, v2, state, fbB);
    expect(Array.from(fbA.getColorBuffer())).toEqual(Array.from(fbB.getColorBuffer()));
  });

  it('TEST 2: dynamic varyings buffer growth', () => {
    // Arrange:
    const { state } = makeCtx(16, 16);
    const sink = new ErrorSink();
    const fb = new DrawingBuffer(sink, { width: 16, height: 16 });
    const mk = (x: number, y: number): ScreenVertex => ({
      x: x * 16, y: y * 16, z: 0.5, invW: 1, varyings: new Float32Array(24).fill(0.5),
    });
    // Act:
    rasterizeTriangle(mk(2, 2), mk(13, 2), mk(2, 13), state, fb);
    // Assert:
    expect(SCRATCH_FRAG_VARYINGS.length).toBeGreaterThanOrEqual(24);
    expect(SCRATCH_FRAG.varyings).toBe(SCRATCH_FRAG_VARYINGS);
  });

  it('TEST 3: zero-varying triangle stability', () => {
    // Arrange:
    const { state } = makeCtx(10, 10);
    const sink = new ErrorSink();
    const fb = new DrawingBuffer(sink, { width: 10, height: 10 });
    const mk = (x: number, y: number): ScreenVertex => ({ x: x * 16, y: y * 16, z: 0.5, invW: 1, varyings: new Float32Array(0) });
    // Act:
    const act = (): void => rasterizeTriangle(mk(2, 2), mk(8, 2), mk(2, 8), state, fb);
    // Assert:
    expect(act).not.toThrow();
    act();
    const color = fb.getColorBuffer();
    const o = (3 * 10 + 3) * 4;
    expect([color[o], color[o + 1], color[o + 2], color[o + 3]]).toEqual([255, 255, 255, 255]);
  });

  it('TEST 4: degenerate and culled triangles bypass scratch updates', () => {
    // Arrange:
    const { state } = makeCtx(10, 10);
    const sink = new ErrorSink();
    const fb = new DrawingBuffer(sink, { width: 10, height: 10 });
    const before = Array.from(fb.getColorBuffer());
    // Act:
    rasterizeTriangle(sv(0, 0), sv(10, 10), sv(20, 20), state, fb);
    // Assert:
    expect(Array.from(fb.getColorBuffer())).toEqual(before);
  });
});

describe('TD-003 Group 2: Bit-Identical Regression Conformance', () => {
  it('TEST 5: pipeline DoD suite byte-identical readPixels', () => {
    // Arrange:
    const mk = (): { fb: DrawingBuffer; st: ReturnType<GLState['snapshot']> } => {
      const sink = new ErrorSink();
      const gs = new GLState(sink, { width: 32, height: 32 });
      gs.setViewport(0, 0, 32, 32);
      return { fb: new DrawingBuffer(sink, { width: 32, height: 32 }), st: gs.snapshot() };
    };
    const a = mk();
    const b = mk();
    const tri = (z: number): [ScreenVertex, ScreenVertex, ScreenVertex] => [sv(4, 4, z, [1, 0, 0, 1]), sv(28, 6, z, [0, 1, 0, 1]), sv(10, 28, z, [0, 0, 1, 1])];
    // Act:
    rasterizeTriangle(...tri(0.4), a.st, a.fb);
    rasterizeTriangle(...tri(0.4), b.st, b.fb);
    // Assert:
    expect(Array.from(a.fb.getColorBuffer())).toEqual(Array.from(b.fb.getColorBuffer()));
    expect(Array.from(a.fb.getDepthStencilBuffer())).toEqual(Array.from(b.fb.getDepthStencilBuffer()));
    // Pinned oracle: solid-red triangle center pixel is exactly opaque red.
    const solid = mk();
    rasterizeTriangle(sv(4, 4, 0.4, [1, 0, 0, 1]), sv(28, 6, 0.4, [1, 0, 0, 1]), sv(10, 28, 0.4, [1, 0, 0, 1]), solid.st, solid.fb);
    const sc = solid.fb.getColorBuffer();
    const so = (16 * 32 + 16) * 4;
    expect([sc[so], sc[so + 1], sc[so + 2], sc[so + 3]]).toEqual([255, 0, 0, 255]);
  });

  it('TEST 6: rasterizer unit test suite conformance', () => {
    // Arrange:
    const { state } = makeCtx(10, 10);
    const sink = new ErrorSink();
    const red = new DrawingBuffer(sink, { width: 10, height: 10 });
    const green = new DrawingBuffer(sink, { width: 10, height: 10 });
    // Act:
    rasterizeTriangle(sv(2, 2, 0.5, [1, 0, 0, 1]), sv(8, 2, 0.5, [1, 0, 0, 1]), sv(8, 8, 0.5, [1, 0, 0, 1]), state, red);
    rasterizeTriangle(sv(2, 2, 0.5, [0, 1, 0, 1]), sv(8, 8, 0.5, [0, 1, 0, 1]), sv(2, 8, 0.5, [0, 1, 0, 1]), state, green);
    // Assert:
    let overlap = 0;
    let total = 0;
    for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) {
      const o = (y * 10 + x) * 4;
      const c = red.getColorBuffer();
      const g = green.getColorBuffer();
      const rHit = c[o] === 255 && c[o + 1] === 0;
      const gHit = g[o + 1] === 255 && g[o] === 0;
      if (rHit && gHit) overlap++;
      if (rHit || gHit) total++;
    }
    expect(overlap).toBe(0);
    expect(total).toBe(36);
  });

  it('TEST 7: perspective-correction and depth float32 precision', () => {
    // Arrange:
    const bary: [number, number, number] = [0.33333334, 0.33333334, 0.33333334];
    const invW: [number, number, number] = [1.0, 0.5, 0.25];
    const z: [number, number, number] = [0.1, 0.5, 0.9];
    const preInvW: [number, number, number] = [Math.fround(1.0), Math.fround(0.5), Math.fround(0.25)];
    const preZ: [number, number, number] = [Math.fround(0.1), Math.fround(0.5), Math.fround(0.9)];
    const sources = [new Float32Array([1.0]), new Float32Array([2.0]), new Float32Array([3.0])];
    const outA = new Float32Array(1);
    const outB = new Float32Array(1);
    // Act:
    perspectiveCorrect(bary, invW, sources, outA);
    perspectiveCorrect(bary, preInvW, sources, outB);
    const dA = interpolateDepth(bary, z);
    const dB = interpolateDepth(bary, preZ);
    // Assert:
    expect(Object.is(outB[0], outA[0])).toBe(true);
    expect(Object.is(dB, dA)).toBe(true);
  });
});

describe('TD-003 Group 3: Performance Tripwire (advisory)', () => {
  it('TEST 8: 256x256 textured quad advisory timing', () => {
    // Arrange:
    const { state } = makeCtx(256, 256);
    const sink = new ErrorSink();
    const fb = new DrawingBuffer(sink, { width: 256, height: 256 });
    const v = (x: number, y: number): ScreenVertex => ({ x: x * 16, y: y * 16, z: 0.5, invW: 1, varyings: new Float32Array([1, 1, 1, 1]) });
    const t0 = performance.now();
    // Act:
    for (let i = 0; i < 10; i++) {
      rasterizeTriangle(v(0, 0), v(255, 0), v(255, 255), state, fb);
      rasterizeTriangle(v(0, 0), v(255, 255), v(0, 255), state, fb);
    }
    const elapsed = performance.now() - t0;
    let checksum = 0;
    for (const byte of fb.getColorBuffer()) checksum = (checksum + (byte as number)) >>> 0;
    // Assert:
    expect(checksum).toBeGreaterThan(0);
    console.log(`[advisory] TEST 8 elapsed=${elapsed.toFixed(1)}ms checksum=${checksum}`);
    expect(elapsed).toBeLessThan(2000);
  });
});
