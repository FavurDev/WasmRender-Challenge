/** Sprint 9 Task 10 gap-closure tests — lowest-covered regions per baseline (builtins 49.18%, sampler 51.35%, query-sync 55.12%, interpreter 66.86%). */
import { describe, expect, it } from 'vitest';
import { evaluateBuiltin, BUILTINS_V100, BUILTINS_V300 } from '../../src/glsl/builtins';
import { applyWrap, fetchTexel2D, sample2D } from '../../src/gl/sampler';
import { QuerySyncManager } from '../../src/gl/query-sync';
import { ErrorSink } from '../../src/gl/errors';
import {
  CLAMP_TO_EDGE, REPEAT, MIRRORED_REPEAT, NEAREST, LINEAR, RGBA, UNSIGNED_BYTE,
  TEXTURE_2D, ANY_SAMPLES_PASSED, SYNC_GPU_COMMANDS_COMPLETE, INVALID_ENUM,
  INVALID_OPERATION, QUERY_RESULT, ALREADY_SIGNALED,
} from '../../src/gl/constants';
import type { MipLevel, TextureObject } from '../../src/gl/texture';

function solidLevel(w: number, h: number): MipLevel {
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = 200; data[i * 4 + 1] = 100; data[i * 4 + 2] = 50; data[i * 4 + 3] = 255; }
  return { width: w, height: h, internalFormat: RGBA, type: UNSIGNED_BYTE, data };
}
function makeTex(levels: MipLevel[]): TextureObject {
  const map = new Map<number, MipLevel>();
  levels.forEach((l, i) => map.set(i, l));
  return { id: 7, target: TEXTURE_2D, alive: true, isNPOT: false, levels2D: map, levelsCube: new Map(), sampler: { wrapS: CLAMP_TO_EDGE, wrapT: CLAMP_TO_EDGE, minFilter: NEAREST as never, magFilter: NEAREST as never }, completeness: null };
}

describe('coverage-gaps builtins matrix corners', () => {
  it('roundEven ties-to-even, atan2, refract/faceforward paths', () => {
    expect(evaluateBuiltin('roundEven', [2.5], 300)).toBe(Math.fround(2));
    expect(evaluateBuiltin('roundEven', [3.5], 300)).toBe(Math.fround(4));
    expect(evaluateBuiltin('atan', [1, 1], 100)).toBeCloseTo(Math.fround(Math.atan2(1, 1)), 5);
    const n = evaluateBuiltin('normalize', [new Float32Array([0, 0, 0])], 100) as Float32Array;
    expect(Array.from(n)).toEqual([0, 0, 0]);
    const fw = evaluateBuiltin('faceforward', [new Float32Array([1, 0, 0]), new Float32Array([0, 1, 0]), new Float32Array([0, 0, 1])], 100);
    expect(fw).toBeInstanceOf(Float32Array);
  });
  it('matrix ctors, transpose/inverse, relational any/all/not/isnan/isinf', () => {
    const m2 = evaluateBuiltin('mat2', [1, 2, 3, 4], 100) as Float32Array;
    expect(m2.length).toBe(4);
    const t = evaluateBuiltin('transpose', [new Float32Array([1, 2, 3, 4])], 300) as Float32Array;
    expect(Array.from(t)).toEqual(Array.from(new Float32Array([1, 3, 2, 4])));
    const inv = evaluateBuiltin('inverse', [new Float32Array([1, 0, 0, 1])], 300) as Float32Array;
    expect(inv.length).toBe(4);
    for (let i = 0; i < 4; i++) expect(inv[i]).toBeCloseTo([1, 0, 0, 1][i]!, 6);
    expect(evaluateBuiltin('any', [[false, false, true]], 100)).toBe(true);
    expect(evaluateBuiltin('all', [[true, true, false]], 100)).toBe(false);
    expect(evaluateBuiltin('not', [[true, false]], 100)).toEqual([false, true]);
    expect(evaluateBuiltin('isnan', [Number.NaN], 300)).toBe(true);
    expect(evaluateBuiltin('isinf', [Number.POSITIVE_INFINITY], 300)).toBe(true);
    expect(BUILTINS_V100.has('texelFetch')).toBe(false);
    expect(BUILTINS_V300.has('texelFetch')).toBe(true);
  });
  it('texture builtin fallbacks on incomplete texture yield black', () => {
    const r = evaluateBuiltin('texture2D', [1, new Float32Array([0.5, 0.5])], 100) as Float32Array;
    expect(Array.from(r)).toEqual([0, 0, 0, 1]);
    const g = evaluateBuiltin('textureGrad', [1, new Float32Array([0, 0]), new Float32Array([1, 0]), new Float32Array([0, 1])], 300) as Float32Array;
    expect(Array.from(g)).toEqual([0, 0, 0, 1]);
    expect(evaluateBuiltin('texture2D', [1, new Float32Array([0, 0])], 300)).toBe(Math.fround(0));
  });
});

describe('coverage-gaps sampler corners', () => {
  it('applyWrap REPEAT/MIRRORED/unknown branches', () => {
    expect(applyWrap(-0.25, REPEAT)).toBeCloseTo(0.75, 5);
    expect(applyWrap(1.0, REPEAT)).toBeCloseTo(0, 5);
    expect(applyWrap(1.25, MIRRORED_REPEAT)).toBeCloseTo(0.75, 5);
    expect(applyWrap(2.5, MIRRORED_REPEAT)).toBeCloseTo(0.5, 5);
    expect(applyWrap(0.3, 0x9999 as never)).toBeCloseTo(0.3, 5);
    expect(applyWrap(-0.5, CLAMP_TO_EDGE)).toBe(0);
    expect(applyWrap(1.5, CLAMP_TO_EDGE)).toBe(1);
  });
  it('fetchTexel2D clamps OOB, sample2D LINEAR filters', () => {
    const lvl = solidLevel(2, 2);
    const c = fetchTexel2D(lvl, 9, 9);
    expect(Array.from(c)).toEqual([Math.fround(200 / 255), Math.fround(100 / 255), Math.fround(50 / 255), Math.fround(1)]);
    const tex = makeTex([solidLevel(4, 4)]);
    tex.sampler = { ...tex.sampler, magFilter: LINEAR as never, minFilter: LINEAR as never };
    const s = sample2D(tex, [0.5, 0.5]);
    expect(s.length).toBe(4);
  });
});

describe('coverage-gaps query-sync error corners', () => {
  it('fenceSync invalid condition records INVALID_ENUM; valid sync signaled', () => {
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    expect(m.fenceSync(0x1234 as never, 0)).toBeNull();
    expect(sink.getError()).toBe(INVALID_ENUM);
    const s = m.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0)!;
    expect(m.clientWaitSync(s, 0, 0)).toBe(ALREADY_SIGNALED);
    expect(m.isSync(s)).toBe(true);
  });
  it('invalid query target and double-begin paths', () => {
    const sink = new ErrorSink();
    const m = new QuerySyncManager(sink);
    const q = m.createQuery()!;
    m.beginQuery(0x9999 as never, q);
    expect(sink.getError()).toBe(INVALID_ENUM);
    m.beginQuery(ANY_SAMPLES_PASSED, q);
    m.beginQuery(ANY_SAMPLES_PASSED, m.createQuery()!);
    expect(sink.getError()).toBe(INVALID_OPERATION);
    m.endQuery(ANY_SAMPLES_PASSED);
    expect(m.getQueryParameter(q, QUERY_RESULT)).toBe(0);
  });
});
