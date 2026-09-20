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

import { describe as describePre, expect as expectPre, it as itPre } from 'vitest';
import { runPreprocessor } from '../../src/glsl/preprocessor';

function preprocessOk(source: string, version?: number) {
  // Arrange helper: tokenize then preprocess, unwrap success branch.
  const tres = tokenize(source, version);
  expectPre(tres.ok).toBe(true);
  if (!tres.ok) throw new Error('tokenize failed');
  const pres = runPreprocessor(tres.tokens, version);
  expectPre(pres.ok).toBe(true);
  if (!pres.ok) throw new Error('expected ok');
  return pres.tokens;
}

describePre('Preprocessor - object macro (TEST 1, AC-1)', () => {
  itPre('object macro #define A 2 expands to 2 at use site', () => {
    // Arrange:
    const source = '#define A 2\nint x = A;';
    const tres = tokenize(source);
    expectPre(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expectPre(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    const hit = pres.tokens.find((t) => t.text === '2' && t.line === 2);
    expectPre(hit).toBeDefined();
    expectPre(hit).toMatchObject({ kind: 'INT_CONSTANT', text: '2', line: 2 });
  });
});

describePre('Preprocessor - undef diagnostic (TEST 2, AC-2)', () => {
  itPre('#undef A then use of A yields ok:false with line-3 diagnostic', () => {
    // Arrange:
    const source = '#define A 2\n#undef A\nint x = A;';
    const tres = tokenize(source);
    expectPre(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expectPre(pres.ok).toBe(false);
    if (pres.ok) throw new Error('expected failure');
    expectPre(pres.log).toMatch(/^ERROR: 0:3: /);
  });
});

describePre('Preprocessor - function macro (TEST 3, AC-3)', () => {
  itPre('MUL(1+2) substitutes textually to ((1+2)*(1+2))', () => {
    // Arrange:
    const source = '#define MUL(x) ((x)*(x))\nint y = MUL(1+2);';
    const tres = tokenize(source);
    expectPre(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expectPre(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    const seq = pres.tokens.filter((t) => t.line === 2).map((t) => t.text).join('');
    expectPre(seq).toContain('((1+2)*(1+2))');
  });
});

describePre('Preprocessor - recursion termination (TEST 4-5, AC-4)', () => {
  itPre('self-recursive #define R R terminates with R unexpanded', () => {
    // Arrange:
    const source = '#define R R\nint x = R;';
    const tres = tokenize(source);
    expectPre(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expectPre(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    expectPre(pres.tokens.some((t) => t.text === 'R' && t.kind === 'IDENTIFIER')).toBe(true);
  });

  itPre('mutually recursive X/Y terminates cleanly', () => {
    // Arrange:
    const source = '#define X Y\n#define Y X\nint a = X;';
    const tres = tokenize(source);
    expectPre(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expectPre(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
  });
});

describePre('Preprocessor - caps (TEST 6-7, AC-5)', () => {
  itPre('expansion depth beyond 64 yields depth-limit diagnostic', () => {
    // Arrange:
    let src = '#define M0 1\n';
    for (let i = 1; i <= 65; i++) src += '#define M' + i + ' M' + (i - 1) + '\n';
    src += 'int val = M65;';
    const tres = tokenize(src);
    expectPre(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expectPre(pres.ok).toBe(false);
    if (pres.ok) throw new Error('expected failure');
    expectPre(pres.log).toMatch(/^ERROR: 0:\d+: /);
    expectPre(pres.log.toLowerCase()).toContain('depth');
  });

  itPre('exponential growth beyond 65536 tokens yields token-cap diagnostic', () => {
    // Arrange:
    let src = '#define D0 1 1\n';
    for (let i = 1; i <= 16; i++) src += '#define D' + i + ' D' + (i - 1) + ' D' + (i - 1) + '\n';
    src += 'int v = D16;';
    const tres = tokenize(src);
    expectPre(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expectPre(pres.ok).toBe(false);
    if (pres.ok) throw new Error('expected failure');
    expectPre(pres.log).toMatch(/^ERROR: 0:\d+: /);
    expectPre(pres.log.toLowerCase()).toContain('token');
  });
});

describePre('Preprocessor - stringify and paste (TEST 8-9, AC-6)', () => {
  itPre('# stringifies argument to quoted text', () => {
    // Arrange:
    const source = '#define STR(x) #x\nSTR(hello world)';
    const tres = tokenize(source);
    expectPre(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expectPre(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    expectPre(pres.tokens.some((t) => t.text === '"hello world"')).toBe(true);
  });

  itPre('## pastes to single composite token my_var', () => {
    // Arrange:
    const source = '#define GLUE(a, b) a##b\nint GLUE(my_, var) = 5;';
    const tres = tokenize(source);
    expectPre(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expectPre(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    const hit = pres.tokens.find((t) => t.text === 'my_var');
    expectPre(hit).toBeDefined();
    expectPre(hit).toMatchObject({ kind: 'IDENTIFIER', text: 'my_var' });
  });
});

describePre('Preprocessor - never throws and ErrorSink isolation (TEST 10)', () => {
  itPre('hostile inputs return ok:false, never throw, sink stays NO_ERROR', () => {
    // Arrange:
    const sink = new ErrorSink();
    const inputs = ['#define\n', '#undef\n', '#define F( 1 2\n', '#define B\nint x = B(1,2);'];
    // Act + Assert:
    for (const input of inputs) {
      const tres = tokenize(input);
      if (!tres.ok) continue;
      let pres: ReturnType<typeof runPreprocessor> | undefined;
      expectPre(() => {
        pres = runPreprocessor(tres.tokens);
      }).not.toThrow();
      expectPre(typeof pres!.ok).toBe('boolean');
      expectPre(sink.getError()).toBe(NO_ERROR);
    }
  });
});
