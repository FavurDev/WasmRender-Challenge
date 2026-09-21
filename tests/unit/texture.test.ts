/** TextureManager unit tests (Sprint 6 Task 1 red phase) — WebGL 1.0 texture lifecycle, binding, image spec, subimage, copy, sampler params. */
import { describe, expect, it } from 'vitest';
import { ErrorSink } from '../../src/gl/errors';
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
