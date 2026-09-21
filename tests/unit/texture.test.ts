/** TextureManager unit tests (Sprint 6 Task 1 red phase) — WebGL 1.0 texture lifecycle, binding, image spec, subimage, copy, sampler params. */
import { describe, expect, it } from 'vitest';
import { ErrorSink } from '../../src/gl/errors';
import { GLState } from '../../src/gl/state';
import { TextureManager } from '../../src/gl/texture';
import { DrawingBuffer } from '../../src/gl/framebuffer';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ALPHA,
  ARRAY_BUFFER,
  CLAMP_TO_EDGE,
  COLOR_BUFFER_BIT,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST,
  LUMINANCE,
  LUMINANCE_ALPHA,
  MIRRORED_REPEAT,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
  NO_ERROR,
  OUT_OF_MEMORY,
  REPEAT,
  RGB,
  RGBA,
  TEXTURE0,
  TEXTURE1,
  TEXTURE_2D,
  TEXTURE_CUBE_MAP,
  TEXTURE_CUBE_MAP_NEGATIVE_X,
  TEXTURE_CUBE_MAP_NEGATIVE_Y,
  TEXTURE_CUBE_MAP_NEGATIVE_Z,
  TEXTURE_CUBE_MAP_POSITIVE_X,
  TEXTURE_CUBE_MAP_POSITIVE_Y,
  TEXTURE_CUBE_MAP_POSITIVE_Z,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  UNSIGNED_BYTE,
  UNSIGNED_SHORT_4_4_4_4,
  UNSIGNED_SHORT_5_5_5_1,
  UNSIGNED_SHORT_5_6_5,
  UNPACK_COLORSPACE_CONVERSION_WEBGL,
  UNPACK_FLIP_Y_WEBGL,
  UNPACK_PREMULTIPLY_ALPHA_WEBGL,
  BROWSER_DEFAULT_WEBGL,
  ZERO,
} from '../../src/gl/constants';
import type { GLenum } from '../../src/gl/constants';

describe('Texture lifecycle and target binding', () => {
  it('lifecycle: creation, identity, and unbind on delete across units (AC-4)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    // Act:
    const t1 = mgr.createTexture();
    const t2 = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, t1);
    mgr.setActiveTexture(TEXTURE1);
    mgr.bindTexture(TEXTURE_2D, t1);
    const isT1LiveBefore = mgr.isTexture(t1);
    mgr.deleteTexture(t1);
    const isT1LiveAfter = mgr.isTexture(t1);
    mgr.setActiveTexture(TEXTURE0);
    const boundT0 = mgr.getBoundTexture(TEXTURE_2D);
    mgr.setActiveTexture(TEXTURE1);
    const boundT1 = mgr.getBoundTexture(TEXTURE_2D);
    mgr.setActiveTexture(TEXTURE0);
    mgr.bindTexture(TEXTURE_2D, t1);
    const errOnRebind = errorSink.getError();
    // Assert:
    expect(t1!.id).not.toBe(t2!.id);
    expect(isT1LiveBefore).toBe(true);
    expect(isT1LiveAfter).toBe(false);
    expect(boundT0).toBeNull();
    expect(boundT1).toBeNull();
    expect(errOnRebind).toBe(INVALID_OPERATION);
  });

  it('bindTexture binds TEXTURE_2D and TEXTURE_CUBE_MAP and unbinds with null', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const t2d = mgr.createTexture();
    const tcube = mgr.createTexture();
    // Act & Assert:
    mgr.bindTexture(TEXTURE_2D, t2d);
    expect(mgr.getBoundTexture(TEXTURE_2D)).toBe(t2d);
    mgr.bindTexture(TEXTURE_CUBE_MAP, tcube);
    expect(mgr.getBoundTexture(TEXTURE_CUBE_MAP)).toBe(tcube);
    mgr.bindTexture(TEXTURE_2D, null);
    expect(mgr.getBoundTexture(TEXTURE_2D)).toBeNull();
    expect(errorSink.getError()).toBe(NO_ERROR);
  });

  it('bindTexture with non-texture target records INVALID_ENUM (AC-6)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    // Act:
    mgr.bindTexture(ARRAY_BUFFER, tex);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_ENUM);
    expect(mgr.getBoundTexture(TEXTURE_2D)).toBeNull();
  });

  it('binding a deleted texture records INVALID_OPERATION', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.deleteTexture(tex);
    // Act:
    mgr.bindTexture(TEXTURE_2D, tex);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_OPERATION);
    expect(mgr.getBoundTexture(TEXTURE_2D)).toBeNull();
  });

  it('isTexture handles foreign objects and primitives gracefully', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    // Act & Assert:
    expect(mgr.isTexture(null)).toBe(false);
    expect(mgr.isTexture(undefined)).toBe(false);
    expect(mgr.isTexture({})).toBe(false);
    expect(mgr.isTexture({ id: 999, alive: true })).toBe(false);
    expect(errorSink.getError()).toBe(NO_ERROR);
  });
});

describe('Image specification and validation (texImage2D)', () => {
  it('texImage2D 4x4 RGBA array stores dimensions and default filter (AC-1)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    const pixels = new Uint8Array(4 * 4 * 4).fill(128);
    // Act:
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, pixels);
    const minFilter = mgr.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER);
    const magFilter = mgr.getTexParameter(TEXTURE_2D, TEXTURE_MAG_FILTER);
    const wrapS = mgr.getTexParameter(TEXTURE_2D, TEXTURE_WRAP_S);
    const wrapT = mgr.getTexParameter(TEXTURE_2D, TEXTURE_WRAP_T);
    const level0 = tex!.levels2D.get(0)!;
    const err = errorSink.getError();
    // Assert:
    expect(err).toBe(NO_ERROR);
    expect(level0.width).toBe(4);
    expect(level0.height).toBe(4);
    expect(level0.data[0]).toBe(128);
    expect(minFilter).toBe(NEAREST_MIPMAP_LINEAR);
    expect(magFilter).toBe(LINEAR);
    expect(wrapS).toBe(REPEAT);
    expect(wrapT).toBe(REPEAT);
    expect(tex!.isNPOT).toBe(false);
  });

  it('texImage2D border non-zero records INVALID_OPERATION and retains storage (AC-2)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 1, 1, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([10, 20, 30, 40]));
    // Act:
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 1, RGBA, UNSIGNED_BYTE, null);
    const recordedError = errorSink.getError();
    const level0 = tex!.levels2D.get(0)!;
    // Assert:
    expect(recordedError).toBe(INVALID_OPERATION);
    expect(level0.width).toBe(1);
    expect(level0.height).toBe(1);
    expect(level0.data[0]).toBe(10);
  });

  it('texImage2D exceeding 256MB guard records OUT_OF_MEMORY (AC-3)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 1, 1, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([1, 2, 3, 4]));
    // Act:
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 16384, 16384, 0, RGBA, UNSIGNED_BYTE, null);
    const recordedError = errorSink.getError();
    const level0 = tex!.levels2D.get(0)!;
    // Assert:
    expect(recordedError).toBe(OUT_OF_MEMORY);
    expect(level0.width).toBe(1);
    expect(level0.height).toBe(1);
    expect(level0.data[0]).toBe(1);
  });

  it('texImage2D negative dimensions record INVALID_VALUE', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    // Act:
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, -1, 4, 0, RGBA, UNSIGNED_BYTE, null);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_VALUE);
    expect(tex!.levels2D.has(0)).toBe(false);
  });

  it('texImage2D format != internalformat records INVALID_OPERATION', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    // Act:
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGB, UNSIGNED_BYTE, null);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_OPERATION);
    expect(tex!.levels2D.has(0)).toBe(false);
  });

  it('texImage2D invalid format/type combination records INVALID_OPERATION', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    // Act:
    mgr.texImage2D(TEXTURE_2D, 0, RGB, 2, 2, 0, RGB, UNSIGNED_SHORT_4_4_4_4, null);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_OPERATION);
    expect(tex!.levels2D.has(0)).toBe(false);
  });

  it('texImage2D valid packed format/type pairs upload without error', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    // Act & Assert:
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_SHORT_5_5_5_1, new Uint8Array(2 * 2 * 2));
    expect(errorSink.getError()).toBe(NO_ERROR);
    mgr.texImage2D(TEXTURE_2D, 0, RGB, 2, 2, 0, RGB, UNSIGNED_SHORT_5_6_5, new Uint8Array(2 * 2 * 2));
    expect(errorSink.getError()).toBe(NO_ERROR);
    mgr.texImage2D(TEXTURE_2D, 0, LUMINANCE_ALPHA, 2, 2, 0, LUMINANCE_ALPHA, UNSIGNED_BYTE, new Uint8Array(2 * 2 * 2));
    expect(errorSink.getError()).toBe(NO_ERROR);
    mgr.texImage2D(TEXTURE_2D, 0, ALPHA, 2, 2, 0, ALPHA, UNSIGNED_BYTE, new Uint8Array(2 * 2));
    expect(errorSink.getError()).toBe(NO_ERROR);
    mgr.texImage2D(TEXTURE_2D, 0, LUMINANCE, 2, 2, 0, LUMINANCE, UNSIGNED_BYTE, new Uint8Array(2 * 2));
    expect(errorSink.getError()).toBe(NO_ERROR);
    void UNSIGNED_SHORT_4_4_4_4;
  });

  it('texImage2D dimension-only overload allocates zero-initialized storage', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    // Act:
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, null);
    // Assert:
    expect(errorSink.getError()).toBe(NO_ERROR);
    const level0 = tex!.levels2D.get(0)!;
    expect(level0.width).toBe(2);
    expect(level0.data.every((b) => b === 0)).toBe(true);
  });

  it('texImage2D cube face uploads into levelsCube', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_CUBE_MAP, tex);
    // Act:
    mgr.texImage2D(TEXTURE_CUBE_MAP_POSITIVE_X, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(2 * 2 * 4).fill(7));
    // Assert:
    expect(errorSink.getError()).toBe(NO_ERROR);
    const face = tex!.levelsCube.get(TEXTURE_CUBE_MAP_POSITIVE_X)!.get(0)!;
    expect(face.width).toBe(2);
    expect(face.data[0]).toBe(7);
    void TEXTURE_CUBE_MAP_NEGATIVE_X;
    void TEXTURE_CUBE_MAP_POSITIVE_Y;
    void TEXTURE_CUBE_MAP_NEGATIVE_Y;
    void TEXTURE_CUBE_MAP_POSITIVE_Z;
    void TEXTURE_CUBE_MAP_NEGATIVE_Z;
  });
});

describe('Sub-image updates and bounds checking (texSubImage2D)', () => {
  it('texSubImage2D out-of-bounds records INVALID_VALUE with zero mutation (AC-5)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(4 * 4 * 4).fill(50));
    const updateData = new Uint8Array(3 * 3 * 4).fill(255);
    // Act:
    mgr.texSubImage2D(TEXTURE_2D, 0, 2, 2, 3, 3, RGBA, UNSIGNED_BYTE, updateData);
    const recordedError = errorSink.getError();
    const levelData = tex!.levels2D.get(0)!.data;
    // Assert:
    expect(recordedError).toBe(INVALID_VALUE);
    expect(Array.from(levelData).every((b) => b === 50)).toBe(true);
  });

  it('texSubImage2D valid sub-rectangle updates only targeted texels', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(4 * 4 * 4).fill(50));
    // Act:
    mgr.texSubImage2D(TEXTURE_2D, 0, 0, 0, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(2 * 2 * 4).fill(255));
    // Assert:
    expect(errorSink.getError()).toBe(NO_ERROR);
    const data = tex!.levels2D.get(0)!.data;
    expect(data[0]).toBe(255);
    expect(data[(3 * 4 + 3) * 4]).toBe(50);
  });

  it('texSubImage2D negative offsets record INVALID_VALUE', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(4 * 4 * 4).fill(50));
    // Act:
    mgr.texSubImage2D(TEXTURE_2D, 0, -1, 0, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(2 * 2 * 4));
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_VALUE);
  });

  it('texSubImage2D format/type mismatch records INVALID_OPERATION', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    mgr.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(4 * 4 * 4).fill(50));
    // Act:
    mgr.texSubImage2D(TEXTURE_2D, 0, 0, 0, 2, 2, RGB, UNSIGNED_BYTE, new Uint8Array(2 * 2 * 3));
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_OPERATION);
  });
});

describe('Copy tex image (copyTexImage2D)', () => {
  it('copyTexImage2D copies drawing buffer with validation (AC-9)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const drawingBuffer = new DrawingBuffer(errorSink, { width: 4, height: 4 });
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    // Act:
    mgr.copyTexImage2D(TEXTURE_2D, 0, RGBA, 0, 0, 4, 4, 0, drawingBuffer);
    const level0 = tex!.levels2D.get(0)!;
    mgr.copyTexImage2D(TEXTURE_2D, 0, RGBA, 0, 0, 4, 4, 1, drawingBuffer);
    const borderError = errorSink.getError();
    // Assert:
    expect(level0.width).toBe(4);
    expect(level0.height).toBe(4);
    expect(level0.data.byteLength).toBe(64);
    expect(borderError).toBe(INVALID_OPERATION);
    void COLOR_BUFFER_BIT;
  });

  it('copyTexImage2D invalid internalformat records INVALID_ENUM', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const drawingBuffer = new DrawingBuffer(errorSink, { width: 4, height: 4 });
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    // Act:
    mgr.copyTexImage2D(TEXTURE_2D, 0, LUMINANCE as GLenum, 0, 0, 2, 2, 0, drawingBuffer);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_ENUM);
  });
});

describe('Sampler parameters and completeness invalidation', () => {
  it('texParameteri mutates sampler and invalidates completeness cache (AC-8)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    tex!.completeness = 1 as GLenum;
    // Act:
    mgr.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    const cachedCompleteness1 = tex!.completeness;
    tex!.completeness = 1 as GLenum;
    mgr.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR);
    const cachedCompleteness2 = tex!.completeness;
    mgr.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, 0x9999);
    const invalidEnumError = errorSink.getError();
    // Assert:
    expect(cachedCompleteness1).toBeNull();
    expect(cachedCompleteness2).toBeNull();
    expect(invalidEnumError).toBe(INVALID_ENUM);
    expect(mgr.getTexParameter(TEXTURE_2D, TEXTURE_WRAP_S)).toBe(CLAMP_TO_EDGE);
    expect(mgr.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).toBe(LINEAR);
  });

  it('texParameterf sets filter modes and getTexParameter roundtrips', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    // Act & Assert:
    mgr.texParameterf(TEXTURE_2D, TEXTURE_WRAP_T, MIRRORED_REPEAT);
    expect(mgr.getTexParameter(TEXTURE_2D, TEXTURE_WRAP_T)).toBe(MIRRORED_REPEAT);
    mgr.texParameterf(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    expect(mgr.getTexParameter(TEXTURE_2D, TEXTURE_MAG_FILTER)).toBe(NEAREST);
    mgr.texParameterf(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_NEAREST);
    expect(mgr.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).toBe(LINEAR_MIPMAP_NEAREST);
    mgr.texParameterf(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST_MIPMAP_NEAREST);
    expect(mgr.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).toBe(NEAREST_MIPMAP_NEAREST);
    mgr.texParameterf(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    expect(mgr.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).toBe(LINEAR_MIPMAP_LINEAR);
    expect(errorSink.getError()).toBe(NO_ERROR);
  });

  it('texParameteri invalid mag filter records INVALID_ENUM', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    const tex = mgr.createTexture();
    mgr.bindTexture(TEXTURE_2D, tex);
    // Act:
    mgr.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, LINEAR_MIPMAP_LINEAR);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_ENUM);
  });

  it('activeTexture out of range records INVALID_ENUM (AC-7)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new TextureManager(errorSink);
    // Act:
    mgr.setActiveTexture((TEXTURE0 + 32) as GLenum);
    const recordedError = errorSink.getError();
    const currentActive = mgr.getActiveTexture();
    // Assert:
    expect(recordedError).toBe(INVALID_ENUM);
    expect(currentActive).toBe(TEXTURE0);
  });
});

describe('WebGL1Context texture facade', () => {
  it('facade texture methods delegate to manager with sticky errors', () => {
    // Arrange:
    const ctx = new WebGL1Context();
    // Act:
    const tex = ctx.createTexture();
    const isTex = ctx.isTexture(tex);
    ctx.bindTexture(TEXTURE_2D, tex);
    ctx.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, null);
    ctx.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    const minF = ctx.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER);
    ctx.deleteTexture(tex);
    const isTexAfter = ctx.isTexture(tex);
    const err = ctx.getError();
    // Assert:
    expect(isTex).toBe(true);
    expect(minF).toBe(NEAREST);
    expect(isTexAfter).toBe(false);
    expect(err).toBe(NO_ERROR);
  });
});

describe('Sprint 6 pixel unpack flags', () => {
  it('TC1: UNPACK_FLIP_Y_WEBGL vertically inverts uploaded rows in texImage2D', () => {
    // Arrange:
    const ctx = new WebGL1Context();
    const tex = ctx.createTexture();
    ctx.bindTexture(TEXTURE_2D, tex);
    const srcData = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
    (ctx as unknown as { pixelStorei: (p: number, v: unknown) => void }).pixelStorei(UNPACK_FLIP_Y_WEBGL, true);
    // Act:
    ctx.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, srcData);
    // Assert:
    const data = tex!.levels2D.get(0)!.data;
    expect(Array.from(data.slice(0, 8))).toEqual([0, 0, 255, 255, 255, 255, 0, 255]);
    expect(Array.from(data.slice(8, 16))).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('TC2: UNPACK_PREMULTIPLY_ALPHA_WEBGL premultiplies RGB by alpha in texImage2D', () => {
    // Arrange:
    const ctx = new WebGL1Context();
    const tex = ctx.createTexture();
    ctx.bindTexture(TEXTURE_2D, tex);
    const srcData = new Uint8Array([200, 100, 50, 128, 255, 255, 255, 0]);
    (ctx as unknown as { pixelStorei: (p: number, v: unknown) => void }).pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    // Act:
    ctx.texImage2D(TEXTURE_2D, 0, RGBA, 2, 1, 0, RGBA, UNSIGNED_BYTE, srcData);
    // Assert:
    const data = tex!.levels2D.get(0)!.data;
    expect(Array.from(data.slice(0, 4))).toEqual([100, 50, 25, 128]);
    expect(Array.from(data.slice(4, 8))).toEqual([0, 0, 0, 0]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('TC3: UNPACK_COLORSPACE_CONVERSION_WEBGL validates supported enums and rejects unsupported', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const st = new GLState(errorSink, { width: 300, height: 150 });
    // Act & Assert: default round-trips BROWSER_DEFAULT_WEBGL
    expect(st.getPixelStorei(UNPACK_COLORSPACE_CONVERSION_WEBGL)).toBe(BROWSER_DEFAULT_WEBGL);
    st.setPixelStorei(UNPACK_COLORSPACE_CONVERSION_WEBGL, ZERO);
    expect(errorSink.getError()).toBe(NO_ERROR);
    expect(st.getPixelStorei(UNPACK_COLORSPACE_CONVERSION_WEBGL)).toBe(ZERO);
    st.setPixelStorei(UNPACK_COLORSPACE_CONVERSION_WEBGL, BROWSER_DEFAULT_WEBGL);
    expect(errorSink.getError()).toBe(NO_ERROR);
    expect(st.getPixelStorei(UNPACK_COLORSPACE_CONVERSION_WEBGL)).toBe(BROWSER_DEFAULT_WEBGL);
    st.setPixelStorei(UNPACK_COLORSPACE_CONVERSION_WEBGL, 0x9999);
    expect(errorSink.getError()).toBe(INVALID_VALUE);
    expect(st.getPixelStorei(UNPACK_COLORSPACE_CONVERSION_WEBGL)).toBe(BROWSER_DEFAULT_WEBGL);
    // Facade wiring: pixelStorei exposed on context
    const ctx = new WebGL1Context() as unknown as { pixelStorei: (p: number, v: unknown) => void };
    expect(typeof ctx.pixelStorei).toBe('function');
  });

  it('TC4: default unpack flags preserve byte-identical pixel storage', () => {
    // Arrange:
    const ctx = new WebGL1Context();
    const tex = ctx.createTexture();
    ctx.bindTexture(TEXTURE_2D, tex);
    const srcData = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160]);
    // Act:
    ctx.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, srcData);
    // Assert:
    const data = tex!.levels2D.get(0)!.data;
    expect(Array.from(data)).toEqual(Array.from(srcData));
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('TC5: combined UNPACK_FLIP_Y_WEBGL and UNPACK_PREMULTIPLY_ALPHA_WEBGL apply simultaneously', () => {
    // Arrange:
    const ctx = new WebGL1Context();
    const tex = ctx.createTexture();
    ctx.bindTexture(TEXTURE_2D, tex);
    const anyCtx = ctx as unknown as { pixelStorei: (p: number, v: unknown) => void };
    anyCtx.pixelStorei(UNPACK_FLIP_Y_WEBGL, true);
    anyCtx.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const srcData = new Uint8Array([200, 200, 200, 128, 100, 100, 100, 255, 50, 50, 50, 0, 255, 0, 128, 64]);
    // Act:
    ctx.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, srcData);
    // Assert:
    const data = tex!.levels2D.get(0)!.data;
    expect(Array.from(data.slice(0, 8))).toEqual([0, 0, 0, 0, 64, 0, 32, 64]);
    expect(Array.from(data.slice(8, 16))).toEqual([100, 100, 100, 128, 100, 100, 100, 255]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('TC6: texSubImage2D with UNPACK_FLIP_Y_WEBGL flips only sub-image rows', () => {
    // Arrange:
    const ctx = new WebGL1Context();
    const tex = ctx.createTexture();
    ctx.bindTexture(TEXTURE_2D, tex);
    const base = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i++) base.set([128, 128, 128, 255], i * 4);
    ctx.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, base);
    (ctx as unknown as { pixelStorei: (p: number, v: unknown) => void }).pixelStorei(UNPACK_FLIP_Y_WEBGL, true);
    const patch = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
    // Act:
    ctx.texSubImage2D(TEXTURE_2D, 0, 1, 1, 2, 2, RGBA, UNSIGNED_BYTE, patch);
    // Assert:
    const data = tex!.levels2D.get(0)!.data;
    const texel = (x: number, y: number): number[] => Array.from(data.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
    expect(texel(0, 0)).toEqual([128, 128, 128, 255]);
    expect(texel(0, 3)).toEqual([128, 128, 128, 255]);
    expect(texel(1, 1)).toEqual([0, 0, 255, 255]);
    expect(texel(2, 1)).toEqual([255, 255, 0, 255]);
    expect(texel(1, 2)).toEqual([255, 0, 0, 255]);
    expect(texel(2, 2)).toEqual([0, 255, 0, 255]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('TC7: UNPACK_PREMULTIPLY_ALPHA_WEBGL with LUMINANCE_ALPHA format', () => {
    // Arrange:
    const ctx = new WebGL1Context();
    const tex = ctx.createTexture();
    ctx.bindTexture(TEXTURE_2D, tex);
    (ctx as unknown as { pixelStorei: (p: number, v: unknown) => void }).pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const srcData = new Uint8Array([200, 128, 255, 0]);
    // Act:
    ctx.texImage2D(TEXTURE_2D, 0, LUMINANCE_ALPHA, 2, 1, 0, LUMINANCE_ALPHA, UNSIGNED_BYTE, srcData);
    // Assert:
    const data = tex!.levels2D.get(0)!.data;
    expect(Array.from(data)).toEqual([100, 128, 0, 0]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('TC8: transformUploadedPixels pure helper edge cases', async () => {
    // Arrange:
    const mod = (await import('../../src/gl/texture')) as unknown as Record<string, unknown>;
    // Act:
    const fn = mod['transformUploadedPixels'] as unknown;
    // Assert: helper must exist (red phase: missing export fails here)
    expect(typeof fn).toBe('function');
    const f = fn as (src: Uint8Array, w: number, h: number, fmt: number, ty: number, flip: boolean, prem: boolean) => Uint8Array;
    expect(Array.from(f(new Uint8Array([1, 2, 3, 10, 20, 30]), 2, 1, RGB, UNSIGNED_BYTE, true, false))).toEqual([1, 2, 3, 10, 20, 30]);
    expect(Array.from(f(new Uint8Array([200, 100, 50, 255]), 1, 1, RGBA, UNSIGNED_BYTE, false, true))).toEqual([200, 100, 50, 255]);
    expect(Array.from(f(new Uint8Array([200, 100, 50, 0]), 1, 1, RGBA, UNSIGNED_BYTE, false, true))).toEqual([0, 0, 0, 0]);
    expect(Array.from(f(new Uint8Array([10, 20, 30, 40, 50, 60]), 2, 1, RGB, UNSIGNED_BYTE, false, true))).toEqual([10, 20, 30, 40, 50, 60]);
  });
});
import {
  COMPILE_STATUS,
  FLOAT,
  FRAGMENT_SHADER,
  LINK_STATUS,
  STATIC_DRAW,
  TRIANGLES,
  VERTEX_SHADER,
} from '../../src/gl/constants';
import { createSoftwareWebGLContext } from '../../src/entry';

/** Sprint 6 Task 4 sampling integration TDD RED-phase tests — real TextureObject sampling through the full public API. Appended; lines 1-624 untouched. */
const S6_VS =
  'attribute vec2 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; ' +
  'void main() { v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }';
const S6_FS =
  'precision mediump float; varying vec2 v_texCoord; uniform sampler2D u_sampler; ' +
  'void main() { gl_FragColor = texture2D(u_sampler, v_texCoord); }';

function s6Context(w: number, h: number): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('s6Context: factory returned null');
  return gl;
}

function s6Link(gl: WebGL1Context, vsrc = S6_VS, fsrc = S6_FS): NonNullable<ReturnType<WebGL1Context['createProgram']>> {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('s6Link: shader creation failed');
  gl.shaderSource(vs, vsrc);
  gl.shaderSource(fs, fsrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('s6Link: VS failed: ' + gl.getShaderInfoLog(vs));
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('s6Link: FS failed: ' + gl.getShaderInfoLog(fs));
  const program = gl.createProgram();
  if (program === null) throw new Error('s6Link: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('s6Link: link failed: ' + gl.getProgramInfoLog(program));
  return program;
}

function s6FullQuad(gl: WebGL1Context, program: NonNullable<ReturnType<WebGL1Context['createProgram']>>): void {
  // Arrange helper: full-screen triangle with texcoords spanning [0..2] so every pixel is covered.
  const posBuf = gl.createBuffer();
  const texBuf = gl.createBuffer();
  if (posBuf === null || texBuf === null) throw new Error('s6FullQuad: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, posBuf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
  gl.bindBuffer(ARRAY_BUFFER, texBuf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), STATIC_DRAW);
  gl.useProgram(program);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  const texLoc = gl.getAttribLocation(program, 'a_texCoord');
  if (posLoc < 0 || texLoc < 0) throw new Error('s6FullQuad: attrib locations not found');
  gl.bindBuffer(ARRAY_BUFFER, posBuf);
  gl.vertexAttribPointer(posLoc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posLoc);
  gl.bindBuffer(ARRAY_BUFFER, texBuf);
  gl.vertexAttribPointer(texLoc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(texLoc);
  const samplerLoc = gl.getUniformLocation(program, 'u_sampler');
  if (samplerLoc === null) throw new Error('s6FullQuad: u_sampler location null');
  gl.uniform1i(samplerLoc, 0);
  if (gl.getError() !== NO_ERROR) throw new Error('s6FullQuad: setup errored');
}

describe('Sprint 6 Task 4 sampling integration (RED)', () => {
  it('Test 1 (AC-1): NEAREST exact-texel 2x2 sampling through full public API', () => {
    // Arrange:
    const gl = s6Context(2, 2);
    const program = s6Link(gl);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(
      TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE,
      new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]),
    );
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    s6FullQuad(gl, program);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = new Uint8Array(2 * 2 * 4);
    gl.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, pixels);
    // Assert: exact uploaded texel colors, no deviation.
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(pixels)).toEqual([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]);
  });

  it('Test 2 (AC-2): LINEAR midpoint averaging against analytic float32 value', () => {
    // Arrange:
    const gl = s6Context(1, 1);
    const program = s6Link(gl);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 1, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]));
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, LINEAR);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, CLAMP_TO_EDGE);
    s6FullQuad(gl, program);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, pixels);
    // Assert: float32 average 0.5*255 = 127.5 rounds to 127 or 128.
    expect(gl.getError()).toBe(NO_ERROR);
    expect([127, 128]).toContain(pixels[0]);
    expect([127, 128]).toContain(pixels[1]);
    expect([127, 128]).toContain(pixels[2]);
    expect(pixels[3]).toBe(255);
  });

  it('Test 3 (AC-3): unbound texture unit sampling yields opaque black without error', () => {
    // Arrange:
    const gl = s6Context(1, 1);
    const program = s6Link(gl);
    gl.useProgram(program);
    const samplerLoc = gl.getUniformLocation(program, 'u_sampler');
    if (samplerLoc === null) throw new Error('arrange: u_sampler location null');
    gl.uniform1i(samplerLoc, 0);
    // NOTE: no texture bound to unit 0.
    const posBuf = gl.createBuffer();
    if (posBuf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, posBuf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    if (posLoc < 0) throw new Error('arrange: a_position not found');
    gl.vertexAttribPointer(posLoc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posLoc);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, pixels);
    const err = gl.getError();
    // Assert:
    expect(Array.from(pixels)).toEqual([0, 0, 0, 255]);
    expect(err).toBe(NO_ERROR);
  });

  it('Test 4 (AC-4): mipmap level selection at minified scale with LINEAR_MIPMAP_LINEAR', () => {
    // Arrange:
    const gl = s6Context(1, 1);
    const program = s6Link(gl);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(4 * 4 * 4).fill(0).map((_, i) => (i % 4 === 0 ? 255 : i % 4 === 3 ? 255 : 0)));
    gl.texImage2D(TEXTURE_2D, 1, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255]));
    gl.texImage2D(TEXTURE_2D, 2, RGBA, 1, 1, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, LINEAR);
    s6FullQuad(gl, program);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, pixels);
    // Assert: sampled color comes from a lower mip (green/blue dominant, red attenuated).
    expect(gl.getError()).toBe(NO_ERROR);
    expect(pixels[0]).toBeLessThan(128);
    expect(pixels[1] as number + (pixels[2] as number)).toBeGreaterThan(200);
  });

  it('Test 5 (AC-5): determinism — same scene in two fresh contexts byte-identical', () => {
    // Arrange: shared scene parameters.
    const renderScene = (): Uint8Array => {
      const gl = s6Context(4, 4);
      const program = s6Link(gl);
      const tex = gl.createTexture();
      if (tex === null) throw new Error('arrange: createTexture failed');
      gl.bindTexture(TEXTURE_2D, tex);
      const data = new Uint8Array(4 * 4 * 4);
      for (let i = 0; i < 16; i += 1) data.set([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256, 255], i * 4);
      gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, data);
      gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
      gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
      s6FullQuad(gl, program);
      // Act:
      gl.drawArrays(TRIANGLES, 0, 3);
      const out = new Uint8Array(4 * 4 * 4);
      gl.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, out);
      if (gl.getError() !== NO_ERROR) throw new Error('renderScene: error recorded');
      return out;
    };
    const pixelsA = renderScene();
    const pixelsB = renderScene();
    // Assert:
    expect(Array.from(pixelsA)).toEqual(Array.from(pixelsB));
    // Non-trivial scene: output must not be uniformly clear-black.
    expect(Array.from(pixelsA).some((b) => b !== 0)).toBe(true);
  });

  it('Test 6 (AC-6): draw-top texture-unit snapshot resolution', async () => {
    // Arrange:
    const mod = (await import('../../src/gl/webgl1-context')) as unknown as Record<string, unknown>;
    // Act: resolveDrawTextures must exist (red phase: missing export fails here).
    const fn = mod['resolveDrawTextures'] as unknown;
    // Assert:
    expect(typeof fn).toBe('function');
    const resolve = fn as (linked: unknown, mgr: unknown) => Map<number, unknown>;
    const texA = { id: 1, alive: true };
    const fakeLinked = { activeUniforms: [{ slot: 0, typeKind: 'sampler', type: 0x8b5e }, { slot: 1, typeKind: 'sampler', type: 0x8b5e }], uniformStore: { i32: new Int32Array([0, 0, 0, 3]) } };
    const fakeMgr = { getBoundTexture: (_t: unknown, u?: number): unknown => (u === 0 ? texA : null) };
    const snapshot = resolve(fakeLinked, fakeMgr);
    expect(snapshot.get(0)).toBe(texA);
    expect(snapshot.get(1)).toBeNull();
    (fakeMgr as { getBoundTexture: unknown }).getBoundTexture = (): unknown => null;
    expect(snapshot.get(0)).toBe(texA);
  });

  it('Test 7 (AC-7): contextVersion threading — NPOT incomplete under v1, complete under v2', async () => {
    // Arrange:
    const texMod = (await import('../../src/gl/texture')) as unknown as {
      evaluateTextureCompleteness: (t: unknown, v?: 1 | 2) => boolean;
    };
    const sampMod = (await import('../../src/gl/sampler')) as unknown as {
      sample2D: (t: unknown, c: Float32Array, lod?: number | null, v?: 1 | 2) => Float32Array;
    };
    const gl = s6Context(1, 1);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 3, 3, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(3 * 3 * 4).fill(200));
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    gl.texImage2D(TEXTURE_2D, 1, RGBA, 1, 1, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(4).fill(200));
    const coord = new Float32Array([0.5, 0.5]);
    // Act:
    const completeV1 = texMod.evaluateTextureCompleteness(tex, 1);
    const colorV1 = sampMod.sample2D(tex, coord, null, 1);
    const completeV2 = texMod.evaluateTextureCompleteness(tex, 2);
    const colorV2 = sampMod.sample2D(tex, coord, null, 2);
    // Assert:
    expect(completeV1).toBe(false);
    expect(Array.from(colorV1)).toEqual([0, 0, 0, 1]);
    expect(completeV2).toBe(true);
    expect(colorV2[0]).toBeCloseTo(Math.fround(200 / 255), 5);
  });

  it('Test 8 (AC-8): builtins read-only sampling regression', async () => {
    // Arrange:
    const builtins = (await import('../../src/glsl/builtins')) as unknown as {
      evaluateBuiltin: (name: string, args: unknown[], version: 100 | 300) => unknown;
    };
    const gl = s6Context(1, 1);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]));
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    const before = JSON.stringify(tex, (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v instanceof Map ? [...v] : v));
    Object.freeze(tex);
    // Act:
    const color = builtins.evaluateBuiltin('texture2D', [tex, new Float32Array([0.25, 0.25])], 100) as Float32Array;
    const after = JSON.stringify(tex, (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v instanceof Map ? [...v] : v));
    // Assert: real texel sampled (red) and TextureObject never mutated.
    expect(Array.from(color.slice(0, 3))).toEqual([1, 0, 0]);
    expect(color[3]).toBe(1);
    expect(after).toBe(before);
  });
});

describe('Sprint 6 Task 4 fix-loop regressions (HIGH-1/2/3)', () => {
  it('HIGH-2: textureLod on real texture selects the specified mip level', async () => {
    // Arrange:
    const builtins = (await import('../../src/glsl/builtins')) as unknown as {
      evaluateBuiltin: (name: string, args: unknown[], version: 100 | 300) => unknown;
    };
    const gl = s6Context(1, 1);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(4 * 4 * 4).fill(0).map((_, i) => (i % 4 === 0 ? 255 : i % 4 === 3 ? 255 : 0)));
    gl.texImage2D(TEXTURE_2D, 1, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(2 * 2 * 4).fill(0).map((_, i) => (i % 4 === 1 ? 255 : i % 4 === 3 ? 255 : 0)));
    gl.texImage2D(TEXTURE_2D, 2, RGBA, 1, 1, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    // Act:
    const lod0 = builtins.evaluateBuiltin('textureLod', [tex, new Float32Array([0.1, 0.1]), 0], 300) as Float32Array;
    const lod2 = builtins.evaluateBuiltin('textureLod', [tex, new Float32Array([0.1, 0.1]), 2], 300) as Float32Array;
    // Assert: lod 0 red, lod 2 blue (real branch reachable).
    expect(Array.from(lod0.slice(0, 3))).toEqual([1, 0, 0]);
    expect(Array.from(lod2.slice(0, 3))).toEqual([0, 0, 1]);
  });

  it('HIGH-1: textureProj on real texture performs perspective divide', async () => {
    // Arrange:
    const builtins = (await import('../../src/glsl/builtins')) as unknown as {
      evaluateBuiltin: (name: string, args: unknown[], version: 100 | 300) => unknown;
    };
    const gl = s6Context(1, 1);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255]));
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    // Act: (0.5,0.5,2.0) divides to (0.25,0.25) -> red texel; q==0 yields black.
    const divided = builtins.evaluateBuiltin('textureProj', [tex, new Float32Array([0.5, 0.5, 2.0])], 300) as Float32Array;
    const zeroQ = builtins.evaluateBuiltin('textureProj', [tex, new Float32Array([0.5, 0.5, 0.0])], 300) as Float32Array;
    // Assert:
    expect(Array.from(divided.slice(0, 3))).toEqual([1, 0, 0]);
    expect(Array.from(zeroQ)).toEqual([0, 0, 0, 1]);
  });

  it('HIGH-3: textureCube on real cube texture selects face from direction', async () => {
    // Arrange:
    const builtins = (await import('../../src/glsl/builtins')) as unknown as {
      evaluateBuiltin: (name: string, args: unknown[], version: 100 | 300) => unknown;
    };
    const gl = s6Context(1, 1);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_CUBE_MAP, tex);
    const face = (r: number, g: number, b: number): Uint8Array => {
      const d = new Uint8Array(2 * 2 * 4);
      for (let i = 0; i < 4; i++) d.set([r, g, b, 255], i * 4);
      return d;
    };
    gl.texImage2D(TEXTURE_CUBE_MAP_POSITIVE_X, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, face(255, 0, 0));
    gl.texImage2D(TEXTURE_CUBE_MAP_NEGATIVE_X, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, face(0, 255, 0));
    gl.texImage2D(TEXTURE_CUBE_MAP_POSITIVE_Y, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, face(0, 0, 255));
    gl.texImage2D(TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, face(255, 255, 0));
    gl.texImage2D(TEXTURE_CUBE_MAP_POSITIVE_Z, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, face(255, 0, 255));
    gl.texImage2D(TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, face(0, 255, 255));
    gl.texParameteri(TEXTURE_CUBE_MAP, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_CUBE_MAP, TEXTURE_MAG_FILTER, NEAREST);
    // Act:
    const px = builtins.evaluateBuiltin('textureCube', [tex, new Float32Array([1, 0, 0])], 100) as Float32Array;
    const ny = builtins.evaluateBuiltin('textureCube', [tex, new Float32Array([0, -1, 0])], 100) as Float32Array;
    // Assert: +X red, -Y yellow (face selection, not 2D slice).
    expect(Array.from(px.slice(0, 3))).toEqual([1, 0, 0]);
    expect(Array.from(ny.slice(0, 3))).toEqual([1, 1, 0]);
  });
});
