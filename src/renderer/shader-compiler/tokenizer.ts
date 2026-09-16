/**
 * @fileoverview GLSL lexer producing a flat token stream with 1-based lines.
 */
import { ShaderCompileError } from "../errors";

/** Lexical category driving parser dispatch. */
export type TokenKind = "keyword" | "ident" | "int" | "float" | "op" | "directive";

/** Single lexical token with raw text and 1-based start line. */
export type Token = { kind: TokenKind; lexeme: string; line: number };

const KEYWORDS: ReadonlySet<string> = new Set([
  "attribute", "const", "uniform", "varying", "break", "continue", "do", "for", "while",
  "if", "else", "in", "out", "inout", "float", "int", "void", "bool", "true", "false",
  "lowp", "mediump", "highp", "precision", "invariant", "discard", "return",
  "mat2", "mat3", "mat4", "vec2", "vec3", "vec4", "ivec2", "ivec3", "ivec4",
  "bvec2", "bvec3", "bvec4", "sampler2D", "samplerCube", "struct",
]);

const THREE_OPS: ReadonlySet<string> = new Set(["<<=", ">>="]);
const TWO_OPS: ReadonlySet<string> = new Set([
  "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=",
  "<<", ">>", "&=", "|=", "^=", "->",
]);

function isLetter(c: string): boolean {
  return (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");
}
function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}
function isWordChar(c: string): boolean {
  return isLetter(c) || isDigit(c) || c === "_";
}
function isWhitespace(c: string): boolean {
  return c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\f" || c === "\v";
}

/**
 * Tokenize GLSL source into ordered tokens with 1-based lines.
 *
 * @param source Full GLSL source text.
 * @returns Ordered token list.
 * @throws ShaderCompileError On unterminated block comment or malformed numeric literal.
 */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let atLineStart = true;
  const n = source.length;

  while (pos < n) {
    const c = source[pos] as string;
    const next = pos + 1 < n ? (source[pos + 1] as string) : "";
    // CRLF counts as a single line advance.
    if (c === "\r" && next === "\n") {
      line += 1;
      pos += 2;
      atLineStart = true;
      continue;
    }
    if (c === "\n" || c === "\r") {
      line += 1;
      pos += 1;
      atLineStart = true;
      continue;
    }
    if (c === " " || c === "\t" || c === "\f" || c === "\v") {
      pos += 1;
      continue;
    }
    if (c === "#" && atLineStart) {
      const start = pos;
      while (pos < n && source[pos] !== "\n" && source[pos] !== "\r") pos += 1;
      tokens.push({ kind: "directive", lexeme: source.slice(start, pos), line });
      atLineStart = false;
      continue;
    }
    if (c === "/" && next === "/") {
      // Line comment: skip to but not past the newline.
      pos += 2;
      while (pos < n && source[pos] !== "\n" && source[pos] !== "\r") pos += 1;
      atLineStart = false;
      // If EOF reached, loop exits; newline left for main loop otherwise.
      if (pos < n) continue;
      continue;
    }
    if (c === "/" && next === "*") {
      const openingLine = line;
      pos += 2;
      let closed = false;
      while (pos < n) {
        const d = source[pos] as string;
        const d2 = pos + 1 < n ? (source[pos + 1] as string) : "";
        if (d === "*" && d2 === "/") {
          pos += 2;
          closed = true;
          break;
        }
        if (d === "\r" && d2 === "\n") {
          line += 1;
          pos += 2;
          continue;
        }
        if (d === "\n" || d === "\r") line += 1;
        pos += 1;
      }
      if (!closed) throw new ShaderCompileError("Unterminated block comment", openingLine);
      atLineStart = false;
      continue;
    }
    if (isLetter(c) || c === "_") {
      const start = pos;
      while (pos < n && isWordChar(source[pos] as string)) pos += 1;
      const word = source.slice(start, pos);
      tokens.push({ kind: KEYWORDS.has(word) ? "keyword" : "ident", lexeme: word, line });
      atLineStart = false;
      continue;
    }
    const dotDigit = c === "." && isDigit(next);
    if (isDigit(c) || dotDigit) {
      const start = pos;
      const tokLine = line;
      // Greedy consume: leading digits / dot / digits / exponent / letters (for validation).
      while (pos < n && isDigit(source[pos] as string)) pos += 1;
      if (pos < n && source[pos] === ".") {
        pos += 1;
        while (pos < n && isDigit(source[pos] as string)) pos += 1;
      }
      if (pos < n && (source[pos] === "e" || source[pos] === "E")) {
        pos += 1;
        if (pos < n && (source[pos] === "+" || source[pos] === "-")) pos += 1;
        while (pos < n && isDigit(source[pos] as string)) pos += 1;
      }
      while (pos < n && (isLetter(source[pos] as string) || source[pos] === "_")) pos += 1;
      // A second dot directly abutting the literal (e.g. "1..2") is malformed, not two tokens.
      if (pos < n && source[pos] === ".") {
        let end = pos + 1;
        while (end < n && isDigit(source[end] as string)) end += 1;
        throw new ShaderCompileError(`Malformed numeric literal '${source.slice(start, end)}'`, tokLine);
      }
      const raw = source.slice(start, pos);
      // Validate shape.
      const valid = /^(?:\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)$/.test(raw);
      if (!valid) throw new ShaderCompileError(`Malformed numeric literal '${raw}'`, tokLine);
      const kind: TokenKind = raw.includes(".") || /[eE]/.test(raw) ? "float" : "int";
      tokens.push({ kind, lexeme: raw, line: tokLine });
      atLineStart = false;
      continue;
    }
    // Operator: longest match (3-char, then 2-char, else single).
    const three = source.slice(pos, pos + 3);
    if (three.length === 3 && THREE_OPS.has(three)) {
      tokens.push({ kind: "op", lexeme: three, line });
      pos += 3;
      atLineStart = false;
      continue;
    }
    const two = source.slice(pos, pos + 2);
    if (two.length === 2 && TWO_OPS.has(two)) {
      tokens.push({ kind: "op", lexeme: two, line });
      pos += 2;
      atLineStart = false;
      continue;
    }
    tokens.push({ kind: "op", lexeme: c, line });
    pos += 1;
    atLineStart = false;
  }
  return tokens;
}
