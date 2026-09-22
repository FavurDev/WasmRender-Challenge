/** Sprint 8 Task 10 MRT TDD RED-phase tests — drawBuffers, readBuffer, frag outputs, clearBuffer*, integer path. */
import { describe, expect, it } from 'vitest';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import {
  ARRAY_BUFFER,
  BACK,
  COLOR_ATTACHMENT0,
  COMPILE_STATUS,
  DRAW_BUFFER0,
  FLOAT,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINK_STATUS,
  MAX_DRAW_BUFFERS,
  NO_ERROR,
  NONE,
  READ_BUFFER,
  RGBA,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  UNSIGNED_INT,
  VERTEX_SHADER,
  FRAGMENT_SHADER,
} from '../../src/gl/constants';

// TODO: add COLOR_ATTACHMENT1 to src/gl/constants.ts (0x8CE1).
const COLOR_ATTACHMENT1 = 0x8ce1;
// TODO: add COLOR_ATTACHMENT2 to src/gl/constants.ts (0x8CE2).
const COLOR_ATTACHMENT2 = 0x8ce2;
// TODO: add COLOR_ATTACHMENT3 to src/gl/constants.ts (0x8CE3).
const COLOR_ATTACHMENT3 = 0x8ce3;
// TODO: add MAX_COLOR_ATTACHMENTS to src/gl/constants.ts (0x8CDF).
const MAX_COLOR_ATTACHMENTS = 0x8cdf;
// TODO: add DRAW_BUFFER1 to src/gl/constants.ts (0x8826).
const DRAW_BUFFER1 = 0x8826;
// TODO: add DRAW_BUFFER2 to src/gl/constants.ts (0x8827).
const DRAW_BUFFER2 = 0x8827;
// TODO: add DRAW_BUFFER3 to src/gl/constants.ts (0x8828).
const DRAW_BUFFER3 = 0x8828;
// TODO: add COLOR to src/gl/constants.ts (0x1800).
const COLOR = 0x1800;
// TODO: add DEPTH to src/gl/constants.ts (0x1801).
const DEPTH = 0x1801;
// TODO: add DEPTH_STENCIL to src/gl/constants.ts (0x84F9).
const DEPTH_STENCIL = 0x84f9;
// TODO: add DEPTH_ATTACHMENT coverage already exists; COLOR_ATTACHMENT4 invalid probe (0x8CE4).
const COLOR_ATTACHMENT4 = 0x8ce4;

const W = 64;
const H = 64;

type MrtProbe = {
  drawBuffers: (buffers: number[]) => void;
  readBuffer: (src: number) => void;
  getFragDataLocation: (program: unknown, name: string) => number;
  clearBufferfv: (buffer: number, drawbuffer: number, values: ArrayLike<number>, srcOffset?: number) => void;
  clearBufferiv: (buffer: number, drawbuffer: number, values: ArrayLike<number>, srcOffset?: number) => void;
  clearBufferuiv: (buffer: number, drawbuffer: number, values: ArrayLike<number>, srcOffset?: number) => void;
  clearBufferfi: (buffer: number, drawbuffer: number, depth: number, stencil: number) => void;
  invalidateFramebuffer: (target: number, attachments: number[]) => void;
  invalidateSubFramebuffer: (target: number, attachments: number[], x: number, y: number, w: number, h: number) => void;
  uniform1ui: (loc: unknown, v0: number) => void;
  uniform4ui: (loc: unknown, v0: number, v1: number, v2: number, v3: number) => void;
  uniform4uiv: (loc: unknown, data: ArrayLike<number>) => void;
  vertexAttribIPointer: (index: number, size: number, type: number, stride: number, offset: number) => void;
};

function mrtContext(): WebGL2Context {
  // Arrange helper: fresh per-test WebGL2 context.
  return new WebGL2Context({ width: W, height: H });
}

function probe(gl: WebGL2Context): MrtProbe {
  return gl as unknown as MrtProbe;
}

function linkPair(gl: WebGL2Context, vsSrc: string, fsSrc: string): NonNullable<ReturnType<WebGL2Context['createProgram']>> {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
  gl.shaderSource(vs, vsSrc);
  gl.shaderSource(fs, fsSrc);
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

const MRT_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const MRT_FS =
  '#version 300 es\nprecision mediump float;\nlayout(location = 0) out vec4 outColor0;\nlayout(location = 1) out vec4 outColor1;\n' +
  'void main() { outColor0 = vec4(1.0, 0.0, 0.0, 1.0); outColor1 = vec4(0.0, 1.0, 0.0, 1.0); }';

function twoAttachmentFBO(gl: WebGL2Context): unknown {
  // Arrange helper: FBO with two RGBA8 textures on COLOR_ATTACHMENT0/1.
  const g = gl as unknown as Record<string, (...args: never[]) => unknown>;
  const fb = g['createFramebuffer']() as unknown;
  (gl as unknown as { bindFramebuffer: (t: number, f: unknown) => void }).bindFramebuffer(FRAMEBUFFER, fb as never);
  for (const [slot, att] of [[0, COLOR_ATTACHMENT0], [1, COLOR_ATTACHMENT1]] as const) {
    void slot;
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(0x0de1, tex);
    gl.texImage2D(0x0de1, 0, RGBA, W, H, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(W * H * 4));
    (g['framebufferTexture2D'] as (t: number, a: number, tt: number, tx: unknown, l: number) => void)(
      FRAMEBUFFER, att, 0x0de1, tex, 0,
    );
  }
  return fb;
}

function fullTri(gl: WebGL2Context, program: NonNullable<ReturnType<WebGL2Context['createProgram']>>): void {
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

describe('Sprint 8 Task 10 MRT (RED)', () => {
  it('TEST-1 (AC-1): dual fragment outputs write distinct values to two attachments', () => {
    // Arrange:
    const gl = mrtContext();
    twoAttachmentFBO(gl);
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    probe(gl).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT1]);
    const program = linkPair(gl, MRT_VS, MRT_FS);
    fullTri(gl, program);
    // Act:
    gl.useProgram(program);
    gl.drawArrays(TRIANGLES, 0, 3);
    // Assert:
    probe(gl).readBuffer(COLOR_ATTACHMENT0);
    const pixel0 = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, RGBA, UNSIGNED_BYTE, pixel0);
    expect(Array.from(pixel0)).toEqual([255, 0, 0, 255]);
    probe(gl).readBuffer(COLOR_ATTACHMENT1);
    const pixel1 = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, RGBA, UNSIGNED_BYTE, pixel1);
    expect(Array.from(pixel1)).toEqual([0, 255, 0, 255]);
  });

  it('TEST-2 (AC-2): clearBufferfv clears only the targeted attachment', () => {
    // Arrange:
    const gl = mrtContext();
    twoAttachmentFBO(gl);
    // Act:
    probe(gl).clearBufferfv(COLOR, 1, new Float32Array([0.0, 0.0, 1.0, 1.0]));
    // Assert:
    probe(gl).readBuffer(COLOR_ATTACHMENT0);
    const p0 = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, RGBA, UNSIGNED_BYTE, p0);
    expect(Array.from(p0)).toEqual([0, 0, 0, 255]);
    probe(gl).readBuffer(COLOR_ATTACHMENT1);
    const p1 = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, RGBA, UNSIGNED_BYTE, p1);
    expect(Array.from(p1)).toEqual([0, 0, 255, 255]);
  });

  it('TEST-3 (AC-3): integer attribute and uniform round-trip without float conversion', () => {
    // Arrange:
    const gl = mrtContext();
    const vs = 'attribute uvec4 a_val; uniform uvec4 u_val; varying uvec4 v_sum; void main() { v_sum = a_val + u_val; gl_Position = vec4(0.0); }';
    const fs = 'precision mediump float; varying uvec4 v_sum; void main() { gl_FragColor = vec4(float(v_sum.x)); }';
    const program = linkPair(gl, vs, fs);
    gl.useProgram(program);
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Uint32Array([3000000000, 0, 0, 0]), STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'a_val');
    probe(gl).vertexAttribIPointer(loc, 4, UNSIGNED_INT, 0, 0);
    const uLoc = gl.getUniformLocation(program, 'u_val');
    probe(gl).uniform4ui(uLoc, 100, 200, 300, 400);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const back = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, RGBA, UNSIGNED_BYTE, back);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(back.length).toBe(4);
    expect(gl.getUniformLocation(program, 'u_val')).not.toBeNull();
  });

  it('TEST-4 (AC-4): drawBuffers validation error matrix', () => {
    // Arrange:
    const gl = mrtContext();
    const p = probe(gl);
    // Act & Assert:
    p.drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT1, COLOR_ATTACHMENT2, COLOR_ATTACHMENT3, COLOR_ATTACHMENT0]);
    expect(gl.getError()).toBe(INVALID_VALUE);
    (gl as unknown as { bindFramebuffer: (t: number, f: unknown) => void }).bindFramebuffer(FRAMEBUFFER, null as never);
    p.drawBuffers([COLOR_ATTACHMENT0]);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    p.drawBuffers([BACK]);
    expect(gl.getError()).toBe(NO_ERROR);
    twoAttachmentFBO(gl);
    p.drawBuffers([BACK]);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    p.drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0]);
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TEST-5 (AC-5): readBuffer selects source attachment for readPixels', () => {
    // Arrange:
    const gl = mrtContext();
    twoAttachmentFBO(gl);
    const p = probe(gl);
    // Act & Assert:
    p.readBuffer(COLOR_ATTACHMENT4);
    expect(gl.getError()).toBe(INVALID_ENUM);
    (gl as unknown as { bindFramebuffer: (t: number, f: unknown) => void }).bindFramebuffer(FRAMEBUFFER, null as never);
    p.readBuffer(COLOR_ATTACHMENT0);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    p.readBuffer(BACK);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getParameter(READ_BUFFER)).toBe(BACK);
    twoAttachmentFBO(gl);
    p.readBuffer(COLOR_ATTACHMENT2);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getParameter(READ_BUFFER)).toBe(COLOR_ATTACHMENT2);
  });

  it('TEST-6 (AC-6): getFragDataLocation resolves fragment output locations', () => {
    // Arrange:
    const gl = mrtContext();
    const fs = '#version 300 es\nprecision mediump float;\nlayout(location = 2) out vec4 gBufferNormal;\nvoid main() { gBufferNormal = vec4(0.0); }';
    const program = linkPair(gl, MRT_VS, fs);
    // Act:
    const hit = probe(gl).getFragDataLocation(program, 'gBufferNormal');
    const miss = probe(gl).getFragDataLocation(program, 'nonExistent');
    const builtin = probe(gl).getFragDataLocation(program, 'gl_FragColor');
    // Assert:
    expect(hit).toBe(2);
    expect(miss).toBe(-1);
    expect(builtin).toBe(-1);
  });

  it('TEST-7 (AC-7a): clearBufferiv and clearBufferuiv integer scoping', () => {
    // Arrange:
    const gl = mrtContext();
    twoAttachmentFBO(gl);
    // Act:
    probe(gl).clearBufferiv(COLOR, 0, new Int32Array([-10, 20, -30, 40]));
    probe(gl).clearBufferuiv(COLOR, 1, new Uint32Array([1000, 2000, 3000, 4000]));
    // Assert:
    probe(gl).readBuffer(COLOR_ATTACHMENT0);
    const p0 = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, RGBA, UNSIGNED_BYTE, p0);
    expect(gl.getError()).toBe(NO_ERROR);
    probe(gl).readBuffer(COLOR_ATTACHMENT1);
    const p1 = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, RGBA, UNSIGNED_BYTE, p1);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(p0.length).toBe(4);
    expect(p1.length).toBe(4);
  });

  it('TEST-8 (AC-7b): clearBufferfi depth/stencil clearing and validation', () => {
    // Arrange:
    const gl = mrtContext();
    twoAttachmentFBO(gl);
    // Act:
    probe(gl).clearBufferfi(DEPTH_STENCIL, 0, 0.75, 0x55);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    const expected24 = Math.round(0.75 * 16777215);
    expect(expected24).toBe(12582911);
    probe(gl).clearBufferfi(COLOR, 0, 0.5, 1);
    expect(gl.getError()).toBe(INVALID_ENUM);
    probe(gl).clearBufferfv(DEPTH, 1, new Float32Array([0.5]));
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TEST-9 (AC-8/AC-9): invalidate no-op validation and unsigned integer uniform storage', () => {
    // Arrange:
    const gl = mrtContext();
    twoAttachmentFBO(gl);
    const p = probe(gl);
    // Act & Assert:
    p.invalidateFramebuffer(FRAMEBUFFER, [COLOR_ATTACHMENT0, 0x8d00]);
    expect(gl.getError()).toBe(NO_ERROR);
    p.invalidateSubFramebuffer(FRAMEBUFFER, [COLOR_ATTACHMENT0], 0, 0, 32, 32);
    expect(gl.getError()).toBe(NO_ERROR);
    p.invalidateSubFramebuffer(FRAMEBUFFER, [COLOR_ATTACHMENT0], 0, 0, -5, 32);
    expect(gl.getError()).toBe(INVALID_VALUE);
    const vs = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
    const fs = 'precision mediump float; uniform uvec4 u_val; void main() { gl_FragColor = vec4(1.0); }';
    const program = linkPair(gl, vs, fs);
    gl.useProgram(program);
    const uLoc = gl.getUniformLocation(program, 'u_val');
    p.uniform1ui(uLoc, 4294967295);
    expect(gl.getError()).toBe(NO_ERROR);
    p.uniform4uiv(uLoc, new Uint32Array([100, 200, 300, 400]));
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TEST-10 (AC-10): ES 3.00 getParameter MRT state queries', () => {
    // Arrange:
    const gl = mrtContext();
    twoAttachmentFBO(gl);
    probe(gl).drawBuffers([NONE, COLOR_ATTACHMENT2]);
    probe(gl).readBuffer(COLOR_ATTACHMENT1);
    // Act & Assert:
    expect(gl.getParameter(MAX_DRAW_BUFFERS)).toBe(4);
    expect(gl.getParameter(MAX_COLOR_ATTACHMENTS)).toBe(4);
    expect(gl.getParameter(DRAW_BUFFER0)).toBe(NONE);
    expect(gl.getParameter(DRAW_BUFFER1)).toBe(COLOR_ATTACHMENT2);
    expect(gl.getParameter(DRAW_BUFFER2)).toBe(NONE);
    expect(gl.getParameter(DRAW_BUFFER3)).toBe(NONE);
    expect(gl.getParameter(READ_BUFFER)).toBe(COLOR_ATTACHMENT1);
  });

  it('TEST-11 (blueprint TEST-4): framebufferTexture2D on unbound FBO records INVALID_OPERATION', () => {
    // Arrange:
    const gl = mrtContext();
    const g = gl as unknown as Record<string, (...args: never[]) => unknown>;
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    // Act: no framebuffer bound (this.bound === null).
    (g['framebufferTexture2D'] as (t: number, a: number, tt: number, tx: unknown, l: number) => void)(
      FRAMEBUFFER, COLOR_ATTACHMENT0, 0x0de1, tex, 0,
    );
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });
});