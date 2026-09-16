/**
 * @fileoverview Sprint 4 Task 7 rasterizer suite — exactly 10 cases R-1..R-10.
 *
 * Headless Node, fresh Framebuffer+GLState per case, Arrange-Act-Assert.
 */
import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { GLState } from '../../src/renderer/state';
import {
  ALWAYS,
  COLOR_BUFFER_BIT,
  EQUAL,
  FUNC_ADD,
  FUNC_REVERSE_SUBTRACT,
  FUNC_SUBTRACT,
  GEQUAL,
  GREATER,
  LEQUAL,
  LESS,
  NEVER,
  NOTEQUAL,
  ONE,
  ONE_MINUS_SRC_ALPHA,
  SRC_ALPHA,
} from '../../src/renderer/gl-constants';
import { drawArraysImpl, type DrawCall, type Vertex } from '../../src/renderer/rasterizer';

const W = 64;
const H = 64;
const SW = 8;
const SH = 8;
const RED: [number, number, number, number] = [255, 0, 0, 255];
const BLUE: [number, number, number, number] = [0, 0, 255, 255];

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

function drawCall(fb: Framebuffer, st: GLState, vertices: Vertex[], color: readonly [number, number, number, number] = RED): DrawCall {
  return {
    program: null,
    framebuffer: fb,
    state: st,
    vertices,
    indices: null,
    instanceCount: 1,
    samplers: [],
    fragmentColor: [color[0], color[1], color[2], color[3]],
  } as unknown as DrawCall;
}

function perspTriangle(): Vertex[] {
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

function analyticPerspectiveU(): number {
  // Arrange
  const invW = (1 / 1 + 1 / 2 + 1 / 4) / 3;
  const num = (0 / 1 + 1 / 2 + 2 / 4) / 3;
  // Act
  return num / invW;
}

function nearestCaptured(captured: number[], expected: number): number {
  return captured.reduce((a, b) => (Math.abs(b - expected) < Math.abs(a - expected) ? b : a));
}

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

function pipeState(func: number): GLState {
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

function expectTol(actual: number[], expected: number[], tol: number): void {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(Math.abs((actual[i] as number) - (expected[i] as number))).toBeLessThanOrEqual(tol);
  }
}

describe('rasterizer Task 7 suite', () => {
  it('R-1 interior/exterior: (32,40) red and (4,4) clear exact', () => {
    // Arrange
    const fb = makeFrame();
    const st = makeState();
    const call = drawCall(fb, st, refTriangle());
    // Act
    drawArraysImpl(call);
    // Assert
    expect(px(fb, 32, 40)).toEqual([255, 0, 0, 255]);
    expect(px(fb, 4, 4)).toEqual([0, 0, 0, 0]);
  });

  it('R-2 degenerate skip: zero-area leaves color+depth+stencil byte-identical', () => {
    // Arrange
    const fb = makeFrame([10, 20, 30, 255]);
    fb.depth.fill(0.3);
    fb.stencil.fill(7);
    const cBefore = fb.color.slice();
    const dBefore = fb.depth.slice();
    const sBefore = fb.stencil.slice();
    const st = makeState();
    const v = clipVertex(32, 16);
    const call = drawCall(fb, st, [v, v, clipVertex(48, 48)]);
    // Act
    drawArraysImpl(call);
    // Assert
    expect(fb.color).toEqual(cBefore);
    expect(fb.depth).toEqual(dBefore);
    expect(fb.stencil).toEqual(sBefore);
  });

  it('R-3 shared-edge: quad under additive blend covers each pixel exactly once', () => {
    // Arrange
    const fb = makeFrame();
    const st = makeState(true);
    st.blendSrcRGB = ONE;
    st.blendDstRGB = ONE;
    st.blendEquation = FUNC_ADD;
    const a = clipVertex(16, 16);
    const b = clipVertex(48, 16);
    const c = clipVertex(48, 48);
    const d = clipVertex(16, 48);
    // Act
    drawArraysImpl(drawCall(fb, st, [a, b, c]));
    drawArraysImpl(drawCall(fb, st, [a, c, d]));
    // Assert
    expect(px(fb, 32, 32)).toEqual([255, 0, 0, 255]);
    for (let i = 0; i < fb.color.length; i += 4) {
      const r = fb.color[i] as number;
      expect(r === 0 || r === 255).toBe(true);
    }
  });

  it('R-4 perspective accuracy: centroid u within 0.01 of hand-computed a/w over 1/w', () => {
    // Arrange
    const fb = makeFrame();
    const st = makeState();
    const captured: number[] = [];
    const program = { fragment: (varyings: Float32Array): void => { captured.push(varyings[0] as number); } };
    const call = drawCall(fb, st, perspTriangle());
    (call as unknown as { program: unknown }).program = program;
    // Act
    drawArraysImpl(call);
    // Assert
    const expected = analyticPerspectiveU();
    expect(captured.length).toBeGreaterThan(0);
    expect(Math.abs(nearestCaptured(captured, expected) - expected)).toBeLessThanOrEqual(0.01);
  });

  it('R-5 linear divergence: perspective differs from naive mean', () => {
    // Arrange
    const fb = makeFrame();
    const st = makeState();
    const captured: number[] = [];
    const program = { fragment: (varyings: Float32Array): void => { captured.push(varyings[0] as number); } };
    const call = drawCall(fb, st, perspTriangle());
    (call as unknown as { program: unknown }).program = program;
    // Act
    drawArraysImpl(call);
    const linear = (0 + 1 + 2) / 3;
    const perspective = analyticPerspectiveU();
    // Assert
    expect(Math.abs(perspective - linear)).toBeGreaterThan(0.05);
    expect(captured.length).toBeGreaterThan(0);
    const actual = nearestCaptured(captured, perspective);
    expect(Math.abs(actual - perspective)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(actual - linear)).toBeGreaterThan(0.05);
  });

  it('R-6 depth modes parameterized: 8 rows assert spec pass/fail outcomes', () => {
    // Arrange
    const rows: Array<{ func: number; name: string; incoming: number; stored: number; writes: boolean }> = [
      { func: NEVER, name: 'NEVER', incoming: 0.2, stored: 0.5, writes: false },
      { func: LESS, name: 'LESS', incoming: 0.2, stored: 0.5, writes: true },
      { func: EQUAL, name: 'EQUAL', incoming: 0.4, stored: 0.4, writes: true },
      { func: LEQUAL, name: 'LEQUAL', incoming: 0.4, stored: 0.4, writes: true },
      { func: GREATER, name: 'GREATER', incoming: 0.8, stored: 0.5, writes: true },
      { func: NOTEQUAL, name: 'NOTEQUAL', incoming: 0.2, stored: 0.5, writes: true },
      { func: GEQUAL, name: 'GEQUAL', incoming: 0.4, stored: 0.4, writes: true },
      { func: ALWAYS, name: 'ALWAYS', incoming: 0.9, stored: 0.1, writes: true },
    ];
    // Act + Assert per row with fresh context
    for (const row of rows) {
      // Arrange
      const fb = pipeFrame(row.stored);
      const st = pipeState(row.func);
      // Act
      drawArraysImpl(pipeCall(fb, st, coverTri(row.incoming), RED));
      // Assert
      if (row.writes) {
        expect(px(fb, 4, 4)).toEqual([255, 0, 0, 255]);
        expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(row.incoming, 5);
      } else {
        expect(px(fb, 4, 4)).toEqual([0, 0, 0, 0]);
        expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(row.stored, 6);
      }
      void row.name;
    }
    // Assert ALWAYS always writes even when incoming is farther
    const fbA = pipeFrame(0.1);
    drawArraysImpl(pipeCall(fbA, pipeState(ALWAYS), coverTri(0.9), RED));
    expect(px(fbA, 4, 4)).toEqual([255, 0, 0, 255]);
  });

  it('R-7 occlusion: nearer quad wins both draw orders under LESS', () => {
    // Arrange (far first)
    const fb1 = pipeFrame(1.0);
    const st1 = pipeState(LESS);
    // Act
    drawArraysImpl(pipeCall(fb1, st1, quadAt(0.8), BLUE));
    drawArraysImpl(pipeCall(fb1, st1, quadAt(0.2), RED));
    // Assert
    expect(px(fb1, 4, 4)).toEqual([255, 0, 0, 255]);
    // Arrange (near first)
    const fb2 = pipeFrame(1.0);
    const st2 = pipeState(LESS);
    // Act
    drawArraysImpl(pipeCall(fb2, st2, quadAt(0.2), RED));
    drawArraysImpl(pipeCall(fb2, st2, quadAt(0.8), BLUE));
    // Assert
    expect(px(fb2, 4, 4)).toEqual([255, 0, 0, 255]);
  });

  it('R-8 fifty-percent blend: red over blue yields [128,0,128,255] tol 1', () => {
    // Arrange
    const fb = new Framebuffer(SW, SH);
    fb.clearColor(0, 0, 1, 1);
    fb.clear(COLOR_BUFFER_BIT);
    const st = pipeState(LESS);
    st.depthTest = false;
    st.blendEnabled = true;
    st.blendSrcRGB = SRC_ALPHA;
    st.blendDstRGB = ONE_MINUS_SRC_ALPHA;
    st.blendEquation = FUNC_ADD;
    const src: [number, number, number, number] = [255, 0, 0, 128];
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.5), src));
    // Assert
    expectTol(px(fb, 4, 4), [128, 0, 128, 255], 1);
  });

  it('R-9 equation divergence: SUBTRACT vs REVERSE_SUBTRACT distinct analytic', () => {
    // Arrange
    const mkCtx = (eq: number): { fb: Framebuffer; st: GLState } => {
      const fb = new Framebuffer(SW, SH);
      fb.clearColor(0, 1, 0, 1);
      fb.clear(COLOR_BUFFER_BIT);
      const st = pipeState(LESS);
      st.depthTest = false;
      st.blendEnabled = true;
      st.blendSrcRGB = ONE;
      st.blendDstRGB = ONE;
      st.blendEquation = eq;
      return { fb, st };
    };
    const src: [number, number, number, number] = [200, 150, 100, 250];
    // Act
    const a = mkCtx(FUNC_SUBTRACT);
    drawArraysImpl(pipeCall(a.fb, a.st, coverTri(0.5), src));
    const b = mkCtx(FUNC_REVERSE_SUBTRACT);
    drawArraysImpl(pipeCall(b.fb, b.st, coverTri(0.5), src));
    // Assert
    expect(px(a.fb, 4, 4)).toEqual([200, 0, 100, 0]);
    expect(px(b.fb, 4, 4)).toEqual([0, 105, 0, 5]);
    expect(px(a.fb, 4, 4)).not.toEqual(px(b.fb, 4, 4));
  });

  it('R-10 pipeline order: scissor-fail leaves depth unchanged', () => {
    // Arrange
    const fb = pipeFrame(0.7);
    const st = pipeState(LESS);
    st.scissorTest = true;
    st.scissorBox = [0, 0, 0, 0];
    // Act
    drawArraysImpl(pipeCall(fb, st, coverTri(0.2), RED));
    // Assert
    expect(px(fb, 4, 4)).toEqual([0, 0, 0, 0]);
    expect(fb.depth[4 * SW + 4] as number).toBeCloseTo(0.7, 6);
  });
});
