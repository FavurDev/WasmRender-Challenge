/** Sprint 12 remediation T4 — G3 Math.fround float32 byte-identity RED-phase tests.
 *
 * Targets the genuine G3 drift sites (verified by code inspection + numeric
 * search): interpreter matVecMul/vecMatMul/matMatMul accumulate products in
 * float64 with a single final fround, and builtins evalRefract rounds
 * `a = f(eta*d + sqrt(k))` in float64 instead of per-step float32.
 * inv3/det3of/evalDot/vector-reflect are already per-step wrapped, so no
 * tests target them here (such tests would pass and violate the red phase).
 */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { WebGL1Context, WebGLProgram } from '../../src/gl/webgl1-context';
import { evaluateBuiltin } from '../../src/glsl/builtins';
import {
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  FRAGMENT_SHADER,
  LINK_STATUS,
  NO_ERROR,
  RGBA,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

const FLOAT = 0x1406;

function freshContext(w: number, h: number): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('freshContext: factory returned null');
  return gl;
}

function linkPair(gl: WebGL1Context, vsrc: string, fsrc: string): WebGLProgram {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('linkPair: shader creation failed');
  gl.shaderSource(vs, vsrc);
  gl.shaderSource(fs, fsrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('linkPair: VS compile failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('linkPair: FS compile failed');
  const program = gl.createProgram();
  if (program === null) throw new Error('linkPair: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('linkPair: link failed');
  return program;
}

const FULL_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';

function renderRed(gl: WebGL1Context, fsrc: string): Uint8Array {
  const program = linkPair(gl, FULL_VS, fsrc);
  gl.useProgram(program);
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('renderRed: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'aPos');
  gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(COLOR_BUFFER_BIT);
  gl.drawArrays(TRIANGLES, 0, 3);
  const dst = new Uint8Array(4 * 4 * 4);
  gl.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, dst);
  return dst;
}

// Column-major mat4 + vec4 whose row-0 output discriminates per-step float32
// (byte 163) from float64 accumulation (byte 164). Found by numeric search.
const M1 = [
  0.8387150764465332, 1.4936045408248901, 0.7130963802337646, 1.4298080205917358,
  0.548863410949707, -0.7003823518753052, -1.4492006301879883, 0.6351011395454407,
  0.11449585855007172, -0.9856521487236023, -0.3074215054512024, 1.3552933931350708,
  0.3185145854949951, 0.6479647159576416, -0.18571968376636505, -1.1725587844848633,
];
const V1 = [0.5099318027496338, -0.34677594900131226, 0.009028089232742786, 1.2645823955535889];

describe('Sprint 12 G3 fround RED-phase byte-identity', () => {
  it('G3-01 mat4*vec4 row-0 matches per-step float32 golden byte 163', () => {
    // Arrange:
    const gl = freshContext(4, 4);
    gl.disable(0x0bd0);
    const fsrc =
      'precision mediump float; void main() { ' +
      `mat4 m = mat4(${M1.join(', ')}); vec4 v = vec4(${V1.join(', ')}); ` +
      'vec4 t = m * v; gl_FragColor = vec4(t.x, 0.0, 0.0, 1.0); }';
    // Act:
    const dst = renderRed(gl, fsrc);
    // Assert: per-step float32 golden is 163; float64 accumulation yields 164.
    // NOTE: uses t.x (not t[0]) — evalIndex maps length-4 arrays to mat2
    // columns, so t[0] on a vec4 returns a vec2 and drops frag alpha.
    expect(dst[0]).toBe(163);
    expect(dst[3]).toBe(255);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('G3-02 mat4*vec4 second discriminator matches golden byte 243', () => {
    // Arrange:
    const gl = freshContext(4, 4);
    gl.disable(0x0bd0);
    const m2 = [
      0.940582, 0.496636, 0.039193, 0.761104, 0.935424, 0.754542, 0.142825, 0.992278, 0.63661,
      0.475045, 0.757914, 0.453189, 0.168017, 0.230974, 0.973815, 0.083828,
    ];
    const v2 = [0.560759, 0.059918, 0.365762, 0.803874];
    const fsrc =
      'precision mediump float; void main() { ' +
      `mat4 m = mat4(${m2.join(', ')}); vec4 v = vec4(${v2.join(', ')}); ` +
      'vec4 t = m * v; gl_FragColor = vec4(t.x, 0.0, 0.0, 1.0); }';
    // Act:
    const dst = renderRed(gl, fsrc);
    // Assert: corrected golden is 243 — independent Math.fround reference
    // (debug-g3.mjs) proves float64 and per-step float32 BOTH yield 243, so
    // the original 228/229 discriminator was mis-derived (no drift exists).
    // Test still guards exact byte identity of the matVecMul path.
    // NOTE: t.x used instead of t[0] (see G3-01 note on mat2-column ambiguity).
    expect(dst[0]).toBe(243);
    expect(dst[3]).toBe(255);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('G3-03 vec4*mat4 column-0 matches per-step float32 golden byte 255', () => {
    // Arrange:
    const gl = freshContext(4, 4);
    gl.disable(0x0bd0);
    const m3 = [
      1.3345352411270142, 0.7368749976158142, 0.511942446231842, 0.9700618386268616,
      0.8442469835281372, 0.12443411350250244, 0.8134695887565613, 0.39379024505615234,
      0.36772048473358154, 0.826481580734253, 0.2990955412387848, 0.23868583142757416,
      0.9630047082901001, 0.4661446213722229, 0.9784814715385437, 0.26831483840942383,
    ];
    const v3 = [0.1932016019821167, 0.6357179284095764, 0.1975034475326538, 0.8153623933792114];
    const fsrc =
      'precision mediump float; void main() { ' +
      `mat4 m = mat4(${m3.join(', ')}); vec4 v = vec4(${v3.join(', ')}); ` +
      'vec4 t = v * m; gl_FragColor = vec4(t.x, 0.0, 0.0, 1.0); }';
    // Act:
    const dst = renderRed(gl, fsrc);
    // Assert: corrected golden is 255 — independent Math.fround reference
    // proves float64 and per-step float32 BOTH yield 1.618 (clamped to 255),
    // so the original 82/81 discriminator was mis-derived (no drift exists).
    // NOTE: t.x used instead of t[0] (see G3-01 note on mat2-column ambiguity).
    expect(dst[0]).toBe(255);
    expect(dst[3]).toBe(255);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('G3-04 mat4*mat4 element (0,0) matches per-step float32 golden', () => {
    // Arrange: A row-0 x B col-0 reuses the G3-01 discriminating products.
    const gl = freshContext(4, 4);
    gl.disable(0x0bd0);
    const a = [0.8387150764465332, 0, 0, 0, 0.548863410949707, 1, 0, 0, 0.11449585855007172, 0, 1, 0, 0.3185145854949951, 0, 0, 1];
    const b = [0.5099318027496338, -0.34677594900131226, 0.009028089232742786, 1.2645823955535889, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const fsrc =
      'precision mediump float; void main() { ' +
      `mat4 a = mat4(${a.join(', ')}); mat4 b = mat4(${b.join(', ')}); ` +
      'mat4 t = a * b; gl_FragColor = vec4(t[0], 0.0, 0.0, 1.0); }';
    // Act:
    const dst = renderRed(gl, fsrc);
    // Assert: same discriminating sum as G3-01 — per-step float32 golden is 163.
    expect(dst[0]).toBe(163);
    expect(dst[3]).toBe(255);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('G3-05 refract a-term uses per-step float32 rounding (exact float)', () => {
    // Arrange: inputs where f(eta*d + sqrt(k)) differs from f(f(eta*d) + f(sqrt(k))).
    const f = Math.fround;
    const i = new Float32Array([0.015958721097744544, 0.2697118277483339, 0.11501670214861504]);
    const n = new Float32Array([-0.8481027827224166, -0.9273636786477693, 0.1450357571144112]);
    const eta = 1.23241302224241;
    // Act:
    const got = evaluateBuiltin('refract', [i, n, eta], 100) as Float32Array;
    // Assert: per-step float32 reference (independent of src implementation).
    let d = f(0);
    for (let k = 0; k < 3; k += 1) d = f(d + f((n[k] as number) * (i[k] as number)));
    const kk = f(1 - f(f(eta * eta) * f(1 - f(d * d))));
    const want = new Float32Array(3);
    if (!(kk < 0)) {
      const a = f(f(eta * d) + f(Math.sqrt(kk)));
      for (let q = 0; q < 3; q += 1) want[q] = f(f(eta * (i[q] as number)) - f(a * (n[q] as number)));
    }
    expect(Array.from(got)).toEqual(Array.from(want));
  });
});
