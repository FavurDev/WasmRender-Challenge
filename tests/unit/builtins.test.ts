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
