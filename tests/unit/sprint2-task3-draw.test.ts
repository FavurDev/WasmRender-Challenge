import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  ARRAY_BUFFER,
  ELEMENT_ARRAY_BUFFER,
  FLOAT,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  NO_ERROR,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_SHORT,
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

type Ctx = NonNullable<ReturnType<typeof createSoftwareWebGLContext>>;
type AnyCtx = Record<string, (...a: never[]) => unknown>;

function freshCtx(w = 64, h = 64): Ctx {
  const ctx = createSoftwareWebGLContext(canvasDouble(w, h) as never);
  if (!ctx) throw new Error('factory returned null');
  return ctx;
}

function drain(ctx: Ctx): void {
  while (ctx.getError() !== NO_ERROR) { /* drain */ }
}

function snapshot(ctx: Ctx, w = 64, h = 64): Uint8Array {
  return ctx.readPixels(0, 0, w, h)!;
}

describe('sprint2 task3 draw preconditions and error wiring (TDD red phase)', () => {
  it('drawArrays TRIANGLES without program pushes one INVALID_OPERATION with zero pixels', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    const before = snapshot(ctx);
    const anyCtx = ctx as unknown as AnyCtx;
    // Act
    (anyCtx['drawArrays'] as (m: number, f: number, c: number) => void)(TRIANGLES, 0, 3);
    const first = ctx.getError();
    const second = ctx.getError();
    const after = snapshot(ctx);
    // Assert
    expect(first).toBe(INVALID_OPERATION);
    expect(second).toBe(NO_ERROR);
    expect(Array.from(after)).toEqual(Array.from(before));
  });

  it('drawElements TRIANGLES without program pushes one INVALID_OPERATION with zero pixels', () => {
    // Arrange
    const ctx = freshCtx();
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ELEMENT_ARRAY_BUFFER, buf);
    ctx.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2]), STATIC_DRAW);
    drain(ctx);
    const before = snapshot(ctx);
    const anyCtx = ctx as unknown as AnyCtx;
    // Act
    (anyCtx['drawElements'] as (m: number, c: number, t: number, o: number) => void)(TRIANGLES, 3, UNSIGNED_SHORT, 0);
    const first = ctx.getError();
    const second = ctx.getError();
    const after = snapshot(ctx);
    // Assert
    expect(first).toBe(INVALID_OPERATION);
    expect(second).toBe(NO_ERROR);
    expect(Array.from(after)).toEqual(Array.from(before));
  });

  it('INVALID_ENUM then INVALID_VALUE drains 0x0500 then 0x0501 then NO_ERROR', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    const anyCtx = ctx as unknown as AnyCtx;
    // Act
    (anyCtx['drawArrays'] as (m: number, f: number, c: number) => void)(0x9999, 0, 3);
    (anyCtx['drawArrays'] as (m: number, f: number, c: number) => void)(TRIANGLES, 0, -1);
    const first = ctx.getError();
    const second = ctx.getError();
    const third = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(INVALID_VALUE);
    expect(third).toBe(NO_ERROR);
  });

  it('draw validation order reports enum before value before operation', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    const anyCtx = ctx as unknown as AnyCtx;
    // Act
    (anyCtx['drawArrays'] as (m: number, f: number, c: number) => void)(0x9999, -1, -5);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
  });

  it('12 invalid calls drain 8 in original order, 9th is NO_ERROR', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    const anyCtx = ctx as unknown as AnyCtx;
    const draw = anyCtx['drawArrays'] as (m: number, f: number, c: number) => void;
    // Act
    for (let i = 0; i < 12; i++) draw(0x9999, 0, 3);
    const drained: number[] = [];
    for (let i = 0; i < 9; i++) drained.push(ctx.getError());
    // Assert
    expect(drained.slice(0, 8)).toEqual(Array(8).fill(INVALID_ENUM));
    expect(drained[8]).toBe(NO_ERROR);
  });

  it('decodeAttribute with negative vertexIndex returns null and never throws', () => {
    // Arrange
    const ctx = freshCtx();
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, buf);
    ctx.bufferData(ARRAY_BUFFER, new Float32Array([1, 2, 3, 4, 5, 6]), STATIC_DRAW);
    ctx.vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
    drain(ctx);
    // Act
    let result: unknown = 'unset';
    let threw = false;
    try {
      result = ctx.decodeAttribute(0, -1);
    } catch {
      threw = true;
    }
    const err = ctx.getError();
    // Assert
    expect(threw).toBe(false);
    expect(result).toBeNull();
    expect(err).toBe(NO_ERROR);
  });
});
