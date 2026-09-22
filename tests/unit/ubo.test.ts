/** Sprint 8 Task 4 std140 uniform blocks TDD RED-phase tests (9 cases). */
import { describe, expect, it } from 'vitest';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import { computeStd140Offsets, link } from '../../src/gl/program';
import {
  COMPILE_STATUS,
  INVALID_VALUE,
  NO_ERROR,
  RGBA,
  STATIC_DRAW,
  TRIANGLES,
  UNIFORM_BLOCK_ACTIVE_UNIFORMS,
  UNIFORM_BLOCK_BINDING,
  UNIFORM_BLOCK_DATA_SIZE,
  UNIFORM_BLOCK_INDEX,
  UNIFORM_BUFFER,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

type UboCtx = { [key: string]: ((...args: unknown[]) => unknown) | undefined };
function callUbo(gl: WebGL1Context, name: string, ...args: unknown[]): unknown {
  const fn = uboOf(gl)[name];
  if (typeof fn !== 'function') throw new TypeError(name + ' is not a function');
  return (fn as (...a: unknown[]) => unknown)(...args);
}

function freshCtx(): WebGL1Context {
  return new WebGL1Context({ width: 2, height: 2 });
}

function uboOf(ctx: WebGL1Context): UboCtx {
  return ctx as unknown as UboCtx;
}

function blockMembers(): Array<{ name: string; typeName: string; arraySize?: number }> {
  return [
    { name: 'u_a', typeName: 'float' },
    { name: 'u_b', typeName: 'vec3' },
    { name: 'u_c', typeName: 'mat4' },
    { name: 'u_d', typeName: 'float', arraySize: 3 },
  ];
}

function linkedBlockProgram(): { ok: boolean; log: string; program: { uniformBlocks: Array<{ name: string; index: number; binding: number; dataSize: number; members: Array<{ name: string; offset: number; arrayStride: number; matrixStride: number }> }> } | null } {
  // Arrange: checked shaders carrying a uniform block.
  const members = blockMembers().map((m) => ({
    name: m.name,
    typeName: m.typeName,
    storage: 'in' as const,
    arraySize: m.arraySize ?? null,
  }));
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

describe('Sprint 8 Task 4 std140 uniform blocks (RED)', () => {
  it('TEST 1: std140 offset table yields 0/16/32/96 with dataSize 144', () => {
    // Arrange:
    const members = blockMembers();
    // Act:
    const layout = computeStd140Offsets(members);
    const linked = linkedBlockProgram();
    // Assert:
    expect(layout.members.map((m) => m.offset)).toEqual([0, 16, 32, 96]);
    expect(layout.members[2].matrixStride).toBe(16);
    expect(layout.members[3].arrayStride).toBe(16);
    expect(layout.dataSize).toBe(144);
    expect(linked.ok).toBe(true);
    expect(linked.program).not.toBe(null);
    expect(linked.program?.uniformBlocks[0].dataSize).toBe(144);
    expect(linked.program?.uniformBlocks[0].members.map((m) => m.offset)).toEqual([0, 16, 32, 96]);
    // Context-level introspection is not yet wired (red phase):
    const gl = freshCtx();
    expect(uboOf(gl).getActiveUniforms?.('prog', [0], 0x8a3b)).toEqual([0, 16, 32, 96]);
  });

  it('TEST 2: LinkedProgram.uniformBlocks contract shape', () => {
    // Arrange:
    const linked = linkedBlockProgram();
    // Act:
    const block = linked.program?.uniformBlocks[0];
    // Assert:
    expect(block?.name).toBe('Scene');
    expect(block?.index).toBe(0);
    expect(typeof block?.binding).toBe('number');
    expect(block?.dataSize).toBe(144);
    expect(block?.members.length).toBe(4);
    expect(uboOf(freshCtx()).getUniformBlockIndex?.('prog', 'Scene')).toBe(0);
    for (const m of block?.members ?? []) {
      expect(typeof m.name).toBe('string');
      expect(typeof m.offset).toBe('number');
      expect(typeof m.arrayStride).toBe('number');
      expect(typeof m.matrixStride).toBe('number');
    }
  });

  it('TEST 3: bindBufferBase binds buffer to indexed UBO slot', () => {
    // Arrange:
    const gl = freshCtx();
    const buf = gl.createBuffer();
    gl.bindBuffer(UNIFORM_BUFFER, buf);
    gl.bufferData(UNIFORM_BUFFER, 144, 35044);
    // Act:
    uboOf(gl).bindBufferBase?.(UNIFORM_BUFFER, 0, buf) as unknown;
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(uboOf(gl).getIndexedParameter?.(35374, 0)).not.toBe(null);
  });

  it('TEST 4: bindBufferRange validates alignment, bounds, and 256MB guard', () => {
    // Arrange:
    const gl = freshCtx();
    const buf = gl.createBuffer();
    gl.bindBuffer(UNIFORM_BUFFER, buf);
    gl.bufferData(UNIFORM_BUFFER, 512, 35044);
    const u = uboOf(gl);
    // Act: misaligned offset must raise INVALID_VALUE with no state mutation.
    (u.bindBufferRange as unknown as (t: number, i: number, b: unknown, o: number, s: number) => void).call(gl, UNIFORM_BUFFER, 0, buf, 1, 16);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: range exceeding byteLength.
    (u.bindBufferRange as unknown as (t: number, i: number, b: unknown, o: number, s: number) => void).call(gl, UNIFORM_BUFFER, 0, buf, 0, 1024);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: 256MB guard.
    (u.bindBufferRange as unknown as (t: number, i: number, b: unknown, o: number, s: number) => void).call(gl, UNIFORM_BUFFER, 0, buf, 0, 268435456 + 1);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TEST 5: getUniformIndices and getActiveUniforms introspection', () => {
    // Arrange:
    const gl = freshCtx();
    const linked = linkedBlockProgram();
    void linked;
    // Act:
    const u = uboOf(gl);
    const indices = u.getUniformIndices?.('prog', ['u_a', 'u_b']) as unknown as number[];
    const offsets = u.getActiveUniforms?.('prog', indices, 35387) as unknown as number[];
    // Assert:
    expect(indices).toEqual([0, 1]);
    expect(offsets).toEqual([0, 16]);
  });

  it('TEST 6: getActiveUniformBlockParameter and getActiveUniformBlockName', () => {
    // Arrange:
    const gl = freshCtx();
    const u = uboOf(gl);
    // Act:
    const size = u.getActiveUniformBlockParameter?.('prog', 0, UNIFORM_BLOCK_DATA_SIZE) as unknown as number;
    const binding = u.getActiveUniformBlockParameter?.('prog', 0, UNIFORM_BLOCK_BINDING) as unknown as number;
    const active = u.getActiveUniformBlockParameter?.('prog', 0, UNIFORM_BLOCK_ACTIVE_UNIFORMS) as unknown as number;
    const name = u.getActiveUniformBlockName?.('prog', 0) as unknown as string;
    const index = u.getUniformBlockIndex?.('prog', 'Scene') as unknown as number;
    // Assert:
    expect(size).toBe(144);
    expect(binding).toBe(0);
    expect(active).toBe(4);
    expect(name).toBe('Scene');
    expect(index).toBe(0);
  });

  it('TEST 7: uniformBlockBinding updates block slot routing', () => {
    // Arrange:
    const gl = freshCtx();
    const u = uboOf(gl);
    // Act:
    (u.uniformBlockBinding as unknown as (p: unknown, b: number, s: number) => void).call(gl, 'prog', 0, 2);
    // Assert:
    expect(u.getActiveUniformBlockParameter?.('prog', 0, UNIFORM_BLOCK_BINDING)).toBe(2);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TEST 8: UBO value change visibly alters readPixels output', () => {
    // Arrange:
    const gl = freshCtx();
    const buf = gl.createBuffer();
    gl.bindBuffer(UNIFORM_BUFFER, buf);
    gl.bufferData(UNIFORM_BUFFER, 144, 35044);
    const u = uboOf(gl);
    (u.bindBufferBase as unknown as (t: number, i: number, b: unknown) => void).call(gl, UNIFORM_BUFFER, 0, buf);
    // Act: write red into the block, draw, read back.
    (u.bufferSubData as unknown as (t: number, o: number, d: ArrayBufferView) => void).call(gl, UNIFORM_BUFFER, 0, new Float32Array([1, 0, 0, 1]));
    (u.drawArrays as unknown as () => void).call(gl);
    const before = new Uint8Array(16);
    gl.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, before);
    // Act: write green, draw again.
    (u.bufferSubData as unknown as (t: number, o: number, d: ArrayBufferView) => void).call(gl, UNIFORM_BUFFER, 0, new Float32Array([0, 1, 0, 1]));
    (u.drawArrays as unknown as () => void).call(gl);
    const after = new Uint8Array(16);
    gl.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, after);
    // Assert:
    expect(Array.from(before)).not.toEqual(Array.from(after));
  });

  it('TEST 9: layout(packed) and layout(shared) rejected with named diagnostic', () => {
    // Arrange:
    const gl = freshCtx();
    // Act:
    const packed = gl.createShader(VERTEX_SHADER);
    gl.shaderSource(packed, 'layout(packed) uniform Scene { float u_a; }; void main() { gl_Position = vec4(0.0); }');
    gl.compileShader(packed);
    const shared = gl.createShader(VERTEX_SHADER);
    gl.shaderSource(shared, 'layout(shared) uniform Scene { float u_a; }; void main() { gl_Position = vec4(0.0); }');
    gl.compileShader(shared);
    // Assert:
    expect(gl.getShaderParameter(packed, COMPILE_STATUS)).toBe(false);
    expect(gl.getShaderParameter(shared, COMPILE_STATUS)).toBe(false);
    expect(gl.getShaderInfoLog(packed)).toContain('packed');
    expect(gl.getShaderInfoLog(shared)).toContain('shared');
  });
});
