// CHANGELOG: Sprint 5 (2026-09-21): Sprint 5 vertex fetch stage with per-attribute bounds validation
/** Vertex fetch — WebGL 1.0 attribute extraction, normalization, bounds validation. L2: imports constants + buffer/state/program types only. Pure: never calls ErrorSink, never throws. */
import {
  BYTE,
  FIXED,
  FLOAT,
  SHORT,
  UNSIGNED_BYTE,
  UNSIGNED_INT,
  UNSIGNED_SHORT,
} from './constants';
import type { GLenum } from './constants';
import type { BufferObject } from './buffer';
import type { VertexAttribDescriptor } from './state';
import type { ActiveInfo } from './program';

export interface AttribValidationResult {
  ok: boolean;
  failedAttributeIndex?: number;
  reason?: string;
}

export function getTypeByteSize(type: GLenum): number {
  switch (type) {
    case BYTE:
      return 1;
    case UNSIGNED_BYTE:
      return 1;
    case SHORT:
      return 2;
    case UNSIGNED_SHORT:
      return 2;
    case UNSIGNED_INT:
      return 4;
    case FLOAT:
      return 4;
    case FIXED:
      return 4;
    default:
      return 4;
  }
}

export function extractComponent(
  view: DataView,
  byteOffset: number,
  type: GLenum,
  normalized: boolean,
  littleEndian = true,
): number {
  switch (type) {
    case FLOAT: {
      const raw = view.getFloat32(byteOffset, littleEndian);
      return Math.fround(raw);
    }
    case UNSIGNED_BYTE: {
      const raw = view.getUint8(byteOffset);
      if (normalized) return Math.fround(raw / 255.0);
      return Math.fround(raw);
    }
    case BYTE: {
      const raw = view.getInt8(byteOffset);
      if (normalized) {
        // DEVIATION (documented): spec formula (2n+1)/255 gives -253/255 for -127,
        // but both the pseudocode TEST 8 text ("-127 maps to (-254+1)/255.0 = -1.0")
        // and draw.test.ts require -127 -> -1.0. Snap the bottom extreme to -1.0.
        if (raw <= -127) return -1.0;
        const v = (2.0 * raw + 1.0) / 255.0;
        return Math.fround(Math.max(-1.0, Math.min(1.0, v)));
      }
      return Math.fround(raw);
    }
    case UNSIGNED_SHORT: {
      const raw = view.getUint16(byteOffset, littleEndian);
      if (normalized) return Math.fround(raw / 65535.0);
      return Math.fround(raw);
    }
    case SHORT: {
      const raw = view.getInt16(byteOffset, littleEndian);
      if (normalized) {
        const v = (2.0 * raw + 1.0) / 65535.0;
        return Math.fround(Math.max(-1.0, Math.min(1.0, v)));
      }
      return Math.fround(raw);
    }
    case UNSIGNED_INT: {
      const raw = view.getUint32(byteOffset, littleEndian);
      if (normalized) return Math.fround(raw / 4294967295.0);
      return Math.fround(raw);
    }
    case FIXED: {
      const raw = view.getInt32(byteOffset, littleEndian);
      return Math.fround(raw / 65536.0);
    }
    default:
      return 0.0;
  }
}

export function createVertexAttribTargetMap(
  activeAttribs: ReadonlyArray<ActiveInfo>,
): Map<number, Float32Array> {
  const targetMap = new Map<number, Float32Array>();
  for (const a of activeAttribs) {
    if (a.location >= 0) targetMap.set(a.location, new Float32Array([0.0, 0.0, 0.0, 1.0]));
  }
  return targetMap;
}

export function validateVertexAttribRange(
  descriptors: ReadonlyArray<VertexAttribDescriptor>,
  bufferLookup: (bufferHandle: unknown) => BufferObject | null,
  first: number,
  count: number,
  activeAttribs?: ReadonlyArray<ActiveInfo>,
): AttribValidationResult {
  if (count <= 0) return { ok: true };
  if (first < 0) return { ok: false, reason: 'Negative first index' };
  const lastIndex = first + count - 1;
  const slotsToCheck: number[] = [];
  if (activeAttribs !== undefined && activeAttribs !== null) {
    for (const attrib of activeAttribs) {
      if (attrib.location >= 0 && attrib.location < descriptors.length) slotsToCheck.push(attrib.location);
    }
  } else {
    for (let i = 0; i < descriptors.length; i += 1) slotsToCheck.push(i);
  }
  for (const index of slotsToCheck) {
    const desc = descriptors[index];
    if (desc === undefined || desc === null) continue;
    if (desc.enabled === false) continue;
    if (desc.buffer === null || desc.buffer === undefined) {
      return { ok: false, failedAttributeIndex: index, reason: 'Enabled attribute array has no bound buffer' };
    }
    const bufferObj = bufferLookup(desc.buffer);
    if (bufferObj === null || bufferObj === undefined || bufferObj.alive === false) {
      return { ok: false, failedAttributeIndex: index, reason: 'Bound buffer is null, deleted, or invalid' };
    }
    if (bufferObj.data === null || bufferObj.data === undefined) {
      return { ok: false, failedAttributeIndex: index, reason: 'Bound buffer has no allocated storage' };
    }
    const typeSize = getTypeByteSize(desc.type);
    const elementSize = desc.size * typeSize;
    const effectiveStride = desc.stride > 0 ? desc.stride : elementSize;
    if (desc.offset < 0) {
      return { ok: false, failedAttributeIndex: index, reason: 'Attribute offset is negative' };
    }
    const requiredBytes = desc.offset + effectiveStride * lastIndex + elementSize;
    if (requiredBytes > bufferObj.byteLength) {
      return {
        ok: false,
        failedAttributeIndex: index,
        reason:
          'Attribute range exceeds buffer byteLength (required ' +
          String(requiredBytes) +
          ' bytes, buffer has ' +
          String(bufferObj.byteLength) +
          ' bytes)',
      };
    }
  }
  return { ok: true };
}

const DATA_VIEW_CACHE = new WeakMap<ArrayBuffer, DataView>();

function getCachedView(data: ArrayBuffer, viewCache?: Map<ArrayBuffer, DataView>): DataView {
  const cached = viewCache?.get(data) ?? DATA_VIEW_CACHE.get(data);
  if (cached !== undefined) return cached;
  const view = new DataView(data);
  DATA_VIEW_CACHE.set(data, view);
  viewCache?.set(data, view);
  return view;
}

export function fetchVertexAttributes(
  descriptors: ReadonlyArray<VertexAttribDescriptor>,
  bufferLookup: (bufferHandle: unknown) => BufferObject | null,
  vertexIndex: number,
  activeAttribs: ReadonlyArray<ActiveInfo>,
  targetMap: Map<number, Float32Array>,
  viewCache?: Map<ArrayBuffer, DataView>,
): Map<number, Float32Array> {
  for (const attrib of activeAttribs) {
    const slot = attrib.location;
    if (slot < 0) continue;
    let targetVec = targetMap.get(slot);
    if (targetVec === undefined) {
      targetVec = new Float32Array(4);
      targetMap.set(slot, targetVec);
    }
    const desc = descriptors[slot];
    if (desc === undefined || desc === null) {
      targetVec[0] = 0.0;
      targetVec[1] = 0.0;
      targetVec[2] = 0.0;
      targetVec[3] = 1.0;
      continue;
    }
    if (desc.enabled === false) {
      targetVec[0] = Math.fround(desc.genericValue[0]);
      targetVec[1] = Math.fround(desc.genericValue[1]);
      targetVec[2] = Math.fround(desc.genericValue[2]);
      targetVec[3] = Math.fround(desc.genericValue[3]);
      continue;
    }
    const bufferObj = bufferLookup(desc.buffer);
    if (bufferObj === null || bufferObj === undefined || bufferObj.data === null || bufferObj.data === undefined) {
      targetVec[0] = 0.0;
      targetVec[1] = 0.0;
      targetVec[2] = 0.0;
      targetVec[3] = 1.0;
      continue;
    }
    const typeSize = getTypeByteSize(desc.type);
    const elementSize = desc.size * typeSize;
    const effectiveStride = desc.stride > 0 ? desc.stride : elementSize;
    const vertexByteOffset = desc.offset + effectiveStride * vertexIndex;
    const view = getCachedView(bufferObj.data, viewCache);
    const numComponents = desc.size;
    targetVec[0] = extractComponent(view, vertexByteOffset + 0 * typeSize, desc.type, desc.normalized);
    if (numComponents >= 2) {
      targetVec[1] = extractComponent(view, vertexByteOffset + 1 * typeSize, desc.type, desc.normalized);
    } else {
      targetVec[1] = 0.0;
    }
    if (numComponents >= 3) {
      targetVec[2] = extractComponent(view, vertexByteOffset + 2 * typeSize, desc.type, desc.normalized);
    } else {
      targetVec[2] = 0.0;
    }
    if (numComponents >= 4) {
      targetVec[3] = extractComponent(view, vertexByteOffset + 3 * typeSize, desc.type, desc.normalized);
    } else {
      targetVec[3] = 1.0;
    }
  }
  return targetMap;
}
