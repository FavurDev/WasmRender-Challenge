// CHANGELOG: Sprint 13 (2026-09-24): T3 per-signature regression suite T5-T9 (349a3eb).
/** Sprint 13 remediation red-phase: GL state fixes (T3 wave). Must FAIL until fixed. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import { DOMElementStub } from '../conformance/webgl1-harness';

const UNPACK_COLORSPACE = 0x9243;
const BROWSER_DEFAULT = 0x9244;
const NO_ERROR = 0;
const INVALID_VALUE = 0x0501;
const MAX_RENDERBUFFER_SIZE = 0x84e8;
const SUBPIXEL_BITS = 0x0d50;
const MAX_VIEWPORT_DIMS = 0x0d3a;
const MAX_ELEMENT_INDEX = 0x8ffe;

describe('Sprint13 state T5: pixelStorei UNPACK_COLORSPACE accepted', () => {
  it.each([['webgl1'], ['webgl2']] as const)('T5 %s accepts BROWSER_DEFAULT with NO_ERROR + readback', (kind) => {
    // Arrange:
    const gl = kind === 'webgl1'
      ? createSoftwareWebGLContext({ width: 4, height: 4 })
      : new WebGL2Context({ width: 4, height: 4 });
    if (gl === null) throw new Error('T5: context creation failed');
    // Act:
    gl.pixelStorei(UNPACK_COLORSPACE, BROWSER_DEFAULT);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getPixelStorei(UNPACK_COLORSPACE)).toBe(BROWSER_DEFAULT);
  });
});

describe('Sprint13 state T6: pixelStorei invalid value rejected', () => {
  it.each([['webgl1'], ['webgl2']] as const)('T6 %s rejects 0x1234 with INVALID_VALUE, state unchanged', (kind) => {
    // Arrange:
    const gl = kind === 'webgl1'
      ? createSoftwareWebGLContext({ width: 4, height: 4 })
      : new WebGL2Context({ width: 4, height: 4 });
    if (gl === null) throw new Error('T6: context creation failed');
    gl.pixelStorei(UNPACK_COLORSPACE, BROWSER_DEFAULT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.pixelStorei(UNPACK_COLORSPACE, 0x1234);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getPixelStorei(UNPACK_COLORSPACE)).toBe(BROWSER_DEFAULT);
  });
});

describe('Sprint13 state T7: limit getParameter queries spec-valid', () => {
  it.each([['webgl1'], ['webgl2']] as const)('T7 %s limits are positive/spec-valid with NO_ERROR', (kind) => {
    // Arrange:
    const gl = kind === 'webgl1'
      ? createSoftwareWebGLContext({ width: 4, height: 4 })
      : new WebGL2Context({ width: 4, height: 4 });
    if (gl === null) throw new Error('T7: context creation failed');
    // Act + Assert:
    expect(gl.getParameter(MAX_RENDERBUFFER_SIZE) as number).toBeGreaterThanOrEqual(4096);
    expect(gl.getParameter(SUBPIXEL_BITS) as number).toBeGreaterThanOrEqual(4);
    const dims = gl.getParameter(MAX_VIEWPORT_DIMS) as Int32Array;
    expect(dims[0]).toBeGreaterThan(0);
    expect(dims[1]).toBeGreaterThan(0);
    expect(gl.getParameter(MAX_ELEMENT_INDEX) as number).toBeGreaterThan(0);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('Sprint13 state T8: canPlayType stub returns string', () => {
  it('T8 video canPlayType returns string', () => {
    // Arrange:
    const el = new DOMElementStub('VIDEO');
    // Act:
    const fn = (el as unknown as { canPlayType?: (t: string) => string }).canPlayType;
    // Assert:
    expect(typeof fn).toBe('function');
    expect(typeof (fn as (t: string) => string).call(el, 'video/webm')).toBe('string');
  });
});

describe('Sprint13 state T9: WebGL1 invariance smoke', () => {
  it('T9 entry-point sequence leaves bit-identical state', () => {
    // Arrange:
    const a = createSoftwareWebGLContext({ width: 4, height: 4 });
    const b = createSoftwareWebGLContext({ width: 4, height: 4 });
    if (a === null || b === null) throw new Error('T9: context creation failed');
    const seq = (gl: NonNullable<typeof a>) => {
      gl.pixelStorei(UNPACK_COLORSPACE, BROWSER_DEFAULT);
      gl.getParameter(MAX_RENDERBUFFER_SIZE);
      gl.getError();
    };
    // Act:
    seq(a);
    seq(b);
    // Assert:
    expect(a.getPixelStorei(UNPACK_COLORSPACE)).toBe(b.getPixelStorei(UNPACK_COLORSPACE));
    expect(a.getError()).toBe(NO_ERROR);
    expect(b.getError()).toBe(NO_ERROR);
  });
});
