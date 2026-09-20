/** GLSL ES tokenizer red-phase tests (Sprint 3 Task 1) — written against the blueprint; fail until src/glsl/tokenizer.ts exists. */
import { describe, expect, it } from 'vitest';
import { formatDiagnostic, tokenize } from '../../src/glsl/tokenizer';
import type { Token } from '../../src/glsl/tokenizer';
import { ErrorSink } from '../../src/gl/errors';
import { NO_ERROR } from '../../src/gl/constants';

function tokensOf(source: string, version?: number): Token[] {
  // Arrange/Act helper: tokenize and unwrap success branch.
  const result = tokenize(source, version);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected ok');
  return result.tokens;
}

describe('Tokenizer - literals (TEST 1, AC-1)', () => {
  it('all literal forms produce correct token kind, text, and line', () => {
    // Arrange:
    const source = '0 07 0xFF 42u 1.5 .5 1e10 1.0f';
    // Act:
    const tokens = tokensOf(source, 300);
    // Assert:
    const expected: Array<[string, string]> = [
      ['INT_CONSTANT', '0'],
      ['INT_CONSTANT', '07'],
      ['INT_CONSTANT', '0xFF'],
      ['UINT_CONSTANT', '42u'],
      ['FLOAT_CONSTANT', '1.5'],
      ['FLOAT_CONSTANT', '.5'],
      ['FLOAT_CONSTANT', '1e10'],
      ['FLOAT_CONSTANT', '1.0f'],
    ];
    expected.forEach(([kind, text], i) => {
      expect(tokens[i]!.kind).toBe(kind);
      expect(tokens[i]!.text).toBe(text);
      expect(tokens[i]!.line).toBe(1);
    });
    expect(tokens[8]!.kind).toBe('EOF');
    expect(tokens[8]!.text).toBe('');
  });
});

describe('Tokenizer - operators (TEST 2, AC-7)', () => {
  it('multi-char and single-char operators tokenize in order', () => {
    // Arrange:
    const ops = ['++', '--', '<<', '>>', '&&', '||', '^^', '<=', '>=', '==', '!=', '*=', '/=', '+=', '-=', '%=', '<<=', '>>=', '&=', '|=', '^=', '+', '-', '*', '/', '%', '<', '>', '^', '|', '&', '?', ':', ';', '=', ',', '(', ')', '[', ']', '{', '}', '.'];
    const source = ops.join(' ');
    // Act:
    const tokens = tokensOf(source);
    // Assert:
    expect(tokens.length).toBe(ops.length + 1);
    ops.forEach((op, i) => {
      expect(tokens[i]!.kind).toBe('OPERATOR');
      expect(tokens[i]!.text).toBe(op);
    });
    expect(tokens[ops.length]!.kind).toBe('EOF');
  });
});

describe('Tokenizer - keywords (TEST 3, AC-6)', () => {
  it('version-aware keyword and reserved word sets', () => {
    // Arrange:
    const source = 'layout in out switch uint attribute';
    // Act:
    const res100 = tokenize(source, 100);
    const res300 = tokenize(source, 300);
    // Assert:
    expect(res100.ok).toBe(true);
    expect(res300.ok).toBe(true);
    if (!res100.ok || !res300.ok) throw new Error('expected ok');
    const kinds300 = res300.tokens.slice(0, 6).map((t: Token) => t.kind);
    expect(kinds300.slice(0, 5)).toEqual(['KEYWORD', 'KEYWORD', 'KEYWORD', 'KEYWORD', 'KEYWORD']);
    expect(['KEYWORD', 'RESERVED']).toContain(res300.tokens[5]!.kind);
    const kinds100 = res100.tokens.slice(0, 6).map((t: Token) => t.kind);
    expect(kinds100[5]).toBe('KEYWORD');
    for (const k of kinds100.slice(0, 5)) {
      expect(['IDENTIFIER', 'RESERVED']).toContain(k);
    }
  });
});

describe('Tokenizer - error injection (TEST 4-6, AC-2)', () => {
  it('TEST 4: unterminated block comment yields line-2 diagnostic', () => {
    // Arrange:
    const source = 'int a = 1;\n/* unterminated comment\nstill going';
    // Act:
    const result = tokenize(source);
    // Assert:
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.log).toMatch(/^ERROR: 0:2: /);
  });

  it("TEST 5: illegal character '$' on line 3 yields diagnostic", () => {
    // Arrange:
    const source = 'int a;\nfloat b;\n$ illegal';
    // Act:
    const result = tokenize(source);
    // Assert:
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.log).toMatch(/^ERROR: 0:3: /);
    expect(result.log).toContain("Unexpected character '$'");
  });

  it('TEST 6: malformed hex, octal, and exponent yield line-1 diagnostics', () => {
    // Arrange:
    const hex = 'int x = 0x;';
    const oct = 'int y = 08;';
    const exp = 'float z = 1e;';
    // Act:
    const resHex = tokenize(hex);
    const resOct = tokenize(oct);
    const resExp = tokenize(exp);
    // Assert:
    expect(resHex.ok).toBe(false);
    expect(resOct.ok).toBe(false);
    expect(resExp.ok).toBe(false);
    if (resHex.ok || resOct.ok || resExp.ok) throw new Error('expected failures');
    expect(resHex.log).toMatch(/^ERROR: 0:1: /);
    expect(resOct.log).toMatch(/^ERROR: 0:1: /);
    expect(resExp.log).toMatch(/^ERROR: 0:1: /);
  });
});

describe('Tokenizer - line tracking (TEST 7, AC-3)', () => {
  it('comments omitted and line numbers advance correctly', () => {
    // Arrange:
    const source = '// Line 1 comment\nint a; // Line 2 comment\n/*\n   Multi-line\n   block comment\n*/\nfloat b;';
    // Act:
    const tokens = tokensOf(source);
    // Assert:
    for (const t of tokens) {
      expect(t.text).not.toContain('//');
      expect(t.text).not.toContain('/*');
    }
    const texts = tokens.map((t) => t.text);
    const intIdx = texts.indexOf('int');
    expect(tokens[intIdx]!.line).toBe(2);
    expect(tokens[intIdx + 1]!.line).toBe(2);
    expect(tokens[intIdx + 2]!.line).toBe(2);
    const floatIdx = texts.indexOf('float');
    expect(tokens[floatIdx]!.line).toBe(7);
    expect(tokens[floatIdx + 1]!.line).toBe(7);
    expect(tokens[floatIdx + 2]!.line).toBe(7);
  });
});

describe('Tokenizer - never throws (TEST 8, AC-4)', () => {
  it('hostile inputs never throw and never record GL errors', () => {
    // Arrange:
    const inputs = ['', '\0', '$$$', '/*', '089', '0x', '1e', '??', '##', '\r\r\n\n\r', '   \t\t\n  '];
    const sink = new ErrorSink();
    // Act + Assert:
    for (const input of inputs) {
      let result: ReturnType<typeof tokenize> | undefined;
      expect(() => {
        result = tokenize(input);
      }).not.toThrow();
      expect(typeof result!.ok).toBe('boolean');
      expect(sink.getError()).toBe(NO_ERROR);
    }
  });
});

describe('Tokenizer - diagnostics format (TEST 9, AC-5)', () => {
  it('formatDiagnostic emits exact spec format', () => {
    // Arrange:
    const line = 42;
    const message = 'Syntax error';
    // Act:
    const diagDefault = formatDiagnostic(line, message);
    const diagCustom = formatDiagnostic(line, message, 3);
    const diagString = formatDiagnostic(line, message, 'shader1');
    // Assert:
    expect(diagDefault).toBe('ERROR: 0:42: Syntax error');
    expect(diagCustom).toBe('ERROR: 3:42: Syntax error');
    expect(diagString).toBe('ERROR: shader1:42: Syntax error');
  });
});

describe('Tokenizer - boolean constants (TEST 10, AC-1)', () => {
  it('true and false produce BOOL_CONSTANT tokens', () => {
    // Arrange:
    const source = 'bool flag = true && false;';
    // Act:
    const tokens = tokensOf(source);
    // Assert:
    const byText = new Map(tokens.map((t) => [t.text, t]));
    expect(byText.get('true')!.kind).toBe('BOOL_CONSTANT');
    expect(byText.get('false')!.kind).toBe('BOOL_CONSTANT');
  });
});
