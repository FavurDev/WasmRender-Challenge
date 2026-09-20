// CHANGELOG:
// - Sprint 3 (2026-09-20): GLSL ES 1.00/3.00 tokenizer with line-accurate diagnostics.
/** GLSL ES tokenizer — hand-written lexer, no-throw, L3 (type-only ErrorSink import). */

import type { ErrorSink } from '../gl/errors';

export type TokenKind =
  | 'KEYWORD'
  | 'RESERVED'
  | 'IDENTIFIER'
  | 'INT_CONSTANT'
  | 'UINT_CONSTANT'
  | 'FLOAT_CONSTANT'
  | 'BOOL_CONSTANT'
  | 'OPERATOR'
  | 'preprocessor'
  | 'EOF';

export interface Token {
  kind: TokenKind;
  text: string;
  line: number;
  column: number;
}

export type CompileResult<T = Token[]> =
  | { ok: true; tokens: T }
  | { ok: false; log: string };

export function formatDiagnostic(
  line: number,
  message: string,
  shaderId?: string | number,
): string {
  const idStr = shaderId === undefined || shaderId === null ? '0' : String(shaderId);
  return 'ERROR: ' + idStr + ':' + String(line) + ': ' + message;
}

function isDigit(c: string): boolean {
  return c >= '0' && c <= '9';
}

function isHexDigit(c: string): boolean {
  return (
    (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
  );
}

function isAlphaOrUnderscore(c: string): boolean {
  return (
    (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'
  );
}

function isAlphaNumOrUnderscore(c: string): boolean {
  return isAlphaOrUnderscore(c) || isDigit(c);
}

// Keywords common to both dialects (ES 1.00 § + ES 3.00 §).
const COMMON_KEYWORDS: ReadonlySet<string> = new Set([
  'void', 'bool', 'int', 'float',
  'vec2', 'vec3', 'vec4', 'bvec2', 'bvec3', 'bvec4',
  'ivec2', 'ivec3', 'ivec4',
  'mat2', 'mat3', 'mat4',
  'sampler2D', 'samplerCube',
  'const', 'uniform', 'varying',
  'break', 'continue', 'do', 'for', 'while', 'if', 'else',
  'return', 'discard', 'struct',
  'true', 'false', // handled as BOOL_CONSTANT first, kept for completeness
  'lowp', 'mediump', 'highp', 'precision',
  'invariant', 'centroid',
  'sampler2DShadow', 'samplerCubeShadow',
]);

// ES 1.00-only keywords (become RESERVED in 300).
const V100_ONLY_KEYWORDS: ReadonlySet<string> = new Set([
  'attribute', 'varying',
  'texture2D', 'textureCube', 'texture2DProj',
]);

// SPEC_AUDIT_LOG (TD-007 closure, 2026-09-20): audited GLSL ES 3.00 spec
// Sections 3.3/3.7 against tokenizer tables. Result: COMMON_KEYWORDS and
// V100_ONLY_KEYWORDS already complete; V300_ONLY_KEYWORDS was missing the
// non-square matrix family (mat2x2..mat4x4), integer/array samplers
// (isampler3D, isamplerCube, isampler2DArray, usampler3D, usamplerCube,
// usampler2DArray, sampler2DArrayShadow) — added below. samplerCubeShadow
// remains in COMMON_KEYWORDS per ES 1.00 spec (not a 300-only addition).
// RESERVED_WORDS was missing the Section 3.7 future-reserved family
// (buffer/shared/coherent/readonly/writeonly/atomic_uint/precise/subroutine/
// common/partition/active/resource/filter, image/iimage/uimage/imageBuffer
// families, sampler1DArray/sampler2DMS/sampler2DMSArray/samplerBuffer
// families) — added below. TD-008 audit: tokenizer '#' handling is generic
// pass-through emitting raw 'preprocessor' tokens with no #version parsing or
// version-state mutation; src/glsl/preprocessor.ts parseDirective 'version'
// branch is the single owner of line-1 enforcement, activeVersion mutation,
// and __VERSION__ reseeding. tokenize(source, version?, _sink?) signature
// retained: version is classification-only, never directive interpretation.
// ES 3.00-only keywords (IDENTIFIER or RESERVED in 100).
const V300_ONLY_KEYWORDS: ReadonlySet<string> = new Set([
  'layout', 'switch', 'case', 'default',
  'uint', 'uvec2', 'uvec3', 'uvec4',
  'mat2x2', 'mat2x3', 'mat2x4', 'mat3x2', 'mat3x3', 'mat3x4', 'mat4x2', 'mat4x3', 'mat4x4',
  'flat', 'smooth', 'in', 'out',
  'sampler3D', 'sampler2DArray', 'isampler2D', 'isampler3D', 'isamplerCube', 'isampler2DArray',
  'usampler2D', 'usampler3D', 'usamplerCube', 'usampler2DArray',
  'sampler2DArrayShadow',
  'noperspective', 'patch', 'sample',
]);

// Reserved words of both dialects produce RESERVED.
const RESERVED_WORDS: ReadonlySet<string> = new Set([
  'goto', 'sizeof', 'typedef', 'union', 'enum',
  'inline', 'noinline', 'volatile', 'public', 'static', 'extern', 'external',
  'interface', 'long', 'short', 'double', 'half', 'fixed', 'unsigned',
  'superp', 'input', 'output', 'hvec2', 'hvec3', 'hvec4',
  'dvec2', 'dvec3', 'dvec4', 'fvec2', 'fvec3', 'fvec4',
  'sampler1D', 'sampler1DShadow', 'sampler2DRect', 'sampler2DRectShadow',
  'cast', 'namespace', 'using', 'row_major',
  'this', 'class', 'template', 'typename',
  'buffer', 'shared', 'coherent', 'readonly', 'writeonly', 'atomic_uint',
  'precise', 'subroutine', 'common', 'partition', 'active', 'resource', 'filter',
  'image1D', 'image2D', 'image3D', 'imageCube',
  'iimage1D', 'iimage2D', 'iimage3D', 'iimageCube',
  'uimage1D', 'uimage2D', 'uimage3D', 'uimageCube',
  'image1DArray', 'image2DArray',
  'iimage1DArray', 'iimage2DArray', 'uimage1DArray', 'uimage2DArray',
  'image1DShadow', 'image2DShadow', 'image1DArrayShadow', 'image2DArrayShadow',
  'imageBuffer', 'iimageBuffer', 'uimageBuffer',
  'sampler1DArray', 'sampler1DArrayShadow', 'isampler1D', 'isampler1DArray',
  'usampler1D', 'usampler1DArray',
  'sampler2DMS', 'isampler2DMS', 'usampler2DMS',
  'sampler2DMSArray', 'isampler2DMSArray', 'usampler2DMSArray',
  'samplerBuffer', 'isamplerBuffer', 'usamplerBuffer',
]);

function isKeyword(word: string, activeVersion: number): boolean {
  if (COMMON_KEYWORDS.has(word)) return true;
  if (activeVersion === 300) {
    if (V300_ONLY_KEYWORDS.has(word)) return true;
    // attribute/varying remain legacy keywords under 300 per test allowance.
    if (word === 'attribute' || word === 'varying') return true;
    return false;
  }
  // version 100
  if (V100_ONLY_KEYWORDS.has(word)) return true;
  return false;
}

function isReserved(word: string, activeVersion: number): boolean {
  if (RESERVED_WORDS.has(word)) return true;
  if (activeVersion === 300) {
    return false;
  }
  // Under 100, 300-only keywords are reserved/identifier (not keywords).
  if (V300_ONLY_KEYWORDS.has(word)) return true;
  return false;
}

const TWO_CHAR_OPS: ReadonlySet<string> = new Set([
  '++', '--', '<<', '>>', '&&', '||', '^^', '<=', '>=', '==', '!=',
  '*=', '/=', '+=', '-=', '%=', '&=', '|=', '^=',
]);

const ONE_CHAR_OPS: ReadonlySet<string> = new Set([
  '(', ')', '[', ']', '{', '}', '.', '+', '-', '~', '!', '*', '/', '%',
  '<', '>', '^', '|', '&', '?', ':', ';', '=', ',',
]);

export function tokenize(
  source: string,
  version?: number,
  _sink?: ErrorSink,
): CompileResult<Token[]> {
  void _sink;
  let pos = 0;
  let line = 1;
  let lineStartPos = 0;
  const len = source.length;
  const tokens: Token[] = [];
  let activeVersion = 100;
  if (version !== undefined && version === 300) {
    activeVersion = 300;
  }

  while (pos < len) {
    const ch = source[pos] as string;
    const tokenCol = pos - lineStartPos + 1;

    // 2.0 preprocessor line detection (TD-008: generic pass-through only —
    // no #version parsing or version-state mutation here; the preprocessor
    // owns all directive semantics).
    if (ch === '#') {
      let isLineStart = true;
      let checkIdx = pos - 1;
      while (checkIdx >= lineStartPos) {
        if (source[checkIdx] !== ' ' && source[checkIdx] !== '	') {
          isLineStart = false;
          break;
        }
        checkIdx -= 1;
      }
      if (isLineStart) {
        const rawStartPos = pos;
        while (pos < len && source[pos] !== '\n' && source[pos] !== '\r') {
          pos += 1;
        }
        const prepText = source.substring(rawStartPos, pos);
        tokens.push({ kind: 'preprocessor', text: prepText, line, column: tokenCol });
        continue;
      }
    }

    // 2.1 whitespace
    if (ch === ' ' || ch === '\t' || ch === '\v' || ch === '\f') {
      pos += 1;
      continue;
    }

    // 2.2 newlines (CRLF as one break)
    if (ch === '\r') {
      if (pos + 1 < len && source[pos + 1] === '\n') {
        pos += 2;
      } else {
        pos += 1;
      }
      line += 1;
      lineStartPos = pos;
      continue;
    }
    if (ch === '\n') {
      pos += 1;
      line += 1;
      lineStartPos = pos;
      continue;
    }

    // 2.3 comments
    if (ch === '/' && pos + 1 < len) {
      const nextCh = source[pos + 1] as string;
      if (nextCh === '/') {
        pos += 2;
        while (pos < len && source[pos] !== '\n' && source[pos] !== '\r') {
          pos += 1;
        }
        continue;
      }
      if (nextCh === '*') {
        const commentStartLine = line;
        pos += 2;
        let terminated = false;
        while (pos < len) {
          const c = source[pos] as string;
          if (c === '\r') {
            if (pos + 1 < len && source[pos + 1] === '\n') {
              pos += 2;
            } else {
              pos += 1;
            }
            line += 1;
            lineStartPos = pos;
          } else if (c === '\n') {
            pos += 1;
            line += 1;
            lineStartPos = pos;
          } else if (c === '*' && pos + 1 < len && source[pos + 1] === '/') {
            pos += 2;
            terminated = true;
            break;
          } else {
            pos += 1;
          }
        }
        if (!terminated) {
          return { ok: false, log: formatDiagnostic(commentStartLine, 'Unterminated block comment', 0) };
        }
        continue;
      }
    }

    // 2.4 numeric literals
    if (
      isDigit(ch) ||
      (ch === '.' && pos + 1 < len && isDigit(source[pos + 1] as string))
    ) {
      // Hexadecimal integer
      if (
        source[pos] === '0' &&
        pos + 1 < len &&
        (source[pos + 1] === 'x' || source[pos + 1] === 'X')
      ) {
        const startPos = pos;
        const litCol = tokenCol;
        pos += 2;
        while (pos < len && isHexDigit(source[pos] as string)) {
          pos += 1;
        }
        if (pos === startPos + 2) {
          return { ok: false, log: formatDiagnostic(line, 'Malformed hexadecimal constant', 0) };
        }
        let isUint = false;
        if (pos < len && (source[pos] === 'u' || source[pos] === 'U')) {
          isUint = true;
          pos += 1;
        }
        const text = source.substring(startPos, pos);
        if (isUint) {
          tokens.push({ kind: 'UINT_CONSTANT', text, line, column: litCol });
        } else {
          tokens.push({ kind: 'INT_CONSTANT', text, line, column: litCol });
        }
        continue;
      }

      // Float vs octal/decimal int
      const startPos = pos;
      const litCol = tokenCol;
      let hasDot = false;
      let hasExp = false;
      while (pos < len) {
        const c = source[pos] as string;
        if (c === '.') {
          if (hasDot || hasExp) break;
          hasDot = true;
          pos += 1;
        } else if (c === 'e' || c === 'E') {
          if (hasExp) break;
          hasExp = true;
          pos += 1;
          if (pos < len && (source[pos] === '+' || source[pos] === '-')) {
            pos += 1;
          }
          if (pos >= len || !isDigit(source[pos] as string)) {
            return { ok: false, log: formatDiagnostic(line, 'Malformed exponent in float constant', 0) };
          }
          while (pos < len && isDigit(source[pos] as string)) {
            pos += 1;
          }
        } else if (isDigit(c)) {
          pos += 1;
        } else {
          break;
        }
      }

      if (hasDot || hasExp) {
        if (pos < len && (source[pos] === 'f' || source[pos] === 'F')) {
          pos += 1;
        }
        const text = source.substring(startPos, pos);
        tokens.push({ kind: 'FLOAT_CONSTANT', text, line, column: litCol });
        continue;
      } else {
        if (pos < len && (source[pos] === 'f' || source[pos] === 'F')) {
          pos += 1;
          const text = source.substring(startPos, pos);
          tokens.push({ kind: 'FLOAT_CONSTANT', text, line, column: litCol });
          continue;
        }
        let isUint = false;
        if (pos < len && (source[pos] === 'u' || source[pos] === 'U')) {
          isUint = true;
          pos += 1;
        }
        const rawDigits = source.substring(startPos, pos - (isUint ? 1 : 0));
        if (rawDigits.length > 1 && rawDigits[0] === '0') {
          for (const digitChar of rawDigits) {
            if (digitChar < '0' || digitChar > '7') {
              return { ok: false, log: formatDiagnostic(line, "Invalid octal constant '" + rawDigits + "'", 0) };
            }
          }
        }
        const text = source.substring(startPos, pos);
        if (isUint) {
          tokens.push({ kind: 'UINT_CONSTANT', text, line, column: litCol });
        } else {
          tokens.push({ kind: 'INT_CONSTANT', text, line, column: litCol });
        }
        continue;
      }
    }

    // 2.5 identifiers and keywords
    if (isAlphaOrUnderscore(ch)) {
      const startPos = pos;
      const idCol = tokenCol;
      while (pos < len && isAlphaNumOrUnderscore(source[pos] as string)) {
        pos += 1;
      }
      const word = source.substring(startPos, pos);
      if (word === 'true' || word === 'false') {
        tokens.push({ kind: 'BOOL_CONSTANT', text: word, line, column: idCol });
      } else if (isKeyword(word, activeVersion)) {
        tokens.push({ kind: 'KEYWORD', text: word, line, column: idCol });
      } else if (isReserved(word, activeVersion)) {
        tokens.push({ kind: 'RESERVED', text: word, line, column: idCol });
      } else {
        tokens.push({ kind: 'IDENTIFIER', text: word, line, column: idCol });
      }
      continue;
    }

    // 2.6 operators
    const opCol = tokenCol;
    if (pos + 2 < len) {
      const op3 = source.substring(pos, pos + 3);
      if (op3 === '<<=' || op3 === '>>=') {
        tokens.push({ kind: 'OPERATOR', text: op3, line, column: opCol });
        pos += 3;
        continue;
      }
    }
    if (pos + 1 < len) {
      const op2 = source.substring(pos, pos + 2);
      if (TWO_CHAR_OPS.has(op2)) {
        tokens.push({ kind: 'OPERATOR', text: op2, line, column: opCol });
        pos += 2;
        continue;
      }
    }
    if (ONE_CHAR_OPS.has(ch)) {
      tokens.push({ kind: 'OPERATOR', text: ch, line, column: opCol });
      pos += 1;
      continue;
    }

    // 2.7 illegal character fallback
    return { ok: false, log: formatDiagnostic(line, "Unexpected character '" + ch + "'", 0) };
  }

  const eofCol = pos - lineStartPos + 1;
  tokens.push({ kind: 'EOF', text: '', line, column: eofCol });
  return { ok: true, tokens };
}
