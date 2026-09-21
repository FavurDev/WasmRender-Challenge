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
