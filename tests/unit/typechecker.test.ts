/** Typechecker TDD red-phase tests (9 cases). Headless Node vitest, hand-built AST records, no parser/tokenizer. */
import { describe, expect, it } from 'vitest';
import { typecheckProgram } from '../../src/renderer/shader-compiler/typechecker';
import type { ASTProgramLike, SymbolTable } from '../../src/renderer/shader-compiler/typechecker';
import { BUILTINS_100 } from '../../src/renderer/shader-compiler/builtins-100';
import { BUILTINS_300 } from '../../src/renderer/shader-compiler/builtins-300';
import { ShaderCompileError } from '../../src/renderer/errors';

type Decl = { kind: string; name: string; type: string; line: number; location?: number };
type Fn = { name: string; returnType: string; line: number; body: unknown[] };

function prog(version: 100 | 300, declarations: Decl[], functions: Fn[], stage: 'vertex' | 'fragment' = 'vertex'): ASTProgramLike {
  return { version, stage, declarations, functions } as unknown as ASTProgramLike;
}
function mainFn(line = 5, body: unknown[] = []): Fn {
  return { name: 'main', returnType: 'void', line, body };
}
function assignStmt(target: string, targetType: string, exprType: string, line: number): unknown {
  return { kind: 'assign', target, targetType, exprType, line };
}
function callStmt(name: string, argTypes: string[], line: number): unknown {
  return { kind: 'call', name, argTypes, line };
}
function identUse(name: string, line: number): unknown {
  return { kind: 'ident', name, line };
}

describe('typechecker TEST-1: 300 int-to-float assignment rejects TYPE_MISMATCH', () => {
  it('rejects int where float required under 300', () => {
    // Arrange: 300 vertex program assigning int to float
    const p = prog(300, [], [mainFn(5, [assignStmt('x', 'float', 'int', 6)])]);
    // Act: typecheck against 300 table
    const act = (): SymbolTable => typecheckProgram(p, BUILTINS_300);
    // Assert: throws TYPE_MISMATCH
    expect(act).toThrowError(ShaderCompileError);
    try { act(); } catch (e) { expect((e as Error).message).toContain('TYPE_MISMATCH'); }
  });
});

describe('typechecker TEST-2: 100 int-to-float assignment succeeds', () => {
  it('accepts int where float required under 100', () => {
    // Arrange: same shape under 100
    const p = prog(100, [], [mainFn(5, [assignStmt('x', 'float', 'int', 6)])]);
    // Act: typecheck against 100 table
    const result = typecheckProgram(p, BUILTINS_100);
    // Assert: returns SymbolTable
    expect(result.uniforms).toBeDefined();
  });
});

describe('typechecker TEST-3: 300 int-arg builtin call rejects TYPE_MISMATCH', () => {
  it('rejects int arg to float-param builtin under 300', () => {
    // Arrange: 300 program calling sin with int
    const p = prog(300, [], [mainFn(5, [callStmt('sin', ['int'], 6)])]);
    // Act
    const act = (): SymbolTable => typecheckProgram(p, BUILTINS_300);
    // Assert: TYPE_MISMATCH
    expect(act).toThrowError(ShaderCompileError);
    try { act(); } catch (e) { expect((e as Error).message).toContain('TYPE_MISMATCH'); }
  });
});

describe('typechecker TEST-4: 100 int-arg builtin call succeeds', () => {
  it('coerces int arg to float-param builtin under 100', () => {
    // Arrange: same call under 100
    const p = prog(100, [], [mainFn(5, [callStmt('sin', ['int'], 6)])]);
    // Act
    const result = typecheckProgram(p, BUILTINS_100);
    // Assert: returns SymbolTable
    expect(result.uniforms).toBeDefined();
  });
});

describe('typechecker TEST-5: undeclared identifier on line 4', () => {
  it('names LINE 4 with UNDECLARED', () => {
    // Arrange: statement on line 4 referencing undeclared name
    const p = prog(100, [], [mainFn(5, [identUse('nope', 4)])]);
    // Act
    const act = (): SymbolTable => typecheckProgram(p, BUILTINS_100);
    // Assert: line 4 and UNDECLARED
    try { act(); expect.unreachable(); } catch (e) {
      expect(e).toBeInstanceOf(ShaderCompileError);
      expect((e as ShaderCompileError).line).toBe(4);
      expect((e as Error).message).toContain('UNDECLARED');
    }
  });
});

describe('typechecker TEST-6: missing main rejects MISSING_MAIN', () => {
  it('rejects program with no main', () => {
    // Arrange: empty functions
    const p = prog(100, [], []);
    // Act
    const act = (): SymbolTable => typecheckProgram(p, BUILTINS_100);
    // Assert: MISSING_MAIN
    expect(act).toThrowError(ShaderCompileError);
    try { act(); } catch (e) { expect((e as Error).message).toContain('MISSING_MAIN'); }
  });
});

describe('typechecker TEST-7: texture in 100 rejects UNKNOWN_BUILTIN', () => {
  it('rejects texture under 100', () => {
    // Arrange: 100 program calling texture
    const p = prog(100, [], [mainFn(5, [callStmt('texture', ['sampler2D', 'vec2'], 6)])]);
    // Act
    const act = (): SymbolTable => typecheckProgram(p, BUILTINS_100);
    // Assert: UNKNOWN_BUILTIN texture
    try { act(); expect.unreachable(); } catch (e) { expect((e as Error).message).toContain('UNKNOWN_BUILTIN'); }
  });
});

describe('typechecker TEST-8: texture2D in 300 rejects UNKNOWN_BUILTIN', () => {
  it('rejects texture2D under 300', () => {
    // Arrange: 300 program calling texture2D
    const p = prog(300, [], [mainFn(5, [callStmt('texture2D', ['sampler2D', 'vec2'], 6)])]);
    // Act
    const act = (): SymbolTable => typecheckProgram(p, BUILTINS_300);
    // Assert: UNKNOWN_BUILTIN texture2D
    try { act(); expect.unreachable(); } catch (e) { expect((e as Error).message).toContain('UNKNOWN_BUILTIN'); }
  });
});

describe('typechecker TEST-9: SymbolTable shape for clean 100 vertex program', () => {
  it('returns uniforms, attributes 0,1, varyings', () => {
    // Arrange: clean 100 vertex program
    const decls: Decl[] = [
      { kind: 'uniform', name: 'uM', type: 'mat4', line: 1 },
      { kind: 'attribute', name: 'aPos', type: 'vec3', line: 2 },
      { kind: 'attribute', name: 'aUv', type: 'vec2', line: 3 },
      { kind: 'varying', name: 'vUv', type: 'vec2', line: 4 },
    ];
    const p = prog(100, decls, [mainFn(5, [])]);
    // Act
    const result = typecheckProgram(p, BUILTINS_100);
    // Assert: shape
    expect(result.uniforms.get('uM')).toBe('mat4');
    expect(result.attributes.get('aPos')).toEqual({ type: 'vec3', location: 0 });
    expect(result.attributes.get('aUv')).toEqual({ type: 'vec2', location: 1 });
    expect(result.varyings.get('vUv')).toBe('vec2');
  });
});
