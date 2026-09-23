/** Sprint 10 Task 9 WebGL1 CTS fix-wave TDD RED-phase tests — blueprint-conformant suite. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSoftwareWebGLContext } from '../../src/entry';
import {
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  DEPTH_ATTACHMENT,
  DEPTH_COMPONENT16,
  DEPTH_STENCIL_ATTACHMENT,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAMEBUFFER_UNSUPPORTED,
  FRAGMENT_SHADER,
  INVALID_OPERATION,
  INVALID_VALUE,
  MAX_VERTEX_ATTRIBS,
  MAX_VIEWPORT_DIMS,
  NO_ERROR,
  RENDERBUFFER,
  RGB,
  RGBA,
  SCISSOR_TEST,
  STENCIL_ATTACHMENT,
  STENCIL_INDEX8,
  TEXTURE_2D,
  UNSIGNED_BYTE,
  VERSION,
} from '../../src/gl/constants';

const RED_BITS = 0x0d52;
const GREEN_BITS = 0x0d53;
const BLUE_BITS = 0x0d54;
const ALPHA_BITS = 0x0d55;
const DEPTH_BITS = 0x0d56;
const STENCIL_BITS = 0x0d57;

function ctsContext(w: number, h: number) {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('ctsContext: factory returned null');
  return gl;
}

describe('Sprint 10 Task 9 WebGL1 CTS fixes (red phase)', () => {
  it('T01_getParameter_max_vertex_attribs_meets_spec_minimum', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    // Act:
    const value = gl.getParameter(MAX_VERTEX_ATTRIBS) as unknown as number;
    // Assert:
    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThanOrEqual(8);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T02_getParameter_rgba_depth_stencil_bits_exact', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    // Act:
    const r = gl.getParameter(RED_BITS) as unknown as number;
    const g = gl.getParameter(GREEN_BITS) as unknown as number;
    const b = gl.getParameter(BLUE_BITS) as unknown as number;
    const a = gl.getParameter(ALPHA_BITS) as unknown as number;
    const d = gl.getParameter(DEPTH_BITS) as unknown as number;
    const s = gl.getParameter(STENCIL_BITS) as unknown as number;
    // Assert:
    expect([r, g, b, a]).toEqual([8, 8, 8, 8]);
    expect(d).toBe(24);
    expect(s).toBe(8);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T03_getParameter_max_viewport_dims_returns_4096', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    // Act:
    const dims = gl.getParameter(MAX_VIEWPORT_DIMS) as unknown as Int32Array;
    // Assert:
    expect(dims).toBeInstanceOf(Int32Array);
    expect(Array.from(dims)).toEqual([4096, 4096]);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T04_getParameter_version_string_exact', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    // Act:
    const version = gl.getParameter(VERSION) as unknown as string;
    // Assert:
    expect(version).toBe('WebGL 1.0 (Software)');
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T05_bad_fragment_shader_compile_status_false_and_log_prefix', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    const sh = gl.createShader(FRAGMENT_SHADER);
    if (sh === null) throw new Error('createShader returned null');
    gl.shaderSource(sh, 'this is not valid glsl !!!');
    // Act:
    gl.compileShader(sh);
    const status = gl.getShaderParameter(sh, COMPILE_STATUS) as unknown as boolean;
    const log = gl.getShaderInfoLog(sh);
    // Assert:
    expect(status).toBe(false);
    expect(log).toMatch(/^ERROR: 0:/);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T06_texImage2D_rejects_nonzero_border_with_invalid_value', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    gl.bindTexture(TEXTURE_2D, gl.createTexture());
    // Act:
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 16, 16, 1, RGBA, UNSIGNED_BYTE, null);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('T07_texImage2D_rejects_mismatched_format_with_invalid_operation', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    gl.bindTexture(TEXTURE_2D, gl.createTexture());
    // Act:
    gl.texImage2D(TEXTURE_2D, 0, RGB, 16, 16, 0, RGBA, UNSIGNED_BYTE, null);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('T08_readPixels_oob_records_invalid_value', () => {
    // Arrange:
    const gl = ctsContext(4, 4);
    const out = new Uint8Array(8 * 8 * 4);
    // Act:
    gl.readPixels(0, 0, 8, 8, RGBA, UNSIGNED_BYTE, out);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('T09_conformance_whitelist_admits_timeout_status', () => {
    // Arrange: read the authoritative whitelist literal at tests/conformance/webgl1.test.ts:38.
    const src = readFileSync(join(__dirname, '..', 'conformance', 'webgl1.test.ts'), 'utf8');
    // Act: locate the status whitelist guard line for record.status.
    const guardLine = src.split('\n').find((line) => line.includes('record.status'));
    // Assert: the whitelist exists and admits TIMEOUT alongside the four legacy verdicts.
    expect(guardLine).toBeDefined();
    for (const verdict of ['PASS', 'FAIL', 'CRASH', 'SKIP', 'TIMEOUT']) {
      expect(guardLine as string).toContain(`'${verdict}'`);
    }
  });

  it('T10_scissor_red_clear_restricts_to_2x2', () => {
    // Arrange:
    const gl = ctsContext(4, 4);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.enable(SCISSOR_TEST);
    gl.scissor(0, 0, 2, 2);
    gl.clearColor(1, 0, 0, 1);
    // Act:
    gl.clear(COLOR_BUFFER_BIT);
    const out = new Uint8Array(4 * 4 * 4);
    gl.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, out);
    // Assert:
    const px = (x: number, y: number) => Array.from(out.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4));
    expect(px(0, 0)).toEqual([255, 0, 0, 255]);
    expect(px(3, 3)).toEqual([255, 255, 255, 255]);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T11_default_framebuffer_status_complete', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    // Act:
    const status = gl.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    // Assert:
    expect(status).toBe(FRAMEBUFFER_COMPLETE);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T12_depth16_plus_color_texture_fbo_complete', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    const g = gl as unknown as Record<string, (...a: never[]) => unknown>;
    const fb = (g['createFramebuffer'] as () => unknown)();
    (g['bindFramebuffer'] as (t: number, f: unknown) => void)(FRAMEBUFFER, fb);
    const rb = (g['createRenderbuffer'] as () => unknown)();
    (g['bindRenderbuffer'] as (t: number, r: unknown) => void)(RENDERBUFFER, rb);
    (g['renderbufferStorage'] as (t: number, f: number, w: number, h: number) => void)(
      RENDERBUFFER,
      DEPTH_COMPONENT16,
      8,
      8,
    );
    (g['framebufferRenderbuffer'] as (t: number, a: number, rt: number, r: unknown) => void)(
      FRAMEBUFFER,
      DEPTH_ATTACHMENT,
      RENDERBUFFER,
      rb,
    );
    const tex = (g['createTexture'] as () => unknown)();
    (g['bindTexture'] as (t: number, x: unknown) => void)(TEXTURE_2D, tex);
    (g['texImage2D'] as (...a: unknown[]) => void)(TEXTURE_2D, 0, RGBA, 8, 8, 0, RGBA, UNSIGNED_BYTE, null);
    (g['framebufferTexture2D'] as (t: number, a: number, tt: number, x: unknown, l: number) => void)(
      FRAMEBUFFER,
      COLOR_ATTACHMENT0,
      TEXTURE_2D,
      tex,
      0,
    );
    // Act:
    const status = gl.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    // Assert:
    expect(status).toBe(FRAMEBUFFER_COMPLETE);
  });

  it('T13_depth_plus_stencil_same_fbo_unsupported', () => {
    // Arrange:
    const gl = ctsContext(8, 8);
    const g = gl as unknown as Record<string, (...a: never[]) => unknown>;
    const fb = (g['createFramebuffer'] as () => unknown)();
    (g['bindFramebuffer'] as (t: number, f: unknown) => void)(FRAMEBUFFER, fb);
    const rbD = (g['createRenderbuffer'] as () => unknown)();
    (g['bindRenderbuffer'] as (t: number, r: unknown) => void)(RENDERBUFFER, rbD);
    (g['renderbufferStorage'] as (t: number, f: number, w: number, h: number) => void)(
      RENDERBUFFER,
      DEPTH_COMPONENT16,
      8,
      8,
    );
    (g['framebufferRenderbuffer'] as (t: number, a: number, rt: number, r: unknown) => void)(
      FRAMEBUFFER,
      DEPTH_ATTACHMENT,
      RENDERBUFFER,
      rbD,
    );
    const rbS = (g['createRenderbuffer'] as () => unknown)();
    (g['bindRenderbuffer'] as (t: number, r: unknown) => void)(RENDERBUFFER, rbS);
    (g['renderbufferStorage'] as (t: number, f: number, w: number, h: number) => void)(
      RENDERBUFFER,
      STENCIL_INDEX8,
      8,
      8,
    );
    (g['framebufferRenderbuffer'] as (t: number, a: number, rt: number, r: unknown) => void)(
      FRAMEBUFFER,
      STENCIL_ATTACHMENT,
      RENDERBUFFER,
      rbS,
    );
    void DEPTH_STENCIL_ATTACHMENT;
    // Act:
    const status = gl.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    // Assert:
    expect(status).toBe(FRAMEBUFFER_UNSUPPORTED);
  });
});
