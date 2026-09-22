/** Sprint 8 Task 1 VAO TDD RED-phase tests — attribute-state capture/restore, lifecycle, byte-identical draws. */
import { describe, expect, it } from 'vitest';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import { createSoftwareWebGLContext } from '../../src/entry';
import {
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  FLOAT,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  INVALID_OPERATION,
  LINK_STATUS,
  NO_ERROR,
  RGBA,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_ARRAY_BINDING,
  VERTEX_ATTRIB_ARRAY_BUFFER_BINDING,
  VERTEX_ATTRIB_ARRAY_ENABLED,
  VERTEX_ATTRIB_ARRAY_NORMALIZED,
  VERTEX_ATTRIB_ARRAY_POINTER,
  VERTEX_ATTRIB_ARRAY_SIZE,
  VERTEX_ATTRIB_ARRAY_STRIDE,
  VERTEX_ATTRIB_ARRAY_TYPE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

const W = 8;
const H = 8;
const VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const FS = 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }';

function vaoContext(): WebGL2Context {
  // Arrange helper: fresh per-test context.
  return new WebGL2Context({ width: W, height: H });
}

function linkPair(gl: WebGL2Context): { program: NonNullable<ReturnType<WebGL2Context['createProgram']>> } {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
  gl.shaderSource(vs, VS);
  gl.shaderSource(fs, FS);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('arrange: VS failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('arrange: FS failed');
  const program = gl.createProgram();
  if (program === null) throw new Error('arrange: createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('arrange: link failed');
  return { program };
}

function snapshot(gl: WebGL2Context): Uint8Array {
  // Arrange helper: full-buffer readback snapshot.
  const out = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, RGBA, UNSIGNED_BYTE, out);
  if (gl.getError() !== NO_ERROR) throw new Error('snapshot: readPixels errored');
  return out;
}

describe('Sprint 8 Task 1 VAOs (RED)', () => {
  it('TEST 1: create/bind round-trip captures all 16 attribute descriptors', () => {
    // Arrange:
    const gl = vaoContext();
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const { program } = linkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    // Assert:
    expect(vao).not.toBeNull();
    expect(gl.isVertexArray(vao)).toBe(true);
    expect(gl.getParameter(VERTEX_ARRAY_BINDING)).toBe(vao);
    expect(gl.getVertexAttrib(loc, VERTEX_ATTRIB_ARRAY_ENABLED)).toBe(true);
    expect(gl.getVertexAttrib(loc, VERTEX_ATTRIB_ARRAY_SIZE)).toBe(2);
    expect(gl.getVertexAttrib(loc, VERTEX_ATTRIB_ARRAY_TYPE)).toBe(FLOAT);
    expect(gl.getVertexAttrib(loc, VERTEX_ATTRIB_ARRAY_NORMALIZED)).toBe(false);
    expect(gl.getVertexAttrib(loc, VERTEX_ATTRIB_ARRAY_STRIDE)).toBe(0);
    expect(gl.getVertexAttribOffset(loc, VERTEX_ATTRIB_ARRAY_POINTER)).toBe(0);
    expect(gl.getVertexAttrib(loc, VERTEX_ATTRIB_ARRAY_BUFFER_BINDING)).toBe(buf);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TEST 2: deleting the bound VAO resets binding to null and defaults', () => {
    // Arrange:
    const gl = vaoContext();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    expect(gl.getParameter(VERTEX_ARRAY_BINDING)).toBe(vao);
    // Act:
    gl.deleteVertexArray(vao);
    // Assert:
    expect(gl.getParameter(VERTEX_ARRAY_BINDING)).toBe(null);
    expect(gl.isVertexArray(vao)).toBe(false);
    expect(gl.getVertexAttrib(0, VERTEX_ATTRIB_ARRAY_ENABLED)).toBe(false);
    expect(gl.getVertexAttrib(0, VERTEX_ATTRIB_ARRAY_SIZE)).toBe(4);
    expect(gl.getVertexAttribOffset(0, VERTEX_ATTRIB_ARRAY_POINTER)).toBe(0);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TEST 3: isVertexArray false for null, deleted, foreign, and pre-bind objects', () => {
    // Arrange:
    const gl = vaoContext();
    const vao = gl.createVertexArray();
    const other = vaoContext();
    const foreign = other.createVertexArray();
    // Act: query before any bind.
    // Assert:
    expect(gl.isVertexArray(null)).toBe(false);
    expect(gl.isVertexArray(vao)).toBe(false);
    expect(gl.isVertexArray(foreign)).toBe(false);
    expect(gl.isVertexArray({} as unknown)).toBe(false);
    gl.deleteVertexArray(vao);
    expect(gl.isVertexArray(vao)).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TEST 4: VAO draw is byte-identical to non-VAO draw', () => {
    // Arrange:
    const gl = vaoContext();
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const { program } = linkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    const expected = snapshot(gl);
    // Act: capture state into a VAO, clear, redraw through the VAO.
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    const actual = snapshot(gl);
    // Assert:
    expect(Array.from(actual)).toEqual(Array.from(expected));
  });

  it('TEST 5: binding a deleted or foreign VAO records INVALID_OPERATION', () => {
    // Arrange:
    const gl = vaoContext();
    const vao = gl.createVertexArray();
    gl.deleteVertexArray(vao);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = gl.getParameter(VERTEX_ARRAY_BINDING);
    const other = vaoContext();
    const foreign = other.createVertexArray();
    other.bindVertexArray(foreign);
    // Act:
    gl.bindVertexArray(vao);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getParameter(VERTEX_ARRAY_BINDING)).toBe(before);
    // Act:
    gl.bindVertexArray(foreign);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getParameter(VERTEX_ARRAY_BINDING)).toBe(before);
  });

  it('TEST 6: deleting null, undefined, deleted, or foreign VAOs is silent', () => {
    // Arrange:
    const gl = vaoContext();
    const vao = gl.createVertexArray();
    gl.deleteVertexArray(vao);
    expect(gl.getError()).toBe(NO_ERROR);
    const other = vaoContext();
    const foreign = other.createVertexArray();
    other.bindVertexArray(foreign);
    // Act + Assert:
    gl.deleteVertexArray(null);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.deleteVertexArray(undefined as unknown as null);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.deleteVertexArray(vao);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.deleteVertexArray(foreign);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TEST 7: unbinding restores prior state without leaking VAO edits', () => {
    // Arrange:
    const gl = vaoContext();
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([1, 2, 3, 4]), STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    // Act: mutate state while bound, then unbind.
    gl.disableVertexAttribArray(0);
    gl.bindVertexArray(null);
    // Assert:
    expect(gl.getParameter(VERTEX_ARRAY_BINDING)).toBe(null);
    expect(gl.getVertexAttrib(0, VERTEX_ATTRIB_ARRAY_ENABLED)).toBe(true);
    expect(gl.getVertexAttrib(0, VERTEX_ATTRIB_ARRAY_SIZE)).toBe(2);
    // Act: rebind and confirm the VAO kept its own edit.
    gl.bindVertexArray(vao);
    // Assert:
    expect(gl.getVertexAttrib(0, VERTEX_ATTRIB_ARRAY_ENABLED)).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TEST 8: getVertexAttribOffset with bad pname records INVALID_ENUM', () => {
    // Arrange:
    const gl = vaoContext();
    // Named constant (no bare hex): invalid pname probe.
    const INVALID_PNAME = 0x9999;
    // Act:
    const value = gl.getVertexAttribOffset(0, INVALID_PNAME);
    // Assert:
    expect(value).toBe(0);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TEST 9: WebGL1 entry points expose no VAO methods', () => {
    // Arrange:
    const gl1 = createSoftwareWebGLContext({ width: W, height: H });
    if (gl1 === null) throw new Error('arrange: factory returned null');
    // Act: probe the WebGL1 surface for VAO entry points.
    const probe = gl1 as unknown as Record<string, unknown>;
    // Assert:
    expect('createVertexArray' in probe).toBe(false);
    expect('bindVertexArray' in probe).toBe(false);
    expect('deleteVertexArray' in probe).toBe(false);
    expect('isVertexArray' in probe).toBe(false);
    expect(gl1.getError()).toBe(NO_ERROR);
  });
});
