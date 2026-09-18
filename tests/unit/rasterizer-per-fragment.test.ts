/**
 * @fileoverview Phase 2 Sprint 1 Task 2 red-phase tests — per-fragment path absent.
 * Headless, deterministic, Arrange-Act-Assert. No production edits.
 */
import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { GLState } from '../../src/renderer/state';
import { COLOR_BUFFER_BIT } from '../../src/renderer/gl-constants';
import { drawArraysImpl, drawElementsImpl, type DrawCall, type Vertex } from '../../src/renderer/rasterizer';

const W = 64;
const H = 64;

function clipVertex(sx: number, sy: number, w: number, varyings: number[]): Vertex {
  const ndcX = ((sx / W) * 2 - 1) * w;
  const ndcY = ((sy / H) * 2 - 1) * w;
  return { position: [ndcX, ndcY, 0, w], varyings: new Float32Array(varyings) };
}

function makeFrame(): Framebuffer {
  const fb = new Framebuffer(W, H);
  fb.clearColor(0, 0, 0, 0);
  fb.clear(COLOR_BUFFER_BIT);
  return fb;
}

function makeState(): GLState {
  const st = new GLState(W, H);
  st.viewport = [0, 0, W, H];
  st.scissorTest = false;
  st.stencilTest = false;
  st.depthTest = false;
  st.blendEnabled = false;
  return st;
}

function px(fb: Framebuffer, x: number, y: number): number[] {
  return Array.from(fb.readPixels(x, y, 1, 1));
}

describe('rasterizer per-fragment red phase (Task 2)', () => {
  it('gradient centroid differs from corners and matches analytic perspective-correct within 0.01', () => {
    // Arrange: distinct varyings, T1-shape closure copying varyings to color
    const fb = makeFrame();
    const st = makeState();
    const vertices: Vertex[] = [
      clipVertex(32, 16, 1, [0]),
      clipVertex(16, 48, 2, [1]),
      clipVertex(48, 48, 4, [2]),
    ];
    const uniforms = {};
    const samplers: unknown[] = [];
    const colorOut = [0, 0, 0, 0];
    const program = {
      // T1 FragmentClosure shape: legacy seam (fragment:(varyings)=>void) must ignore this
      fragmentClosure: (varyingsIn: Readonly<number[]>, _u: unknown, _s: unknown, out: number[]): void => {
        const v = varyingsIn[0] as number;
        out[0] = v * 127;
        out[1] = 0;
        out[2] = 255 - v * 63;
        out[3] = 255;
      },
    };
    const call = {
      program, framebuffer: fb, state: st, vertices, indices: null,
      instanceCount: 1, samplers, fragmentColor: [9, 9, 9, 255],
      uniforms, colorOut,
    } as unknown as DrawCall;
    // Act
    drawArraysImpl(call);
    // Assert: centroid (32,40) must differ from corner-ish samples and match analytic
    // Barycentric weights at pixel center (32.5,40.5) for screen verts
    // (32,16),(16,48),(48,48), area=1024: l0=240/1024, l1=376/1024, l2=408/1024.
    const l0 = 240 / 1024;
    const l1 = 376 / 1024;
    const l2 = 408 / 1024;
    const invW = l0 * (1 / 1) + l1 * (1 / 2) + l2 * (1 / 4);
    const num = l0 * (0 / 1) + l1 * (1 / 2) + l2 * (2 / 4);
    const expected = num / invW; // 196/265 ~ 0.7396
    const expectedR = expected * 127;
    const c = px(fb, 32, 40);
    // centroid differs from corners (legacy writes flat [9,9,9] everywhere -> fails here)
    expect(px(fb, 4, 4)).not.toEqual(c);
    expect(Math.abs((c[0] as number) - expectedR)).toBeLessThanOrEqual(0.01 * 255 + 1);
    // corners of triangle differ from each other (per-pixel gradient, not constant)
    expect(px(fb, 32, 20)[0]).not.toBe(px(fb, 40, 44)[0]);
  });

  it('textured quad quadrants match texels via sampler bindings', () => {
    // Arrange: 2x2 texels, quad with UV varyings, ordered sampler bindings
    const fb = makeFrame();
    const st = makeState();
    const texels: Array<[number, number, number, number]> = [
      [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 0, 255],
    ];
    const sampler = {
      sample: (u: number, v: number, out: number[]): void => {
        const ix = u < 0.5 ? 0 : 1;
        const iy = v < 0.5 ? 0 : 1;
        const t = texels[iy * 2 + ix] as [number, number, number, number];
        out[0] = t[0]; out[1] = t[1]; out[2] = t[2]; out[3] = t[3];
      },
    };
    const program = {
      fragmentClosure: (varyingsIn: Readonly<number[]>, _u: unknown, s: unknown, out: number[]): void => {
        const arr = s as Array<{ sample: (u: number, v: number, o: number[]) => void }>;
        arr[0]?.sample(varyingsIn[0] as number, varyingsIn[1] as number, out);
      },
    };
    // Full-canvas quad in two triangles with UV varyings
    const q = (sx: number, sy: number, u: number, v: number): Vertex => clipVertex(sx, sy, 1, [u, v]);
    const vertices: Vertex[] = [
      q(0, 0, 0, 0), q(64, 0, 1, 0), q(64, 64, 1, 1),
      q(0, 0, 0, 0), q(64, 64, 1, 1), q(0, 64, 0, 1),
    ];
    const call = {
      program, framebuffer: fb, state: st, vertices, indices: [0, 1, 2, 3, 4, 5],
      instanceCount: 1, samplers: [sampler], fragmentColor: [9, 9, 9, 255],
    } as unknown as DrawCall;
    // Act
    drawElementsImpl(call);
    // Assert: each quadrant reads back its texel (legacy constant color fails here)
    expect(px(fb, 16, 16)).toEqual([255, 0, 0, 255]);
    expect(px(fb, 48, 16)).toEqual([0, 255, 0, 255]);
    expect(px(fb, 16, 48)).toEqual([0, 0, 255, 255]);
    expect(px(fb, 48, 48)).toEqual([255, 255, 0, 255]);
  });
});
