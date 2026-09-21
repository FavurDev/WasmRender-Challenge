/** Sampler unit tests (Sprint 6 Task 2 remediation: analytic mip + truth table). */
import { describe, expect, it } from 'vitest';
import { ErrorSink } from '../../src/gl/errors';
import { TextureManager, evaluateTextureCompleteness } from '../../src/gl/texture';
import { applyWrap, fetchTexel2D, isTextureComplete, sample2D, sampleMipLevel2D } from '../../src/gl/sampler';
import {
  CLAMP_TO_EDGE,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST,
  MIRRORED_REPEAT,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
  REPEAT,
  RGBA,
  TEXTURE_2D,
  TEXTURE_MIN_FILTER,
  UNSIGNED_BYTE,
} from '../../src/gl/constants';
import type { MipLevel, TextureObject } from '../../src/gl/texture';

function solidLevel(w: number, h: number, r: number, g: number, b: number, a: number): MipLevel {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  }
  return { width: w, height: h, internalFormat: RGBA, type: UNSIGNED_BYTE, data };
}

function makeTex(levels: MipLevel[], minFilter: number, magFilter: number = NEAREST): TextureObject {
  const map = new Map<number, MipLevel>();
  levels.forEach((l, i) => map.set(i, l));
  return {
    id: 1, target: TEXTURE_2D, alive: true, isNPOT: false,
    levels2D: map, levelsCube: new Map(),
    sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: minFilter as never, magFilter: magFilter as never },
    completeness: null,
  };
}

describe('sampler', () => {
  it('t01 NEAREST picks floor(u*w) texel', () => {
    // Arrange
    const lvl = solidLevel(2, 1, 255, 0, 0, 255);
    lvl.data.set([0, 0, 255, 255], 4);
    // Act
    const c = fetchTexel2D(lvl, 1, 0);
    // Assert
    expect(Array.from(c)).toEqual([0, 0, 1, 1]);
  });
  it('t02 LINEAR midpoint averages 2x1 red/blue', () => {
    // Arrange
    const lvl = solidLevel(2, 1, 255, 0, 0, 255);
    lvl.data.set([0, 0, 255, 255], 4);
    const tex = makeTex([lvl], LINEAR, LINEAR);
    // Act
    const c = Array.from(sample2D(tex, 0.5, 0.5, 1));
    // Assert: bilinear midpoint of red/blue
    expect(c[0]).toBeCloseTo(0.5, 2); expect(c[2]).toBeCloseTo(0.5, 2);
  });
  it('t03 wrap modes out of range', () => {
    // Arrange / Act / Assert
    expect(applyWrap(1.25, REPEAT)).toBeCloseTo(0.25, 5);
    expect(applyWrap(-0.25, REPEAT)).toBeCloseTo(0.75, 5);
    expect(applyWrap(1.5, CLAMP_TO_EDGE)).toBe(1);
    expect(applyWrap(-0.5, CLAMP_TO_EDGE)).toBe(0);
    expect(applyWrap(1.25, MIRRORED_REPEAT)).toBeCloseTo(0.75, 5);
  });
  it('t03b wrap boundaries (L2)', () => {
    // Arrange / Act / Assert
    expect(applyWrap(1.0, REPEAT)).toBeCloseTo(0, 5);
    expect(applyWrap(1.0, CLAMP_TO_EDGE)).toBe(1);
    expect(applyWrap(1.0, MIRRORED_REPEAT)).toBeCloseTo(1, 5);
    expect(applyWrap(2.0, MIRRORED_REPEAT)).toBeCloseTo(0, 5);
  });
  it('t04 box filter 4x4 -> 1x1 rounds mean (M1)', () => {
    // Arrange: 4x4 with one white texel => L2 mean 255/16 = 15.94, round => 16 (floor => 15, biased)
    const err = new ErrorSink();
    const m = new TextureManager(err);
    const t = m.createTexture(); m.bindTexture(TEXTURE_2D, t);
    const data = new Uint8Array(4 * 4 * 4);
    data.set([255, 255, 255, 255], 0);
    m.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, data);
    // Act
    (m as unknown as { generateMipmap(t: number): void }).generateMipmap(TEXTURE_2D);
    // Assert
    const l2 = t!.levels2D.get(2)!;
    expect(l2.width).toBe(1); expect(l2.height).toBe(1);
    expect(l2.data[0]).toBe(Math.round(255 / 16));
  });
  it('t05 NEAREST_MIPMAP_NEAREST picks round(lod) solid level', () => {
    // Arrange: L0 red, L1 green, L2 green (full 4->2->1 chain => complete)
    const tex = makeTex([solidLevel(4, 4, 255, 0, 0, 255), solidLevel(2, 2, 0, 255, 0, 255), solidLevel(1, 1, 0, 255, 0, 255)], NEAREST_MIPMAP_NEAREST);
    // Act
    const c0 = Array.from(sample2D(tex, 0.25, 0.25, 0.2));
    const c1 = Array.from(sample2D(tex, 0.25, 0.25, 0.8));
    // Assert
    expect(c0).toEqual([1, 0, 0, 1]);
    expect(c1).toEqual([0, 1, 0, 1]);
  });
  it('t06 NEAREST_MIPMAP_LINEAR blends two solid levels', () => {
    // Arrange: L0 red, L1 blue, L2 blue (full chain), lod 0.5
    const tex = makeTex([solidLevel(4, 4, 255, 0, 0, 255), solidLevel(2, 2, 0, 0, 255, 255), solidLevel(1, 1, 0, 0, 255, 255)], NEAREST_MIPMAP_LINEAR);
    // Act
    const c = Array.from(sample2D(tex, 0.25, 0.25, 0.5));
    // Assert: 0.5 red + 0.5 blue
    expect(c[0]).toBeCloseTo(0.5, 2); expect(c[2]).toBeCloseTo(0.5, 2); expect(c[1]).toBe(0);
  });
  it('t07 LINEAR_MIPMAP_LINEAR bilinear + blend analytic', () => {
    // Arrange: L0 2x1 red|blue solid, L1 1x1 purple(128,0,128)
    const l0 = solidLevel(2, 1, 255, 0, 0, 255);
    l0.data.set([0, 0, 255, 255], 4);
    const l1 = solidLevel(1, 1, 128, 0, 128, 255);
    const tex = makeTex([l0, l1], LINEAR_MIPMAP_LINEAR, LINEAR);
    // Act: lod 1 => pure L1 bilinear of solid purple
    const c = Array.from(sample2D(tex, 0.5, 0.5, 1));
    // Assert
    expect(c[0]).toBeCloseTo(128 / 255, 2); expect(c[2]).toBeCloseTo(128 / 255, 2);
  });
  it('t08 sampleMipLevel2D shapes', () => {
    // Arrange
    const lvl = solidLevel(1, 1, 0, 255, 0, 255);
    const tex = makeTex([lvl], NEAREST);
    // Act / Assert
    expect(Array.from(sampleMipLevel2D(lvl, 0.5, 0.5, NEAREST))).toEqual([0, 1, 0, 1]);
    expect(Array.from(sampleMipLevel2D(tex, 0, 0.5, 0.5, NEAREST))).toEqual([0, 1, 0, 1]);
  });
  it('t11 NPOT+mip incomplete under v1, complete under v2 (H1)', () => {
    // Arrange: 3x5 NPOT with mip filter (incomplete v1); NPOT with NEAREST is complete even in v2
    const tex = makeTex([solidLevel(3, 5, 255, 0, 0, 255)], NEAREST_MIPMAP_NEAREST);
    const texV2ok = makeTex([solidLevel(3, 5, 255, 0, 0, 255)], NEAREST);
    // Act / Assert
    expect(evaluateTextureCompleteness(tex, 1)).toBe(false);
    expect(evaluateTextureCompleteness(tex)).toBe(false);
    expect(evaluateTextureCompleteness(texV2ok, 2)).toBe(true);
    expect(isTextureComplete(tex)).toBe(false);
    expect(Array.from(sample2D(tex, 0.5, 0.5, 1))[0]).toBe(0);
    expect(Array.from(sample2D(texV2ok, 0.5, 0.5, 1, 2))[0]).toBe(1);
  });
  it('t12 sampler is mutation-free (H2)', () => {
    // Arrange
    const tex = makeTex([solidLevel(4, 4, 255, 0, 0, 255)], NEAREST);
    const before = JSON.stringify({ c: tex.completeness, n: tex.levels2D.size });
    // Act
    sample2D(tex, 0.5, 0.5, 0);
    sample2D(makeTex([], NEAREST), 0.5, 0.5, 0);
    // Assert
    expect(JSON.stringify({ c: tex.completeness, n: tex.levels2D.size })).toBe(before);
  });
  it('t13 generateMipmap chain + incomplete returns black', () => {
    // Arrange
    const err = new ErrorSink();
    const m = new TextureManager(err);
    const t = m.createTexture(); m.bindTexture(TEXTURE_2D, t);
    m.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(4 * 4 * 4));
    // Act
    (m as unknown as { generateMipmap(t: number): void }).generateMipmap(TEXTURE_2D);
    // Assert
    expect(t!.levels2D.size).toBe(3);
    expect(Array.from(sample2D(makeTex([], NEAREST), 0, 0, 0))).toEqual([0, 0, 0, 1]);
  });
  it('t14 completeness truth table (H3)', () => {
    // Arrange
    const pot = makeTex([solidLevel(4, 4, 1, 2, 3, 255)], NEAREST);
    const npotRep = makeTex([solidLevel(3, 5, 1, 2, 3, 255)], NEAREST);
    npotRep.sampler.wrapS = REPEAT as never;
    const npotMip = makeTex([solidLevel(3, 5, 1, 2, 3, 255)], NEAREST_MIPMAP_NEAREST);
    const noL0 = makeTex([], NEAREST);
    const badChain = makeTex([solidLevel(4, 4, 1, 2, 3, 255)], NEAREST_MIPMAP_NEAREST);
    const fullChain = makeTex([solidLevel(4, 4, 1, 2, 3, 255), solidLevel(2, 2, 1, 2, 3, 255), solidLevel(1, 1, 1, 2, 3, 255)], NEAREST_MIPMAP_NEAREST);
    // Act / Assert (default = WebGL1)
    expect(evaluateTextureCompleteness(pot)).toBe(true);
    expect(evaluateTextureCompleteness(npotRep)).toBe(false);
    expect(evaluateTextureCompleteness(npotMip)).toBe(false);
    expect(evaluateTextureCompleteness(noL0)).toBe(false);
    expect(evaluateTextureCompleteness(badChain)).toBe(false);
    expect(evaluateTextureCompleteness(fullChain)).toBe(true);
    expect(TEXTURE_MIN_FILTER).toBeDefined();
  });
});
