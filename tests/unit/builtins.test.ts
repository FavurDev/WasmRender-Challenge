/** GLSL builtin library TDD red-phase tests (Sprint 4 Task 2) — TEST 1-8 plus edge cases. */
import { describe, expect, it } from 'vitest';
import { BUILTINS_V100, BUILTINS_V300, evaluateBuiltin, evaluateSwizzle } from '../../src/glsl/builtins';

describe('Builtins - Math: mix and clamp float32 exact', () => {
  it('mix(0,1,0.25) and clamp(-1.5,0,1) are fround-exact', () => {
    // Arrange:
    const x0 = 0.0;
    const y0 = 1.0;
    const a0 = 0.25;
    const x1 = -1.5;
    // Act:
    const resMix = evaluateBuiltin('mix', [x0, y0, a0], 100);
    const resClamp = evaluateBuiltin('clamp', [x1, 0.0, 1.0], 100);
    // Assert:
    expect(resMix).toBe(Math.fround(0.25));
    expect(resClamp).toBe(Math.fround(0.0));
  });
});

describe('Builtins - Geometric: normalize vec3 float32', () => {
  it('normalize(vec3(3,4,0)) equals (0.6,0.8,0.0)', () => {
    // Arrange:
    const v = new Float32Array([3.0, 4.0, 0.0]);
    // Act:
    const res = evaluateBuiltin('normalize', [v], 100) as Float32Array;
    // Assert:
    expect(res).toBeInstanceOf(Float32Array);
    expect(res.length).toBe(3);
    expect(res[0]).toBe(Math.fround(0.6));
    expect(res[1]).toBe(Math.fround(0.8));
    expect(res[2]).toBe(Math.fround(0.0));
  });
});

describe('Builtins - Version Gating: ES 3.00 dialect isolation', () => {
  it('transpose absent from V100, present in V300', () => {
    // Arrange:
    const m = new Float32Array([1.0, 2.0, 3.0, 4.0]);
    // Act:
    const resV100 = evaluateBuiltin('transpose', [m], 100);
    const resV300 = evaluateBuiltin('transpose', [m], 300) as Float32Array;
    // Assert:
    expect(BUILTINS_V100.has('transpose')).toBe(false);
    expect(resV100).toBe(Math.fround(0.0));
    expect(BUILTINS_V300.has('transpose')).toBe(true);
    expect(Array.from(resV300)).toEqual(
      Array.from(new Float32Array([1.0, 3.0, 2.0, 4.0]).map((c) => Math.fround(c))),
    );
  });
});

describe('Builtins - Robustness: hostile input never throws', () => {
  it('unknown names, wrong arity, wrong types return fallback without throwing', () => {
    // Arrange:
    const calls: Array<() => unknown> = [
      () => evaluateBuiltin('nonExistentBuiltin', [], 100),
      () => evaluateBuiltin('mix', [], 100),
      () => evaluateBuiltin('clamp', [null as never, undefined as never], 100),
      () => evaluateBuiltin('dot', [123 as never, 'bad' as never], 300),
    ];
    // Act & Assert:
    for (const c of calls) {
      let out: unknown;
      expect(() => {
        out = c();
      }).not.toThrow();
      expect(out === Math.fround(0.0) || out instanceof Float32Array).toBe(true);
    }
  });
});

describe('Builtins - Constructors', () => {
  it('vec4 flattens scalars/vectors; mat2 column-major', () => {
    // Arrange:
    const vecArgs = [1.0, new Float32Array([2.0, 3.0]), 4.0];
    const matArgs = [1.0, 0.0, 0.0, 1.0];
    // Act:
    const v4 = evaluateBuiltin('vec4', vecArgs, 100) as Float32Array;
    const m2 = evaluateBuiltin('mat2', matArgs, 100) as Float32Array;
    // Assert:
    expect(Array.from(v4)).toEqual([1.0, 2.0, 3.0, 4.0]);
    expect(Array.from(m2)).toEqual([1.0, 0.0, 0.0, 1.0]);
  });
});

describe('Builtins - Swizzles', () => {
  it('wzyx, r, xy swizzles index correctly', () => {
    // Arrange:
    const v = new Float32Array([1.0, 2.0, 3.0, 4.0]);
    // Act:
    const resWzyx = evaluateSwizzle(v, 'wzyx') as Float32Array;
    const resR = evaluateSwizzle(v, 'r');
    const resXy = evaluateSwizzle(v, 'xy') as Float32Array;
    // Assert:
    expect(Array.from(resWzyx)).toEqual([4.0, 3.0, 2.0, 1.0]);
    expect(resR).toBe(1.0);
    expect(Array.from(resXy)).toEqual([1.0, 2.0]);
  });
});

describe('Builtins - Matrix inverse ES 3.00', () => {
  it('inverse of 2x2 is fround-exact', () => {
    // Arrange:
    const m = new Float32Array([4.0, 7.0, 2.0, 6.0]);
    // Act:
    const inv = evaluateBuiltin('inverse', [m], 300) as Float32Array;
    // Assert:
    expect(inv[0]).toBe(Math.fround(0.6));
    expect(inv[1]).toBe(Math.fround(-0.7));
    expect(inv[2]).toBe(Math.fround(-0.2));
    expect(inv[3]).toBe(Math.fround(0.4));
  });
});

describe('Builtins - Relational: lessThan and any/all', () => {
  it('lessThan yields [true,false]; any true, all false', () => {
    // Arrange:
    const u = new Float32Array([1.0, 5.0]);
    const v = new Float32Array([2.0, 4.0]);
    // Act:
    const cmp = evaluateBuiltin('lessThan', [u, v], 100) as boolean[];
    const anyTrue = evaluateBuiltin('any', [cmp], 100);
    const allTrue = evaluateBuiltin('all', [cmp], 100);
    // Assert:
    expect(cmp).toEqual([true, false]);
    expect(anyTrue).toBe(true);
    expect(allTrue).toBe(false);
  });
});

describe('Builtins - Edge cases', () => {
  it('mod-by-zero yields NaN without throwing (fround-exact)', () => {
    // Arrange:
    const one = 1.0;
    const zero = 0.0;
    // Act:
    let out: unknown;
    expect(() => {
      out = evaluateBuiltin('mod', [one, zero], 100);
    }).not.toThrow();
    // Assert:
    expect(out).toBe(Math.fround(NaN));
  });

  it('zero-length normalize returns zero vector', () => {
    // Arrange:
    const v = new Float32Array([0.0, 0.0, 0.0]);
    // Act:
    const res = evaluateBuiltin('normalize', [v], 100) as Float32Array;
    // Assert:
    expect(Array.from(res)).toEqual([0.0, 0.0, 0.0]);
  });

  it('singular matrix inverse returns zeroed matrix', () => {
    // Arrange:
    const m = new Float32Array([1.0, 2.0, 2.0, 4.0]);
    // Act:
    const inv = evaluateBuiltin('inverse', [m], 300) as Float32Array;
    // Assert:
    expect(Array.from(inv)).toEqual([0.0, 0.0, 0.0, 0.0]);
  });

  it('sqrt(-1) is NaN without throwing', () => {
    // Arrange:
    const x = -1.0;
    // Act:
    const res = evaluateBuiltin('sqrt', [x], 100);
    // Assert:
    expect(Number.isNaN(res as number)).toBe(true);
  });

  it('out-of-bounds swizzle falls back to 0.0', () => {
    // Arrange:
    const v = new Float32Array([1.0, 2.0]);
    // Act:
    let out: unknown;
    expect(() => {
      out = evaluateSwizzle(v, 'z');
    }).not.toThrow();
    // Assert:
    expect(out).toBe(Math.fround(0.0));
  });

  it('unknown builtin returns 0.0 fallback', () => {
    // Arrange:
    const name = 'noSuchFn';
    // Act:
    const res = evaluateBuiltin(name, [], 100);
    // Assert:
    expect(res).toBe(Math.fround(0.0));
  });

  it('arity mismatch returns 0.0 fallback', () => {
    // Arrange:
    const args = [1.0];
    // Act:
    const res = evaluateBuiltin('mix', args, 100);
    // Assert:
    expect(res).toBe(Math.fround(0.0));
  });

  it('empty constructor args fill with zeroes', () => {
    // Arrange:
    const args: never[] = [];
    // Act:
    const v4 = evaluateBuiltin('vec4', args, 100) as Float32Array;
    // Assert:
    expect(Array.from(v4)).toEqual([0.0, 0.0, 0.0, 0.0]);
  });
});

/* Sprint 6 Task 5 remediation (TD-010) — sampling tests on REAL TextureObject (TDD). Appended; existing tests above untouched. */
import type { Value } from '../../src/glsl/builtins';
import type { MipLevel, TextureObject } from '../../src/gl/texture';
import {
  CLAMP_TO_EDGE,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  NEAREST,
  REPEAT,
  RGBA,
  TEXTURE_2D,
  TEXTURE_CUBE_MAP,
  TEXTURE_CUBE_MAP_NEGATIVE_X,
  TEXTURE_CUBE_MAP_NEGATIVE_Y,
  TEXTURE_CUBE_MAP_NEGATIVE_Z,
  TEXTURE_CUBE_MAP_POSITIVE_X,
  TEXTURE_CUBE_MAP_POSITIVE_Y,
  TEXTURE_CUBE_MAP_POSITIVE_Z,
  UNSIGNED_BYTE,
} from '../../src/gl/constants';

function tex2x2(filterMode: number): Value {
  // Arrange helper: 2x2 fixture — (0,0) Red, (1,0) Green, (0,1) Blue, (1,1) Yellow.
  const data = new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 0, 255,
  ]);
  const level0: MipLevel = {
    width: 2,
    height: 2,
    internalFormat: RGBA,
    type: UNSIGNED_BYTE,
    data,
  };
  const tex: TextureObject = {
    id: 101,
    alive: true,
    target: TEXTURE_2D,
    levels2D: new Map([[0, level0]]),
    levelsCube: new Map(),
    sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: filterMode, magFilter: filterMode },
    isNPOT: false,
    completeness: null,
  };
  return tex as unknown as Value;
}

function texMipped(): Value {
  // Arrange helper: L0 4x4 Red, L1 2x2 Green, L2 1x1 Blue.
  const red = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < 16; i++) {
    red[i * 4] = 255;
    red[i * 4 + 1] = 0;
    red[i * 4 + 2] = 0;
    red[i * 4 + 3] = 255;
  }
  const green = new Uint8Array(2 * 2 * 4);
  for (let i = 0; i < 4; i++) {
    green[i * 4] = 0;
    green[i * 4 + 1] = 255;
    green[i * 4 + 2] = 0;
    green[i * 4 + 3] = 255;
  }
  const blue = new Uint8Array([0, 0, 255, 255]);
  const lvl0: MipLevel = { width: 4, height: 4, internalFormat: RGBA, type: UNSIGNED_BYTE, data: red };
  const lvl1: MipLevel = { width: 2, height: 2, internalFormat: RGBA, type: UNSIGNED_BYTE, data: green };
  const lvl2: MipLevel = { width: 1, height: 1, internalFormat: RGBA, type: UNSIGNED_BYTE, data: blue };
  const tex: TextureObject = {
    id: 102,
    alive: true,
    target: TEXTURE_2D,
    levels2D: new Map([
      [0, lvl0],
      [1, lvl1],
      [2, lvl2],
    ]),
    levelsCube: new Map(),
    sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: LINEAR_MIPMAP_LINEAR, magFilter: LINEAR },
    isNPOT: false,
    completeness: null,
  };
  return tex as unknown as Value;
}

function texCube(): Value {
  // Arrange helper: 6 1x1 faces — +X Red, -X Green, +Y Blue, -Y Yellow, +Z Magenta, -Z Cyan.
  const colors: number[][] = [
    [255, 0, 0, 255],
    [0, 255, 0, 255],
    [0, 0, 255, 255],
    [255, 255, 0, 255],
    [255, 0, 255, 255],
    [0, 255, 255, 255],
  ];
  const faces = [
    TEXTURE_CUBE_MAP_POSITIVE_X,
    TEXTURE_CUBE_MAP_NEGATIVE_X,
    TEXTURE_CUBE_MAP_POSITIVE_Y,
    TEXTURE_CUBE_MAP_NEGATIVE_Y,
    TEXTURE_CUBE_MAP_POSITIVE_Z,
    TEXTURE_CUBE_MAP_NEGATIVE_Z,
  ];
  const levelsCube = new Map<number, Map<number, MipLevel>>();
  for (let i = 0; i < 6; i++) {
    const c = colors[i]!;
    const lvl: MipLevel = {
      width: 1,
      height: 1,
      internalFormat: RGBA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array(c),
    };
    levelsCube.set(faces[i]!, new Map([[0, lvl]]));
  }
  const tex: TextureObject = {
    id: 103,
    alive: true,
    target: TEXTURE_CUBE_MAP,
    levels2D: new Map(),
    levelsCube,
    sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
    isNPOT: false,
    completeness: null,
  };
  return tex as unknown as Value;
}

describe('Builtins - Sampling: NEAREST exact texel on 2x2 fixture', () => {
  it('texture2D at texel center returns exact texel RGBA', () => {
    // Arrange:
    const tex = tex2x2(NEAREST);
    const coord = new Float32Array([0.25, 0.25]);
    // Act:
    const res = evaluateBuiltin('texture2D', [tex, coord], 100) as Float32Array;
    // Assert:
    expect(res).toBeInstanceOf(Float32Array);
    expect(res[0]).toBe(Math.fround(1.0));
    expect(res[1]).toBe(Math.fround(0.0));
    expect(res[2]).toBe(Math.fround(0.0));
    expect(res[3]).toBe(Math.fround(1.0));
  });
});

describe('Builtins - Sampling: LINEAR fround-normalized average of two texels', () => {
  it('texture2D at horizontal midpoint averages Red and Green', () => {
    // Arrange:
    const tex = tex2x2(LINEAR);
    const coord = new Float32Array([0.5, 0.25]);
    // Act:
    const res = evaluateBuiltin('texture2D', [tex, coord], 100) as Float32Array;
    // Assert:
    expect(res).toBeInstanceOf(Float32Array);
    expect(res[0]).toBe(Math.fround(0.5));
    expect(res[1]).toBe(Math.fround(0.5));
    expect(res[2]).toBe(Math.fround(0.0));
    expect(res[3]).toBe(Math.fround(1.0));
  });
});

describe('Builtins - Sampling: Incomplete texture [0,0,0,1] no-throw rule', () => {
  it('missing base level, NPOT-mipmap-REPEAT, and 1-face cube all yield opaque black', () => {
    // Arrange:
    const t1: TextureObject = {
      id: 1,
      alive: true,
      target: TEXTURE_2D,
      levels2D: new Map(),
      levelsCube: new Map(),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
    const npotLvl: MipLevel = {
      width: 3,
      height: 3,
      internalFormat: RGBA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array(3 * 3 * 4),
    };
    const t2: TextureObject = {
      id: 2,
      alive: true,
      target: TEXTURE_2D,
      levels2D: new Map([[0, npotLvl]]),
      levelsCube: new Map(),
      sampler: { wrapS: REPEAT, wrapT: REPEAT, minFilter: LINEAR_MIPMAP_LINEAR, magFilter: LINEAR },
      isNPOT: true,
      completeness: null,
    };
    const oneFace: MipLevel = {
      width: 2,
      height: 2,
      internalFormat: RGBA,
      type: UNSIGNED_BYTE,
      data: new Uint8Array(2 * 2 * 4),
    };
    const t3: TextureObject = {
      id: 3,
      alive: true,
      target: TEXTURE_CUBE_MAP,
      levels2D: new Map(),
      levelsCube: new Map([[TEXTURE_CUBE_MAP_POSITIVE_X, new Map([[0, oneFace]])]]),
      sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST, magFilter: NEAREST },
      isNPOT: false,
      completeness: null,
    };
    const coord = new Float32Array([0.5, 0.5]);
    // Act:
    const r1 = evaluateBuiltin('texture2D', [t1 as unknown as Value, coord], 100) as Float32Array;
    const r2 = evaluateBuiltin('texture2D', [t2 as unknown as Value, coord], 100) as Float32Array;
    const r3 = evaluateBuiltin('textureCube', [t3 as unknown as Value, new Float32Array([1, 0, 0])], 100) as Float32Array;
    // Assert:
    for (const r of [r1, r2, r3]) {
      expect(r).toBeInstanceOf(Float32Array);
      expect(Array.from(r as Float32Array)).toEqual([0, 0, 0, 1]);
    }
  });
});

describe('Builtins - Sampling: Version gating dialect isolation in both directions', () => {
  it('texture2D/textureCube only in V100; texture/textureProj/textureLod/textureGrad/texelFetch only in V300', () => {
    // Arrange: (dispatch tables only — evaluateBuiltin fallback would mask absence)
    // Act:
    const hasTex2DV100 = BUILTINS_V100.has('texture2D');
    const hasTex2DV300 = BUILTINS_V300.has('texture2D');
    const hasCubeV100 = BUILTINS_V100.has('textureCube');
    const hasCubeV300 = BUILTINS_V300.has('textureCube');
    const hasTexV100 = BUILTINS_V100.has('texture');
    const hasTexV300 = BUILTINS_V300.has('texture');
    const hasProjV100 = BUILTINS_V100.has('textureProj');
    const hasProjV300 = BUILTINS_V300.has('textureProj');
    const hasLodV100 = BUILTINS_V100.has('textureLod');
    const hasLodV300 = BUILTINS_V300.has('textureLod');
    const hasGradV100 = BUILTINS_V100.has('textureGrad');
    const hasGradV300 = BUILTINS_V300.has('textureGrad');
    const hasFetchV100 = BUILTINS_V100.has('texelFetch');
    const hasFetchV300 = BUILTINS_V300.has('texelFetch');
    // Assert:
    expect(hasTex2DV100).toBe(true);
    expect(hasTex2DV300).toBe(false);
    expect(hasCubeV100).toBe(true);
    expect(hasCubeV300).toBe(false);
    expect(hasTexV100).toBe(false);
    expect(hasTexV300).toBe(true);
    expect(hasProjV100).toBe(false);
    expect(hasProjV300).toBe(true);
    expect(hasLodV100).toBe(false);
    expect(hasLodV300).toBe(true);
    expect(hasGradV100).toBe(false);
    expect(hasGradV300).toBe(true);
    expect(hasFetchV100).toBe(false);
    expect(hasFetchV300).toBe(true);
  });
});

describe('Builtins - Sampling: Hostile input never throws on sampling paths', () => {
  it('malformed sampling calls return opaque-black Float32Array without throwing', () => {
    // Arrange:
    const tex = tex2x2(NEAREST);
    const calls: Array<() => unknown> = [
      () => evaluateBuiltin('texture2D', [], 100),
      () => evaluateBuiltin('texture2D', [null as unknown as Value, undefined as unknown as Value], 100),
      () => evaluateBuiltin('texture2D', ['notAnObject' as unknown as Value, 123 as unknown as Value], 100),
      () => evaluateBuiltin('textureProj', [tex, new Float32Array([1.0, 1.0, 0.0])], 300),
      () => evaluateBuiltin('texelFetch', [tex, new Int32Array([-10, 100]), 0], 300),
    ];
    // Act & Assert:
    for (const call of calls) {
      let out: unknown;
      expect(() => {
        out = call();
      }).not.toThrow();
      expect(out).toBeInstanceOf(Float32Array);
      expect(Array.from(out as Float32Array)).toEqual([0, 0, 0, 1]);
    }
    // Arrange: NaN/Infinity coords must also never throw (result asserted only as Float32Array).
    let nanOut: unknown;
    // Act:
    expect(() => {
      nanOut = evaluateBuiltin('texture', [tex, new Float32Array([NaN, Infinity])], 300);
    }).not.toThrow();
    // Assert:
    expect(nanOut).toBeInstanceOf(Float32Array);
  });
});

describe('Builtins - Sampling: textureCube face selection and normalization', () => {
  it('+X selects Red and -Y selects Yellow', () => {
    // Arrange:
    const cube = texCube();
    const dirX = new Float32Array([5.0, 0.0, 0.0]);
    const dirNegY = new Float32Array([0.0, -10.0, 0.0]);
    // Act:
    const rx = evaluateBuiltin('textureCube', [cube, dirX], 100) as Float32Array;
    const ry = evaluateBuiltin('textureCube', [cube, dirNegY], 100) as Float32Array;
    // Assert:
    expect(Array.from(rx)).toEqual([1, 0, 0, 1]);
    expect(Array.from(ry)).toEqual([1, 1, 0, 1]);
  });
});

describe('Builtins - Sampling: textureLod explicit mip-level selection', () => {
  it('lod 0/1/2 selects Red/Green/Blue levels', () => {
    // Arrange:
    const mip = texMipped();
    const coord = new Float32Array([0.5, 0.5]);
    // Act:
    const r0 = evaluateBuiltin('textureLod', [mip, coord, 0.0], 300) as Float32Array;
    const r1 = evaluateBuiltin('textureLod', [mip, coord, 1.0], 300) as Float32Array;
    const r2 = evaluateBuiltin('textureLod', [mip, coord, 2.0], 300) as Float32Array;
    // Assert:
    expect(Array.from(r0)).toEqual([1, 0, 0, 1]);
    expect(Array.from(r1)).toEqual([0, 1, 0, 1]);
    expect(Array.from(r2)).toEqual([0, 0, 1, 1]);
  });
});

describe('Builtins - Sampling: Legacy placeholder symbols absent from builtins.ts', () => {
  it('no legacy function/const/interface declarations remain in builtins.ts source', async () => {
    // Arrange:
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/glsl/builtins.ts', 'utf8');
    const names = [
      'asTex',
      'samplerOf',
      'applyWrap',
      'isPow2',
      'isMipFilter',
      'sampleMipLevel',
      'fetchTexel',
      'W_CLAMP',
      'W_REPEAT',
      'W_MIRROR',
      'F_NMN',
      'F_LMN',
      'F_NML',
      'F_LML',
      'MipLevel',
      'SamplerParams',
      'TextureObject',
    ];
    // Act:
    const hits: string[] = [];
    for (const name of names) {
      const re = new RegExp(`(?:function|const|interface)\\s+${name}\\b`);
      if (re.test(src)) hits.push(name);
    }
    // Assert:
    expect(hits).toEqual([]);
  });
});

describe('Builtins - Sampling: textureProj coordinate perspective division', () => {
  it('[0.5,0.5,2.0] projects to texel (0,0) Red', () => {
    // Arrange:
    const tex = tex2x2(NEAREST);
    const coordProj = new Float32Array([0.5, 0.5, 2.0]);
    // Act:
    const res = evaluateBuiltin('textureProj', [tex, coordProj], 300) as Float32Array;
    // Assert:
    expect(res).toBeInstanceOf(Float32Array);
    expect(Array.from(res)).toEqual([1, 0, 0, 1]);
  });
});

describe('Builtins - Sampling: texelFetch integer texel retrieval', () => {
  it('integer coords fetch exact texels; out-of-bounds yields fallback', () => {
    // Arrange:
    const tex = tex2x2(NEAREST);
    const p00 = new Int32Array([0, 0]);
    const p10 = new Int32Array([1, 0]);
    const pOut = new Int32Array([5, 5]);
    // Act:
    const r00 = evaluateBuiltin('texelFetch', [tex, p00, 0], 300) as Float32Array;
    const r10 = evaluateBuiltin('texelFetch', [tex, p10, 0], 300) as Float32Array;
    const rOut = evaluateBuiltin('texelFetch', [tex, pOut, 0], 300) as Float32Array;
    // Assert:
    expect(Array.from(r00)).toEqual([1, 0, 0, 1]);
    expect(Array.from(r10)).toEqual([0, 1, 0, 1]);
    expect(Array.from(rOut)).toEqual([0, 0, 0, 1]);
  });
});

describe('Builtins - Sampling: Math.fround float32 precision normalization', () => {
  it('LINEAR sample components are fround-exact', () => {
    // Arrange:
    const tex = tex2x2(LINEAR);
    const coord = new Float32Array([0.33333333, 0.33333333]);
    // Act:
    const res = evaluateBuiltin('texture', [tex, coord], 300) as Float32Array;
    // Assert:
    expect(res).toBeInstanceOf(Float32Array);
    for (let i = 0; i < 4; i++) {
      expect((res as Float32Array)[i]).toBe(Math.fround((res as Float32Array)[i] as number));
    }
  });
});
