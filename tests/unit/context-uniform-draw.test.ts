/** Uniform-difference red-phase test (Phase 2 Sprint 1 Task 3). Headless Node Vitest, deterministic constants only. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import { FRAGMENT_SHADER, LINK_STATUS, NO_ERROR, TRIANGLES, VERTEX_SHADER } from '../../src/renderer/gl-constants';

function canvasDouble(w: number, h: number): unknown {
  return {
    width: w,
    height: h,
    getContext: (_kind: string) => ({
      putImageData: (_img: unknown, _x: number, _y: number) => undefined,
    }),
  };
}

const VERT = [
  'attribute vec3 position;',
  'void main() {',
  '  gl_Position = vec4(position, 1.0);',
  '}',
].join('\n');

const FRAG = [
  'precision mediump float;',
  'uniform vec4 uColor;',
  'void main() {',
  '  gl_FragColor = uColor;',
  '}',
].join('\n');

describe('context uniform draw (TDD red phase)', () => {
  it('uniform-only change alters pixels', () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
    const vs = ctx.createShader(VERTEX_SHADER);
    ctx.shaderSource(vs, VERT);
    ctx.compileShader(vs);
    const fs = ctx.createShader(FRAGMENT_SHADER);
    ctx.shaderSource(fs, FRAG);
    ctx.compileShader(fs);
    const prog = ctx.createProgram();
    ctx.attachShader(prog, vs);
    ctx.attachShader(prog, fs);
    ctx.linkProgram(prog);
    expect(ctx.getProgramParameter(prog, LINK_STATUS)).toBe(true);
    ctx.useProgram(prog);
    const loc = ctx.getUniformLocation(prog, 'uColor');
    expect(loc).not.toBeNull();
    const draw = (ctx as unknown as { drawArrays(m: number, f: number, c: number): void }).drawArrays.bind(ctx);
    const read = (ctx as unknown as { readPixels(x: number, y: number, w: number, h: number): Uint8Array | null }).readPixels.bind(ctx);
    // Act
    ctx.uniform4f(loc, 1, 0, 0, 1);
    draw(TRIANGLES, 0, 3);
    const first = read(0, 0, 64, 64)!;
    ctx.uniform4f(loc, 0, 0, 1, 1);
    draw(TRIANGLES, 0, 3);
    const second = read(0, 0, 64, 64)!;
    const err = ctx.getError();
    // Assert
    expect(err).toBe(NO_ERROR);
    let diff = 0;
    for (let i = 0; i < first.length; i++) if (first[i] !== second[i]) diff++;
    expect(diff).toBeGreaterThan(0);
  });
});
