/**
 * @fileoverview TDD red-phase unit tests for triangle coverage core (Sprint 4 Task 1).
 *
 * Written against the pseudocode blueprint before src/renderer/rasterizer.ts
 * exists. All tests MUST FAIL on first run (missing module import).
 */
import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { GLState } from '../../src/renderer/state';
import { COLOR_BUFFER_BIT } from '../../src/renderer/gl-constants';
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
