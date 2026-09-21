// CHANGELOG: Sprint 5 (2026-09-21): Sprint 5 standalone buffer resource manager
/** BufferManager — WebGL 1.0 buffer lifecycle, binding, allocation, subdata, reflection. L2: imports constants + errors only. */
import {
  ARRAY_BUFFER,
  BUFFER_SIZE,
  BUFFER_USAGE,
  DYNAMIC_DRAW,
  ELEMENT_ARRAY_BUFFER,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  OUT_OF_MEMORY,
  STATIC_DRAW,
  STREAM_DRAW,
} from './constants';
import type { GLenum } from './constants';
import type { IErrorSink } from './errors';

export interface BufferObject {
  readonly id: number;
  alive: boolean;
  data: ArrayBuffer | null;
  byteLength: number;
  usage: GLenum;
  target: GLenum;
}

export interface IBufferManager {
  createBuffer(): BufferObject | null;
  deleteBuffer(buffer: BufferObject | null): void;
  isBuffer(buffer: unknown): boolean;
  bindBuffer(target: GLenum, buffer: BufferObject | null): void;
  getBoundBuffer(target: GLenum): BufferObject | null;
  bufferData(target: GLenum, sizeOrData: number | ArrayBufferView | ArrayBuffer | null, usage: GLenum): void;
  bufferSubData(target: GLenum, offset: number, data: ArrayBufferView | ArrayBuffer): void;
  getBufferParameter(target: GLenum, pname: GLenum): number | GLenum | null;
}

const MAX_BUFFER_BYTE_LENGTH = 256 * 1024 * 1024;

export class BufferManager implements IBufferManager {
  private readonly errorSink: IErrorSink;
  private nextBufferId = 1;
  private readonly buffers = new Map<number, BufferObject>();
  private boundArrayBuffer: BufferObject | null = null;
  private boundElementArrayBuffer: BufferObject | null = null;

  constructor(errorSink: IErrorSink) {
    this.errorSink = errorSink;
  }

  createBuffer(): BufferObject | null {
    const bufferId = this.nextBufferId;
    this.nextBufferId += 1;
    const buffer: BufferObject = {
      id: bufferId, alive: true, data: null, byteLength: 0, usage: STATIC_DRAW, target: 0,
    };
    this.buffers.set(bufferId, buffer);
    return buffer;
  }

  deleteBuffer(buffer: BufferObject | null): void {
    if (buffer === null || buffer === undefined) return;
    if (typeof buffer !== 'object' || buffer.alive === false) return;
    if (this.buffers.get(buffer.id) !== buffer) return;
    buffer.alive = false;
    buffer.data = null;
    buffer.byteLength = 0;
    if (this.boundArrayBuffer === buffer) this.boundArrayBuffer = null;
    if (this.boundElementArrayBuffer === buffer) this.boundElementArrayBuffer = null;
    this.buffers.delete(buffer.id);
  }

  isBuffer(buffer: unknown): boolean {
    if (buffer === null || typeof buffer !== 'object') return false;
    if (!('id' in buffer) || !('alive' in buffer)) return false;
    const candidate = buffer as BufferObject;
    if (candidate.alive !== true) return false;
    if (this.buffers.get(candidate.id) !== candidate) return false;
    return true;
  }

  bindBuffer(target: GLenum, buffer: BufferObject | null): void {
    if (target !== ARRAY_BUFFER && target !== ELEMENT_ARRAY_BUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (buffer === null || buffer === undefined) {
      if (target === ARRAY_BUFFER) this.boundArrayBuffer = null;
      else this.boundElementArrayBuffer = null;
      return;
    }
    if (typeof buffer !== 'object' || buffer.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (this.buffers.get(buffer.id) !== buffer) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (buffer.target === 0) buffer.target = target;
    if (target === ARRAY_BUFFER) this.boundArrayBuffer = buffer;
    else this.boundElementArrayBuffer = buffer;
  }

  getBoundBuffer(target: GLenum): BufferObject | null {
    if (target === ARRAY_BUFFER) return this.boundArrayBuffer;
    if (target === ELEMENT_ARRAY_BUFFER) return this.boundElementArrayBuffer;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  bufferData(target: GLenum, sizeOrData: number | ArrayBufferView | ArrayBuffer | null, usage: GLenum): void {
    if (target !== ARRAY_BUFFER && target !== ELEMENT_ARRAY_BUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const boundBuffer = target === ARRAY_BUFFER ? this.boundArrayBuffer : this.boundElementArrayBuffer;
    if (boundBuffer === null || boundBuffer.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (usage !== STATIC_DRAW && usage !== STREAM_DRAW && usage !== DYNAMIC_DRAW) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    let requestedByteLength = 0;
    let sourceBytes: Uint8Array | null = null;
    if (typeof sizeOrData === 'number') {
      if (!Number.isFinite(sizeOrData) || sizeOrData < 0) {
        this.errorSink.recordError(INVALID_VALUE);
        return;
      }
      requestedByteLength = Math.trunc(sizeOrData);
    } else if (ArrayBuffer.isView(sizeOrData)) {
      const view = sizeOrData as ArrayBufferView;
      requestedByteLength = view.byteLength;
      sourceBytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    } else if (sizeOrData instanceof ArrayBuffer) {
      requestedByteLength = sizeOrData.byteLength;
      sourceBytes = new Uint8Array(sizeOrData);
    } else if (sizeOrData === null || sizeOrData === undefined) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    } else {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (requestedByteLength > MAX_BUFFER_BYTE_LENGTH) {
      this.errorSink.recordError(OUT_OF_MEMORY);
      return;
    }
    try {
      const newStorage = new ArrayBuffer(requestedByteLength);
      const targetView = new Uint8Array(newStorage);
      if (sourceBytes !== null) targetView.set(sourceBytes, 0);
      else targetView.fill(0);
      boundBuffer.data = newStorage;
      boundBuffer.byteLength = requestedByteLength;
      boundBuffer.usage = usage;
    } catch {
      this.errorSink.recordError(OUT_OF_MEMORY);
    }
  }

  bufferSubData(target: GLenum, offset: number, data: ArrayBufferView | ArrayBuffer): void {
    if (target !== ARRAY_BUFFER && target !== ELEMENT_ARRAY_BUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const boundBuffer = target === ARRAY_BUFFER ? this.boundArrayBuffer : this.boundElementArrayBuffer;
    if (boundBuffer === null || boundBuffer.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (boundBuffer.data === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (!Number.isFinite(offset) || offset < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const byteOffset = Math.trunc(offset);
    if (data === null || data === undefined) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    let sourceBytes: Uint8Array | null = null;
    if (ArrayBuffer.isView(data)) {
      const view = data as ArrayBufferView;
      sourceBytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    } else if (data instanceof ArrayBuffer) {
      sourceBytes = new Uint8Array(data);
    } else {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const writeLength = sourceBytes.byteLength;
    if (byteOffset + writeLength > boundBuffer.byteLength) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const destView = new Uint8Array(boundBuffer.data, byteOffset, writeLength);
    destView.set(sourceBytes, 0);
  }

  getBufferParameter(target: GLenum, pname: GLenum): number | GLenum | null {
    if (target !== ARRAY_BUFFER && target !== ELEMENT_ARRAY_BUFFER) {
      this.errorSink.recordError(INVALID_ENUM);
      return null;
    }
    const boundBuffer = target === ARRAY_BUFFER ? this.boundArrayBuffer : this.boundElementArrayBuffer;
    if (boundBuffer === null || boundBuffer.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    if (pname === BUFFER_SIZE) return boundBuffer.byteLength;
    if (pname === BUFFER_USAGE) return boundBuffer.usage;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }
}
