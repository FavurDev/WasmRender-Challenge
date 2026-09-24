/** Sprint 11 Task 3 TD-024/G3 float-edge TDD RED-phase tests — blueprint-conformant suite. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import * as C from '../../src/gl/constants';
import type { WebGL1Context } from '../../src/gl/webgl1-context';
import type { DirectVertex } from '../../src/gl/webgl1-context';
import {
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  FLOAT,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  INVALID_VALUE,
  LINK_STATUS,
  NO_ERROR,
  RGBA,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

const RED_BITS = 0x0d52;
const GREEN_BITS = 0x0d53;
const BLUE_BITS = 0x0d54;
const ALPHA_BITS = 0x0d55;
const DEPTH_BITS = 0x0d56;
const STENCIL_BITS = 0x0d57;

function freshContext(w: number, h: number): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('freshContext: factory returned null');
  return gl;
}

function linkPair(gl: WebGL1Context, vsrc: string, fsrc: string) {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('linkPair: shader creation failed');
  gl.shaderSource(vs, vsrc);
  gl.shaderSource(fs, fsrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('linkPair: VS failed: ' + gl.getShaderInfoLog(vs));
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('linkPair: FS failed: ' + gl.getShaderInfoLog(fs));
  const program = gl.createProgram();
  if (program === null) throw new Error('linkPair: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('linkPair: link failed: ' + gl.getProgramInfoLog(program));
  return { program };
}

const FULL_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';

describe('TD-024 and G3 Float-Edge Fixes (red phase)', () => {
  it('T01_named_bit_depth_constants_match_glenum_values', () => {
    // Arrange: namespace import of constants module.
    // Act: read the six bit-depth exports.
    const vals = [C.RED_BITS, C.GREEN_BITS, C.BLUE_BITS, C.ALPHA_BITS, C.DEPTH_BITS, C.STENCIL_BITS];
    // Assert:
    expect(vals).toEqual([RED_BITS, GREEN_BITS, BLUE_BITS, ALPHA_BITS, DEPTH_BITS, STENCIL_BITS]);
  });

  it('T02_getParameter_bit_depths_return_8_8_8_8_24_8', () => {
    // Arrange:
    const gl = freshContext(64, 64);
    // Act:
    const r = gl.getParameter(RED_BITS) as unknown as number;
    const g = gl.getParameter(GREEN_BITS) as unknown as number;
    const b = gl.getParameter(BLUE_BITS) as unknown as number;
    const a = gl.getParameter(ALPHA_BITS) as unknown as number;
    const d = gl.getParameter(DEPTH_BITS) as unknown as number;
    const s = gl.getParameter(STENCIL_BITS) as unknown as number;
    // Assert:
    expect([r, g, b, a]).toEqual([8, 8, 8, 8]);
    expect(d).toBe(24);
    expect(s).toBe(8);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T03_readPixels_dual_fault_invalid_format_oob_records_invalid_enum', () => {
    // Arrange:
    const gl = freshContext(64, 64);
    const dst = new Uint8Array(16);
    // Act:
    gl.readPixels(-10, -10, 100, 100, 0x1234, UNSIGNED_BYTE, dst);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T04_readPixels_dual_fault_invalid_type_oob_records_invalid_enum', () => {
    // Arrange:
    const gl = freshContext(64, 64);
    const dst = new Uint8Array(16);
    // Act:
    gl.readPixels(-5, -5, 200, 200, RGBA, 0x5678, dst);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T05_readPixels_single_fault_invalid_format_records_invalid_enum', () => {
    // Arrange:
    const gl = freshContext(64, 64);
    const dst = new Uint8Array(4 * 4 * 4);
    // Act:
    gl.readPixels(0, 0, 4, 4, 0x9999, UNSIGNED_BYTE, dst);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T06_readPixels_single_fault_oob_records_invalid_value', () => {
    // Arrange:
    const gl = freshContext(64, 64);
    const dst = new Uint8Array(4 * 4 * 4);
    // Act:
    gl.readPixels(-10, 0, 4, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T07_readPixels_negative_dimension_records_invalid_value', () => {
    // Arrange:
    const gl = freshContext(64, 64);
    const dst = new Uint8Array(16);
    // Act:
    gl.readPixels(0, 0, -4, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T08_readPixels_null_destination_records_invalid_value', () => {
    // Arrange:
    const gl = freshContext(64, 64);
    // Act:
    gl.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, null as unknown as ArrayBufferView);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T09_g3_float32_shader_evaluation_byte_identity', () => {
    // Arrange:
    const gl = freshContext(4, 4);
    const fsrc = 'precision mediump float; void main() { gl_FragColor = vec4(0.5 - 0.000000001, 0.0, 0.0, 1.0); }';
    const { program } = linkPair(gl, FULL_VS, fsrc);
    gl.useProgram(program);
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const dst = new Uint8Array(4 * 4 * 4);
    gl.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert: float32(0.5 - 1e-9) rounds to byte 128; double-precision drift would give 127.
    expect(dst[0]).toBe(128);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T10_g3_rasterizer_diagonal_quad_deterministic_coverage', () => {
    // Arrange:
    const gl = freshContext(64, 64);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const red: readonly [number, number, number, number] = [1, 0, 0, 1];
    const q: DirectVertex[] = [
      { position: [-1, -1, 0, 1], color: red },
      { position: [1, -1, 0, 1], color: red },
      { position: [1, 1, 0, 1], color: red },
      { position: [-1, -1, 0, 1], color: red },
      { position: [1, 1, 0, 1], color: red },
      { position: [-1, 1, 0, 1], color: red },
    ];
    // Act:
    gl.drawArrays(TRIANGLES, 0, 6, q);
    const dst = new Uint8Array(4 * 64 * 64);
    gl.readPixels(0, 0, 64, 64, RGBA, UNSIGNED_BYTE, dst);
    // Assert: full-screen quad covers every pixel deterministically with no gaps.
    for (let i = 0; i < 64 * 64; i++) {
      const o = i * 4;
      expect(dst[o]).toBe(255);
      expect(dst[o + 3]).toBe(255);
    }
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
