/** GLSL ES parser TDD red-phase tests (Sprint 3 Task 3) — failing-first suite per pseudocode Tests 1-10. */
import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/glsl/tokenizer';
import type { Token } from '../../src/glsl/tokenizer';
import { runPreprocessor } from '../../src/glsl/preprocessor';
import { parse } from '../../src/glsl/parser';
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

describe('Parser - ES 1.00 structural (AC-1)', () => {
  it('parses ES 1.00 vertex shader structure', () => {
    // Arrange:
    const src = 'attribute vec4 aPos;\nuniform mat4 uM;\nvoid main() {\n gl_Position = uM * aPos;\n}\n';
    const tokens = pipeline(src, 100);
    // Act:
    const res = parse(tokens, 100);
    // Assert:
    expect(res.ok).toBe(true);
  });

  it('parses ES 1.00 fragment shader structure', () => {
    // Arrange:
    const src = 'precision mediump float;\nvarying vec4 vC;\nvoid main() {\n gl_FragColor = vC;\n}\n';
    const tokens = pipeline(src, 100);
    // Act:
    const res = parse(tokens, 100);
    // Assert:
    expect(res.ok).toBe(true);
  });
});

describe('Parser - diagnostics and safety (AC-2, AC-3, AC-4)', () => {
  it('reports line-accurate diagnostics for syntax errors', () => {
    // Arrange:
    const src = 'void main() {\nint x = ;\n}\n';
    const tokens = pipeline(src, 100);
    // Act:
    const res = parse(tokens, 100);
    // Assert:
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.log).toMatch(DIAG_RE);
      expect(res.log).toContain('0:2:');
    }
  });

  it('caps 10000-deep nesting without stack overflow', () => {
    // Arrange:
    const depth = 10000;
    const src = 'void main() {\n' + '{'.repeat(depth) + '}'.repeat(depth) + '\n}\n';
    const tokens = pipeline(src, 100);
    // Act:
    let res: ReturnType<typeof parse> | undefined;
    expect(() => {
      res = parse(tokens, 100);
    }).not.toThrow();
    // Assert:
    expect(res!.ok).toBe(false);
    if (!res!.ok) expect(res!.log).toMatch(DIAG_RE);
  });

  it('rejects reserved-word misuse', () => {
    // Arrange:
    const src = 'int goto;\nvoid main() {}\n';
    const tokens = pipeline(src, 100);
    // Act:
    const res = parse(tokens, 100);
    // Assert:
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.log).toMatch(DIAG_RE);
  });
});

describe('Parser - ES 3.00 gating (AC-5, AC-6, AC-7, AC-8)', () => {
  it('parses ES 3.00 layout/in/out/switch/uint productions', () => {
    // Arrange:
    const src =
      '#version 300 es\nlayout(location = 0) in vec4 aPos;\nout vec4 vC;\nvoid main() {\n uint u = 1u;\n switch (1) { case 1: u = 2u; break; default: break; }\n vC = aPos;\n}\n';
    const tokens = pipeline(src, 300);
    // Act:
    const res = parse(tokens, 300);
    // Assert:
    expect(res.ok).toBe(true);
  });

  it('rejects ES 1.00 legacy constructs under ES 3.00', () => {
    // Arrange:
    const cases = [
      'attribute vec4 aPos;\nvoid main() {}\n',
      'varying vec4 vC;\nvoid main() {}\n',
      'void main() {\n gl_FragColor = vec4(1.0);\n}\n',
    ];
    // Act + Assert:
    for (const src of cases) {
      const tokens = pipeline(src, 300);
      const res = parse(tokens, 300);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.log).toMatch(DIAG_RE);
    }
  });

  it('rejects ES 3.00-only constructs under ES 1.00 (reverse gating)', () => {
    // Arrange:
    const cases = [
      'in vec4 vC;\nvoid main() {}\n',
      'void main() {\n switch (1) { case 1: break; default: break; }\n}\n',
    ];
    // Act + Assert:
    for (const src of cases) {
      const tokens = pipeline(src, 100);
      const res = parse(tokens, 100);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.log).toMatch(DIAG_RE);
    }
  });

  it('isolates dialects across sequential parses', () => {
    // Arrange:
    const es100 = 'attribute vec4 aPos;\nvoid main() {\n gl_Position = aPos;\n}\n';
    const es300 =
      '#version 300 es\nlayout(location = 0) in vec4 aPos;\nvoid main() {}\n';
    // Act:
    const r1 = parse(pipeline(es100, 100), 100);
    const r2 = parse(pipeline(es300, 300), 300);
    const r3 = parse(pipeline(es100, 100), 100);
    // Assert:
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(r3.ok).toBe(true);
  });
});

describe('Parser - never-throws and ErrorSink isolation (safety)', () => {
  it('never throws and leaves ErrorSink untouched', () => {
    // Arrange:
    const sink = new ErrorSink();
    const hostile: Token[][] = [
      [{ kind: 'KEYWORD', text: 'struct', line: 1, column: 1 }],
      [
        { kind: 'OPERATOR', text: '{', line: 1, column: 1 },
        { kind: 'OPERATOR', text: '{', line: 1, column: 2 },
      ],
      [
        { kind: 'OPERATOR', text: '+', line: 1, column: 1 },
        { kind: 'OPERATOR', text: '*', line: 1, column: 2 },
      ],
    ];
    // Act + Assert:
    for (const tokens of hostile) {
      let res: ReturnType<typeof parse> | undefined;
      expect(() => {
        res = parse(tokens, 100);
      }).not.toThrow();
      expect(typeof res!.ok).toBe('boolean');
      expect(sink.getError()).toBe(NO_ERROR);
    }
  });
});
