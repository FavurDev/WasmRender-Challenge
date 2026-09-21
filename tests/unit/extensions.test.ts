/** Sprint 7 Task 5 TDD RED-phase tests — extensions registry + WEBGL_lose_context. */
import { describe, expect, it } from 'vitest';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ARRAY_BUFFER,
  BLEND,
  COLOR_BUFFER_BIT,
  COLOR_CLEAR_VALUE,
  CONTEXT_LOST_WEBGL,
  DEPTH_CLEAR_VALUE,
  DEPTH_TEST,
  NO_ERROR,
  RGBA,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
  VIEWPORT,
} from '../../src/gl/constants';

type ExtFacade = {
  getExtension(name: string): object | null;
  getSupportedExtensions(): readonly string[];
  isContextLost(): boolean;
  isEnabled(cap: number): boolean;
};

type LoseExt = { loseContext(): void; restoreContext(): void };

const SEVEN = [
  'OES_texture_float',
  'OES_texture_half_float',
  'OES_texture_npot',
  'OES_element_index_uint',
  'WEBGL_lose_context',
  'WEBGL_compressed_texture_s3tc',
  'EXT_frag_depth',
] as const;

function extGl(): WebGL1Context & ExtFacade {
  return new WebGL1Context({ width: 300, height: 150 }) as unknown as WebGL1Context & ExtFacade;
}

describe('Group 1: memoization + unknown names (AC-1)', () => {
  for (const name of SEVEN) {
    it(`memoizes ${name} via === identity`, () => {
      // Arrange:
      const gl = extGl();
      // Act:
      const e1 = gl.getExtension(name);
      const e2 = gl.getExtension(name);
      // Assert:
      expect(e1).not.toBeNull();
      expect(e1).toBe(e2);
    });
  }

  it('unknown name returns null with NO error', () => {
    // Arrange:
    const gl = extGl();
    gl.getError();
    // Act:
    const res = gl.getExtension('NOT_A_REAL_EXT');
    // Assert:
    expect(res).toBeNull();
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('Group 2: loseContext semantics (AC-2)', () => {
  it('loseContext sets lost flag and creation sentinels return null', () => {
    // Arrange:
    const gl = extGl();
    const lose = gl.getExtension('WEBGL_lose_context') as unknown as LoseExt;
    // Act:
    lose.loseContext();
    // Assert:
    expect(gl.isContextLost()).toBe(true);
    expect(gl.createBuffer()).toBeNull();
    expect(gl.createTexture()).toBeNull();
    expect(gl.createProgram()).toBeNull();
    expect(gl.createShader(VERTEX_SHADER)).toBeNull();
  });

  it('getError drains CONTEXT_LOST_WEBGL once then NO_ERROR', () => {
    // Arrange:
    const gl = extGl();
    const lose = gl.getExtension('WEBGL_lose_context') as unknown as LoseExt;
    lose.loseContext();
    // Act:
    const e1 = gl.getError();
    const e2 = gl.getError();
    // Assert:
    expect(e1).toBe(CONTEXT_LOST_WEBGL);
    expect(e2).toBe(NO_ERROR);
  });
});

describe('Group 3: restoreContext resets to defaults (AC-3)', () => {
  it('restore clears lost flag and resets state to spec defaults', () => {
    // Arrange:
    const gl = extGl();
    gl.viewport(10, 10, 50, 50);
    gl.enable(DEPTH_TEST);
    gl.enable(BLEND);
    gl.clearColor(1, 0, 0, 1);
    const buf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, buf);
    const lose = gl.getExtension('WEBGL_lose_context') as unknown as LoseExt;
    // Act:
    lose.loseContext();
    lose.restoreContext();
    // Assert:
    expect(gl.isContextLost()).toBe(false);
    expect(Array.from(gl.getParameter(VIEWPORT) as Int32Array)).toEqual([0, 0, 300, 150]);
    expect(gl.isEnabled(DEPTH_TEST)).toBe(false);
    expect(gl.isEnabled(BLEND)).toBe(false);
    expect(Array.from(gl.getParameter(COLOR_CLEAR_VALUE) as Float32Array)).toEqual([0, 0, 0, 0]);
    expect(gl.getParameter(DEPTH_CLEAR_VALUE)).toBe(1.0);
    expect(gl.createBuffer()).not.toBeNull();
  });
});

describe('Group 4: draw-while-lost no-op (AC-4)', () => {
  it('drawArrays while lost leaves framebuffer unchanged with CONTEXT_LOST_WEBGL', () => {
    // Arrange:
    const gl = extGl();
    gl.clearColor(0, 1, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const before = new Uint8Array(300 * 150 * 4);
    gl.readPixels(0, 0, 300, 150, RGBA, UNSIGNED_BYTE, before);
    expect(gl.getError()).toBe(NO_ERROR);
    const lose = gl.getExtension('WEBGL_lose_context') as unknown as LoseExt;
    lose.loseContext();
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const err = gl.getError();
    // Assert:
    expect(err === CONTEXT_LOST_WEBGL || err === NO_ERROR).toBe(true);
    const after = new Uint8Array(300 * 150 * 4);
    (gl as unknown as WebGL1Context).readPixels(0, 0, 300, 150, RGBA, UNSIGNED_BYTE, after);
    expect(Array.from(after)).toEqual(Array.from(before));
  });
});

describe('Group 5: getSupportedExtensions enumeration (AC-5)', () => {
  it('returns exactly the seven supported names', () => {
    // Arrange:
    const gl = extGl();
    // Act:
    const list = gl.getSupportedExtensions();
    // Assert:
    expect(list.length).toBe(7);
    expect([...list].sort()).toEqual([...SEVEN].sort());
  });
});
