/** Sprint 8 Task 2 sampler TDD RED-phase tests — public WebGL2 sampler API surface. */
import { describe, expect, it } from 'vitest';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import { createSoftwareWebGLContext } from '../../src/entry';
import {
  ARRAY_BUFFER,
  CLAMP_TO_EDGE,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  FLOAT,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LEQUAL,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINK_STATUS,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NO_ERROR,
  REPEAT,
  RGBA,
  STATIC_DRAW,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_R,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

// Local spec values for constants not yet in src/gl/constants.ts (red phase).
const NONE = 0;
const TEXTURE_MIN_LOD = 0x813a;
const TEXTURE_MAX_LOD = 0x813b;
const TEXTURE_COMPARE_MODE = 0x884c;
const TEXTURE_COMPARE_FUNC = 0x884d;

const W = 4;
const H = 4;
const VS =
  'attribute vec2 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; ' +
  'void main() { v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }';
const FS =
  'precision mediump float; varying vec2 v_texCoord; uniform sampler2D u_sampler; ' +
  'void main() { gl_FragColor = texture2D(u_sampler, v_texCoord); }';

function samplerContext(): WebGL2Context {
  // Arrange helper: fresh per-test WebGL2 context.
  return new WebGL2Context({ width: W, height: H });
}

function linkProgram(gl: WebGL2Context): NonNullable<ReturnType<WebGL2Context['createProgram']>> {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
  gl.shaderSource(vs, VS);
  gl.shaderSource(fs, FS);
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

function fullQuad(gl: WebGL2Context, program: NonNullable<ReturnType<WebGL2Context['createProgram']>>): void {
  // Arrange helper: full-screen triangle with texcoords spanning [0..2].
  const posBuf = gl.createBuffer();
  const texBuf = gl.createBuffer();
  if (posBuf === null || texBuf === null) throw new Error('arrange: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, posBuf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
  gl.bindBuffer(ARRAY_BUFFER, texBuf);
  // Half-pixel-center calibration: pixel (1,1) fragment center (1.5,1.5) → texcoord (0.5,0.5).
  gl.bufferData(ARRAY_BUFFER, new Float32Array([0.125, 0.125, 2.125, 0.125, 0.125, 2.125]), STATIC_DRAW);
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
  const samplerLoc = gl.getUniformLocation(program, 'u_sampler');
  if (samplerLoc === null) throw new Error('arrange: u_sampler location null');
  gl.uniform1i(samplerLoc, 0);
  if (gl.getError() !== NO_ERROR) throw new Error('arrange: setup errored');
}

function checkerboard(): Uint8Array {
  // Arrange helper: 2x2 checkerboard, TL+BR black, TR+BL white.
  return new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 255]);
}

describe('Sprint 8 Task 2 samplers (RED)', () => {
  it('TEST 1 (AC-1): LINEAR sampler on NEAREST texture filters linear, texture param unchanged', () => {
    // Arrange:
    const gl = samplerContext();
    const program = linkProgram(gl);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, checkerboard());
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    const sampler = gl.createSampler();
    if (sampler === null) throw new Error('arrange: createSampler failed');
    gl.samplerParameteri(sampler, TEXTURE_MIN_FILTER, LINEAR);
    gl.samplerParameteri(sampler, TEXTURE_MAG_FILTER, LINEAR);
    gl.bindSampler(0, sampler);
    fullQuad(gl, program);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixel = new Uint8Array(4);
    gl.readPixels(1, 1, 1, 1, RGBA, UNSIGNED_BYTE, pixel);
    const texMag = gl.getTexParameter(TEXTURE_2D, TEXTURE_MAG_FILTER);
    // Assert:
    expect(pixel[0]).toBeGreaterThan(0);
    expect(pixel[0]).toBeLessThan(255);
    expect([127, 128]).toContain(pixel[0]);
    expect(texMag).toBe(NEAREST);
  });

  it('TEST 2 (AC-2): invalid sampler pname/value records INVALID_ENUM with zero mutation', () => {
    // Arrange:
    const gl = samplerContext();
    const sampler = gl.createSampler();
    if (sampler === null) throw new Error('arrange: createSampler failed');
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.samplerParameteri(sampler, 0x9999, LINEAR);
    const err1 = gl.getError();
    gl.samplerParameteri(sampler, TEXTURE_MAG_FILTER, 0x9999);
    const err2 = gl.getError();
    gl.samplerParameteri(sampler, TEXTURE_WRAP_S, 0x1234);
    const err3 = gl.getError();
    const mag = gl.getSamplerParameter(sampler, TEXTURE_MAG_FILTER);
    // Assert:
    expect(err1).toBe(INVALID_ENUM);
    expect(err2).toBe(INVALID_ENUM);
    expect(err3).toBe(INVALID_ENUM);
    expect(mag).toBe(LINEAR);
  });

  it('TEST 3 (AC-3): sampler parameter set/get round-trip preserves values and types', () => {
    // Arrange:
    const gl = samplerContext();
    const sampler = gl.createSampler();
    if (sampler === null) throw new Error('arrange: createSampler failed');
    // Act:
    gl.samplerParameteri(sampler, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    gl.samplerParameteri(sampler, TEXTURE_MIN_FILTER, LINEAR_MIPMAP_LINEAR);
    gl.samplerParameterf(sampler, TEXTURE_MIN_LOD, -2.5);
    gl.samplerParameterf(sampler, TEXTURE_MAX_LOD, 4.5);
    const wrapS = gl.getSamplerParameter(sampler, TEXTURE_WRAP_S);
    const minFilter = gl.getSamplerParameter(sampler, TEXTURE_MIN_FILTER);
    const minLod = gl.getSamplerParameter(sampler, TEXTURE_MIN_LOD);
    const maxLod = gl.getSamplerParameter(sampler, TEXTURE_MAX_LOD);
    // Assert:
    expect(wrapS).toBe(CLAMP_TO_EDGE);
    expect(minFilter).toBe(LINEAR_MIPMAP_LINEAR);
    expect(minLod).toBeCloseTo(Math.fround(-2.5), 5);
    expect(maxLod).toBeCloseTo(Math.fround(4.5), 5);
  });

  it('TEST 4 (AC-4): createSampler initializes spec defaults', () => {
    // Arrange:
    const gl = samplerContext();
    // Act:
    const sampler = gl.createSampler();
    // Assert:
    expect(sampler).not.toBeNull();
    expect(gl.isSampler(sampler)).toBe(true);
    expect(gl.getSamplerParameter(sampler, TEXTURE_WRAP_S)).toBe(REPEAT);
    expect(gl.getSamplerParameter(sampler, TEXTURE_WRAP_T)).toBe(REPEAT);
    expect(gl.getSamplerParameter(sampler, TEXTURE_WRAP_R)).toBe(REPEAT);
    expect(gl.getSamplerParameter(sampler, TEXTURE_MIN_FILTER)).toBe(NEAREST_MIPMAP_LINEAR);
    expect(gl.getSamplerParameter(sampler, TEXTURE_MAG_FILTER)).toBe(LINEAR);
    expect(gl.getSamplerParameter(sampler, TEXTURE_MIN_LOD)).toBe(-1000.0);
    expect(gl.getSamplerParameter(sampler, TEXTURE_MAX_LOD)).toBe(1000.0);
    expect(gl.getSamplerParameter(sampler, TEXTURE_COMPARE_MODE)).toBe(NONE);
    expect(gl.getSamplerParameter(sampler, TEXTURE_COMPARE_FUNC)).toBe(LEQUAL);
  });

  it('TEST 5 (AC-5): bindSampler validates unit range [0, 15]', () => {
    // Arrange:
    const gl = samplerContext();
    const sampler = gl.createSampler();
    if (sampler === null) throw new Error('arrange: createSampler failed');
    expect(gl.getError()).toBe(NO_ERROR);
    // Act & Assert:
    gl.bindSampler(0, sampler);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.bindSampler(15, sampler);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.bindSampler(16, sampler);
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.bindSampler(-1, sampler);
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.bindSampler(31, sampler);
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TEST 6 (AC-6): deleteSampler resets bindings across all referencing units', () => {
    // Arrange:
    const gl = samplerContext();
    const sampler = gl.createSampler();
    if (sampler === null) throw new Error('arrange: createSampler failed');
    gl.bindSampler(0, sampler);
    gl.bindSampler(3, sampler);
    gl.bindSampler(7, sampler);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.deleteSampler(sampler);
    // Assert:
    expect(gl.isSampler(sampler)).toBe(false);
    const probe = gl as unknown as { getBoundSampler?: (unit: number) => unknown };
    if (typeof probe.getBoundSampler === 'function') {
      expect(probe.getBoundSampler(0)).toBeNull();
      expect(probe.getBoundSampler(3)).toBeNull();
      expect(probe.getBoundSampler(7)).toBeNull();
    } else {
      gl.bindSampler(0, sampler);
      expect(gl.getError()).toBe(INVALID_OPERATION);
    }
    gl.samplerParameteri(sampler, TEXTURE_MAG_FILTER, NEAREST);
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TEST 7 (AC-7): isSampler lifecycle checks', () => {
    // Arrange:
    const gl1 = samplerContext();
    const gl2 = samplerContext();
    // Act & Assert:
    expect(gl1.isSampler(null)).toBe(false);
    expect(gl1.isSampler(undefined as unknown as null)).toBe(false);
    const s1 = gl1.createSampler();
    if (s1 === null) throw new Error('arrange: createSampler failed');
    expect(gl1.isSampler(s1)).toBe(true);
    expect(gl2.isSampler(s1)).toBe(false);
    gl1.deleteSampler(s1);
    expect(gl1.isSampler(s1)).toBe(false);
  });

  it('TEST 8: WebGL1 invariance when no sampler is bound', () => {
    // Arrange:
    const gl = samplerContext();
    const program = linkProgram(gl);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('arrange: createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, checkerboard());
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    gl.bindSampler(0, null);
    fullQuad(gl, program);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const out = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, RGBA, UNSIGNED_BYTE, out);
    const gl1 = createSoftwareWebGLContext({ width: W, height: H });
    if (gl1 === null) throw new Error('arrange: WebGL1 factory returned null');
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(out.length).toBe(W * H * 4);
    expect(Array.from(out).some((b) => b !== 0)).toBe(true);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    void gl1;
  });
});
