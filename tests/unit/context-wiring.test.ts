/** Context wiring TDD red-phase tests (Sprint 3 Task 7). Headless Node vitest, fresh 64x64 contexts, no GUI. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  COMPILE_STATUS, FRAGMENT_SHADER, INVALID_OPERATION, LINK_STATUS, NO_ERROR, TRIANGLES,
  VERTEX_SHADER,
} from '../../src/renderer/gl-constants';

type Wired = {
  createShader(type: number): number;
  shaderSource(shader: number, source: string): void;
  compileShader(shader: number): void;
  getShaderParameter(shader: number, pname: number): unknown;
  getShaderInfoLog(shader: number): string;
  createProgram(): number;
  attachShader(program: number, shader: number): void;
  linkProgram(program: number): void;
  getProgramParameter(program: number, pname: number): unknown;
  getProgramInfoLog(program: number): string;
  useProgram(program: number | null): void;
  getAttribLocation(program: number, name: string): number;
  getUniformLocation(program: number, name: string): { id: number } | null;
  uniform1f(location: { id: number } | null, v0: number): void;
  uniform2f(location: { id: number } | null, v0: number, v1: number): void;
  uniform4f(location: { id: number } | null, v0: number, v1: number, v2: number, v3: number): void;
  uniform1i(location: { id: number } | null, v0: number): void;
};

function canvasDouble(w: number, h: number): unknown {
  return {
    width: w,
    height: h,
    getContext: (_kind: string) => ({
      putImageData: (_img: unknown, _x: number, _y: number) => undefined,
    }),
  };
}

function fresh(): Wired & ReturnType<typeof createSoftwareWebGLContext> & Record<string, never> {
  const ctx = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
  return ctx as unknown as Wired & ReturnType<typeof createSoftwareWebGLContext> & Record<string, never>;
}

const GOOD_VERT = [
  'attribute vec3 position;',
  'varying vec2 uv;',
  'void main() {',
  '  uv = vec2(0.0, 0.0);',
  '  gl_Position = vec4(position, 1.0);',
  '}',
].join('\n');

const GOOD_FRAG = [
  'precision mediump float;',
  'varying vec2 uv;',
  'void main() {',
  '  gl_FragColor = vec4(uv.x, uv.y, 0.0, 1.0);',
  '}',
].join('\n');

const BAD_VERT = [
  'attribute vec3 position;',
  'varying vec2 uv;',
  'void main() {',
  '  uv = undeclaredIdent;',
  '  gl_Position = vec4(position, 1.0);',
  '}',
].join('\n');

const NO_MAIN_VERT = [
  'attribute vec3 position;',
  'varying vec2 uv;',
  'void helper() {',
  '  uv = vec2(0.0, 0.0);',
  '}',
].join('\n');

const NO_MAIN_FRAG = [
  'precision mediump float;',
  'varying vec2 uv;',
  'void helper() {',
  '  gl_FragColor = vec4(1.0);',
  '}',
].join('\n');

const V300_FRAG = [
  '#version 300 es',
  'precision mediump float;',
  'in vec2 uv;',
  'out vec4 fragColor;',
  'void main() {',
  '  fragColor = vec4(uv, 0.0, 1.0);',
  '}',
].join('\n');

describe('context wiring red phase', () => {
  it('compile failure keeps getError at NO_ERROR with LINE log', () => {
    // Arrange
    const ctx = fresh();
    // Act
    const sh = ctx.createShader(VERTEX_SHADER);
    ctx.shaderSource(sh, BAD_VERT);
    ctx.compileShader(sh);
    const status = ctx.getShaderParameter(sh, COMPILE_STATUS);
    const log = ctx.getShaderInfoLog(sh);
    const first = (ctx as unknown as { getError(): number }).getError();
    const second = (ctx as unknown as { getError(): number }).getError();
    // Assert
    expect(status).toBe(false);
    expect(log.startsWith('LINE 4')).toBe(true);
    expect(first).toBe(NO_ERROR);
    expect(second).toBe(NO_ERROR);
  });

  it('unlinked draw pushes exactly one INVALID_OPERATION and writes zero pixels', () => {
    // Arrange
    const ctx = fresh();
    const vs = ctx.createShader(VERTEX_SHADER);
    ctx.shaderSource(vs, GOOD_VERT);
    ctx.compileShader(vs);
    const fs = ctx.createShader(FRAGMENT_SHADER);
    ctx.shaderSource(fs, 'precision mediump float;\nvarying vec3 uv;\nvoid main() {\n gl_FragColor = vec4(1.0);\n}');
    ctx.compileShader(fs);
    const prog = ctx.createProgram();
    ctx.attachShader(prog, vs);
    ctx.attachShader(prog, fs);
    ctx.linkProgram(prog);
    ctx.useProgram(prog);
    const before = (ctx as unknown as { readPixels(x: number, y: number, w: number, h: number): Uint8Array | null }).readPixels(0, 0, 64, 64);
    // Act
    (ctx as unknown as { drawArrays(m: number, f: number, c: number): void }).drawArrays(TRIANGLES, 0, 3);
    const g = ctx as unknown as { getError(): number };
    const first = g.getError();
    const second = g.getError();
    const after = (ctx as unknown as { readPixels(x: number, y: number, w: number, h: number): Uint8Array | null }).readPixels(0, 0, 64, 64);
    // Assert
    expect(first).toBe(INVALID_OPERATION);
    expect(second).toBe(NO_ERROR);
    expect(Array.from(after!)).toEqual(Array.from(before!));
  });

  it('valid shader without main links false with MISSING_MAIN', () => {
    // Arrange
    const ctx = fresh();
    // Act
    const vs = ctx.createShader(VERTEX_SHADER);
    ctx.shaderSource(vs, NO_MAIN_VERT);
    ctx.compileShader(vs);
    const vsOk = ctx.getShaderParameter(vs, COMPILE_STATUS);
    const fs = ctx.createShader(FRAGMENT_SHADER);
    ctx.shaderSource(fs, NO_MAIN_FRAG);
    ctx.compileShader(fs);
    const fsOk = ctx.getShaderParameter(fs, COMPILE_STATUS);
    const prog = ctx.createProgram();
    ctx.attachShader(prog, vs);
    ctx.attachShader(prog, fs);
    ctx.linkProgram(prog);
    const linked = ctx.getProgramParameter(prog, LINK_STATUS);
    const log = ctx.getProgramInfoLog(prog);
    const err = (ctx as unknown as { getError(): number }).getError();
    // Assert
    expect(vsOk).toBe(true);
    expect(fsOk).toBe(true);
    expect(linked).toBe(false);
    expect(log).toContain('MISSING_MAIN');
    expect(err).toBe(NO_ERROR);
  });

  it('valid ES 1.00 pair compiles and links clean', () => {
    // Arrange
    const ctx = fresh();
    // Act
    const vs = ctx.createShader(VERTEX_SHADER);
    ctx.shaderSource(vs, GOOD_VERT);
    ctx.compileShader(vs);
    const vsOk = ctx.getShaderParameter(vs, COMPILE_STATUS);
    const vsLog = ctx.getShaderInfoLog(vs);
    const fs = ctx.createShader(FRAGMENT_SHADER);
    ctx.shaderSource(fs, GOOD_FRAG);
    ctx.compileShader(fs);
    const fsOk = ctx.getShaderParameter(fs, COMPILE_STATUS);
    const fsLog = ctx.getShaderInfoLog(fs);
    const prog = ctx.createProgram();
    ctx.attachShader(prog, vs);
    ctx.attachShader(prog, fs);
    ctx.linkProgram(prog);
    const linked = ctx.getProgramParameter(prog, LINK_STATUS);
    const plog = ctx.getProgramInfoLog(prog);
    const err = (ctx as unknown as { getError(): number }).getError();
    // Assert
    expect(vsOk).toBe(true);
    expect(vsLog).toBe('');
    expect(fsOk).toBe(true);
    expect(fsLog).toBe('');
    expect(linked).toBe(true);
    expect(plog).toBe('');
    expect(err).toBe(NO_ERROR);
  });

  it('attrib and uniform locations resolve per declaration order', () => {
    // Arrange
    const ctx = fresh();
    const vsrc = [
      'attribute vec3 position;',
      'attribute vec3 normal;',
      'attribute vec2 texcoord;',
      'uniform mat4 modelMatrix;',
      'varying vec2 uv;',
      'void main() {',
      '  uv = texcoord;',
      '  gl_Position = vec4(position, 1.0);',
      '}',
    ].join('\n');
    // Act
    const vs = ctx.createShader(VERTEX_SHADER);
    ctx.shaderSource(vs, vsrc);
    ctx.compileShader(vs);
    const fs = ctx.createShader(FRAGMENT_SHADER);
    ctx.shaderSource(fs, GOOD_FRAG);
    ctx.compileShader(fs);
    const prog = ctx.createProgram();
    ctx.attachShader(prog, vs);
    ctx.attachShader(prog, fs);
    ctx.linkProgram(prog);
    const p = ctx.getAttribLocation(prog, 'position');
    const n = ctx.getAttribLocation(prog, 'normal');
    const t = ctx.getAttribLocation(prog, 'texcoord');
    const absent = ctx.getAttribLocation(prog, 'tangent');
    const h1 = ctx.getUniformLocation(prog, 'modelMatrix');
    const h2 = ctx.getUniformLocation(prog, 'modelMatrix');
    const missing = ctx.getUniformLocation(prog, 'missing');
    ctx.uniform1f(h1, 1.0);
    ctx.uniform4f(h1, 1, 2, 3, 4);
    const err = (ctx as unknown as { getError(): number }).getError();
    // Assert
    expect(p).toBe(0);
    expect(n).toBe(1);
    expect(t).toBe(2);
    expect(absent).toBe(-1);
    expect(h1).toBe(h2);
    expect(missing).toBeNull();
    expect(err).toBe(NO_ERROR);
  });

  it('link failure variants stay off the queue with VERSION_MISMATCH', () => {
    // Arrange
    const ctx = fresh();
    // Act
    const vs = ctx.createShader(VERTEX_SHADER);
    ctx.shaderSource(vs, GOOD_VERT);
    ctx.compileShader(vs);
    const fs = ctx.createShader(FRAGMENT_SHADER);
    ctx.shaderSource(fs, V300_FRAG);
    ctx.compileShader(fs);
    const prog = ctx.createProgram();
    ctx.attachShader(prog, vs);
    ctx.attachShader(prog, fs);
    ctx.linkProgram(prog);
    const linked = ctx.getProgramParameter(prog, LINK_STATUS);
    const log = ctx.getProgramInfoLog(prog);
    const err = (ctx as unknown as { getError(): number }).getError();
    // Assert
    expect(linked).toBe(false);
    expect(log).toContain('VERSION_MISMATCH');
    expect(err).toBe(NO_ERROR);
  });
});
