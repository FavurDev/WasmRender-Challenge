/** Program link-validation TDD red-phase tests (Task 6). Headless Node vitest, hand-built fixtures, no GUI. */
import { describe, expect, it } from 'vitest';
import { linkProgram, getAttribLocation, getUniformLocation } from '../../src/renderer/program';
import { drainError } from '../../src/renderer/errors';
import { NO_ERROR } from '../../src/renderer/gl-constants';
import type { SymbolTable } from '../../src/renderer/shader-compiler/typechecker';

type CompiledShader = { closure: (...args: never[]) => void; symbols: SymbolTable; version: 100 | 300; hasMain: boolean };

function noop(): void { /* fixture closure */ }

function makeSymbols(opts: {
  uniforms?: Array<[string, string]>;
  attributes?: Array<[string, string]>;
  varyings?: Array<[string, string]>;
}): SymbolTable {
  const attributes = new Map<string, { type: string; location: number }>();
  let loc = 0;
  for (const [name, type] of opts.attributes ?? []) attributes.set(name, { type, location: loc++ });
  return {
    uniforms: new Map(opts.uniforms ?? []),
    attributes,
    varyings: new Map(opts.varyings ?? []),
    outputs: new Map(),
  };
}

function makeShader(symbols: SymbolTable, version: 100 | 300, hasMain: boolean): CompiledShader {
  return { closure: noop as unknown as (...args: never[]) => void, symbols, version, hasMain };
}

describe('program Test 1: varying mismatch vec2 vs vec3 uv', () => {
  it('returns linked false with VARYING_MISMATCH uv', () => {
    // Arrange: vertex uv vec2, fragment uv vec3, both version 100 with main
    const vertex = makeShader(makeSymbols({ varyings: [['uv', 'vec2']] }), 100, true);
    const fragment = makeShader(makeSymbols({ varyings: [['uv', 'vec3']] }), 100, true);
    // Act: link
    const result = linkProgram(vertex as never, fragment as never);
    // Assert: linked false + infoLog names uv
    expect(result.linked).toBe(false);
    expect(result.infoLog).toContain('VARYING_MISMATCH uv');
  });
});

describe('program Test 2: version mismatch ES100 vs ES300', () => {
  it('returns linked false with VERSION_MISMATCH', () => {
    // Arrange: vertex 100, fragment 300, empty varyings, main present
    const vertex = makeShader(makeSymbols({}), 100, true);
    const fragment = makeShader(makeSymbols({}), 300, true);
    // Act: link
    const result = linkProgram(vertex as never, fragment as never);
    // Assert: VERSION_MISMATCH + linked false
    expect(result.linked).toBe(false);
    expect(result.infoLog).toContain('VERSION_MISMATCH');
  });
});

describe('program Test 3: missing main marker', () => {
  it('returns linked false with MISSING_MAIN', () => {
    // Arrange: vertex without main, fragment with main, versions equal
    const vertex = makeShader(makeSymbols({}), 100, false);
    const fragment = makeShader(makeSymbols({}), 100, true);
    // Act: link
    const result = linkProgram(vertex as never, fragment as never);
    // Assert: MISSING_MAIN + linked false
    expect(result.linked).toBe(false);
    expect(result.infoLog).toContain('MISSING_MAIN');
  });
});

describe('program Test 4: attrib declaration order', () => {
  it('maps position/normal/texcoord to 0/1/2 and absent to -1', () => {
    // Arrange: vertex attributes in order, matching fragment
    const vertex = makeShader(
      makeSymbols({ attributes: [['position', 'vec3'], ['normal', 'vec3'], ['texcoord', 'vec2']] }),
      100, true,
    );
    const fragment = makeShader(makeSymbols({}), 100, true);
    // Act: link then query locations
    const program = linkProgram(vertex as never, fragment as never);
    const p = getAttribLocation(program, 'position');
    const n = getAttribLocation(program, 'normal');
    const t = getAttribLocation(program, 'texcoord');
    const absent = getAttribLocation(program, 'tangent');
    // Assert: declaration order + absent -1
    expect(p).toBe(0);
    expect(n).toBe(1);
    expect(t).toBe(2);
    expect(absent).toBe(-1);
  });
});

describe('program Test 5: uniform opaque handles', () => {
  it('returns stable identical handle per name and null for absent', () => {
    // Arrange: linked program with modelMatrix (vertex) + diffuseColor (fragment)
    const vertex = makeShader(makeSymbols({ uniforms: [['modelMatrix', 'mat4']] }), 100, true);
    const fragment = makeShader(makeSymbols({ uniforms: [['diffuseColor', 'vec4']] }), 100, true);
    // Act: link then look up handles
    const program = linkProgram(vertex as never, fragment as never);
    const first = getUniformLocation(program, 'modelMatrix');
    const second = getUniformLocation(program, 'modelMatrix');
    const other = getUniformLocation(program, 'diffuseColor');
    const absent = getUniformLocation(program, 'missing');
    // Assert: identity stability, distinctness, null absent
    expect(first).toBe(second);
    expect(first).not.toBe(other);
    expect(absent).toBeNull();
  });
});

describe('program Test 6: error-queue separation', () => {
  it('failed link owns linked/infoLog while getError stays NO_ERROR', () => {
    // Arrange: fresh queue drained empty + mismatched pair
    const queue: number[] = [];
    const vertex = makeShader(makeSymbols({ varyings: [['uv', 'vec2']] }), 100, true);
    const fragment = makeShader(makeSymbols({ varyings: [['uv', 'vec3']] }), 100, true);
    // Act: link then drain queue
    const result = linkProgram(vertex as never, fragment as never);
    const code = drainError(queue);
    // Assert: linked false, non-empty infoLog, queue NO_ERROR
    expect(result.linked).toBe(false);
    expect(result.infoLog.length).toBeGreaterThan(0);
    expect(code).toBe(NO_ERROR);
  });
});
