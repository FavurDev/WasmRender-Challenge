/** Sprint 8 remediation: UBO introspection via genuine linked programs (RED phase). */
import { describe, expect, it } from 'vitest';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import { link } from '../../src/gl/program';
import {
  COMPILE_STATUS,
  FRAGMENT_SHADER,
  LINK_STATUS,
  UNIFORM_ARRAY_STRIDE,
  UNIFORM_BLOCK_ACTIVE_UNIFORMS,
  UNIFORM_BLOCK_BINDING,
  UNIFORM_BLOCK_DATA_SIZE,
  UNIFORM_MATRIX_STRIDE,
  UNIFORM_OFFSET,
  VERTEX_SHADER,
} from '../../src/gl/constants';

type LinkedProgram = NonNullable<ReturnType<WebGL2Context['createProgram']>>;

const VS_SCENE =
  '#version 300 es\nlayout(std140) uniform Scene { float u_a; vec3 u_b; mat4 u_c; float u_d[3]; };\n' +
  'in vec4 a_pos;\nvoid main() { gl_Position = a_pos; }';
const FS_SIMPLE =
  '#version 300 es\nprecision mediump float;\nout vec4 o_color;\nvoid main() { o_color = vec4(1.0); }';

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

function linkedBlockProgram(): { ok: boolean; log: string; program: { uniformBlocks: Array<{ name: string; index: number; binding: number; dataSize: number; members: Array<{ name: string; offset: number; arrayStride: number; matrixStride: number }> }> } | null } {
  // Arrange: checked shaders carrying a uniform block (pure link-level helper).
  const members = [
    { name: 'u_a', typeName: 'float', storage: 'in' as const, arraySize: null },
    { name: 'u_b', typeName: 'vec3', storage: 'in' as const, arraySize: null },
    { name: 'u_c', typeName: 'mat4', storage: 'in' as const, arraySize: null },
    { name: 'u_d', typeName: 'float', storage: 'in' as const, arraySize: 3 },
  ];
  const vs = {
    stage: 'vertex' as const,
    version: 300 as const,
    declaredInputs: [],
    declaredOutputs: [],
    uniforms: [],
    functions: [],
    uniformBlocks: [{ name: 'Scene', members }],
  };
  const fs = {
    stage: 'fragment' as const,
    version: 300 as const,
    declaredInputs: [],
    declaredOutputs: [],
    uniforms: [],
    functions: [],
  };
  // Act:
  const result = link(vs, fs);
  // Assert shape via caller.
  return result as unknown as { ok: boolean; log: string; program: { uniformBlocks: Array<{ name: string; index: number; binding: number; dataSize: number; members: Array<{ name: string; offset: number; arrayStride: number; matrixStride: number }> }> } | null };
}

describe('Sprint 8 remediation UBO (RED)', () => {
  it('TEST 3.1: string handle to getUniformBlockIndex returns 0xffffffff sentinel', () => {
    // Arrange:
    const gl = freshCtx();
    // Act:
    const idx = gl.getUniformBlockIndex('Scene' as unknown as never, 'Scene');
    // Assert: no canned fallback — absent/invalid programs yield the spec sentinel.
    expect(idx).toBe(0xffffffff);
  });

  it('TEST 3.2: getActiveUniforms offsets via genuinely linked Scene program', () => {
    // Arrange:
    const gl = freshCtx();
    const prog = linkSceneProgram(gl);
    // Act:
    const offsets = gl.getActiveUniforms(prog, [0, 1, 2, 3], UNIFORM_OFFSET) as unknown as number[];
    const matStride = gl.getActiveUniforms(prog, [2], UNIFORM_MATRIX_STRIDE) as unknown as number[];
    const arrStride = gl.getActiveUniforms(prog, [3], UNIFORM_ARRAY_STRIDE) as unknown as number[];
    // Assert:
    expect(offsets).toEqual([0, 16, 32, 96]);
    expect(matStride).toEqual([16]);
    expect(arrStride).toEqual([16]);
  });

  it('TEST 1 rewrite: linked Scene block has dataSize 144 and index 0', () => {
    // Arrange:
    const gl = freshCtx();
    const prog = linkSceneProgram(gl);
    // Act:
    const idx = gl.getUniformBlockIndex(prog, 'Scene');
    const size = gl.getActiveUniformBlockParameter(prog, 0, UNIFORM_BLOCK_DATA_SIZE) as unknown as number;
    const active = gl.getActiveUniformBlockParameter(prog, 0, UNIFORM_BLOCK_ACTIVE_UNIFORMS) as unknown as number;
    const name = gl.getActiveUniformBlockName(prog, 0);
    // Assert:
    expect(idx).toBe(0);
    expect(size).toBe(144);
    expect(active).toBe(4);
    expect(name).toBe('Scene');
    const linked = linkedBlockProgram();
    expect(linked.ok).toBe(true);
    expect(linked.program?.uniformBlocks[0]?.dataSize).toBe(144);
    expect(linked.program?.uniformBlocks[0]?.members.map((m) => m.offset)).toEqual([0, 16, 32, 96]);
  });

  it('TEST 2 rewrite: uniformBlockBinding routes the linked block', () => {
    // Arrange:
    const gl = freshCtx();
    const prog = linkSceneProgram(gl);
    // Act:
    gl.uniformBlockBinding(prog, 0, 2);
    // Assert:
    expect(gl.getActiveUniformBlockParameter(prog, 0, UNIFORM_BLOCK_BINDING)).toBe(2);
  });
});
