/** Sprint 8 Task 8 instanced draw TDD RED-phase tests — divisor, instanced draws, drawRangeElements. */
import { describe, expect, it } from 'vitest';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import {
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  ELEMENT_ARRAY_BUFFER,
  FLOAT,
  FRAGMENT_SHADER,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINK_STATUS,
  NO_ERROR,
  RGBA,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  UNSIGNED_SHORT,
  VERTEX_ATTRIB_ARRAY_DIVISOR,
  VERTEX_SHADER,
} from '../../src/gl/constants';

type InstancedFacade = {
  drawArraysInstanced(mode: number, first: number, count: number, instanceCount: number): void;
  drawElementsInstanced(mode: number, count: number, type: number, offset: number, instanceCount: number): void;
  drawRangeElements(mode: number, start: number, end: number, count: number, type: number, offset: number): void;
};

const W = 8;
const H = 8;
const VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const FS = 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }';

function freshContext(): WebGL2Context {
  // Arrange helper: fresh per-test context.
  return new WebGL2Context({ width: W, height: H });
}

function inst(gl: WebGL2Context): InstancedFacade {
  return gl as unknown as InstancedFacade;
}

function linkPair(gl: WebGL2Context, vsrc = VS, fsrc = FS): { program: NonNullable<ReturnType<WebGL2Context['createProgram']>> } {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
  gl.shaderSource(vs, vsrc);
  gl.shaderSource(fs, fsrc);
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

describe('Sprint 8 Task 8 instanced draws (RED)', () => {
  it('test_vertex_attrib_divisor_validation_and_state', () => {
    // Arrange:
    const gl = freshContext();
    const initial = gl.getVertexAttrib(0, VERTEX_ATTRIB_ARRAY_DIVISOR);
    // Act:
    gl.vertexAttribDivisor(0, 2);
    const errSet = gl.getError();
    const updated = gl.getVertexAttrib(0, VERTEX_ATTRIB_ARRAY_DIVISOR);
    gl.vertexAttribDivisor(0, -1);
    const errNeg = gl.getError();
    gl.vertexAttribDivisor(16, 1);
    const errIdx = gl.getError();
    // Assert:
    expect(initial).toBe(0);
    expect(errSet).toBe(NO_ERROR);
    expect(updated).toBe(2);
    expect(errNeg).toBe(INVALID_VALUE);
    expect(gl.getVertexAttrib(0, VERTEX_ATTRIB_ARRAY_DIVISOR)).toBe(2);
    expect(errIdx).toBe(INVALID_VALUE);
  });

  it('test_draw_arrays_instanced_two_instances_distinct_positions', () => {
    // Arrange:
    const gl = freshContext();
    const vsrc = 'attribute vec2 a_pos; attribute vec2 a_offset; void main() { gl_Position = vec4(a_pos + a_offset, 0.0, 1.0); }';
    const { program } = linkPair(gl, vsrc, 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }');
    gl.useProgram(program);
    const locPos = gl.getAttribLocation(program, 'a_pos');
    const locOff = gl.getAttribLocation(program, 'a_offset');
    if (locPos < 0 || locOff < 0) throw new Error('arrange: attrib locations not found');
    const b0 = gl.createBuffer();
    const b1 = gl.createBuffer();
    if (b0 === null || b1 === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, b0);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    gl.vertexAttribPointer(locPos, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(locPos);
    gl.bindBuffer(ARRAY_BUFFER, b1);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([0, 0, 1, 0]), STATIC_DRAW);
    gl.vertexAttribPointer(locOff, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(locOff);
    gl.vertexAttribDivisor(locPos, 0);
    gl.vertexAttribDivisor(locOff, 1);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    inst(gl).drawArraysInstanced(TRIANGLES, 0, 3, 2);
    const pixels = new Uint8Array(2 * 2 * 4);
    gl.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, pixels);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(pixels[0]).toBe(255);
    expect(pixels[4]).toBe(255);
  });

  it('test_draw_elements_instanced_indexed_rendering', () => {
    // Arrange:
    const gl = freshContext();
    const { program } = linkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    const vb = gl.createBuffer();
    if (vb === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, vb);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), STATIC_DRAW);
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    const ib = gl.createBuffer();
    if (ib === null) throw new Error('arrange: index buffer failed');
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), STATIC_DRAW);
    gl.vertexAttribDivisor(loc, 0);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    inst(gl).drawElementsInstanced(TRIANGLES, 6, UNSIGNED_SHORT, 0, 4);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    const full = snapshot(gl);
    expect(full.length).toBe(W * H * 4);
  });

  it('test_draw_range_elements_bounds_validation', () => {
    // Arrange:
    const gl = freshContext();
    const { program } = linkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    const vb = gl.createBuffer();
    if (vb === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, vb);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    const ib = gl.createBuffer();
    if (ib === null) throw new Error('arrange: index buffer failed');
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2]), STATIC_DRAW);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act & Assert:
    inst(gl).drawRangeElements(TRIANGLES, 2, 1, 3, UNSIGNED_SHORT, 0);
    expect(gl.getError()).toBe(INVALID_VALUE);
    inst(gl).drawRangeElements(TRIANGLES, 1, 3, 3, UNSIGNED_SHORT, 0);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    inst(gl).drawRangeElements(TRIANGLES, 0, 1, 3, UNSIGNED_SHORT, 0);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    inst(gl).drawRangeElements(TRIANGLES, 0, 2, 3, UNSIGNED_SHORT, 0);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('test_instanced_draw_attribute_buffer_overrun_error', () => {
    // Arrange:
    const gl = freshContext();
    const vsrc = 'attribute vec2 a_pos; attribute vec2 a_off; void main() { gl_Position = vec4(a_pos + a_off, 0.0, 1.0); }';
    const { program } = linkPair(gl, vsrc, FS);
    gl.useProgram(program);
    const locPos = gl.getAttribLocation(program, 'a_pos');
    const locOff = gl.getAttribLocation(program, 'a_off');
    if (locPos < 0 || locOff < 0) throw new Error('arrange: attrib locations not found');
    const b0 = gl.createBuffer();
    const b1 = gl.createBuffer();
    if (b0 === null || b1 === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, b0);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    gl.vertexAttribPointer(locPos, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(locPos);
    gl.bindBuffer(ARRAY_BUFFER, b1);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([0, 0]), STATIC_DRAW);
    gl.vertexAttribPointer(locOff, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(locOff);
    gl.vertexAttribDivisor(locOff, 1);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = snapshot(gl);
    // Act:
    inst(gl).drawArraysInstanced(TRIANGLES, 0, 3, 2);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(Array.from(snapshot(gl))).toEqual(Array.from(before));
  });

  it('test_gl_instance_id_propagation_es300', () => {
    // Arrange:
    const gl = freshContext();
    const vsrc = '#version 300 es\nin vec4 aPos; flat out int v_instance; void main() { v_instance = gl_InstanceID; gl_Position = aPos; }';
    const fsrc = '#version 300 es\nprecision mediump float; flat in int v_instance; out vec4 o; void main() { o = v_instance == 0 ? vec4(1.0,0.0,0.0,1.0) : vec4(0.0,1.0,0.0,1.0); }';
    const { program } = linkPair(gl, vsrc, fsrc);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    const vb = gl.createBuffer();
    if (vb === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, vb);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    inst(gl).drawArraysInstanced(TRIANGLES, 0, 3, 2);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    const full = snapshot(gl);
    expect(full.length).toBe(W * H * 4);
  });

  it('test_divisor_0_equivalence_to_plain_draw_arrays', () => {
    // Arrange:
    const gl = freshContext();
    const { program } = linkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    const vb = gl.createBuffer();
    if (vb === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, vb);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribDivisor(loc, 0);
    // Act:
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    const bufA = snapshot(gl);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    inst(gl).drawArraysInstanced(TRIANGLES, 0, 3, 1);
    expect(gl.getError()).toBe(NO_ERROR);
    const bufB = snapshot(gl);
    // Assert:
    expect(Array.from(bufB)).toEqual(Array.from(bufA));
  });

  it('test_instanced_draw_zero_counts_silent_noop', () => {
    // Arrange:
    const gl = freshContext();
    const { program } = linkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    const vb = gl.createBuffer();
    if (vb === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, vb);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    const ib = gl.createBuffer();
    if (ib === null) throw new Error('arrange: index buffer failed');
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2]), STATIC_DRAW);
    gl.clearColor(0.5, 0.5, 0.5, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = snapshot(gl);
    // Act:
    inst(gl).drawArraysInstanced(TRIANGLES, 0, 0, 5);
    expect(gl.getError()).toBe(NO_ERROR);
    inst(gl).drawArraysInstanced(TRIANGLES, 0, 3, 0);
    expect(gl.getError()).toBe(NO_ERROR);
    inst(gl).drawElementsInstanced(TRIANGLES, 0, UNSIGNED_SHORT, 0, 5);
    expect(gl.getError()).toBe(NO_ERROR);
    inst(gl).drawElementsInstanced(TRIANGLES, 3, UNSIGNED_SHORT, 0, 0);
    expect(gl.getError()).toBe(NO_ERROR);
    // Assert:
    expect(Array.from(snapshot(gl))).toEqual(Array.from(before));
  });
});
