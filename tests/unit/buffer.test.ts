/** BufferManager unit tests (Sprint 5 Task 2 red phase) — WebGL 1.0 buffer lifecycle, allocation, subdata, reflection. */
import { describe, expect, it } from 'vitest';
import { ErrorSink } from '../../src/gl/errors';
import { BufferManager } from '../../src/gl/buffer';
import {
  ARRAY_BUFFER,
  BUFFER_SIZE,
  BUFFER_USAGE,
  DYNAMIC_DRAW,
  ELEMENT_ARRAY_BUFFER,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  NO_ERROR,
  OUT_OF_MEMORY,
  STATIC_DRAW,
} from '../../src/gl/constants';
import type { GLenum } from '../../src/gl/constants';

describe('Buffer lifecycle and target binding', () => {
  it('createBuffer allocates unique handles and isBuffer identifies live instances', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    // Act:
    const b1 = mgr.createBuffer();
    const b2 = mgr.createBuffer();
    // Assert:
    expect(b1).not.toBeNull();
    expect(b2).not.toBeNull();
    expect(b1!.id).not.toBe(b2!.id);
    expect(mgr.isBuffer(b1)).toBe(true);
    expect(mgr.isBuffer(b2)).toBe(true);
    expect(errorSink.getError()).toBe(NO_ERROR);
  });

  it('bindBuffer binds to ARRAY_BUFFER and ELEMENT_ARRAY_BUFFER and unbinds with null', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    // Act & Assert:
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    expect(mgr.getBoundBuffer(ARRAY_BUFFER)).toBe(buf);
    mgr.bindBuffer(ARRAY_BUFFER, null);
    expect(mgr.getBoundBuffer(ARRAY_BUFFER)).toBeNull();
  });

  it('bindBuffer with invalid target records INVALID_ENUM and is no-op', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    // Act:
    mgr.bindBuffer(0x9999 as GLenum, buf);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_ENUM);
    expect(mgr.getBoundBuffer(ARRAY_BUFFER)).toBeNull();
  });

  it('deleteBuffer marks alive=false and unbinds from both ARRAY_BUFFER and ELEMENT_ARRAY_BUFFER', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const b1 = mgr.createBuffer();
    const b2 = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, b1);
    mgr.bindBuffer(ELEMENT_ARRAY_BUFFER, b2);
    // Act:
    mgr.deleteBuffer(b1);
    // Assert:
    expect(b1!.alive).toBe(false);
    expect(mgr.isBuffer(b1)).toBe(false);
    expect(mgr.getBoundBuffer(ARRAY_BUFFER)).toBeNull();
    expect(mgr.getBoundBuffer(ELEMENT_ARRAY_BUFFER)).toBe(b2);
  });

  it('deleted buffer bind records INVALID_OPERATION and is no-op (AC-5)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.deleteBuffer(buf);
    // Act:
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_OPERATION);
    expect(mgr.getBoundBuffer(ARRAY_BUFFER)).toBeNull();
  });
});

describe('Buffer allocation and data transfer (bufferData)', () => {
  it('bufferData stores Float32Array and roundtrips through bufferSubData (AC-1)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    const inputData = new Float32Array([1.0, 2.5, -3.25, 4.0]);
    // Act:
    mgr.bufferData(ARRAY_BUFFER, inputData, STATIC_DRAW);
    const size = mgr.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE);
    const usage = mgr.getBufferParameter(ARRAY_BUFFER, BUFFER_USAGE);
    // Assert:
    expect(size).toBe(16);
    expect(usage).toBe(STATIC_DRAW);
    const view = new Float32Array(buf!.data!);
    expect(view[0]).toBe(1.0);
    expect(view[1]).toBe(2.5);
    expect(view[2]).toBe(-3.25);
    expect(view[3]).toBe(4.0);
    const updateData = new Float32Array([9.0, 8.0]);
    mgr.bufferSubData(ARRAY_BUFFER, 4, updateData);
    expect(view[0]).toBe(1.0);
    expect(view[1]).toBe(9.0);
    expect(view[2]).toBe(8.0);
    expect(view[3]).toBe(4.0);
  });

  it('bufferData size overload allocates zero-initialized storage', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    // Act:
    mgr.bufferData(ARRAY_BUFFER, 64, DYNAMIC_DRAW);
    // Assert:
    expect(mgr.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE)).toBe(64);
    const bytes = new Uint8Array(buf!.data!);
    expect(bytes.every((b) => b === 0)).toBe(true);
  });

  it('bufferData negative size records INVALID_VALUE and preserves previous storage (AC-2)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    const initialData = new Uint8Array([1, 2, 3, 4]);
    mgr.bufferData(ARRAY_BUFFER, initialData, STATIC_DRAW);
    // Act:
    mgr.bufferData(ARRAY_BUFFER, -10, STATIC_DRAW);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_VALUE);
    expect(buf!.byteLength).toBe(4);
    expect(new Uint8Array(buf!.data!)[0]).toBe(1);
  });

  it('bufferData exceeding 256MB allocation guard records OUT_OF_MEMORY (AC-3)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    mgr.bufferData(ARRAY_BUFFER, new Uint8Array([10, 20]), STATIC_DRAW);
    // Act:
    mgr.bufferData(ARRAY_BUFFER, 256 * 1024 * 1024 + 1, STATIC_DRAW);
    // Assert:
    expect(errorSink.getError()).toBe(OUT_OF_MEMORY);
    expect(buf!.byteLength).toBe(2);
    expect(new Uint8Array(buf!.data!)[0]).toBe(10);
  });

  it('bufferData with WebGL 2 usage records INVALID_ENUM', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    // Act:
    mgr.bufferData(ARRAY_BUFFER, 32, 0x88e6 as GLenum);
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_ENUM);
    expect(buf!.byteLength).toBe(0);
  });
});

describe('Sub-data updates and bounds checking (bufferSubData)', () => {
  it('bufferSubData write past end records INVALID_VALUE with no mutation (AC-4)', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    mgr.bufferData(ARRAY_BUFFER, new Uint8Array([1, 2, 3, 4]), STATIC_DRAW);
    // Act:
    mgr.bufferSubData(ARRAY_BUFFER, 3, new Uint8Array([100, 200]));
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_VALUE);
    const bytes = new Uint8Array(buf!.data!);
    expect(bytes[0]).toBe(1);
    expect(bytes[1]).toBe(2);
    expect(bytes[2]).toBe(3);
    expect(bytes[3]).toBe(4);
  });

  it('bufferSubData negative offset records INVALID_VALUE with no mutation', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    mgr.bufferData(ARRAY_BUFFER, 8, STATIC_DRAW);
    // Act:
    mgr.bufferSubData(ARRAY_BUFFER, -1, new Uint8Array([1, 2]));
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_VALUE);
  });

  it('bufferSubData on unallocated buffer records INVALID_OPERATION', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    // Act:
    mgr.bufferSubData(ARRAY_BUFFER, 0, new Uint8Array([1, 2]));
    // Assert:
    expect(errorSink.getError()).toBe(INVALID_OPERATION);
  });
});

describe('Reflection and error conditions', () => {
  it('getBufferParameter on unbound target records INVALID_OPERATION', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    // Act:
    const res = mgr.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE);
    // Assert:
    expect(res).toBeNull();
    expect(errorSink.getError()).toBe(INVALID_OPERATION);
  });

  it('getBufferParameter with invalid pname records INVALID_ENUM', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    const buf = mgr.createBuffer();
    mgr.bindBuffer(ARRAY_BUFFER, buf);
    // Act:
    const res = mgr.getBufferParameter(ARRAY_BUFFER, 0x1234 as GLenum);
    // Assert:
    expect(res).toBeNull();
    expect(errorSink.getError()).toBe(INVALID_ENUM);
  });

  it('isBuffer handles foreign objects and primitives gracefully', () => {
    // Arrange:
    const errorSink = new ErrorSink();
    const mgr = new BufferManager(errorSink);
    // Act & Assert:
    expect(mgr.isBuffer(null)).toBe(false);
    expect(mgr.isBuffer(undefined)).toBe(false);
    expect(mgr.isBuffer({})).toBe(false);
    expect(mgr.isBuffer({ id: 999, alive: true })).toBe(false);
    expect(errorSink.getError()).toBe(NO_ERROR);
  });
});
