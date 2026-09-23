/** Sprint 10 Task 4 coverage wave 1 — builtins.ts behavioral coverage (7 tests). */
import { describe, expect, it } from 'vitest';
import { computeLod, evaluateBuiltin as evaluateBuiltinRaw, evaluateSwizzle, selectMipLevel } from '../../src/glsl/builtins';
import type { Value } from '../../src/glsl/builtins';

function evaluateBuiltin(name: string, args: unknown[], version: 100 | 300): Value {
  // Test-only untyped wrapper: behavioral tests intentionally pass textures,
  // strings, and other non-Value inputs to exercise black()/fallback paths.
  return evaluateBuiltinRaw(name, args as Value[], version);
}
import {
  CLAMP_TO_EDGE,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
  RGBA,
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
  UNSIGNED_BYTE,
} from '../../src/gl/constants';

describe('builtins-coverage: math and geometric', () => {
  it('b01 mix and clamp are float32-exact', () => {
    // Arrange:
    const mixArgs = [0.0, 1.0, 0.25];
    // Act:
    const m = evaluateBuiltin('mix', mixArgs, 100) as number;
    const c = evaluateBuiltin('clamp', [-1.5, 0.0, 1.0], 100) as number;
    // Assert:
    expect(m).toBe(Math.fround(0.25));
    expect(c).toBe(0);
  });

  it('b02 dot, normalize, and cross follow GLSL semantics', () => {
    // Arrange:
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    // Act:
    const d = evaluateBuiltin('dot', [a, b], 100) as number;
    const n = evaluateBuiltin('normalize', [new Float32Array([3, 0, 0])], 100) as Float32Array;
    const cr = evaluateBuiltin('cross', [a, b], 100) as Float32Array;
    // Assert:
    expect(d).toBe(0);
    expect(n[0]).toBeCloseTo(1, 5);
    expect(Array.from(cr)).toEqual([0, 0, 1]);
  });

  it('b03 transpose swaps rows and columns of mat2', () => {
    // Arrange: column-major mat2 [1,2,3,4] => rows (1,3),(2,4).
    const m = new Float32Array([1, 2, 3, 4]);
    // Act:
    const t = evaluateBuiltin('transpose', [m], 300) as Float32Array;
    // Assert:
    expect(Array.from(t)).toEqual([1, 3, 2, 4]);
  });

  it('b04 inverse of identity mat2 is identity', () => {
    // Arrange:
    const id = new Float32Array([1, 0, 0, 1]);
    // Act:
    const inv = evaluateBuiltin('inverse', [id], 300) as Float32Array;
    // Assert:
    expect(inv[0]).toBeCloseTo(1, 5);
    expect(inv[1]).toBeCloseTo(0, 5);
    expect(inv[2]).toBeCloseTo(0, 5);
    expect(inv[3]).toBeCloseTo(1, 5);
  });

  it('b05 relational lessThan with any/all reduction', () => {
    // Arrange:
    const a = new Float32Array([1, 5]);
    const b = new Float32Array([2, 4]);
    // Act:
    const lt = evaluateBuiltin('lessThan', [a, b], 100);
    const anyR = evaluateBuiltin('any', [lt], 100) as boolean;
    const allR = evaluateBuiltin('all', [lt], 100) as boolean;
    // Assert:
    expect(anyR).toBe(true);
    expect(allR).toBe(false);
  });

  it('b06 swizzle xyzw reorder and rgba alias select components', () => {
    // Arrange:
    const v = new Float32Array([1, 2, 3, 4]);
    // Act:
    const wzyx = evaluateSwizzle(v, 'wzyx') as Float32Array;
    const gg = evaluateSwizzle(v, 'gg') as Float32Array;
    // Assert:
    expect(Array.from(wzyx)).toEqual([4, 3, 2, 1]);
    expect(Array.from(gg)).toEqual([2, 2]);
  });

  it('b07 computeLod and selectMipLevel map derivatives to levels', () => {
    // Arrange: derivative context with fixed rho of 4 (lod = log2(4) = 2).
    const ctx = {
      dFdx: () => 4,
      dFdy: () => 0,
      computeRho: () => 4,
    };
    // Act:
    const lod = computeLod(null, ctx, null, null, 64, 64);
    const sel = selectMipLevel(lod, 10, LINEAR_MIPMAP_LINEAR);
    // Assert:
    expect(lod).toBeCloseTo(2, 4);
    expect(sel.level0).toBe(2);
    expect(sel.level1).toBe(3);
    expect(sel.mode).toBe('linear_blend');
  });
});

describe('builtins-coverage: sampling dispatch and lod selection', () => {
  function redLevel2x2(): { width: number; height: number; internalFormat: number; type: number; data: Uint8Array } {
    // Arrange helper: 2x2 solid red RGBA level.
    return {
      width: 2,
      height: 2,
      internalFormat: RGBA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]),
    };
  }

  function realTex2D(): Record<string, unknown> {
    // Arrange helper: minimal complete 2D texture object literal.
    return {
      id: 11,
      alive: true,
      target: TEXTURE_2D,
      levels2D: new Map([[0, redLevel2x2()]]),
      levelsCube: new Map(),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
  }

  it('b08 computeLod covers explicit, derivative, and fallback paths', () => {
    // Arrange:
    const dPdx = new Float32Array([0.1, 0.0]);
    const dPdy = new Float32Array([0.0, 0.1]);
    // Act:
    const explicit = computeLod(2.5, null, null, null, 64, 64);
    const deriv = computeLod(null, null, dPdx, dPdy, 64, 64);
    const fallback = computeLod(null, null, null, null, 64, 64);
    // Assert:
    expect(explicit).toBeCloseTo(2.5, 4);
    expect(deriv).toBeCloseTo(Math.fround(Math.log2(6.4)), 3);
    expect(fallback).toBe(0);
  });

  it('b09 selectMipLevel covers every minFilter mode and clamping', () => {
    // Arrange/Act:
    const plain = selectMipLevel(1.6, 3, NEAREST);
    const linear = selectMipLevel(1.6, 3, LINEAR);
    const nn = selectMipLevel(1.6, 3, NEAREST_MIPMAP_NEAREST);
    const ln = selectMipLevel(1.6, 3, LINEAR_MIPMAP_NEAREST);
    const nl = selectMipLevel(1.6, 3, NEAREST_MIPMAP_LINEAR);
    const ll = selectMipLevel(3.5, 3, LINEAR_MIPMAP_LINEAR);
    const unknown = selectMipLevel(1.0, 3, 0x9999);
    // Assert:
    expect(plain.mode).toBe('single');
    expect(plain.level0).toBe(0);
    expect(linear.mode).toBe('single');
    expect(nn.level0).toBe(2);
    expect(nn.mode).toBe('single');
    expect(ln.level0).toBe(2);
    expect(nl.mode).toBe('linear_blend');
    expect(nl.level0).toBe(1);
    expect(nl.level1).toBe(2);
    expect(ll.level1).toBe(3);
    expect(unknown.mode).toBe('single');
  });

  it('b10 texture2D/textureCube/textureProj sample real textures; bad inputs yield black', () => {
    // Arrange:
    const tex = realTex2D();
    const uv = new Float32Array([0.1, 0.1]);
    // Act:
    const c2d = evaluateBuiltin('texture2D', [tex, uv], 100) as Float32Array;
    const cTex = evaluateBuiltin('texture', [tex, uv], 300) as Float32Array;
    const proj = evaluateBuiltin('textureProj', [tex, new Float32Array([0.2, 0.2, 2.0])], 300) as Float32Array;
    const projZeroQ = evaluateBuiltin('textureProj', [tex, new Float32Array([0.2, 0.2, 0.0])], 300) as Float32Array;
    const noArgs = evaluateBuiltin('texture2D', [tex], 100) as Float32Array;
    const notTex = evaluateBuiltin('texture2D', [42, uv], 100) as Float32Array;
    // Assert:
    expect(c2d[0]).toBe(1);
    expect(cTex[0]).toBe(1);
    expect(proj[0]).toBe(1);
    expect(Array.from(projZeroQ)).toEqual([0, 0, 0, 1]);
    expect(Array.from(noArgs)).toEqual([0, 0, 0, 1]);
    expect(Array.from(notTex)).toEqual([0, 0, 0, 1]);
  });

  it('b11 textureLod/textureGrad/texelFetch dispatch through real sampling', () => {
    // Arrange: two-level chain, L0 red 2x2 / L1 blue 1x1.
    const tex = realTex2D();
    (tex['levels2D'] as Map<number, unknown>).set(1, {
      width: 1,
      height: 1,
      internalFormat: RGBA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array([0, 0, 255, 255]),
    });
    (tex['sampler'] as Record<string, unknown>)['minFilter'] = NEAREST_MIPMAP_NEAREST;
    const uv = new Float32Array([0.1, 0.1]);
    // Act:
    const lod0 = evaluateBuiltin('textureLod', [tex, uv, 0.0], 300) as Float32Array;
    const lod1 = evaluateBuiltin('textureLod', [tex, uv, 1.0], 300) as Float32Array;
    const grad = evaluateBuiltin('textureGrad', [tex, uv, new Float32Array([1, 0]), new Float32Array([0, 1])], 300) as Float32Array;
    const fetch = evaluateBuiltin('texelFetch', [tex, new Int32Array([0, 0]), 0], 300) as Float32Array;
    const fetchOob = evaluateBuiltin('texelFetch', [tex, new Int32Array([9, 9]), 0], 300) as Float32Array;
    // Assert:
    expect(lod0[0]).toBe(1);
    expect(lod1[2]).toBe(1);
    expect(grad.length).toBe(4);
    expect(fetch[0]).toBe(1);
    expect(Array.from(fetchOob)).toEqual([0, 0, 0, 1]);
  });

  it('b12 incomplete texture samples black; unknown names and versions fall back to 0', () => {
    // Arrange: texture missing base level 0.
    const incomplete = realTex2D();
    (incomplete['levels2D'] as Map<number, unknown>).clear();
    const uv = new Float32Array([0.1, 0.1]);
    // Act:
    const black2d = evaluateBuiltin('texture2D', [incomplete, uv], 100) as Float32Array;
    const blackFetch = evaluateBuiltin('texelFetch', [incomplete, new Int32Array([0, 0]), 0], 300) as Float32Array;
    const unknown = evaluateBuiltin('noSuchBuiltin', [1], 100);
    const badVersion = evaluateBuiltin('mix', [0, 1, 0.5], 200 as 100);
    // Assert:
    expect(Array.from(black2d)).toEqual([0, 0, 0, 1]);
    expect(Array.from(blackFetch)).toEqual([0, 0, 0, 1]);
    expect(unknown).toBe(0);
    expect(badVersion).toBe(0);
  });

  it('b13 scalar/vector/matrix constructors, trig, and step-family builtins', () => {
    // Arrange/Act:
    const s = evaluateBuiltin('sin', [0], 100) as number;
    const st = evaluateBuiltin('step', [0.5, 0.75], 100) as number;
    const ss = evaluateBuiltin('smoothstep', [0, 1, 0.5], 100) as number;
    const md = evaluateBuiltin('mod', [5.5, 2], 100) as number;
    const pw = evaluateBuiltin('pow', [2, 3], 100) as number;
    const v3 = evaluateBuiltin('vec3', [1, 2, 3], 100) as Float32Array;
    const m2 = evaluateBuiltin('mat2', [1, 2, 3, 4], 100) as Float32Array;
    const rd = evaluateBuiltin('round', [2.5], 300) as number;
    const len = evaluateBuiltin('length', [new Float32Array([3, 4])], 100) as number;
    const dist = evaluateBuiltin('distance', [new Float32Array([0, 0]), new Float32Array([3, 4])], 100) as number;
    // Assert:
    expect(s).toBe(0);
    expect(st).toBe(1);
    expect(ss).toBeCloseTo(0.5, 4);
    expect(md).toBeCloseTo(1.5, 4);
    expect(pw).toBeCloseTo(8, 4);
    expect(Array.from(v3)).toEqual([1, 2, 3]);
    expect(Array.from(m2)).toEqual([1, 2, 3, 4]);
    expect(typeof rd).toBe('number');
    expect(len).toBeCloseTo(5, 4);
    expect(dist).toBeCloseTo(5, 4);
  });

  it('b14 reflect/refract/faceforward and texture() on 3D and cube targets', () => {
    // Arrange:
    const i = new Float32Array([1, -1, 0]);
    const n = new Float32Array([0, 1, 0]);
    const refl = evaluateBuiltin('reflect', [i, n], 100) as Float32Array;
    const refr = evaluateBuiltin('refract', [i, n, 1.0], 100) as Float32Array;
    const ff = evaluateBuiltin('faceforward', [n, n, new Float32Array([0, -1, 0])], 100) as Float32Array;
    const vox = new Uint8Array(64).fill(255);
    const tex3d = {
      id: 12,
      alive: true,
      target: TEXTURE_3D,
      levels2D: new Map(),
      levelsCube: new Map(),
      levels3D: new Map([[0, { width: 2, height: 2, depth: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: vox }]]),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
    // Act:
    const c3 = evaluateBuiltin('texture', [tex3d, new Float32Array([0.1, 0.1, 0.1])], 300) as Float32Array;
    // Assert:
    expect(Array.from(refl)).toEqual([1, 1, 0]);
    expect(refr.length).toBe(3);
    expect(ff.length).toBe(3);
    expect(c3[0]).toBe(1);
  });
});

describe('builtins-coverage: cube routing, constructors, and scalar families', () => {
  function solidFace(r: number, g: number, b: number): { width: number; height: number; internalFormat: number; type: number; data: Uint8Array } {
    // Arrange helper: 2x2 solid-color cube face level.
    return { width: 2, height: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: new Uint8Array([r, g, b, 255, r, g, b, 255, r, g, b, 255, r, g, b, 255]) };
  }

  function realCube(): Record<string, unknown> {
    // Arrange helper: complete 6-face cube (POT, NEAREST, CLAMP).
    const faces = new Map([
      [TEXTURE_CUBE_MAP_POSITIVE_X, new Map([[0, solidFace(255, 0, 0)]])],
      [TEXTURE_CUBE_MAP_NEGATIVE_X, new Map([[0, solidFace(0, 255, 0)]])],
      [TEXTURE_CUBE_MAP_POSITIVE_Y, new Map([[0, solidFace(0, 0, 255)]])],
      [TEXTURE_CUBE_MAP_NEGATIVE_Y, new Map([[0, solidFace(255, 255, 255)]])],
      [TEXTURE_CUBE_MAP_POSITIVE_Z, new Map([[0, solidFace(255, 255, 0)]])],
      [TEXTURE_CUBE_MAP_NEGATIVE_Z, new Map([[0, solidFace(255, 0, 255)]])],
    ]);
    return {
      id: 13,
      alive: true,
      target: TEXTURE_CUBE_MAP,
      levels2D: new Map(),
      levelsCube: faces,
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
  }

  it('b15 textureCube routes all six major-axis faces; zero vector is safe', () => {
    // Arrange:
    const cube = realCube();
    // Act:
    const px = evaluateBuiltin('textureCube', [cube, new Float32Array([1, 0, 0])], 100) as Float32Array;
    const nx = evaluateBuiltin('textureCube', [cube, new Float32Array([-1, 0, 0])], 100) as Float32Array;
    const py = evaluateBuiltin('textureCube', [cube, new Float32Array([0, 1, 0])], 100) as Float32Array;
    const ny = evaluateBuiltin('textureCube', [cube, new Float32Array([0, -1, 0])], 100) as Float32Array;
    const pz = evaluateBuiltin('textureCube', [cube, new Float32Array([0, 0, 1])], 100) as Float32Array;
    const nz = evaluateBuiltin('textureCube', [cube, new Float32Array([0, 0, -1])], 100) as Float32Array;
    const zero = evaluateBuiltin('textureCube', [cube, new Float32Array([0, 0, 0])], 100) as Float32Array;
    // Assert:
    expect(px[0]).toBe(1);
    expect(nx[1]).toBe(1);
    expect(py[2]).toBe(1);
    expect(ny[0]).toBe(1);
    expect(pz[0]).toBe(1);
    expect(pz[1]).toBe(1);
    expect(nz[0]).toBe(1);
    expect(nz[2]).toBe(1);
    expect(zero.length).toBe(4);
    expect(Number.isNaN(zero[0])).toBe(false);
  });

  it('b16 textureGrad null gradients, texelFetch coord forms, texture() on array', () => {
    // Arrange:
    const tex = {
      id: 14,
      alive: true,
      target: TEXTURE_2D,
      levels2D: new Map([[0, { width: 2, height: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]) }]]),
      levelsCube: new Map(),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
    const uv = new Float32Array([0.1, 0.1]);
    const vox = new Uint8Array(64).fill(255);
    const arr = {
      id: 15,
      alive: true,
      target: TEXTURE_2D_ARRAY,
      levels2D: new Map(),
      levelsCube: new Map(),
      levels2DArray: new Map([[0, { width: 2, height: 2, depth: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: vox }]]),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
    // Act:
    const gradNull = evaluateBuiltin('textureGrad', [tex, uv, 0, 0], 300) as Float32Array;
    const fetchF32 = evaluateBuiltin('texelFetch', [tex, new Float32Array([1, 0]), 0], 300) as Float32Array;
    const fetchU32 = evaluateBuiltin('texelFetch', [tex, new Uint32Array([0, 1]), 0], 300) as Float32Array;
    const fetchNegLod = evaluateBuiltin('texelFetch', [tex, new Int32Array([0, 0]), -1], 300) as Float32Array;
    const cArr = evaluateBuiltin('texture', [arr, new Float32Array([0.1, 0.1, 0.0])], 300) as Float32Array;
    // Assert:
    expect(gradNull.length).toBe(4);
    expect(fetchF32[1]).toBe(1);
    expect(fetchU32[2]).toBe(1);
    expect(Array.from(fetchNegLod)).toEqual([0, 0, 0, 1]);
    expect(cArr[0]).toBe(1);
  });

  it('b17 constructors, transpose/inverse, and relational reductions', () => {
    // Arrange/Act:
    const iv = evaluateBuiltin('ivec3', [1, 2, 3], 100) as Int32Array;
    const uv = evaluateBuiltin('uvec2', [4, 5], 300) as Uint32Array;
    const bv = evaluateBuiltin('bvec2', [1, 0], 100) as boolean[];
    const m3 = evaluateBuiltin('mat3', [1, 0, 0, 0, 1, 0, 0, 0, 1], 100) as Float32Array;
    const t3 = evaluateBuiltin('transpose', [new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9])], 300) as Float32Array;
    const inv3 = evaluateBuiltin('inverse', [new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1])], 300) as Float32Array;
    const gt = evaluateBuiltin('greaterThan', [new Float32Array([3, 1]), new Float32Array([2, 2])], 100);
    const eq = evaluateBuiltin('equal', [new Float32Array([1, 2]), new Float32Array([1, 2])], 100);
    const ne = evaluateBuiltin('notEqual', [new Float32Array([1, 2]), new Float32Array([1, 3])], 100);
    const no = evaluateBuiltin('not', [gt], 100);
    const isna = evaluateBuiltin('isnan', [0], 300) as boolean;
    const isin = evaluateBuiltin('isinf', [0], 300) as boolean;
    // Assert:
    expect(Array.from(iv)).toEqual([1, 2, 3]);
    expect(Array.from(uv)).toEqual([4, 5]);
    expect(bv).toEqual([true, false]);
    expect(m3.length).toBe(9);
    expect(Array.from(t3)).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9]);
    expect(inv3[0]).toBeCloseTo(1, 5);
    expect(evaluateBuiltin('any', [gt], 100)).toBe(true);
    expect(evaluateBuiltin('all', [eq], 100)).toBe(true);
    expect(evaluateBuiltin('any', [ne], 100)).toBe(true);
    expect(evaluateBuiltin('any', [no], 100)).toBe(true);
    expect(evaluateBuiltin('all', [no], 100)).toBe(false);
    expect(isna).toBe(false);
    expect(isin).toBe(false);
  });

  it('b18 scalar and vector math families match analytic values', () => {
    // Arrange/Act:
    const mixV = evaluateBuiltin('mix', [new Float32Array([0, 10]), new Float32Array([10, 20]), 0.5], 100) as Float32Array;
    const clampV = evaluateBuiltin('clamp', [new Float32Array([-2, 5]), 0, 1], 100) as Float32Array;
    const absV = evaluateBuiltin('abs', [new Float32Array([-3, 4])], 100) as Float32Array;
    const flr = evaluateBuiltin('floor', [2.7], 100) as number;
    const cel = evaluateBuiltin('ceil', [2.2], 100) as number;
    const frc = evaluateBuiltin('fract', [2.75], 100) as number;
    const sgn = evaluateBuiltin('sign', [-4], 100) as number;
    const mn = evaluateBuiltin('min', [3, 7], 100) as number;
    const mx = evaluateBuiltin('max', [new Float32Array([3, 9]), new Float32Array([7, 2])], 100) as Float32Array;
    const at = evaluateBuiltin('atan', [1, 1], 100) as number;
    const sq = evaluateBuiltin('sqrt', [9], 100) as number;
    const ex = evaluateBuiltin('exp', [0], 100) as number;
    const lg = evaluateBuiltin('log', [1], 100) as number;
    // Assert:
    expect(Array.from(mixV)).toEqual([5, 15]);
    expect(Array.from(clampV)).toEqual([0, 1]);
    expect(Array.from(absV)).toEqual([3, 4]);
    expect(flr).toBe(2);
    expect(cel).toBe(3);
    expect(frc).toBeCloseTo(0.75, 4);
    expect(sgn).toBe(-1);
    expect(mn).toBe(3);
    expect(Array.from(mx)).toEqual([7, 9]);
    expect(at).toBeCloseTo(Math.fround(Math.atan2(1, 1)), 4);
    expect(sq).toBe(3);
    expect(ex).toBe(1);
    expect(lg).toBe(0);
  });

  it('b19 computeLod context fallbacks and selectMipLevel edge clamps', () => {
    // Arrange:
    const noRho = {} as NonNullable<Parameters<typeof computeLod>[1]>;
    // Act:
    const ctxNoRho = computeLod(null, noRho, null, null, 64, 64);
    const halfDeriv = computeLod(null, null, new Float32Array([0.1, 0]), null, 64, 64);
    const negLod = selectMipLevel(-1.0, 3, NEAREST_MIPMAP_NEAREST);
    const overLod = selectMipLevel(99.0, 3, NEAREST_MIPMAP_NEAREST);
    const blendFrac = selectMipLevel(1.25, 5, LINEAR_MIPMAP_LINEAR);
    // Assert:
    expect(ctxNoRho).toBe(0);
    expect(halfDeriv).toBe(0);
    expect(negLod.level0).toBe(0);
    expect(overLod.level0).toBe(3);
    expect(blendFrac.level0).toBe(1);
    expect(blendFrac.level1).toBe(2);
    expect(blendFrac.fraction).toBeCloseTo(0.25, 4);
  });

  it('b20 swizzle aliases and faceforward branch selection', () => {
    // Arrange:
    const v = new Float32Array([1, 2, 3, 4]);
    // Act:
    const rgba = evaluateSwizzle(v, 'rgba') as Float32Array;
    const xyxy = evaluateSwizzle(v, 'xyxy') as Float32Array;
    const n = new Float32Array([0, 1, 0]);
    const ffNeg = evaluateBuiltin('faceforward', [n, n, new Float32Array([0, 1, 0])], 100) as Float32Array;
    const ffPos = evaluateBuiltin('faceforward', [n, n, new Float32Array([0, -1, 0])], 100) as Float32Array;
    // Assert:
    expect(Array.from(rgba)).toEqual([1, 2, 3, 4]);
    expect(Array.from(xyxy)).toEqual([1, 2, 1, 2]);
    expect(ffNeg[1]).toBe(-1);
    expect(ffPos[1]).toBe(1);
  });
});

describe('builtins-coverage: scalar tails, ctors, dispatch guards', () => {
  function redTex2D(): Record<string, unknown> {
    // Arrange helper: complete 2x2 red 2D texture with NEAREST filtering.
    return {
      id: 21,
      alive: true,
      target: TEXTURE_2D,
      levels2D: new Map([[0, { width: 2, height: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]) }]]),
      levelsCube: new Map(),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
  }

  function volTex3D(): Record<string, unknown> {
    // Arrange helper: complete 2x2x2 3D texture, x=0 red / x=1 blue.
    const vox = new Uint8Array([
      255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255,
      0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255,
    ]);
    return {
      id: 22,
      alive: true,
      target: TEXTURE_3D,
      levels2D: new Map(),
      levels3D: new Map([[0, { width: 2, height: 2, depth: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: vox }]]),
      levelsCube: new Map(),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
  }

  function arrTex(): Record<string, unknown> {
    // Arrange helper: complete 2-layer 2D-array texture, layer 1 green.
    const layer = (g: number): { width: number; height: number; internalFormat: number; type: number; data: Uint8Array } => ({
      width: 1,
      height: 1,
      internalFormat: RGBA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array([0, g, 0, 255]),
    });
    return {
      id: 23,
      alive: true,
      target: TEXTURE_2D_ARRAY,
      levels2D: new Map(),
      levels2DArray: new Map([[0, { width: 1, height: 1, depth: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: new Uint8Array([0, 0, 0, 255, 0, 255, 0, 255]) }]]),
      levelsCube: new Map(),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
  }

  it('b21 unary/binary scalar tails and scalar geometric forms', () => {
    // Arrange:
    const v = new Float32Array([5, 1]);
    // Act:
    const badAbs = evaluateBuiltin('abs', ['nope'], 100);
    const minSV = evaluateBuiltin('min', [2, v], 100) as Float32Array;
    const minBad = evaluateBuiltin('min', ['a', 'b'], 100);
    const atan1 = evaluateBuiltin('atan', [0.5], 100);
    const atan2 = evaluateBuiltin('atan', [1, 1], 100);
    const dotS = evaluateBuiltin('dot', [2, 3], 100);
    const dotBad = evaluateBuiltin('dot', ['a', 'b'], 100);
    const lenS = evaluateBuiltin('length', [3], 100);
    const lenBad = evaluateBuiltin('length', ['x'], 100);
    const distS = evaluateBuiltin('distance', [5, 2], 100);
    const distBad = evaluateBuiltin('distance', ['x', 'y'], 100);
    // Assert:
    expect(badAbs).toBe(0);
    expect(Array.from(minSV)).toEqual([2, 1]);
    expect(minBad).toBe(0);
    expect(atan1).toBeCloseTo(Math.atan(0.5), 5);
    expect(atan2).toBeCloseTo(Math.PI / 4, 5);
    expect(dotS).toBe(6);
    expect(dotBad).toBe(0);
    expect(lenS).toBe(3);
    expect(lenBad).toBe(0);
    expect(distS).toBe(3);
    expect(distBad).toBe(0);
  });

  it('b22 mix/clamp/smoothstep boolean, bvec, and fallback forms', () => {
    // Arrange:
    const v1 = new Float32Array([0, 10]);
    const v2 = new Float32Array([100, 110]);
    // Act:
    const mixB = evaluateBuiltin('mix', [1, 2, true], 100);
    const mixBad = evaluateBuiltin('mix', [1, 2, 'z'], 100);
    const mixVB = evaluateBuiltin('mix', [v1, v2, true], 100) as Float32Array;
    const mixVVB = evaluateBuiltin('mix', [v1, v2, [true, false]], 100) as Float32Array;
    const mixVS = evaluateBuiltin('mix', [v1, v2, 0.5], 100) as Float32Array;
    const clampV = evaluateBuiltin('clamp', [v1, 0, 5], 100) as Float32Array;
    const clampBad = evaluateBuiltin('clamp', ['x', 0, 1], 100);
    const ssV = evaluateBuiltin('smoothstep', [0, 10, v1], 100) as Float32Array;
    const ssBad = evaluateBuiltin('smoothstep', [0, 1, 'x'], 100);
    // Assert:
    expect(mixB).toBe(2);
    expect(mixBad).toBe(0);
    expect(Array.from(mixVB)).toEqual([100, 110]);
    expect(Array.from(mixVVB)).toEqual([100, 10]);
    expect(Array.from(mixVS)).toEqual([50, 60]);
    expect(Array.from(clampV)).toEqual([0, 5]);
    expect(clampBad).toBe(0);
    expect(ssV[0]).toBe(0);
    expect(ssV[1]).toBe(1);
    expect(ssBad).toBe(0);
  });

  it('b23 normalize/reflect/refract/faceforward/cross scalar and guard forms', () => {
    // Arrange:
    const zero2 = new Float32Array([0, 0]);
    // Act:
    const nNeg = evaluateBuiltin('normalize', [-3], 100);
    const nZeroS = evaluateBuiltin('normalize', [0], 100);
    const nZeroV = evaluateBuiltin('normalize', [zero2], 100) as Float32Array;
    const nBad = evaluateBuiltin('normalize', ['x'], 100);
    const reflS = evaluateBuiltin('reflect', [2, 3], 100);
    const reflBad = evaluateBuiltin('reflect', ['a', 'b'], 100);
    const refrTIR = evaluateBuiltin('refract', [new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]), 2], 100) as Float32Array;
    const refrBad = evaluateBuiltin('refract', ['a', 'b', 'c'], 100);
    const ffS = evaluateBuiltin('faceforward', [5, 2, -3], 100);
    const ffBad = evaluateBuiltin('faceforward', ['a', 'b', 'c'], 100);
    const crossBad = evaluateBuiltin('cross', [1, 2], 100) as Float32Array;
    // Assert:
    expect(nNeg).toBe(-1);
    expect(nZeroS).toBe(0);
    expect(Array.from(nZeroV)).toEqual([0, 0]);
    expect(nBad).toBe(0);
    expect(reflS).toBe(-34);
    expect(reflBad).toBe(0);
    expect(Array.from(refrTIR)).toEqual([0, 0, 0]);
    expect(refrBad).toBe(0);
    expect(ffS).toBe(5);
    expect(ffBad).toBe(0);
    expect(Array.from(crossBad)).toEqual([0, 0, 0]);
  });

  it('b24 vector, ivec, uvec, bvec, and matrix constructor forms', () => {
    // Act:
    const vec2s = evaluateBuiltin('vec2', [7], 100) as Float32Array;
    const vec3e = evaluateBuiltin('vec3', [], 100) as Float32Array;
    const vec4b = evaluateBuiltin('vec4', [[true, false]], 100) as Float32Array;
    const ivec = evaluateBuiltin('ivec2', [2.7], 100) as Int32Array;
    const ivece = evaluateBuiltin('ivec2', [], 100) as Int32Array;
    const uvec = evaluateBuiltin('uvec2', [-1], 300) as Uint32Array;
    const uvece = evaluateBuiltin('uvec2', [], 300) as Uint32Array;
    const bvec1 = evaluateBuiltin('bvec2', [true], 100) as boolean[];
    const bvec2 = evaluateBuiltin('bvec3', [1, 0], 100) as boolean[];
    const bvece = evaluateBuiltin('bvec2', [], 100) as boolean[];
    const mat3d = evaluateBuiltin('mat3', [2], 100) as Float32Array;
    const mat2f = evaluateBuiltin('mat2', [1, 2, 3, 4], 100) as Float32Array;
    const mat2e = evaluateBuiltin('mat2', [], 100) as Float32Array;
    // Assert:
    expect(Array.from(vec2s)).toEqual([7, 7]);
    expect(Array.from(vec3e)).toEqual([0, 0, 0]);
    expect(Array.from(vec4b)).toEqual([1, 0, 0, 0]);
    expect(Array.from(ivec)).toEqual([2, 2]);
    expect(Array.from(ivece)).toEqual([0, 0]);
    expect(Array.from(uvec)).toEqual([4294967295, 4294967295]);
    expect(Array.from(uvece)).toEqual([0, 0]);
    expect(bvec1).toEqual([true, true]);
    expect(bvec2).toEqual([true, false, false]);
    expect(bvece).toEqual([false, false]);
    expect(Array.from(mat3d)).toEqual([2, 0, 0, 0, 2, 0, 0, 0, 2]);
    expect(Array.from(mat2f)).toEqual([1, 2, 3, 4]);
    expect(Array.from(mat2e)).toEqual([0, 0, 0, 0]);
  });

  it('b25 transpose orientations and inverse mat3/mat4/singular paths', () => {
    // Arrange: column-major identity matrices.
    const m3 = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    const m4 = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    // Act:
    const t3 = evaluateBuiltin('transpose', [m3], 300) as Float32Array;
    const t6 = evaluateBuiltin('transpose', [new Float32Array([1, 2, 3, 4, 5, 6])], 300) as Float32Array;
    const t5 = evaluateBuiltin('transpose', [new Float32Array(5)], 300) as Float32Array;
    const tBad = evaluateBuiltin('transpose', ['x'], 300);
    const i3 = evaluateBuiltin('inverse', [m3], 300) as Float32Array;
    const i4 = evaluateBuiltin('inverse', [m4], 300) as Float32Array;
    const i5 = evaluateBuiltin('inverse', [new Float32Array(5)], 300) as Float32Array;
    const iSing = evaluateBuiltin('inverse', [new Float32Array(4)], 300) as Float32Array;
    // Assert:
    expect(Array.from(t3)).toEqual(Array.from(m3));
    expect(t6.length).toBe(6);
    expect(t5.length).toBe(5);
    expect(tBad).toBe(0);
    expect(Array.from(i3)).toEqual(Array.from(m3));
    // NOTE: cofactor arithmetic yields -0 in zero slots; +0 normalizes for comparison.
    expect(Array.from(i4).map((x) => x + 0)).toEqual(Array.from(m4));
    expect(i5.length).toBe(5);
    expect(Array.from(iSing)).toEqual([0, 0, 0, 0]);
  });

  it('b26 swizzle kinds, relational scalars, and boolean reductions', () => {
    // Act:
    const swB = evaluateBuiltin('x', [true], 100);
    const swI = evaluateSwizzle(new Int32Array([1, 2]), 'yx') as Int32Array;
    const swU = evaluateSwizzle(new Uint32Array([3, 4]), 'yy') as Uint32Array;
    const swBB = evaluateSwizzle([true, false], 'xy') as boolean[];
    const swBad = evaluateSwizzle('s' as unknown as Value, 'x');
    const ltS = evaluateBuiltin('lessThan', [1, 2], 100) as boolean[];
    const geI = evaluateBuiltin('greaterThanEqual', [new Int32Array([3]), 3], 100) as boolean[];
    const ltBad = evaluateBuiltin('lessThan', ['a', 'b'], 100);
    const anyT = evaluateBuiltin('any', [true], 100);
    const anyArity = evaluateBuiltin('any', [true, false], 100);
    const allF = evaluateBuiltin('all', [false], 100);
    const allArity = evaluateBuiltin('all', [], 100);
    const notT = evaluateBuiltin('not', [true], 100);
    const notF = evaluateBuiltin('not', [new Float32Array([0])], 100) as Float32Array;
    const notI = evaluateBuiltin('not', [new Int32Array([5])], 100) as Int32Array;
    const notBad = evaluateBuiltin('not', ['x'], 100);
    const isnanBad = evaluateBuiltin('isnan', ['x'], 300);
    const isinfBad = evaluateBuiltin('isinf', ['x'], 300);
    const isinfNum = evaluateBuiltin('isinf', [Infinity], 300);
    // Assert:
    expect(swB).toBe(0);
    expect(Array.from(swI)).toEqual([2, 1]);
    expect(Array.from(swU)).toEqual([4, 4]);
    expect(swBB).toEqual([true, false]);
    expect(swBad).toBe(0);
    expect(ltS).toEqual([true]);
    expect(geI).toEqual([true]);
    expect(ltBad).toBe(0);
    expect(anyT).toBe(true);
    expect(anyArity).toBe(false);
    expect(allF).toBe(false);
    expect(allArity).toBe(false);
    expect(notT).toBe(false);
    expect(Array.from(notF)).toEqual([-1]);
    expect(Array.from(notI)).toEqual([-6]);
    expect(notBad).toBe(0);
    expect(isnanBad).toBe(false);
    expect(isinfBad).toBe(false);
    expect(isinfNum).toBe(true);
  });

  it('b27 texture dispatch routes 3D/array targets and guards bad inputs', () => {
    // Arrange:
    const tex = redTex2D();
    const vol = volTex3D();
    const arr = arrTex();
    const uv = new Float32Array([0.1, 0.1]);
    // Act: 3D and array targets through the legacy texture2D entry point.
    const via3D = evaluateBuiltin('texture2D', [vol, new Float32Array([0.1, 0.1, 0.1])], 100) as Float32Array;
    const viaArr = evaluateBuiltin('texture2D', [arr, new Float32Array([0.1, 0.1, 1])], 100) as Float32Array;
    const biased = evaluateBuiltin('texture2D', [tex, uv, 0.5], 100) as Float32Array;
    const short2D = evaluateBuiltin('texture2D', [tex], 100) as Float32Array;
    const nonTex2D = evaluateBuiltin('texture2D', [5, uv], 100) as Float32Array;
    const shortCube = evaluateBuiltin('textureCube', [tex], 100) as Float32Array;
    const nonTexCube = evaluateBuiltin('textureCube', [5, uv], 100) as Float32Array;
    const shortTex = evaluateBuiltin('texture', [tex], 300) as Float32Array;
    const nonTex = evaluateBuiltin('texture', [5, uv], 300) as Float32Array;
    const projShort = evaluateBuiltin('textureProj', [tex, uv], 300) as Float32Array;
    const projZeroQ = evaluateBuiltin('textureProj', [tex, new Float32Array([0.1, 0.1, 0])], 300) as Float32Array;
    const projArity = evaluateBuiltin('textureProj', [tex], 300) as Float32Array;
    const projNonTex = evaluateBuiltin('textureProj', [5, new Float32Array([0.1, 0.1, 1])], 300) as Float32Array;
    const lodArity = evaluateBuiltin('textureLod', [tex, uv], 300) as Float32Array;
    const lodNonTex = evaluateBuiltin('textureLod', [5, uv, 0], 300) as Float32Array;
    const lodBadCoords = evaluateBuiltin('textureLod', [tex, 'x', 0], 300) as Float32Array;
    const gradArity = evaluateBuiltin('textureGrad', [tex, uv, uv], 300) as Float32Array;
    const gradNonTex = evaluateBuiltin('textureGrad', [5, uv, uv, uv], 300) as Float32Array;
    const gradBadCoords = evaluateBuiltin('textureGrad', [tex, 'x', uv, uv], 300) as Float32Array;
    const fetchArity = evaluateBuiltin('texelFetch', [tex, uv], 300) as Float32Array;
    const fetchNonTex = evaluateBuiltin('texelFetch', [5, uv, 0], 300) as Float32Array;
    const fetchStrLod = evaluateBuiltin('texelFetch', [tex, new Int32Array([0, 0]), 'x'], 300) as Float32Array;
    // Assert:
    expect(via3D[0]).toBe(1);
    expect(viaArr[1]).toBe(1);
    expect(biased[0]).toBe(1);
    for (const c of [short2D, nonTex2D, shortCube, nonTexCube, shortTex, nonTex, projShort, projZeroQ, projArity, projNonTex, lodArity, lodNonTex, lodBadCoords, gradArity, gradNonTex, gradBadCoords, fetchArity, fetchNonTex]) {
      expect(Array.from(c)).toEqual([0, 0, 0, 1]);
    }
    expect(fetchStrLod[0]).toBe(1);
  });

  it('b28 fetch guards, lod contexts, and builtin-table fallbacks', () => {
    // Arrange:
    const tex = redTex2D();
    const vol = volTex3D();
    const uv = new Float32Array([0.1, 0.1]);
    const evilTex = { id: 99, alive: true, target: TEXTURE_2D, sampler: (tex as Record<string, unknown>)['sampler'] };
    Object.defineProperty(evilTex, 'levels2D', { get() { throw new Error('boom'); } });
    const throwingGrad = new Proxy(new Float32Array([1, 0]), { get() { throw new Error('boom'); } });
    const evilArgs = [1] as unknown as Parameters<typeof evaluateBuiltin>[1];
    (evilArgs as unknown as Record<symbol, unknown>)[Symbol.iterator] = () => { throw new Error('boom'); };
    // Act:
    const badCoords = evaluateBuiltin('texelFetch', [tex, 'x', 0], 300) as Float32Array;
    const negLod = evaluateBuiltin('texelFetch', [tex, new Int32Array([0, 0]), -1], 300) as Float32Array;
    const nanXY = evaluateBuiltin('texelFetch', [tex, new Float32Array([NaN, 0]), 0], 300) as Float32Array;
    const nanZ = evaluateBuiltin('texelFetch', [vol, new Int32Array([0, 0, 0]).constructor === Int32Array ? new Float32Array([0, 0, NaN]) : new Float32Array(3), 0], 300) as Float32Array;
    const missingLvl = evaluateBuiltin('texelFetch', [vol, new Int32Array([0, 0, 0]), 5], 300) as Float32Array;
    const oob3 = evaluateBuiltin('texelFetch', [vol, new Int32Array([9, 9, 9]), 0], 300) as Float32Array;
    const fetch3 = evaluateBuiltin('texelFetch', [vol, new Int32Array([0, 0, 0]), 0], 300) as Float32Array;
    const noMap = evaluateBuiltin('texture2D', [{ levels2D: {}, id: 1 }, uv], 100) as Float32Array;
    const noId = evaluateBuiltin('texture2D', [{ levels2D: new Map(), id: 'x' }, uv], 100) as Float32Array;
    const evilRes = evaluateBuiltin('texture2D', [evilTex, uv], 100) as Float32Array;
    const badSampleCoords = evaluateBuiltin('texture2D', [tex, 'nope'], 100) as Float32Array;
    const badVolCoords = evaluateBuiltin('texture', [vol, 'x'], 300) as Float32Array;
    const noRho = computeLod(null, {} as NonNullable<Parameters<typeof computeLod>[1]>, null, null, 2, 2);
    const throwingRho = computeLod(
      null,
      {
        dFdx: () => 0,
        dFdy: () => 0,
        computeRho: () => { throw new Error('boom'); },
      } as NonNullable<Parameters<typeof computeLod>[1]>,
      null,
      null,
      2,
      2,
    );
    const throwingGradRes = computeLod(null, null, throwingGrad, new Float32Array([0, 1]), 2, 2);
    const evilCall = evaluateBuiltin('sin', evilArgs, 100);
    // Assert:
    for (const c of [badCoords, negLod, nanXY, nanZ, missingLvl, oob3, noMap, noId, evilRes, badSampleCoords, badVolCoords]) {
      expect(Array.from(c)).toEqual([0, 0, 0, 1]);
    }
    expect(fetch3[0]).toBe(1);
    expect(noRho).toBe(0);
    expect(throwingRho).toBe(0);
    expect(throwingGradRes).toBe(0);
    expect(evilCall).toBe(0);
  });
});
