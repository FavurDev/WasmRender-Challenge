import { describe, expect, it } from 'vitest';
import { BufferStore } from '../../src/renderer/buffer';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  ARRAY_BUFFER,
  ELEMENT_ARRAY_BUFFER,
  FLOAT,
  INVALID_ENUM,
  INVALID_VALUE,
  NO_ERROR,
  STATIC_DRAW,
} from '../../src/renderer/gl-constants';

function canvasDouble(w: number, h: number) {
  return {
    width: w,
    height: h,
    getContext: (_kind: string) => ({
      putImageData: (_img: unknown, _x: number, _y: number) => undefined,
    }),
  };
}

describe('BufferStore lifecycle and attribute decoding (red phase)', () => {
  it('Float32Array round-trip in order', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    const positions = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // Act
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, buf);
    ctx.bufferData(ARRAY_BUFFER, positions, STATIC_DRAW);
    ctx.vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
    positions[0] = 99;
    const v0 = (ctx as unknown as { decodeAttribute(i: number, v: number): number[] }).decodeAttribute(0, 0);
    const v1 = (ctx as unknown as { decodeAttribute(i: number, v: number): number[] }).decodeAttribute(0, 1);
    const v2 = (ctx as unknown as { decodeAttribute(i: number, v: number): number[] }).decodeAttribute(0, 2);
    // Assert
    expect(v0).toEqual([1, 2, 3]);
    expect(v1).toEqual([4, 5, 6]);
    expect(v2).toEqual([7, 8, 9]);
    expect(ctx.getError()).toBe(NO_ERROR);
    expect(new BufferStore()).toBeDefined();
  });

  it('bad-target single INVALID_ENUM unchanged', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, buf);
    // Act
    ctx.bindBuffer(0x9999, buf);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
    expect(new BufferStore()).toBeDefined();
  });

  it('interleaved stride and offset lanes correct', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    const interleaved = new Float32Array([1, 2, 3, 10, 20, 30, 4, 5, 6, 40, 50, 60]);
    // Act
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, buf);
    ctx.bufferData(ARRAY_BUFFER, interleaved, STATIC_DRAW);
    ctx.vertexAttribPointer(0, 3, FLOAT, false, 24, 0);
    ctx.vertexAttribPointer(1, 3, FLOAT, false, 24, 12);
    const d = ctx as unknown as { decodeAttribute(i: number, v: number): number[] };
    const a0 = d.decodeAttribute(0, 1);
    const b0 = d.decodeAttribute(1, 1);
    // Assert
    expect(a0).toEqual([4, 5, 6]);
    expect(b0).toEqual([40, 50, 60]);
    expect(new BufferStore()).toBeDefined();
  });

  it('delete and monotonic handle', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    const h1 = ctx.createBuffer();
    const h2 = ctx.createBuffer();
    // Act
    ctx.deleteBuffer(h1);
    const h3 = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, h1);
    // Assert
    expect(h3).toBeGreaterThan(h2);
    expect(h1).not.toBe(h3);
    expect(new BufferStore()).toBeDefined();
    expect(ELEMENT_ARRAY_BUFFER).toBe(0x8893);
  });

  it('invalid pointer values single INVALID_VALUE unchanged', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, buf);
    ctx.bufferData(ARRAY_BUFFER, new Float32Array([1, 2, 3]), STATIC_DRAW);
    ctx.vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
    // Act
    ctx.vertexAttribPointer(0, 5, FLOAT, false, 0, 0);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_VALUE);
    expect(second).toBe(NO_ERROR);
    expect(new BufferStore()).toBeDefined();
  });

  it('composition wiring', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    // Act
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, buf);
    ctx.bufferData(ARRAY_BUFFER, new Float32Array([1, 2, 3]), STATIC_DRAW);
    const code = ctx.getError();
    // Assert
    expect(code).toBe(NO_ERROR);
    expect(buf).toBeGreaterThan(0);
    expect(new BufferStore()).toBeDefined();
  });
});
