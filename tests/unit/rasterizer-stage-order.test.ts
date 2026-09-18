/**
 * @fileoverview Phase 2 Sprint 2 Task 6 red-phase tests — fillTriangle stage ordering.
 * Headless, deterministic, Arrange-Act-Assert. Tests only; no production edits.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { GLState } from '../../src/renderer/state';
import { ALWAYS, KEEP, LESS, NEVER, REPLACE } from '../../src/renderer/gl-constants';
import { drawArraysImpl, type DrawCall, type Vertex } from '../../src/renderer/rasterizer';

const SW = 8;
const SH = 8;
const RED: [number, number, number, number] = [255, 0, 0, 255];

function frame(depth: number): Framebuffer {
  const fb = new Framebuffer(SW, SH);
  fb.depth.fill(depth);
  return fb;
}

function state(): GLState {
  const st = new GLState(SW, SH);
  st.viewport = [0, 0, SW, SH];
  st.scissorTest = false;
  st.blendEnabled = false;
  st.colorMask = [true, true, true, true];
  st.depthMask = true;
  return st;
}

function dv(sx: number, sy: number, d: number): Vertex {
  const ndcX = (sx / SW) * 2 - 1;
  const ndcY = (sy / SH) * 2 - 1;
  return { position: [ndcX, ndcY, 2 * d - 1, 1], varyings: new Float32Array(0) };
}

function tri(d: number): Vertex[] {
  return [dv(-8, -8, d), dv(24, -8, d), dv(-8, 24, d)];
}

function call(fb: Framebuffer, st: GLState, verts: Vertex[]): DrawCall {
  return {
    program: null, framebuffer: fb, state: st, vertices: verts,
    indices: null, instanceCount: 1, samplers: [],
    fragmentColor: [RED[0], RED[1], RED[2], RED[3]],
  } as unknown as DrawCall;
}

function pixel(fb: Framebuffer, x: number, y: number): number[] {
  return Array.from(fb.readPixels(x, y, 1, 1));
}

describe('rasterizer stage ordering (Task 6 red phase)', () => {
  it('stencil-fail leaves depth unchanged with fail op applied', () => {
    // Arrange
    const fb = frame(0.9);
    fb.stencil.fill(7);
    const st = state();
    st.stencilTest = true;
    st.stencilFunc = NEVER;
    st.stencilRef = 0;
    st.stencilValueMask = 0xff;
    st.stencilFail = REPLACE;
    st.stencilPassDepthFail = KEEP;
    st.stencilPassDepthPass = KEEP;
    st.depthTest = true;
    st.depthFunc = LESS;
    st.depthMask = true;
    // Act
    drawArraysImpl(call(fb, st, tri(0.2)));
    // Assert
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.9, 6);
    expect(pixel(fb, 4, 4)).toEqual([0, 0, 0, 0]);
    expect(fb.stencil[4 * SW + 4] as number).toBe(0);
  });

  it('both-pass commits color depth stencil', () => {
    // Arrange
    const fb = frame(1.0);
    fb.stencil.fill(0);
    const st = state();
    st.stencilTest = true;
    st.stencilFunc = ALWAYS;
    st.stencilRef = 5;
    st.stencilValueMask = 0xff;
    st.stencilFail = KEEP;
    st.stencilPassDepthFail = KEEP;
    st.stencilPassDepthPass = REPLACE;
    st.depthTest = true;
    st.depthFunc = LESS;
    st.depthMask = true;
    // Act
    drawArraysImpl(call(fb, st, tri(0.2)));
    // Assert
    expect(pixel(fb, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(fb.depth[2 * SW + 2] as number).toBeCloseTo(0.2, 5);
    expect(fb.stencil[2 * SW + 2] as number).toBe(5);
  });

  it('stencil-pass depth-fail selects zfail op without color or depth commit', () => {
    // Arrange
    const fb = frame(0.1);
    fb.stencil.fill(0);
    const st = state();
    st.stencilTest = true;
    st.stencilFunc = ALWAYS;
    st.stencilRef = 9;
    st.stencilValueMask = 0xff;
    st.stencilFail = KEEP;
    st.stencilPassDepthFail = REPLACE;
    st.stencilPassDepthPass = KEEP;
    st.depthTest = true;
    st.depthFunc = LESS;
    st.depthMask = true;
    // Act
    drawArraysImpl(call(fb, st, tri(0.8)));
    // Assert
    expect(fb.stencil[3 * SW + 3] as number).toBe(9);
    expect(pixel(fb, 3, 3)).toEqual([0, 0, 0, 0]);
    expect(fb.depth[3 * SW + 3] as number).toBeCloseTo(0.1, 6);
  });

  it('disabled stencil path byte-identical across double run', () => {
    // Arrange
    const mk = (): { fb: Framebuffer; st: GLState } => {
      const fb = frame(1.0);
      fb.stencil.fill(3);
      const st = state();
      st.stencilTest = false;
      st.depthTest = true;
      st.depthFunc = LESS;
      return { fb, st };
    };
    const a = mk();
    const b = mk();
    // Act
    drawArraysImpl(call(a.fb, a.st, tri(0.4)));
    drawArraysImpl(call(a.fb, a.st, tri(0.4)));
    drawArraysImpl(call(b.fb, b.st, tri(0.4)));
    // Assert
    expect(Array.from(a.fb.color)).toEqual(Array.from(b.fb.color));
    expect(Array.from(a.fb.depth)).toEqual(Array.from(b.fb.depth));
    expect(Array.from(a.fb.stencil)).toEqual(Array.from(b.fb.stencil));
  });

  it('zero per-fragment allocation with double-run identity', () => {
    // Arrange
    const fb = frame(1.0);
    const st = state();
    st.stencilTest = false;
    st.depthTest = false;
    const fragScratch: Array<[number, number, number, number]> = [[0, 0, 0, 0]];
    const mkCall = (): DrawCall => {
      const c = call(fb, st, tri(0.5)) as unknown as Record<string, unknown>;
      c['fragScratch'] = fragScratch;
      return c as unknown as DrawCall;
    };
    // Static evidence: fillTriangle per-fragment loop body must not allocate.
    const src = readFileSync(new URL('../../src/renderer/rasterizer.ts', import.meta.url), 'utf8');
    const loopBody = src.slice(src.indexOf('for (let py = iy0'), src.indexOf('export function drawArraysImpl'));
    // Act: warm up once (per-draw setup allocates), then count Array constructions on second draw.
    drawArraysImpl(mkCall());
    const afterOnce = fb.color.slice();
    const OrigArray = globalThis.Array;
    let arrayConstructions = 0;
    function CountingArray(...args: unknown[]): unknown {
      arrayConstructions += 1;
      return new OrigArray(...(args as []));
    }
    (CountingArray as unknown as Record<string, unknown>)['prototype'] = OrigArray.prototype;
    globalThis.Array = CountingArray as unknown as ArrayConstructor;
    let threw: unknown = null;
    try {
      drawArraysImpl(mkCall());
    } catch (e) {
      threw = e;
    } finally {
      globalThis.Array = OrigArray;
    }
    if (threw !== null) throw threw;
    // Assert
    expect(loopBody).not.toMatch(/new\s+(Array|Object|Float32Array|Uint8Array|Uint16Array|Map|Set)\b/);
    expect(arrayConstructions).toBe(0);
    expect(Array.from(fb.color)).toEqual(Array.from(afterOnce));
  });
});
