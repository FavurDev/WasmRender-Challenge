/** Sprint 8 Task 11 TD-017 TDD RED-phase tests — primitive modes, getShaderParameter corners, hint semantics. Headless, deterministic, AAA-structured. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ARRAY_BUFFER,
  BACK,
  CCW,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  CULL_FACE,
  DELETE_STATUS,
  DONT_CARE,
  FASTEST,
  FLOAT,
  FRAGMENT_SHADER,
  GENERATE_MIPMAP_HINT,
  INVALID_ENUM,
  LINES,
  LINE_LOOP,
  LINE_STRIP,
  NICEST,
  NO_ERROR,
  POINTS,
  RGBA,
  SHADER_TYPE,
  STATIC_DRAW,
  TRIANGLES,
  TRIANGLE_FAN,
  TRIANGLE_STRIP,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

function pmContext(w: number, h: number): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('pmContext: factory returned null');
  return gl;
}

function pmLink(gl: WebGL1Context, vsSrc: string, fsSrc: string): NonNullable<ReturnType<WebGL1Context['createProgram']>> {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('pmLink: shader creation failed');
  gl.shaderSource(vs, vsSrc);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('pmLink: VS failed: ' + gl.getShaderInfoLog(vs));
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('pmLink: FS failed: ' + gl.getShaderInfoLog(fs));
  const program = gl.createProgram();
  if (program === null) throw new Error('pmLink: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  return program;
}

function pmBindAttr(gl: WebGL1Context, program: NonNullable<ReturnType<WebGL1Context['createProgram']>>, name: string, size: number, floats: number[]): void {
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('pmBindAttr: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array(floats), STATIC_DRAW);
  const loc = gl.getAttribLocation(program, name);
  if (loc < 0) throw new Error(`pmBindAttr: attrib ${name} not found`);
  gl.vertexAttribPointer(loc, size, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
}

function pmPixel(gl: WebGL1Context, x: number, y: number): [number, number, number, number] {
  const out = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, RGBA, UNSIGNED_BYTE, out);
  return [out[0] as number, out[1] as number, out[2] as number, out[3] as number];
}

const PM_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const PM_FS = 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }';
const PM_POINTS_VS = 'attribute vec4 aPos; void main() { gl_PointSize = 4.0; gl_Position = aPos; }';

describe('Sprint 8 Task 11: primitive modes (RED)', () => {
  it('TEST-1: POINTS mode coverage with gl_PointSize=4', () => {
    // Arrange:
    const gl = pmContext(64, 64);
    const program = pmLink(gl, PM_POINTS_VS, PM_FS);
    gl.useProgram(program);
    pmBindAttr(gl, program, 'aPos', 2, [0, 0]);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(POINTS, 0, 1);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(pmPixel(gl, 32, 32)).toEqual([0, 255, 0, 255]);
    expect(pmPixel(gl, 30, 30)).toEqual([0, 255, 0, 255]);
    expect(pmPixel(gl, 0, 0)).toEqual([0, 0, 0, 255]);
  });

  it('TEST-2: LINES mode 1-pixel span coverage', () => {
    // Arrange:
    const gl = pmContext(32, 32);
    const program = pmLink(gl, PM_VS, PM_FS);
    gl.useProgram(program);
    pmBindAttr(gl, program, 'aPos', 2, [-0.5, 0, 0.5, 0]);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(LINES, 0, 2);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(pmPixel(gl, 16, 16)).toEqual([0, 255, 0, 255]);
    expect(pmPixel(gl, 8, 16)).toEqual([0, 255, 0, 255]);
    expect(pmPixel(gl, 16, 20)).toEqual([0, 0, 0, 255]);
  });

  it('TEST-3: LINE_STRIP vs LINE_LOOP segment counts', () => {
    // Arrange:
    const mk = (): { gl: WebGL1Context } => {
      const gl = pmContext(16, 16);
      const program = pmLink(gl, PM_VS, PM_FS);
      gl.useProgram(program);
      pmBindAttr(gl, program, 'aPos', 2, [-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(COLOR_BUFFER_BIT);
      return { gl };
    };
    // Act:
    const { gl: glStrip } = mk();
    glStrip.drawArrays(LINE_STRIP, 0, 4);
    // Assert:
    expect(glStrip.getError()).toBe(NO_ERROR);
    expect(pmPixel(glStrip, 8, 4)).toEqual([0, 255, 0, 255]);
    // Act:
    const { gl: glLoop } = mk();
    glLoop.drawArrays(LINE_LOOP, 0, 4);
    // Assert:
    expect(glLoop.getError()).toBe(NO_ERROR);
    expect(pmPixel(glLoop, 4, 8)).toEqual([0, 255, 0, 255]);
  });

  it('TEST-4: TRIANGLE_STRIP alternating winding with cull-face', () => {
    // Arrange:
    const gl = pmContext(16, 16);
    const program = pmLink(gl, PM_VS, PM_FS);
    gl.useProgram(program);
    pmBindAttr(gl, program, 'aPos', 2, [-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]);
    gl.enable(CULL_FACE);
    gl.cullFace(BACK);
    gl.frontFace(CCW);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLE_STRIP, 0, 4);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(pmPixel(gl, 8, 8)).toEqual([0, 255, 0, 255]);
  });

  it('TEST-5: TRIANGLE_FAN provoking root assembly', () => {
    // Arrange:
    const gl = pmContext(16, 16);
    const program = pmLink(gl, PM_VS, PM_FS);
    gl.useProgram(program);
    pmBindAttr(gl, program, 'aPos', 2, [0, 0, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLE_FAN, 0, 5);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(pmPixel(gl, 8, 8)).toEqual([0, 255, 0, 255]);
  });
});

describe('Sprint 8 Task 11: shader parameter and hint matrix (RED)', () => {
  it('TEST-6: getShaderParameter corner matrix', () => {
    // Arrange:
    const gl = pmContext(8, 8);
    const vs = gl.createShader(VERTEX_SHADER);
    const fs = gl.createShader(FRAGMENT_SHADER);
    if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
    gl.shaderSource(vs, 'attribute vec4 aPos; void main() { gl_Position = aPos; }');
    gl.shaderSource(fs, PM_FS);
    gl.compileShader(vs);
    gl.compileShader(fs);
    // Act & Assert:
    expect(gl.getShaderParameter(vs, SHADER_TYPE)).toBe(VERTEX_SHADER);
    expect(gl.getShaderParameter(fs, SHADER_TYPE)).toBe(FRAGMENT_SHADER);
    expect(gl.getShaderParameter(vs, DELETE_STATUS)).toBe(false);
    gl.deleteShader(vs);
    expect(gl.getShaderParameter(vs, DELETE_STATUS)).toBe(true);
    expect(gl.getShaderParameter(vs, COMPILE_STATUS)).toBe(true);
    expect(gl.getShaderParameter(vs, 0x9999)).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TEST-7: hint target and mode validation', () => {
    // Arrange:
    const gl = pmContext(8, 8);
    const withHint = gl as unknown as { hint(target: number, mode: number): void };
    expect(typeof withHint.hint).toBe('function');
    // Act & Assert:
    withHint.hint(GENERATE_MIPMAP_HINT, FASTEST);
    expect(gl.getError()).toBe(NO_ERROR);
    withHint.hint(GENERATE_MIPMAP_HINT, NICEST);
    expect(gl.getError()).toBe(NO_ERROR);
    withHint.hint(GENERATE_MIPMAP_HINT, DONT_CARE);
    expect(gl.getError()).toBe(NO_ERROR);
    withHint.hint(0x1234, FASTEST);
    expect(gl.getError()).toBe(INVALID_ENUM);
    withHint.hint(GENERATE_MIPMAP_HINT, 0x5678);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TEST-8: TRIANGLES observable invariance guard', () => {
    // Arrange:
    const gl = pmContext(8, 8);
    const program = pmLink(gl, PM_VS, PM_FS);
    gl.useProgram(program);
    pmBindAttr(gl, program, 'aPos', 2, [-1, -1, 3, -1, -1, 3]);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(pmPixel(gl, 4, 4)).toEqual([0, 255, 0, 255]);
  });
});
