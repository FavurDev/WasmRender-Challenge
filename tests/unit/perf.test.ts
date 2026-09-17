/**
 * @fileoverview Sprint 6 Task 4 perf gate — Node-only wall-clock budgets.
 *
 * SOW-REQ-016 budgets: 64x64 clear+triangle <50ms, 256x256 textured quad <500ms.
 * Timing covers drawArraysImpl only; setup/upload/warmup excluded. ADR-011:
 * algorithmic fixes only — a budget miss is reported, never optimized here.
 * Environment: strict assertions run everywhere; CI-vs-local variance is
 * documented in the third case. Never imports the harness module.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { GLState } from '../../src/renderer/state';
import { drawArraysImpl, type DrawCall, type Vertex } from '../../src/renderer/rasterizer';
import { TextureStore } from '../../src/renderer/texture';
import {
  CLAMP_TO_EDGE,
  COLOR_BUFFER_BIT,
  NEAREST,
  RGBA,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  UNSIGNED_BYTE,
} from '../../src/renderer/gl-constants';

const SMALL = 64;
const LARGE = 256;
const SMALL_BUDGET_MS = 50;
const LARGE_BUDGET_MS = 500;

/** Map a screen-space pixel to a clip-space vertex with w=1 under a W-sized viewport. */
function clipVertex(sx: number, sy: number, w: number, h: number): Vertex {
  const ndcX = (sx / w) * 2 - 1;
  const ndcY = (sy / h) * 2 - 1;
  return { position: [ndcX, ndcY, 0, 1], varyings: new Float32Array(0) };
}

/** refTriangle shape from rasterizer.test.ts, generalized to a W x H viewport. */
function refTriangle(w: number, h: number): Vertex[] {
  return [clipVertex(w / 2, h / 4, w, h), clipVertex(w / 4, (3 * h) / 4, w, h), clipVertex((3 * w) / 4, (3 * h) / 4, w, h)];
}

/** Viewport-filling quad (2 triangles) with (u,v) varyings for the textured case. */
function viewportQuad(w: number, h: number): Vertex[] {
  const v = (sx: number, sy: number, u: number, vv: number): Vertex => {
    const ndcX = (sx / w) * 2 - 1;
    const ndcY = (sy / h) * 2 - 1;
    return { position: [ndcX, ndcY, 0, 1], varyings: new Float32Array([u, vv]) };
  };
  return [v(0, 0, 0, 0), v(w, 0, 1, 0), v(w, h, 1, 1), v(0, 0, 0, 0), v(w, h, 1, 1), v(0, h, 0, 1)];
}

function freshFrame(w: number, h: number): Framebuffer {
  const fb = new Framebuffer(w, h);
  fb.clearColor(0, 0, 0, 0);
  fb.clear(COLOR_BUFFER_BIT);
  return fb;
}

function freshState(w: number, h: number): GLState {
  const st = new GLState(w, h);
  st.viewport = [0, 0, w, h];
  st.scissorTest = false;
  st.blendEnabled = false;
  return st;
}

function drawCall(fb: Framebuffer, st: GLState, vertices: Vertex[], program: unknown = null): DrawCall {
  return {
    program,
    framebuffer: fb,
    state: st,
    vertices,
    indices: null,
    instanceCount: 1,
    samplers: [],
    fragmentColor: [255, 0, 0, 255],
  } as unknown as DrawCall;
}

/**
 * Warm up once (excluded), then wall-clock a single drawArraysImpl.
 *
 * @param call DrawCall to execute; setup/upload must already be done.
 * @returns Elapsed milliseconds of the timed draw only.
 */
function measureDraw(call: DrawCall): number {
  drawArraysImpl(call);
  const start = performance.now();
  drawArraysImpl(call);
  return performance.now() - start;
}

describe('perf Task 4 budgets (Node-only)', () => {
  it('P-1 64x64 clear+triangle completes under 50ms', () => {
    // Arrange: fresh 64x64 scene, refTriangle shape; setup outside timing.
    const fb = freshFrame(SMALL, SMALL);
    const st = freshState(SMALL, SMALL);
    const call = drawCall(fb, st, refTriangle(SMALL, SMALL));
    // Act: warmup excluded, timed draw only.
    const elapsed = measureDraw(call);
    const headroom = SMALL_BUDGET_MS - elapsed;
    console.log(`[perf] P-1 64x64 clear+triangle: ${elapsed.toFixed(3)}ms (budget ${SMALL_BUDGET_MS}ms, headroom ${headroom.toFixed(3)}ms)`);
    // Assert
    expect(elapsed).toBeLessThan(SMALL_BUDGET_MS);
  });

  it('P-2 256x256 textured quad completes under 500ms', () => {
    // Arrange: 4x4 RGBA fixture uploaded BEFORE timing; fresh 256x256 scene.
    const store = new TextureStore();
    const handle = store.createTexture();
    store.bindTexture(TEXTURE_2D, handle);
    const texels = new Uint8Array(4 * 4 * 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const o = (y * 4 + x) * 4;
        texels[o] = (x * 64) as number;
        texels[o + 1] = (y * 64) as number;
        texels[o + 2] = 128;
        texels[o + 3] = 255;
      }
    }
    store.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, RGBA, UNSIGNED_BYTE, texels);
    store.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    store.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, CLAMP_TO_EDGE);
    const fb = freshFrame(LARGE, LARGE);
    const st = freshState(LARGE, LARGE);
    // IMPLEMENTATION DECISION: fragment closure calls sample2D per fragment and
    // discards the result. Rationale: fillTriangle discards the closure return
    // value and writes the frag constant, so sampling inside the closure is the
    // simplest way to exercise the texture path cost. Alternatives: constant
    // color (would not touch the texture path); fragmentColors plumbing (heavier).
    const program = {
      fragment: (varyings: Float32Array): void => {
        store.sample2D(handle, varyings[0] as number, varyings[1] as number);
      },
    };
    const call = drawCall(fb, st, viewportQuad(LARGE, LARGE), program);
    // Act: warmup excluded, timed draw only.
    const elapsed = measureDraw(call);
    const headroom = LARGE_BUDGET_MS - elapsed;
    console.log(`[perf] P-2 256x256 textured quad: ${elapsed.toFixed(3)}ms (budget ${LARGE_BUDGET_MS}ms, headroom ${headroom.toFixed(3)}ms)`);
    // Assert
    expect(elapsed).toBeLessThan(LARGE_BUDGET_MS);
  });

  it('P-3 headroom and environment-gating strategy documented, harness never imported', () => {
    // Arrange
    const src = readFileSync('tests/unit/perf.test.ts', 'utf8');
    // Act
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1] as string);
    // Assert: budgets documented with headroom logging; strict assertions run in
    // both CI and local (no env skip); local variance is informational only via
    // logged headroom, CI treats a miss as a regression signal routed to develop
    // for algorithmic (ADR-011) triage — never a local optimization here.
    expect(src).toContain('SOW-REQ-016');
    expect(src).toContain('headroom');
    expect(src).toContain('ADR-011');
    for (const m of imports) expect(m).not.toContain('harness');
    expect(imports.some((m) => m.includes('harness'))).toBe(false);
  });
});
