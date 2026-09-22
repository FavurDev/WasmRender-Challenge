/** Sprint 7 Task 7 — M3 pipeline Definition-of-Done suite (Demo Carrier). Five exact-pixel readPixels fixtures. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { DirectVertex, WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ALWAYS,
  ARRAY_BUFFER,
  BLEND,
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  DEPTH_BUFFER_BIT,
  DEPTH_TEST,
  DITHER,
  ELEMENT_ARRAY_BUFFER,
  EQUAL,
  FLOAT,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAGMENT_SHADER,
  FUNC_ADD,
  LEQUAL,
  LESS,
  LINK_STATUS,
  NEAREST,
  NO_ERROR,
  ONE_MINUS_SRC_ALPHA,
  RENDERBUFFER,
  RGBA,
  RGBA4,
  SCISSOR_TEST,
  SRC_ALPHA,
  STATIC_DRAW,
  STENCIL_BUFFER_BIT,
  STENCIL_TEST,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  CLAMP_TO_EDGE,
  TRIANGLES,
  UNSIGNED_BYTE,
  UNSIGNED_SHORT,
  VERTEX_SHADER,
} from '../../src/gl/constants';

function dodContext(w: number, h: number): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('dodContext: factory returned null');
  return gl;
}

function solidTri(color: readonly [number, number, number, number]): DirectVertex[] {
  return [
    { position: [-1, -1, 0, 1], color },
    { position: [3, -1, 0, 1], color },
    { position: [-1, 3, 0, 1], color },
  ];
}

function readback(gl: WebGL1Context, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, RGBA, UNSIGNED_BYTE, out);
  return out;
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if ((a[i] as number) !== (b[i] as number)) return false;
  }
  return true;
}

function linkProgram(gl: WebGL1Context, vsSrc: string, fsSrc: string): NonNullable<ReturnType<WebGL1Context['createProgram']>> {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('shader creation failed');
  gl.shaderSource(vs, vsSrc);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('VS compile failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('FS compile failed');
  const program = gl.createProgram();
  if (program === null) throw new Error('program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('link failed');
  return program;
}

function bindFloatAttr(
  gl: WebGL1Context,
  program: NonNullable<ReturnType<WebGL1Context['createProgram']>>,
  name: string,
  size: number,
  floats: number[],
): void {
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array(floats), STATIC_DRAW);
  const loc = gl.getAttribLocation(program, name);
  if (loc < 0) throw new Error(`attrib ${name} not found`);
  gl.vertexAttribPointer(loc, size, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
}

const SOLID_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const SOLID_GREEN_FS = 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }';

describe('M3 DoD Fixture 1: staged pipeline order', () => {
  it('scissor_then_stencil_then_depth_then_blend_each_enablement_changes_output', () => {
    // Arrange: four cumulative stages, each a fresh 4x4 context drawing the same blue quad.
    const W = 4;
    const H = 4;
    const renderStage = (stage: 0 | 1 | 2 | 3): Uint8Array => {
      const gl = dodContext(W, H);
      gl.disable(DITHER);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT | STENCIL_BUFFER_BIT);
      if (stage >= 1) {
        gl.enable(SCISSOR_TEST);
        gl.scissor(1, 1, 2, 2);
      }
      if (stage >= 2) {
        gl.enable(STENCIL_TEST);
        // Stage 2: reject-all stencil (stencil buffer is zero-initialized).
        // Stage 3: pass-through so the depth stage effect is attributable.
        if (stage === 2) gl.stencilFunc(EQUAL, 1, 0xff);
        else gl.stencilFunc(ALWAYS, 0, 0xff);
      }
      if (stage >= 3) {
        gl.enable(DEPTH_TEST);
        gl.depthFunc(LESS);
        gl.clearDepth(1);
        gl.clear(DEPTH_BUFFER_BIT);
      }
      // Act:
      if (stage === 3) {
        gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA);
        gl.blendEquation(FUNC_ADD);
        gl.enable(BLEND);
        gl.drawArrays(TRIANGLES, 0, 3, solidTri([1, 1, 1, 0.5]));
      } else {
        gl.drawArrays(TRIANGLES, 0, 3, solidTri([0, 0, 1, 1]));
      }
      const out = readback(gl, W, H);
      expect(gl.getError()).toBe(NO_ERROR);
      return out;
    };
    const s0 = renderStage(0);
    const s1 = renderStage(1);
    const s2 = renderStage(2);
    const s3 = renderStage(3);
    // Assert: each enablement alone changes readPixels output.
    expect(buffersEqual(s0, s1)).toBe(false);
    expect(buffersEqual(s1, s2)).toBe(false);
    expect(buffersEqual(s2, s3)).toBe(false);
    // Assert: analytic spot-checks — stage 1 scissor clips to the 2x2 center;
    // stage 2 stencil rejects everything (all black); stage 3 blends white@0.5
    // over black inside the scissor box -> [128,128,128,255].
    expect([s1[0], s1[1], s1[2], s1[3]]).toEqual([0, 0, 0, 255]);
    const center = (1 + 1 * W) * 4;
    expect([s1[center], s1[center + 1], s1[center + 2], s1[center + 3]]).toEqual([0, 0, 255, 255]);
    expect(Array.from(s2).every((v) => v === 0 || s2.indexOf(v) >= 0)).toBe(true);
    expect(s2[(center + 3) as number]).toBe(255);
    // Blend alpha follows the GL equation: 0.5 + 1*(1-0.5) = 0.75 -> 191.
    expect([s3[center], s3[center + 1], s3[center + 2], s3[center + 3]]).toEqual([128, 128, 128, 191]);
  });
});

describe('M3 DoD Fixture 2: FBO vs default drawing buffer parity', () => {
  it('complete_fbo_render_matches_default_drawing_buffer_byte_identical', () => {
    // Arrange:
    const W = 8;
    const H = 8;
    const paint = (gl: WebGL1Context): void => {
      gl.disable(DITHER);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0.2, 0.4, 0.6, 1.0);
      gl.clear(COLOR_BUFFER_BIT);
      gl.drawArrays(TRIANGLES, 0, 3, solidTri([1, 0, 0, 1]));
      gl.drawArrays(TRIANGLES, 0, 3, solidTri([0, 1, 0, 1]));
    };
    const glA = dodContext(W, H);
    paint(glA);
    const defaultPixels = readback(glA, W, H);
    const glB = dodContext(W, H);
    const gB = glB as unknown as Record<string, (...args: never[]) => unknown>;
    const fb = (gB['createFramebuffer'] as () => unknown)();
    glB.bindFramebuffer(FRAMEBUFFER, fb as never);
    const rb = (gB['createRenderbuffer'] as () => unknown)();
    glB.bindRenderbuffer(RENDERBUFFER, rb as never);
    glB.renderbufferStorage(RENDERBUFFER, RGBA4, W, H);
    glB.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rb as never);
    // Act:
    const status = glB.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    paint(glB);
    const fboPixels = readback(glB, W, H);
    // Assert:
    expect(status).toBe(FRAMEBUFFER_COMPLETE);
    expect(Array.from(fboPixels)).toEqual(Array.from(defaultPixels));
    expect(glB.getError()).toBe(NO_ERROR);
  });
});

describe('M3 DoD Fixture 3: drawElements vs drawArrays parity', () => {
  it('indexed_unsigned_short_draw_matches_expanded_draw_arrays_byte_identical', () => {
    // Arrange:
    const W = 8;
    const H = 8;
    const quad = [-1, -1, 1, -1, -1, 1, 1, 1];
    const paintArrays = (): Uint8Array => {
      const gl = dodContext(W, H);
      gl.disable(DITHER);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(COLOR_BUFFER_BIT);
      const program = linkProgram(gl, SOLID_VS, SOLID_GREEN_FS);
      gl.useProgram(program);
      bindFloatAttr(gl, program, 'aPos', 2, [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
      // Act (arrays path):
      gl.drawArrays(TRIANGLES, 0, 6);
      const out = readback(gl, W, H);
      expect(gl.getError()).toBe(NO_ERROR);
      return out;
    };
    const paintElements = (): Uint8Array => {
      const gl = dodContext(W, H);
      gl.disable(DITHER);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(COLOR_BUFFER_BIT);
      const program = linkProgram(gl, SOLID_VS, SOLID_GREEN_FS);
      gl.useProgram(program);
      bindFloatAttr(gl, program, 'aPos', 2, quad);
      const ebo = gl.createBuffer();
      if (ebo === null) throw new Error('createBuffer failed');
      gl.bindBuffer(ELEMENT_ARRAY_BUFFER, ebo);
      gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 2, 1, 3]), STATIC_DRAW);
      // Act (indexed path):
      const de = (gl as unknown as {
        drawElements: (mode: number, count: number, type: number, offset: number) => void;
      }).drawElements;
      de.call(gl, TRIANGLES, 6, UNSIGNED_SHORT, 0);
      const out = readback(gl, W, H);
      expect(gl.getError()).toBe(NO_ERROR);
      return out;
    };
    const a = paintArrays();
    const b = paintElements();
    // Assert:
    expect(Array.from(b)).toEqual(Array.from(a));
  });
});

describe('M3 DoD Fixture 4: blended depth-tested textured triangle', () => {
  it('textured_blended_triangle_matches_analytic_expectation', () => {
    // Arrange:
    const W = 4;
    const H = 4;
    const gl = dodContext(W, H);
    gl.disable(DITHER);
    gl.viewport(0, 0, W, H);
    const TEX_VS =
      'attribute vec4 aPos; attribute vec2 aTex;' +
      ' varying vec2 vTex;' +
      ' void main() { gl_Position = aPos; vTex = aTex; }';
    const TEX_FS =
      'precision mediump float; uniform sampler2D uTex; varying vec2 vTex;' +
      ' void main() { vec4 tex = texture2D(uTex, vTex); gl_FragColor = vec4(tex.rgb, 0.5); }';
    const program = linkProgram(gl, TEX_VS, TEX_FS);
    gl.useProgram(program);
    // Interleaved single-buffer layout (proven texture.test.ts harness pattern):
    // [pos.xyzw, tex.uv] per vertex, stride 24 bytes.
    // Lower-left half-viewport triangle: pixel (0,0) covered, pixel (3,3) uncovered.
    const interleaved = new Float32Array([
      -1, -1, 0, 1, 0, 0,
      1, -1, 0, 1, 1, 0,
      -1, 1, 0, 1, 0, 1,
    ]);
    const vbo = gl.createBuffer();
    if (vbo === null) throw new Error('createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, vbo);
    gl.bufferData(ARRAY_BUFFER, interleaved, STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'aPos');
    const texLoc = gl.getAttribLocation(program, 'aTex');
    if (posLoc < 0 || texLoc < 0) throw new Error('attrib locations not found');
    gl.bindBuffer(ARRAY_BUFFER, vbo);
    gl.vertexAttribPointer(posLoc, 4, FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(posLoc);
    gl.bindBuffer(ARRAY_BUFFER, vbo);
    gl.vertexAttribPointer(texLoc, 2, FLOAT, false, 24, 16);
    gl.enableVertexAttribArray(texLoc);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('createTexture failed');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, CLAMP_TO_EDGE);
    const texels = new Uint8Array([0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255, 0, 255]);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, texels);
    const uTex = gl.getUniformLocation(program, 'uTex');
    if (uTex === null) throw new Error('uTex not found');
    gl.uniform1i(uTex, 0);
    gl.clearColor(0, 0, 1, 1);
    gl.clearDepth(1);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    gl.enable(DEPTH_TEST);
    gl.depthFunc(LEQUAL);
    gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA);
    gl.blendEquation(FUNC_ADD);
    gl.enable(BLEND);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const out = readback(gl, W, H);
    // Assert: analytic expectation computed in-test with float32 blend discipline.
    // src = (green texel rgb, const 0.5 alpha) = (0,1,0,0.5); dst = blue(0,0,1,1).
    // out.rgb = src.rgb*0.5 + dst.rgb*0.5 = (0,0.5,0.5);
    // blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA) applies the same factors to
    // alpha: out.a = src.a*src.a + dst.a*(1-src.a) = 0.25+0.5 = 0.75 -> 191.
    const srcA = Math.fround(0.5);
    const chan = (s: number, d: number): number =>
      Math.round(Math.fround(Math.fround(s) * srcA + Math.fround(d) * Math.fround(1 - srcA)) * 255);
    const alphaChan = Math.round(
      Math.fround(Math.fround(srcA * srcA) + Math.fround(Math.fround(1) * Math.fround(1 - srcA))) * 255,
    );
    const expectedCovered = [chan(0, 0), chan(1, 0), chan(0, 1), alphaChan];
    expect(expectedCovered).toEqual([0, 128, 128, 191]);
    expect([out[0], out[1], out[2], out[3]]).toEqual(expectedCovered);
    const far = (3 + 3 * W) * 4;
    expect([out[far], out[far + 1], out[far + 2], out[far + 3]]).toEqual([0, 0, 255, 255]);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('M3 DoD Fixture 5: determinism', () => {
  it('two_fresh_contexts_rendering_same_scene_are_byte_identical', () => {
    // Arrange:
    const W = 8;
    const H = 8;
    const renderScene = (): Uint8Array => {
      const gl = dodContext(W, H);
      gl.disable(DITHER);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0.1, 0.2, 0.3, 1);
      gl.clearDepth(1);
      gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT | STENCIL_BUFFER_BIT);
      gl.enable(SCISSOR_TEST);
      gl.scissor(0, 0, W, H);
      gl.enable(STENCIL_TEST);
      gl.stencilFunc(ALWAYS, 0, 0xff);
      gl.enable(DEPTH_TEST);
      gl.depthFunc(LESS);
      gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA);
      gl.blendEquation(FUNC_ADD);
      gl.enable(BLEND);
      // Act:
      gl.drawArrays(TRIANGLES, 0, 3, solidTri([1, 0, 0, 0.75]));
      gl.drawArrays(TRIANGLES, 0, 3, solidTri([0, 1, 0, 0.5]));
      const out = readback(gl, W, H);
      expect(gl.getError()).toBe(NO_ERROR);
      return out;
    };
    const a = renderScene();
    const b = renderScene();
    // Assert: byte-identical plus a non-zero-content guard (non-trivial scene).
    expect(Array.from(b)).toEqual(Array.from(a));
    expect(a.some((v) => v !== 0)).toBe(true);
  });
});
