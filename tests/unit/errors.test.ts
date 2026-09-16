import { describe, expect, it } from 'vitest';
import { drainError, pushError } from '../../src/renderer/errors';
import { INVALID_ENUM, INVALID_VALUE, NO_ERROR } from '../../src/renderer/gl-constants';

describe('errors FIFO queue', () => {
  it('drain on empty returns sentinel without throwing', () => {
    // Arrange: empty queue
    const queue: number[] = [];
    // Act: drain once
    const result = drainError(queue);
    // Assert: sentinel, no throw
    expect(result).toBe(NO_ERROR);
  });

  it('FIFO order across mixed codes', () => {
    // Arrange: empty queue
    const queue: number[] = [];
    // Act: push INVALID_ENUM then INVALID_VALUE, drain twice
    pushError(queue, INVALID_ENUM);
    pushError(queue, INVALID_VALUE);
    const first = drainError(queue);
    const second = drainError(queue);
    // Assert: order preserved
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(INVALID_VALUE);
  });

  it('twelve pushes drain as earliest eight in order then sentinel', () => {
    // Arrange: empty queue, twelve distinct codes in known order
    const queue: number[] = [];
    const codes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    // Act: push all twelve, drain nine times
    for (const code of codes) pushError(queue, code);
    const drained: number[] = [];
    for (let i = 0; i < 9; i++) drained.push(drainError(queue));
    // Assert: first eight in order, ninth sentinel
    expect(drained.slice(0, 8)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(drained[8]).toBe(NO_ERROR);
  });
});
