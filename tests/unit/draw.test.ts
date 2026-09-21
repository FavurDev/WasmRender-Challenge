/** Sprint 5 Task 4 vertex fetch TDD RED-phase tests (SOW-REQ-017) — bounds validation, stride/offset extraction, normalization, defaults, generic fallback, zero-allocation purity. */
import { describe, expect, it } from 'vitest';
import {
  createVertexAttribTargetMap,
  extractComponent,
  fetchVertexAttributes,
  getTypeByteSize,
  validateVertexAttribRange,
} from '../../src/gl/vertex-fetch';
import type { AttribValidationResult } from '../../src/gl/vertex-fetch';
import type { BufferObject } from '../../src/gl/buffer';
import type { VertexAttribDescriptor } from '../../src/gl/state';
import {
  BYTE,
  FIXED,
  FLOAT,
  SHORT,
  STATIC_DRAW,
  UNSIGNED_BYTE,
  UNSIGNED_SHORT,
} from '../../src/gl/constants';

function makeBuffer(data: ArrayBuffer): BufferObject {
  return { id: 1, alive: true, data, byteLength: data.byteLength, usage: STATIC_DRAW, target: 0 };
}

function disabledDesc(): VertexAttribDescriptor {
  return {
    enabled: false, size: 4, type: FLOAT, normalized: false,
    stride: 0, offset: 0, buffer: null, divisor: 0, genericValue: [0, 0, 0, 1],
  };
}

function descriptors16(): VertexAttribDescriptor[] {
  return Array.from({ length: 16 }, () => disabledDesc());
}

describe('Group 1: Bounds and precondition validation', () => {
  it('TEST 1: in-bounds tightly-packed stride passes', () => {
    // Arrange:
    const storage = new ArrayBuffer(36);
    const bufferObj = makeBuffer(storage);
    const descriptors = descriptors16();
    descriptors[0] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    const activeAttribs = [{ location: 0, name: 'a_pos', size: 3, type: FLOAT }];
    // Act:
    const result: AttribValidationResult = validateVertexAttribRange(descriptors, () => bufferObj, 0, 3, activeAttribs);
    // Assert:
    expect(result.ok).toBe(true);
    expect(result.failedAttributeIndex).toBeUndefined();
  });

  it('TEST 2: out-of-bounds range exceeding byteLength reports failure', () => {
    // Arrange:
    const storage = new ArrayBuffer(24);
    const bufferObj = makeBuffer(storage);
    const descriptors = descriptors16();
    descriptors[0] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    const activeAttribs = [{ location: 0, name: 'a_pos', size: 3, type: FLOAT }];
    // Act:
    const result = validateVertexAttribRange(descriptors, () => bufferObj, 0, 3, activeAttribs);
    // Assert:
    expect(result.ok).toBe(false);
    expect(result.failedAttributeIndex).toBe(0);
    expect(result.reason).toContain('Attribute range exceeds buffer byteLength');
  });

  it('TEST 3: enabled attribute with null buffer or null data reports failure', () => {
    // Arrange:
    const nullDataBuf: BufferObject = { id: 2, alive: true, data: null, byteLength: 0, usage: STATIC_DRAW, target: 0 };
    const descriptors = descriptors16();
    descriptors[0] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: null, divisor: 0, genericValue: [0, 0, 0, 1] };
    descriptors[1] = { enabled: true, size: 4, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: nullDataBuf, divisor: 0, genericValue: [0, 0, 0, 1] };
    // Act:
    const result1 = validateVertexAttribRange(descriptors, () => null, 0, 3, [{ location: 0, name: 'a_pos', size: 3, type: FLOAT }]);
    const result2 = validateVertexAttribRange(descriptors, () => nullDataBuf, 0, 3, [{ location: 1, name: 'a_col', size: 4, type: FLOAT }]);
    // Assert:
    expect(result1.ok).toBe(false);
    expect(result1.failedAttributeIndex).toBe(0);
    expect(result2.ok).toBe(false);
    expect(result2.failedAttributeIndex).toBe(1);
  });

  it('TEST 4: zero vertex count or disabled attributes pass unconditionally', () => {
    // Arrange:
    const descriptorsNull = descriptors16();
    descriptorsNull[0] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: null, divisor: 0, genericValue: [0, 0, 0, 1] };
    const descriptorsDisabled = descriptors16();
    // Act:
    const resZero = validateVertexAttribRange(descriptorsNull, () => null, 0, 0);
    const resDisabled = validateVertexAttribRange(descriptorsDisabled, () => null, 0, 3);
    // Assert:
    expect(resZero.ok).toBe(true);
    expect(resDisabled.ok).toBe(true);
  });
});

describe('Group 2: Stride and offset extraction', () => {
  it('TEST 5: stride-12 FLOAT vec3 extracts floats at vertex 2 offset 24', () => {
    // Arrange:
    const storage = new ArrayBuffer(36);
    new Float32Array(storage).set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bufferObj = makeBuffer(storage);
    const descriptors = descriptors16();
    descriptors[0] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 12, offset: 0, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    const activeAttribs = [{ location: 0, name: 'a_pos', size: 3, type: FLOAT }];
    const targetMap = new Map<number, Float32Array>([[0, new Float32Array([0, 0, 0, 1])]]);
    // Act:
    fetchVertexAttributes(descriptors, () => bufferObj, 2, activeAttribs, targetMap);
    // Assert:
    expect([...(targetMap.get(0) as Float32Array)]).toEqual([7, 8, 9, 1]);
  });

  it('TEST 6: custom offset and interleaved stride extraction', () => {
    // Arrange:
    const storage = new ArrayBuffer(48);
    const view = new DataView(storage);
    view.setFloat32(24, 10.0, true);
    view.setFloat32(28, 20.0, true);
    view.setUint8(32, 255);
    view.setUint8(33, 128);
    view.setUint8(34, 64);
    view.setUint8(35, 255);
    const bufferObj = makeBuffer(storage);
    const descriptors = descriptors16();
    descriptors[0] = { enabled: true, size: 2, type: FLOAT, normalized: false, stride: 24, offset: 0, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    descriptors[1] = { enabled: true, size: 4, type: UNSIGNED_BYTE, normalized: true, stride: 24, offset: 8, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    const activeAttribs = [
      { location: 0, name: 'a_pos', size: 2, type: FLOAT },
      { location: 1, name: 'a_col', size: 4, type: UNSIGNED_BYTE },
    ];
    const targetMap = new Map<number, Float32Array>([
      [0, new Float32Array([0, 0, 0, 1])],
      [1, new Float32Array([0, 0, 0, 1])],
    ]);
    // Act:
    fetchVertexAttributes(descriptors, () => bufferObj, 1, activeAttribs, targetMap);
    // Assert:
    expect([...(targetMap.get(0) as Float32Array)]).toEqual([10, 20, 0, 1]);
    const slot1 = targetMap.get(1) as Float32Array;
    expect(slot1[0]).toBe(1.0);
    expect(slot1[1]).toBeCloseTo(Math.fround(128 / 255.0), 6);
    expect(slot1[2]).toBeCloseTo(Math.fround(64 / 255.0), 6);
    expect(slot1[3]).toBe(1.0);
  });
});

describe('Group 3: Type normalization and conversion', () => {
  it('TEST 7: UNSIGNED_BYTE and UNSIGNED_SHORT normalization and non-normalized conversions', () => {
    // Arrange:
    const ub = new ArrayBuffer(3);
    new Uint8Array(ub).set([255, 0, 51]);
    const ubView = new DataView(ub);
    const us = new ArrayBuffer(6);
    const usView = new DataView(us);
    usView.setUint16(0, 65535, true);
    usView.setUint16(2, 0, true);
    usView.setUint16(4, 32767, true);
    // Act:
    const ubN255 = extractComponent(ubView, 0, UNSIGNED_BYTE, true);
    const ubN0 = extractComponent(ubView, 1, UNSIGNED_BYTE, true);
    const ubN51 = extractComponent(ubView, 2, UNSIGNED_BYTE, true);
    const ubRaw = extractComponent(ubView, 2, UNSIGNED_BYTE, false);
    const usNMax = extractComponent(usView, 0, UNSIGNED_SHORT, true);
    const usN0 = extractComponent(usView, 2, UNSIGNED_SHORT, true);
    const usRaw = extractComponent(usView, 4, UNSIGNED_SHORT, false);
    // Assert:
    expect(ubN255).toBe(1.0);
    expect(ubN0).toBe(0.0);
    expect(ubN51).toBeCloseTo(Math.fround(51 / 255.0), 6);
    expect(ubRaw).toBe(51.0);
    expect(usNMax).toBe(1.0);
    expect(usN0).toBe(0.0);
    expect(usRaw).toBe(32767.0);
  });

  it('TEST 8: signed BYTE, signed SHORT normalization and FIXED 16.16 conversion', () => {
    // Arrange:
    const sb = new ArrayBuffer(4);
    new Int8Array(sb).set([-128, -127, 0, 127]);
    const sbView = new DataView(sb);
    const ss = new ArrayBuffer(6);
    const ssView = new DataView(ss);
    ssView.setInt16(0, -32768, true);
    ssView.setInt16(2, 0, true);
    ssView.setInt16(4, 32767, true);
    const fx = new ArrayBuffer(12);
    const fxView = new DataView(fx);
    fxView.setInt32(0, 0x00010000, true);
    fxView.setInt32(4, -65536, true);
    fxView.setInt32(8, 0x00008000, true);
    // Act:
    const bMin = extractComponent(sbView, 0, BYTE, true);
    const bMin1 = extractComponent(sbView, 1, BYTE, true);
    const bZero = extractComponent(sbView, 2, BYTE, true);
    const bMax = extractComponent(sbView, 3, BYTE, true);
    const sMin = extractComponent(ssView, 0, SHORT, true);
    const sMax = extractComponent(ssView, 4, SHORT, true);
    const fOne = extractComponent(fxView, 0, FIXED, false);
    const fNegOne = extractComponent(fxView, 4, FIXED, false);
    const fHalf = extractComponent(fxView, 8, FIXED, false);
    // Assert:
    expect(bMin).toBe(-1.0);
    expect(bMin1).toBe(-1.0);
    expect(bZero).toBeCloseTo(Math.fround(1.0 / 255.0), 6);
    expect(bMax).toBe(1.0);
    expect(sMin).toBe(-1.0);
    expect(sMax).toBe(1.0);
    expect(fOne).toBe(1.0);
    expect(fNegOne).toBe(-1.0);
    expect(fHalf).toBe(0.5);
  });
});

describe('Group 4: Component defaulting, generic fallback, and purity', () => {
  it('TEST 9: vector size < 4 defaults missing components to [0,0,0,1]', () => {
    // Arrange:
    const storage = new ArrayBuffer(12);
    new Float32Array(storage).set([5.0, 6.0, 7.0]);
    const bufferObj = makeBuffer(storage);
    const mk = (size: number): VertexAttribDescriptor[] => {
      const d = descriptors16();
      d[0] = { enabled: true, size, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
      return d;
    };
    const activeAttribs = [{ location: 0, name: 'a', size: 4, type: FLOAT }];
    // Act:
    const m1 = new Map<number, Float32Array>([[0, new Float32Array([0, 0, 0, 1])]]);
    fetchVertexAttributes(mk(1), () => bufferObj, 0, activeAttribs, m1);
    const m2 = new Map<number, Float32Array>([[0, new Float32Array([0, 0, 0, 1])]]);
    fetchVertexAttributes(mk(2), () => bufferObj, 0, activeAttribs, m2);
    const m3 = new Map<number, Float32Array>([[0, new Float32Array([0, 0, 0, 1])]]);
    fetchVertexAttributes(mk(3), () => bufferObj, 0, activeAttribs, m3);
    // Assert:
    expect([...(m1.get(0) as Float32Array)]).toEqual([5, 0, 0, 1]);
    expect([...(m2.get(0) as Float32Array)]).toEqual([5, 6, 0, 1]);
    expect([...(m3.get(0) as Float32Array)]).toEqual([5, 6, 7, 1]);
  });

  it('TEST 10: disabled attribute array supplies genericValue without buffer reads', () => {
    // Arrange:
    const descriptors = descriptors16();
    descriptors[2] = { enabled: false, size: 4, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: null, divisor: 0, genericValue: [0.25, 0.5, 0.75, 1.0] };
    const activeAttribs = [{ location: 2, name: 'a_c', size: 4, type: FLOAT }];
    const targetMap = new Map<number, Float32Array>([[2, new Float32Array([0, 0, 0, 1])]]);
    // Act:
    const out = fetchVertexAttributes(descriptors, () => null, 0, activeAttribs, targetMap);
    // Assert:
    expect([...(out.get(2) as Float32Array)]).toEqual([0.25, 0.5, 0.75, 1.0]);
  });

  it('TEST 11: zero per-vertex heap allocation with reusable target map', () => {
    // Arrange:
    const storage = new ArrayBuffer(24);
    new Float32Array(storage).set([1, 2, 3, 4, 5, 6]);
    const bufferObj = makeBuffer(storage);
    expect(getTypeByteSize(FLOAT)).toBe(4);
    const descriptors = descriptors16();
    descriptors[0] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    const activeAttribs = [{ location: 0, name: 'a_pos', size: 3, type: FLOAT }];
    const targetMap = createVertexAttribTargetMap(activeAttribs);
    const ref = targetMap.get(0) as Float32Array;
    // Act:
    fetchVertexAttributes(descriptors, () => bufferObj, 0, activeAttribs, targetMap);
    const v0 = [...(targetMap.get(0) as Float32Array)];
    fetchVertexAttributes(descriptors, () => bufferObj, 1, activeAttribs, targetMap);
    const v1 = [...(targetMap.get(0) as Float32Array)];
    // Assert:
    expect(targetMap.get(0)).toBe(ref);
    expect(v0).toEqual([1, 2, 3, 1]);
    expect(v1).toEqual([4, 5, 6, 1]);
  });
});
/** Sprint 5 Task 5 TDD RED-phase tests — drawArrays orchestrator precondition matrix, happy-path TRIANGLES draw, TD-009 uniform regressions. Appended; lines 1-273 untouched. */
import { createSoftwareWebGLContext } from '../../src/entry';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import { DrawingBuffer } from '../../src/gl/framebuffer';
import {
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  FRAGMENT_SHADER,
  FRAMEBUFFER_COMPLETE,
  FRAMEBUFFER_INCOMPLETE_ATTACHMENT,
  INVALID_ENUM,
  INVALID_FRAMEBUFFER_OPERATION,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINK_STATUS,
  NO_ERROR,
  POINTS,
  RGBA,
  TRIANGLES,
  VERTEX_SHADER,
} from '../../src/gl/constants';

const T5_W = 8;
const T5_H = 8;
const T5_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const T5_FS = 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }';

function t5Context(): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: T5_W, height: T5_H });
  if (gl === null) throw new Error('t5Context: factory returned null');
  return gl;
}

function t5LinkPair(gl: WebGL1Context, vsrc = T5_VS, fsrc = T5_FS): { program: NonNullable<ReturnType<WebGL1Context['createProgram']>> } {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('t5LinkPair: shader creation failed');
  gl.shaderSource(vs, vsrc);
  gl.shaderSource(fs, fsrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('t5LinkPair: VS failed: ' + gl.getShaderInfoLog(vs));
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('t5LinkPair: FS failed: ' + gl.getShaderInfoLog(fs));
  const program = gl.createProgram();
  if (program === null) throw new Error('t5LinkPair: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('t5LinkPair: link failed: ' + gl.getProgramInfoLog(program));
  return { program };
}

function t5SetupBufferDraw(gl: WebGL1Context, floats: number[], size = 2): void {
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('t5SetupBufferDraw: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array(floats), STATIC_DRAW);
  if (gl.getError() !== NO_ERROR) throw new Error('t5SetupBufferDraw: bufferData errored');
  const { program } = t5LinkPair(gl);
  gl.useProgram(program);
  const loc = gl.getAttribLocation(program, 'aPos');
  if (loc < 0) throw new Error('t5SetupBufferDraw: aPos location not found');
  gl.vertexAttribPointer(loc, size, FLOAT, false, 0, 0);
  if (gl.getError() !== NO_ERROR) throw new Error('t5SetupBufferDraw: vertexAttribPointer errored');
  gl.enableVertexAttribArray(loc);
}

function t5Snapshot(gl: WebGL1Context): Uint8Array {
  // Arrange helper: full-buffer readback snapshot.
  const out = new Uint8Array(T5_W * T5_H * 4);
  gl.readPixels(0, 0, T5_W, T5_H, RGBA, UNSIGNED_BYTE, out);
  if (gl.getError() !== NO_ERROR) throw new Error('t5Snapshot: readPixels errored');
  return out;
}

function t5Pixel(gl: WebGL1Context, x: number, y: number): [number, number, number, number] {
  // Arrange helper: single-pixel readback.
  const out = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, RGBA, UNSIGNED_BYTE, out);
  if (gl.getError() !== NO_ERROR) throw new Error('t5Pixel: readPixels errored');
  return [out[0] as number, out[1] as number, out[2] as number, out[3] as number];
}

describe('Sprint 5 Task 5 Group 1: drawArrays precondition matrix (RED)', () => {
  it('drawArrays with unrecognized mode records INVALID_ENUM', () => {
    // Arrange:
    const gl = t5Context();
    t5SetupBufferDraw(gl, [-1, -1, 3, -1, -1, 3]);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = t5Snapshot(gl);
    // Act:
    let threw = false;
    try {
      gl.drawArrays(POINTS, 0, 3);
    } catch { threw = true; }
    // Assert:
    expect(threw).toBe(false);
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });

  it('drawArrays with negative first records INVALID_VALUE', () => {
    // Arrange:
    const gl = t5Context();
    t5SetupBufferDraw(gl, [-1, -1, 3, -1, -1, 3]);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = t5Snapshot(gl);
    // Act:
    let threw = false;
    try {
      gl.drawArrays(TRIANGLES, -1, 3);
    } catch { threw = true; }
    // Assert:
    expect(threw).toBe(false);
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });

  it('drawArrays with negative count records INVALID_VALUE', () => {
    // Arrange:
    const gl = t5Context();
    t5SetupBufferDraw(gl, [-1, -1, 3, -1, -1, 3]);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = t5Snapshot(gl);
    // Act:
    let threw = false;
    try {
      gl.drawArrays(TRIANGLES, 0, -3);
    } catch { threw = true; }
    // Assert:
    expect(threw).toBe(false);
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });

  it('drawArrays with no bound program records INVALID_OPERATION (M3 unit test 1)', () => {
    // Arrange:
    const gl = t5Context();
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.useProgram(null);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = t5Snapshot(gl);
    // Act:
    let threw = false;
    try {
      gl.drawArrays(TRIANGLES, 0, 3);
    } catch { threw = true; }
    // Assert:
    expect(threw).toBe(false);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });

  it('drawArrays with unlinked program records INVALID_OPERATION', () => {
    // Arrange:
    const gl = t5Context();
    const program = gl.createProgram();
    if (program === null) throw new Error('arrange: createProgram failed');
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = t5Snapshot(gl);
    // Act: draw with a program that was never linked (useProgram rejects it, currentProgram stays null).
    gl.useProgram(program);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    let threw = false;
    try {
      gl.drawArrays(TRIANGLES, 0, 3);
    } catch { threw = true; }
    // Assert:
    expect(threw).toBe(false);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });

  it('drawArrays with enabled attribute but no bound buffer records INVALID_OPERATION', () => {
    // Arrange:
    const gl = t5Context();
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const { program } = t5LinkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    // Detach the buffer binding captured at pointer time so the enabled array has no buffer.
    const desc = gl.getVertexAttribDescriptor(loc);
    if (desc === null || desc.buffer === null) throw new Error('arrange: descriptor missing buffer');
    (desc.buffer as { alive: boolean }).alive = false;
    gl.bindBuffer(ARRAY_BUFFER, null);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = t5Snapshot(gl);
    // Act:
    let threw = false;
    try {
      gl.drawArrays(TRIANGLES, 0, 3);
    } catch { threw = true; }
    // Assert:
    expect(threw).toBe(false);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });

  it('drawArrays with attribute range exceeding buffer records INVALID_OPERATION (M3 unit test 2, SOW-REQ-017)', () => {
    // Arrange: 24 bytes (2 vec3) but 3 vertices require 36 bytes.
    const gl = t5Context();
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([1, 2, 3, 4, 5, 6]), STATIC_DRAW);
    const { program } = t5LinkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    gl.vertexAttribPointer(loc, 3, FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(loc);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    let threw = false;
    try {
      gl.drawArrays(TRIANGLES, 0, 3);
    } catch { threw = true; }
    // Assert:
    expect(threw).toBe(false);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(new Uint8Array(T5_W * T5_H * 4).map((_, i) => (i % 4 === 3 ? 255 : 0))));
  });

  it('drawArrays with incomplete bound framebuffer records INVALID_FRAMEBUFFER_OPERATION', () => {
    // Arrange:
    const gl = t5Context();
    t5SetupBufferDraw(gl, [-1, -1, 3, -1, -1, 3]);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = t5Snapshot(gl);
    const proto = DrawingBuffer.prototype as unknown as Record<string, unknown>;
    const original = proto['checkStatus'];
    proto['checkStatus'] = () => FRAMEBUFFER_INCOMPLETE_ATTACHMENT;
    // Act:
    let threw = false;
    try {
      gl.drawArrays(TRIANGLES, 0, 3);
    } catch { threw = true; }
    proto['checkStatus'] = original;
    // Assert:
    expect(threw).toBe(false);
    expect(FRAMEBUFFER_COMPLETE).not.toBe(FRAMEBUFFER_INCOMPLETE_ATTACHMENT);
    expect(gl.getError()).toBe(INVALID_FRAMEBUFFER_OPERATION);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });

  it('drawArrays with count === 0 is no-op recording NO_ERROR', () => {
    // Arrange:
    const gl = t5Context();
    t5SetupBufferDraw(gl, [-1, -1, 3, -1, -1, 3]);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const before = t5Snapshot(gl);
    // Act:
    let threw = false;
    try {
      gl.drawArrays(TRIANGLES, 0, 0);
    } catch { threw = true; }
    // Assert:
    expect(threw).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });
});

describe('Sprint 5 Task 5 Group 2: happy-path TRIANGLES draw (RED)', () => {
  it('drawArrays(TRIANGLES, 0, 3) renders shader-driven triangle to framebuffer', () => {
    // Arrange:
    const gl = t5Context();
    t5SetupBufferDraw(gl, [-1, -1, 3, -1, -1, 3]);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    let threw = false;
    try {
      gl.drawArrays(TRIANGLES, 0, 3);
    } catch { threw = true; }
    // Assert:
    expect(threw).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(t5Pixel(gl, T5_W >> 1, T5_H >> 1)).toEqual([0, 255, 0, 255]);
    expect(t5Pixel(gl, 0, 0)).toEqual([0, 255, 0, 255]);
  });
});

describe('Sprint 5 Task 5 Group 3: TD-009 validateUniform regressions (RED)', () => {
  it('TD-009 regression: writeFloatUniform validation and store update', () => {
    // Arrange:
    const gl = t5Context();
    const { program } = t5LinkPair(gl, 'attribute vec4 aPos; uniform vec3 uLight; void main() { gl_Position = aPos + vec4(uLight, 0.0); }', T5_FS);
    gl.useProgram(program);
    const loc = gl.getUniformLocation(program, 'uLight');
    if (loc === null) throw new Error('arrange: uLight location null');
    // Act:
    gl.uniform3f(loc, 1, 2, 3);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    const linked = (program as unknown as { handle: { linkedProgram: { uniformStore: { f32: Float32Array } } } }).handle.linkedProgram;
    expect(Array.from(linked.uniformStore.f32.slice(0, 3))).toEqual([1, 2, 3]);
    // Act:
    gl.uniform3fv(loc, new Float32Array([4, 5, 6]));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(linked.uniformStore.f32.slice(0, 3))).toEqual([4, 5, 6]);
    // Act: invalid component length records INVALID_VALUE with zero store mutation.
    const before = Array.from(linked.uniformStore.f32);
    gl.uniform3fv(loc, new Float32Array([7, 8]));
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(Array.from(linked.uniformStore.f32)).toEqual(before);
  });

  it('TD-009 regression: writeIntUniform validation and store update', () => {
    // Arrange:
    const gl = t5Context();
    const { program } = t5LinkPair(
      gl,
      'attribute vec4 aPos; uniform ivec2 uCoord; void main() { gl_Position = aPos + vec4(float(uCoord.x), float(uCoord.y), 0.0, 0.0); }',
      'precision mediump float; uniform sampler2D uTex; void main() { gl_FragColor = texture2D(uTex, vec2(0.5)); }',
    );
    gl.useProgram(program);
    const loc = gl.getUniformLocation(program, 'uCoord');
    const samplerLoc = gl.getUniformLocation(program, 'uTex');
    if (loc === null || samplerLoc === null) throw new Error('arrange: uniform locations null');
    // Act:
    gl.uniform2i(loc, 10, 20);
    gl.uniform1i(samplerLoc, 2);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    const linked = (program as unknown as { handle: { linkedProgram: { uniformStore: { i32: Int32Array; samplerUnits: Int32Array } } } }).handle.linkedProgram;
    expect(Array.from(linked.uniformStore.i32.slice(0, 2))).toEqual([10, 20]);
    expect(linked.uniformStore.samplerUnits[0]).toBe(2);
    // Act: float setter targeting an int uniform records INVALID_OPERATION.
    gl.uniform2f(loc, 1, 2);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TD-009 regression: writeMatrixUniform transpose check and store update', () => {
    // Arrange:
    const gl = t5Context();
    const { program } = t5LinkPair(gl, 'attribute vec4 aPos; uniform mat3 uMatrix; void main() { gl_Position = vec4(uMatrix * aPos.xyz, 1.0); }', T5_FS);
    gl.useProgram(program);
    const loc = gl.getUniformLocation(program, 'uMatrix');
    if (loc === null) throw new Error('arrange: uMatrix location null');
    const linked = (program as unknown as { handle: { linkedProgram: { uniformStore: { f32: Float32Array } } } }).handle.linkedProgram;
    const before = Array.from(linked.uniformStore.f32);
    // Act:
    gl.uniformMatrix3fv(loc, true, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(Array.from(linked.uniformStore.f32)).toEqual(before);
    // Act:
    gl.uniformMatrix3fv(loc, false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(linked.uniformStore.f32.slice(0, 9))).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });
});
/** Sprint 5 Task 6 Group 4: M3 first-slice DoD verification suite (Demo Carrier). Appended; lines 1-655 untouched. */
import {
  DEPTH_BUFFER_BIT,
  DEPTH_TEST,
  LESS,
} from '../../src/gl/constants';

type T6DepthFacade = {
  depthFunc(func: number): void;
  clearDepth(depth: number): void;
  depthRange(zNear: number, zFar: number): void;
};

function t6DepthRange(gl: WebGL1Context, near: number, far: number): void {
  // Arrange helper: drive TD-002 through the PUBLIC facade shape (depthRange).
  // Typed cast keeps tsc green; if the facade lacks the method this throws at
  // runtime, which is the genuine RED-phase implementation gap to report.
  (gl as unknown as T6DepthFacade).depthRange(near, far);
}

function t6DepthFunc(gl: WebGL1Context, func: number): void {
  (gl as unknown as T6DepthFacade).depthFunc(func);
}

function t6ClearDepth(gl: WebGL1Context, depth: number): void {
  (gl as unknown as T6DepthFacade).clearDepth(depth);
}

describe('Sprint 5 Task 6: M3 first-slice DoD verification suite (Demo Carrier)', () => {
  it('DoD Fixture 1: buffer-backed, shader-driven triangle renders to framebuffer with deterministic pixel readback', () => {
    // Arrange:
    const gl = t5Context();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const positionBuffer = gl.createBuffer();
    expect(positionBuffer).not.toBeNull();
    gl.bindBuffer(ARRAY_BUFFER, positionBuffer);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    expect(gl.getError()).toBe(NO_ERROR);
    const { program } = t5LinkPair(
      gl,
      'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }',
      'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }',
    );
    gl.useProgram(program);
    const posLoc = gl.getAttribLocation(program, 'aPos');
    expect(posLoc).toBeGreaterThanOrEqual(0);
    gl.vertexAttribPointer(posLoc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posLoc);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    // Assert: full-screen triangle covers all 64 pixels with green.
    const full = t5Snapshot(gl);
    expect(full.length).toBe(T5_W * T5_H * 4);
    for (let i = 0; i < T5_W * T5_H; i += 1) {
      expect([full[i * 4], full[i * 4 + 1], full[i * 4 + 2], full[i * 4 + 3]]).toEqual([0, 255, 0, 255]);
    }
    // Arrange (partial triangle):
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1]), STATIC_DRAW);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    // Assert: covered pixel green, uncovered pixel retains clear red.
    expect(t5Pixel(gl, 0, 0)).toEqual([0, 255, 0, 255]);
    expect(t5Pixel(gl, 7, 7)).toEqual([255, 0, 0, 255]);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('DoD Fixture 2: two interleaved buffer attributes interpolate colors across triangle surface', () => {
    // Arrange:
    const gl = t5Context();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const interleaved = new ArrayBuffer(36);
    const view = new DataView(interleaved);
    const positions: Array<[number, number]> = [[-1, -1], [3, -1], [-1, 3]];
    const colors: Array<[number, number, number, number]> = [[255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255]];
    for (let v = 0; v < 3; v += 1) {
      const pos = positions[v] as [number, number];
      const col = colors[v] as [number, number, number, number];
      view.setFloat32(v * 12, pos[0], true);
      view.setFloat32(v * 12 + 4, pos[1], true);
      view.setUint8(v * 12 + 8, col[0]);
      view.setUint8(v * 12 + 9, col[1]);
      view.setUint8(v * 12 + 10, col[2]);
      view.setUint8(v * 12 + 11, col[3]);
    }
    const interleavedBuffer = gl.createBuffer();
    if (interleavedBuffer === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, interleavedBuffer);
    gl.bufferData(ARRAY_BUFFER, interleaved, STATIC_DRAW);
    expect(gl.getError()).toBe(NO_ERROR);
    const { program } = t5LinkPair(
      gl,
      'attribute vec2 aPos; attribute vec4 aCol; varying vec4 vCol; void main() { vCol = aCol; gl_Position = vec4(aPos, 0.0, 1.0); }',
      'precision mediump float; varying vec4 vCol; void main() { gl_FragColor = vCol; }',
    );
    gl.useProgram(program);
    const posLoc = gl.getAttribLocation(program, 'aPos');
    const colLoc = gl.getAttribLocation(program, 'aCol');
    expect(posLoc).toBeGreaterThanOrEqual(0);
    expect(colLoc).toBeGreaterThanOrEqual(0);
    gl.vertexAttribPointer(posLoc, 2, FLOAT, false, 12, 0);
    gl.vertexAttribPointer(colLoc, 4, UNSIGNED_BYTE, true, 12, 8);
    gl.enableVertexAttribArray(posLoc);
    gl.enableVertexAttribArray(colLoc);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    // Assert: near-vertex pixels match analytic barycentric blends. Vertex 1
    // (3,-1) and vertex 2 (-1,3) lie off-screen, so the green/blue dominance
    // regions fall outside the viewport; edge pixels carry the exact blend:
    // (7,0): w=[0.5,0.46875,0.03125] -> [128,120,8]; (0,7): mirrored.
    const nearRed = t5Pixel(gl, 0, 0);
    expect(nearRed[0]).toBeGreaterThan(200);
    expect(nearRed[1]).toBeLessThan(50);
    expect(nearRed[2]).toBeLessThan(50);
    expect(nearRed[3]).toBe(255);
    const nearGreen = t5Pixel(gl, 7, 0);
    expect(nearGreen[0]).toBeGreaterThanOrEqual(120);
    expect(nearGreen[0]).toBeLessThanOrEqual(135);
    expect(nearGreen[1]).toBeGreaterThanOrEqual(112);
    expect(nearGreen[1]).toBeLessThanOrEqual(128);
    expect(nearGreen[2]).toBeLessThanOrEqual(16);
    expect(nearGreen[3]).toBe(255);
    const nearBlue = t5Pixel(gl, 0, 7);
    expect(nearBlue[0]).toBeGreaterThanOrEqual(120);
    expect(nearBlue[0]).toBeLessThanOrEqual(135);
    expect(nearBlue[2]).toBeGreaterThanOrEqual(112);
    expect(nearBlue[2]).toBeLessThanOrEqual(128);
    expect(nearBlue[1]).toBeLessThanOrEqual(16);
    expect(nearBlue[3]).toBe(255);
    const center = t5Pixel(gl, 2, 2);
    expect(center[3]).toBe(255);
    expect(center[0]).toBeGreaterThan(center[1]);
    expect(center[0]).toBeGreaterThan(center[2]);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('DoD Fixture 3: disabled attribute array shades with vertexAttrib4f generic value', () => {
    // Arrange:
    const gl = t5Context();
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const posBuffer = gl.createBuffer();
    if (posBuffer === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, posBuffer);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const { program } = t5LinkPair(
      gl,
      'attribute vec2 aPos; attribute vec4 aColor; varying vec4 vColor; void main() { vColor = aColor; gl_Position = vec4(aPos, 0.0, 1.0); }',
      'precision mediump float; varying vec4 vColor; void main() { gl_FragColor = vColor; }',
    );
    gl.useProgram(program);
    const posLoc = gl.getAttribLocation(program, 'aPos');
    const colLoc = gl.getAttribLocation(program, 'aColor');
    expect(posLoc).toBeGreaterThanOrEqual(0);
    expect(colLoc).toBeGreaterThanOrEqual(0);
    gl.vertexAttribPointer(posLoc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posLoc);
    gl.disableVertexAttribArray(colLoc);
    gl.vertexAttrib4f(colLoc, 0.25, 0.5, 0.75, 1.0);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    // Assert: center pixel equals the generic value converted to bytes.
    expect(t5Pixel(gl, 4, 4)).toEqual([64, 128, 191, 255]);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('DoD Fixture 4: depthRange modifies PipelineState and controls depth test pass/fail visibility', () => {
    // Arrange:
    const gl = t5Context();
    gl.enable(DEPTH_TEST);
    t6DepthFunc(gl, LESS);
    t6ClearDepth(gl, 1.0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const { program } = t5LinkPair(
      gl,
      'attribute vec3 aPos; void main() { gl_Position = vec4(aPos, 1.0); }',
      'precision mediump float; uniform vec4 uColor; void main() { gl_FragColor = uColor; }',
    );
    gl.useProgram(program);
    const uColorLoc = gl.getUniformLocation(program, 'uColor');
    if (uColorLoc === null) throw new Error('arrange: uColor location null');
    const posLoc = gl.getAttribLocation(program, 'aPos');
    expect(posLoc).toBeGreaterThanOrEqual(0);
    const posBuffer = gl.createBuffer();
    if (posBuffer === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, posBuffer);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), STATIC_DRAW);
    gl.vertexAttribPointer(posLoc, 3, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(posLoc);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act & Assert step 1: depthRange(0,1) maps NDC z=0 to window depth 0.5; red draws.
    t6DepthRange(gl, 0.0, 1.0);
    gl.uniform4f(uColorLoc, 1, 0, 0, 1);
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(t5Pixel(gl, 4, 4)).toEqual([255, 0, 0, 255]);
    // Act & Assert step 2: depthRange(0.6,1.0) maps to 0.8; LESS rejects; stays red.
    t6DepthRange(gl, 0.6, 1.0);
    gl.uniform4f(uColorLoc, 0, 1, 0, 1);
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(t5Pixel(gl, 4, 4)).toEqual([255, 0, 0, 255]);
    // Act & Assert step 3: depthRange(0,0.4) maps to 0.2; LESS passes; blue wins.
    t6DepthRange(gl, 0.0, 0.4);
    gl.uniform4f(uColorLoc, 0, 0, 1, 1);
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(t5Pixel(gl, 4, 4)).toEqual([0, 0, 255, 255]);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('Sprint 6 Task 7: vertex-fetch DataView path regression', () => {
  it('TC2-style multi-vertex byte-identical fetch across 3 vertices', () => {
    // Arrange:
    const storage = new ArrayBuffer(36);
    new Float32Array(storage).set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bufferObj = makeBuffer(storage);
    const descriptors = descriptors16();
    descriptors[0] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    const activeAttribs = [{ location: 0, name: 'a_pos', size: 3, type: FLOAT }];
    // Act:
    const results: number[][] = [];
    for (let v = 0; v < 3; v += 1) {
      const targetMap = new Map<number, Float32Array>([[0, new Float32Array([0, 0, 0, 1])]]);
      fetchVertexAttributes(descriptors, () => bufferObj, v, activeAttribs, targetMap);
      results.push([...(targetMap.get(0) as Float32Array)]);
    }
    // Assert:
    expect(results).toEqual([[1, 2, 3, 1], [4, 5, 6, 1], [7, 8, 9, 1]]);
  });
});
/** Sprint 7 Task 9 TD-013 cache-bounding TDD RED-phase tests. Appended; lines 1-900 untouched. */
import { getCachedView, getViewCacheSize } from '../../src/gl/vertex-fetch';

describe('TD-013 Group 1: cache bounding and lifecycle', () => {
  it('TD-013 Regression 1: multi-draw across distinct buffers does not grow cache without bound', () => {
    // Arrange:
    const gl = t5Context();
    const { program } = t5LinkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    // Act:
    for (let i = 0; i < 20; i += 1) {
      const buf = gl.createBuffer();
      if (buf === null) throw new Error('act: createBuffer failed');
      gl.bindBuffer(ARRAY_BUFFER, buf);
      const floats = new Float32Array(9);
      for (let v = 0; v < 9; v += 1) floats[v] = i * 10 + v;
      gl.bufferData(ARRAY_BUFFER, floats, STATIC_DRAW);
      gl.vertexAttribPointer(loc, 3, FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(loc);
      gl.drawArrays(TRIANGLES, 0, 3);
      expect(gl.getError()).toBe(NO_ERROR);
    }
    // Assert:
    expect(getViewCacheSize()).toBe(0);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TD-013 Regression 2: intra-draw DataView reuse within single draw call', () => {
    // Arrange:
    const storage = new ArrayBuffer(72);
    new Float32Array(storage).set(Array.from({ length: 18 }, (_, i) => i + 1));
    const bufferObj = makeBuffer(storage);
    const descriptors = descriptors16();
    descriptors[0] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 24, offset: 0, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    descriptors[1] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 24, offset: 12, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    const activeAttribs = [
      { location: 0, name: 'a_pos', size: 3, type: FLOAT },
      { location: 1, name: 'a_col', size: 3, type: FLOAT },
    ];
    const viewCache = new Map<ArrayBuffer, DataView>();
    // Act:
    const targetMap = new Map<number, Float32Array>([
      [0, new Float32Array([0, 0, 0, 1])],
      [1, new Float32Array([0, 0, 0, 1])],
    ]);
    fetchVertexAttributes(descriptors, () => bufferObj, 0, activeAttribs, targetMap, viewCache);
    const size1 = getViewCacheSize(viewCache);
    fetchVertexAttributes(descriptors, () => bufferObj, 1, activeAttribs, targetMap, viewCache);
    const size2 = getViewCacheSize(viewCache);
    // Assert:
    expect(size1).toBe(1);
    expect(size2).toBe(1);
    expect([...(targetMap.get(0) as Float32Array)]).toEqual([7, 8, 9, 1]);
  });

  it('TD-013 Regression 3: standalone getCachedView fallback without viewCache parameter', () => {
    // Arrange:
    const data = new ArrayBuffer(32);
    // Act:
    const view1 = getCachedView(data);
    const view2 = getCachedView(data);
    // Assert:
    expect(view1).toBeInstanceOf(DataView);
    expect(view1.byteLength).toBe(32);
    expect(view2).toBeInstanceOf(DataView);
    expect(view2.byteLength).toBe(32);
    expect(view1).not.toBe(view2);
    expect(getViewCacheSize(undefined)).toBe(0);
  });

  it('TD-013 Regression 4: repeated draws across identical buffer reuse per-draw cache cleanly', () => {
    // Arrange:
    const gl = t5Context();
    t5SetupBufferDraw(gl, [-1, -1, 3, -1, -1, 3]);
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    // Act:
    const snaps: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      gl.drawArrays(TRIANGLES, 0, 3);
      expect(gl.getError()).toBe(NO_ERROR);
      snaps.push(Array.from(t5Snapshot(gl)).join(','));
    }
    // Assert:
    for (let i = 1; i < snaps.length; i += 1) expect(snaps[i]).toBe(snaps[0]);
  });
});

describe('TD-013 Group 2: behavioral preservation', () => {
  it('TD-013 Regression 5: multi-vertex byte-identical fetch across 3 vertices preserved', () => {
    // Arrange:
    const storage = new ArrayBuffer(36);
    new Float32Array(storage).set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bufferObj = makeBuffer(storage);
    const descriptors = descriptors16();
    descriptors[0] = { enabled: true, size: 3, type: FLOAT, normalized: false, stride: 0, offset: 0, buffer: bufferObj, divisor: 0, genericValue: [0, 0, 0, 1] };
    const activeAttribs = [{ location: 0, name: 'a_pos', size: 3, type: FLOAT }];
    // Act:
    const results: number[][] = [];
    for (let v = 0; v < 3; v += 1) {
      const targetMap = new Map<number, Float32Array>([[0, new Float32Array([0, 0, 0, 1])]]);
      fetchVertexAttributes(descriptors, () => bufferObj, v, activeAttribs, targetMap);
      results.push([...(targetMap.get(0) as Float32Array)]);
    }
    // Assert:
    expect(results).toEqual([[1, 2, 3, 1], [4, 5, 6, 1], [7, 8, 9, 1]]);
  });

  it('TD-013 Regression 6: DoD Fixture 1 happy path drawArrays pixel equality', () => {
    // Arrange:
    const gl = t5Context();
    gl.clearColor(1, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    t5SetupBufferDraw(gl, [-1, -1, 3, -1, -1, 3]);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const full = t5Snapshot(gl);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    for (let i = 0; i < T5_W * T5_H; i += 1) {
      expect([full[i * 4], full[i * 4 + 1], full[i * 4 + 2], full[i * 4 + 3]]).toEqual([0, 255, 0, 255]);
    }
  });

  it('TD-013 Regression 7: zero count draw is no-op with zero cache activity', () => {
    // Arrange:
    const gl = t5Context();
    t5SetupBufferDraw(gl, [-1, -1, 3, -1, -1, 3]);
    gl.clearColor(0, 0, 1, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const before = t5Snapshot(gl);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });

  it('TD-013 Regression 8: attribute range validation failure touches no cache', () => {
    // Arrange:
    const gl = t5Context();
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([1, 2, 3, 4, 5, 6]), STATIC_DRAW);
    const { program } = t5LinkPair(gl);
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos not found');
    gl.vertexAttribPointer(loc, 3, FLOAT, false, 12, 0);
    gl.enableVertexAttribArray(loc);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const before = t5Snapshot(gl);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(Array.from(t5Snapshot(gl))).toEqual(Array.from(before));
  });
});
