/** Stencil enums + GLState defaults TDD red-phase tests. Headless Vitest, no DOM/canvas, fixed values only. */
import { describe, expect, it } from 'vitest';
import * as GL from '../../src/renderer/gl-constants';
import { GLState } from '../../src/renderer/state';

const rec = GL as unknown as Record<string, number>;
const stateRec = (s: GLState) => s as unknown as Record<string, unknown>;

describe('stencil defaults: fresh store reports stencilFunc ALWAYS', () => {
  it('stencilFunc equals ALWAYS (0x0207)', () => {
    // Arrange: fresh store with fixed canvas extent
    const s = new GLState(64, 64);
    // Act: read stencilFunc field
    const actual = stateRec(s).stencilFunc;
    // Assert: spec default ALWAYS
    expect(actual).toBe(rec.ALWAYS);
    expect(actual).toBe(0x0207);
  });
});

describe('stencil defaults: fresh store reports stencilRef zero', () => {
  it('stencilRef equals 0', () => {
    // Arrange
    const s = new GLState(64, 64);
    // Act
    const actual = stateRec(s).stencilRef;
    // Assert
    expect(actual).toBe(0);
  });
});

describe('stencil defaults: fresh store reports stencilValueMask full', () => {
  it('stencilValueMask equals 0xFF', () => {
    // Arrange
    const s = new GLState(64, 64);
    // Act
    const actual = stateRec(s).stencilValueMask;
    // Assert
    expect(actual).toBe(0xff);
  });
});

describe('stencil defaults: fresh store reports all three ops KEEP', () => {
  it('stencilFail, stencilPassDepthFail, stencilPassDepthPass equal KEEP (0x1E00)', () => {
    // Arrange
    const s = new GLState(64, 64);
    // Act
    const r = stateRec(s);
    // Assert
    expect(r.stencilFail).toBe(rec.KEEP);
    expect(r.stencilPassDepthFail).toBe(rec.KEEP);
    expect(r.stencilPassDepthPass).toBe(rec.KEEP);
    expect(r.stencilFail).toBe(0x1e00);
  });
});

describe('stencil defaults: existing stencilTest and stencilMask unchanged', () => {
  it('stencilTest false and stencilMask 0xFF', () => {
    // Arrange
    const s = new GLState(64, 64);
    // Act
    const r = stateRec(s);
    // Assert
    expect(r.stencilTest).toBe(false);
    expect(r.stencilMask).toBe(0xff);
  });
});

describe('stencil enums: comparison family resolves spec-exact', () => {
  it('8 comparison labels equal 0x0200..0x0207', () => {
    // Arrange: fixed expected map
    const expected: Record<string, number> = {
      NEVER: 0x0200, LESS: 0x0201, EQUAL: 0x0202, LEQUAL: 0x0203,
      GREATER: 0x0204, NOTEQUAL: 0x0205, GEQUAL: 0x0206, ALWAYS: 0x0207,
    };
    // Act + Assert
    for (const [k, v] of Object.entries(expected)) expect(rec[k]).toBe(v);
  });
});

describe('stencil enums: operation family resolves spec-exact', () => {
  it('8 op labels equal spec values', () => {
    // Arrange
    const expected: Record<string, number> = {
      ZERO: 0, KEEP: 0x1e00, REPLACE: 0x1e01, INCR: 0x1e02,
      DECR: 0x1e03, INVERT: 0x150a, INCR_WRAP: 0x8507, DECR_WRAP: 0x8508,
    };
    // Act + Assert
    for (const [k, v] of Object.entries(expected)) expect(rec[k]).toBe(v);
  });
});

describe('stencil enums: query family resolves spec-exact', () => {
  it('7 query labels equal 0x0B92..0x0B98', () => {
    // Arrange
    const expected: Record<string, number> = {
      STENCIL_FUNC: 0x0b92, STENCIL_VALUE_MASK: 0x0b93, STENCIL_FAIL: 0x0b94,
      STENCIL_PASS_DEPTH_FAIL: 0x0b95, STENCIL_PASS_DEPTH_PASS: 0x0b96,
      STENCIL_REF: 0x0b97, STENCIL_WRITEMASK: 0x0b98,
    };
    // Act + Assert
    for (const [k, v] of Object.entries(expected)) expect(rec[k]).toBe(v);
  });
});

describe('stencil enums: valid labels are distinct finite numbers', () => {
  it('all 23 labels distinct and finite', () => {
    // Arrange: collect all 23 labels
    const names = ['NEVER','LESS','EQUAL','LEQUAL','GREATER','NOTEQUAL','GEQUAL','ALWAYS',
      'ZERO','KEEP','REPLACE','INCR','DECR','INVERT','INCR_WRAP','DECR_WRAP',
      'STENCIL_FUNC','STENCIL_VALUE_MASK','STENCIL_FAIL','STENCIL_PASS_DEPTH_FAIL',
      'STENCIL_PASS_DEPTH_PASS','STENCIL_REF','STENCIL_WRITEMASK'];
    // Act
    const vals = names.map((n) => rec[n]);
    // Assert
    for (const v of vals) expect(Number.isFinite(v)).toBe(true);
    expect(new Set(vals).size).toBe(vals.length);
  });
});
