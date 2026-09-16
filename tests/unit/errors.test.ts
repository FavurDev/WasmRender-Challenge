import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  ELEMENT_ARRAY_BUFFER,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LESS,
  NO_ERROR,
  POINTS,
  SCISSOR_TEST,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_SHORT,
} from '../../src/renderer/gl-constants';

function freshCtx() {
  const ctx = createSoftwareWebGLContext({ width: 8, height: 8 });
  if (!ctx) throw new Error('factory returned null');
  return ctx;
}

describe('errors ER-1..ER-8', () => {
  it('ER-1 FIFO drain order ENUM then VALUE', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    ctx.enable(LESS);
    ctx.scissor(0, 0, -1, 4);
    const first = ctx.getError();
    const second = ctx.getError();
    const third = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(INVALID_VALUE);
    expect(third).toBe(NO_ERROR);
  });

  it('ER-2 queue caps at 8 preserving earliest', () => {
    // Arrange
    const ctx = freshCtx();
    const pattern = [INVALID_ENUM, INVALID_VALUE];
    // Act: 12 alternating faults
    for (let i = 0; i < 12; i++) {
      if (pattern[i % 2] === INVALID_ENUM) ctx.enable(LESS);
      else ctx.scissor(0, 0, -1, 4);
    }
    const drains: number[] = [];
    for (let i = 0; i < 9; i++) drains.push(ctx.getError());
    // Assert
    const expected: number[] = [];
    for (let i = 0; i < 8; i++) expected.push(pattern[i % 2] as number);
    expect(drains.slice(0, 8)).toEqual(expected);
    expect(drains[8]).toBe(NO_ERROR);
  });

  it('ER-3 drawArrays without program INVALID_OPERATION zero pixels', () => {
    // Arrange
    const ctx = freshCtx();
    const before = ctx.readPixels(0, 0, 8, 8);
    // Act
    ctx.drawArrays(TRIANGLES, 0, 3);
    const after = ctx.readPixels(0, 0, 8, 8);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_OPERATION);
    expect(second).toBe(NO_ERROR);
    expect([...after!]).toEqual([...before!]);
  });

  it('ER-4 drawElements without program INVALID_OPERATION zero pixels', () => {
    // Arrange
    const ctx = freshCtx();
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ELEMENT_ARRAY_BUFFER, buf);
    ctx.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2]), STATIC_DRAW);
    const before = ctx.readPixels(0, 0, 8, 8);
    // Act
    ctx.drawElements(TRIANGLES, 3, UNSIGNED_SHORT, 0);
    const after = ctx.readPixels(0, 0, 8, 8);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_OPERATION);
    expect(second).toBe(NO_ERROR);
    expect([...after!]).toEqual([...before!]);
  });

  it('ER-5 draw unsupported mode INVALID_ENUM zero pixels', () => {
    // Arrange
    const ctx = freshCtx();
    const before = ctx.readPixels(0, 0, 8, 8);
    // Act
    ctx.drawArrays(POINTS, 0, 3);
    const after = ctx.readPixels(0, 0, 8, 8);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
    expect([...after!]).toEqual([...before!]);
  });

  it('ER-6 draw INVALID_VALUE paths zero pixels', () => {
    // Arrange
    const ctx = freshCtx();
    const before = ctx.readPixels(0, 0, 8, 8);
    // Act negative count
    ctx.drawArrays(TRIANGLES, 0, -1);
    const after = ctx.readPixels(0, 0, 8, 8);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_VALUE);
    expect(second).toBe(NO_ERROR);
    expect([...after!]).toEqual([...before!]);
    // Arrange fresh context for bad offset
    const ctx2 = freshCtx();
    const before2 = ctx2.readPixels(0, 0, 8, 8);
    // Act: negative offset yields INVALID_VALUE before program check
    ctx2.drawElements(TRIANGLES, 3, UNSIGNED_SHORT, -2);
    const after2 = ctx2.readPixels(0, 0, 8, 8);
    expect(ctx2.getError()).toBe(INVALID_VALUE);
    expect(ctx2.getError()).toBe(NO_ERROR);
    expect([...after2!]).toEqual([...before2!]);
  });

  it('ER-7 valid ops leave queue empty', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    ctx.enable(SCISSOR_TEST);
    ctx.scissor(0, 0, 4, 4);
    ctx.viewport(0, 0, 8, 8);
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, buf);
    ctx.clear(COLOR_BUFFER_BIT);
    // Assert
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('ER-8 draw failure preserves prior order', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    ctx.enable(LESS);
    ctx.drawArrays(TRIANGLES, 0, 3);
    const first = ctx.getError();
    const second = ctx.getError();
    const third = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(INVALID_OPERATION);
    expect(third).toBe(NO_ERROR);
  });
});
