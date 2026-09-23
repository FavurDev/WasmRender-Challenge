/** Sprint 8 Task 8 std140 UBO layout engine TDD RED-phase tests (8 cases per blueprint). */
import { describe, expect, it } from 'vitest';
import { computeStd140Layout, getStd140TypeInfo } from '../../src/gl/ubo-layout';
import type { UboMemberDescriptor } from '../../src/gl/ubo-layout';
import { link } from '../../src/gl/program';
import type { CheckedShader } from '../../src/glsl/checker';
import { runFrontEndPipeline } from '../../scripts/glsl-smoke';
import { createSoftwareWebGLContext } from '../../src/entry';
import {
  UNIFORM_BLOCK_ACTIVE_UNIFORMS,
  UNIFORM_BLOCK_DATA_SIZE,
  UNIFORM_OFFSET,
} from '../../src/gl/constants';

function shader(over: Partial<CheckedShader> & { stage: 'vertex' | 'fragment'; version: 100 | 300 }): CheckedShader {
  return {
    declaredInputs: [],
    declaredOutputs: [],
    uniforms: [],
    functions: [],
    uniformBlocks: [],
    ...over,
  } as unknown as CheckedShader;
}

describe('std140 published layout table (TEST 1, AC-1)', () => {
  it('matches offsets 0/16/32/96 with dataSize 144', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [
      { name: 'u_a', typeName: 'float' },
      { name: 'u_b', typeName: 'vec3' },
      { name: 'u_c', typeName: 'mat4' },
      { name: 'u_d', typeName: 'float', arraySize: 3 },
    ];
    // Act:
    const result = computeStd140Layout(members);
    // Assert:
    expect(result.dataSize).toBe(144);
    expect(result.members[0]).toMatchObject({ offset: 0, arrayStride: 0, matrixStride: 0 });
    expect(result.members[1]).toMatchObject({ offset: 16, arrayStride: 0, matrixStride: 0 });
    expect(result.members[2]).toMatchObject({ offset: 32, arrayStride: 0, matrixStride: 16 });
    expect(result.members[3]).toMatchObject({ offset: 96, arrayStride: 16, matrixStride: 0 });
  });
});

describe('std140 scalar/vector array rules (TEST 2, AC-2)', () => {
  it('rounds array stride to 16 with offsets 0/32 and dataSize 64', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [
      { name: 'f_arr', typeName: 'float', arraySize: 2 },
      { name: 'v2_arr', typeName: 'vec2', arraySize: 2 },
    ];
    // Act:
    const result = computeStd140Layout(members);
    // Assert:
    expect(result.members[0]).toMatchObject({ offset: 0, arrayStride: 16 });
    expect(result.members[1]).toMatchObject({ offset: 32, arrayStride: 16 });
    expect(result.dataSize).toBe(64);
  });
});

describe('std140 matrix strides (TEST 3, AC-2)', () => {
  it('gives mat2/mat3 matrixStride 16 with offsets 0/32 and dataSize 80', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [
      { name: 'm2', typeName: 'mat2' },
      { name: 'm3', typeName: 'mat3' },
    ];
    // Act:
    const result = computeStd140Layout(members);
    // Assert:
    expect(result.members[0]).toMatchObject({ offset: 0, matrixStride: 16 });
    expect(result.members[1]).toMatchObject({ offset: 32, matrixStride: 16 });
    expect(result.dataSize).toBe(80);
  });
});

describe('std140 struct alignment (TEST 4, AC-2)', () => {
  it('aligns struct S(float+vec2) to 16 with tail float at 16 and dataSize 32', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [
      {
        name: 's_inst',
        typeName: 'S',
        structMembers: [
          { name: 'a', typeName: 'float' },
          { name: 'b', typeName: 'vec2' },
        ],
      },
      { name: 'tail', typeName: 'float' },
    ];
    // Act:
    const result = computeStd140Layout(members);
    // Assert:
    expect(result.members[0]?.offset).toBe(0);
    expect(result.members[1]?.offset).toBe(16);
    expect(result.dataSize).toBe(32);
  });
});

describe('layout(packed)/layout(shared) rejection (TEST 5, AC-3)', () => {
  it('fails compilation with diagnostics naming the layout qualifier', () => {
    // Arrange:
    const srcPacked = '#version 300 es\nlayout(packed) uniform BadBlock { float x; };\nvoid main() {}\n';
    const srcShared = '#version 300 es\nlayout(shared) uniform BadBlock { float x; };\nvoid main() {}\n';
    // Act:
    const resPacked = runFrontEndPipeline(srcPacked, 'vertex', 300);
    const resShared = runFrontEndPipeline(srcShared, 'vertex', 300);
    // Assert:
    expect(resPacked.ok).toBe(false);
    if (resPacked.ok) throw new Error('expected packed failure');
    expect(resPacked.log).toContain('packed');
    expect(resShared.ok).toBe(false);
    if (resShared.ok) throw new Error('expected shared failure');
    expect(resShared.log).toContain('shared');
  });
});

describe('uniform block capture (TEST 6, AC-4)', () => {
  it('captures layout(std140) block into checked.uniformBlocks', () => {
    // Arrange:
    const src = '#version 300 es\nlayout(std140) uniform GoodBlock { float a; vec4 b; };\nvoid main() {}\n';
    // Act:
    const res = runFrontEndPipeline(src, 'vertex', 300);
    // Assert:
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected ok');
    expect(res.shader.uniformBlocks?.length).toBe(1);
    expect(res.shader.uniformBlocks?.[0]?.name).toBe('GoodBlock');
    expect(res.shader.uniformBlocks?.[0]?.members.length).toBe(2);
  });
});

describe('link populates uniformBlocks (TEST 7, AC-5)', () => {
  it('computes real std140 offsets for Transform block', () => {
    // Arrange:
    const members = [
      { name: 'u_proj', typeName: 'mat4', storage: 'uniform' },
      { name: 'u_color', typeName: 'vec4', storage: 'uniform' },
    ];
    const vs = shader({ stage: 'vertex', version: 300, uniformBlocks: [{ name: 'Transform', members }] });
    const fs = shader({ stage: 'fragment', version: 300, uniformBlocks: [{ name: 'Transform', members }] });
    // Act:
    const linkRes = link(vs, fs);
    // Assert:
    expect(linkRes.ok).toBe(true);
    const block = linkRes.program?.uniformBlocks[0];
    expect(block?.name).toBe('Transform');
    expect(block?.dataSize).toBe(80);
    expect(block?.members[0]).toMatchObject({ name: 'u_proj', offset: 0, matrixStride: 16 });
    expect(block?.members[1]).toMatchObject({ name: 'u_color', offset: 64, matrixStride: 0 });
  });
});

describe('context introspection (TEST 8, AC-6)', () => {
  it('returns real linked block data with no canned Scene fallback', () => {
    // Arrange:
    const gl = createSoftwareWebGLContext({ width: 2, height: 2 });
    if (gl === null) throw new Error('failed to create context');
    const members = [
      { name: 'val1', typeName: 'float', storage: 'uniform' },
      { name: 'val2', typeName: 'vec3', storage: 'uniform' },
    ];
    const vs = shader({ stage: 'vertex', version: 300, uniformBlocks: [{ name: 'DataBlock', members }] });
    const fs = shader({ stage: 'fragment', version: 300, uniformBlocks: [{ name: 'DataBlock', members }] });
    const linked = link(vs, fs);
    if (!linked.ok || !linked.program) throw new Error('link failed');
    const program = { id: 1, handle: { linkedProgram: linked.program } };
    // Act:
    const idx = (gl as unknown as { getUniformBlockIndex: (p: unknown, n: string) => number }).getUniformBlockIndex(program, 'DataBlock');
    const dataSize = (gl as unknown as { getActiveUniformBlockParameter: (p: unknown, i: number, q: number) => number }).getActiveUniformBlockParameter(program, idx, UNIFORM_BLOCK_DATA_SIZE as number);
    const active = (gl as unknown as { getActiveUniformBlockParameter: (p: unknown, i: number, q: number) => number }).getActiveUniformBlockParameter(program, idx, UNIFORM_BLOCK_ACTIVE_UNIFORMS as number);
    const indices = (gl as unknown as { getUniformIndices: (p: unknown, n: string[]) => number[] }).getUniformIndices(program, ['val1', 'val2']);
    const offsets = (gl as unknown as { getActiveUniforms: (p: unknown, i: number[], q: number) => number[] }).getActiveUniforms(program, indices, UNIFORM_OFFSET as number);
    // Assert:
    expect(idx).toBe(0);
    expect(dataSize).toBe(32);
    expect(active).toBe(2);
    expect(indices).toEqual([0, 1]);
    expect(offsets).toEqual([0, 16]);
  });

  it('REMED-1a: mat2 array has arrayStride 32 and total size 64', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [{ name: 'u_m2', typeName: 'mat2', arraySize: 2 }];
    // Act:
    const info = getStd140TypeInfo('mat2', 2, null);
    const layout = computeStd140Layout(members);
    // Assert:
    expect(info.arrayStride).toBe(32);
    expect(info.matrixStride).toBe(16);
    expect(info.size).toBe(64);
    expect(layout.dataSize).toBe(64);
    expect(layout.members[0]?.arrayStride).toBe(32);
  });

  it('REMED-1b: mat3 array has arrayStride 48 and total size 144', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [{ name: 'u_m3', typeName: 'mat3', arraySize: 3 }];
    // Act:
    const info = getStd140TypeInfo('mat3', 3, null);
    const layout = computeStd140Layout(members);
    // Assert:
    expect(info.arrayStride).toBe(48);
    expect(info.matrixStride).toBe(16);
    expect(info.size).toBe(144);
    expect(layout.dataSize).toBe(144);
    expect(layout.members[0]?.arrayStride).toBe(48);
  });

  it('REMED-1c: mat4 array has arrayStride 64 and total size 128', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [{ name: 'u_m4', typeName: 'mat4', arraySize: 2 }];
    // Act:
    const info = getStd140TypeInfo('mat4', 2, null);
    const layout = computeStd140Layout(members);
    // Assert:
    expect(info.arrayStride).toBe(64);
    expect(info.matrixStride).toBe(16);
    expect(info.size).toBe(128);
    expect(layout.dataSize).toBe(128);
    expect(layout.members[0]?.arrayStride).toBe(64);
  });
});
describe('Sprint 8 remediation: std140 matrix-array strides (CRITICAL)', () => {
  it('mat2 array: arrayStride 32, size 64, matrixStride 16', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [{ name: 'u_mats', typeName: 'mat2', arraySize: 2 }];
    // Act:
    const layout = computeStd140Layout(members);
    // Assert:
    expect(layout.members).toHaveLength(1);
    expect(layout.members[0]?.offset).toBe(0);
    expect(layout.members[0]?.arrayStride).toBe(32);
    expect(layout.members[0]?.matrixStride).toBe(16);
    expect(layout.dataSize).toBe(64);
  });

  it('mat3 array: arrayStride 48, size 144, matrixStride 16', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [{ name: 'u_mats', typeName: 'mat3', arraySize: 3 }];
    // Act:
    const layout = computeStd140Layout(members);
    // Assert:
    expect(layout.members).toHaveLength(1);
    expect(layout.members[0]?.offset).toBe(0);
    expect(layout.members[0]?.arrayStride).toBe(48);
    expect(layout.members[0]?.matrixStride).toBe(16);
    expect(layout.dataSize).toBe(144);
  });

  it('mat4 array: arrayStride 64, size 128, matrixStride 16', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [{ name: 'u_mats', typeName: 'mat4', arraySize: 2 }];
    // Act:
    const layout = computeStd140Layout(members);
    // Assert:
    expect(layout.members).toHaveLength(1);
    expect(layout.members[0]?.offset).toBe(0);
    expect(layout.members[0]?.arrayStride).toBe(64);
    expect(layout.members[0]?.matrixStride).toBe(16);
    expect(layout.dataSize).toBe(128);
  });
});

describe('Group R1: std140 matrix-array strides (CRITICAL remediation)', () => {
  it('R1-mat2: mat2 array has arrayStride 32 and total size 64', async () => {
    // Arrange:
    const { getStd140TypeInfo } = await import('../../src/gl/ubo-layout');
    // Act:
    const info = getStd140TypeInfo('mat2', 2, null);
    const layout = computeStd140Layout([{ name: 'u_m', typeName: 'mat2', arraySize: 2 }]);
    // Assert:
    expect(info.arrayStride).toBe(32);
    expect(info.size).toBe(64);
    expect(info.matrixStride).toBe(16);
    expect(layout.members[0]?.arrayStride).toBe(32);
    expect(layout.dataSize).toBe(64);
  });

  it('R1-mat3: mat3 array has arrayStride 48 and total size 144', async () => {
    // Arrange:
    const { getStd140TypeInfo } = await import('../../src/gl/ubo-layout');
    // Act:
    const info = getStd140TypeInfo('mat3', 3, null);
    const layout = computeStd140Layout([{ name: 'u_m', typeName: 'mat3', arraySize: 3 }]);
    // Assert:
    expect(info.arrayStride).toBe(48);
    expect(info.size).toBe(144);
    expect(info.matrixStride).toBe(16);
    expect(layout.members[0]?.arrayStride).toBe(48);
    expect(layout.dataSize).toBe(144);
  });

  it('R1-mat4: mat4 array has arrayStride 64 and total size 128', async () => {
    // Arrange:
    const { getStd140TypeInfo } = await import('../../src/gl/ubo-layout');
    // Act:
    const info = getStd140TypeInfo('mat4', 2, null);
    const layout = computeStd140Layout([{ name: 'u_m', typeName: 'mat4', arraySize: 2 }]);
    // Assert:
    expect(info.arrayStride).toBe(64);
    expect(info.size).toBe(128);
    expect(info.matrixStride).toBe(16);
    expect(layout.members[0]?.arrayStride).toBe(64);
    expect(layout.dataSize).toBe(128);
  });
});

describe('Sprint 8 remediation: std140 matrix-array strides (CRITICAL)', () => {
  it('mat2 array: arrayStride 32, size 64, matrixStride 16', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [{ name: 'u_m', typeName: 'mat2', arraySize: 2 }];
    // Act:
    const info = getStd140TypeInfo('mat2', 2, null);
    const layout = computeStd140Layout(members);
    // Assert:
    expect(info.arrayStride).toBe(32);
    expect(info.size).toBe(64);
    expect(info.matrixStride).toBe(16);
    expect(layout.members[0].arrayStride).toBe(32);
    expect(layout.dataSize).toBe(64);
  });

  it('mat3 array: arrayStride 48, size 144, matrixStride 16', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [{ name: 'u_m', typeName: 'mat3', arraySize: 3 }];
    // Act:
    const info = getStd140TypeInfo('mat3', 3, null);
    const layout = computeStd140Layout(members);
    // Assert:
    expect(info.arrayStride).toBe(48);
    expect(info.size).toBe(144);
    expect(info.matrixStride).toBe(16);
    expect(layout.members[0].arrayStride).toBe(48);
    expect(layout.dataSize).toBe(144);
  });

  it('mat4 array: arrayStride 64, size 128, matrixStride 16', () => {
    // Arrange:
    const members: UboMemberDescriptor[] = [{ name: 'u_m', typeName: 'mat4', arraySize: 2 }];
    // Act:
    const info = getStd140TypeInfo('mat4', 2, null);
    const layout = computeStd140Layout(members);
    // Assert:
    expect(info.arrayStride).toBe(64);
    expect(info.size).toBe(128);
    expect(info.matrixStride).toBe(16);
    expect(layout.members[0].arrayStride).toBe(64);
    expect(layout.dataSize).toBe(128);
  });
});
