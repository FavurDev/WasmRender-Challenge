/** Sprint 8 Fix 7: WebGL1-invariance — identical WebGL1 scene on both contexts (RED phase). */
import { describe, expect, it } from 'vitest';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import type { DirectVertex } from '../../src/gl/webgl1-context';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import {
  COLOR_BUFFER_BIT,
  DEPTH_BUFFER_BIT,
  DEPTH_TEST,
  RGBA,
  TRIANGLES,
  UNSIGNED_BYTE,
} from '../../src/gl/constants';

const W = 64;
const H = 64;

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function renderScene(gl: WebGL1Context | WebGL2Context): Uint8Array {
  // Arrange: identical WebGL1-only scene on either context class.
  gl.viewport(0, 0, W, H);
  gl.clearColor(0.2, 0.4, 0.6, 1.0);
  gl.clearDepth(1.0);
  gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
  gl.enable(DEPTH_TEST);
  const tri: DirectVertex[] = [
    { position: [-1, -1, 0, 1] },
    { position: [3, -1, 0, 1] },
    { position: [-1, 3, 0, 1] },
  ];
  // Act:
  gl.drawArrays(TRIANGLES, 0, 3, tri);
  const pixels = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, RGBA, UNSIGNED_BYTE, pixels);
  return pixels;
}

describe('WebGL1 invariance (Fix 7)', () => {
  it('TEST 5.1: WebGL1 and WebGL2 contexts produce byte-identical readPixels on WebGL1 scene', () => {
    // Arrange:
    const gl1 = new WebGL1Context({ width: W, height: W });
    const gl2 = new WebGL2Context({ width: W, height: H });
    // Act:
    const buf1 = renderScene(gl1);
    const buf2 = renderScene(gl2);
    // Assert:
    expect(buf1.length).toBe(W * H * 4);
    expect(buf2.length).toBe(W * H * 4);
    expect(buffersEqual(buf1, buf2)).toBe(true);
  });
});
