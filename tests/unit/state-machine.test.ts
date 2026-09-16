import { describe, expect, it } from 'vitest';
import { drainError, pushError } from '../../src/renderer/errors';
import { GLState } from '../../src/renderer/state';
import {
  FUNC_ADD,
  INVALID_ENUM,
  INVALID_VALUE,
  LESS,
  ONE,
  TEXTURE0,
  ZERO,
} from '../../src/renderer/gl-constants';

describe('GLState', () => {
  it('fresh store reports spec defaults', () => {
    // Arrange: construct store with canvas extent 64 by 64
    const state = new GLState(64, 64);
    // Act: read defaults
    // Assert: spec-exact defaults
    expect(state.clearColor).toEqual([0, 0, 0, 0]);
    expect(state.clearDepth).toBe(1.0);
    expect(state.clearStencil).toBe(0);
    expect(state.depthTest).toBe(false);
    expect(state.depthFunc).toBe(LESS);
    expect(state.depthMask).toBe(true);
    expect(state.colorMask).toEqual([true, true, true, true]);
    expect(state.stencilTest).toBe(false);
    expect(state.blendEnabled).toBe(false);
    expect(state.blendSrcRGB).toBe(ONE);
    expect(state.blendDstRGB).toBe(ZERO);
    expect(state.blendEquation).toBe(FUNC_ADD);
    expect(state.scissorTest).toBe(false);
    expect(state.scissorBox).toEqual([0, 0, 64, 64]);
    expect(state.viewport).toEqual([0, 0, 64, 64]);
    expect(state.activeTexture).toBe(TEXTURE0);
    expect(state.boundArrayBuffer).toBe(0);
    expect(state.boundElementArrayBuffer).toBe(0);
    expect(state.currentProgram).toBe(0);
  });

  it('viewport with negative width reports single violation and preserves box', () => {
    // Arrange: fresh store with known viewport plus empty caller-side queue
    const state = new GLState(64, 64);
    const prior = [...state.viewport] as [number, number, number, number];
    const queue: number[] = [];
    // Act: call setViewport(-1, 0, 10, 10) once, caller pushes returned code
    const code = state.setViewport(-1, 0, 10, 10);
    if (code !== null) pushError(queue, code);
    // Assert: exactly one INVALID_VALUE, viewport unchanged
    expect(code).toBe(INVALID_VALUE);
    expect(queue).toEqual([INVALID_VALUE]);
    expect(drainError(queue)).toBe(INVALID_VALUE);
    expect(state.viewport).toEqual(prior);
  });

  it('enable with unknown enum reports violation and preserves flags', () => {
    // Arrange: fresh store with recorded flags
    const state = new GLState(64, 64);
    const queue: number[] = [];
    const before = {
      blend: state.blendEnabled,
      depth: state.depthTest,
      stencil: state.stencilTest,
      scissor: state.scissorTest,
    };
    // Act: call enable with 0x9999, caller pushes returned code
    const code = state.enable(0x9999);
    if (code !== null) pushError(queue, code);
    // Assert: single INVALID_ENUM, flags unchanged
    expect(code).toBe(INVALID_ENUM);
    expect(queue).toEqual([INVALID_ENUM]);
    expect(state.blendEnabled).toBe(before.blend);
    expect(state.depthTest).toBe(before.depth);
    expect(state.stencilTest).toBe(before.stencil);
    expect(state.scissorTest).toBe(before.scissor);
  });
});
