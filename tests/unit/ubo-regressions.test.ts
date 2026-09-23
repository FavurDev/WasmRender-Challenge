/** Sprint 9 Task 7 TD-021/TD-022 regression tests (TDD RED phase). Real linked programs only. */
import { describe, expect, it } from 'vitest';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import {
  COMPILE_STATUS,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  LINK_STATUS,
  NO_ERROR,
  UNIFORM_ARRAY_STRIDE,
  UNIFORM_BUFFER,
  UNIFORM_MATRIX_STRIDE,
  UNIFORM_OFFSET,
  VERTEX_SHADER,
} from '../../src/gl/constants';

type LinkedProgram = NonNullable<ReturnType<WebGL2Context['createProgram']>>;

const VS_SCENE =
  '#version 300 es\nlayout(std140) uniform Scene {\n  float u_a;\n  vec3 u_b;\n  mat4 u_c;\n  float u_d[3];\n};\nin vec4 a_pos;\nvoid main() {\n  gl_Position = a_pos;\n}';
const FS_SIMPLE =
  '#version 300 es\nprecision mediump float;\nout vec4 o_color;\nvoid main() {\n  o_color = vec4(1.0);\n}';

function freshCtx(): WebGL2Context {
  return new WebGL2Context({ width: 4, height: 4 });
}

function linkSceneProgram(gl: WebGL2Context): LinkedProgram {
  // Arrange: compile real shaders carrying the Scene uniform block.
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
  gl.shaderSource(vs, VS_SCENE);
  gl.shaderSource(fs, FS_SIMPLE);
  gl.compileShader(vs);
  gl.compileShader(fs);
  expect(gl.getShaderParameter(vs, COMPILE_STATUS)).toBe(true);
  expect(gl.getShaderParameter(fs, COMPILE_STATUS)).toBe(true);
  const program = gl.createProgram();
  if (program === null) throw new Error('arrange: createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  expect(gl.getProgramParameter(program, LINK_STATUS)).toBe(true);
  return program;
}

describe('Sprint 9 Task 7 UBO regressions (RED)', () => {
  it('TEST 1: drawArrays with undefined mode records INVALID_ENUM', () => {
    // Arrange:
    const gl = freshCtx();
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(undefined as unknown as number, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TEST 2: drawArrays with null mode records INVALID_ENUM', () => {
    // Arrange:
    const gl = freshCtx();
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(null as unknown as number, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TEST 3: drawArrays with zero arguments records INVALID_ENUM', () => {
    // Arrange:
    const gl = freshCtx();
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays();
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TEST 4: fillFromUboSlot0 with unbound slot handles safely without throw', () => {
    // Arrange:
    const gl = freshCtx();
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    const slot = gl.getIndexedParameter(UNIFORM_BUFFER, 0);
    expect(slot).toBe(null);
    expect(() => gl.drawArrays(undefined as unknown as number, 0, 3)).not.toThrow();
    // Assert: context remains stable, error queue drained deterministically.
    gl.getError();
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TEST 5: getActiveUniforms single index [0] returns exactly [0]', () => {
    // Arrange:
    const gl = freshCtx();
    const prog = linkSceneProgram(gl);
    // Act:
    const offsets = gl.getActiveUniforms(prog, [0], UNIFORM_OFFSET) as unknown as number[];
    // Assert:
    expect(offsets).toEqual([0]);
    expect(offsets).toHaveLength(1);
  });

  it('TEST 6: getActiveUniforms single index [i] returns [offset_i]', () => {
    // Arrange:
    const gl = freshCtx();
    const prog = linkSceneProgram(gl);
    // Act:
    const o1 = gl.getActiveUniforms(prog, [1], UNIFORM_OFFSET) as unknown as number[];
    const o2 = gl.getActiveUniforms(prog, [2], UNIFORM_OFFSET) as unknown as number[];
    const o3 = gl.getActiveUniforms(prog, [3], UNIFORM_OFFSET) as unknown as number[];
    // Assert:
    expect(o1).toEqual([16]);
    expect(o2).toEqual([32]);
    expect(o3).toEqual([96]);
  });

  it('TEST 7: getActiveUniforms out-of-range index returns [0]', () => {
    // Arrange:
    const gl = freshCtx();
    const prog = linkSceneProgram(gl);
    // Act:
    const outLow = gl.getActiveUniforms(prog, [-1], UNIFORM_OFFSET) as unknown as number[];
    const outHigh = gl.getActiveUniforms(prog, [99], UNIFORM_OFFSET) as unknown as number[];
    // Assert:
    expect(outLow).toEqual([0]);
    expect(outHigh).toEqual([0]);
  });

  it('TEST 8: getActiveUniforms multi-index preserves order', () => {
    // Arrange:
    const gl = freshCtx();
    const prog = linkSceneProgram(gl);
    // Act:
    const multi = gl.getActiveUniforms(prog, [3, 0, 2, 1], UNIFORM_OFFSET) as unknown as number[];
    const mat = gl.getActiveUniforms(prog, [2, 0], UNIFORM_MATRIX_STRIDE) as unknown as number[];
    const arr = gl.getActiveUniforms(prog, [3, 1], UNIFORM_ARRAY_STRIDE) as unknown as number[];
    // Assert:
    expect(multi).toEqual([96, 0, 32, 16]);
    expect(mat).toEqual([16, 0]);
    expect(arr).toEqual([16, 0]);
  });
});
