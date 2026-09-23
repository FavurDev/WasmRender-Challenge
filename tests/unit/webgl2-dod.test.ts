/** Sprint 8 Task 14 — M4 Definition-of-Done verification suite (Demo Carrier, TDD red phase). */
import { describe, expect, it } from 'vitest';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import {
  ARRAY_BUFFER,
  BACK,
  COLOR,
  COLOR_ATTACHMENT0,
  COLOR_ATTACHMENT1,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  FLOAT,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAGMENT_SHADER,
  INTERLEAVED_ATTRIBS,
  LINK_STATUS,
  MAX_3D_TEXTURE_SIZE,
  MAX_ARRAY_TEXTURE_LAYERS,
  MAX_COLOR_ATTACHMENTS,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS,
  MAX_DRAW_BUFFERS,
  MAX_FRAGMENT_UNIFORM_VECTORS,
  MAX_TEXTURE_IMAGE_UNITS,
  MAX_TEXTURE_SIZE,
  MAX_VERTEX_ATTRIBS,
  MAX_VERTEX_UNIFORM_VECTORS,
  NO_ERROR,
  NONE,
  POINTS,
  RGBA,
  STATIC_DRAW,
  TEXTURE_2D,
  TRANSFORM_FEEDBACK_BUFFER,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERSION,
  VERTEX_SHADER,
} from '../../src/gl/constants';

const W = 8;
const H = 8;
const VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const FS_RED = 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }';

function dodContext(): WebGL2Context {
  // Arrange helper: fresh per-test context.
  return new WebGL2Context({ width: W, height: H });
}

function linkPair(gl: WebGL2Context, fsSource: string = FS_RED): NonNullable<ReturnType<WebGL2Context['createProgram']>> {
  // Arrange helper: compile + link a minimal program.
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
  gl.shaderSource(vs, VS);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('arrange: VS failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('arrange: FS failed');
  const program = gl.createProgram();
  if (program === null) throw new Error('arrange: createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('arrange: link failed');
  return program;
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  // Arrange helper: byte comparison.
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

function readback(gl: WebGL2Context): Uint8Array {
  // Arrange helper: full-buffer readback.
  const out = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, RGBA, UNSIGNED_BYTE, out);
  if (gl.getError() !== NO_ERROR) throw new Error('readback: readPixels errored');
  return out;
}

function bindFullTriangle(gl: WebGL2Context, program: unknown): void {
  // Arrange helper: bind a fullscreen triangle on attribute 0.
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('arrange: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 0, 1, 3, -1, 0, 1, -1, 3, 0, 1]), STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, FLOAT, false, 0, 0);
  gl.useProgram(program as never);
}

const MRT_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const MRT_FS =
  '#version 300 es\nprecision mediump float;\nlayout(location = 0) out vec4 outColor0;\nlayout(location = 1) out vec4 outColor1;\n' +
  'void main() { outColor0 = vec4(1.0, 0.0, 0.0, 1.0); outColor1 = vec4(0.0, 1.0, 0.0, 1.0); }';

function twoAttachmentFBO(gl: WebGL2Context): unknown {
  // Arrange helper: FBO with two RGBA8 textures on COLOR_ATTACHMENT0/1 (mirrors mrt.test.ts).
  const g = gl as unknown as Record<string, (...args: never[]) => unknown>;
  const fb = g['createFramebuffer']() as unknown;
  (gl as unknown as { bindFramebuffer: (t: number, f: unknown) => void }).bindFramebuffer(FRAMEBUFFER, fb as never);
  for (const att of [COLOR_ATTACHMENT0, COLOR_ATTACHMENT1] as const) {
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, W, H, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(W * H * 4));
    (g['framebufferTexture2D'] as (t: number, a: number, tt: number, tx: unknown, l: number) => void)(
      FRAMEBUFFER,
      att,
      TEXTURE_2D,
      tex,
      0,
    );
  }
  return fb;
}

function fullTriMrt(gl: WebGL2Context, program: NonNullable<ReturnType<WebGL2Context['createProgram']>>): void {
  // Arrange helper: fullscreen triangle bound via real attribute location (mirrors mrt.test.ts fullTri).
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('arrange: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
  gl.useProgram(program);
  const loc = gl.getAttribLocation(program, 'aPos');
  if (loc < 0) throw new Error('arrange: aPos not found');
  gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
}

describe('M4 DoD Fixture 1 — composite scene (VAO + std140 UBO + instancing + MRT)', () => {
  it('TEST 1: composite scene renders exact pixels on both MRT attachments', () => {
    // Arrange:
    const gl = dodContext();
    twoAttachmentFBO(gl);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    (gl as unknown as { drawBuffers: (b: number[]) => void }).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT1]);
    const program = linkPair(gl, MRT_FS);
    const vao = gl.createVertexArray();
    if (vao === null) throw new Error('arrange: createVertexArray failed');
    gl.bindVertexArray(vao);
    fullTriMrt(gl, program);
    // Act:
    gl.useProgram(program);
    gl.drawArraysInstanced(TRIANGLES, 0, 3, 2);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    const probe = gl as unknown as { readBuffer: (b: number) => void };
    probe.readBuffer(COLOR_ATTACHMENT0);
    const out = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, RGBA, UNSIGNED_BYTE, out);
    expect(Array.from(out)).toEqual([255, 0, 0, 255]);
    probe.readBuffer(COLOR_ATTACHMENT1);
    const out1 = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, RGBA, UNSIGNED_BYTE, out1);
    expect(Array.from(out1)).toEqual([0, 255, 0, 255]);
  });

  it('TEST 2: clearBufferfv isolates attachments', () => {
    // Arrange:
    const gl = dodContext();
    twoAttachmentFBO(gl);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    const probe = gl as unknown as {
      readBuffer: (b: number) => void;
      clearBufferfv: (b: number, d: number, v: ArrayLike<number>) => void;
    };
    // Act:
    probe.clearBufferfv(COLOR, 1, new Float32Array([0.0, 0.0, 1.0, 1.0]));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    probe.readBuffer(COLOR_ATTACHMENT0);
    const a0 = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, RGBA, UNSIGNED_BYTE, a0);
    expect(Array.from(a0)).toEqual([0, 0, 0, 255]);
    probe.readBuffer(COLOR_ATTACHMENT1);
    const a1 = new Uint8Array(4);
    gl.readPixels(4, 4, 1, 1, RGBA, UNSIGNED_BYTE, a1);
    expect(Array.from(a1)).toEqual([0, 0, 255, 255]);
  });

  it('TEST 3: zero-instance draw is a framebuffer no-op', () => {
    // Arrange:
    const gl = dodContext();
    const program = linkPair(gl);
    bindFullTriangle(gl, program);
    const before = readback(gl);
    // Act:
    gl.drawArraysInstanced(TRIANGLES, 0, 3, 0);
    const after = readback(gl);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(buffersEqual(before, after)).toBe(true);
  });
});

const TF_VS =
  '#version 300 es\nin vec2 a_pos;\nout vec4 v_out;\n' +
  'void main() { v_out = vec4(a_pos.x + 1.0, a_pos.y + 1.0, a_pos.x * 2.0, a_pos.y * 2.0); }';
const TF_FS =
  '#version 300 es\nprecision mediump float;\nin vec4 v_out;\nout vec4 o_color;\n' +
  'void main() { o_color = v_out; }';

function linkTfPair(gl: WebGL2Context): NonNullable<ReturnType<WebGL2Context['createProgram']>> {
  // Arrange helper: compile + link the Fixture-2 TF pair (VS feeds v_out, FS consumes it).
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
  gl.shaderSource(vs, TF_VS);
  gl.shaderSource(fs, TF_FS);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('arrange: TF VS failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('arrange: TF FS failed');
  const program = gl.createProgram();
  if (program === null) throw new Error('arrange: createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.transformFeedbackVaryings(program, ['v_out'], INTERLEAVED_ATTRIBS);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('arrange: TF link failed');
  return program;
}

function bindTfPoints(gl: WebGL2Context, program: NonNullable<ReturnType<WebGL2Context['createProgram']>>): void {
  // Arrange helper: two POINT vertices (1,2) and (3,4) on the real a_pos location.
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('arrange: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([1, 2, 3, 4]), STATIC_DRAW);
  gl.useProgram(program);
  const loc = gl.getAttribLocation(program, 'a_pos');
  if (loc < 0) throw new Error('arrange: a_pos not found');
  gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
}

function bindTfTarget(gl: WebGL2Context, floats: number): void {
  // Arrange helper: zeroed TRANSFORM_FEEDBACK_BUFFER target sized for `floats` floats.
  const tfb = gl.createBuffer();
  if (tfb === null) throw new Error('arrange: TF createBuffer failed');
  gl.bindBufferBase(TRANSFORM_FEEDBACK_BUFFER, 0, tfb);
  gl.bufferData(TRANSFORM_FEEDBACK_BUFFER, floats * 4, STATIC_DRAW);
}

describe('M4 DoD Fixture 2 — transform feedback CPU parity', () => {
  it('TEST 4: interleaved TF capture matches CPU-computed varyings', () => {
    // Arrange:
    const gl = dodContext();
    const program = linkTfPair(gl);
    bindTfPoints(gl, program);
    bindTfTarget(gl, 8);
    // Act: run the real GL capture path (POINTS draw writes v_out per vertex, interleaved).
    gl.beginTransformFeedback(POINTS);
    gl.drawArrays(POINTS, 0, 2);
    gl.endTransformFeedback();
    const dst = new Float32Array(8);
    gl.getBufferSubData(TRANSFORM_FEEDBACK_BUFFER, 0, dst);
    // Assert: captured varyings equal the CPU-side evaluation of the Fixture-2 shader.
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(dst)).toEqual([2, 3, 2, 4, 4, 5, 6, 8]);
  });

  it('TEST 5: unwritten TF region keeps its prior bytes', () => {
    // Arrange:
    const gl = dodContext();
    const program = linkTfPair(gl);
    bindTfPoints(gl, program);
    const tfb = gl.createBuffer();
    if (tfb === null) throw new Error('arrange: TF createBuffer failed');
    gl.bindBufferBase(TRANSFORM_FEEDBACK_BUFFER, 0, tfb);
    gl.bufferData(TRANSFORM_FEEDBACK_BUFFER, new Float32Array([9, 9, 9, 9, 7, 7, 7, 7]), STATIC_DRAW);
    // Act: capture a single vertex; the trailing 4 floats are never written.
    gl.beginTransformFeedback(POINTS);
    gl.drawArrays(POINTS, 0, 1);
    gl.endTransformFeedback();
    const dst = new Float32Array(8);
    gl.getBufferSubData(TRANSFORM_FEEDBACK_BUFFER, 0, dst);
    // Assert: written region holds vertex 0 varyings, unwritten region keeps its seed.
    expect(gl.getError()).toBe(NO_ERROR);
    expect(Array.from(dst)).toEqual([2, 3, 2, 4, 7, 7, 7, 7]);
  });
});

describe('M4 DoD Fixture 3 — version and limits table', () => {
  it('TEST 6: VERSION string and WebGL2 limit table', () => {
    // Arrange:
    const gl = dodContext();
    // Act:
    const version = gl.getParameter(VERSION) as string;
    const maxTex = gl.getParameter(MAX_TEXTURE_SIZE) as number;
    const maxVattrib = gl.getParameter(MAX_VERTEX_ATTRIBS) as number;
    const maxVuni = gl.getParameter(MAX_VERTEX_UNIFORM_VECTORS) as number;
    const maxFuni = gl.getParameter(MAX_FRAGMENT_UNIFORM_VECTORS) as number;
    const maxTexUnits = gl.getParameter(MAX_TEXTURE_IMAGE_UNITS) as number;
    const maxCombined = gl.getParameter(MAX_COMBINED_TEXTURE_IMAGE_UNITS) as number;
    // Assert:
    expect(version).toBe('WebGL 2.0 (Software)');
    expect(maxTex).toBe(4096);
    expect(maxVattrib).toBe(16);
    expect(maxVuni).toBe(256);
    expect(maxFuni).toBe(224);
    expect(maxTexUnits).toBe(16);
    expect(maxCombined).toBe(32);
  });

  it('TEST 7: MAX_3D_TEXTURE_SIZE and MAX_ARRAY_TEXTURE_LAYERS are 256', () => {
    // Arrange:
    const gl = dodContext();
    // Act:
    const max3d = gl.getParameter(MAX_3D_TEXTURE_SIZE) as number;
    const maxLayers = gl.getParameter(MAX_ARRAY_TEXTURE_LAYERS) as number;
    const maxDraw = gl.getParameter(MAX_DRAW_BUFFERS) as number;
    const maxAttach = gl.getParameter(MAX_COLOR_ATTACHMENTS) as number;
    // Assert:
    expect(max3d).toBe(256);
    expect(maxLayers).toBe(256);
    expect(maxDraw).toBe(4);
    expect(maxAttach).toBe(4);
    expect(BACK).toBe(0x0405);
    expect(NONE).toBe(0);
    expect(COLOR_BUFFER_BIT).toBe(0x00004000);
  });
});

describe('M4 DoD Fixture 4 — determinism', () => {
  it('TEST 8: double render of composite scene is byte-identical', () => {
    // Arrange:
    const renderScene = (): Uint8Array => {
      const gl = dodContext();
      const program = linkPair(gl);
      bindFullTriangle(gl, program);
      gl.drawArraysInstanced(TRIANGLES, 0, 3, 2);
      const out = readback(gl);
      expect(gl.getError()).toBe(NO_ERROR);
      return out;
    };
    // Act:
    const a = renderScene();
    const b = renderScene();
    // Assert:
    expect(buffersEqual(a, b)).toBe(true);
    expect(a.some((v) => v !== 0)).toBe(true);
  });
});
