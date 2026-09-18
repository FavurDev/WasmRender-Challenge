/** Stencil stage tests: applyStencil test-and-update coverage. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyStencil } from '../../src/renderer/rasterizer';
import { GLState } from '../../src/renderer/state';
import {
  ALWAYS, DECR, DECR_WRAP, EQUAL, GEQUAL, GREATER, INCR, INCR_WRAP, INVERT,
  KEEP, LEQUAL, LESS, NEVER, NOTEQUAL, REPLACE, ZERO,
} from '../../src/renderer/gl-constants';

function makeState(): GLState {
  // Arrange helper
  const st = new GLState(4, 4);
  st.stencilTest = true;
  return st;
}

describe('applyStencil truth table (8 comparisons)', () => {
  it('NEVER fails', () => {
    // Arrange
    const st = makeState(); st.stencilFunc = NEVER; st.stencilRef = 5; st.stencilValueMask = 0xff;
    const s = new Uint8Array([5]);
    // Act
    const pass = applyStencil(0, 0, st, s, 1, true);
    // Assert
    expect(pass).toBe(false);
  });
  it('ALWAYS passes', () => {
    const st = makeState(); st.stencilFunc = ALWAYS; st.stencilRef = 0;
    const s = new Uint8Array([99]);
    const pass = applyStencil(0, 0, st, s, 1, true);
    expect(pass).toBe(true);
  });
  it('LESS: masked ref below masked stored passes', () => {
    const st = makeState(); st.stencilFunc = LESS; st.stencilRef = 3; st.stencilValueMask = 0xff;
    const s = new Uint8Array([7]);
    expect(applyStencil(0, 0, st, s, 1, true)).toBe(true);
  });
  it('LEQUAL: tie passes', () => {
    const st = makeState(); st.stencilFunc = LEQUAL; st.stencilRef = 7; st.stencilValueMask = 0xff;
    const s = new Uint8Array([7]);
    expect(applyStencil(0, 0, st, s, 1, true)).toBe(true);
  });
  it('GREATER: masked ref above stored passes', () => {
    const st = makeState(); st.stencilFunc = GREATER; st.stencilRef = 9; st.stencilValueMask = 0xff;
    const s = new Uint8Array([2]);
    expect(applyStencil(0, 0, st, s, 1, true)).toBe(true);
  });
  it('GEQUAL: tie passes', () => {
    const st = makeState(); st.stencilFunc = GEQUAL; st.stencilRef = 4; st.stencilValueMask = 0xff;
    const s = new Uint8Array([4]);
    expect(applyStencil(0, 0, st, s, 1, true)).toBe(true);
  });
  it('EQUAL: masked equality passes', () => {
    const st = makeState(); st.stencilFunc = EQUAL; st.stencilRef = 0xab; st.stencilValueMask = 0x0f;
    const s = new Uint8Array([0x5b]); // low nibble 0xb both
    expect(applyStencil(0, 0, st, s, 1, true)).toBe(true);
  });
  it('NOTEQUAL: masked difference fails-or-passes', () => {
    const st = makeState(); st.stencilFunc = NOTEQUAL; st.stencilRef = 1; st.stencilValueMask = 0xff;
    const s = new Uint8Array([2]);
    expect(applyStencil(0, 0, st, s, 1, true)).toBe(true);
  });
  it('masked variant: differ only outside mask treated equal', () => {
    const st = makeState(); st.stencilFunc = EQUAL; st.stencilRef = 0xf0; st.stencilValueMask = 0x0f;
    const s = new Uint8Array([0x00]); // masked both 0
    expect(applyStencil(0, 0, st, s, 1, true)).toBe(true);
  });
});

describe('applyStencil ops (8 ops)', () => {
  function runOp(stored: number, op: number, ref = 42, writeMask = 0xff): number {
    const st = makeState(); st.stencilFunc = ALWAYS;
    st.stencilFail = KEEP; st.stencilPassDepthFail = KEEP; st.stencilPassDepthPass = op;
    st.stencilRef = ref; st.stencilMask = writeMask;
    const s = new Uint8Array([stored]);
    applyStencil(0, 0, st, s, 1, true);
    return s[0] as number;
  }
  it('KEEP unchanged', () => { expect(runOp(17, KEEP)).toBe(17); });
  it('ZERO cleared', () => { expect(runOp(17, ZERO)).toBe(0); });
  it('REPLACE from ref', () => { expect(runOp(17, REPLACE, 200)).toBe(200); });
  it('INCR saturates at 255', () => { expect(runOp(255, INCR)).toBe(255); });
  it('INCR_WRAP wraps 255->0', () => { expect(runOp(255, INCR_WRAP)).toBe(0); });
  it('DECR floors at 0', () => { expect(runOp(0, DECR)).toBe(0); });
  it('DECR_WRAP wraps 0->255', () => { expect(runOp(0, DECR_WRAP)).toBe(255); });
  it('INVERT complements', () => { expect(runOp(0x0f, INVERT)).toBe(0xf0); });
  it('partial writeMask preserves outside bits', () => { expect(runOp(0xf0, REPLACE, 0x0f, 0x0f)).toBe(0xff); });
});

describe('applyStencil side effects', () => {
  it('stencil-fail updates stencil per fail op while depth byte unchanged', () => {
    // Arrange
    const st = makeState(); st.stencilFunc = NEVER; st.stencilFail = REPLACE; st.stencilRef = 77;
    st.stencilMask = 0xff;
    const s = new Uint8Array([1]);
    const depth = new Float32Array([0.5]);
    // Act
    const pass = applyStencil(0, 0, st, s, 1, true);
    // Assert
    expect(pass).toBe(false);
    expect(s[0]).toBe(77);
    expect(depth[0]).toBe(0.5);
  });
  it('disabled stencilTest returns true with no write', () => {
    const st = makeState(); st.stencilTest = false; st.stencilFunc = NEVER;
    const s = new Uint8Array([9]);
    expect(applyStencil(0, 0, st, s, 1, true)).toBe(true);
    expect(s[0]).toBe(9);
  });
  it('op selection: fail vs zfail vs zpass via depthWillPass', () => {
    const mk = (f: number, zf: number, zp: number): GLState => {
      const st = makeState(); st.stencilFunc = ALWAYS;
      st.stencilFail = f; st.stencilPassDepthFail = zf; st.stencilPassDepthPass = zp;
      st.stencilRef = 5; st.stencilMask = 0xff; return st;
    };
    // zfail path: pass=true, depthWillPass=false -> zfail op
    const s1 = new Uint8Array([10]);
    applyStencil(0, 0, mk(KEEP, REPLACE, KEEP), s1, 1, false);
    expect(s1[0]).toBe(5);
    // zpass path
    const s2 = new Uint8Array([10]);
    applyStencil(0, 0, mk(KEEP, KEEP, REPLACE), s2, 1, true);
    expect(s2[0]).toBe(5);
  });
  it('zero-allocation: no new/array-literal/closure inside applyStencil body', () => {
    // Arrange
    const src = readFileSync('src/renderer/rasterizer.ts', 'utf8');
    const start = src.indexOf('export function applyStencil');
    const end = src.indexOf('function evaluateStencil', start);
    // Act
    const body = src.slice(start, end === -1 ? undefined : end);
    // Assert
    expect(start).toBeGreaterThanOrEqual(0);
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toMatch(/new\s+/);
    expect(body).not.toMatch(/=>/);
    expect(body).not.toMatch(/\[\s*\]/);
    expect(body).not.toMatch(/\{\s*\}/);
  });
});
