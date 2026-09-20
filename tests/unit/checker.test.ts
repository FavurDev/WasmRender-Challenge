/** GLSL ES semantic checker TDD red-phase tests (Sprint 3 Task 4) — failing-first suite per pseudocode Tests 1-12. */
import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/glsl/tokenizer';
import type { Token } from '../../src/glsl/tokenizer';
import { runPreprocessor } from '../../src/glsl/preprocessor';
import { parse } from '../../src/glsl/parser';
import type { TranslationUnit } from '../../src/glsl/parser';
import { check } from '../../src/glsl/checker';
import { ErrorSink } from '../../src/gl/errors';
import { NO_ERROR } from '../../src/gl/constants';

const DIAG_RE = /^ERROR: 0:\d+: /;

function pipeline(source: string, version?: number): Token[] {
  // Arrange helper: tokenize then preprocess, unwrapping success.
  const tres = tokenize(source, version);
  if (!tres.ok) throw new Error('tokenize failed: ' + (tres as { log: string }).log);
  const pres = runPreprocessor(tres.tokens, version);
  if (!pres.ok) throw new Error('preprocess failed: ' + (pres as { log: string }).log);
  return (pres as { ok: true; tokens: Token[] }).tokens;
}

function parseUnit(source: string, version: number): TranslationUnit {
  // Arrange helper: full tokenize→preprocess→parse pipeline returning the AST.
  const tokens = pipeline(source, version);
  const pres = parse(tokens, version);
  if (!pres.ok) throw new Error('parse failed: ' + (pres as { log: string }).log);
  return (pres as { ok: true; tokens: TranslationUnit }).tokens;
}

describe('Checker - ES 1.00 clean check (AC-1)', () => {
  it('accepts valid ES 1.00 vertex and fragment shaders', () => {
    // Arrange:
    const vsrc = 'attribute vec4 aPos;\nuniform mat4 uM;\nvoid main() {\n gl_Position = uM * aPos;\n}\n';
    const fsrc = 'precision mediump float;\nvarying vec4 vC;\nvoid main() {\n gl_FragColor = vC;\n}\n';
    const vast = parseUnit(vsrc, 100);
    const fast = parseUnit(fsrc, 100);
    // Act:
    const vres = check(vast, 'vertex', 100);
    const fres = check(fast, 'fragment', 100);
    // Assert:
    expect(vres.ok).toBe(true);
    expect(fres.ok).toBe(true);
  });
});

describe('Checker - ES 3.00 clean check (AC-1, AC-3)', () => {
  it('accepts valid ES 3.00 in/out and layout shaders', () => {
    // Arrange:
    const vsrc = 'layout(location = 0) in vec4 aPos;\nout vec4 vC;\nvoid main() {\n vC = aPos;\n}\n';
    const fsrc = 'precision mediump float;\nin vec4 vC;\nout vec4 fragColor;\nvoid main() {\n fragColor = vC;\n}\n';
    const vast = parseUnit(vsrc, 300);
    const fast = parseUnit(fsrc, 300);
    // Act:
    const vres = check(vast, 'vertex', 300);
    const fres = check(fast, 'fragment', 300);
    // Assert:
    expect(vres.ok).toBe(true);
    expect(fres.ok).toBe(true);
  });
});

describe('Checker - scoping (AC-2)', () => {
  it('permits shadowing across nested scopes', () => {
    // Arrange:
    const src = 'float x = 1.0;\nvoid main() {\n float x = 2.0;\n if (true) {\n float x = 3.0;\n }\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(true);
  });

  it('rejects duplicate declaration in the same scope', () => {
    // Arrange:
    const src = 'void main() {\n float x = 1.0;\n int x = 2;\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    const log = (res as { ok: false; log: string }).log;
    expect(log).toMatch(DIAG_RE);
    expect(log).toContain('ERROR: 0:2:');
    expect(log).toContain("Redeclaration of identifier 'x'");
  });
});

describe('Checker - dialect typing (AC-3)', () => {
  it('rejects int-to-float under ES 1.00 but accepts under ES 3.00', () => {
    // Arrange:
    const src = 'void main() {\n float f = 1;\n}\n';
    const ast100 = parseUnit(src, 100);
    const ast300 = parseUnit(src, 300);
    // Act:
    const res100 = check(ast100, 'vertex', 100);
    const res300 = check(ast300, 'vertex', 300);
    // Assert:
    expect(res100.ok).toBe(false);
    expect((res100 as { ok: false; log: string }).log).toMatch(DIAG_RE);
    expect(res300.ok).toBe(true);
  });
});

describe('Checker - fragment precision (AC-4, M2-7)', () => {
  it('rejects fragment float use without default precision', () => {
    // Arrange:
    const src = 'void main() {\n float x = 1.0;\n gl_FragColor = vec4(x);\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'fragment', 100);
    // Assert:
    expect(res.ok).toBe(false);
    const log = (res as { ok: false; log: string }).log;
    expect(log).toMatch(DIAG_RE);
    expect(log).toContain('ERROR: 0:2:');
    expect(log.toLowerCase()).toContain('precision');
  });
});

describe('Checker - undeclared identifier (AC-5, M2-8)', () => {
  it('reports line-accurate undeclared identifier diagnostic', () => {
    // Arrange:
    const src = 'void main() {\n unknownVar = 1.0;\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    const log = (res as { ok: false; log: string }).log;
    expect(log).toMatch(/ERROR: 0:2: Undeclared identifier 'unknownVar'/);
  });
});

describe('Checker - function calls (AC-6)', () => {
  it('rejects wrong argument count', () => {
    // Arrange:
    const src = 'float add(float a, float b) {\n return a + b;\n}\nvoid main() {\n float r = add(1.0);\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    expect((res as { ok: false; log: string }).log).toMatch(DIAG_RE);
  });

  it('rejects argument type mismatch', () => {
    // Arrange:
    const src = 'float add(float a, float b) {\n return a + b;\n}\nvoid main() {\n float r = add(true, 1.0);\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    expect((res as { ok: false; log: string }).log).toMatch(DIAG_RE);
  });
});

describe('Checker - recursion (AC-7)', () => {
  it('rejects direct self-recursion', () => {
    // Arrange:
    const src = 'void f() {\n f();\n}\nvoid main() {\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    expect((res as { ok: false; log: string }).log).toMatch(DIAG_RE);
  });

  it('rejects mutual recursion', () => {
    // Arrange:
    const src = 'void f();\nvoid g() {\n f();\n}\nvoid f() {\n g();\n}\nvoid main() {\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    expect((res as { ok: false; log: string }).log).toMatch(DIAG_RE);
  });
});

describe('Checker - read-only builtins (AC-8)', () => {
  it('rejects assignment to gl_FragCoord', () => {
    // Arrange:
    const src = 'precision mediump float;\nvoid main() {\n gl_FragCoord = vec4(0.0);\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'fragment', 100);
    // Assert:
    expect(res.ok).toBe(false);
    const log = (res as { ok: false; log: string }).log;
    expect(log).toContain('ERROR: 0:2:');
    expect(log.toLowerCase()).toContain('read-only');
  });
});

describe('Checker - control flow (AC-9)', () => {
  it('rejects non-bool if condition', () => {
    // Arrange:
    const src = 'void main() {\n if (1.0) {\n }\n}\n';
    const ast = parseUnit(src, 100);
    // Act:
    const res = check(ast, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    expect((res as { ok: false; log: string }).log).toMatch(DIAG_RE);
  });
});

describe('Checker - never-throws and ErrorSink isolation (AC-1, AC-10)', () => {
  it('never throws and leaves ErrorSink untouched', () => {
    // Arrange:
    const sink = new ErrorSink();
    const hostile = { kind: 'TranslationUnit', line: 1, declarations: [null, 42, 'x'] } as unknown as TranslationUnit;
    // Act:
    let res: ReturnType<typeof check> | undefined;
    expect(() => {
      res = check(hostile, 'vertex', 100);
    }).not.toThrow();
    // Assert:
    expect(typeof res!.ok).toBe('boolean');
    expect(sink.getError()).toBe(NO_ERROR);
  });
});
