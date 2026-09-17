/**
 * @fileoverview Sprint 6 Task 3 stencil suite — S-1..S-4 analytic gating + order cases.
 *
 * Headless Node, fresh Framebuffer+GLState per case, Arrange-Act-Assert.
 */
import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { GLState } from '../../src/renderer/state';
import { LESS } from '../../src/renderer/gl-constants';
import { drawArraysImpl, type DrawCall, type Vertex } from '../../src/renderer/rasterizer';

const SW = 8;
const SH = 8;
const RED: [number, number, number, number] = [255, 0, 0, 255];
const BLUE: [number, number, number, number] = [0, 0, 255, 255];

function stencilFrame(storedDepth: number): Framebuffer {
  const fb = new Framebuffer(SW, SH);
  fb.depth.fill(storedDepth);
  return fb;
}

function stencilState(): GLState {
  const st = new GLState(SW, SH);
  st.viewport = [0, 0, SW, SH];
  st.scissorTest = false;
  st.blendEnabled = false;
  st.colorMask = [true, true, true, true];
  st.depthMask = true;
  st.stencilTest = true;
  return st;
}

function depthVertex(sx: number, sy: number, d: number): Vertex {
  const ndcX = (sx / SW) * 2 - 1;
  const ndcY = (sy / SH) * 2 - 1;
  const z = 2 * d - 1;
  return { position: [ndcX, ndcY, z, 1], varyings: new Float32Array(0) };
}

function coverTri(d: number): Vertex[] {
  return [depthVertex(-8, -8, d), depthVertex(24, -8, d), depthVertex(-8, 24, d)];
}

function stencilCall(
  fb: Framebuffer,
  st: GLState,
  verts: Vertex[],
  color: readonly [number, number, number, number],
): DrawCall {
  return {
    program: null,
    framebuffer: fb,
    state: st,
    vertices: verts,
    indices: null,
    instanceCount: 1,
    samplers: [],
    fragmentColor: [color[0], color[1], color[2], color[3]],
  } as unknown as DrawCall;
}

function stencilPixel(fb: Framebuffer, x: number, y: number): number[] {
  return Array.from(fb.readPixels(x, y, 1, 1));
}

describe('stencil gating + order suite', () => {
  it('S-1 stencil gating writes only where pattern passes', () => {
    // Arrange
    const fb = stencilFrame(1.0);
    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        fb.stencil[y * SW + x] = x < 4 ? 1 : 0;
      }
    }
    const st = stencilState();
    st.stencilTest = true;
    st.depthTest = false;
    st.depthMask = false;
    // Act
    drawArraysImpl(stencilCall(fb, st, coverTri(0.5), RED));
    // Assert
    expect(stencilPixel(fb, 2, 4)).toEqual([255, 0, 0, 255]);
    expect(stencilPixel(fb, 6, 4)).toEqual([0, 0, 0, 0]);
    expect(fb.depth[4 * SW + 2] as number).toBeCloseTo(1.0, 6);
    expect(fb.depth[4 * SW + 6] as number).toBeCloseTo(1.0, 6);
  });

  it('S-2 disabled stencilTest writes everywhere', () => {
    // Arrange
    const fb = stencilFrame(1.0);
    fb.stencil.fill(0);
    const st = stencilState();
    st.stencilTest = false;
    st.depthTest = false;
    st.depthMask = false;
    // Act
    drawArraysImpl(stencilCall(fb, st, coverTri(0.5), RED));
    // Assert
    expect(stencilPixel(fb, 2, 4)).toEqual([255, 0, 0, 255]);
    expect(stencilPixel(fb, 6, 4)).toEqual([255, 0, 0, 255]);
  });

  it('S-3 stencil rejection leaves depth unchanged', () => {
    // Arrange
    const fb = stencilFrame(0.9);
    fb.stencil.fill(1);
    fb.stencil[4 * SW + 4] = 0;
    const st = stencilState();
    st.stencilTest = true;
    st.depthTest = true;
    st.depthFunc = LESS;
    st.depthMask = true;
    // Act
    drawArraysImpl(stencilCall(fb, st, coverTri(0.2), RED));
    // Assert
    expect(stencilPixel(fb, 4, 4)).toEqual([0, 0, 0, 0]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.9, 6);
    expect(stencilPixel(fb, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(fb.depth[1 * SW + 1] as number).toBeCloseTo(0.2, 6);
  });

  it('S-4 stencil pattern values 255 and complement coverage', () => {
    // Arrange
    const fb = stencilFrame(1.0);
    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        fb.stencil[y * SW + x] = (x + y) % 2 === 0 ? 255 : 0;
      }
    }
    const sBefore = fb.stencil.slice();
    const st = stencilState();
    st.stencilTest = true;
    st.depthTest = false;
    st.depthMask = false;
    // Act
    drawArraysImpl(stencilCall(fb, st, coverTri(0.5), BLUE));
    // Assert
    expect(stencilPixel(fb, 0, 0)).toEqual([0, 0, 255, 255]);
    expect(stencilPixel(fb, 1, 0)).toEqual([0, 0, 0, 0]);
    let blue = 0;
    for (let y = 0; y < SH; y++) {
      for (let x = 0; x < SW; x++) {
        const p = stencilPixel(fb, x, y);
        if (p[0] === 0 && p[1] === 0 && p[2] === 255 && p[3] === 255) blue++;
      }
    }
    expect(blue).toBe(32);
    expect(fb.stencil).toEqual(sBefore);
  });
});
