/** Sprint 7 Task 4 TDD RED-phase tests — drawElements + getParameter limits. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ALIASED_LINE_WIDTH_RANGE,
  ALIASED_POINT_SIZE_RANGE,
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  ELEMENT_ARRAY_BUFFER,
  FLOAT,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINES,
  LINK_STATUS,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS,
  MAX_CUBE_MAP_TEXTURE_SIZE,
  MAX_DRAW_BUFFERS,
  MAX_FRAGMENT_UNIFORM_VECTORS,
  MAX_RENDERBUFFER_SIZE,
  MAX_TEXTURE_IMAGE_UNITS,
  MAX_TEXTURE_SIZE,
  MAX_VARYING_VECTORS,
  MAX_VERTEX_ATTRIBS,
  MAX_VERTEX_UNIFORM_VECTORS,
  MAX_VIEWPORT_DIMS,
  NO_ERROR,
  RENDERER,
  RGBA,
  SHADING_LANGUAGE_VERSION,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  UNSIGNED_INT,
  UNSIGNED_SHORT,
  VENDOR,
  VERSION,
  VERTEX_SHADER,
} from '../../src/gl/constants';

const W = 8;
const H = 8;
const VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const FS = 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }';

type DrawElementsFn = (mode: number, count: number, type: number, offset: number) => void;

function ctx(): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: W, height: H });
  if (gl === null) throw new Error('factory returned null');
  return gl;
}

function link(gl: WebGL1Context): { program: NonNullable<ReturnType<WebGL1Context['createProgram']>> } {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('shader creation failed');
  gl.shaderSource(vs, VS);
  gl.shaderSource(fs, FS);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('VS failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('FS failed');
  const program = gl.createProgram();
  if (program === null) throw new Error('program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('link failed');
  return { program };
}

function setupAttr(gl: WebGL1Context, floats: number[]): void {
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array(floats), STATIC_DRAW);
  const { program } = link(gl);
  gl.useProgram(program);
  const loc = gl.getAttribLocation(program, 'aPos');
  if (loc < 0) throw new Error('aPos not found');
  gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
}

function bindElements(gl: WebGL1Context, data: ArrayBufferView): void {
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('createBuffer failed');
  gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buf);
  gl.bufferData(ELEMENT_ARRAY_BUFFER, data, STATIC_DRAW);
}

function snapshot(gl: WebGL1Context): Uint8Array {
  const out = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, RGBA, UNSIGNED_BYTE, out);
  if (gl.getError() !== NO_ERROR) throw new Error('readPixels errored');
  return out;
}

function de(gl: WebGL1Context): DrawElementsFn {
  const fn = (gl as unknown as Record<string, unknown>)['drawElements'];
  if (typeof fn !== 'function') throw new Error('drawElements not implemented');
  return fn as DrawElementsFn;
}

describe('G1: getParameter limit table and system strings', () => {
  it('testGetParameterResourceLimitsTable returns exact values and types', () => {
    // Arrange:
    const gl = ctx();
    // Act:
    const v: Array<[number, unknown]> = [
      [MAX_VERTEX_ATTRIBS, gl.getParameter(MAX_VERTEX_ATTRIBS)],
      [MAX_VERTEX_UNIFORM_VECTORS, gl.getParameter(MAX_VERTEX_UNIFORM_VECTORS)],
      [MAX_VARYING_VECTORS, gl.getParameter(MAX_VARYING_VECTORS)],
      [MAX_TEXTURE_IMAGE_UNITS, gl.getParameter(MAX_TEXTURE_IMAGE_UNITS)],
      [MAX_COMBINED_TEXTURE_IMAGE_UNITS, gl.getParameter(MAX_COMBINED_TEXTURE_IMAGE_UNITS)],
      [MAX_FRAGMENT_UNIFORM_VECTORS, gl.getParameter(MAX_FRAGMENT_UNIFORM_VECTORS)],
      [MAX_DRAW_BUFFERS, gl.getParameter(MAX_DRAW_BUFFERS)],
      [MAX_TEXTURE_SIZE, gl.getParameter(MAX_TEXTURE_SIZE)],
      [MAX_CUBE_MAP_TEXTURE_SIZE, gl.getParameter(MAX_CUBE_MAP_TEXTURE_SIZE)],
      [MAX_RENDERBUFFER_SIZE, gl.getParameter(MAX_RENDERBUFFER_SIZE)],
      [MAX_VIEWPORT_DIMS, gl.getParameter(MAX_VIEWPORT_DIMS)],
      [ALIASED_POINT_SIZE_RANGE, gl.getParameter(ALIASED_POINT_SIZE_RANGE)],
      [ALIASED_LINE_WIDTH_RANGE, gl.getParameter(ALIASED_LINE_WIDTH_RANGE)],
    ];
    // Assert:
    const m = new Map(v);
    expect(m.get(MAX_VERTEX_ATTRIBS)).toBe(16);
    expect(m.get(MAX_VERTEX_UNIFORM_VECTORS)).toBe(128);
    expect(m.get(MAX_VARYING_VECTORS)).toBe(8);
    expect(m.get(MAX_TEXTURE_IMAGE_UNITS)).toBe(8);
    expect(m.get(MAX_COMBINED_TEXTURE_IMAGE_UNITS)).toBe(8);
    expect(m.get(MAX_FRAGMENT_UNIFORM_VECTORS)).toBe(16);
    expect(m.get(MAX_DRAW_BUFFERS)).toBe(1);
    expect(m.get(MAX_TEXTURE_SIZE)).toBe(4096);
    expect(m.get(MAX_CUBE_MAP_TEXTURE_SIZE)).toBe(4096);
    expect(m.get(MAX_RENDERBUFFER_SIZE)).toBe(4096);
    expect(m.get(MAX_VIEWPORT_DIMS)).toBeInstanceOf(Int32Array);
    expect(Array.from(m.get(MAX_VIEWPORT_DIMS) as Int32Array)).toEqual([4096, 4096]);
    expect(Array.from(m.get(ALIASED_POINT_SIZE_RANGE) as Int32Array)).toEqual([1, 1024]);
    expect(Array.from(m.get(ALIASED_LINE_WIDTH_RANGE) as Int32Array)).toEqual([1, 1]);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('testGetParameterStringsAndUnknownEnum returns strings and INVALID_ENUM', () => {
    // Arrange:
    const gl = ctx();
    // Act:
    const ver = gl.getParameter(VERSION);
    const sl = gl.getParameter(SHADING_LANGUAGE_VERSION);
    const ven = gl.getParameter(VENDOR);
    const ren = gl.getParameter(RENDERER);
    const bad = gl.getParameter(0x9999);
    // Assert:
    expect(ver).toBe('WebGL 1.0 (Software)');
    expect(sl).toBe('WebGL GLSL ES 1.0 (Software)');
    expect(typeof ven).toBe('string');
    expect(typeof ren).toBe('string');
    expect(bad).toBeNull();
    expect(gl.getError()).toBe(INVALID_ENUM);
  });
});

describe('G2: drawElements error matrix', () => {
  it('testDrawElementsInvalidMode records INVALID_ENUM', () => {
    // Arrange:
    const gl = ctx();
    setupAttr(gl, [-1, -1, 3, -1, -1, 3]);
    bindElements(gl, new Uint16Array([0, 1, 2]));
    expect(gl.getError()).toBe(NO_ERROR);
    const before = snapshot(gl);
    // Act:
    de(gl).call(gl, LINES, 3, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(Array.from(snapshot(gl))).toEqual(Array.from(before));
  });

  it('testDrawElementsNegativeCountOrOffset records INVALID_VALUE', () => {
    // Arrange:
    const gl = ctx();
    setupAttr(gl, [-1, -1, 3, -1, -1, 3]);
    bindElements(gl, new Uint16Array([0, 1, 2]));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    de(gl).call(gl, TRIANGLES, -1, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act:
    de(gl).call(gl, TRIANGLES, 3, UNSIGNED_SHORT, -2);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('testDrawElementsInvalidType records INVALID_ENUM', () => {
    // Arrange:
    const gl = ctx();
    setupAttr(gl, [-1, -1, 3, -1, -1, 3]);
    bindElements(gl, new Uint16Array([0, 1, 2]));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    de(gl).call(gl, TRIANGLES, 3, FLOAT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act:
    de(gl).call(gl, TRIANGLES, 3, UNSIGNED_INT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('testDrawElementsMisalignedOffset records INVALID_OPERATION', () => {
    // Arrange:
    const gl = ctx();
    setupAttr(gl, [-1, -1, 3, -1, -1, 3]);
    bindElements(gl, new Uint16Array([0, 1, 2]));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    de(gl).call(gl, TRIANGLES, 3, UNSIGNED_SHORT, 1);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('testDrawElementsMissingElementBuffer records INVALID_OPERATION', () => {
    // Arrange:
    const gl = ctx();
    setupAttr(gl, [-1, -1, 3, -1, -1, 3]);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    de(gl).call(gl, TRIANGLES, 3, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('testDrawElementsElementBufferOverflow records INVALID_OPERATION', () => {
    // Arrange:
    const gl = ctx();
    setupAttr(gl, [-1, -1, 3, -1, -1, 3]);
    bindElements(gl, new Uint8Array([0, 1, 2, 0]));
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    de(gl).call(gl, TRIANGLES, 3, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });
});

describe('G3: pixel parity', () => {
  it('testDrawElementsParityWithDrawArrays USHORT matches', () => {
    // Arrange:
    const a = ctx();
    setupAttr(a, [-1, -1, 3, -1, -1, 3, -1, -1, 3, -1, -1, 3]);
    a.clearColor(1, 0, 0, 1);
    a.clear(COLOR_BUFFER_BIT);
    const b = ctx();
    setupAttr(b, [-1, -1, 3, -1, -1, 3]);
    bindElements(b, new Uint16Array([0, 1, 2, 0, 1, 2]));
    b.clearColor(1, 0, 0, 1);
    b.clear(COLOR_BUFFER_BIT);
    // Act:
    a.drawArrays(TRIANGLES, 0, 6);
    expect(a.getError()).toBe(NO_ERROR);
    de(b).call(b, TRIANGLES, 6, UNSIGNED_SHORT, 0);
    expect(b.getError()).toBe(NO_ERROR);
    // Assert:
    expect(Array.from(snapshot(b))).toEqual(Array.from(snapshot(a)));
  });

  it('testDrawElementsParityWithDrawArrays UBYTE matches', () => {
    // Arrange:
    const a = ctx();
    setupAttr(a, [-1, -1, 3, -1, -1, 3, -1, -1, 3, -1, -1, 3]);
    a.clearColor(1, 0, 0, 1);
    a.clear(COLOR_BUFFER_BIT);
    const b = ctx();
    setupAttr(b, [-1, -1, 3, -1, -1, 3]);
    bindElements(b, new Uint8Array([0, 1, 2, 0, 1, 2]));
    b.clearColor(1, 0, 0, 1);
    b.clear(COLOR_BUFFER_BIT);
    // Act:
    a.drawArrays(TRIANGLES, 0, 6);
    expect(a.getError()).toBe(NO_ERROR);
    de(b).call(b, TRIANGLES, 6, UNSIGNED_BYTE, 0);
    expect(b.getError()).toBe(NO_ERROR);
    // Assert:
    expect(Array.from(snapshot(b))).toEqual(Array.from(snapshot(a)));
  });
});

describe('G4: bounds overflow', () => {
  it('testDrawElementsIndexOutOfAttributeRange untouched framebuffer', () => {
    // Arrange:
    const gl = ctx();
    setupAttr(gl, [-1, -1, 3, -1, -1, 3]);
    bindElements(gl, new Uint16Array([0, 1, 99]));
    gl.clearColor(0, 1, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = snapshot(gl);
    // Act:
    de(gl).call(gl, TRIANGLES, 3, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(Array.from(snapshot(gl))).toEqual(Array.from(before));
  });
});
