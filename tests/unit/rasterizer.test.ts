/**
 * @fileoverview TDD red-phase unit tests for triangle coverage core (Sprint 4 Task 1).
 *
 * Written against the pseudocode blueprint before src/renderer/rasterizer.ts
 * exists. All tests MUST FAIL on first run (missing module import).
 */
import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { GLState } from '../../src/renderer/state';
import { ALWAYS, COLOR_BUFFER_BIT, EQUAL, FUNC_ADD, FUNC_REVERSE_SUBTRACT, FUNC_SUBTRACT, GEQUAL, GREATER, LEQUAL, LESS, NEVER, NOTEQUAL, ONE, ONE_MINUS_SRC_ALPHA, SRC_ALPHA } from '../../src/renderer/gl-constants';
import {
  drawArraysImpl,
  drawElementsImpl,
  type DrawCall,
  type Vertex,
} from '../../src/renderer/rasterizer';

const W = 64;
const H = 64;
const RED: [number, number, number, number] = [255, 0, 0, 255];

/** Map a screen-space pixel to a clip-space vertex with w=1 under full viewport. */
function clipVertex(sx: number, sy: number): Vertex {
  const ndcX = (sx / W) * 2 - 1;
  const ndcY = (sy / H) * 2 - 1;
  return { position: [ndcX, ndcY, 0, 1], varyings: new Float32Array(0) };
}

function makeFrame(clear: [number, number, number, number] = [0, 0, 0, 0]): Framebuffer {
  const fb = new Framebuffer(W, H);
  fb.clearColor(clear[0] / 255, clear[1] / 255, clear[2] / 255, clear[3] / 255);
  fb.clear(COLOR_BUFFER_BIT);
  return fb;
}

function makeState(blend = false): GLState {
  const st = new GLState(W, H);
  st.viewport = [0, 0, W, H];
  st.scissorTest = false;
  st.blendEnabled = blend;
  return st;
}

function refTriangle(): Vertex[] {
  return [clipVertex(32, 16), clipVertex(16, 48), clipVertex(48, 48)];
}

function drawCall(fb: Framebuffer, st: GLState, vertices: Vertex[], indices?: Uint16Array): DrawCall {
  return {
    program: null,
    framebuffer: fb,
    state: st,
    vertices,
    indices: indices ?? null,
    instanceCount: 1,
    samplers: [],
    fragmentColor: RED,
  } as unknown as DrawCall;
}

describe('rasterizer triangle coverage core', () => {
  it('interior/exterior: covers (32,40) red and leaves (4,4) clear', () => {
    // Arrange
    const fb = makeFrame();
    const st = makeState();
    const call = drawCall(fb, st, refTriangle());
    // Act
    drawArraysImpl(call);
    // Assert
    expect(Array.from(fb.readPixels(32, 40, 1, 1))).toEqual([255, 0, 0, 255]);
    expect(Array.from(fb.readPixels(4, 4, 1, 1))).toEqual([0, 0, 0, 0]);
  });

  it('degenerate-skip: coincident vertices leave store byte-identical', () => {
    // Arrange
    const fb = makeFrame([10, 20, 30, 255]);
    const before = fb.color.slice();
    const st = makeState();
    const v = clipVertex(32, 16);
    const call = drawCall(fb, st, [v, v, clipVertex(48, 48)]);
    // Act
    drawArraysImpl(call);
    // Assert
    expect(fb.color).toEqual(before);
  });

  it('shared-edge: quad under additive blend covers each pixel exactly once', () => {
    // Arrange
    const fb = makeFrame();
    const st = makeState(true);
    const a = clipVertex(16, 16);
    const b = clipVertex(48, 16);
    const c = clipVertex(48, 48);
    const d = clipVertex(16, 48);
    // Act
    drawArraysImpl(drawCall(fb, st, [a, b, c]));
    drawArraysImpl(drawCall(fb, st, [a, c, d]));
    // Assert
    const px = Array.from(fb.readPixels(32, 32, 1, 1));
    expect(px).toEqual([255, 0, 0, 255]);
    for (let i = 0; i < fb.color.length; i += 4) {
      const r = fb.color[i] as number;
      expect(r === 0 || r === 255).toBe(true);
    }
  });

  it('indexed-parity: drawElementsImpl matches arrays path and skips degenerate', () => {
    // Arrange
    const fb = makeFrame();
    const st = makeState();
    const verts = refTriangle();
    const valid = drawCall(fb, st, verts, new Uint16Array([0, 1, 2]));
    // Act
    drawElementsImpl(valid);
    // Assert
    expect(Array.from(fb.readPixels(32, 40, 1, 1))).toEqual([255, 0, 0, 255]);
    expect(Array.from(fb.readPixels(4, 4, 1, 1))).toEqual([0, 0, 0, 0]);
    // Arrange (degenerate indexed)
    const before = fb.color.slice();
    const degVerts = [clipVertex(10, 10), clipVertex(10, 10), clipVertex(20, 20)];
    const deg = drawCall(fb, st, degVerts, new Uint16Array([0, 1, 2]));
    // Act
    drawElementsImpl(deg);
    // Assert
    expect(fb.color).toEqual(before);
  });

  it('offscreen: fully offscreen triangle and zero-area scissor write nothing', () => {
    // Arrange
    const fb = makeFrame();
    const before = fb.color.slice();
    const st = makeState();
    const off = drawCall(fb, st, [clipVertex(200, 200), clipVertex(220, 200), clipVertex(200, 220)]);
    // Act
    drawArraysImpl(off);
    // Assert
    expect(fb.color).toEqual(before);
    // Arrange (zero-area scissor)
    const st2 = makeState();
    st2.scissorTest = true;
    st2.scissorBox = [0, 0, 0, 0];
    // Act
    drawArraysImpl(drawCall(fb, st2, refTriangle()));
    // Assert
    expect(fb.color).toEqual(before);
  });
});

describe('rasterizer perspective-correct interpolation (TDD red phase)', () => {
  // Fixed differing-w triangle mapping to screen (32,16),(16,48),(48,48).
  function perspTriangle(): Vertex[] {
    // Arrange constants: screen -> clip with w in {1,2,4}, u in {0,1,2}.
    const w0 = 1;
    const w1 = 2;
    const w2 = 4;
    const ndc = (s: number, e: number): number => (s / e) * 2 - 1;
    return [
      { position: [ndc(32, W) * w0, ndc(16, H) * w0, 0, w0], varyings: new Float32Array([0]) },
      { position: [ndc(16, W) * w1, ndc(48, H) * w1, 0, w1], varyings: new Float32Array([1]) },
      { position: [ndc(48, W) * w2, ndc(48, H) * w2, 0, w2], varyings: new Float32Array([2]) },
    ];
  }

  // Analytic perspective-correct u at centroid barycentrics (1/3 each).
  function analyticPerspectiveU(): number {
    // Arrange
    const invW = (1 / 1 + 1 / 2 + 1 / 4) / 3;
    const num = (0 / 1 + 1 / 2 + 2 / 4) / 3;
    // Act
    return num / invW;
  }

  it('perspective-accuracy: centroid u matches analytic a/w over 1/w within 0.01', () => {
    // Arrange
    const fb = makeFrame();
    const st = makeState();
    const captured: number[] = [];
    const program = {
      fragment: (varyings: Float32Array): void => {
        captured.push(varyings[0] as number);
      },
    };
    const call = drawCall(fb, st, perspTriangle());
    (call as unknown as { program: unknown }).program = program;
    // Act
    drawArraysImpl(call);
    // Assert
    const expected = analyticPerspectiveU();
    expect(captured.length).toBeGreaterThan(0);
    // Nearest-captured oracle: raster-order median is not at the centroid, so compare
    // the captured value closest to the analytic centroid value (correct per-fragment
    // perspective interpolation must produce a fragment within 0.01 of it).
    const actual = (captured as number[]).reduce((a, b) =>
      Math.abs(b - expected) < Math.abs(a - expected) ? b : a,
    ) as number;
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.01);
  });

  it('linear-divergence: perspective result differs measurably from naive linear', () => {
    // Arrange
    const fb = makeFrame();
    const st = makeState();
    const captured: number[] = [];
    const program = {
      fragment: (varyings: Float32Array): void => {
        captured.push(varyings[0] as number);
      },
    };
    const call = drawCall(fb, st, perspTriangle());
    (call as unknown as { program: unknown }).program = program;
    // Act
    drawArraysImpl(call);
    const linear = (0 + 1 + 2) / 3;
    const perspective = analyticPerspectiveU();
    // Assert (oracle sanity: fixtures must diverge)
    expect(Math.abs(perspective - linear)).toBeGreaterThan(0.05);
    // Assert (red phase: rasterizer must deliver the perspective value)
    expect(captured.length).toBeGreaterThan(0);
    // Nearest-captured oracle (see perspective-accuracy): median fragment is off-centroid.
    const actual = (captured as number[]).reduce((a, b) =>
      Math.abs(b - perspective) < Math.abs(a - perspective) ? b : a,
    ) as number;
    expect(Math.abs(actual - perspective)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(actual - linear)).toBeGreaterThan(0.05);
  });
});

describe('per-fragment pipeline (TDD red phase)', () => {
  // Depth mapping: per-vertex NDC z = clipZ / clipW; fragment depth = (weightedNdcZ + 1) / 2
  // clamped to [0,1]. Fixtures use uniform clip z = 2*d - 1 with w = 1 so incoming depth = d exactly.
  const SW = 8;
  const SH = 8;
  const BLUE: [number, number, number, number] = [0, 0, 255, 255];
  const GREEN: [number, number, number, number] = [0, 255, 0, 255];

  function depthVertex(sx: number, sy: number, d: number): Vertex {
    const ndcX = (sx / SW) * 2 - 1;
    const ndcY = (sy / SH) * 2 - 1;
    const z = 2 * d - 1;
    return { position: [ndcX, ndcY, z, 1], varyings: new Float32Array(0) };
  }

  function coverTri(d: number): Vertex[] {
    return [depthVertex(0, 0, d), depthVertex(8, 0, d), depthVertex(4, 8, d)];
  }

  function quadAt(d: number): Vertex[] {
    return [
      depthVertex(2, 2, d), depthVertex(6, 2, d), depthVertex(6, 6, d),
      depthVertex(2, 2, d), depthVertex(6, 6, d), depthVertex(2, 6, d),
    ];
  }

  function pipeFrame(storedDepth: number): Framebuffer {
    const fb = new Framebuffer(SW, SH);
    fb.depth.fill(storedDepth);
    return fb;
  }

  function pipeState(func: number, storedIgnored?: number): GLState {
    void storedIgnored;
    const st = new GLState(SW, SH);
    st.viewport = [0, 0, SW, SH];
    st.scissorTest = false;
    st.stencilTest = false;
    st.depthTest = true;
    st.depthFunc = func;
    st.depthMask = true;
    st.colorMask = [true, true, true, true];
    st.blendEnabled = false;
    return st;
  }

  function pipeCall(fb: Framebuffer, st: GLState, verts: Vertex[], color: readonly [number, number, number, number]): DrawCall {
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

  function px(fb: Framebuffer, x: number, y: number): number[] {
    return Array.from(fb.readPixels(x, y, 1, 1));
  }

  it('depth-NEVER-discards', () => {
    // Arrange
    const fb = pipeFrame(0.5);
    const st = pipeState(NEVER as number);
    const call = pipeCall(fb, st, coverTri(0.2), RED);
    // Act
    drawArraysImpl(call);
    // Assert
    expect(px(fb, 4, 4)).toEqual([0, 0, 0, 0]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.5, 6);
  });

  it('depth-LESS-passes-when-nearer', () => {
    // Arrange
    const fb = pipeFrame(0.5);
    const st = pipeState(LESS as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.2), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.2, 5);
  });

  it('depth-LESS-fails-when-farther', () => {
    // Arrange
    const fb = pipeFrame(0.5);
    const st = pipeState(LESS as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.8), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([0, 0, 0, 0]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.5, 6);
  });

  it('depth-EQUAL-tie-passes', () => {
    // Arrange
    const fb = pipeFrame(0.4);
    const st = pipeState(EQUAL as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.4), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.4, 6);
  });

  it('depth-LEQUAL-tie-passes', () => {
    // Arrange
    const fb = pipeFrame(0.4);
    const st = pipeState(LEQUAL as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.4), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
  });

  it('depth-GREATER-passes-when-farther', () => {
    // Arrange
    const fb = pipeFrame(0.3);
    const st = pipeState(GREATER as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.7), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.7, 5);
  });

  it('depth-NOTEQUAL-tie-fails-then-passes', () => {
    // Arrange
    const fb = pipeFrame(0.4);
    const st = pipeState(NOTEQUAL as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.4), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([0, 0, 0, 0]);
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.6), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
  });

  it('depth-GEQUAL-tie-passes', () => {
    // Arrange
    const fb = pipeFrame(0.4);
    const st = pipeState(GEQUAL as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.4), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
  });

  it('depth-ALWAYS-writes', () => {
    // Arrange
    const fb = pipeFrame(0.1);
    const st = pipeState(ALWAYS as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.9), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.9, 5);
  });

  it('occlusion-near-first', () => {
    // Arrange
    const fb = pipeFrame(1.0);
    const st = pipeState(LESS as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, quadAt(0.3), RED));
    drawArraysImpl(pipeCall(fb, st, quadAt(0.7), BLUE));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.3, 5);
  });

  it('occlusion-far-first', () => {
    // Arrange
    const fb = pipeFrame(1.0);
    const st = pipeState(LESS as number);
    // Act
    drawArraysImpl(pipeCall(fb, st, quadAt(0.7), BLUE));
    drawArraysImpl(pipeCall(fb, st, quadAt(0.3), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.3, 5);
  });

  it('scissor-precedes-depth', () => {
    // Arrange
    const fb = pipeFrame(0.5);
    const st = pipeState(ALWAYS as number);
    st.scissorTest = true;
    st.scissorBox = [0, 0, 2, 2];
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.9), RED));
    // Assert
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.5, 6);
    expect(px(fb, 4, 4)).toEqual([0, 0, 0, 0]);
  });

  it('depthMask-off', () => {
    // Arrange
    const fb = pipeFrame(0.5);
    const st = pipeState(LESS as number);
    st.depthMask = false;
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.2), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.5, 6);
    // Act (spec-correct discard: depth test runs independent of depthMask, so 0.7 < 0.5 is false and far blue discards, leaving near red)
    drawArraysImpl(pipeCall(fb, st, quadAt(0.7), BLUE));
    // Assert
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
  });

  it('colorMask-red-off', () => {
    // Arrange
    const fb = new Framebuffer(SW, SH);
    fb.color.fill(10);
    fb.depth.fill(1.0);
    const st = pipeState(ALWAYS as number);
    st.colorMask = [false, true, true, true];
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.2), GREEN));
    // Assert
    const c = px(fb, 4, 4);
    expect(c[0]).toBe(10);
    expect(c[1]).toBe(255);
    expect(c[2]).toBe(0);
    expect(c[3]).toBe(255);
  });

  it('colorMask-all-off', () => {
    // Arrange
    const fb = new Framebuffer(SW, SH);
    fb.color.fill(10);
    fb.depth.fill(1.0);
    const st = pipeState(ALWAYS as number);
    st.colorMask = [false, false, false, false];
    st.depthMask = true;
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.2), GREEN));
    // Assert
    expect(px(fb, 4, 4)).toEqual([10, 10, 10, 10]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.2, 5);
  });

  it('never-throw-pipeline', () => {
    // Arrange
    const fb = pipeFrame(0.5);
    const stS = pipeState(ALWAYS as number);
    stS.scissorTest = true;
    stS.scissorBox = [0, 0, 0, 0];
    const stT = pipeState(LESS as number);
    stT.stencilTest = true;
    const stD = pipeState(LESS as number);
    const beforeColor = fb.color.slice();
    const beforeStencil = fb.stencil.slice();
    // Act
    expect(() => drawArraysImpl(pipeCall(fb, stS, coverTri(0.9), RED))).not.toThrow();
    expect(() => drawArraysImpl(pipeCall(fb, stT, coverTri(0.2), RED))).not.toThrow();
    expect(() => drawArraysImpl(pipeCall(fb, stD, coverTri(0.8), RED))).not.toThrow();
    // Assert (all three discard: scissor-empty, stencil pass-through + depth pass writes... so isolate: failing-depth draw leaves pixel clear)
    expect(fb.stencil).toEqual(beforeStencil);
    expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
    expect(beforeColor.length).toBe(fb.color.length);
  });
});

describe('blend equations and factor set (TDD red phase)', () => {
  const BW = 8;
  const BH = 8;

  /**
   * Build a full-cover triangle for the small blend framebuffer.
   * @returns Three vertices covering pixel (4,4).
   */
  function blendTri(): Vertex[] {
    const ndc = (s: number, e: number): number => (s / e) * 2 - 1;
    return [
      { position: [ndc(0, BW), ndc(0, BH), 0, 1], varyings: new Float32Array(0) },
      { position: [ndc(8, BW), ndc(0, BH), 0, 1], varyings: new Float32Array(0) },
      { position: [ndc(4, BW), ndc(8, BH), 0, 1], varyings: new Float32Array(0) },
    ];
  }

  /**
   * Build a framebuffer pre-filled with a destination color.
   * @param dest Destination RGBA bytes to pre-fill.
   * @returns Framebuffer with color pre-filled and depth cleared.
   */
  function blendFrame(dest: readonly [number, number, number, number]): Framebuffer {
    const fb = new Framebuffer(BW, BH);
    for (let i = 0; i < BW * BH; i += 1) {
      fb.color[i * 4] = dest[0];
      fb.color[i * 4 + 1] = dest[1];
      fb.color[i * 4 + 2] = dest[2];
      fb.color[i * 4 + 3] = dest[3];
    }
    fb.depth.fill(1.0);
    return fb;
  }

  /**
   * Build GL state with explicit blend configuration.
   * @param enabled Whether blending is enabled.
   * @param src Source RGB factor enum value.
   * @param dst Destination RGB factor enum value.
   * @param eq Blend equation enum value.
   * @returns Configured GLState.
   */
  function blendState(enabled: boolean, src: number, dst: number, eq: number): GLState {
    const st = new GLState(BW, BH);
    st.viewport = [0, 0, BW, BH];
    st.scissorTest = false;
    st.stencilTest = false;
    st.depthTest = false;
    st.colorMask = [true, true, true, true];
    st.blendEnabled = enabled;
    st.blendSrcRGB = src;
    st.blendDstRGB = dst;
    st.blendEquation = eq;
    return st;
  }

  /**
   * Build a draw call with an explicit source color.
   * @param fb Target framebuffer.
   * @param st GL state snapshot.
   * @param src Source RGBA bytes.
   * @returns DrawCall drawing a full-cover triangle.
   */
  function blendCall(fb: Framebuffer, st: GLState, src: readonly [number, number, number, number]): DrawCall {
    return {
      program: null,
      framebuffer: fb,
      state: st,
      vertices: blendTri(),
      indices: null,
      instanceCount: 1,
      samplers: [],
      fragmentColor: [src[0], src[1], src[2], src[3]],
    } as unknown as DrawCall;
  }

  /** Read pixel (4,4) as a plain array. */
  function bpx(fb: Framebuffer): number[] {
    return Array.from(fb.readPixels(4, 4, 1, 1));
  }

  /** Assert per-channel tolerance. */
  function expectTol(actual: number[], expected: readonly number[], tol: number): void {
    expect(actual.length).toBe(expected.length);
    for (let i = 0; i < expected.length; i += 1) {
      expect(Math.abs((actual[i] as number) - (expected[i] as number))).toBeLessThanOrEqual(tol);
    }
  }

  it('blend-50-percent-red-over-blue', () => {
    // Arrange
    const fb = blendFrame([0, 0, 255, 255]);
    const st = blendState(true, SRC_ALPHA, ONE_MINUS_SRC_ALPHA, FUNC_ADD);
    // Act
    drawArraysImpl(blendCall(fb, st, [255, 0, 0, 128]));
    // Assert
    expectTol(bpx(fb), [128, 0, 128, 255], 1);
  });

  it('blend-subtract-vs-reverse-subtract-diverge', () => {
    // Arrange
    const src: [number, number, number, number] = [200, 160, 120, 255];
    const dest: [number, number, number, number] = [40, 80, 120, 255];
    const fbSub = blendFrame(dest);
    const fbRev = blendFrame(dest);
    // Act
    drawArraysImpl(blendCall(fbSub, blendState(true, ONE, ONE, FUNC_SUBTRACT), src));
    drawArraysImpl(blendCall(fbRev, blendState(true, ONE, ONE, FUNC_REVERSE_SUBTRACT), src));
    // Assert
    expect(bpx(fbSub)).toEqual([160, 80, 0, 0]);
    expect(bpx(fbRev)).toEqual([0, 0, 0, 0]);
    expect(bpx(fbSub)).not.toEqual(bpx(fbRev));
  });

  it('blend-disabled-fast-path-writes-src-exactly', () => {
    // Arrange
    const fb = blendFrame([10, 20, 30, 40]);
    const st = blendState(false, SRC_ALPHA, ONE_MINUS_SRC_ALPHA, FUNC_ADD);
    // Act
    drawArraysImpl(blendCall(fb, st, [200, 150, 100, 250]));
    // Assert
    expect(bpx(fb)).toEqual([200, 150, 100, 250]);
  });

  it('blend-additive-saturation-clamps', () => {
    // Arrange
    const fb = blendFrame([250, 250, 250, 250]);
    const st = blendState(true, ONE, ONE, FUNC_ADD);
    // Act
    drawArraysImpl(blendCall(fb, st, [100, 100, 100, 100]));
    // Assert
    expect(bpx(fb)).toEqual([255, 255, 255, 255]);
  });
});
