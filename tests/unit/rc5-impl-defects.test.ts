/** Sprint 11 Task 1 RC-5 implementation defects TDD RED-phase tests — TESTS 9-12 per blueprint. */
import { describe, expect, it } from 'vitest';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ARRAY_BUFFER,
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAMEBUFFER_INCOMPLETE_ATTACHMENT,
  FRAMEBUFFER_INCOMPLETE_DIMENSIONS,
  FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT,
  FRAMEBUFFER_INCOMPLETE_MULTISAMPLE,
  FRAMEBUFFER_UNSUPPORTED,
  LINK_STATUS,
  NO_ERROR,
  RENDERBUFFER,
  RGBA4,
} from '../../src/gl/constants';

type AnyGl = Record<string, (...args: never[]) => unknown> & WebGL1Context;

function ctx(w = 64, h = 64): WebGL1Context {
  return new WebGL1Context({ width: w, height: h });
}

function asAny(gl: WebGL1Context): AnyGl {
  return gl as unknown as AnyGl;
}

describe('RC-5 TEST 9: documented-success paths leave NO_ERROR', () => {
  it('valid viewport/clearColor/clear/createBuffer/bindBuffer sequence stays NO_ERROR', () => {
    // Arrange:
    const gl = ctx();
    gl.getError();
    // Act:
    gl.viewport(0, 0, 100, 100);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const buf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, buf);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('RC-5 TEST 10: link failure varying mismatch', () => {
  it('LINK_STATUS false with non-empty infoLog on varying mismatch', () => {
    // Arrange:
    const gl = ctx();
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, 'varying vec4 v_color;\nvoid main() { gl_Position = vec4(0.0); }');
    gl.compileShader(vs);
    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, 'varying vec4 v_mismatch;\nvoid main() { gl_FragColor = v_mismatch; }');
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    // Act:
    gl.linkProgram(prog);
    // Assert:
    expect(gl.getProgramParameter(prog, LINK_STATUS)).toBe(false);
    const log = gl.getProgramInfoLog(prog);
    expect(typeof log).toBe('string');
    expect((log as string).length).toBeGreaterThan(0);
  });
});

describe('RC-5 TEST 11: link failure missing stage', () => {
  it('LINK_STATUS false with non-empty infoLog when fragment stage missing', () => {
    // Arrange:
    const gl = ctx();
    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, 'void main() { gl_Position = vec4(0.0); }');
    gl.compileShader(vs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    // Act:
    gl.linkProgram(prog);
    // Assert:
    expect(gl.getProgramParameter(prog, LINK_STATUS)).toBe(false);
    const log = gl.getProgramInfoLog(prog);
    expect(typeof log).toBe('string');
    expect((log as string).length).toBeGreaterThan(0);
  });
});

describe('RC-5 TEST 12: framebuffer completeness exact enum set', () => {
  it('missing attachment then un-allocated renderbuffer return exact enums, never 0', () => {
    // Arrange:
    const gl = ctx();
    const g = asAny(gl);
    const fb = g.createFramebuffer() as unknown;
    gl.bindFramebuffer(FRAMEBUFFER, fb as never);
    const allowed = new Set([
      FRAMEBUFFER_COMPLETE,
      FRAMEBUFFER_INCOMPLETE_ATTACHMENT,
      FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT,
      FRAMEBUFFER_INCOMPLETE_DIMENSIONS,
      FRAMEBUFFER_UNSUPPORTED,
      FRAMEBUFFER_INCOMPLETE_MULTISAMPLE,
    ]);
    // Act:
    const s1 = gl.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    const rb = g.createRenderbuffer() as unknown;
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rb as never);
    const s2 = gl.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    // Assert:
    expect(s1).toBe(FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT);
    expect(s2).toBe(FRAMEBUFFER_INCOMPLETE_ATTACHMENT);
    expect(s1).not.toBe(0);
    expect(s2).not.toBe(0);
    expect(allowed.has(s1 as never)).toBe(true);
    expect(allowed.has(s2 as never)).toBe(true);
  });
});

void ARRAY_BUFFER;
void COLOR_ATTACHMENT0;
void COLOR_BUFFER_BIT;
void FRAMEBUFFER;
void FRAMEBUFFER_COMPLETE;
void FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
void FRAMEBUFFER_INCOMPLETE_DIMENSIONS;
void FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT;
void FRAMEBUFFER_INCOMPLETE_MULTISAMPLE;
void FRAMEBUFFER_UNSUPPORTED;
void LINK_STATUS;
void NO_ERROR;
void RENDERBUFFER;
void RGBA4;
