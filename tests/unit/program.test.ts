/** Sprint 4 Task 4 program linker red-phase suite — TDD TESTS 1-10 per blueprint. */
import { describe, expect, it } from 'vitest';
import {
  computeStd140Offsets,
  link,
  ProgramRegistry,
  UniformStore,
} from '../../src/gl/program';
import type { CheckedShader, ShaderHandle, ProgramHandle } from '../../src/gl/program';
import type { CheckedShader as CheckerShader } from '../../src/glsl/checker';
import {
  FRAGMENT_SHADER,
  INT,
  UNSIGNED_INT,
  UNSIGNED_INT_VEC2,
  UNSIGNED_INT_VEC3,
  UNSIGNED_INT_VEC4,
  VERTEX_SHADER,
} from '../../src/gl/constants';

function shader(over: Partial<CheckerShader> & { stage: 'vertex' | 'fragment'; version: 100 | 300 }): CheckedShader {
  // Arrange helper: plain literal fixture satisfying the extended interface.
  return {
    declaredInputs: [],
    declaredOutputs: [],
    uniforms: [],
    functions: [],
    uniformBlocks: [],
    ...over,
  } as unknown as CheckedShader;
}

describe('Link Agreement - varying mismatch (TEST 1, AC-1)', () => {
  it('fails with ERROR diagnostic naming the unwritten varying', () => {
    // Arrange:
    const vs = shader({ stage: 'vertex', version: 100, declaredOutputs: [{ name: 'vColor', typeName: 'vec4', storage: 'varying' }] });
    const fs = shader({ stage: 'fragment', version: 100, declaredInputs: [{ name: 'vTexCoord', typeName: 'vec2', storage: 'varying' }] });
    // Act:
    const result = link(vs, fs);
    // Assert:
    expect(result.ok).toBe(false);
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.log.startsWith('ERROR: 0:')).toBe(true);
    expect(result.log).toContain('vTexCoord');
  });
});

describe('Link Agreement - uniform type mismatch (TEST 2, AC-2)', () => {
  it('fails with mismatch diagnostic naming the uniform', () => {
    // Arrange:
    const vs = shader({ stage: 'vertex', version: 100, uniforms: [{ name: 'uLightPos', typeName: 'vec3', storage: 'uniform' }] });
    const fs = shader({ stage: 'fragment', version: 100, uniforms: [{ name: 'uLightPos', typeName: 'vec4', storage: 'uniform' }] });
    // Act:
    const result = link(vs, fs);
    // Assert:
    expect(result.ok).toBe(false);
    expect(result.log.length).toBeGreaterThan(0);
    expect(result.log.startsWith('ERROR: 0:')).toBe(true);
    expect(result.log).toContain('uLightPos');
    expect(result.log.toLowerCase()).toContain('mismatch');
  });
});

describe('Link Agreement - uniform agreement slots (TEST 3, AC-2)', () => {
  it('succeeds with deterministic declaration-order slots', () => {
    // Arrange:
    const vs = shader({ stage: 'vertex', version: 100, uniforms: [{ name: 'uModel', typeName: 'mat4', storage: 'uniform' }, { name: 'uColor', typeName: 'vec4', storage: 'uniform' }] });
    const fs = shader({ stage: 'fragment', version: 100, uniforms: [{ name: 'uColor', typeName: 'vec4', storage: 'uniform' }, { name: 'uIntensity', typeName: 'float', storage: 'uniform' }] });
    // Act:
    const result = link(vs, fs);
    // Assert:
    expect(result.ok).toBe(true);
    expect(result.log).toBe('');
    expect(result.program).toBeDefined();
    const au = result.program!.activeUniforms;
    expect(au.length).toBe(3);
    expect(au[0]!.name).toBe('uModel');
    expect(au[0]!.slot).toBe(0);
    expect(au[1]!.name).toBe('uColor');
    expect(au[1]!.slot).toBe(16);
    expect(au[2]!.name).toBe('uIntensity');
    expect(au[2]!.slot).toBe(20);
  });
});

describe('Reflection - layout vs binding (TEST 4, AC-3)', () => {
  it('layout(location) overrides bindAttribLocation; unbound gets lowest free', () => {
    // Arrange:
    const vs = shader({ stage: 'vertex', version: 300, declaredInputs: [{ name: 'aPos', typeName: 'vec3', storage: 'in', location: 0 }, { name: 'aNormal', typeName: 'vec3', storage: 'in', location: null }, { name: 'aUV', typeName: 'vec2', storage: 'in', location: null }] });
    const fs = shader({ stage: 'fragment', version: 300, declaredInputs: [] });
    const bound = new Map<string, number>([['aPos', 2], ['aNormal', 1]]);
    // Act:
    const result = link(vs, fs, bound);
    // Assert:
    expect(result.ok).toBe(true);
    const byName = new Map(result.program!.activeAttribs.map((a) => [a.name, a.location]));
    expect(byName.get('aPos')).toBe(0);
    expect(byName.get('aNormal')).toBe(1);
    expect(byName.get('aUV')).toBe(2);
  });
});

describe('std140 Groundwork (TEST 5, AC-4)', () => {
  it('matches published std140 table offsets and strides', () => {
    // Arrange:
    const members = [{ name: 'uScalar', typeName: 'float' }, { name: 'uVec', typeName: 'vec3' }, { name: 'uMatrix', typeName: 'mat4' }, { name: 'uArray', typeName: 'float', arraySize: 3 }];
    // Act:
    const layout = computeStd140Offsets(members);
    // Assert:
    expect(layout.members[0]!.name).toBe('uScalar');
    expect(layout.members[0]!.offset).toBe(0);
    expect(layout.members[1]!.name).toBe('uVec');
    expect(layout.members[1]!.offset).toBe(16);
    expect(layout.members[2]!.name).toBe('uMatrix');
    expect(layout.members[2]!.offset).toBe(32);
    expect(layout.members[2]!.matrixStride).toBe(16);
    expect(layout.members[3]!.name).toBe('uArray');
    expect(layout.members[3]!.offset).toBe(96);
    expect(layout.members[3]!.arrayStride).toBe(16);
    expect(layout.dataSize).toBe(144);
  });
});

describe('Program Lifecycle - failed link preserves prior (TEST 6, AC-5)', () => {
  it('prior linked program remains usable after failed re-link', () => {
    // Arrange:
    const registry = new ProgramRegistry();
    const program: ProgramHandle = registry.createProgram();
    const vs = shader({ stage: 'vertex', version: 100, declaredOutputs: [{ name: 'vC', typeName: 'vec4', storage: 'varying' }] });
    const fsOk = shader({ stage: 'fragment', version: 100, declaredInputs: [{ name: 'vC', typeName: 'vec4', storage: 'varying' }] });
    const sv: ShaderHandle = { id: 1, alive: true, type: VERTEX_SHADER, checked: vs };
    const sf: ShaderHandle = { id: 2, alive: true, type: FRAGMENT_SHADER, checked: fsOk };
    registry.attachShader(program, sv);
    registry.attachShader(program, sf);
    const link1 = registry.linkProgram(program);
    const prior = program.linkedProgram;
    const fsBroken = shader({ stage: 'fragment', version: 100, declaredInputs: [{ name: 'vMissing', typeName: 'vec2', storage: 'varying' }] });
    const sfBroken: ShaderHandle = { id: 3, alive: true, type: FRAGMENT_SHADER, checked: fsBroken };
    registry.detachShader(program, sf);
    registry.attachShader(program, sfBroken);
    // Act:
    const link2 = registry.linkProgram(program);
    // Assert:
    expect(link1).toBe(true);
    expect(link2).toBe(false);
    expect(program.linkStatus).toBe(false);
    expect(program.infoLog).toContain('ERROR: 0:');
    expect(program.linkedProgram).toBe(prior);
    expect(program.linkedProgram).not.toBeNull();
  });
});

describe('Program Lifecycle - registry create/delete/attach/detach (TEST 7, AC-6)', () => {
  it('manages lifetime and shader graph per spec', () => {
    // Arrange:
    const registry = new ProgramRegistry();
    // Act + Assert:
    const p: ProgramHandle = registry.createProgram();
    expect(p.id).toBeGreaterThan(0);
    expect(p.alive).toBe(true);
    const s1: ShaderHandle = { id: 10, alive: true, type: VERTEX_SHADER, checked: null };
    expect(registry.attachShader(p, s1)).toBe(true);
    expect(p.attachedShaders.has(s1)).toBe(true);
    expect(registry.detachShader(p, s1)).toBe(true);
    expect(p.attachedShaders.has(s1)).toBe(false);
    registry.deleteProgram(p);
    expect(p.alive).toBe(false);
    const s2: ShaderHandle = { id: 11, alive: true, type: FRAGMENT_SHADER, checked: null };
    expect(registry.attachShader(p, s2)).toBe(false);
  });
});

describe('UniformStore (TEST 8, AC-7)', () => {
  it('allocates typed arrays and sampler units', () => {
    // Arrange:
    const f = 20;
    const i = 8;
    const u = 4;
    const s = 2;
    // Act:
    const store = new UniformStore(f, i, u, s);
    // Assert:
    expect(store.f32 instanceof Float32Array).toBe(true);
    expect(store.f32.length).toBe(20);
    expect(store.i32 instanceof Int32Array).toBe(true);
    expect(store.i32.length).toBe(8);
    expect(store.u32 instanceof Uint32Array).toBe(true);
    expect(store.u32.length).toBe(4);
    expect(store.samplerUnits instanceof Int32Array).toBe(true);
    expect(store.samplerUnits.length).toBe(2);
  });
});

describe('Link Agreement - version mismatch (TEST 9)', () => {
  it('rejects differing shader dialects', () => {
    // Arrange:
    const vs = shader({ stage: 'vertex', version: 300 });
    const fs = shader({ stage: 'fragment', version: 100 });
    // Act:
    const result = link(vs, fs);
    // Assert:
    expect(result.ok).toBe(false);
    expect(result.log).toContain('versions do not match');
  });
});

describe('Reflection - int/uint enum mapping (HIGH-1/HIGH-2)', () => {
  it('maps int scalar to INT and uint family to UNSIGNED_INT enums', () => {
    // Arrange:
    const vs = shader({
      stage: 'vertex',
      version: 300,
      uniforms: [
        { name: 'uCount', typeName: 'int', storage: 'uniform' },
        { name: 'uFlags', typeName: 'uint', storage: 'uniform' },
        { name: 'uU2', typeName: 'uvec2', storage: 'uniform' },
        { name: 'uU3', typeName: 'uvec3', storage: 'uniform' },
        { name: 'uU4', typeName: 'uvec4', storage: 'uniform' },
      ],
    });
    const fs = shader({ stage: 'fragment', version: 300, declaredInputs: [] });
    // Act:
    const result = link(vs, fs);
    // Assert:
    expect(result.ok).toBe(true);
    const byName = new Map(result.program!.activeUniforms.map((u) => [u.name, u.type]));
    expect(byName.get('uCount')).toBe(INT);
    expect(byName.get('uFlags')).toBe(UNSIGNED_INT);
    expect(byName.get('uU2')).toBe(UNSIGNED_INT_VEC2);
    expect(byName.get('uU3')).toBe(UNSIGNED_INT_VEC3);
    expect(byName.get('uU4')).toBe(UNSIGNED_INT_VEC4);
  });
});

describe('std140 - mat4 array stride (MEDIUM-1)', () => {
  it('reports arrayStride 16 and matrixStride 16 for mat4[2]', () => {
    // Arrange:
    const members = [{ name: 'uBones', typeName: 'mat4', arraySize: 2 }];
    // Act:
    const layout = computeStd140Offsets(members);
    // Assert:
    expect(layout.members[0]!.offset).toBe(0);
    expect(layout.members[0]!.arrayStride).toBe(16);
    expect(layout.members[0]!.matrixStride).toBe(16);
    expect(layout.dataSize).toBe(128);
  });
});

describe('Link Agreement - transform feedback (TEST 10)', () => {
  it('rejects TF varying naming non-existent vertex output', () => {
    // Arrange:
    const vs = shader({ stage: 'vertex', version: 300, declaredOutputs: [{ name: 'vPos', typeName: 'vec4', storage: 'out' }] });
    const fs = shader({ stage: 'fragment', version: 300, declaredInputs: [{ name: 'vPos', typeName: 'vec4', storage: 'in' }] });
    // Act:
    const result = link(vs, fs, undefined, ['vNonExistent']);
    // Assert:
    expect(result.ok).toBe(false);
    expect(result.log).toContain("Transform feedback varying 'vNonExistent' does not exist");
  });
});
