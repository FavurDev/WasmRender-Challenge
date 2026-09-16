/** Builtin signature tables TDD red-phase tests (8 cases). Headless Node vitest, no DOM/canvas, pure data. */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTINS_100 } from '../../src/renderer/shader-compiler/builtins-100';
import { BUILTINS_300 } from '../../src/renderer/shader-compiler/builtins-300';

type Overload = { paramTypes: readonly string[]; returnType: string };
type Table = Readonly<Record<string, readonly Overload[]>>;

function keysOf(table: Table): string[] {
  // Arrange helper: fixed literal data access
  return Object.keys(table);
}

describe('builtins TEST-1: ES 1.00 table holds exactly 42 keys', () => {
  it('count of keys in ES 1.00 lookup equals 42', () => {
    // Arrange: fixed reference to the frozen ES 1.00 lookup
    const table: Table = BUILTINS_100 as unknown as Table;
    // Act: result = count of keys in the lookup
    const result = keysOf(table).length;
    // Assert: result equals 42
    expect(result).toBe(42);
  });
});

describe('builtins TEST-2: ES 3.00 table holds exactly 68 keys', () => {
  it('count of keys in ES 3.00 lookup equals 68', () => {
    // Arrange: fixed reference to the frozen ES 3.00 lookup
    const table: Table = BUILTINS_300 as unknown as Table;
    // Act: result = count of keys in the lookup
    const result = keysOf(table).length;
    // Assert: result equals 68
    expect(result).toBe(68);
  });
});

describe('builtins TEST-3: ES 1.00 presence spot check', () => {
  it('keeps legacy texture family and excludes modern names', () => {
    // Arrange: fixed reference to the frozen ES 1.00 lookup
    const table: Table = BUILTINS_100 as unknown as Table;
    // Act: presence flags for legacy names, absence flags for modern names
    const present = (n: string): boolean => n in table;
    // Assert: three legacy names present, three modern names absent
    expect(present('texture2D')).toBe(true);
    expect(present('texture2DProj')).toBe(true);
    expect(present('textureCube')).toBe(true);
    expect(present('texture')).toBe(false);
    expect(present('texelFetch')).toBe(false);
    expect(present('dFdx')).toBe(false);
  });
});

describe('builtins TEST-4: ES 3.00 presence spot check', () => {
  it('keeps modern texture and derivative families and excludes legacy names', () => {
    // Arrange: fixed reference to the frozen ES 3.00 lookup
    const table: Table = BUILTINS_300 as unknown as Table;
    // Act: presence flags for modern names, absence flags for legacy names
    const present = (n: string): boolean => n in table;
    // Assert: six modern names present, two legacy names absent
    expect(present('texture')).toBe(true);
    expect(present('texelFetch')).toBe(true);
    expect(present('textureSize')).toBe(true);
    expect(present('dFdx')).toBe(true);
    expect(present('dFdy')).toBe(true);
    expect(present('fwidth')).toBe(true);
    expect(present('texture2D')).toBe(false);
    expect(present('textureCube')).toBe(false);
  });
});

describe('builtins TEST-5: texture absent from ES 1.00', () => {
  it('texture lookup against ES 1.00 reports absence for later UNKNOWN_BUILTIN', () => {
    // Arrange: fixed reference to the frozen ES 1.00 lookup and the name texture
    const table: Table = BUILTINS_100 as unknown as Table;
    const name = 'texture';
    // Act: result = lookup of texture in the ES 1.00 table
    const result: readonly Overload[] | undefined = table[name];
    // Assert: result reports absence, which the later typechecker converts to UNKNOWN_BUILTIN
    expect(result).toBeUndefined();
  });
});

describe('builtins TEST-6: texture2D absent from ES 3.00', () => {
  it('texture2D lookup against ES 3.00 reports absence for later UNKNOWN_BUILTIN', () => {
    // Arrange: fixed reference to the frozen ES 3.00 lookup and the name texture2D
    const table: Table = BUILTINS_300 as unknown as Table;
    const name = 'texture2D';
    // Act: result = lookup of texture2D in the ES 3.00 table
    const result: readonly Overload[] | undefined = table[name];
    // Assert: result reports absence, which the later typechecker converts to UNKNOWN_BUILTIN
    expect(result).toBeUndefined();
  });
});

describe('builtins TEST-7: zero module-loading statements', () => {
  it('both table modules contain zero imports and no cross-references', () => {
    // Arrange: source text of both table modules
    const here = path.dirname(fileURLToPath(import.meta.url));
    const p100 = path.resolve(here, '../../src/renderer/shader-compiler/builtins-100.ts');
    const p300 = path.resolve(here, '../../src/renderer/shader-compiler/builtins-300.ts');
    const t100 = fs.readFileSync(p100, 'utf8');
    const t300 = fs.readFileSync(p300, 'utf8');
    // Act: scan for module-loading statements and cross-table references in both files
    const imports100 = t100.match(/^\s*import\s/mg) ?? [];
    const imports300 = t300.match(/^\s*import\s/mg) ?? [];
    const requires = (t: string): RegExpMatchArray | [] => t.match(/require\s*\(/g) ?? [];
    const cross100 = t100.includes('builtins-300');
    const cross300 = t300.includes('builtins-100');
    // Assert: scan output is empty for both files
    expect(imports100.length).toBe(0);
    expect(imports300.length).toBe(0);
    expect(requires(t100).length).toBe(0);
    expect(requires(t300).length).toBe(0);
    expect(cross100).toBe(false);
    expect(cross300).toBe(false);
  });
});

describe('builtins TEST-8: non-empty overloads and frozen exports', () => {
  it('every table value holds a non-empty overload list and both exports resist mutation', () => {
    // Arrange: fixed references to both frozen lookups
    const t100: Table = BUILTINS_100 as unknown as Table;
    const t300: Table = BUILTINS_300 as unknown as Table;
    // Act: empty-list flags across all values, plus mutation attempt against both published lookups
    const empty100 = Object.values(t100).filter((v) => v.length === 0);
    const empty300 = Object.values(t300).filter((v) => v.length === 0);
    const before100 = Object.keys(t100).length;
    const before300 = Object.keys(t300).length;
    try {
      (t100 as Record<string, readonly Overload[]>)['__mut__'] = [];
    } catch { /* frozen: throws in strict mode */ }
    try {
      (t300 as Record<string, readonly Overload[]>)['__mut__'] = [];
    } catch { /* frozen: throws in strict mode */ }
    // Assert: no value holds an empty overload list and both lookups remain unchanged
    expect(empty100.length).toBe(0);
    expect(empty300.length).toBe(0);
    expect(Object.keys(t100).length).toBe(before100);
    expect(Object.keys(t300).length).toBe(before300);
    expect('__mut__' in t100).toBe(false);
    expect('__mut__' in t300).toBe(false);
  });
});
