/** Sprint 9 Task 6 determinism lockdown suite (TDD red phase) — cross-context byte-identity, static bundle scan, fround audit. */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ARRAY_BUFFER,
  BLEND,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  DEPTH_BUFFER_BIT,
  DEPTH_TEST,
  FLOAT,
  FRAGMENT_SHADER,
  FUNC_ADD,
  LEQUAL,
  LESS,
  LINK_STATUS,
  NEAREST,
  NO_ERROR,
  RGBA,
  SCISSOR_TEST,
  SRC_ALPHA,
  ONE_MINUS_SRC_ALPHA,
  STATIC_DRAW,
  TEXTURE0,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

const D_VS =
  'attribute vec2 a_position; attribute vec2 a_texCoord; varying vec2 v_texCoord; ' +
  'void main() { v_texCoord = a_texCoord; gl_Position = vec4(a_position, 0.0, 1.0); }';
const D_FS =
  'precision mediump float; varying vec2 v_texCoord; uniform sampler2D u_sampler; ' +
  'void main() { gl_FragColor = texture2D(u_sampler, v_texCoord); }';
const D_FLAT_FS =
  'precision mediump float; uniform vec4 u_color; void main() { gl_FragColor = u_color; }';

function dCtx(w: number, h: number): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('dCtx: factory returned null');
  return gl;
}

function dLink(gl: WebGL1Context, fsrc: string = D_FS): NonNullable<ReturnType<WebGL1Context['createProgram']>> {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('dLink: shader creation failed');
  gl.shaderSource(vs, D_VS);
  gl.shaderSource(fs, fsrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('dLink: VS failed: ' + gl.getShaderInfoLog(vs));
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('dLink: FS failed: ' + gl.getShaderInfoLog(fs));
  const program = gl.createProgram();
  if (program === null) throw new Error('dLink: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('dLink: link failed: ' + gl.getProgramInfoLog(program));
  return program;
}

function dTexturedQuad(gl: WebGL1Context, program: NonNullable<ReturnType<WebGL1Context['createProgram']>>): void {
  const posBuf = gl.createBuffer();
  const texBuf = gl.createBuffer();
  if (posBuf === null || texBuf === null) throw new Error('dTexturedQuad: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, posBuf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
  gl.bindBuffer(ARRAY_BUFFER, texBuf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), STATIC_DRAW);
  gl.useProgram(program);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  const texLoc = gl.getAttribLocation(program, 'a_texCoord');
  if (posLoc < 0 || texLoc < 0) throw new Error('dTexturedQuad: attrib locations not found');
  gl.bindBuffer(ARRAY_BUFFER, posBuf);
  gl.vertexAttribPointer(posLoc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posLoc);
  gl.bindBuffer(ARRAY_BUFFER, texBuf);
  gl.vertexAttribPointer(texLoc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(texLoc);
  const samplerLoc = gl.getUniformLocation(program, 'u_sampler');
  if (samplerLoc === null) throw new Error('dTexturedQuad: u_sampler location null');
  gl.uniform1i(samplerLoc, 0);
}

function dFlatQuad(gl: WebGL1Context, program: NonNullable<ReturnType<WebGL1Context['createProgram']>>, color: [number, number, number, number]): void {
  const posBuf = gl.createBuffer();
  if (posBuf === null) throw new Error('dFlatQuad: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, posBuf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
  gl.useProgram(program);
  const posLoc = gl.getAttribLocation(program, 'a_position');
  if (posLoc < 0) throw new Error('dFlatQuad: a_position not found');
  gl.vertexAttribPointer(posLoc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(posLoc);
  const colorLoc = gl.getUniformLocation(program, 'u_color');
  if (colorLoc === null) throw new Error('dFlatQuad: u_color location null');
  gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3]);
}

function renderComposite(gl: WebGL1Context): Uint8Array {
  const program = dLink(gl);
  const tex = gl.createTexture();
  if (tex === null) throw new Error('renderComposite: createTexture failed');
  gl.activeTexture(TEXTURE0);
  gl.bindTexture(TEXTURE_2D, tex);
  const data = new Uint8Array(8 * 8 * 4);
  for (let i = 0; i < 64; i += 1) data.set([(i * 37) % 256, (i * 91) % 256, (i * 53) % 256, 200], i * 4);
  gl.texImage2D(TEXTURE_2D, 0, RGBA, 8, 8, 0, RGBA, UNSIGNED_BYTE, data);
  gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
  gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
  dTexturedQuad(gl, program);
  gl.viewport(0, 0, 64, 64);
  gl.enable(BLEND);
  gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA);
  gl.blendEquation(FUNC_ADD);
  gl.enable(DEPTH_TEST);
  gl.depthFunc(LESS);
  gl.clearDepth(1);
  gl.clearColor(0.1, 0.2, 0.3, 1);
  gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
  gl.enable(SCISSOR_TEST);
  gl.scissor(0, 0, 64, 64);
  gl.drawArrays(TRIANGLES, 0, 3);
  gl.disable(SCISSOR_TEST);
  const out = new Uint8Array(64 * 64 * 4);
  gl.readPixels(0, 0, 64, 64, RGBA, UNSIGNED_BYTE, out);
  if (gl.getError() !== NO_ERROR) throw new Error('renderComposite: error recorded');
  return out;
}

/** Shared scanner mirroring scripts/build-renderer.mjs assertDeterminism regexes. */
export function scanCodeForDeterminism(text: string): void {
  if (/Math\.random/.test(text)) throw new Error('NONDETERMINISM: code contains Math.random');
  if (/Date\.now\s*\(/.test(text)) throw new Error('NONDETERMINISM: code contains Date.now()');
  if (/performance\.now\s*\(/.test(text)) throw new Error('NONDETERMINISM: code contains performance.now()');
}

function resolveBundlePath(): string {
  const candidates = [
    process.platform === 'win32' ? 'C:/app/renderer.js' : '/app/renderer.js',
    resolve('app/renderer.js'),
    resolve('dist/renderer.js'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`RENDERER_NOT_FOUND: no bundle at ${candidates.join(', ')} — run "npm run build" first`);
}

const AUDIT_FILES = [
  'src/raster/rasterizer.ts',
  'src/raster/blend.ts',
  'src/raster/clipper.ts',
  'src/raster/depth-stencil.ts',
  'src/raster/interpolate.ts',
  'src/glsl/interpreter.ts',
];

function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}

describe('Sprint 9 Task 6 determinism lockdown', () => {
  it('two_independent_contexts_rendering_composite_scene_are_byte_identical', () => {
    // Arrange: two independently created 64x64 contexts.
    const glA = dCtx(64, 64);
    const glB = dCtx(64, 64);
    // Act: render texture+blend+depth composite scene in each.
    const pxA = renderComposite(glA);
    const pxB = renderComposite(glB);
    // Assert: byte-identical readPixels, non-trivial output.
    expect(Array.from(pxA)).toEqual(Array.from(pxB));
    expect(Array.from(pxA).some((b) => b !== 0)).toBe(true);
  });

  it('in_process_sequential_double_render_is_byte_identical', () => {
    // Arrange: one context, composite scene setup.
    const gl = dCtx(64, 64);
    const first = renderComposite(gl);
    // Act: render the same scene again sequentially in the same context.
    const second = renderComposite(gl);
    expect(gl.getError()).toBe(NO_ERROR);
    // Assert: sequential renders are byte-identical and non-trivial.
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(Array.from(first).some((b) => b !== 0)).toBe(true);
  });

  it('static_bundle_scan_rejects_forbidden_clocks_and_randomness', () => {
    // Arrange: locate the built bundle per project layout.
    const bundlePath = resolveBundlePath();
    // Act: read bundle text and run the shared scanner.
    const text = readFileSync(bundlePath, 'utf8');
    // Assert: no forbidden clocks/randomness (throws on violation).
    expect(() => scanCodeForDeterminism(text)).not.toThrow();
  });

  it('static_scan_live_gate_proof_fails_on_seeded_nondeterminism', () => {
    // Arrange: seeded synthetic violations, one per forbidden API.
    const seeds = ['const x = Math.random();', 'const t = Date.now();', 'const p = performance.now();'];
    // Act + Assert: the SAME scanner used for the real bundle must reject each seed.
    for (const seed of seeds) {
      expect(() => scanCodeForDeterminism(seed)).toThrow(/NONDETERMINISM/);
    }
    expect(() => scanCodeForDeterminism('const ok = Math.fround(0.5);')).not.toThrow();
  });

  it('pipeline_arithmetic_fround_and_integer_quantization_audit', () => {
    // Arrange: read the six audited source files.
    const root = repoRoot();
    const texts = AUDIT_FILES.map((f) => ({ file: f, text: readFileSync(resolve(root, f), 'utf8') }));
    // Act + Assert: no forbidden clock/random APIs anywhere.
    for (const { file, text } of texts) {
      expect(text, `${file} must not contain Math.random`).not.toMatch(/Math\.random/);
      expect(text, `${file} must not contain Date.now()`).not.toMatch(/Date\.now\s*\(/);
      expect(text, `${file} must not contain performance.now()`).not.toMatch(/performance\.now\s*\(/);
    }
    // Assert: float arithmetic is fround-normalized per Unit 1 audit classification.
    // Float-path files must reference Math.fround; the integer depth/stencil path
    // (bit-mask + >>> 0 quantization, no float arithmetic) must show integer
    // quantization evidence instead.
    const FLOAT_PATH_FILES = AUDIT_FILES.filter((f) => f !== 'src/raster/depth-stencil.ts');
    for (const { file, text } of texts) {
      if (file === 'src/raster/depth-stencil.ts') {
        expect(text, `${file} integer path must use >>> 0 quantization`).toMatch(/>>> 0/);
      } else {
        expect(FLOAT_PATH_FILES, `${file} must be a classified float path`).toContain(file);
        expect(text, `${file} must be fround-normalized (Math.fround)`).toMatch(/Math\.fround/);
      }
    }
  });

  it('shared_edge_quad_determinism', () => {
    // Arrange: two adjacent triangles sharing the diagonal edge [-1,-1] to [1,1].
    const renderTrianglesOrder = (reverseOrder: boolean): Uint8Array => {
      const gl = dCtx(16, 16);
      const vsSrc =
        'attribute vec2 a_position; void main() { gl_Position = vec4(a_position, 0.0, 1.0); }';
      const vs = gl.createShader(VERTEX_SHADER);
      const fs = gl.createShader(FRAGMENT_SHADER);
      if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
      gl.shaderSource(vs, vsSrc);
      gl.shaderSource(fs, D_FLAT_FS);
      gl.compileShader(vs);
      gl.compileShader(fs);
      const program = gl.createProgram();
      if (program === null) throw new Error('arrange: program creation failed');
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      const t1 = [-1, -1, 1, -1, 1, 1];
      const t2 = [-1, -1, 1, 1, -1, 1];
      const combined = reverseOrder ? [...t2, ...t1] : [...t1, ...t2];
      const pos = new Float32Array(combined);
      const buf = gl.createBuffer();
      if (buf === null) throw new Error('arrange: createBuffer failed');
      gl.bindBuffer(ARRAY_BUFFER, buf);
      gl.bufferData(ARRAY_BUFFER, pos, STATIC_DRAW);
      gl.useProgram(program);
      const loc = gl.getAttribLocation(program, 'a_position');
      gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(loc);
      const cl = gl.getUniformLocation(program, 'u_color');
      if (cl === null) throw new Error('arrange: u_color null');
      gl.uniform4f(cl, 0.5, 0.25, 0.75, 1);
      gl.viewport(0, 0, 16, 16);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(COLOR_BUFFER_BIT);
      // Act:
      gl.drawArrays(TRIANGLES, 0, 6);
      const out = new Uint8Array(16 * 16 * 4);
      gl.readPixels(0, 0, 16, 16, RGBA, UNSIGNED_BYTE, out);
      return out;
    };
    // Act: render as [T1,T2] and as [T2,T1] (flipped submission order).
    const a = renderTrianglesOrder(false);
    const b = renderTrianglesOrder(true);
    // Assert: flipped submission order is byte-identical and non-trivial.
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a).some((b) => b !== 0)).toBe(true);
  });

  it('depth_reversal_invariance_determinism', () => {
    // Arrange: overlapping Near (z=-0.5, green) and Far (z=0.5, red) triangles.
    const renderOverlappingTriangles = (depthFuncCode: number, drawNearFirst: boolean): Uint8Array => {
      const gl = dCtx(16, 16);
      const vsSrc =
        'attribute vec3 a_position; void main() { gl_Position = vec4(a_position, 1.0); }';
      const vs = gl.createShader(VERTEX_SHADER);
      const fs = gl.createShader(FRAGMENT_SHADER);
      if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
      gl.shaderSource(vs, vsSrc);
      gl.shaderSource(fs, D_FLAT_FS);
      gl.compileShader(vs);
      gl.compileShader(fs);
      const program = gl.createProgram();
      if (program === null) throw new Error('arrange: program creation failed');
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      const nearBuf = gl.createBuffer();
      const farBuf = gl.createBuffer();
      if (nearBuf === null || farBuf === null) throw new Error('arrange: createBuffer failed');
      gl.bindBuffer(ARRAY_BUFFER, nearBuf);
      gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, -0.5, 1, -1, -0.5, 0, 1, -0.5]), STATIC_DRAW);
      gl.bindBuffer(ARRAY_BUFFER, farBuf);
      gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 0.5, 1, -1, 0.5, 0, 1, 0.5]), STATIC_DRAW);
      gl.viewport(0, 0, 16, 16);
      gl.enable(DEPTH_TEST);
      gl.depthFunc(depthFuncCode);
      gl.clearDepth(1);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
      gl.useProgram(program);
      const loc = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(loc);
      const cl = gl.getUniformLocation(program, 'u_color');
      if (cl === null) throw new Error('arrange: u_color null');
      const drawNear = (): void => {
        gl.bindBuffer(ARRAY_BUFFER, nearBuf);
        gl.vertexAttribPointer(loc, 3, FLOAT, false, 0, 0);
        gl.uniform4f(cl, 0, 1, 0, 1);
        gl.drawArrays(TRIANGLES, 0, 3);
      };
      const drawFar = (): void => {
        gl.bindBuffer(ARRAY_BUFFER, farBuf);
        gl.vertexAttribPointer(loc, 3, FLOAT, false, 0, 0);
        gl.uniform4f(cl, 1, 0, 0, 1);
        gl.drawArrays(TRIANGLES, 0, 3);
      };
      // Act: draw in the requested submission order.
      if (drawNearFirst) {
        drawNear();
        drawFar();
      } else {
        drawFar();
        drawNear();
      }
      const out = new Uint8Array(16 * 16 * 4);
      gl.readPixels(0, 0, 16, 16, RGBA, UNSIGNED_BYTE, out);
      return out;
    };
    // Assert: for each depth func both orders are byte-identical and near wins.
    for (const testFunc of [LESS, LEQUAL]) {
      const nearFirst = renderOverlappingTriangles(testFunc, true);
      const farFirst = renderOverlappingTriangles(testFunc, false);
      expect(Array.from(nearFirst)).toEqual(Array.from(farFirst));
      const idx = (8 * 16 + 8) * 4;
      expect(nearFirst[idx]).toBe(0);
      expect(nearFirst[idx + 1] > 200).toBe(true);
      expect(farFirst[idx]).toBe(0);
      expect(farFirst[idx + 1] > 200).toBe(true);
    }
  });

  it('subnormal_and_extreme_float_determinism', () => {
    // Arrange: degenerate vertex coordinates with subnormal (1e-40) and extreme (1e30) floats.
    const renderExtreme = (): Uint8Array => {
      const gl = dCtx(8, 8);
      const program = dLink(gl, D_FLAT_FS);
      const posBuf = gl.createBuffer();
      if (posBuf === null) throw new Error('arrange: createBuffer failed');
      gl.bindBuffer(ARRAY_BUFFER, posBuf);
      gl.bufferData(ARRAY_BUFFER, new Float32Array([1e-40, 1e-40, 1e30, -1e30, -1e30, 1e-40]), STATIC_DRAW);
      gl.useProgram(program);
      const loc = gl.getAttribLocation(program, 'a_position');
      if (loc < 0) throw new Error('arrange: a_position not found');
      gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(loc);
      const cl = gl.getUniformLocation(program, 'u_color');
      if (cl === null) throw new Error('arrange: u_color null');
      gl.uniform4f(cl, 1, 0, 0, 1);
      gl.viewport(0, 0, 8, 8);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(COLOR_BUFFER_BIT);
      // Act:
      gl.drawArrays(TRIANGLES, 0, 3);
      const out = new Uint8Array(8 * 8 * 4);
      gl.readPixels(0, 0, 8, 8, RGBA, UNSIGNED_BYTE, out);
      return out;
    };
    const a = renderExtreme();
    const b = renderExtreme();
    // Assert: framebuffers byte-identical; fround/finite clamps prevent platform float divergence.
    expect(Array.from(a)).toEqual(Array.from(b));
  });
});
