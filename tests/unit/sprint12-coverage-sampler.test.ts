/** Sprint 12 Task 4 Unit 3 — sampler core coverage (wrap math, texel fetch, mip sampling). */
import { describe, expect, it } from 'vitest';
import {
  applyWrap,
  fetchTexel2D,
  fetchTexel3D,
  resolveEffectiveSamplerParams,
  sample2D,
  sample2DArray,
  sample3D,
  sampleMipLevel2D,
} from '../../src/gl/sampler';
import {
  ALPHA,
  CLAMP_TO_EDGE,
  LINEAR,
  LUMINANCE,
  LUMINANCE_ALPHA,
  MIRRORED_REPEAT,
  NEAREST,
  REPEAT,
  RGB,
  RGBA,
  TEXTURE_2D,
  UNSIGNED_BYTE,
} from '../../src/gl/constants';
import type { MipLevel, TextureObject } from '../../src/gl/texture';

function rgbaLevel(pixels: number[], width: number, height: number): MipLevel {
  // Arrange helper
  return { width, height, internalFormat: RGBA, type: UNSIGNED_BYTE, data: new Uint8Array(pixels) };
}

function grayTexel(v: number): MipLevel {
  // Arrange helper: 1x1 LUMINANCE level
  return { width: 1, height: 1, internalFormat: LUMINANCE, type: UNSIGNED_BYTE, data: new Uint8Array([v]) };
}

function makeTexture(level: MipLevel): TextureObject {
  // Arrange helper
  return {
    id: 1,
    alive: true,
    target: TEXTURE_2D,
    levels2D: new Map([[0, level]]),
    levelsCube: new Map(),
    sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
    isNPOT: false,
    completeness: null,
  };
}

describe('sprint12 sampler coverage', () => {
  it('applyWrap clamps coordinates to [0,1]', () => {
    // Arrange
    const lo = -0.5;
    const hi = 1.5;
    // Act
    const a = applyWrap(lo, CLAMP_TO_EDGE);
    const b = applyWrap(hi, CLAMP_TO_EDGE);
    // Assert
    expect(a).toBe(Math.fround(0));
    expect(b).toBe(Math.fround(1));
  });

  it('applyWrap repeats with fractional part', () => {
    // Arrange
    const coord = 1.25;
    // Act
    const out = applyWrap(coord, REPEAT);
    // Assert
    expect(out).toBe(Math.fround(0.25));
  });

  it('applyWrap mirrors every other integer interval', () => {
    // Arrange
    const coord = 1.25;
    // Act
    const out = applyWrap(coord, MIRRORED_REPEAT);
    // Assert
    expect(out).toBe(Math.fround(0.75));
  });

  it('fetchTexel2D returns exact RGBA texel bytes as floats', () => {
    // Arrange
    const level = rgbaLevel([10, 20, 30, 40], 1, 1);
    // Act
    const px = fetchTexel2D(level, 0, 0);
    // Assert
    expect(Array.from(px)).toEqual([Math.fround(10 / 255), Math.fround(20 / 255), Math.fround(30 / 255), Math.fround(40 / 255)]);
  });

  it('fetchTexel2D falls back to [0,0,0,1] for a missing texture level', () => {
    // Arrange
    const tex = makeTexture(rgbaLevel([1, 2, 3, 4], 1, 1));
    // Act
    const px = fetchTexel2D(tex, 5, 0, 0);
    // Assert
    expect(Array.from(px)).toEqual([0, 0, 0, 1]);
  });

  it('fetchTexel2D expands LUMINANCE to [L,L,L,1]', () => {
    // Arrange
    const level = grayTexel(200);
    // Act
    const px = fetchTexel2D(level, 0, 0);
    // Assert
    expect(Array.from(px)).toEqual([Math.fround(200 / 255), Math.fround(200 / 255), Math.fround(200 / 255), 1]);
  });

  it('fetchTexel2D expands ALPHA to [0,0,0,A]', () => {
    // Arrange
    const level: MipLevel = {
      width: 1,
      height: 1,
      internalFormat: ALPHA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array([77]),
    };
    // Act
    const px = fetchTexel2D(level, 0, 0);
    // Assert
    expect(Array.from(px)).toEqual([0, 0, 0, Math.fround(77 / 255)]);
  });

  it('fetchTexel2D expands RGB with opaque alpha', () => {
    // Arrange
    const level: MipLevel = {
      width: 1,
      height: 1,
      internalFormat: RGB,
      type: UNSIGNED_BYTE,
      data: new Uint8Array([5, 6, 7]),
    };
    // Act
    const px = fetchTexel2D(level, 0, 0);
    // Assert
    expect(Array.from(px)).toEqual([Math.fround(5 / 255), Math.fround(6 / 255), Math.fround(7 / 255), 1]);
  });

  it('fetchTexel2D expands LUMINANCE_ALPHA to [L,L,L,A]', () => {
    // Arrange
    const level: MipLevel = {
      width: 1,
      height: 1,
      internalFormat: LUMINANCE_ALPHA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array([9, 11]),
    };
    // Act
    const px = fetchTexel2D(level, 0, 0);
    // Assert
    expect(Array.from(px)).toEqual([
      Math.fround(9 / 255),
      Math.fround(9 / 255),
      Math.fround(9 / 255),
      Math.fround(11 / 255),
    ]);
  });

  it('sampleMipLevel2D NEAREST picks the exact texel', () => {
    // Arrange: 2x1 red|green
    const level = rgbaLevel([255, 0, 0, 255, 0, 255, 0, 255], 2, 1);
    // Act
    const left = sampleMipLevel2D(level, 0.1, 0.5, NEAREST);
    const right = sampleMipLevel2D(level, 0.9, 0.5, NEAREST);
    // Assert
    expect(Array.from(left)).toEqual([1, 0, 0, 1]);
    expect(Array.from(right)).toEqual([0, 1, 0, 1]);
  });

  it('sampleMipLevel2D LINEAR blends adjacent texels with fround math', () => {
    // Arrange: 2x1 black|white
    const level = rgbaLevel([0, 0, 0, 255, 255, 255, 255, 255], 2, 1);
    // Act
    const mid = sampleMipLevel2D(level, 0.5, 0.5, LINEAR);
    // Assert
    expect(mid[0]).toBe(0.5);
    expect(mid[3]).toBe(1);
  });

  it('resolveEffectiveSamplerParams returns texture params by default', () => {
    // Arrange
    const tex = makeTexture(rgbaLevel([1, 2, 3, 4], 1, 1));
    // Act
    const eff = resolveEffectiveSamplerParams(tex, null);
    // Assert
    expect(eff.minFilter).toBe(NEAREST);
    expect(eff.magFilter).toBe(NEAREST);
  });

  it('sample2D on a 1x1 texture returns the single texel', () => {
    // Arrange
    const tex = makeTexture(rgbaLevel([26, 51, 77, 255], 1, 1));
    // Act
    const px = sample2D(tex, 0.5, 0.5);
    // Assert
    expect(Array.from(px)).toEqual([Math.fround(26 / 255), Math.fround(51 / 255), Math.fround(77 / 255), 1]);
  });

  it('sample3D on a 1x1x1 volume returns the single texel', () => {
    // Arrange
    const tex = makeTexture(rgbaLevel([9, 8, 7, 255], 1, 1));
    tex.levels3D = new Map([[0, { ...rgbaLevel([9, 8, 7, 255], 1, 1), depth: 1 }]]);
    // Act
    const px = sample3D(tex, 0.5, 0.5, 0.5);
    // Assert
    expect(Array.from(px)).toEqual([Math.fround(9 / 255), Math.fround(8 / 255), Math.fround(7 / 255), 1]);
  });

  it('sample2DArray on a single-layer array returns the layer texel', () => {
    // Arrange
    const tex = makeTexture(rgbaLevel([4, 5, 6, 255], 1, 1));
    tex.levels2DArray = new Map([[0, { ...rgbaLevel([4, 5, 6, 255], 1, 1), depth: 1 }]]);
    // Act
    const px = sample2DArray(tex, 0.5, 0.5, 0);
    // Assert
    expect(Array.from(px)).toEqual([Math.fround(4 / 255), Math.fround(5 / 255), Math.fround(6 / 255), 1]);
  });

  it('fetchTexel3D clamps out-of-range coordinates', () => {
    // Arrange
    const level: MipLevel = {
      width: 1,
      height: 1,
      depth: 1,
      internalFormat: RGBA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array([1, 2, 3, 4]),
    };
    // Act
    const px = fetchTexel3D(level, 9, -3, 99);
    // Assert
    expect(Array.from(px)).toEqual([Math.fround(1 / 255), Math.fround(2 / 255), Math.fround(3 / 255), Math.fround(4 / 255)]);
  });
});
