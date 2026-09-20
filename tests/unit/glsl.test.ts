/** GLSL front-end consolidated suite (Sprint 3 Task 5) — restored committed unit tests + pipeline integration (TDD red phase). */
import { describe, expect, it } from 'vitest';
import { formatDiagnostic, tokenize } from '../../src/glsl/tokenizer';
import type { CompileResult, Token } from '../../src/glsl/tokenizer';
import { runPreprocessor } from '../../src/glsl/preprocessor';
import { parse } from '../../src/glsl/parser';
import { check } from '../../src/glsl/checker';
import type { CheckedShader } from '../../src/glsl/checker';
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

describe('Preprocessor - object macro (TEST 1, AC-1)', () => {
  it('object macro #define A 2 expands to 2 at use site', () => {
    // Arrange:
    const source = '#define A 2\nint x = A;';
    const tres = tokenize(source);
    expect(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expect(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    const hit = pres.tokens.find((t) => t.text === '2' && t.line === 2);
    expect(hit).toBeDefined();
    expect(hit).toMatchObject({ kind: 'INT_CONSTANT', text: '2', line: 2 });
  });
});

describe('Preprocessor - undef diagnostic (TEST 2, AC-2)', () => {
  it('#undef A then use of A yields ok:false with line-3 diagnostic', () => {
    // Arrange:
    const source = '#define A 2\n#undef A\nint x = A;';
    const tres = tokenize(source);
    expect(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expect(pres.ok).toBe(false);
    if (pres.ok) throw new Error('expected failure');
    expect(pres.log).toMatch(/^ERROR: 0:3: /);
  });
});

describe('Preprocessor - function macro (TEST 3, AC-3)', () => {
  it('MUL(1+2) substitutes textually to ((1+2)*(1+2))', () => {
    // Arrange:
    const source = '#define MUL(x) ((x)*(x))\nint y = MUL(1+2);';
    const tres = tokenize(source);
    expect(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expect(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    const seq = pres.tokens.filter((t) => t.line === 2).map((t) => t.text).join('');
    expect(seq).toContain('((1+2)*(1+2))');
  });
});

describe('Preprocessor - recursion termination (TEST 4-5, AC-4)', () => {
  it('self-recursive #define R R terminates with R unexpanded', () => {
    // Arrange:
    const source = '#define R R\nint x = R;';
    const tres = tokenize(source);
    expect(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expect(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    expect(pres.tokens.some((t) => t.text === 'R' && t.kind === 'IDENTIFIER')).toBe(true);
  });

  it('mutually recursive X/Y terminates cleanly', () => {
    // Arrange:
    const source = '#define X Y\n#define Y X\nint a = X;';
    const tres = tokenize(source);
    expect(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expect(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
  });
});

describe('Preprocessor - caps (TEST 6-7, AC-5)', () => {
  it('expansion depth beyond 64 yields depth-limit diagnostic', () => {
    // Arrange:
    let src = '#define M0 1\n';
    for (let i = 1; i <= 65; i++) src += '#define M' + i + ' M' + (i - 1) + '\n';
    src += 'int val = M65;';
    const tres = tokenize(src);
    expect(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expect(pres.ok).toBe(false);
    if (pres.ok) throw new Error('expected failure');
    expect(pres.log).toMatch(/^ERROR: 0:\d+: /);
    expect(pres.log.toLowerCase()).toContain('depth');
  });

  it('exponential growth beyond 65536 tokens yields token-cap diagnostic', () => {
    // Arrange:
    let src = '#define D0 1 1\n';
    for (let i = 1; i <= 16; i++) src += '#define D' + i + ' D' + (i - 1) + ' D' + (i - 1) + '\n';
    src += 'int v = D16;';
    const tres = tokenize(src);
    expect(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expect(pres.ok).toBe(false);
    if (pres.ok) throw new Error('expected failure');
    expect(pres.log).toMatch(/^ERROR: 0:\d+: /);
    expect(pres.log.toLowerCase()).toContain('token');
  });
});

describe('Preprocessor - stringify and paste (TEST 8-9, AC-6)', () => {
  it('# stringifies argument to quoted text', () => {
    // Arrange:
    const source = '#define STR(x) #x\nSTR(hello world)';
    const tres = tokenize(source);
    expect(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expect(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    expect(pres.tokens.some((t) => t.text === '"hello world"')).toBe(true);
  });

  it('## pastes to single composite token my_var', () => {
    // Arrange:
    const source = '#define GLUE(a, b) a##b\nint GLUE(my_, var) = 5;';
    const tres = tokenize(source);
    expect(tres.ok).toBe(true);
    if (!tres.ok) throw new Error('tokenize failed');
    // Act:
    const pres = runPreprocessor(tres.tokens);
    // Assert:
    expect(pres.ok).toBe(true);
    if (!pres.ok) throw new Error('expected ok');
    const hit = pres.tokens.find((t) => t.text === 'my_var');
    expect(hit).toBeDefined();
    expect(hit).toMatchObject({ kind: 'IDENTIFIER', text: 'my_var' });
  });
});

describe('Preprocessor - never throws and ErrorSink isolation (TEST 10)', () => {
  it('hostile inputs return ok:false, never throw, sink stays NO_ERROR', () => {
    // Arrange:
    const sink = new ErrorSink();
    const inputs = ['#define\n', '#undef\n', '#define F( 1 2\n', '#define B\nint x = B(1,2);'];
    // Act + Assert:
    for (const input of inputs) {
      const tres = tokenize(input);
      if (!tres.ok) continue;
      let pres: ReturnType<typeof runPreprocessor> | undefined;
      expect(() => {
        pres = runPreprocessor(tres.tokens);
      }).not.toThrow();
      expect(typeof pres!.ok).toBe('boolean');
      expect(sink.getError()).toBe(NO_ERROR);
    }
  });
});

const DIAG_RE = /^ERROR: 0:\d+: /;

type Stage = 'vertex' | 'fragment';

function fullPipeline(source: string, stage: Stage, version?: number): CompileResult<CheckedShader> {
  const v: 100 | 300 = version === 300 ? 300 : 100;
  // Step 1: Tokenize
  const tres = tokenize(source, v);
  if (!tres.ok) return tres;
  // Step 2: Preprocess
  const pres = runPreprocessor(tres.tokens, v);
  if (!pres.ok) return pres;
  // Step 3: Parse
  const pares = parse(pres.tokens, v);
  if (!pares.ok) return pares;
  // Step 4: Check
  return check(pares.tokens, stage, v);
}

function failLog(res: CompileResult<CheckedShader>): string {
  if (res.ok) throw new Error('expected failure result');
  return res.log;
}

describe('GLSL Front-End Pipeline Integration - smoke (AC-1)', () => {
  it('ES 1.00 vertex shader clean compilation', () => {
    // Arrange:
    const vsrc = 'attribute vec4 aPos;\nuniform mat4 uM;\nvoid main() {\n gl_Position = uM * aPos;\n}\n';
    // Act:
    const res = fullPipeline(vsrc, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(true);
  });

  it('ES 1.00 fragment shader clean compilation', () => {
    // Arrange:
    const fsrc = 'precision mediump float;\nvarying vec4 vC;\nvoid main() {\n gl_FragColor = vC;\n}\n';
    // Act:
    const res = fullPipeline(fsrc, 'fragment', 100);
    // Assert:
    expect(res.ok).toBe(true);
  });

  it('ES 3.00 vertex shader clean compilation', () => {
    // Arrange:
    const vsrc = 'layout(location = 0) in vec4 aPos;\nout vec4 vC;\nvoid main() {\n vC = aPos;\n}\n';
    // Act:
    const res = fullPipeline(vsrc, 'vertex', 300);
    // Assert:
    expect(res.ok).toBe(true);
  });

  it('ES 3.00 fragment shader clean compilation', () => {
    // Arrange:
    const fsrc = 'precision mediump float;\nin vec4 vC;\nout vec4 fragColor;\nvoid main() {\n fragColor = vC;\n}\n';
    // Act:
    const res = fullPipeline(fsrc, 'fragment', 300);
    // Assert:
    expect(res.ok).toBe(true);
  });
});

describe('GLSL Front-End Pipeline Integration - ES 3.00 gating (AC-2)', () => {
  it('ES 3.00 rejects attribute keyword with line diagnostic', () => {
    // Arrange:
    const src = 'attribute vec4 aPos;\nvoid main() {\n gl_Position = aPos;\n}\n';
    // Act:
    const res = fullPipeline(src, 'vertex', 300);
    // Assert:
    expect(res.ok).toBe(false);
    expect(failLog(res)).toMatch(DIAG_RE);
    expect(failLog(res)).toContain('ERROR: 0:');
  });

  it('ES 3.00 rejects varying keyword with line diagnostic', () => {
    // Arrange:
    const src = 'varying vec4 vColor;\nvoid main() {\n}\n';
    // Act:
    const res = fullPipeline(src, 'vertex', 300);
    // Assert:
    expect(res.ok).toBe(false);
    expect(failLog(res)).toMatch(DIAG_RE);
  });

  it('ES 3.00 rejects gl_FragColor assignment', () => {
    // Arrange:
    const src = 'precision mediump float;\nvoid main() {\n gl_FragColor = vec4(1.0);\n}\n';
    // Act:
    const res = fullPipeline(src, 'fragment', 300);
    // Assert:
    expect(res.ok).toBe(false);
    expect(failLog(res)).toMatch(DIAG_RE);
    expect(failLog(res)).toContain('gl_FragColor');
  });

  it('ES 3.00 rejects texture2D builtin function', () => {
    // Arrange:
    const src =
      'precision mediump float;\nuniform sampler2D uSampler;\nin vec2 vUV;\nout vec4 fragColor;\nvoid main() {\n fragColor = texture2D(uSampler, vUV);\n}\n';
    // Act:
    const res = fullPipeline(src, 'fragment', 300);
    // Assert:
    expect(res.ok).toBe(false);
    expect(failLog(res)).toMatch(DIAG_RE);
    expect(failLog(res).toLowerCase()).toContain('texture2d');
  });

  it('ES 3.00 rejects textureCube builtin function', () => {
    // Arrange:
    const src =
      'precision mediump float;\nuniform samplerCube uCube;\nin vec3 vDir;\nout vec4 fragColor;\nvoid main() {\n fragColor = textureCube(uCube, vDir);\n}\n';
    // Act:
    const res = fullPipeline(src, 'fragment', 300);
    // Assert:
    expect(res.ok).toBe(false);
    expect(failLog(res)).toMatch(DIAG_RE);
    expect(failLog(res).toLowerCase()).toContain('texturecube');
  });
});

describe('GLSL Front-End Pipeline Integration - ES 1.00 acceptance (AC-3)', () => {
  it('ES 1.00 accepts texture2D and textureCube', () => {
    // Arrange:
    const src =
      'precision mediump float;\nuniform sampler2D uS;\nuniform samplerCube uC;\nvarying vec2 vUV;\nvarying vec3 vDir;\nvoid main() {\n vec4 a = texture2D(uS, vUV);\n vec4 b = textureCube(uC, vDir);\n gl_FragColor = a + b;\n}\n';
    // Act:
    const res = fullPipeline(src, 'fragment', 100);
    // Assert:
    expect(res.ok).toBe(true);
  });
});

describe('GLSL Front-End Pipeline Integration - M2 tests (AC-4..AC-9)', () => {
  it('M2-1: #define expands value and #undef triggers undeclared identifier', () => {
    // Arrange:
    const src =
      '#define A 2\nvoid main() {\n float x = float(A);\n}\n#undef A\nvoid helper() {\n float y = float(A);\n}\n';
    // Act:
    const res = fullPipeline(src, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    expect(failLog(res)).toMatch(/ERROR: 0:\d+: Undeclared identifier 'A'/);
  });

  it('M2-2: #if defined(X) branch selection', () => {
    // Arrange:
    const src =
      '#define X\n#if defined(X)\nfloat val = 1.0;\n#else\nfloat val = 2.0;\n#endif\nvoid main() {\n}\n';
    // Act:
    const res = fullPipeline(src, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(true);
  });

  it('M2-3: __VERSION__ expands to 100 in ES 1.00 and 300 in ES 3.00', () => {
    // Arrange:
    const src100 = '#if __VERSION__ == 100\nfloat v = 1.0;\n#else\nfloat v = 2.0;\n#endif\nvoid main() {\n}\n';
    const src300 = '#if __VERSION__ == 300\nfloat v = 1.0;\n#else\nfloat v = 2.0;\n#endif\nvoid main() {\n}\n';
    // Act:
    const r100 = fullPipeline(src100, 'vertex', 100);
    const r300 = fullPipeline(src300, 'vertex', 300);
    // Assert:
    expect(r100.ok).toBe(true);
    expect(r300.ok).toBe(true);
  });

  it('M2-4: #version on line 2 produces line-accurate diagnostic', () => {
    // Arrange:
    const src = '\n#version 300 es\nvoid main() {\n}\n';
    // Act:
    const res = fullPipeline(src, 'vertex', 300);
    // Assert:
    expect(res.ok).toBe(false);
    expect(failLog(res)).toContain('ERROR: 0:2:');
  });

  it('M2-8: Undeclared identifier produces line-accurate diagnostic', () => {
    // Arrange:
    const src = 'void main() {\n float x = 1.0;\n y = 2.0;\n}\n';
    // Act:
    const res = fullPipeline(src, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    expect(failLog(res)).toMatch(/ERROR: 0:3: Undeclared identifier/);
  });

  it('M2-11: #error aborts compilation with message in info log', () => {
    // Arrange:
    const src = '#error custom_abort_signal\nvoid main() {\n}\n';
    // Act:
    const res = fullPipeline(src, 'vertex', 100);
    // Assert:
    expect(res.ok).toBe(false);
    expect(failLog(res)).toContain('custom_abort_signal');
  });
});

describe('GLSL ES 3.00 reserved-word misuse (Sprint 4 TD-007 TEST 5)', () => {
  it.each(['image2D', 'atomic_uint', 'coherent', 'subroutine', 'buffer', 'shared'])(
    'rejects reserved word %s as identifier with line-accurate diagnostic',
    (word) => {
      // Arrange:
      const src = '#version 300 es\nvoid main() {\n  int ' + word + ' = 1;\n}\n';
      // Act:
      const res = fullPipeline(src, 'fragment', 300);
      // Assert:
      expect(res.ok).toBe(false);
      if (res.ok) throw new Error('expected failure');
      expect(res.log).toMatch(/^ERROR: 0:3: /);
      expect(res.log).toContain("Reserved word '" + word + "' cannot be used as identifier");
    },
  );
});

describe('GLSL struct reserved-word member (Sprint 4 TD-007 TEST 6)', () => {
  it('reserved word in struct declaration rejected with line-accurate diagnostic', () => {
    // Arrange:
    const src = '#version 300 es\nstruct MyStruct {\n  int readonly;\n};\nvoid main() {}\n';
    // Act:
    const res = fullPipeline(src, 'vertex', 300);
    // Assert:
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error('expected failure');
    expect(res.log).toMatch(/ERROR: 0:3: Reserved word 'readonly' cannot be used as identifier/);
  });
});

describe('GLSL #version single-owner (Sprint 4 TD-008 TEST 7)', () => {
  it('#version on line 1 accepted and on line 2 rejected', () => {
    // Arrange:
    const validSrc = '#version 300 es\nvoid main() {}\n';
    const invalidSrc = '\n#version 300 es\nvoid main() {}\n';
    // Act:
    const validRes = fullPipeline(validSrc, 'vertex', 300);
    const invalidRes = fullPipeline(invalidSrc, 'vertex', 300);
    // Assert:
    expect(validRes.ok).toBe(true);
    expect(invalidRes.ok).toBe(false);
    if (invalidRes.ok) throw new Error('expected failure');
    expect(invalidRes.log).toContain('ERROR: 0:2:');
    expect(invalidRes.log).toContain('#version directive must occur on the first line');
  });
});

describe('GLSL __VERSION__ reseeding (Sprint 4 TD-008 TEST 8)', () => {
  it('__VERSION__ expands to 100 in ES 1.00 and 300 in ES 3.00', () => {
    // Arrange:
    const src100 = '#if __VERSION__ == 100\nfloat v = 1.0;\n#else\nfloat v = 2.0;\n#endif\nvoid main() {}\n';
    const src300 = '#version 300 es\n#if __VERSION__ == 300\nfloat v = 1.0;\n#else\nfloat v = 2.0;\n#endif\nvoid main() {}\n';
    // Act:
    const res100 = fullPipeline(src100, 'vertex', 100);
    const res300 = fullPipeline(src300, 'vertex', 300);
    // Assert:
    expect(res100.ok).toBe(true);
    expect(res300.ok).toBe(true);
  });
});
