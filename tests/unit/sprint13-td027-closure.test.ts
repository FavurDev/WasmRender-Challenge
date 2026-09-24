/** Sprint 13 Task 5 TD-027 closure regression suite (TDD red phase) — unary negation byte-identity. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  FLOAT,
  FRAGMENT_SHADER,
  LINK_STATUS,
  RGBA,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

const VS = 'attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }';

function createContext(w: number, h: number): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('createContext: factory returned null');
  return gl;
}

type Program = NonNullable<ReturnType<WebGL1Context['createProgram']>>;

function compileAndLink(gl: WebGL1Context, vsSource: string, fsSource: string): Program {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('compileAndLink: shader creation failed');
  gl.shaderSource(vs, vsSource);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('compileAndLink: VS failed: ' + gl.getShaderInfoLog(vs));
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('compileAndLink: FS failed: ' + gl.getShaderInfoLog(fs));
  const program = gl.createProgram();
  if (program === null) throw new Error('compileAndLink: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('compileAndLink: link failed: ' + gl.getProgramInfoLog(program));
  return program;
}

function drawFullscreenQuad(gl: WebGL1Context, program: Program): void {
  const posBuf = gl.createBuffer();
  if (posBuf === null) throw new Error('drawFullscreenQuad: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, posBuf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
  gl.useProgram(program);
  const loc = gl.getAttribLocation(program, 'a_position');
  if (loc < 0) throw new Error('drawFullscreenQuad: a_position not found');
  gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
  gl.viewport(0, 0, 4, 4);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(COLOR_BUFFER_BIT);
  gl.drawArrays(TRIANGLES, 0, 3);
}

function readRgba(gl: WebGL1Context, width: number, height: number): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, RGBA, UNSIGNED_BYTE, pixels);
  return pixels;
}

describe('Sprint 13 Task 5 TD-027 closure', () => {
  it('scalar_float_negation_byte_identity', () => {
    // Arrange: 4x4 context, scalar negation shader, u_val = 0.75.
    const gl = createContext(4, 4);
    const fs =
      'precision highp float; uniform float u_val; void main() { ' +
      'float n = -u_val; gl_FragColor = vec4(n + 1.0, -(-u_val), (-u_val) * (-1.0), 1.0); }';
    const program = compileAndLink(gl, VS, fs);
    drawFullscreenQuad(gl, program);
    const loc = gl.getUniformLocation(program, 'u_val');
    if (loc === null) throw new Error('arrange: u_val location null');
    gl.useProgram(program);
    gl.uniform1f(loc, 0.75);
    // Act: draw and read back.
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = readRgba(gl, 4, 4);
    // Assert: every pixel is exactly [64, 191, 191, 255].
    for (let i = 0; i < 16; i += 1) {
      expect([pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], pixels[i * 4 + 3]]).toEqual([64, 191, 191, 255]);
    }
  });

  it('vector_float_negation_byte_identity', () => {
    // Arrange: 4x4 context, vec4 negation shader.
    const gl = createContext(4, 4);
    const fs =
      'precision highp float; uniform vec4 u_vec; void main() { ' +
      'vec4 neg = -u_vec; gl_FragColor = vec4(neg.x + 0.3, neg.y + 0.9, neg.z + 0.1, 1.0); }';
    const program = compileAndLink(gl, VS, fs);
    drawFullscreenQuad(gl, program);
    const loc = gl.getUniformLocation(program, 'u_vec');
    if (loc === null) throw new Error('arrange: u_vec location null');
    gl.useProgram(program);
    gl.uniform4f(loc, -0.2, 0.4, -0.6, 0.8);
    // Act: draw and read back.
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = readRgba(gl, 4, 4);
    // Assert: exact float32 golden bytes.
    const r = Math.round(Math.fround(Math.fround(0.2) + Math.fround(0.3)) * 255);
    const g = Math.round(Math.fround(Math.fround(-0.4) + Math.fround(0.9)) * 255);
    const b = Math.round(Math.fround(Math.fround(0.6) + Math.fround(0.1)) * 255);
    for (let i = 0; i < 16; i += 1) {
      expect([pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], pixels[i * 4 + 3]]).toEqual([r, g, b, 255]);
    }
  });

  it('matrix_float_array_negation_byte_identity', () => {
    // Arrange: 4x4 context, mat2 negation shader.
    const gl = createContext(4, 4);
    const fs =
      'precision highp float; uniform mat2 u_mat; void main() { ' +
      'mat2 m = -u_mat; gl_FragColor = vec4(m[0][0] + 0.5, m[0][1] + 0.5, m[1][0] + 0.5, m[1][1] + 0.5); }';
    const program = compileAndLink(gl, VS, fs);
    drawFullscreenQuad(gl, program);
    const loc = gl.getUniformLocation(program, 'u_mat');
    if (loc === null) throw new Error('arrange: u_mat location null');
    gl.useProgram(program);
    gl.uniformMatrix2fv(loc, false, new Float32Array([0.25, -0.25, -0.5, 0.5]));
    // Act: draw and read back.
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = readRgba(gl, 4, 4);
    // Assert: exact bytes [64, 191, 255, 0].
    for (let i = 0; i < 16; i += 1) {
      expect([pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2], pixels[i * 4 + 3]]).toEqual([64, 191, 255, 0]);
    }
  });

  it('subnormal_edge_float32_negation_semantics', () => {
    // Arrange: 4x4 context, signed-zero + subnormal shader.
    const gl = createContext(4, 4);
    const fs =
      'precision highp float; uniform float u_zero; uniform float u_neg_zero; uniform float u_subnorm; ' +
      'void main() { float nz = -u_zero; float pz = -u_neg_zero; float nsub = -u_subnorm; ' +
      'bool signPreserved = (1.0 / nz < 0.0) && (1.0 / pz > 0.0); ' +
      'bool subnormNegated = (nsub < 0.0); ' +
      'gl_FragColor = vec4(signPreserved ? 1.0 : 0.0, subnormNegated ? 1.0 : 0.0, 0.5, 1.0); }';
    const program = compileAndLink(gl, VS, fs);
    drawFullscreenQuad(gl, program);
    gl.useProgram(program);
    const lz = gl.getUniformLocation(program, 'u_zero');
    const lnz = gl.getUniformLocation(program, 'u_neg_zero');
    const ls = gl.getUniformLocation(program, 'u_subnorm');
    if (lz === null || lnz === null || ls === null) throw new Error('arrange: uniform location null');
    gl.uniform1f(lz, 0.0);
    gl.uniform1f(lnz, -0.0);
    gl.uniform1f(ls, 1.0e-40);
    // Act: draw and read back.
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = readRgba(gl, 4, 4);
    // Assert: red=255 (sign preserved), green=255 (subnormal negated).
    for (let i = 0; i < 16; i += 1) {
      expect(pixels[i * 4]).toBe(255);
      expect(pixels[i * 4 + 1]).toBe(255);
    }
  });

  it('two_context_negation_heavy_determinism', () => {
    // Arrange: two independent 16x16 contexts with negation-heavy shader.
    const mk = (): { gl: WebGL1Context; program: Program } => {
      const gl = createSoftwareWebGLContext({ width: 16, height: 16 });
      if (gl === null) throw new Error('arrange: factory returned null');
      const vsSrc =
        'attribute vec2 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; ' +
        'void main() { v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }';
      const fsSrc =
        'precision highp float; varying vec2 v_texCoord; void main() { ' +
        'vec4 v = vec4(v_texCoord.x, v_texCoord.y, -v_texCoord.x, -v_texCoord.y); ' +
        'vec4 n1 = -v; vec4 n2 = -n1; vec4 n3 = -n2; vec4 a = -n1 + n2; vec4 b = n1 - n3; ' +
        'gl_FragColor = vec4(a.x + b.y, a.z - b.w, -a.x + n3.y, 1.0); }';
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
      if (program === null) throw new Error('arrange: program creation failed');
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('arrange: link failed');
      const posBuf = gl.createBuffer();
      const texBuf = gl.createBuffer();
      if (posBuf === null || texBuf === null) throw new Error('arrange: createBuffer failed');
      gl.bindBuffer(ARRAY_BUFFER, posBuf);
      gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
      gl.bindBuffer(ARRAY_BUFFER, texBuf);
      gl.bufferData(ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), STATIC_DRAW);
      gl.useProgram(program);
      const posLoc = gl.getAttribLocation(program, 'a_position');
      const texLoc = gl.getAttribLocation(program, 'a_texCoord');
      if (posLoc < 0 || texLoc < 0) throw new Error('arrange: attrib locations not found');
      gl.bindBuffer(ARRAY_BUFFER, posBuf);
      gl.vertexAttribPointer(posLoc, 2, FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(posLoc);
      gl.bindBuffer(ARRAY_BUFFER, texBuf);
      gl.vertexAttribPointer(texLoc, 2, FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(texLoc);
      gl.viewport(0, 0, 16, 16);
      return { gl, program };
    };
    const a = mk();
    const b = mk();
    // Act: draw in each and read back.
    a.gl.drawArrays(TRIANGLES, 0, 3);
    b.gl.drawArrays(TRIANGLES, 0, 3);
    const pixelsA = readRgba(a.gl, 16, 16);
    const pixelsB = readRgba(b.gl, 16, 16);
    // Assert: byte-for-byte identity, length 1024.
    expect(pixelsA.length).toBe(1024);
    expect(pixelsB.length).toBe(1024);
    expect(Array.from(pixelsA)).toEqual(Array.from(pixelsB));
  });
});
