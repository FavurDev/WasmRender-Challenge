// CHANGELOG:
// - Sprint 3 (2026-09-20): GLSL ES recursive-descent parser with typed AST, version-gated 100/300.
/** GLSL ES recursive-descent parser — typed AST, version-gated 100/300, no-throw, L3. */
import { formatDiagnostic } from './tokenizer';
import type { CompileResult, Token } from './tokenizer';

export const MAX_PARSER_DEPTH = 64;

export interface AstNode { kind: string; line: number; }
export interface LayoutQualifier extends AstNode { kind: 'LayoutQualifier'; location: number; }
export interface TypeSpecifier extends AstNode { kind: 'TypeSpecifier'; name: string; }
export interface TranslationUnit extends AstNode { kind: 'TranslationUnit'; declarations: Declaration[]; }
export type Declaration = FunctionDefinition | VariableDeclaration | StructDefinition | PrecisionStatement | FunctionPrototype;
export interface FunctionPrototype extends AstNode { kind: 'FunctionPrototype'; returnType: TypeSpecifier; name: string; params: VariableDeclaration[]; }
export interface FunctionDefinition extends AstNode { kind: 'FunctionDefinition'; returnType: TypeSpecifier; name: string; params: VariableDeclaration[]; body: CompoundStatement; }
export interface VariableDeclaration extends AstNode { kind: 'VariableDeclaration'; typeName: string; name: string; layout: LayoutQualifier | null; storage: string | null; precision: string | null; interpolation: string | null; arraySize: Expression | null; initializer: Expression | null; }
export interface StructDefinition extends AstNode { kind: 'StructDefinition'; name: string | null; members: VariableDeclaration[]; }
export interface PrecisionStatement extends AstNode { kind: 'PrecisionStatement'; precision: string; typeName: string; }
export type Statement = CompoundStatement | IfStatement | ForStatement | WhileStatement | DoWhileStatement | ReturnStatement | BreakStatement | ContinueStatement | DiscardStatement | SwitchStatement | CaseClause | ExpressionStatement | DeclarationStatement;
export interface CompoundStatement extends AstNode { kind: 'CompoundStatement'; statements: Statement[]; }
export interface IfStatement extends AstNode { kind: 'IfStatement'; condition: Expression; thenBranch: Statement; elseBranch: Statement | null; }
export interface ForStatement extends AstNode { kind: 'ForStatement'; init: Statement | Expression | null; condition: Expression | null; update: Expression | null; body: Statement; }
export interface WhileStatement extends AstNode { kind: 'WhileStatement'; condition: Expression; body: Statement; }
export interface DoWhileStatement extends AstNode { kind: 'DoWhileStatement'; body: Statement; condition: Expression; }
export interface ReturnStatement extends AstNode { kind: 'ReturnStatement'; value: Expression | null; }
export interface BreakStatement extends AstNode { kind: 'BreakStatement'; }
export interface ContinueStatement extends AstNode { kind: 'ContinueStatement'; }
export interface DiscardStatement extends AstNode { kind: 'DiscardStatement'; }
export interface SwitchStatement extends AstNode { kind: 'SwitchStatement'; discriminant: Expression; cases: CaseClause[]; }
export interface CaseClause extends AstNode { kind: 'CaseClause'; test: Expression | null; statements: Statement[]; }
export interface ExpressionStatement extends AstNode { kind: 'ExpressionStatement'; expression: Expression | null; }
export interface DeclarationStatement extends AstNode { kind: 'DeclarationStatement'; declaration: VariableDeclaration | StructDefinition | PrecisionStatement; }
export type Expression = BinaryExpression | UnaryExpression | PostfixExpression | FunctionCallExpression | FieldAccessExpression | IndexExpression | LiteralExpression | IdentifierExpression | ConditionalExpression | AssignmentExpression;
export interface BinaryExpression extends AstNode { kind: 'BinaryExpression'; op: string; left: Expression; right: Expression; }
export interface AssignmentExpression extends AstNode { kind: 'AssignmentExpression'; op: string; left: Expression; right: Expression; }
export interface ConditionalExpression extends AstNode { kind: 'ConditionalExpression'; condition: Expression; thenExpr: Expression; elseExpr: Expression; }
export interface UnaryExpression extends AstNode { kind: 'UnaryExpression'; op: string; operand: Expression; prefix: boolean; }
export interface PostfixExpression extends AstNode { kind: 'PostfixExpression'; op: string; operand: Expression; }
export interface FunctionCallExpression extends AstNode { kind: 'FunctionCallExpression'; callee: string; args: Expression[]; }
export interface FieldAccessExpression extends AstNode { kind: 'FieldAccessExpression'; object: Expression; field: string; }
export interface IndexExpression extends AstNode { kind: 'IndexExpression'; object: Expression; index: Expression; }
export interface LiteralExpression extends AstNode { kind: 'LiteralExpression'; literalKind: string; text: string; }
export interface IdentifierExpression extends AstNode { kind: 'IdentifierExpression'; name: string; }

const TYPE_NAMES = new Set(['void','bool','int','uint','float','vec2','vec3','vec4','bvec2','bvec3','bvec4','ivec2','ivec3','ivec4','uvec2','uvec3','uvec4','mat2','mat3','mat4','sampler2D','samplerCube','sampler3D','sampler2DArray','isampler2D','usampler2D','sampler2DShadow','samplerCubeShadow']);
const STORAGE = new Set(['attribute','varying','uniform','const','in','out','invariant','centroid']);
const PRECISION_Q = new Set(['lowp','mediump','highp']);
const INTERP = new Set(['flat','smooth','noperspective','patch','sample']);
const ASSIGN_OPS = new Set(['=','+=','-=','*=','/=','%=','<<=','>>=','&=','^=','|=']);

class Parser {
  tokens: Token[];
  pos = 0;
  version: number;
  depth = 0;
  errorMessage: string | null = null;

  constructor(tokens: Token[], version: number) {
    this.tokens = tokens;
    this.version = version;
  }
  current(): Token {
    if (this.pos < this.tokens.length) return this.tokens[this.pos] as Token;
    const last = this.tokens.length > 0 ? (this.tokens[this.tokens.length - 1] as Token) : null;
    const line = last ? last.line : 1;
    return { kind: 'EOF', text: '', line, column: 1 };
  }
  peek(offset: number): Token {
    const i = this.pos + offset;
    if (i < this.tokens.length) return this.tokens[i] as Token;
    return { kind: 'EOF', text: '', line: this.current().line, column: 1 };
  }
  isEOF(): boolean {
    const c = this.current();
    return c.kind === 'EOF' || this.pos >= this.tokens.length;
  }
  match(kind: string, text?: string): boolean {
    const c = this.current();
    if ((c.kind as string) !== kind) return false;
    if (text !== undefined && c.text !== text) return false;
    this.pos += 1;
    return true;
  }
  fail(line: number, msg: string): null {
    if (this.errorMessage === null) this.errorMessage = formatDiagnostic(line, msg, 0);
    return null;
  }
  checkDepth(): boolean {
    this.depth += 1;
    if (this.depth > MAX_PARSER_DEPTH) {
      if (this.errorMessage === null) this.errorMessage = formatDiagnostic(this.current().line, 'Parser nesting depth limit exceeded (64)', 0);
      return false;
    }
    return true;
  }
  releaseDepth(): void { this.depth -= 1; }

  parseTranslationUnit(): TranslationUnit | null {
    const decls: Declaration[] = [];
    while (!this.isEOF() && this.errorMessage === null) {
      if (!this.checkDepth()) return null;
      const d = this.parseExternalDeclaration();
      this.releaseDepth();
      if (d === null) return null;
      if (Array.isArray(d)) { for (const x of d) decls.push(x); }
      else decls.push(d);
    }
    if (this.errorMessage !== null) return null;
    return { kind: 'TranslationUnit', line: 1, declarations: decls };
  }

  parseExternalDeclaration(): Declaration | Declaration[] | null {
    const c = this.current();
    if (c.kind === 'KEYWORD' && c.text === 'precision') return this.parsePrecisionStatement();
    if (c.kind === 'KEYWORD' && c.text === 'struct') {
      const s = this.parseStructDefinition();
      if (s === null) return null;
      // struct definition may be followed by declarators + ';' or just ';'
      if (this.match('OPERATOR', ';')) return s;
      return s;
    }
    return this.parseDeclarationOrFunction();
  }

  parsePrecisionStatement(): PrecisionStatement | null {
    if (!this.checkDepth()) return null;
    const kw = this.current();
    this.pos += 1; // precision
    const p = this.current();
    if (p.kind !== 'KEYWORD' || !PRECISION_Q.has(p.text)) { this.releaseDepth(); return this.fail(p.line, "Expected precision qualifier '" + p.text + "'"); }
    this.pos += 1;
    const t = this.current();
    if (t.kind !== 'KEYWORD' || (t.text !== 'float' && t.text !== 'int' && t.text !== 'uint' && t.text !== 'sampler2D' && t.text !== 'samplerCube')) { this.releaseDepth(); return this.fail(t.line, "Expected type after precision qualifier, got '" + t.text + "'"); }
    this.pos += 1;
    const sc = this.current();
    if (sc.kind !== 'OPERATOR' || sc.text !== ';') { this.releaseDepth(); return this.fail(sc.line, "Expected ';' after declaration"); }
    this.pos += 1;
    this.releaseDepth();
    return { kind: 'PrecisionStatement', line: kw.line, precision: p.text, typeName: t.text };
  }

  parseStructDefinition(): StructDefinition | null {
    if (!this.checkDepth()) return null;
    const kw = this.current(); this.pos += 1;
    let name: string | null = null;
    const n = this.current();
    if (n.kind === 'IDENTIFIER') { name = n.text; this.pos += 1; }
    else if (n.kind === 'RESERVED') { this.releaseDepth(); return this.fail(n.line, "Reserved word '" + n.text + "' cannot be used as identifier"); }
    const o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== '{') { this.releaseDepth(); return this.fail(o.line, "Expected '{' after 'struct'"); }
    this.pos += 1;
    const members: VariableDeclaration[] = [];
    while (!this.isEOF() && this.errorMessage === null) {
      const cc = this.current();
      if (cc.kind === 'OPERATOR' && cc.text === '}') break;
      if (!this.checkDepth()) return null;
      const m = this.parseMemberDeclaration();
      this.releaseDepth();
      if (m === null) return null;
      members.push(m);
    }
    const cl = this.current();
    if (cl.kind !== 'OPERATOR' || cl.text !== '}') { this.releaseDepth(); return this.fail(cl.line, 'Unexpected end of file inside struct definition'); }
    this.pos += 1;
    this.releaseDepth();
    return { kind: 'StructDefinition', line: kw.line, name, members };
  }

  parseMemberDeclaration(): VariableDeclaration | null {
    const t = this.current();
    let typeName = '';
    if (t.kind === 'KEYWORD' && TYPE_NAMES.has(t.text)) { typeName = t.text; this.pos += 1; }
    else if (t.kind === 'IDENTIFIER') { typeName = t.text; this.pos += 1; }
    else { return this.fail(t.line, "Unexpected token '" + t.text + "'"); }
    const id = this.current();
    if (id.kind === 'RESERVED') return this.fail(id.line, "Reserved word '" + id.text + "' cannot be used as identifier");
    if (id.kind !== 'IDENTIFIER') return this.fail(id.line, "Expected identifier, got '" + id.text + "'");
    this.pos += 1;
    let arr: Expression | null = null;
    if (this.current().kind === 'OPERATOR' && this.current().text === '[') {
      this.pos += 1;
      arr = this.parseExpression();
      if (arr === null) return null;
      const rb = this.current();
      if (rb.kind !== 'OPERATOR' || rb.text !== ']') return this.fail(rb.line, "Expected ']'");
      this.pos += 1;
    }
    const sc = this.current();
    if (sc.kind !== 'OPERATOR' || sc.text !== ';') return this.fail(sc.line, "Expected ';' after declaration");
    this.pos += 1;
    return { kind: 'VariableDeclaration', line: t.line, typeName, name: id.text, layout: null, storage: null, precision: null, interpolation: null, arraySize: arr, initializer: null };
  }

  parseDeclarationOrFunction(): Declaration | Declaration[] | null {
    if (!this.checkDepth()) return null;
    let layout: LayoutQualifier | null = null;
    let storage: string | null = null;
    let precision: string | null = null;
    let interpolation: string | null = null;
    const startLine = this.current().line;
    // layout
    const lc = this.current();
    if ((lc.kind === 'KEYWORD' || lc.kind === 'IDENTIFIER' || lc.kind === 'RESERVED') && lc.text === 'layout') {
      if (this.version !== 300) { this.releaseDepth(); return this.fail(lc.line, "Qualifier 'layout' not supported in GLSL ES 1.00"); }
      this.pos += 1;
      let o = this.current();
      if (o.kind !== 'OPERATOR' || o.text !== '(') { this.releaseDepth(); return this.fail(o.line, "Expected '(' after 'layout'"); }
      this.pos += 1;
      o = this.current();
      if (o.text !== 'location') { this.releaseDepth(); return this.fail(o.line, "Expected 'location' in layout qualifier"); }
      this.pos += 1;
      o = this.current();
      if (o.kind !== 'OPERATOR' || o.text !== '=') { this.releaseDepth(); return this.fail(o.line, "Expected '=' in layout qualifier"); }
      this.pos += 1;
      o = this.current();
      if (o.kind !== 'INT_CONSTANT' && o.kind !== 'UINT_CONSTANT') { this.releaseDepth(); return this.fail(o.line, "Expected integer location value"); }
      const loc = parseInt(o.text, 10);
      this.pos += 1;
      o = this.current();
      if (o.kind !== 'OPERATOR' || o.text !== ')') { this.releaseDepth(); return this.fail(o.line, "Expected ')'"); }
      this.pos += 1;
      layout = { kind: 'LayoutQualifier', line: lc.line, location: loc };
    }
    // interpolation
    let ic = this.current();
    if (INTERP.has(ic.text) && (ic.kind === 'KEYWORD' || ic.kind === 'IDENTIFIER' || ic.kind === 'RESERVED')) {
      if (this.version === 100) { this.releaseDepth(); return this.fail(ic.line, "Interpolation qualifier '" + ic.text + "' not supported in GLSL ES 1.00"); }
      interpolation = ic.text; this.pos += 1;
    }
    // storage
    let sc = this.current();
    if ((sc.kind === 'KEYWORD' || sc.kind === 'IDENTIFIER' || sc.kind === 'RESERVED') && STORAGE.has(sc.text)) {
      if ((sc.text === 'attribute' || sc.text === 'varying') && this.version === 300) { this.releaseDepth(); return this.fail(sc.line, "Legacy qualifier '" + sc.text + "' not allowed in GLSL ES 3.00"); }
      if ((sc.text === 'in' || sc.text === 'out') && this.version === 100) { this.releaseDepth(); return this.fail(sc.line, "Storage qualifier '" + sc.text + "' not allowed in GLSL ES 1.00"); }
      storage = sc.text; this.pos += 1;
    }
    // precision
    let pc = this.current();
    if (pc.kind === 'KEYWORD' && PRECISION_Q.has(pc.text)) { precision = pc.text; this.pos += 1; }
    // invariant/centroid second storage slot
    let sc2 = this.current();
    if ((sc2.kind === 'KEYWORD' || sc2.kind === 'IDENTIFIER') && (sc2.text === 'invariant' || sc2.text === 'centroid') && storage === null) { storage = sc2.text; this.pos += 1; }
    // type
    const tc = this.current();
    let typeName = '';
    if (tc.kind === 'KEYWORD' && TYPE_NAMES.has(tc.text)) {
      if (tc.text === 'uint' || tc.text === 'uvec2' || tc.text === 'uvec3' || tc.text === 'uvec4') {
        if (this.version === 100) { this.releaseDepth(); return this.fail(tc.line, "Type '" + tc.text + "' not supported in GLSL ES 1.00"); }
      }
      typeName = tc.text; this.pos += 1;
    } else if (tc.kind === 'KEYWORD' && tc.text === 'struct') {
      const sd = this.parseStructDefinition();
      if (sd === null) { this.releaseDepth(); return null; }
      // struct type + declarators
      const nc = this.current();
      if (nc.kind === 'OPERATOR' && nc.text === ';') { this.pos += 1; this.releaseDepth(); return sd; }
      // named declarators of struct type
      const out: VariableDeclaration[] = [];
      const r = this.parseDeclaratorList(sd.name ?? 'struct', layout, storage, precision, interpolation, startLine);
      this.releaseDepth();
      if (r === null) return null;
      return [sd, ...r];
    } else if (tc.kind === 'IDENTIFIER') { typeName = tc.text; this.pos += 1; }
    else if (tc.kind === 'RESERVED') { this.releaseDepth(); return this.fail(tc.line, "Reserved word '" + tc.text + "' cannot be used as identifier"); }
    else { this.releaseDepth(); return this.fail(tc.line, "Unexpected token '" + tc.text + "'"); }
    // function definition or prototype?
    const nc = this.current();
    const nn = this.peek(1);
    if ((nc.kind === 'IDENTIFIER' || (nc.kind === 'KEYWORD' && (nc.text === 'main' || nc.text === 'texture2D' || nc.text === 'textureCube'))) && nn.kind === 'OPERATOR' && nn.text === '(') {
      const fname = nc.text; this.pos += 1; // name
      this.pos += 1; // (
      const params: VariableDeclaration[] = [];
      if (!(this.current().kind === 'OPERATOR' && this.current().text === ')')) {
        while (true) {
          const p = this.parseParam();
          if (p === null) { this.releaseDepth(); return null; }
          params.push(p);
          const sep = this.current();
          if (sep.kind === 'OPERATOR' && sep.text === ',') { this.pos += 1; continue; }
          break;
        }
      }
      const rp = this.current();
      if (rp.kind !== 'OPERATOR' || rp.text !== ')') { this.releaseDepth(); return this.fail(rp.line, "Expected ')'"); }
      this.pos += 1;
      const after = this.current();
      if (after.kind === 'OPERATOR' && after.text === ';') {
        this.pos += 1; this.releaseDepth();
        return { kind: 'FunctionPrototype', line: startLine, returnType: { kind: 'TypeSpecifier', line: startLine, name: typeName }, name: fname, params };
      }
      if (after.kind === 'OPERATOR' && after.text === '{') {
        const body = this.parseCompoundStatement();
        if (body === null) { this.releaseDepth(); return null; }
        this.releaseDepth();
        return { kind: 'FunctionDefinition', line: startLine, returnType: { kind: 'TypeSpecifier', line: startLine, name: typeName }, name: fname, params, body };
      }
      this.releaseDepth();
      return this.fail(after.line, "Expected function body or ';'");
    }
    // global declarator list
    const r = this.parseDeclaratorList(typeName, layout, storage, precision, interpolation, startLine);
    this.releaseDepth();
    if (r === null) return null;
    return r;
  }

  parseParam(): VariableDeclaration | null {
    const c = this.current();
    let precision: string | null = null;
    // skip param qualifiers (in/out/inout/const); accept RESERVED kind since in/out tokenize as reserved under ES 1.00
    let paramStorage: string | null = null;
    while ((this.current().kind === 'KEYWORD' || this.current().kind === 'IDENTIFIER' || this.current().kind === 'RESERVED') && (this.current().text === 'in' || this.current().text === 'out' || this.current().text === 'inout' || this.current().text === 'const')) { if (this.current().text === 'in' || this.current().text === 'out' || this.current().text === 'inout') paramStorage = this.current().text; this.pos += 1; }
    if (this.current().kind === 'KEYWORD' && PRECISION_Q.has(this.current().text)) { precision = this.current().text; this.pos += 1; }
    const t = this.current();
    if (t.kind !== 'KEYWORD' || !TYPE_NAMES.has(t.text)) {
      if (t.kind === 'OPERATOR' && t.text === ')') return { kind: 'VariableDeclaration', line: t.line, typeName: 'void', name: '', layout: null, storage: null, precision: null, interpolation: null, arraySize: null, initializer: null };
      return this.fail(t.line, "Expected parameter type, got '" + t.text + "'");
    }
    this.pos += 1;
    const id = this.current();
    if (id.kind === 'OPERATOR' && (id.text === ')' || id.text === ',')) {
      return { kind: 'VariableDeclaration', line: c.line, typeName: t.text, name: '', layout: null, storage: paramStorage, precision, interpolation: null, arraySize: null, initializer: null };
    }
    if (id.kind !== 'IDENTIFIER') return this.fail(id.line, "Expected identifier, got '" + id.text + "'");
    this.pos += 1;
    let arr: Expression | null = null;
    if (this.current().kind === 'OPERATOR' && this.current().text === '[') {
      this.pos += 1;
      if (!(this.current().kind === 'OPERATOR' && this.current().text === ']')) {
        arr = this.parseExpression();
        if (arr === null) return null;
      }
      const rb = this.current();
      if (rb.kind !== 'OPERATOR' || rb.text !== ']') return this.fail(rb.line, "Expected ']'");
      this.pos += 1;
    }
    return { kind: 'VariableDeclaration', line: c.line, typeName: t.text, name: id.text, layout: null, storage: paramStorage, precision, interpolation: null, arraySize: arr, initializer: null };
  }

  parseDeclaratorList(typeName: string, layout: LayoutQualifier | null, storage: string | null, precision: string | null, interpolation: string | null, line: number): VariableDeclaration[] | null {
    const out: VariableDeclaration[] = [];
    while (true) {
      const id = this.current();
      if (id.kind === 'RESERVED') return this.fail(id.line, "Reserved word '" + id.text + "' cannot be used as identifier");
      if (id.kind !== 'IDENTIFIER') return this.fail(id.line, "Expected identifier, got '" + id.text + "'");
      this.pos += 1;
      let arr: Expression | null = null;
      if (this.current().kind === 'OPERATOR' && this.current().text === '[') {
        this.pos += 1;
        if (!(this.current().kind === 'OPERATOR' && this.current().text === ']')) {
          arr = this.parseExpression();
          if (arr === null) return null;
          const rb = this.current();
          if (rb.kind !== 'OPERATOR' || rb.text !== ']') return this.fail(rb.line, "Expected ']'");
          this.pos += 1;
        } else { this.pos += 1; }
      }
      let init: Expression | null = null;
      if (this.current().kind === 'OPERATOR' && this.current().text === '=') {
        this.pos += 1;
        init = this.parseExpression();
        if (init === null) return null;
      }
      out.push({ kind: 'VariableDeclaration', line, typeName, name: id.text, layout: layout && out.length === 0 ? layout : null, storage, precision, interpolation, arraySize: arr, initializer: init });
      const sep = this.current();
      if (sep.kind === 'OPERATOR' && sep.text === ',') { this.pos += 1; continue; }
      if (sep.kind === 'OPERATOR' && sep.text === ';') { this.pos += 1; break; }
      return this.fail(sep.line, "Expected ';' after declaration");
    }
    return out;
  }

  parseStatement(): Statement | null {
    if (!this.checkDepth()) return null;
    const c = this.current();
    let r: Statement | null;
    if (c.kind === 'OPERATOR' && c.text === '{') r = this.parseCompoundStatement();
    else if (c.kind === 'KEYWORD' && c.text === 'if') r = this.parseIfStatement();
    else if (c.kind === 'KEYWORD' && c.text === 'for') r = this.parseForStatement();
    else if (c.kind === 'KEYWORD' && c.text === 'while') r = this.parseWhileStatement();
    else if (c.kind === 'KEYWORD' && c.text === 'do') r = this.parseDoWhileStatement();
    else if (c.kind === 'KEYWORD' && c.text === 'switch') {
      if (this.version === 100) { this.releaseDepth(); return this.fail(c.line, "switch statement is not supported in GLSL ES 1.00"); }
      r = this.parseSwitchStatement();
    } else if (c.kind === 'KEYWORD' && (c.text === 'case' || c.text === 'default')) {
      if (this.version === 100) { this.releaseDepth(); return this.fail(c.line, 'case/default is not supported in GLSL ES 1.00'); }
      r = this.parseCaseLabel();
    } else if (c.kind === 'KEYWORD' && c.text === 'return') {
      const line = c.line; this.pos += 1;
      let v: Expression | null = null;
      if (!(this.current().kind === 'OPERATOR' && this.current().text === ';')) { v = this.parseExpression(); if (v === null) { this.releaseDepth(); return null; } }
      const sc = this.current();
      if (sc.kind !== 'OPERATOR' || sc.text !== ';') { this.releaseDepth(); return this.fail(sc.line, "Expected ';'"); }
      this.pos += 1;
      r = { kind: 'ReturnStatement', line, value: v };
    } else if (c.kind === 'KEYWORD' && c.text === 'break') {
      const line = c.line; this.pos += 1;
      const sc = this.current();
      if (sc.kind !== 'OPERATOR' || sc.text !== ';') { this.releaseDepth(); return this.fail(sc.line, "Expected ';'"); }
      this.pos += 1; r = { kind: 'BreakStatement', line };
    } else if (c.kind === 'KEYWORD' && c.text === 'continue') {
      const line = c.line; this.pos += 1;
      const sc = this.current();
      if (sc.kind !== 'OPERATOR' || sc.text !== ';') { this.releaseDepth(); return this.fail(sc.line, "Expected ';'"); }
      this.pos += 1; r = { kind: 'ContinueStatement', line };
    } else if (c.kind === 'KEYWORD' && c.text === 'discard') {
      const line = c.line; this.pos += 1;
      const sc = this.current();
      if (sc.kind !== 'OPERATOR' || sc.text !== ';') { this.releaseDepth(); return this.fail(sc.line, "Expected ';'"); }
      this.pos += 1; r = { kind: 'DiscardStatement', line };
    } else if (c.kind === 'KEYWORD' && c.text === 'precision') {
      const p = this.parsePrecisionStatement();
      this.releaseDepth();
      if (p === null) return null;
      return { kind: 'DeclarationStatement', line: p.line, declaration: p };
    } else if (this.startsDeclaration()) {
      const d = this.parseDeclarationOrFunction();
      this.releaseDepth();
      if (d === null) return null;
      const first = Array.isArray(d) ? d[0] : d;
      if (!first) return this.fail(c.line, "Unexpected token '" + c.text + "'");
      return { kind: 'DeclarationStatement', line: c.line, declaration: first as VariableDeclaration };
    } else if (c.kind === 'OPERATOR' && c.text === ';') {
      const line = c.line; this.pos += 1;
      r = { kind: 'ExpressionStatement', line, expression: null };
    } else {
      const e = this.parseExpression();
      if (e === null) { this.releaseDepth(); return null; }
      const sc = this.current();
      if (sc.kind !== 'OPERATOR' || sc.text !== ';') { this.releaseDepth(); return this.fail(sc.line, "Expected ';'"); }
      this.pos += 1;
      r = { kind: 'ExpressionStatement', line: c.line, expression: e };
    }
    this.releaseDepth();
    return r;
  }

  startsDeclaration(): boolean {
    const c = this.current();
    if (c.kind === 'KEYWORD' && (TYPE_NAMES.has(c.text) || c.text === 'struct' || PRECISION_Q.has(c.text))) return true;
    if (c.kind === 'KEYWORD' && STORAGE.has(c.text)) return true;
    if ((c.kind === 'KEYWORD' || c.kind === 'IDENTIFIER') && (c.text === 'layout' || INTERP.has(c.text))) return true;
    if (c.kind === 'IDENTIFIER' && this.peek(1).kind === 'IDENTIFIER') return true;
    return false;
  }

  parseCompoundStatement(): CompoundStatement | null {
    if (!this.checkDepth()) return null;
    const o = this.current();
    this.pos += 1; // {
    const stmts: Statement[] = [];
    while (!this.isEOF() && this.errorMessage === null) {
      const c = this.current();
      if (c.kind === 'OPERATOR' && c.text === '}') break;
      if (!this.checkDepth()) return null;
      const s = this.parseStatement();
      this.releaseDepth();
      if (s === null) return null;
      stmts.push(s);
    }
    const cl = this.current();
    if (cl.kind !== 'OPERATOR' || cl.text !== '}') { this.releaseDepth(); return this.fail(cl.line, 'Unexpected end of file inside compound statement'); }
    this.pos += 1;
    this.releaseDepth();
    return { kind: 'CompoundStatement', line: o.line, statements: stmts };
  }

  parseIfStatement(): IfStatement | null {
    if (!this.checkDepth()) return null;
    const kw = this.current(); this.pos += 1;
    let o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== '(') { this.releaseDepth(); return this.fail(o.line, "Expected '(' after 'if'"); }
    this.pos += 1;
    const cond = this.parseExpression();
    if (cond === null) { this.releaseDepth(); return null; }
    o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== ')') { this.releaseDepth(); return this.fail(o.line, "Expected ')'"); }
    this.pos += 1;
    const th = this.parseStatement();
    if (th === null) { this.releaseDepth(); return null; }
    let el: Statement | null = null;
    if (this.current().kind === 'KEYWORD' && this.current().text === 'else') { this.pos += 1; el = this.parseStatement(); if (el === null) { this.releaseDepth(); return null; } }
    this.releaseDepth();
    return { kind: 'IfStatement', line: kw.line, condition: cond, thenBranch: th, elseBranch: el };
  }

  parseForStatement(): ForStatement | null {
    if (!this.checkDepth()) return null;
    const kw = this.current(); this.pos += 1;
    let o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== '(') { this.releaseDepth(); return this.fail(o.line, "Expected '(' after 'for'"); }
    this.pos += 1;
    let init: Statement | Expression | null = null;
    if (this.current().kind === 'OPERATOR' && this.current().text === ';') { this.pos += 1; }
    else if (this.startsDeclaration()) { const d = this.parseDeclarationOrFunction(); if (d === null) { this.releaseDepth(); return null; } const f = Array.isArray(d) ? d[0] : d; init = { kind: 'DeclarationStatement', line: kw.line, declaration: f as VariableDeclaration }; }
    else { const e = this.parseExpression(); if (e === null) { this.releaseDepth(); return null; } init = e; const s = this.current(); if (s.kind !== 'OPERATOR' || s.text !== ';') { this.releaseDepth(); return this.fail(s.line, "Expected ';'"); } this.pos += 1; }
    let cond: Expression | null = null;
    if (!(this.current().kind === 'OPERATOR' && this.current().text === ';')) { cond = this.parseExpression(); if (cond === null) { this.releaseDepth(); return null; } }
    let s2 = this.current();
    if (s2.kind !== 'OPERATOR' || s2.text !== ';') { this.releaseDepth(); return this.fail(s2.line, "Expected ';'"); }
    this.pos += 1;
    let upd: Expression | null = null;
    if (!(this.current().kind === 'OPERATOR' && this.current().text === ')')) { upd = this.parseExpression(); if (upd === null) { this.releaseDepth(); return null; } }
    const rp = this.current();
    if (rp.kind !== 'OPERATOR' || rp.text !== ')') { this.releaseDepth(); return this.fail(rp.line, "Expected ')'"); }
    this.pos += 1;
    const body = this.parseStatement();
    if (body === null) { this.releaseDepth(); return null; }
    this.releaseDepth();
    return { kind: 'ForStatement', line: kw.line, init, condition: cond, update: upd, body };
  }

  parseWhileStatement(): WhileStatement | null {
    if (!this.checkDepth()) return null;
    const kw = this.current(); this.pos += 1;
    let o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== '(') { this.releaseDepth(); return this.fail(o.line, "Expected '(' after 'while'"); }
    this.pos += 1;
    const cond = this.parseExpression();
    if (cond === null) { this.releaseDepth(); return null; }
    o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== ')') { this.releaseDepth(); return this.fail(o.line, "Expected ')'"); }
    this.pos += 1;
    const body = this.parseStatement();
    if (body === null) { this.releaseDepth(); return null; }
    this.releaseDepth();
    return { kind: 'WhileStatement', line: kw.line, condition: cond, body };
  }

  parseDoWhileStatement(): DoWhileStatement | null {
    if (!this.checkDepth()) return null;
    const kw = this.current(); this.pos += 1;
    const body = this.parseStatement();
    if (body === null) { this.releaseDepth(); return null; }
    const w = this.current();
    if (w.kind !== 'KEYWORD' || w.text !== 'while') { this.releaseDepth(); return this.fail(w.line, "Expected 'while'"); }
    this.pos += 1;
    let o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== '(') { this.releaseDepth(); return this.fail(o.line, "Expected '('"); }
    this.pos += 1;
    const cond = this.parseExpression();
    if (cond === null) { this.releaseDepth(); return null; }
    o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== ')') { this.releaseDepth(); return this.fail(o.line, "Expected ')'"); }
    this.pos += 1;
    const sc = this.current();
    if (sc.kind !== 'OPERATOR' || sc.text !== ';') { this.releaseDepth(); return this.fail(sc.line, "Expected ';'"); }
    this.pos += 1;
    this.releaseDepth();
    return { kind: 'DoWhileStatement', line: kw.line, body, condition: cond };
  }

  parseSwitchStatement(): SwitchStatement | null {
    if (!this.checkDepth()) return null;
    const kw = this.current(); this.pos += 1;
    let o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== '(') { this.releaseDepth(); return this.fail(o.line, "Expected '(' after 'switch'"); }
    this.pos += 1;
    const disc = this.parseExpression();
    if (disc === null) { this.releaseDepth(); return null; }
    o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== ')') { this.releaseDepth(); return this.fail(o.line, "Expected ')'"); }
    this.pos += 1;
    o = this.current();
    if (o.kind !== 'OPERATOR' || o.text !== '{') { this.releaseDepth(); return this.fail(o.line, "Expected '{'"); }
    this.pos += 1;
    const cases: CaseClause[] = [];
    while (!this.isEOF() && this.errorMessage === null) {
      const c = this.current();
      if (c.kind === 'OPERATOR' && c.text === '}') break;
      if (c.kind === 'KEYWORD' && (c.text === 'case' || c.text === 'default')) {
        const cc = this.parseCaseLabel();
        if (cc === null) { this.releaseDepth(); return null; }
        cases.push(cc);
      } else {
        const s = this.parseStatement();
        if (s === null) { this.releaseDepth(); return null; }
        if (cases.length === 0) { this.releaseDepth(); return this.fail(c.line, "Expected 'case' or 'default'"); }
        (cases[cases.length - 1] as CaseClause).statements.push(s);
      }
    }
    const cl = this.current();
    if (cl.kind !== 'OPERATOR' || cl.text !== '}') { this.releaseDepth(); return this.fail(cl.line, 'Unexpected end of file inside compound statement'); }
    this.pos += 1;
    this.releaseDepth();
    return { kind: 'SwitchStatement', line: kw.line, discriminant: disc, cases };
  }

  parseCaseLabel(): CaseClause | null {
    if (!this.checkDepth()) return null;
    const kw = this.current(); this.pos += 1;
    let test: Expression | null = null;
    if (kw.text === 'case') {
      test = this.parseExpression();
      if (test === null) { this.releaseDepth(); return null; }
    }
    const co = this.current();
    if (co.kind !== 'OPERATOR' || co.text !== ':') { this.releaseDepth(); return this.fail(co.line, "Expected ':'"); }
    this.pos += 1;
    this.releaseDepth();
    return { kind: 'CaseClause', line: kw.line, test, statements: [] };
  }

  // ---- expressions ----
  parseExpression(): Expression | null {
    const l = this.parseAssignmentExpression();
    if (l === null) return null;
    return l;
  }
  parseAssignmentExpression(): Expression | null {
    if (!this.checkDepth()) return null;
    const left = this.parseConditionalExpression();
    if (left === null) { this.releaseDepth(); return null; }
    const o = this.current();
    if (o.kind === 'OPERATOR' && ASSIGN_OPS.has(o.text)) {
      // gl_FragColor write gate under 300
      if (this.version === 300 && left.kind === 'IdentifierExpression' && (left as IdentifierExpression).name === 'gl_FragColor') { this.releaseDepth(); return this.fail(o.line, "gl_FragColor is not supported in GLSL ES 3.00"); }
      this.pos += 1;
      const right = this.parseAssignmentExpression();
      if (right === null) { this.releaseDepth(); return null; }
      this.releaseDepth();
      return { kind: 'AssignmentExpression', line: o.line, op: o.text, left, right };
    }
    this.releaseDepth();
    return left;
  }
  parseConditionalExpression(): Expression | null {
    if (!this.checkDepth()) return null;
    const c = this.parseLogicalOr();
    if (c === null) { this.releaseDepth(); return null; }
    if (this.current().kind === 'OPERATOR' && this.current().text === '?') {
      this.pos += 1;
      const t = this.parseExpression();
      if (t === null) { this.releaseDepth(); return null; }
      const co = this.current();
      if (co.kind !== 'OPERATOR' || co.text !== ':') { this.releaseDepth(); return this.fail(co.line, "Expected ':'"); }
      this.pos += 1;
      const e = this.parseConditionalExpression();
      if (e === null) { this.releaseDepth(); return null; }
      this.releaseDepth();
      return { kind: 'ConditionalExpression', line: c.line, condition: c, thenExpr: t, elseExpr: e };
    }
    this.releaseDepth();
    return c;
  }
  binLevel(next: () => Expression | null, ops: Set<string>): Expression | null {
    if (!this.checkDepth()) return null;
    let left = next();
    if (left === null) { this.releaseDepth(); return null; }
    while (this.current().kind === 'OPERATOR' && ops.has(this.current().text)) {
      const op = this.current(); this.pos += 1;
      const right = next();
      if (right === null) { this.releaseDepth(); return null; }
      left = { kind: 'BinaryExpression', line: op.line, op: op.text, left, right };
    }
    this.releaseDepth();
    return left;
  }
  parseLogicalOr(): Expression | null { return this.binLevel(() => this.parseLogicalXor(), new Set(['||'])); }
  parseLogicalXor(): Expression | null { return this.binLevel(() => this.parseLogicalAnd(), new Set(['^^'])); }
  parseLogicalAnd(): Expression | null { return this.binLevel(() => this.parseBitwiseOr(), new Set(['&&'])); }
  parseBitwiseOr(): Expression | null { return this.binLevel(() => this.parseBitwiseXor(), new Set(['|'])); }
  parseBitwiseXor(): Expression | null { return this.binLevel(() => this.parseBitwiseAnd(), new Set(['^'])); }
  parseBitwiseAnd(): Expression | null { return this.binLevel(() => this.parseEquality(), new Set(['&'])); }
  parseEquality(): Expression | null { return this.binLevel(() => this.parseRelational(), new Set(['==', '!='])); }
  parseRelational(): Expression | null { return this.binLevel(() => this.parseShift(), new Set(['<', '>', '<=', '>='])); }
  parseShift(): Expression | null { return this.binLevel(() => this.parseAdditive(), new Set(['<<', '>>'])); }
  parseAdditive(): Expression | null { return this.binLevel(() => this.parseMultiplicative(), new Set(['+', '-'])); }
  parseMultiplicative(): Expression | null { return this.binLevel(() => this.parseUnary(), new Set(['*', '/', '%'])); }
  parseUnary(): Expression | null {
    if (!this.checkDepth()) return null;
    const c = this.current();
    if (c.kind === 'OPERATOR' && (c.text === '+' || c.text === '-' || c.text === '!' || c.text === '~' || c.text === '++' || c.text === '--')) {
      this.pos += 1;
      const o = this.parseUnary();
      if (o === null) { this.releaseDepth(); return null; }
      this.releaseDepth();
      return { kind: 'UnaryExpression', line: c.line, op: c.text, operand: o, prefix: true };
    }
    const p = this.parsePostfix();
    this.releaseDepth();
    return p;
  }
  parsePostfix(): Expression | null {
    if (!this.checkDepth()) return null;
    let e = this.parsePrimary();
    if (e === null) { this.releaseDepth(); return null; }
    while (true) {
      const c = this.current();
      if (c.kind === 'OPERATOR' && (c.text === '++' || c.text === '--')) { this.pos += 1; e = { kind: 'PostfixExpression', line: c.line, op: c.text, operand: e }; continue; }
      if (c.kind === 'OPERATOR' && c.text === '.') {
        this.pos += 1;
        const f = this.current();
        if (f.kind !== 'IDENTIFIER') { this.releaseDepth(); return this.fail(f.line, "Expected field name, got '" + f.text + "'"); }
        this.pos += 1;
        e = { kind: 'FieldAccessExpression', line: c.line, object: e, field: f.text };
        continue;
      }
      if (c.kind === 'OPERATOR' && c.text === '[') {
        this.pos += 1;
        const idx = this.parseExpression();
        if (idx === null) { this.releaseDepth(); return null; }
        const rb = this.current();
        if (rb.kind !== 'OPERATOR' || rb.text !== ']') { this.releaseDepth(); return this.fail(rb.line, "Expected ']'"); }
        this.pos += 1;
        e = { kind: 'IndexExpression', line: c.line, object: e, index: idx };
        continue;
      }
      break;
    }
    this.releaseDepth();
    return e;
  }
  parsePrimary(): Expression | null {
    if (!this.checkDepth()) return null;
    const c = this.current();
    if (c.kind === 'OPERATOR' && c.text === '(') {
      this.pos += 1;
      const e = this.parseExpression();
      if (e === null) { this.releaseDepth(); return null; }
      const rp = this.current();
      if (rp.kind !== 'OPERATOR' || rp.text !== ')') { this.releaseDepth(); return this.fail(rp.line, "Expected ')'"); }
      this.pos += 1;
      this.releaseDepth();
      return e;
    }
    if (c.kind === 'INT_CONSTANT' || c.kind === 'UINT_CONSTANT' || c.kind === 'FLOAT_CONSTANT' || c.kind === 'BOOL_CONSTANT') {
      this.pos += 1; this.releaseDepth();
      return { kind: 'LiteralExpression', line: c.line, literalKind: c.kind, text: c.text };
    }
    if (c.kind === 'RESERVED') { this.releaseDepth(); return this.fail(c.line, "Reserved word '" + c.text + "' cannot be used as identifier"); }
    if (c.kind === 'IDENTIFIER' || c.kind === 'KEYWORD') {
      const name = c.text;
      const nxt = this.peek(1);
      const isCall = nxt.kind === 'OPERATOR' && nxt.text === '(';
      const isTypeCtor = TYPE_NAMES.has(name);
      const isBuiltinCall = name === 'texture2D' || name === 'textureCube' || name === 'texture2DProj';
      if (c.kind === 'KEYWORD' && !isTypeCtor && !isBuiltinCall && !isCall) {
        // keyword used as expression (e.g. 'goto' tokenized as RESERVED actually; 'in' etc.)
        if (name === 'in' || name === 'out') { this.releaseDepth(); return this.fail(c.line, "Storage qualifier '" + name + "' not allowed in GLSL ES 1.00"); }
        this.releaseDepth();
        return this.fail(c.line, "Unexpected token '" + name + "'");
      }
      if (this.version === 300 && name === 'gl_FragColor' && !isCall) {
        // read of gl_FragColor under 300 rejected (write handled in assignment)
        this.releaseDepth();
        return this.fail(c.line, 'gl_FragColor is not supported in GLSL ES 3.00');
      }
      this.pos += 1;
      if (isCall) {
        this.pos += 1; // (
        const args: Expression[] = [];
        if (!(this.current().kind === 'OPERATOR' && this.current().text === ')')) {
          while (true) {
            const a = this.parseAssignmentExpression();
            if (a === null) { this.releaseDepth(); return null; }
            args.push(a);
            const sep = this.current();
            if (sep.kind === 'OPERATOR' && sep.text === ',') { this.pos += 1; continue; }
            break;
          }
        }
        const rp = this.current();
        if (rp.kind !== 'OPERATOR' || rp.text !== ')') { this.releaseDepth(); return this.fail(rp.line, "Expected ')'"); }
        this.pos += 1;
        this.releaseDepth();
        return { kind: 'FunctionCallExpression', line: c.line, callee: name, args };
      }
      this.releaseDepth();
      return { kind: 'IdentifierExpression', line: c.line, name };
    }
    if (c.kind === 'EOF') { this.releaseDepth(); return this.fail(c.line, 'Unexpected end of file'); }
    this.releaseDepth();
    return this.fail(c.line, "Unexpected token '" + c.text + "'");
  }
}

export function parse(tokens: Token[], version?: number): CompileResult<TranslationUnit> {
  try {
    const v = version === 300 ? 300 : 100;
    const filtered = tokens.filter((t) => t.kind !== 'preprocessor');
    const p = new Parser(filtered, v);
    const ast = p.parseTranslationUnit();
    if (ast === null || p.errorMessage !== null) {
      const line = p.errorMessage !== null ? 1 : 1;
      void line;
      return { ok: false, log: p.errorMessage ?? formatDiagnostic(1, 'Parse error', 0) };
    }
    return { ok: true, tokens: ast };
  } catch (e) {
    return { ok: false, log: formatDiagnostic(1, e instanceof Error ? e.message : 'Parse error', 0) };
  }
}
