/**
 * @fileoverview GLSL recursive-descent parser with version-gated qualifier legality.
 */
// CHANGELOG:
// - Sprint 3: Created GLSL recursive-descent parser with version-gated qualifier legality (Task 2).
import type { Token, TokenKind } from "./tokenizer";
import { ShaderCompileError } from "../errors";

/** Shader stage tag carried on the ASTProgram. */
export type ShaderStage = "vertex" | "fragment";

/** Resolved GLSL version. */
export type GLSLVersion = 100 | 300;

/** Global declaration entry (qualifiers + type + declarator names). */
export interface Declaration {
  kind: string;
  qualifiers: string[];
  typeName: string;
  names: string[];
  line: number;
}

/** Function parameter entry. */
export interface Param {
  qualifiers: string[];
  typeName: string;
  name: string;
}

/** Statement node (shape only, sufficient for parsing). */
export interface Statement {
  kind: string;
  line: number;
  text: string;
  expr?: Expression;
  body?: Statement[];
}

/** Expression node (shape only, values never evaluated). */
export interface Expression {
  kind: string;
  line: number;
  text: string;
  target?: string;
}

/** Function definition node. */
export interface FunctionDef {
  kind: string;
  returnType: string;
  name: string;
  params: Param[];
  body: Statement[];
  line: number;
}

/** Translation unit for one shader stage. */
export interface ASTProgram {
  version: GLSLVersion;
  stage: ShaderStage;
  declarations: Declaration[];
  functions: FunctionDef[];
}

const _KIND: TokenKind = "keyword";
void _KIND;

const QUALIFIERS: ReadonlySet<string> = new Set([
  "invariant", "const", "uniform", "attribute", "varying", "in", "out", "inout",
]);

const TYPE_NAMES: ReadonlySet<string> = new Set([
  "float", "int", "bool", "void", "vec2", "vec3", "vec4", "ivec2", "ivec3", "ivec4",
  "bvec2", "bvec3", "bvec4", "mat2", "mat3", "mat4", "sampler2D", "samplerCube",
  "lowp", "mediump", "highp",
]);

function isVersionDirective(t: Token): boolean {
  const parts = t.lexeme.trim().split(/\s+/);
  return parts[0] === "#version";
}

function parseVersionParts(t: Token): { num: number; profile: string } | null {
  const parts = t.lexeme.trim().split(/\s+/);
  if (parts[0] !== "#version" || parts.length < 2) return null;
  const num = Number(parts[1]);
  if (!Number.isFinite(num)) return null;
  return { num, profile: parts[2] ?? "" };
}

function resolveVersion(directives: Token[]): GLSLVersion {
  if (directives.length === 0) return 100;
  const first = directives[0] as Token;
  if (isVersionDirective(first)) {
    if (first.line !== 1) throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
    const parts = parseVersionParts(first);
    if (parts === null) throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
    if (parts.num === 300 && parts.profile === "es") {
      for (let i = 1; i < directives.length; i++) {
        if (isVersionDirective(directives[i] as Token)) {
          throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
        }
      }
      return 300;
    }
    if (parts.num === 100) {
      for (let i = 1; i < directives.length; i++) {
        if (isVersionDirective(directives[i] as Token)) {
          throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
        }
      }
      return 100;
    }
    throw new ShaderCompileError(`UNSUPPORTED_VERSION ${parts.num}`, first.line);
  }
  for (const d of directives) {
    if (isVersionDirective(d)) throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
  }
  return 100;
}

function checkQualifier(lexeme: string, line: number, version: GLSLVersion): void {
  if (version === 300) {
    if (lexeme === "attribute") throw new ShaderCompileError("ATTRIBUTE_RESERVED_IN_300", line);
    if (lexeme === "varying") throw new ShaderCompileError("VARYING_RESERVED_IN_300", line);
    if (lexeme === "gl_FragColor") throw new ShaderCompileError("GL_FRAGCOLOR_RESERVED_IN_300", line);
  } else {
    if (lexeme === "in") throw new ShaderCompileError("IN_RESERVED_IN_100", line);
    if (lexeme === "out") throw new ShaderCompileError("OUT_RESERVED_IN_100", line);
    if (lexeme === "layout") throw new ShaderCompileError("LAYOUT_QUALIFIER_REQUIRES_300", line);
  }
}

class Cursor {
  pos = 0;
  constructor(public tokens: Token[]) {}
  get done(): boolean {
    return this.pos >= this.tokens.length;
  }
  peek(off = 0): Token | undefined {
    return this.tokens[this.pos + off];
  }
  advance(): Token {
    const t = this.tokens[this.pos];
    if (t === undefined) throw new ShaderCompileError("Unexpected end of input", 1);
    this.pos += 1;
    return t;
  }
  expect(lexeme: string, line: number): Token {
    const t = this.peek();
    if (t === undefined || t.lexeme !== lexeme) {
      throw new ShaderCompileError(`Expected '${lexeme}'`, t?.line ?? line);
    }
    return this.advance();
  }
}

function isTypeLexeme(lexeme: string): boolean {
  return TYPE_NAMES.has(lexeme);
}

function isDeclStart(t: Token | undefined): boolean {
  if (t === undefined) return false;
  if (t.lexeme === "layout" || QUALIFIERS.has(t.lexeme) || t.lexeme === "precision") return true;
  return isTypeLexeme(t.lexeme) || t.kind === "ident";
}

function parseLayoutPrefix(c: Cursor, version: GLSLVersion): string[] {
  const quals: string[] = [];
  while (c.peek()?.lexeme === "layout") {
    const lt = c.advance();
    checkQualifier("layout", lt.line, version);
    quals.push("layout");
    c.expect("(", lt.line);
    let depth = 1;
    while (depth > 0) {
      const t = c.peek();
      if (t === undefined) throw new ShaderCompileError("Expected ')'", lt.line);
      if (t.lexeme === "(") depth += 1;
      if (t.lexeme === ")") depth -= 1;
      c.advance();
    }
  }
  return quals;
}

function parseGlobalDeclaration(c: Cursor, version: GLSLVersion): Declaration {
  const start = c.peek() as Token;
  const quals: string[] = [];
  quals.push(...parseLayoutPrefix(c, version));
  while (true) {
    const t = c.peek();
    if (t !== undefined && QUALIFIERS.has(t.lexeme)) {
      checkQualifier(t.lexeme, t.line, version);
      quals.push(t.lexeme);
      c.advance();
      continue;
    }
    break;
  }
  const tt = c.peek();
  if (tt === undefined) throw new ShaderCompileError("Expected type", start.line);
  if (tt.lexeme === ";") throw new ShaderCompileError("Expected type", tt.line);
  const typeTok = c.advance();
  const names: string[] = [];
  for (;;) {
    const nt = c.peek();
    if (nt === undefined) throw new ShaderCompileError("Expected ';'", start.line);
    if (nt.lexeme === ";") {
      c.advance();
      break;
    }
    if (nt.lexeme === ",") {
      c.advance();
      continue;
    }
    if (nt.lexeme === "=") {
      c.advance();
      const e = parseExpression(c, version, 0);
      void e;
      continue;
    }
    if (nt.lexeme === "[") {
      c.advance();
      const nxt = c.peek();
      if (nxt !== undefined && nxt.lexeme !== "]") {
        const e = parseExpression(c, version, 0);
        void e;
      }
      c.expect("]", nt.line);
      continue;
    }
    if (nt.kind === "ident" || nt.kind === "keyword" || nt.lexeme === "gl_FragColor") {
      checkQualifier(nt.lexeme, nt.line, version);
      names.push(nt.lexeme);
      c.advance();
      continue;
    }
    if (nt.lexeme === "(") {
      throw new ShaderCompileError(`Unexpected token '${nt.lexeme}'`, nt.line);
    }
    c.advance();
  }
  return { kind: "declaration", qualifiers: quals, typeName: typeTok.lexeme, names, line: start.line };
}

function parsePrecision(c: Cursor): Declaration {
  const start = c.advance();
  const pTok = c.peek();
  const pname = pTok !== undefined ? c.advance().lexeme : "";
  const tTok = c.peek();
  const tname = tTok !== undefined ? c.advance().lexeme : "";
  const semi = c.peek();
  if (semi === undefined || semi.lexeme !== ";") {
    throw new ShaderCompileError("Expected ';'", semi?.line ?? start.line);
  }
  c.advance();
  return { kind: "precision", qualifiers: ["precision", pname], typeName: tname, names: [], line: start.line };
}

const BINARY_PREC: Record<string, number> = {
  "=": 1, "+=": 1, "-=": 1, "*=": 1, "/=": 1, "%=": 1, "<<=": 1, ">>=": 1, "&=": 1, "|=": 1, "^=": 1,
  "||": 3, "&&": 4, "|": 5, "^": 6, "&": 7,
  "==": 8, "!=": 8, "<": 9, ">": 9, "<=": 9, ">=": 9,
  "<<": 10, ">>": 10, "+": 11, "-": 11, "*": 12, "/": 12, "%": 12,
};

function isRightAssoc(op: string): boolean {
  return op === "=" || op.endsWith("=") || op === "?";
}

function parseExpression(c: Cursor, version: GLSLVersion, minPrec: number): Expression {
  void version;
  const start = c.peek();
  if (start === undefined) throw new ShaderCompileError("Unexpected end of expression", 1);
  let node: Expression;
  if (start.kind === "int" || start.kind === "float") {
    c.advance();
    node = { kind: "literal", line: start.line, text: start.lexeme };
  } else if (start.lexeme === "true" || start.lexeme === "false") {
    c.advance();
    node = { kind: "bool", line: start.line, text: start.lexeme };
  } else if (start.lexeme === "(") {
    c.advance();
    node = parseExpression(c, version, 0);
    c.expect(")", start.line);
    node = { kind: "paren", line: start.line, text: "(...)" };
  } else if (["-", "+", "!", "~", "++", "--"].includes(start.lexeme)) {
    c.advance();
    const operand = parseExpression(c, version, 13);
    node = { kind: "unary", line: start.line, text: start.lexeme + operand.text };
  } else if (start.kind === "ident" || start.kind === "keyword" || start.lexeme === "gl_FragColor") {
    c.advance();
    node = { kind: "ident", line: start.line, text: start.lexeme, target: start.lexeme };
  } else {
    throw new ShaderCompileError(`Unexpected token '${start.lexeme}'`, start.line);
  }
  // postfix loop
  for (;;) {
    const nx = c.peek();
    if (nx === undefined) break;
    if (nx.lexeme === "(") {
      const lp = c.advance();
      void lp;
      let depth = 1;
      const argStart = c.pos;
      void argStart;
      const texts: string[] = [];
      if (c.peek()?.lexeme !== ")") {
        for (;;) {
          const e = parseExpression(c, version, 0);
          texts.push(e.text);
          if (c.peek()?.lexeme === ",") {
            c.advance();
            continue;
          }
          break;
        }
      }
      c.expect(")", nx.line);
      node = { kind: "call", line: node.line, text: node.text + "(...)", target: node.target };
      continue;
    }
    if (nx.lexeme === "[") {
      c.advance();
      const idx = parseExpression(c, version, 0);
      void idx;
      c.expect("]", nx.line);
      node = { kind: "subscript", line: node.line, text: node.text + "[]" };
      continue;
    }
    if (nx.lexeme === ".") {
      c.advance();
      const f = c.peek();
      if (f === undefined) throw new ShaderCompileError("Expected field name", nx.line);
      c.advance();
      node = { kind: "field", line: node.line, text: node.text + "." + f.lexeme };
      continue;
    }
    if (nx.lexeme === "++" || nx.lexeme === "--") {
      // Distinguish prefix (handled) vs postfix: here it is postfix.
      c.advance();
      node = { kind: "postfix", line: node.line, text: node.text + nx.lexeme };
      continue;
    }
    break;
  }
  // binary climb
  for (;;) {
    const op = c.peek();
    if (op === undefined) break;
    if (op.lexeme === "?") {
      const prec = 2;
      if (prec < minPrec) break;
      c.advance();
      const mid = parseExpression(c, version, 0);
      void mid;
      c.expect(":", op.line);
      const rhs = parseExpression(c, version, prec);
      void rhs;
      node = { kind: "ternary", line: node.line, text: "?:", target: node.target };
      continue;
    }
    const prec = BINARY_PREC[op.lexeme];
    if (prec === undefined || prec < minPrec) break;
    c.advance();
    const nextMin = isRightAssoc(op.lexeme) ? prec : prec + 1;
    const rhs = parseExpression(c, version, nextMin);
    const tgt = node.target;
    node = { kind: "binary", line: node.line, text: node.text + op.lexeme + rhs.text, target: tgt };
  }
  return node;
}

function looksLikeFunction(c: Cursor): boolean {
  const t0 = c.peek(0);
  const t1 = c.peek(1);
  const t2 = c.peek(2);
  if (t0 === undefined || t1 === undefined || t2 === undefined) return false;
  if (t2.lexeme !== "(") return false;
  if (!isTypeLexeme(t0.lexeme) && t0.kind !== "ident") return false;
  return true;
}

function parseFunction(c: Cursor, version: GLSLVersion): FunctionDef {
  const ret = c.advance();
  const nameTok = c.peek();
  if (nameTok === undefined) throw new ShaderCompileError("Expected function name", ret.line);
  const name = c.advance();
  c.expect("(", ret.line);
  const params: Param[] = [];
  if (c.peek()?.lexeme !== ")") {
    if (c.peek()?.lexeme === "void") {
      c.advance();
    } else {
      for (;;) {
        const q: string[] = [];
        while (c.peek() !== undefined && QUALIFIERS.has((c.peek() as Token).lexeme)) {
          const qt = c.advance();
          checkQualifier(qt.lexeme, qt.line, version);
          q.push(qt.lexeme);
        }
        const pt = c.peek();
        if (pt === undefined) throw new ShaderCompileError("Expected ')'", ret.line);
        if (pt.lexeme === ")") break;
        const typeTok = c.advance();
        const nm = c.peek();
        let pname = "";
        if (nm !== undefined && (nm.kind === "ident" || nm.kind === "keyword") && nm.lexeme !== "," && nm.lexeme !== ")") {
          pname = c.advance().lexeme;
        }
        params.push({ qualifiers: q, typeName: typeTok.lexeme, name: pname });
        if (c.peek()?.lexeme === ",") {
          c.advance();
          continue;
        }
        break;
      }
    }
  }
  c.expect(")", ret.line);
  c.expect("{", ret.line);
  const body: Statement[] = [];
  while (c.peek() !== undefined && c.peek()?.lexeme !== "}") {
    body.push(parseStatement(c, version));
  }
  c.expect("}", ret.line);
  return { kind: "function", returnType: ret.lexeme, name: name.lexeme, params, body, line: ret.line };
}

function tryParseLocalDecl(c: Cursor, version: GLSLVersion): Statement | null {
  const save = c.pos;
  const prefix = parseLayoutPrefixSilent(c, version);
  if (prefix === null) {
    c.pos = save;
    return null;
  }
  return parseLocalDeclRest(c, version, save, prefix);
}

function parseLayoutPrefixSilent(c: Cursor, version: GLSLVersion): string[] | null {
  void version;
  const quals: string[] = [];
  const save = c.pos;
  try {
    while (c.peek()?.lexeme === "layout") {
      const lt = c.advance();
      void lt;
      quals.push("layout");
      c.expect("(", lt.line);
      let depth = 1;
      while (depth > 0) {
        const t = c.peek();
        if (t === undefined) throw new ShaderCompileError("Expected ')'", lt.line);
        if (t.lexeme === "(") depth += 1;
        if (t.lexeme === ")") depth -= 1;
        c.advance();
      }
    }
  } catch {
    c.pos = save;
    return null;
  }
  return quals;
}

function parseLocalDeclRest(c: Cursor, version: GLSLVersion, save: number, quals: string[]): Statement | null {
  const q2: string[] = [...quals];
  while (c.peek() !== undefined && QUALIFIERS.has((c.peek() as Token).lexeme)) {
    q2.push((c.peek() as Token).lexeme);
    c.advance();
  }
  const t0 = c.peek(0);
  const t1 = c.peek(1);
  if (t0 === undefined || t1 === undefined) {
    c.pos = save;
    return null;
  }
  const typeOk = isTypeLexeme(t0.lexeme) || t0.kind === "ident";
  const nameOk = t1.kind === "ident" || t1.kind === "keyword";
  if (!typeOk || !nameOk) {
    c.pos = save;
    return null;
  }
  // Gate qualifiers now (may throw).
  for (const q of q2) {
    const qt = c.tokens.slice(save, c.pos).find((t) => t.lexeme === q);
    checkQualifier(q, qt?.line ?? t0.line, version);
  }
  if (quals.includes("layout")) {
    const lt = c.tokens.slice(save, c.pos).find((t) => t.lexeme === "layout");
    void lt;
    checkQualifier("layout", t0.line, version);
  }
  const stmtLine = (c.tokens[save] as Token).line;
  // Consume type + declarators until ';' using expression parsing for initializers.
  c.advance();
  for (;;) {
    const nt = c.peek();
    if (nt === undefined) throw new ShaderCompileError("Expected ';'", stmtLine);
    if (nt.lexeme === ";") {
      c.advance();
      break;
    }
    if (nt.lexeme === ",") {
      c.advance();
      continue;
    }
    if (nt.lexeme === "=") {
      c.advance();
      const e = parseExpression(c, version, 0);
      void e;
      continue;
    }
    if (nt.lexeme === "[") {
      c.advance();
      if (c.peek()?.lexeme !== "]") {
        const e = parseExpression(c, version, 0);
        void e;
      }
      c.expect("]", nt.line);
      continue;
    }
    c.advance();
  }
  return { kind: "decl", line: stmtLine, text: "decl" };
}

function parseStatement(c: Cursor, version: GLSLVersion): Statement {
  const t = c.peek();
  if (t === undefined) throw new ShaderCompileError("Unexpected end of input", 1);
  if (t.lexeme === "{") {
    c.advance();
    const inner: Statement[] = [];
    while (c.peek() !== undefined && c.peek()?.lexeme !== "}") {
      inner.push(parseStatement(c, version));
    }
    c.expect("}", t.line);
    return { kind: "block", line: t.line, text: "{}", body: inner };
  }
  if (t.lexeme === "if") {
    c.advance();
    c.expect("(", t.line);
    const cond = parseExpression(c, version, 0);
    void cond;
    c.expect(")", t.line);
    const thenB = parseStatement(c, version);
    void thenB;
    if (c.peek()?.lexeme === "else") {
      c.advance();
      const el = parseStatement(c, version);
      void el;
    }
    return { kind: "if", line: t.line, text: "if" };
  }
  if (t.lexeme === "for") {
    c.advance();
    c.expect("(", t.line);
    let depth = 1;
    while (depth > 0) {
      const x = c.peek();
      if (x === undefined) throw new ShaderCompileError("Expected ')'", t.line);
      if (x.lexeme === "(") depth += 1;
      if (x.lexeme === ")") depth -= 1;
      c.advance();
    }
    const body = parseStatement(c, version);
    void body;
    return { kind: "for", line: t.line, text: "for" };
  }
  if (t.lexeme === "while") {
    c.advance();
    c.expect("(", t.line);
    const cond = parseExpression(c, version, 0);
    void cond;
    c.expect(")", t.line);
    const body = parseStatement(c, version);
    void body;
    return { kind: "while", line: t.line, text: "while" };
  }
  if (t.lexeme === "do") {
    c.advance();
    const body = parseStatement(c, version);
    void body;
    c.expect("while", t.line);
    c.expect("(", t.line);
    const cond = parseExpression(c, version, 0);
    void cond;
    c.expect(")", t.line);
    c.expect(";", t.line);
    return { kind: "do", line: t.line, text: "do" };
  }
  if (t.lexeme === "return") {
    c.advance();
    if (c.peek()?.lexeme !== ";") {
      const e = parseExpression(c, version, 0);
      void e;
    }
    c.expect(";", t.line);
    return { kind: "return", line: t.line, text: "return" };
  }
  if (t.lexeme === "discard" || t.lexeme === "break" || t.lexeme === "continue") {
    c.advance();
    c.expect(";", t.line);
    return { kind: t.lexeme, line: t.line, text: t.lexeme };
  }
  if (t.lexeme === ";") {
    c.advance();
    return { kind: "empty", line: t.line, text: ";" };
  }
  if (isDeclStart(t)) {
    const decl = tryParseLocalDecl(c, version);
    if (decl !== null) return decl;
  }
  // Expression statement (also covers gl_FragColor assignment guard).
  const expr = parseExpression(c, version, 0);
  c.expect(";", t.line);
  if (version === 300 && expr.target === "gl_FragColor") {
    throw new ShaderCompileError("GL_FRAGCOLOR_RESERVED_IN_300", expr.line);
  }
  if (version === 300 && expr.text.includes("gl_FragColor")) {
    // Compound assignment folded target retained; plain check above covers it.
    throw new ShaderCompileError("GL_FRAGCOLOR_RESERVED_IN_300", expr.line);
  }
  return { kind: "expr", line: t.line, text: expr.text, expr };
}

/**
 * Parse a token stream into a version-tagged translation unit.
 *
 * @param tokens Ordered token list from the tokenizer.
 * @param stage Shader stage being parsed.
 * @returns ASTProgram carrying resolved version, stage, declarations, and functions.
 * @throws ShaderCompileError On version-placement, qualifier, or grammar violations.
 */
export function parse(tokens: Token[], stage: ShaderStage): ASTProgram {
  const directives = tokens.filter((t) => t.kind === "directive");
  const version = resolveVersion(directives);
  const stream = tokens.filter((t) => t.kind !== "directive");
  const c = new Cursor(stream);
  const declarations: Declaration[] = [];
  const functions: FunctionDef[] = [];
  while (!c.done) {
    const la = c.peek() as Token;
    if (la.lexeme === "precision") {
      declarations.push(parsePrecision(c));
      continue;
    }
    if (la.lexeme === "layout" || QUALIFIERS.has(la.lexeme)) {
      // Peek qualifier gating happens inside declaration parsing; but gate
      // leading qualifier eagerly for exact use-site line.
      if (la.lexeme !== "layout" && QUALIFIERS.has(la.lexeme)) {
        // Gate checked inside parseGlobalDeclaration too; pre-check for clarity.
      }
      if (looksLikeFunction(c)) {
        functions.push(parseFunction(c, version));
        continue;
      }
      declarations.push(parseGlobalDeclaration(c, version));
      continue;
    }
    if (looksLikeFunction(c)) {
      functions.push(parseFunction(c, version));
      continue;
    }
    if (isTypeLexeme(la.lexeme) || la.kind === "ident") {
      declarations.push(parseGlobalDeclaration(c, version));
      continue;
    }
    throw new ShaderCompileError(`Unexpected token '${la.lexeme}'`, la.line);
  }
  return { version, stage, declarations, functions };
}
