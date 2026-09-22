/** Sprint 8 Task 12 — FBO-switch regression suite (TDD red phase). Headless software-GL framebuffer isolation. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { DirectVertex, WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ARRAY_BUFFER,
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  DITHER,
  FLOAT,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAGMENT_SHADER,
  LINK_STATUS,
  NO_ERROR,
  RENDERBUFFER,
  RGBA,
  RGBA4,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

function fboContext(): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: 4, height: 4 });
  if (gl === null) throw new Error('fboContext: factory returned null');
  return gl;
}

function solidTri(color: readonly [number, number, number, number]): DirectVertex[] {
  return [
    { position: [-1, -1, 0, 1], color },
    { position: [3, -1, 0, 1], color },
    { position: [-1, 3, 0, 1], color },
  ];
}

function readback(gl: WebGL1Context): Uint8Array {
  const out = new Uint8Array(4 * 4 * 4);
  gl.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, out);
  return out;
}

function pixelEquals(buf: Uint8Array, x: number, y: number, rgba: readonly [number, number, number, number]): boolean {
  const o = (x + y * 4) * 4;
  return buf[o] === rgba[0] && buf[o + 1] === rgba[1] && buf[o + 2] === rgba[2] && buf[o + 3] === rgba[3];
}

function containsColor(buf: Uint8Array, rgba: readonly [number, number, number, number]): boolean {
  for (let i = 0; i < buf.length; i += 4) {
    if (buf[i] === rgba[0] && buf[i + 1] === rgba[1] && buf[i + 2] === rgba[2] && buf[i + 3] === rgba[3]) return true;
  }
  return false;
}

function linkProgram(gl: WebGL1Context, vsSrc: string, fsSrc: string): NonNullable<ReturnType<WebGL1Context['createProgram']>> {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('shader creation failed');
  gl.shaderSource(vs, vsSrc);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('VS compile failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('FS compile failed');
  const program = gl.createProgram();
  if (program === null) throw new Error('program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('link failed');
  return program;
}

function bindFloatAttr(
  gl: WebGL1Context,
  program: NonNullable<ReturnType<WebGL1Context['createProgram']>>,
  name: string,
  size: number,
  floats: number[],
): void {
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array(floats), STATIC_DRAW);
  const loc = gl.getAttribLocation(program, name);
  if (loc < 0) throw new Error(`attrib ${name} not found`);
  gl.vertexAttribPointer(loc, size, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
}

const SOLID_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const SOLID_GREEN_FS = 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }';
const SOLID_BLUE_FS = 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0); }';

describe('fbo-switch regression', () => {
  it('consecutive_draws_targeting_different_fbos_land_exclusively_in_own_targets', () => {
    // Arrange:
    const gl = fboContext();
    gl.disable(DITHER);
    gl.viewport(0, 0, 4, 4);
    const fboA = gl.createFramebuffer();
    const fboB = gl.createFramebuffer();
    if (fboA === null || fboB === null) throw new Error('createFramebuffer failed');
    const rbA = gl.createRenderbuffer();
    const rbB = gl.createRenderbuffer();
    if (rbA === null || rbB === null) throw new Error('createRenderbuffer failed');
    gl.bindRenderbuffer(RENDERBUFFER, rbA);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbA);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    gl.bindRenderbuffer(RENDERBUFFER, rbB);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbB);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.clearColor(0, 1, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    const readA0 = readback(gl);
    expect(pixelEquals(readA0, 0, 0, [255, 0, 0, 255])).toBe(true);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    const readB0 = readback(gl);
    expect(pixelEquals(readB0, 0, 0, [0, 255, 0, 255])).toBe(true);
    // Act:
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.drawArrays(TRIANGLES, 0, 3, solidTri([0, 0, 1, 1]));
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.drawArrays(TRIANGLES, 0, 3, solidTri([1, 1, 1, 1]));
    // Assert:
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    const readA1 = readback(gl);
    expect(pixelEquals(readA1, 1, 1, [0, 0, 255, 255])).toBe(true);
    expect(containsColor(readA1, [255, 255, 255, 255])).toBe(false);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    const readB1 = readback(gl);
    expect(pixelEquals(readB1, 1, 1, [255, 255, 255, 255])).toBe(true);
    expect(containsColor(readB1, [0, 0, 255, 255])).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('repeated_alternating_draws_stay_isolated', () => {
    // Arrange:
    const gl = fboContext();
    gl.disable(DITHER);
    gl.viewport(0, 0, 4, 4);
    const fboA = gl.createFramebuffer();
    const fboB = gl.createFramebuffer();
    if (fboA === null || fboB === null) throw new Error('createFramebuffer failed');
    const rbA = gl.createRenderbuffer();
    const rbB = gl.createRenderbuffer();
    if (rbA === null || rbB === null) throw new Error('createRenderbuffer failed');
    gl.bindRenderbuffer(RENDERBUFFER, rbA);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbA);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    gl.bindRenderbuffer(RENDERBUFFER, rbB);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbB);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    // Act:
    for (let i = 0; i < 4; i += 1) {
      gl.bindFramebuffer(FRAMEBUFFER, fboA);
      gl.drawArrays(TRIANGLES, 0, 3, solidTri([1, 0, 1, 1]));
      gl.bindFramebuffer(FRAMEBUFFER, fboB);
      gl.drawArrays(TRIANGLES, 0, 3, solidTri([1, 1, 0, 1]));
    }
    // Assert:
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    const readA = readback(gl);
    expect(containsColor(readA, [255, 0, 255, 255])).toBe(true);
    expect(containsColor(readA, [255, 255, 0, 255])).toBe(false);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    const readB = readback(gl);
    expect(containsColor(readB, [255, 255, 0, 255])).toBe(true);
    expect(containsColor(readB, [255, 0, 255, 255])).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('default_buffer_to_fbo_isolation', () => {
    // Arrange:
    const gl = fboContext();
    gl.disable(DITHER);
    gl.viewport(0, 0, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const fboA = gl.createFramebuffer();
    if (fboA === null) throw new Error('createFramebuffer failed');
    const rbA = gl.createRenderbuffer();
    if (rbA === null) throw new Error('createRenderbuffer failed');
    gl.bindRenderbuffer(RENDERBUFFER, rbA);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbA);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    // Act:
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.drawArrays(TRIANGLES, 0, 3, solidTri([1, 0, 0, 1]));
    gl.bindFramebuffer(FRAMEBUFFER, null);
    gl.drawArrays(TRIANGLES, 0, 3, solidTri([0, 1, 1, 1]));
    // Assert:
    const def = readback(gl);
    expect(containsColor(def, [0, 255, 255, 255])).toBe(true);
    expect(containsColor(def, [255, 0, 0, 255])).toBe(false);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    const readA = readback(gl);
    expect(containsColor(readA, [255, 0, 0, 255])).toBe(true);
    expect(containsColor(readA, [0, 255, 255, 255])).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('buffered_triangles_target_isolation', () => {
    // Arrange:
    const gl = fboContext();
    gl.disable(DITHER);
    gl.viewport(0, 0, 4, 4);
    const fboA = gl.createFramebuffer();
    const fboB = gl.createFramebuffer();
    if (fboA === null || fboB === null) throw new Error('createFramebuffer failed');
    const rbA = gl.createRenderbuffer();
    const rbB = gl.createRenderbuffer();
    if (rbA === null || rbB === null) throw new Error('createRenderbuffer failed');
    gl.bindRenderbuffer(RENDERBUFFER, rbA);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbA);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    gl.bindRenderbuffer(RENDERBUFFER, rbB);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbB);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    // Act:
    const progG = linkProgram(gl, SOLID_VS, SOLID_GREEN_FS);
    gl.useProgram(progG);
    bindFloatAttr(gl, progG, 'aPos', 2, [-1, -1, 3, -1, -1, 3]);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.drawArrays(TRIANGLES, 0, 3);
    const progB = linkProgram(gl, SOLID_VS, SOLID_BLUE_FS);
    gl.useProgram(progB);
    bindFloatAttr(gl, progB, 'aPos', 2, [-1, -1, 3, -1, -1, 3]);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.drawArrays(TRIANGLES, 0, 3);
    // Assert:
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    const readA = readback(gl);
    expect(containsColor(readA, [0, 255, 0, 255])).toBe(true);
    expect(containsColor(readA, [0, 0, 255, 255])).toBe(false);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    const readB = readback(gl);
    expect(containsColor(readB, [0, 0, 255, 255])).toBe(true);
    expect(containsColor(readB, [0, 255, 0, 255])).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('zero_area_and_clipped_triangles_target_integrity', () => {
    // Arrange:
    const gl = fboContext();
    gl.disable(DITHER);
    gl.viewport(0, 0, 4, 4);
    const fboA = gl.createFramebuffer();
    const fboB = gl.createFramebuffer();
    if (fboA === null || fboB === null) throw new Error('createFramebuffer failed');
    const rbA = gl.createRenderbuffer();
    const rbB = gl.createRenderbuffer();
    if (rbA === null || rbB === null) throw new Error('createRenderbuffer failed');
    gl.bindRenderbuffer(RENDERBUFFER, rbA);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbA);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    gl.bindRenderbuffer(RENDERBUFFER, rbB);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbB);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    // Act:
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    gl.drawArrays(TRIANGLES, 0, 3, [
      { position: [0, 0, 0, 1], color: [1, 0, 0, 1] },
      { position: [0.5, 0.5, 0, 1], color: [1, 0, 0, 1] },
      { position: [1, 1, 0, 1], color: [1, 0, 0, 1] },
    ]);
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    gl.drawArrays(TRIANGLES, 0, 3, [
      { position: [10, 10, 0, 1], color: [0, 0, 1, 1] },
      { position: [12, 10, 0, 1], color: [0, 0, 1, 1] },
      { position: [10, 12, 0, 1], color: [0, 0, 1, 1] },
    ]);
    // Assert:
    gl.bindFramebuffer(FRAMEBUFFER, fboA);
    const readA = readback(gl);
    expect(Array.from(readA)).toEqual(Array.from(new Uint8Array(64).map((_, i) => (i % 4 === 3 ? 255 : 0))));
    gl.bindFramebuffer(FRAMEBUFFER, fboB);
    const readB = readback(gl);
    expect(Array.from(readB)).toEqual(Array.from(new Uint8Array(64).map((_, i) => (i % 4 === 3 ? 255 : 0))));
    expect(gl.getError()).toBe(NO_ERROR);
  });
});