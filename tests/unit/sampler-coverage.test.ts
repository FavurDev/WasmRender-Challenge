/** Sprint 10 Task 4 coverage wave 1 — sampler.ts behavioral coverage (7 tests). */
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
import { WebGL2Context } from '../../src/gl/webgl2-context';
import type { MipLevel, TextureObject } from '../../src/gl/texture';
import {
  ALPHA,
  ARRAY_BUFFER,
  CLAMP_TO_EDGE,
  COMPILE_STATUS,
  FLOAT,
  FRAGMENT_SHADER,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINK_STATUS,
  LUMINANCE,
  LUMINANCE_ALPHA,
  MIRRORED_REPEAT,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
  REPEAT,
  RGB,
  RGBA,
  STATIC_DRAW,
  TEXTURE_2D,
  TEXTURE_2D_ARRAY,
  TEXTURE_3D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

function level2x2(tl: number[], tr: number[], bl: number[], br: number[]): MipLevel {
  // Arrange helper: 2x2 RGBA/UNSIGNED_BYTE level, row-major TL,TR / BL,BR.
  const data = new Uint8Array([...tl, ...tr, ...bl, ...br]);
  return { width: 2, height: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data };
}

function completeTex(level: MipLevel): TextureObject {
  // Arrange helper: minimal complete 2D texture (power-of-two, NEAREST, CLAMP).
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

describe('sampler-coverage: applyWrap modes', () => {
  it('s01 REPEAT wraps fractional and negative coords into [0,1)', () => {
    // Arrange: repeat wrap coordinates.
    // Act:
    const a = applyWrap(1.25, REPEAT);
    const b = applyWrap(-0.25, REPEAT);
    // Assert:
    expect(a).toBeCloseTo(0.25, 5);
    expect(b).toBeCloseTo(0.75, 5);
  });

  it('s02 MIRRORED_REPEAT mirrors every other integer span', () => {
    // Arrange: mirrored-repeat coordinates.
    // Act:
    const a = applyWrap(1.25, MIRRORED_REPEAT);
    const b = applyWrap(1.75, MIRRORED_REPEAT);
    // Assert:
    expect(a).toBeCloseTo(0.75, 5);
    expect(b).toBeCloseTo(0.25, 5);
  });

  it('s03 CLAMP_TO_EDGE clamps outside coords to [0,1]', () => {
    // Arrange: out-of-range coordinates.
    // Act:
    const lo = applyWrap(-0.5, CLAMP_TO_EDGE);
    const hi = applyWrap(1.5, CLAMP_TO_EDGE);
    // Assert:
    expect(lo).toBe(0);
    expect(hi).toBe(1);
  });
});

describe('sampler-coverage: texel fetch and level sampling', () => {
  it('s04 fetchTexel2D unpacks RGBA bytes to normalized floats', () => {
    // Arrange: 2x2 level with red at (0,0).
    const level = level2x2([255, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]);
    // Act:
    const px = fetchTexel2D(level, 0, 0);
    // Assert:
    expect(Array.from(px)).toEqual([1, 0, 0, 1]);
  });

  it('s05 sampleMipLevel2D NEAREST picks nearest texel, LINEAR blends', () => {
    // Arrange: 2x2 level, red TL / blue TR.
    const level = level2x2([255, 0, 0, 255], [0, 0, 255, 255], [0, 0, 0, 255], [0, 0, 0, 255]);
    // Act:
    const n = sampleMipLevel2D(level, 0.1, 0.1, NEAREST);
    const l = sampleMipLevel2D(level, 0.5, 0.1, LINEAR);
    // Assert:
    expect(n[0]).toBe(1);
    expect(n[2]).toBe(0);
    expect(l[0]).toBeGreaterThan(0);
    expect(l[0]).toBeLessThan(1);
    expect(l[2]).toBeGreaterThan(0);
  });

  it('s06 sample2D on complete texture returns corner texel color', () => {
    // Arrange: complete texture, red TL corner.
    const tex = completeTex(level2x2([255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255]));
    // Act:
    const c = sample2D(tex, 0.1, 0.1);
    // Assert:
    expect(c[0]).toBe(1);
    expect(c[1]).toBe(0);
    expect(c[2]).toBe(0);
    expect(c[3]).toBe(1);
  });

  it('s07 resolveEffectiveSamplerParams prefers live bound sampler', () => {
    // Arrange: texture with NEAREST, bound sampler with LINEAR.
    const tex = completeTex(level2x2([0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255], [0, 0, 0, 255]));
    const bound = { alive: true, params: { ...tex.sampler, magFilter: LINEAR } };
    // Act:
    const eff = resolveEffectiveSamplerParams(tex, bound);
    const fallback = resolveEffectiveSamplerParams(tex, null);
    // Assert:
    expect(eff.magFilter).toBe(LINEAR);
    expect(fallback.magFilter).toBe(NEAREST);
  });
});

describe('sampler-coverage: formats, overloads, and mipmaps', () => {
  it('s08 fetchTexel2D texture-overload matches level-overload; missing level is black', () => {
    // Arrange: complete texture with red TL texel.
    const level = level2x2([255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255], [255, 255, 255, 255]);
    const tex = completeTex(level);
    // Act:
    const viaLevel = fetchTexel2D(level, 0, 0);
    const viaTex = fetchTexel2D(tex, 0, 0, 0);
    const missing = fetchTexel2D(tex, 5, 0, 0);
    // Assert:
    expect(Array.from(viaTex)).toEqual(Array.from(viaLevel));
    expect(Array.from(missing)).toEqual([0, 0, 0, 1]);
  });

  it('s09 fetchTexel2D maps RGB/LUMINANCE_ALPHA/LUMINANCE/ALPHA channel layouts', () => {
    // Arrange: one texel per format with byte payload [128, 64, 32, 255].
    const mk = (internalFormat: number, bytes: number[]): MipLevel => ({
      width: 1,
      height: 1,
      internalFormat,
      type: UNSIGNED_BYTE,
      data: new Uint8Array(bytes),
    });
    // Act:
    const rgb = fetchTexel2D(mk(RGB, [128, 64, 32]), 0, 0);
    const la = fetchTexel2D(mk(LUMINANCE_ALPHA, [128, 64]), 0, 0);
    const lum = fetchTexel2D(mk(LUMINANCE, [128]), 0, 0);
    const alpha = fetchTexel2D(mk(ALPHA, [64]), 0, 0);
    // Assert:
    expect(rgb[3]).toBe(1);
    expect(rgb[0]).toBeCloseTo(128 / 255, 4);
    expect(la[0]).toBe(la[1]);
    expect(la[1]).toBe(la[2]);
    expect(lum[0]).toBe(lum[1]);
    expect(lum[1]).toBe(lum[2]);
    expect(lum[3]).toBe(1);
    expect(alpha[0]).toBe(0);
    expect(alpha[1]).toBe(0);
    expect(alpha[2]).toBe(0);
    expect(alpha[3]).toBeCloseTo(64 / 255, 4);
  });

  it('s10 sampleMipLevel2D texture-overload matches level-overload; missing level is black', () => {
    // Arrange:
    const level = level2x2([255, 0, 0, 255], [0, 0, 255, 255], [0, 0, 0, 255], [0, 0, 0, 255]);
    const tex = completeTex(level);
    // Act:
    const viaLevel = sampleMipLevel2D(level, 0.1, 0.1, NEAREST);
    const viaTex = sampleMipLevel2D(tex, 0, 0.1, 0.1, NEAREST);
    const missing = sampleMipLevel2D(tex, 9, 0.1, 0.1, NEAREST);
    // Assert:
    expect(Array.from(viaTex)).toEqual(Array.from(viaLevel));
    expect(Array.from(missing)).toEqual([0, 0, 0, 1]);
  });

  it('s11 sample2D mipmap filters select and blend levels by LOD', () => {
    // Arrange: level 0 solid red 2x2, level 1 solid blue 1x1.
    const red = level2x2([255, 0, 0, 255], [255, 0, 0, 255], [255, 0, 0, 255], [255, 0, 0, 255]);
    const blue: MipLevel = { width: 1, height: 1, internalFormat: RGBA, type: UNSIGNED_BYTE, data: new Uint8Array([0, 0, 255, 255]) };
    const mk = (minFilter: number): TextureObject => ({
      ...completeTex(red),
      levels2D: new Map([[0, red], [1, blue]]),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter, magFilter: NEAREST },
    });
    // Act:
    const nearest = sample2D(mk(NEAREST_MIPMAP_NEAREST), 0.1, 0.1, 1.0, 1);
    const linearBlend = sample2D(mk(LINEAR_MIPMAP_LINEAR), 0.1, 0.1, 0.5, 1);
    const linearNearest = sample2D(mk(NEAREST_MIPMAP_LINEAR), 0.1, 0.1, 1.0, 1);
    // Assert:
    expect(nearest[2]).toBe(1);
    expect(nearest[0]).toBe(0);
    expect(linearBlend[0]).toBeGreaterThan(0);
    expect(linearBlend[0]).toBeLessThan(1);
    expect(linearBlend[2]).toBeGreaterThan(0);
    expect(linearBlend[2]).toBeLessThan(1);
    expect(linearNearest[2]).toBe(1);
  });

  it('s12 resolveEffectiveSamplerParams falls back on dead sampler; sample2D honors effective params', () => {
    // Arrange: 2x1 red/blue level, texture NEAREST, live sampler LINEAR.
    const level: MipLevel = {
      width: 2,
      height: 1,
      internalFormat: RGBA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]),
    };
    const tex = completeTex(level);
    const live = { alive: true, params: { ...tex.sampler, magFilter: LINEAR } };
    const dead = { alive: false, params: { ...tex.sampler, magFilter: LINEAR } };
    // Act:
    const pDead = resolveEffectiveSamplerParams(tex, dead);
    const sharp = sample2D(tex, 0.5, 0.5);
    const blended = sample2D(tex, [0.5, 0.5], null, 1, { ...tex.sampler, magFilter: LINEAR });
    void live;
    // Assert:
    expect(pDead.magFilter).toBe(NEAREST);
    expect(sharp[0] === 1 || sharp[2] === 1).toBe(true);
    expect(blended[0]).toBeGreaterThan(0);
    expect(blended[0]).toBeLessThan(1);
  });

  it('s13 sample3D and sample2DArray sample volumes and select layers', () => {
    // Arrange: 2x2x2 volume, layer 0 red / layer 1 blue; array with same layout.
    const vox = new Uint8Array([
      255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
      0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
    ]);
    const mkVol = (target: number): TextureObject => ({
      id: 7,
      alive: true,
      target,
      levels2D: new Map(),
      levelsCube: new Map(),
      levels3D: target === TEXTURE_3D ? new Map([[0, { width: 2, height: 2, depth: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: vox }]]) : new Map(),
      levels2DArray: target === TEXTURE_2D_ARRAY ? new Map([[0, { width: 2, height: 2, depth: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: vox }]]) : new Map(),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    });
    // Act:
    const c3 = sample3D(mkVol(TEXTURE_3D), 0.1, 0.1, 0.1);
    const layer0 = sample2DArray(mkVol(TEXTURE_2D_ARRAY), 0.1, 0.1, 0.0);
    const layer1 = sample2DArray(mkVol(TEXTURE_2D_ARRAY), 0.1, 0.1, 1.0);
    const t3 = fetchTexel3D(mkVol(TEXTURE_3D), 0, 0, 0, 1);
    // Assert:
    expect(c3[0]).toBe(1);
    expect(layer0[0]).toBe(1);
    expect(layer1[2]).toBe(1);
    expect(t3[2]).toBe(1);
  });

  it('s14 integration: bound NEAREST sampler supersedes LINEAR texture filter via readPixels', () => {
    // Arrange: WebGL2 context, checkerboard texture with LINEAR, sampler NEAREST.
    const gl = new WebGL2Context({ width: 4, height: 4 });
    const vs = gl.createShader(VERTEX_SHADER);
    const fs = gl.createShader(FRAGMENT_SHADER);
    if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
    gl.shaderSource(vs, 'attribute vec2 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; void main() { v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }');
    gl.shaderSource(fs, 'precision mediump float; varying vec2 v_texCoord; uniform sampler2D u_sampler; void main() { gl_FragColor = texture2D(u_sampler, v_texCoord); }');
    gl.compileShader(vs);
    gl.compileShader(fs);
    expect(gl.getShaderParameter(vs, COMPILE_STATUS)).toBe(true);
    expect(gl.getShaderParameter(fs, COMPILE_STATUS)).toBe(true);
    const program = gl.createProgram();
    if (program === null) throw new Error('arrange: createProgram failed');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    expect(gl.getProgramParameter(program, LINK_STATUS)).toBe(true);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255]));
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, LINEAR);
    const sampler = gl.createSampler();
    if (sampler === null) throw new Error('arrange: createSampler failed');
    gl.samplerParameteri(sampler, TEXTURE_MIN_FILTER, NEAREST);
    gl.samplerParameteri(sampler, TEXTURE_MAG_FILTER, NEAREST);
    gl.bindSampler(0, sampler);
    const posBuf = gl.createBuffer();
    const texBuf = gl.createBuffer();
    if (posBuf === null || texBuf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, posBuf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    gl.bindBuffer(ARRAY_BUFFER, texBuf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([0.125, 0.125, 2.125, 0.125, 0.125, 2.125]), STATIC_DRAW);
    gl.useProgram(program);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.bindBuffer(ARRAY_BUFFER, posBuf);
    gl.vertexAttribPointer(posLoc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(ARRAY_BUFFER, texBuf);
    gl.vertexAttribPointer(texLoc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(texLoc);
    const samplerLoc = gl.getUniformLocation(program, 'u_sampler');
    if (samplerLoc === null) throw new Error('arrange: u_sampler location null');
    gl.uniform1i(samplerLoc, 0);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixel = new Uint8Array(4);
    gl.readPixels(1, 1, 1, 1, RGBA, UNSIGNED_BYTE, pixel);
    // Assert: NEAREST sampler wins over LINEAR texture — pixel is a sharp texel, never a blend.
    expect(pixel[0] === 0 || pixel[0] === 255).toBe(true);
  });
});

describe('sampler-coverage: scalar shapes, linear volumes, and guards', () => {
  it('s15 scalar-shape sample3D/sample2DArray with LINEAR filter trilinearly blend', () => {
    // Arrange: 2x2x2 volume, x=0 red / x=1 blue slices.
    const vox = new Uint8Array([
      255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
      0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
    ]);
    const mkVol = (target: number): TextureObject => ({
      id: 8,
      alive: true,
      target,
      levels2D: new Map(),
      levelsCube: new Map(),
      levels3D: target === TEXTURE_3D ? new Map([[0, { width: 2, height: 2, depth: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: vox }]]) : new Map(),
      levels2DArray: target === TEXTURE_2D_ARRAY ? new Map([[0, { width: 2, height: 2, depth: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: vox }]]) : new Map(),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: LINEAR, magFilter: LINEAR },
      isNPOT: false,
      completeness: null,
    });
    // Act: scalar (s,t,r) shapes hit the scalar-shape parsing branches.
    const c3 = sample3D(mkVol(TEXTURE_3D), 0.5, 0.5, 0.5);
    const cArr = sample2DArray(mkVol(TEXTURE_2D_ARRAY), 0.5, 0.5, 0.5);
    const lvl = fetchTexel3D({ width: 2, height: 2, depth: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: vox }, 0, 0, 0);
    // Assert: midpoint blends red and blue slices.
    expect(c3[0]).toBeGreaterThan(0);
    expect(c3[0]).toBeLessThan(1);
    expect(c3[2]).toBeGreaterThan(0);
    expect(c3[2]).toBeLessThan(1);
    expect(cArr.length).toBe(4);
    expect(lvl[0]).toBe(1);
  });

  it('s16 guards: dead texture, missing base level, and LOD clamping', () => {
    // Arrange:
    const red = level2x2([255, 0, 0, 255], [255, 0, 0, 255], [255, 0, 0, 255], [255, 0, 0, 255]);
    const blue: MipLevel = { width: 1, height: 1, internalFormat: RGBA, type: UNSIGNED_BYTE, data: new Uint8Array([0, 0, 255, 255]) };
    const tex = completeTex(red);
    const dead = { ...tex, alive: false };
    const noBase = { ...tex, levels2D: new Map([[1, blue]]) };
    const mipped = { ...tex, levels2D: new Map([[0, red], [1, blue]]), sampler: { ...tex.sampler, minFilter: NEAREST_MIPMAP_NEAREST } };
    // Act:
    const deadRes = sample2D(dead, 0.1, 0.1);
    const noBaseRes = sample2D(noBase, 0.1, 0.1);
    const clamped = sample2D(mipped, [0.1, 0.1], 99.0, 1);
    const viaCoordsEff = sample2D(tex, [0.5, 0.5], null, 1, { ...tex.sampler, magFilter: LINEAR });
    // Assert:
    expect(Array.from(deadRes)).toEqual([0, 0, 0, 1]);
    expect(Array.from(noBaseRes)).toEqual([0, 0, 0, 1]);
    expect(clamped[2]).toBe(1);
    expect(viaCoordsEff.length).toBe(4);
  });
});
