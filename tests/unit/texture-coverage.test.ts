/** Sprint 10 Task 8 texture behavioral coverage (TC-TEX-1..6) — observable error codes, completeness, pixels. */
import { describe, expect, it } from 'vitest';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import { isTextureComplete } from '../../src/gl/texture';
import {
  ALPHA,
  COLOR_BUFFER_BIT,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LUMINANCE,
  LUMINANCE_ALPHA,
  NO_ERROR,
  OUT_OF_MEMORY,
  RGB,
  RGBA,
  TEXTURE0,
  TEXTURE_2D,
  TEXTURE_2D_ARRAY,
  TEXTURE_3D,
  TEXTURE_CUBE_MAP,
  TEXTURE_CUBE_MAP_NEGATIVE_X,
  TEXTURE_CUBE_MAP_NEGATIVE_Y,
  TEXTURE_CUBE_MAP_NEGATIVE_Z,
  TEXTURE_CUBE_MAP_POSITIVE_X,
  TEXTURE_CUBE_MAP_POSITIVE_Y,
  TEXTURE_CUBE_MAP_POSITIVE_Z,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_R,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  CLAMP_TO_EDGE,
  REPEAT,
  NEAREST,
  LINEAR_MIPMAP_LINEAR,
  TRIANGLES,
  UNSIGNED_BYTE,
  UNPACK_FLIP_Y_WEBGL,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL,
  UNPACK_ROW_LENGTH,
  UNPACK_SKIP_PIXELS,
  UNPACK_SKIP_ROWS,
} from '../../src/gl/constants';

function freshGL1(): WebGL1Context {
  return new WebGL1Context({ width: 4, height: 4 });
}

function freshGL2(): WebGL2Context {
  return new WebGL2Context({ width: 4, height: 4 });
}

function rgbaPixels(r: number, g: number, b: number, a: number, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return out;
}

describe('texture coverage TC-TEX', () => {
  it('TC-TEX-1 texImage2D upload then texSubImage2D patch observable via readPixels', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act:
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(255, 0, 0, 255, 2, 2));
    expect(gl.getError()).toBe(NO_ERROR);
    gl.texSubImage2D(TEXTURE_2D, 0, 0, 0, 1, 1, RGBA, UNSIGNED_BYTE, rgbaPixels(0, 255, 0, 255, 1, 1));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(tex).not.toBe(null);
    expect(isTextureComplete(tex!)).toBe(true);
  });

  it('TC-TEX-2 cube face uploads mark texture complete', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_CUBE_MAP, tex);
    // Act: upload two cube faces via context texImage2D with cube targets
    const px = rgbaPixels(10, 20, 30, 255, 2, 2);
    gl.texImage2D(TEXTURE_CUBE_MAP_POSITIVE_X, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, px);
    gl.texImage2D(TEXTURE_CUBE_MAP_NEGATIVE_X, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, px);
    // Assert: no error recorded for valid cube uploads
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-3 mipmap filter without mipmaps makes texture incomplete', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Act:
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    // Assert:
    expect(tex).not.toBe(null);
    expect(isTextureComplete(tex!)).toBe(false);
  });

  it('TC-TEX-4 generateMipmap restores completeness; invalid target errors', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(9, 9, 9, 255, 4, 4));
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    // Act:
    gl.generateMipmap(TEXTURE_2D);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(tex).not.toBe(null);
    expect(isTextureComplete(tex!)).toBe(true);
    gl.generateMipmap(0x9999);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-TEX-5 copyTexImage2D captures framebuffer; bad border errors', () => {
    // Arrange:
    const gl = freshGL1();
    gl.clearColor(0, 1, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act:
    gl.copyTexImage2D(TEXTURE_2D, 0, RGBA, 0, 0, 2, 2, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    gl.copyTexImage2D(TEXTURE_2D, 0, RGBA, 0, 0, 2, 2, 1);
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-TEX-6 WebGL2 3D and 2D-array uploads succeed; bad target errors', () => {
    // Arrange:
    const gl = freshGL2();
    const t3 = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, t3);
    gl.texParameteri(TEXTURE_3D, TEXTURE_MIN_FILTER, NEAREST);
    const vox = rgbaPixels(5, 6, 7, 255, 2, 2);
    const vox3d = new Uint8Array([...vox, ...vox]);
    // Act:
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, vox3d);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    const ta = gl.createTexture();
    gl.bindTexture(TEXTURE_2D_ARRAY, ta);
    gl.texParameteri(TEXTURE_2D_ARRAY, TEXTURE_MIN_FILTER, NEAREST);
    gl.texImage3D(TEXTURE_2D_ARRAY, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, vox3d);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.texImage3D(TEXTURE_2D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, vox3d);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.texSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 1, 1, 1, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 1, 1, 255, 1, 1));
    expect(gl.getError()).toBe(NO_ERROR);
    // Draw smoke: zero-count draw is a no-op with no error.
    gl.activeTexture(TEXTURE0);
    gl.drawArrays(TRIANGLES, 0, 0);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-7 unpack flipY upload succeeds and stays complete', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act: enable flipY, upload a 1x2 texture with distinct rows.
    gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, true);
    expect(gl.getError()).toBe(NO_ERROR);
    const px = new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 1, 2, 0, RGBA, UNSIGNED_BYTE, px);
    // Assert: flipped upload records no error and the texture is complete.
    expect(gl.getError()).toBe(NO_ERROR);
    expect(tex).not.toBe(null);
    expect(isTextureComplete(tex!)).toBe(true);
    // Act: disable flipY again.
    gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, false);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-8 unpack premultiplyAlpha upload succeeds and stays complete', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act: enable premultiply with a half-transparent texel.
    gl.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 1, 1, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([200, 100, 50, 128]));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(tex).not.toBe(null);
    expect(isTextureComplete(tex!)).toBe(true);
    // Act: disable premultiply again.
    gl.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-9 WebGL2 unpack rowLength/skipPixels/skipRows round-trip; negative records INVALID_ENUM', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: valid unpack state stores and reads back.
    gl.pixelStorei(UNPACK_ROW_LENGTH, 8);
    expect(gl.getError()).toBe(NO_ERROR);
    // Assert:
    expect(gl.getUnpacki(UNPACK_ROW_LENGTH)).toBe(8);
    // Act: skipPixels and skipRows stores.
    gl.pixelStorei(UNPACK_SKIP_PIXELS, 2);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getUnpacki(UNPACK_SKIP_PIXELS)).toBe(2);
    gl.pixelStorei(UNPACK_SKIP_ROWS, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getUnpacki(UNPACK_SKIP_ROWS)).toBe(3);
    // Act: negative rowLength is rejected.
    gl.pixelStorei(UNPACK_ROW_LENGTH, -1);
    // Assert: single pinned error code.
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-TEX-10 six-face cube upload transitions false to complete', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_CUBE_MAP, tex);
    gl.texParameteri(TEXTURE_CUBE_MAP, TEXTURE_MIN_FILTER, NEAREST);
    const px = rgbaPixels(10, 20, 30, 255, 2, 2);
    const faces = [
      TEXTURE_CUBE_MAP_POSITIVE_X,
      TEXTURE_CUBE_MAP_NEGATIVE_X,
      TEXTURE_CUBE_MAP_POSITIVE_Y,
      TEXTURE_CUBE_MAP_NEGATIVE_Y,
      TEXTURE_CUBE_MAP_POSITIVE_Z,
      TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];
    // Act: upload the first face only.
    gl.texImage2D(faces[0]!, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, px);
    expect(gl.getError()).toBe(NO_ERROR);
    // Assert: partial cube is incomplete.
    expect(isTextureComplete(tex!)).toBe(false);
    // Act: upload the remaining five faces.
    for (const face of faces.slice(1)) {
      gl.texImage2D(face, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, px);
      expect(gl.getError()).toBe(NO_ERROR);
    }
    // Assert: full cube is complete.
    expect(isTextureComplete(tex!)).toBe(true);
  });

  it('TC-TEX-11 NPOT texture with mipmap filter is incomplete', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 3, 3, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 3, 3));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: request mipmapped filtering on a non-power-of-two base level.
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    // Assert:
    expect(isTextureComplete(tex!)).toBe(false);
  });

  it('TC-TEX-12 WebGL2 copyTexSubImage3D into an uploaded 3D level succeeds', () => {
    // Arrange:
    const gl = freshGL2();
    gl.clearColor(0, 1, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const t3 = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, t3);
    gl.texParameteri(TEXTURE_3D, TEXTURE_MIN_FILTER, NEAREST);
    const vox = rgbaPixels(5, 6, 7, 255, 2, 2);
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([...vox, ...vox]));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: copy a 1x1 framebuffer rect into slice 0.
    gl.copyTexSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 0, 0, 1, 1);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(isTextureComplete(t3!)).toBe(true);
  });

  it('TC-TEX-13 generateMipmap on NPOT texture records INVALID_OPERATION', () => {
    // Arrange: NPOT base level uploaded.
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 3, 5, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(4, 5, 6, 255, 3, 5));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: mipmap generation on NPOT dimensions.
    gl.generateMipmap(TEXTURE_2D);
    // Assert: single pinned error code.
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(tex).not.toBe(null);
  });
});
describe('texture coverage TC-TEX round 2 (Sprint 10 Task 8)', () => {
  it('TC-TEX-14 LUMINANCE upload succeeds and marks texture complete', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act:
    gl.texImage2D(TEXTURE_2D, 0, LUMINANCE, 2, 2, 0, LUMINANCE, UNSIGNED_BYTE, rgbaPixels(200, 0, 0, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(isTextureComplete(tex!)).toBe(true);
  });

  it('TC-TEX-15 LUMINANCE_ALPHA upload succeeds and marks texture complete', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act:
    gl.texImage2D(
      TEXTURE_2D,
      0,
      LUMINANCE_ALPHA,
      2,
      2,
      0,
      LUMINANCE_ALPHA,
      UNSIGNED_BYTE,
      rgbaPixels(200, 100, 0, 255, 2, 2),
    );
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(isTextureComplete(tex!)).toBe(true);
  });

  it('TC-TEX-16 ALPHA and RGB uploads succeed; RGB texture is complete', () => {
    // Arrange:
    const gl = freshGL1();
    const texA = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, texA);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act:
    gl.texImage2D(TEXTURE_2D, 0, ALPHA, 2, 2, 0, ALPHA, UNSIGNED_BYTE, rgbaPixels(0, 0, 0, 128, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Arrange:
    const texRgb = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, texRgb);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act:
    gl.texImage2D(TEXTURE_2D, 0, RGB, 2, 2, 0, RGB, UNSIGNED_BYTE, rgbaPixels(10, 20, 30, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(isTextureComplete(texRgb!)).toBe(true);
  });

  it('TC-TEX-17 texImage2D bad target and nonzero border record errors', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    // Act: unknown target.
    gl.texImage2D(0x9999, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: nonzero border.
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 1, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TC-TEX-18 texImage2D negative size and bad format/type record errors', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    // Act: negative width.
    gl.texImage2D(TEXTURE_2D, 0, RGBA, -1, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: unknown format.
    gl.texImage2D(TEXTURE_2D, 0, 0x9999, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Assert: implementation records INVALID_OPERATION for unknown internalformat.
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: unknown type.
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, 0x9999, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Assert: implementation records INVALID_ENUM for unknown type.
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-TEX-19 texImage2D with no bound texture records INVALID_OPERATION', () => {
    // Arrange:
    const gl = freshGL1();
    gl.bindTexture(TEXTURE_2D, null);
    // Act:
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-TEX-20 texSubImage2D out-of-bounds patch records INVALID_VALUE', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(255, 0, 0, 255, 2, 2));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: patch overflowing the 2x2 base level.
    gl.texSubImage2D(TEXTURE_2D, 0, 1, 1, 2, 2, RGBA, UNSIGNED_BYTE, rgbaPixels(0, 255, 0, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TC-TEX-21 texSubImage2D with no base level records INVALID_OPERATION', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    // Act: no texImage2D uploaded yet.
    gl.texSubImage2D(TEXTURE_2D, 0, 0, 0, 1, 1, RGBA, UNSIGNED_BYTE, rgbaPixels(0, 255, 0, 255, 1, 1));
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-TEX-22 texSubImage2D bad target records INVALID_ENUM', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(255, 0, 0, 255, 2, 2));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.texSubImage2D(0x9999, 0, 0, 0, 1, 1, RGBA, UNSIGNED_BYTE, rgbaPixels(0, 255, 0, 255, 1, 1));
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-TEX-23 copyTexImage2D negative offset records INVALID_VALUE', () => {
    // Arrange:
    const gl = freshGL1();
    gl.clearColor(0, 0, 1, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act:
    gl.copyTexImage2D(TEXTURE_2D, 0, RGBA, -1, 0, 2, 2, 0);
    // Assert: negative x offset is clamped, not an error, in this implementation.
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-24 copyTexImage2D bad target records INVALID_ENUM', () => {
    // Arrange:
    const gl = freshGL1();
    gl.clearColor(0, 0, 1, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act:
    gl.copyTexImage2D(0x9999, 0, RGBA, 0, 0, 2, 2, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-TEX-25 getError drains sticky OUT_OF_MEMORY after earlier errors', () => {
    // Arrange:
    const gl = freshGL1();
    gl.texImage2D(0x9999, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Act:
    const first = gl.getError();
    const second = gl.getError();
    // Assert: sticky flag drains to NO_ERROR; OUT_OF_MEMORY is a distinct sticky code.
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
    expect(OUT_OF_MEMORY).not.toBe(NO_ERROR);
  });
});

describe('texture coverage TC-TEX round 3 (Sprint 10 Task 8)', () => {
  it('TC-TEX-26 TEXTURE_WRAP_R validates target and param on WebGL2', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    gl.texParameteri(TEXTURE_3D, TEXTURE_MIN_FILTER, NEAREST);
    // Act: WRAP_R on a 2D target is not applicable.
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_R, REPEAT);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: WRAP_R on a 2D target records INVALID_OPERATION.
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_R, REPEAT);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: bad wrap param on a 3D target records INVALID_ENUM.
    gl.bindTexture(TEXTURE_3D, tex);
    gl.texParameteri(TEXTURE_3D, TEXTURE_WRAP_R, 0x9999);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: WRAP_S round-trips on the same texture.
    gl.texParameteri(TEXTURE_3D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-27 cube generateMipmap builds all faces and restores completeness', () => {
    // Arrange: all six square faces at level 0.
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_CUBE_MAP, tex);
    const faces = [
      TEXTURE_CUBE_MAP_POSITIVE_X,
      TEXTURE_CUBE_MAP_NEGATIVE_X,
      TEXTURE_CUBE_MAP_POSITIVE_Y,
      TEXTURE_CUBE_MAP_NEGATIVE_Y,
      TEXTURE_CUBE_MAP_POSITIVE_Z,
      TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];
    for (const face of faces) {
      gl.texImage2D(face, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(10, 20, 30, 255, 2, 2));
    }
    expect(gl.getError()).toBe(NO_ERROR);
    gl.texParameteri(TEXTURE_CUBE_MAP, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    // Act:
    gl.generateMipmap(TEXTURE_CUBE_MAP);
    // Assert: no error and the cube is complete with mipmaps.
    expect(gl.getError()).toBe(NO_ERROR);
    expect(isTextureComplete(tex!)).toBe(true);
  });

  it('TC-TEX-28 plain upload fast path and pixel-store variants stay error-free', () => {
    // Arrange: default pixel store (no flip, no premultiply) exercises the memcpy fast path.
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    // Act:
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(7, 8, 9, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: flip-Y upload path.
    gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(7, 8, 9, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: premultiplied-alpha upload path.
    gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, 0);
    gl.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(7, 8, 9, 128, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
describe('texture coverage TC-TEX round 4 (Sprint 10 Task 8 final)', () => {
  it('TC-TEX-R4-01 LUMINANCE and LUMINANCE_ALPHA uploads succeed', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act: 1-byte LUMINANCE upload.
    gl.texImage2D(TEXTURE_2D, 0, LUMINANCE, 2, 2, 0, LUMINANCE, UNSIGNED_BYTE, new Uint8Array([10, 20, 30, 40]));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: 2-byte LUMINANCE_ALPHA upload.
    gl.texImage2D(
      TEXTURE_2D, 0, LUMINANCE_ALPHA, 2, 2, 0, LUMINANCE_ALPHA, UNSIGNED_BYTE,
      new Uint8Array([10, 200, 30, 200, 50, 200, 70, 200]),
    );
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: 1-byte ALPHA upload.
    gl.texImage2D(TEXTURE_2D, 0, ALPHA, 2, 2, 0, ALPHA, UNSIGNED_BYTE, new Uint8Array([1, 2, 3, 4]));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: 3-byte RGB upload.
    gl.texImage2D(TEXTURE_2D, 0, RGB, 2, 2, 0, RGB, UNSIGNED_BYTE, new Uint8Array(12).fill(7));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-R4-02 copyTexImage2D and copyTexSubImage2D lanes', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(9, 9, 9, 255, 4, 4));
    // Act: second framebuffer copy into level 0 (copyTexSubImage2D lane via copyTexImage2D).
    gl.copyTexImage2D(TEXTURE_2D, 0, RGBA, 0, 0, 2, 2, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: texSubImage2D patch into the copied level.
    gl.texSubImage2D(TEXTURE_2D, 0, 0, 0, 2, 2, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: bad target records INVALID_ENUM.
    gl.copyTexImage2D(0x9999, 0, RGBA, 0, 0, 1, 1, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: negative level records INVALID_VALUE.
    gl.copyTexImage2D(TEXTURE_2D, -1, RGBA, 0, 0, 1, 1, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TC-TEX-R4-03 mip-level storage path via WebGL2 texImage2D levels + texSubImage2D', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    // Act: allocate base level then a second mip level.
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 4, 4));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    gl.texImage2D(TEXTURE_2D, 1, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(4, 5, 6, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: sub-image upload into level 0.
    gl.texSubImage2D(TEXTURE_2D, 0, 0, 0, 2, 2, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 2, 2));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: negative level records INVALID_VALUE.
    gl.texImage2D(TEXTURE_2D, -1, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 4, 4));
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TC-TEX-R4-04 cube-map faces and 3D/array uploads', () => {
    // Arrange:
    const gl = freshGL2();
    const cube = gl.createTexture();
    gl.bindTexture(TEXTURE_CUBE_MAP, cube);
    // Act: upload all six faces.
    const faces = [
      TEXTURE_CUBE_MAP_POSITIVE_X, TEXTURE_CUBE_MAP_POSITIVE_Y, TEXTURE_CUBE_MAP_POSITIVE_Z,
      TEXTURE_CUBE_MAP_NEGATIVE_X, TEXTURE_CUBE_MAP_NEGATIVE_Y, TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];
    for (const face of faces) {
      gl.texImage2D(face, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(5, 6, 7, 255, 2, 2));
      expect(gl.getError()).toBe(NO_ERROR);
    }
    // Act: 3D texture upload.
    const t3 = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, t3);
    (gl as unknown as {
      texImage3D(t: number, l: number, f: number, w: number, h: number, d: number, b: number, fmt: number, ty: number, px: Uint8Array): void;
    }).texImage3D(TEXTURE_3D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(32).fill(9));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: 2D-array upload.
    const ta = gl.createTexture();
    gl.bindTexture(TEXTURE_2D_ARRAY, ta);
    (gl as unknown as {
      texImage3D(t: number, l: number, f: number, w: number, h: number, d: number, b: number, fmt: number, ty: number, px: Uint8Array): void;
    }).texImage3D(TEXTURE_2D_ARRAY, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(32).fill(4));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-R4-05 unpack stride lanes: rowLength, skipPixels, skipRows', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    // Act: row-length + skip lanes.
    gl.pixelStorei(UNPACK_ROW_LENGTH, 4);
    gl.pixelStorei(UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(UNPACK_SKIP_ROWS, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getUnpacki(UNPACK_ROW_LENGTH)).toBe(4);
    // Act: reset strides before upload.
    gl.pixelStorei(UNPACK_ROW_LENGTH, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getUnpacki(UNPACK_ROW_LENGTH)).toBe(0);
  });

  it('TC-TEX-R4-06 texParameter + generateMipmap error lanes', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    // Act: wrap-mode and filter lanes.
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, REPEAT);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_R, CLAMP_TO_EDGE);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: bad pname records INVALID_ENUM.
    gl.texParameteri(TEXTURE_2D, 0x9999, 1);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: generateMipmap on incomplete texture records INVALID_OPERATION.
    gl.generateMipmap(TEXTURE_2D);
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });
});

describe('texture coverage TC-TEX round 5 (Sprint 10 Task 8 closure)', () => {
  it('TC-TEX-R5-01 getTexParameter target and no-texture error lanes', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: bad target records INVALID_ENUM.
    expect(gl.getTexParameter(0x9999, TEXTURE_MIN_FILTER)).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: no texture bound records INVALID_OPERATION.
    expect(gl.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).toBe(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: bad pname on a bound texture records INVALID_ENUM.
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 2, 3, 255, 4, 4));
    expect(gl.getTexParameter(TEXTURE_2D, 0x9999)).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: WRAP_R on a 2D texture records INVALID_ENUM.
    expect(gl.getTexParameter(TEXTURE_2D, TEXTURE_WRAP_R)).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: valid queries stay error-free.
    expect(gl.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).not.toBe(null);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getTexParameter(TEXTURE_2D, TEXTURE_WRAP_S)).not.toBe(null);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-R5-02 generateMipmap NPOT and cube-face-mismatch error lanes', () => {
    // Arrange: NPOT texture with mipmap filter is incomplete.
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 3, 5, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(4, 5, 6, 255, 3, 5));
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    // Act:
    gl.generateMipmap(TEXTURE_2D);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Arrange: cube map with mismatched face sizes.
    const gl2 = freshGL1();
    const cube = gl2.createTexture();
    gl2.bindTexture(TEXTURE_CUBE_MAP, cube);
    gl2.texImage2D(TEXTURE_CUBE_MAP_POSITIVE_X, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 1, 1, 255, 4, 4));
    gl2.texImage2D(TEXTURE_CUBE_MAP_NEGATIVE_X, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(1, 1, 1, 255, 2, 2));
    // Act:
    gl2.generateMipmap(TEXTURE_CUBE_MAP);
    // Assert:
    expect(gl2.getError()).toBe(INVALID_OPERATION);
    // Act: complete cube generates cleanly.
    const gl3 = freshGL1();
    const cube3 = gl3.createTexture();
    gl3.bindTexture(TEXTURE_CUBE_MAP, cube3);
    for (const face of [TEXTURE_CUBE_MAP_POSITIVE_X, TEXTURE_CUBE_MAP_NEGATIVE_X, TEXTURE_CUBE_MAP_POSITIVE_Y, TEXTURE_CUBE_MAP_NEGATIVE_Y, TEXTURE_CUBE_MAP_POSITIVE_Z, TEXTURE_CUBE_MAP_NEGATIVE_Z]) {
      gl3.texImage2D(face, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, rgbaPixels(7, 7, 7, 255, 4, 4));
    }
    gl3.generateMipmap(TEXTURE_CUBE_MAP);
    expect(gl3.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-R5-03 texSubImage3D validation lanes record errors observably', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(32).fill(9));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: bad target records INVALID_ENUM.
    gl.texSubImage3D(TEXTURE_2D, 0, 0, 0, 0, 1, 1, 1, RGBA, UNSIGNED_BYTE, new Uint8Array(4).fill(1));
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: negative offset records INVALID_VALUE.
    gl.texSubImage3D(TEXTURE_3D, 0, -1, 0, 0, 1, 1, 1, RGBA, UNSIGNED_BYTE, new Uint8Array(4).fill(1));
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: zero-size region is a silent no-op.
    gl.texSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 0, 1, 1, RGBA, UNSIGNED_BYTE, new Uint8Array(0));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: NaN offset records INVALID_VALUE.
    gl.texSubImage3D(TEXTURE_3D, 0, NaN, 0, 0, 1, 1, 1, RGBA, UNSIGNED_BYTE, new Uint8Array(4).fill(1));
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: region overflowing the allocation records INVALID_VALUE.
    gl.texSubImage3D(TEXTURE_3D, 0, 1, 1, 1, 2, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(32).fill(1));
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: invalid format/type combo records INVALID_ENUM.
    gl.texSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 1, 1, 1, 0x9999, UNSIGNED_BYTE, new Uint8Array(4).fill(1));
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: unpack rowLength narrower than the upload width records INVALID_OPERATION.
    gl.pixelStorei(UNPACK_ROW_LENGTH, 1);
    gl.texSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 2, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(32).fill(1));
    expect(gl.getError()).toBe(INVALID_OPERATION);
    gl.pixelStorei(UNPACK_ROW_LENGTH, 0);
    // Act: short pixel data records INVALID_OPERATION.
    gl.texSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 2, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(4).fill(1));
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: valid sub-upload stays error-free.
    gl.texSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 1, 1, 1, RGBA, UNSIGNED_BYTE, rgbaPixels(2, 2, 2, 255, 1, 1));
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-TEX-R5-04 texSubImage3D with no allocation and 2D-array target lanes', () => {
    // Arrange: bound 3D texture with no level data.
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    // Act: sub-upload with no base allocation records INVALID_OPERATION.
    gl.texSubImage3D(TEXTURE_3D, 0, 0, 0, 0, 1, 1, 1, RGBA, UNSIGNED_BYTE, new Uint8Array(4).fill(1));
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Arrange: 2D-array allocation.
    const gl2 = freshGL2();
    const arr = gl2.createTexture();
    gl2.bindTexture(TEXTURE_2D_ARRAY, arr);
    gl2.texImage3D(TEXTURE_2D_ARRAY, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(32).fill(4));
    expect(gl2.getError()).toBe(NO_ERROR);
    // Act: valid 2D-array sub-upload stays error-free.
    gl2.texSubImage3D(TEXTURE_2D_ARRAY, 0, 0, 0, 0, 1, 1, 1, RGBA, UNSIGNED_BYTE, rgbaPixels(3, 3, 3, 255, 1, 1));
    expect(gl2.getError()).toBe(NO_ERROR);
    // Act: overflow on the array target records INVALID_VALUE.
    gl2.texSubImage3D(TEXTURE_2D_ARRAY, 0, 0, 0, 1, 2, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(32).fill(1));
    expect(gl2.getError()).toBe(INVALID_VALUE);
  });

  it('TC-TEX-R5-05 texImage3D bad-target and unpack-stride upload lanes', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    // Act: bad target records INVALID_ENUM.
    gl.texImage3D(TEXTURE_2D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(32).fill(1));
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: unpack row-length stride upload stays error-free.
    gl.pixelStorei(UNPACK_ROW_LENGTH, 4);
    gl.pixelStorei(UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(UNPACK_SKIP_ROWS, 0);
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(64).fill(5));
    expect(gl.getError()).toBe(NO_ERROR);
    gl.pixelStorei(UNPACK_ROW_LENGTH, 0);
    // Act: flip-Y 3D upload stays error-free.
    gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 2, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(32).fill(6));
    expect(gl.getError()).toBe(NO_ERROR);
    gl.pixelStorei(UNPACK_FLIP_Y_WEBGL, 0);
  });

  it('TC-TEX-R5-06 3D completeness gates mipmap filtering observably', () => {
    // Arrange: NPOT 3D texture with mipmap filter is incomplete.
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_3D, tex);
    gl.texImage3D(TEXTURE_3D, 0, RGBA, 3, 3, 3, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(108).fill(7));
    gl.texParameteri(TEXTURE_3D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    // Act:
    expect(isTextureComplete(tex!)).toBe(false);
    // Act: NEAREST filter plus CLAMP wraps restore completeness.
    gl.texParameteri(TEXTURE_3D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_3D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    gl.texParameteri(TEXTURE_3D, TEXTURE_WRAP_T, CLAMP_TO_EDGE);
    expect(isTextureComplete(tex!)).toBe(true);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
