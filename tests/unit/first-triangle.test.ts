/** M1 first-triangle end-to-end integration suite (M1 unit tests 6-8) — public facade only. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { DirectVertex } from '../../src/gl/webgl1-context';
import {
  COLOR_BUFFER_BIT,
  DEPTH_BUFFER_BIT,
  NO_ERROR,
  RGBA,
  STENCIL_BUFFER_BIT,
  TRIANGLES,
  UNSIGNED_BYTE,
} from '../../src/gl/constants';

const W = 64;
const H = 64;

function makeCtx() {
  const ctx = createSoftwareWebGLContext({ width: W, height: H });
  if (ctx === null) throw new Error('failed to create context');
  return ctx;
}

function readAll(ctx: ReturnType<typeof makeCtx>): Uint8Array {
  const buf = new Uint8Array(W * H * 4);
  ctx.readPixels(0, 0, W, H, RGBA, UNSIGNED_BYTE, buf);
  return buf;
}

function px(buf: Uint8Array, x: number, y: number): [number, number, number, number] {
  const o = (y * W + x) * 4;
  return [buf[o] as number, buf[o + 1] as number, buf[o + 2] as number, buf[o + 3] as number];
}

describe('M1 first-triangle integration (tests 6-8)', () => {
  it('test 6: 2x2 viewport-clamped red triangle covers exactly four pixels', () => {
    // Arrange
    const ctx = makeCtx();
    ctx.clearColor(0, 0, 0, 1);
    ctx.clear(COLOR_BUFFER_BIT);
    ctx.viewport(30, 30, 2, 2);
    const red: readonly [number, number, number, number] = [1, 0, 0, 1];
    const tri: DirectVertex[] = [
      { position: [-3, -3, 0, 1], color: red },
      { position: [5, -3, 0, 1], color: red },
      { position: [-3, 5, 0, 1], color: red },
    ];
    // Act
    ctx.drawArrays(TRIANGLES, 0, 3, tri);
    const buf = readAll(ctx);
    // Assert
    const redPx = new Set(['30,30', '31,30', '30,31', '31,31']);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const got = px(buf, x, y);
        if (redPx.has(`${x},${y}`)) {
          expect(got, `pixel (${x},${y})`).toEqual([255, 0, 0, 255]);
        } else {
          expect(got, `pixel (${x},${y})`).toEqual([0, 0, 0, 255]);
        }
      }
    }
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('test 7: quad split across two buffers tiles with no gaps or overlaps', () => {
    // Arrange: quad [10..20]x[10..20] -> NDC (win/32 - 1)
    const q0: readonly [number, number, number, number] = [-0.6875, -0.6875, 0, 1];
    const q1: readonly [number, number, number, number] = [-0.375, -0.6875, 0, 1];
    const q2: readonly [number, number, number, number] = [-0.375, -0.375, 0, 1];
    const q3: readonly [number, number, number, number] = [-0.6875, -0.375, 0, 1];
    const red: readonly [number, number, number, number] = [1, 0, 0, 1];
    const green: readonly [number, number, number, number] = [0, 1, 0, 1];
    const tri1: DirectVertex[] = [
      { position: q0, color: red },
      { position: q1, color: red },
      { position: q2, color: red },
    ];
    const tri2: DirectVertex[] = [
      { position: q0, color: green },
      { position: q2, color: green },
      { position: q3, color: green },
    ];
    // Act
    const ctx1 = makeCtx();
    ctx1.clearColor(0, 0, 0, 1);
    ctx1.clear(COLOR_BUFFER_BIT);
    ctx1.viewport(0, 0, W, H);
    ctx1.drawArrays(TRIANGLES, 0, 3, tri1);
    const buf1 = readAll(ctx1);
    const ctx2 = makeCtx();
    ctx2.clearColor(0, 0, 0, 1);
    ctx2.clear(COLOR_BUFFER_BIT);
    ctx2.viewport(0, 0, W, H);
    ctx2.drawArrays(TRIANGLES, 0, 3, tri2);
    const buf2 = readAll(ctx2);
    // Assert
    const inQuad = (x: number, y: number): boolean => x >= 10 && x <= 19 && y >= 10 && y <= 19;
    const isRed = (b: Uint8Array, x: number, y: number): boolean => {
      const p = px(b, x, y);
      return p[0] === 255 && p[1] === 0 && p[2] === 0 && p[3] === 255;
    };
    const isGreen = (b: Uint8Array, x: number, y: number): boolean => {
      const p = px(b, x, y);
      return p[0] === 0 && p[1] === 255 && p[2] === 0 && p[3] === 255;
    };
    const isBlack = (b: Uint8Array, x: number, y: number): boolean => {
      const p = px(b, x, y);
      return p[0] === 0 && p[1] === 0 && p[2] === 0 && p[3] === 255;
    };
    let covered = 0;
    for (let y = 10; y <= 19; y++) {
      for (let x = 10; x <= 19; x++) {
        const r = isRed(buf1, x, y);
        const g = isGreen(buf2, x, y);
        expect(r && g, `pixel (${x},${y}) double-covered`).toBe(false);
        expect(r || g, `pixel (${x},${y}) uncovered`).toBe(true);
        if (r || g) covered++;
      }
    }
    expect(covered).toBe(100);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (inQuad(x, y)) continue;
        expect(isBlack(buf1, x, y), `buf1 outside (${x},${y})`).toBe(true);
        expect(isBlack(buf2, x, y), `buf2 outside (${x},${y})`).toBe(true);
      }
    }
    expect(ctx1.getError()).toBe(NO_ERROR);
    expect(ctx2.getError()).toBe(NO_ERROR);
  });

  it('test 8: degenerate triangles are a byte-identical no-op', () => {
    // Arrange
    const ctx = makeCtx();
    ctx.clearColor(0.25, 0.5, 0.75, 1);
    ctx.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT | STENCIL_BUFFER_BIT);
    const before = readAll(ctx);
    expect(px(before, 0, 0)).toEqual([64, 128, 191, 255]);
    const white: readonly [number, number, number, number] = [1, 1, 1, 1];
    const collinear: DirectVertex[] = [
      { position: [0, 0, 0, 1], color: white },
      { position: [0.2, 0.2, 0, 1], color: white },
      { position: [0.4, 0.4, 0, 1], color: white },
    ];
    const identical: DirectVertex[] = [
      { position: [0, 0, 0, 1], color: white },
      { position: [0, 0, 0, 1], color: white },
      { position: [0, 0, 0, 1], color: white },
    ];
    // Act
    ctx.drawArrays(TRIANGLES, 0, 3, collinear);
    const err1 = ctx.getError();
    ctx.drawArrays(TRIANGLES, 0, 3, identical);
    const err2 = ctx.getError();
    const after = readAll(ctx);
    // Assert
    expect(err1).toBe(NO_ERROR);
    expect(err2).toBe(NO_ERROR);
    expect(after.length).toBe(16384);
    expect(after).toEqual(before);
    expect(ctx.getError()).toBe(NO_ERROR);
  });
});
