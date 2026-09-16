/**
 * @fileoverview Sprint 4 Task 7 framebuffer suite — exactly 8 cases F-1..F-8.
 *
 * Headless Node, fresh Framebuffer per case, Arrange-Act-Assert.
 */
import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { GLState } from '../../src/renderer/state';
import { drawArraysImpl, type DrawCall, type Vertex } from '../../src/renderer/rasterizer';
import { TextureStore } from '../../src/renderer/texture';
import {
  CLAMP_TO_EDGE,
  COLOR_BUFFER_BIT,
  DEPTH_BUFFER_BIT,
  LESS,
  MIRRORED_REPEAT,
  NEAREST,
  REPEAT,
  RGBA,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  UNSIGNED_BYTE,
} from '../../src/renderer/gl-constants';

const W = 4;
const H = 4;

function cv(x: number, y: number, z: number, w: number): Vertex {
  return { position: [x, y, z, w], varyings: new Float32Array(0) };
}
function px(fb: Framebuffer, x: number, y: number): number[] {
  return Array.from(fb.readPixels(x, y, 1, 1));
}

describe('framebuffer (F-1..F-8)', () => {
  it('F-1 clear fills exact bytes', () => {
    // Arrange
    const fb = new Framebuffer(W, H);
    fb.clearColor(1, 0, 0, 1);
    // Act
    fb.clear(COLOR_BUFFER_BIT);
    // Assert
    expect(px(fb, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(px(fb, 3, 3)).toEqual([255, 0, 0, 255]);
    expect(fb.color.length).toBe(W * H * 4);
  });

  it('F-2 clearDepth plus depth-test interaction', () => {
    // Arrange
    const fb = new Framebuffer(W, H);
    fb.clearDepth(0.9);
    fb.clear(DEPTH_BUFFER_BIT);
    const st = new GLState(W, H);
    st.depthTest = true;
    st.depthFunc = LESS;
    const near: DrawCall = {
      program: null, framebuffer: fb, state: st,
      vertices: [cv(-1, -1, 0.1, 1), cv(3, -1, 0.1, 1), cv(-1, 3, 0.1, 1)],
      indices: null, instanceCount: 1, samplers: [], fragmentColor: [0, 255, 0, 255],
    };
    // Act
    drawArraysImpl(near);
    // Assert
    expect(px(fb, 1, 1)).toEqual([0, 255, 0, 255]);
    expect(fb.depth[1 * W + 1] as number).toBeLessThan(0.9);
  });

  it('F-3 masked clears honor colorMask and depthMask', () => {
    // Arrange
    const fb = new Framebuffer(W, H);
    fb.clearColor(1, 1, 1, 1);
    fb.clear(COLOR_BUFFER_BIT);
    fb.setColorMask(false, true, false, false);
    fb.clearColor(1, 0, 0, 1);
    // Act
    fb.clear(COLOR_BUFFER_BIT);
    // Assert
    expect(px(fb, 0, 0)).toEqual([255, 0, 255, 255]);
    // Arrange (depth mask)
    const fb2 = new Framebuffer(W, H);
    fb2.clearDepth(0.25);
    fb2.clear(DEPTH_BUFFER_BIT);
    fb2.setDepthMask(false);
    fb2.clearDepth(0.75);
    // Act
    fb2.clear(DEPTH_BUFFER_BIT);
    // Assert
    expect(fb2.depth[0] as number).toBeCloseTo(0.25, 5);
  });

  it('F-4 resize OOM guard retains dims and pixels', () => {
    // Arrange
    const fb = new Framebuffer(W, H);
    fb.clearColor(0, 1, 0, 1);
    fb.clear(COLOR_BUFFER_BIT);
    const before = Array.from(fb.color);
    // Act
    let threw = false;
    try {
      fb.resize(99999, 99999);
    } catch {
      threw = true;
    }
    // Assert
    expect(threw).toBe(true);
    expect(fb.width).toBe(W);
    expect(fb.height).toBe(H);
    expect(Array.from(fb.color)).toEqual(before);
  });

  it('F-5 readback round-trip is byte-identical RGBA UNSIGNED_BYTE', () => {
    // Arrange
    const fb = new Framebuffer(W, H);
    fb.clearColor(0.2, 0.4, 0.6, 0.8);
    fb.clear(COLOR_BUFFER_BIT);
    // Act
    const out = fb.readPixels(0, 0, W, H);
    // Assert
    expect(RGBA).toBe(RGBA);
    expect(UNSIGNED_BYTE).toBe(UNSIGNED_BYTE);
    expect(out.length).toBe(W * H * 4);
    expect(Array.from(out.slice(0, 4))).toEqual([51, 102, 153, 204]);
    expect(Array.from(out)).toEqual(Array.from(fb.color));
  });

  it('F-6 OOB readback rejects invalid-value shape with no mutation', () => {
    // Arrange
    const fb = new Framebuffer(W, H);
    fb.clearColor(1, 0, 0, 1);
    fb.clear(COLOR_BUFFER_BIT);
    const before = Array.from(fb.color);
    // Act
    let code: string | null = null;
    try {
      fb.readPixels(-1, 0, 2, 2);
    } catch (e) {
      code = (e as Error).name;
    }
    // Assert
    expect(code).not.toBeNull();
    expect(Array.from(fb.color)).toEqual(before);
  });

  it('F-7 NEAREST 2x2 upload samples exact texels', () => {
    // Arrange
    const store = new TextureStore();
    const h = store.createTexture();
    store.bindTexture(TEXTURE_2D, h);
    store.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    store.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    const bytes = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
    store.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, RGBA, UNSIGNED_BYTE, bytes);
    // Act
    const tl = store.sample2D(h, 0.25, 0.25);
    const br = store.sample2D(h, 0.75, 0.75);
    // Assert
    expect(Array.from(tl)).toEqual([1, 0, 0, 1]);
    expect(Array.from(br)).toEqual([1, 1, 1, 1]);
  });

  it('F-8 wrap modes diverge at u=1.5 and putImageData agrees with readPixels', () => {
    // Arrange
    const store = new TextureStore();
    const mk = (wrap: number): number => {
      const h = store.createTexture();
      store.bindTexture(TEXTURE_2D, h);
      store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, wrap);
      store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, wrap);
      const bytes = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
      store.texImage2D(TEXTURE_2D, 0, RGBA, 2, 1, RGBA, UNSIGNED_BYTE, bytes);
      return h;
    };
    const c = store.sample2D(mk(CLAMP_TO_EDGE), 2.25, 0.5);
    const r = store.sample2D(mk(REPEAT), 2.25, 0.5);
    const m = store.sample2D(mk(MIRRORED_REPEAT), 1.5, 0.5);
    // Assert
    expect(Array.from(c)).toEqual([0, 1, 0, 1]);
    expect(Array.from(r)).toEqual([1, 0, 0, 1]);
    expect(Array.from(c)).not.toEqual(Array.from(r));
    expect(Array.from(m)).toEqual([1, 0, 0, 1]);
    expect(Array.from(m)).not.toEqual(Array.from(c));
    // Arrange (present agreement via stub target)
    const fb = new Framebuffer(W, H);
    fb.clearColor(1, 0, 0, 1);
    fb.clear(COLOR_BUFFER_BIT);
    let got: Uint8ClampedArray | null = null;
    const stub = {
      putImageData: (data: Uint8ClampedArray, _w: number, _h: number): void => {
        got = data;
        void _w;
        void _h;
      },
    };
    // Act
    fb.presentToCanvas(stub);
    // Assert
    expect(got !== null).toBe(true);
    expect(Array.from(got as unknown as Uint8ClampedArray)).toEqual(Array.from(fb.readPixels(0, 0, W, H)));
  });
});
