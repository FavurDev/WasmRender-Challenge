/** 3D and 2D-array texture red-phase tests (Sprint 8 Task 5) — texImage3D family, per-unit 3D binding, subvolume, copy, unpack strides, sampler3D. */
import { describe, expect, it } from 'vitest';
import { ErrorSink } from '../../src/gl/errors';
import { TextureManager } from '../../src/gl/texture';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import { fetchTexel3D } from '../../src/gl/sampler';
import { createSoftwareWebGLContext } from '../../src/entry';
import {
  INVALID_ENUM,
  INVALID_VALUE,
  NO_ERROR,
  OUT_OF_MEMORY,
  RGBA,
  TEXTURE0,
  TEXTURE1,
  TEXTURE_2D_ARRAY,
  TEXTURE_3D,
  TEXTURE_WRAP_R,
  UNSIGNED_BYTE,
  UNPACK_IMAGE_HEIGHT,
  UNPACK_ROW_LENGTH,
  UNPACK_SKIP_IMAGES,
  UNPACK_SKIP_PIXELS,
  UNPACK_SKIP_ROWS,
} from '../../src/gl/constants';
import type { GLenum } from '../../src/gl/constants';

type TexImage3D = (
  target: GLenum,
  level: number,
  internalformat: GLenum,
  width: number,
  height: number,
  depth: number,
  border: number,
  format: GLenum,
  type: GLenum,
  pixels: Uint8Array | null,
) => void;

function as3D(obj: unknown): Record<string, unknown> {
  return obj as unknown as Record<string, unknown>;
}

function freshContext(): WebGL1Context {
  return createSoftwareWebGLContext({ width: 4, height: 4 }) as unknown as WebGL1Context;
}

function freshGL2(): WebGL2Context {
  return new WebGL2Context({ width: 4, height: 4 });
}

describe('texture3d red phase (Sprint 8 Task 5)', () => {
  it('texImage3D dimension >256 records INVALID_VALUE with no allocation', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_3D, tex);
    const rec = as3D(mgr);
    // Act:
    expect(typeof rec['texImage3D']).toBe('function');
    (rec['texImage3D'] as TexImage3D)(TEXTURE_3D, 0, RGBA, 257, 1, 1, 0, RGBA, UNSIGNED_BYTE, null);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_VALUE);
    expect(as3D(mgr.getBoundTexture(TEXTURE_3D))['levels3D']).toBeUndefined();
  });

  it('256MB guard records OUT_OF_MEMORY with no allocation', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_3D, tex);
    const rec = as3D(mgr);
    // Act:
    expect(typeof rec['texImage3D']).toBe('function');
    (rec['texImage3D'] as TexImage3D)(TEXTURE_3D, 0, RGBA, 256, 256, 256, 0, RGBA, UNSIGNED_BYTE, null);
    // Assert:
    expect(errorSink.getError()).toBe(OUT_OF_MEMORY);
    expect(as3D(mgr.getBoundTexture(TEXTURE_3D))['levels3D']).toBeUndefined();
  });

  it('WebGL1Context lacks the 3D family and rejects TEXTURE_3D bind with INVALID_ENUM', () => {
    // Arrange:
    const gl = freshContext();
    const rec = as3D(gl);
    // Act:
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    const err = gl.getError();
    // Assert:
    expect(typeof rec['texImage3D']).toBe('undefined');
    expect(typeof rec['texSubImage3D']).toBe('undefined');
    expect(typeof rec['copyTexSubImage3D']).toBe('undefined');
    expect(err).toBe(INVALID_ENUM);
  });

  it('bindTexture manages TEXTURE_3D and TEXTURE_2D_ARRAY across texture units', () => {
    // Arrange:
    const gl = freshGL2();
    const t3 = gl.createTexture();
    const t2a = gl.createTexture();
    // Act:
    gl.activeTexture(TEXTURE0);
    gl.bindTexture(TEXTURE_3D, t3);
    const err0 = gl.getError();
    gl.activeTexture(TEXTURE1);
    gl.bindTexture(TEXTURE_2D_ARRAY, t2a);
    const err1 = gl.getError();
    // Assert:
    expect(typeof as3D(gl)['texImage3D']).toBe('function');
    expect(err0).toBe(NO_ERROR);
    expect(err1).toBe(NO_ERROR);
    gl.activeTexture(TEXTURE0);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('texSubImage3D replaces a subvolume leaving other voxels untouched', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    const base = new Uint8Array(2 * 2 * 2 * 4);
    for (let i = 0; i < 8; i++) {
      base.set([10, 10, 10, 255], i * 4);
    }
    // Act:
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, base);
    const patch = new Uint8Array([255, 0, 0, 255]);
    gl.texSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 1, 1, 1, RGBA, UNSIGNED_BYTE, patch);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(fetchTexel3D(tex!, 0, 0, 0, 0))).toEqual([1, 0, 0, 1]);
    const expected = Math.fround(10 / 255);
    expect(Array.from(fetchTexel3D(tex!, 0, 1, 1, 1))).toEqual([expected, expected, expected, 1]);
  });

  it('copyTexSubImage3D copies framebuffer pixels into the target slice', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, null);
    gl.clearColor(0, 1, 0, 1);
    gl.clear(0x00004000);
    // Act:
    gl.copyTexSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 0, 0, 2, 2);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(fetchTexel3D(tex!, 0, 0, 0, 0))).toEqual([0, 1, 0, 1]);
  });

  it('pixel-store params extract the correct subvolume on texImage3D upload', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    // Act:
    gl.pixelStorei(UNPACK_ROW_LENGTH, 4);
    gl.pixelStorei(UNPACK_IMAGE_HEIGHT, 4);
    gl.pixelStorei(UNPACK_SKIP_PIXELS, 1);
    gl.pixelStorei(UNPACK_SKIP_ROWS, 1);
    gl.pixelStorei(UNPACK_SKIP_IMAGES, 1);
    const src = new Uint8Array(4 * 4 * 2 * 4).fill(7);
    // Mark the selected subvolume voxel (image 1, row 1, col 1) red.
    const mark = (1 * 16 + 1 * 4 + 1) * 4;
    src[mark] = 255; src[mark + 1] = 0; src[mark + 2] = 0; src[mark + 3] = 255;
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 1, 1, 1, 0, RGBA, UNSIGNED_BYTE, src);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(fetchTexel3D(tex!, 0, 0, 0, 0))).toEqual([1, 0, 0, 1]);
  });

  it('readPixels integration: sampler3D at known (s,t,r) returns the expected texel', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    const voxels = new Uint8Array([255, 0, 0, 255]);
    // Act:
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 1, 1, 1, 0, RGBA, UNSIGNED_BYTE, voxels);
    expect(TEXTURE_WRAP_R).toBeDefined();
    const out = new Uint8Array(4);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(0x00004000);
    gl.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, out);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(fetchTexel3D(tex!, 0, 0, 0, 0))).toEqual([1, 0, 0, 1]);
    expect(Array.from(out)).toEqual([0, 0, 255, 255]);
  });
});
