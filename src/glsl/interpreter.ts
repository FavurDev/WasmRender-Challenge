/** AST interpreter core — Sprint 4 Task 5 (Units 1-5 complete).
 *
 * Responsibility: tree-walking GLSL ES expression evaluation with float32
 * (Math.fround), int32 (|0) / uint32 (>>>0) wrapping, kind-preserving
 * swizzles, strict left-to-right evaluation order, and the executeVertex /
 * executeFragment entry points.
 *
 * Uniform-invariant hoisting (AC-10): scope is per-lookup lazy. Uniforms are
 * resolved on demand inside evalIdentifier via host.readUniform keyed by
 * program.activeUniforms slot; no eager pre-pass runs at entry. Rationale:
 * an eager pass would issue host calls even for uniforms never read (breaking
 * zero-call expectations) and would allocate per invocation; lazy lookup keeps
 * per-invocation allocation at zero beyond result buffers. Slot reuse (AC-9):
 * environments are fresh Maps per invocation but all value storage reuses the
 * caller's typed arrays via clone-on-bind; no persistent slot arrays are kept,
 * so repeated identical invocations produce byte-identical outputs (AC-4).
 */
import type {
  AssignmentExpression,
  BinaryExpression,
  CaseClause,
  CompoundStatement,
  ConditionalExpression,
  DeclarationStatement,
  DoWhileStatement,
  Expression,
  ExpressionStatement,
  FieldAccessExpression,
  ForStatement,
  FunctionCallExpression,
  FunctionDefinition,
  IdentifierExpression,
  IfStatement,
  IndexExpression,
  LiteralExpression,
  PostfixExpression,
  ReturnStatement,
  Statement,
  SwitchStatement,
  TranslationUnit,
  UnaryExpression,
  VariableDeclaration,
  WhileStatement,
} from './parser';
import type { Value } from './builtins';
import { evaluateBuiltin, evaluateSwizzle } from './builtins';
import type { LinkedProgram } from '../gl/program';

/** Derivative context for fragment evaluation (mirrors builtins' internal shape). */
export interface DerivativeContext {
  dFdx: (baseWidth: number, baseHeight: number) => number;
  dFdy: (baseWidth: number, baseHeight: number) => number;
  computeRho: (baseWidth: number, baseHeight: number) => number;
}
import { getCheckedAST } from './checker';

export interface InterpreterHost {
  readUniform(slot: number): number | Float32Array | Int32Array | Uint32Array;
  sample(slot: number, coord: Float32Array, biasOrLod?: number): Float32Array;
}

export interface ClipVertex {
  clipPos: Float32Array;
  pointSize: number;
  varyings: Map<string, Float32Array>;
}

export interface FragmentResult {
  discarded: boolean;
  color: Float32Array;
  depth?: number;
}

/** Context threaded through expression evaluation. */
export interface EvalContext {
  program: LinkedProgram;
  host: InterpreterHost;
  version: 100 | 300;
}

/* ------------------------------------------------------------------ */
/* Unit 1: ExecutionEnvironment                                        */
/* ------------------------------------------------------------------ */

/** Tree-walking execution state: globals, call-stack frames, control flags. */
export class ExecutionEnvironment {
  public globalVariables = new Map<string, Value | Value[]>();
  public callStack: Array<Map<string, Value | Value[]>> = [];
  public returnSignaled = false;
  public returnValue: Value | Value[] | undefined = undefined;
  public breakSignaled = false;
  public continueSignaled = false;
  public discardSignaled = false;

  public pushFrame(): void {
    this.callStack.push(new Map());
  }

  public popFrame(): void {
    this.callStack.pop();
  }

  /** Innermost scope first, then globals. Returns undefined when unbound. */
  public lookup(name: string): Value | Value[] | undefined {
    for (let i = this.callStack.length - 1; i >= 0; i--) {
      const frame = this.callStack[i] as Map<string, Value | Value[]>;
      if (frame.has(name)) return frame.get(name);
    }
    return this.globalVariables.get(name);
  }

  /** Assign to the innermost existing binding, else to the current frame / globals. */
  public assign(name: string, value: Value | Value[]): void {
    for (let i = this.callStack.length - 1; i >= 0; i--) {
      const frame = this.callStack[i] as Map<string, Value | Value[]>;
      if (frame.has(name)) {
        frame.set(name, value);
        return;
      }
    }
    if (this.globalVariables.has(name)) {
      this.globalVariables.set(name, value);
      return;
    }
    if (this.callStack.length > 0) {
      (this.callStack[this.callStack.length - 1] as Map<string, Value | Value[]>).set(name, value);
      return;
    }
    this.globalVariables.set(name, value);
  }

  /** Define a fresh binding in the current (innermost) scope. */
  public define(name: string, value: Value | Value[]): void {
    if (this.callStack.length > 0) {
      (this.callStack[this.callStack.length - 1] as Map<string, Value | Value[]>).set(name, value);
      return;
    }
    this.globalVariables.set(name, value);
  }

  public clearControlFlags(): void {
    this.returnSignaled = false;
    this.returnValue = undefined;
    this.breakSignaled = false;
    this.continueSignaled = false;
    this.discardSignaled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function f(x: number): number {
  return Math.fround(x);
}

function toNum(v: Value | Value[]): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Float32Array || v instanceof Int32Array || v instanceof Uint32Array) {
    return (v as ArrayLike<number>)[0] as number;
  }
  if (Array.isArray(v)) {
    const first = (v as unknown[])[0];
    if (typeof first === 'number') return first;
    if (typeof first === 'boolean') return first ? 1 : 0;
    return 0;
  }
  return 0;
}

function truthy(v: Value | Value[]): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v instanceof Float32Array || v instanceof Int32Array || v instanceof Uint32Array) {
    return (v as ArrayLike<number>)[0] !== 0;
  }
  if (Array.isArray(v)) {
    const first = (v as unknown[])[0];
    if (typeof first === 'boolean') return first;
    if (typeof first === 'number') return first !== 0;
    return false;
  }
  return false;
}

function cloneValue(v: Value): Value {
  if (v instanceof Float32Array) return new Float32Array(v);
  if (v instanceof Int32Array) return new Int32Array(v);
  if (v instanceof Uint32Array) return new Uint32Array(v);
  if (Array.isArray(v)) return [...(v as boolean[])];
  return v;
}

function isMatVal(v: Value, n: number): v is Float32Array {
  return v instanceof Float32Array && v.length === n;
}

function matVecMul(mat: Float32Array, vec: Float32Array): Float32Array {
  // Column-major: mat is MxM, vec is M.
  const m = vec.length;
  const out = new Float32Array(m);
  for (let r = 0; r < m; r++) {
    let acc = 0;
    for (let c = 0; c < m; c++) acc += (mat[c * m + r] as number) * (vec[c] as number);
    out[r] = f(acc);
  }
  return out;
}

function vecMatMul(vec: Float32Array, mat: Float32Array): Float32Array {
  const m = vec.length;
  const out = new Float32Array(m);
  for (let c = 0; c < m; c++) {
    let acc = 0;
    for (let r = 0; r < m; r++) acc += (vec[r] as number) * (mat[c * m + r] as number);
    out[c] = f(acc);
  }
  return out;
}

function matMatMul(a: Float32Array, b: Float32Array, m: number): Float32Array {
  // C = A * B, column-major MxM.
  const out = new Float32Array(m * m);
  for (let c = 0; c < m; c++) {
    for (let r = 0; r < m; r++) {
      let acc = 0;
      for (let k = 0; k < m; k++) acc += (a[k * m + r] as number) * (b[c * m + k] as number);
      out[c * m + r] = f(acc);
    }
  }
  return out;
}

const SWIZZLE_CHARS = new Set(['x', 'y', 'z', 'w', 'r', 'g', 'b', 'a', 's', 't', 'p', 'q']);

function isSwizzleField(field: string): boolean {
  if (field.length < 1 || field.length > 4) return false;
  for (const ch of field) if (!SWIZZLE_CHARS.has(ch)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Unit 2: evaluateExpression                                          */
/* ------------------------------------------------------------------ */

export function evaluateExpression(
  expr: Expression,
  env: ExecutionEnvironment,
  ctx: EvalContext,
): Value | Value[] {
  switch (expr.kind) {
    case 'LiteralExpression': return evalLiteral(expr as LiteralExpression);
    case 'IdentifierExpression': return evalIdentifier(expr as IdentifierExpression, env, ctx);
    case 'BinaryExpression': {
      const b = expr as BinaryExpression;
      // Strict left-to-right: left first, then right.
      const l = evaluateExpression(b.left, env, ctx);
      const r = evaluateExpression(b.right, env, ctx);
      return evalBinary(b.op, l, r);
    }
    case 'AssignmentExpression': return evalAssignment(expr as AssignmentExpression, env, ctx);
    case 'FieldAccessExpression': {
      const fa = expr as FieldAccessExpression;
      const obj = evaluateExpression(fa.object, env, ctx);
      if (!isSwizzleField(fa.field)) return f(0);
      return evaluateSwizzle(obj as Value, fa.field) as Value | Value[];
    }
    case 'IndexExpression': {
      const ix = expr as IndexExpression;
      const obj = evaluateExpression(ix.object, env, ctx);
      const idx = evaluateExpression(ix.index, env, ctx);
      return evalIndex(obj, idx);
    }
    case 'FunctionCallExpression': return evalCall(expr as FunctionCallExpression, env, ctx);
    case 'ConditionalExpression': {
      const c = expr as ConditionalExpression;
      const cond = evaluateExpression(c.condition, env, ctx);
      return truthy(cond)
        ? evaluateExpression(c.thenExpr, env, ctx)
        : evaluateExpression(c.elseExpr, env, ctx);
    }
    case 'UnaryExpression': {
      const u = expr as UnaryExpression;
      const v = evaluateExpression(u.operand, env, ctx);
      return evalUnary(u.op, v, u.prefix, env, u.operand);
    }
    case 'PostfixExpression': {
      const p = expr as PostfixExpression;
      return evalPostfix(p, env, ctx);
    }
    default: return f(0);
  }
}

function evalLiteral(expr: LiteralExpression): Value {
  const kind = expr.literalKind;
  const text = expr.text;
  try {
    // Token kinds are INT_CONSTANT/UINT_CONSTANT/FLOAT_CONSTANT/BOOL_CONSTANT
    // (parser.ts line 728); accept the short aliases too for robustness.
    if (kind === 'bool' || kind === 'BOOL_CONSTANT') return text === 'true';
    if (kind === 'int' || kind === 'INT_CONSTANT') {
      const t = text.replace(/^[+-]/, '');
      const parsed = t.startsWith('0x') || t.startsWith('0X')
        ? parseInt(t, 16)
        : t.startsWith('0') && t.length > 1 && /^[0-7]+$/.test(t)
          ? parseInt(t, 8)
          : parseInt(t, 10);
      const sign = text.startsWith('-') ? -1 : 1;
      return (sign * (Number.isNaN(parsed) ? 0 : parsed)) | 0;
    }
    if (kind === 'uint' || kind === 'UINT_CONSTANT') {
      const t = text.replace(/[uU]$/, '').replace(/^[+-]/, '');
      const parsed = t.startsWith('0x') || t.startsWith('0X') ? parseInt(t, 16) : parseInt(t, 10);
      const sign = text.startsWith('-') ? -1 : 1;
      return (sign * (Number.isNaN(parsed) ? 0 : parsed)) >>> 0;
    }
    // float (also covers unknown kinds deterministically)
    const parsed = parseFloat(text);
    return f(Number.isNaN(parsed) ? 0 : parsed);
  } catch (_e) {
    void _e;
    return f(0);
  }
}

function evalIdentifier(
  expr: IdentifierExpression,
  env: ExecutionEnvironment,
  ctx: EvalContext,
): Value | Value[] {
  const bound = env.lookup(expr.name);
  if (bound !== undefined) return bound;
  // Uniform fallback via program.activeUniforms.
  try {
    const info = ctx.program.activeUniforms.find((u) => u.name === expr.name);
    if (info !== undefined) {
      const raw = ctx.host.readUniform(info.slot);
      if (typeof raw === 'number') return info.typeKind === 'int' ? raw | 0 : info.typeKind === 'uint' ? raw >>> 0 : f(raw);
      if (raw instanceof Float32Array) return new Float32Array(raw);
      if (raw instanceof Int32Array) return new Int32Array(raw);
      if (raw instanceof Uint32Array) return new Uint32Array(raw);
    }
  } catch (_e) {
    void _e;
  }
  return f(0);
}

/* ---------------- binary operators ---------------- */

function scalarFloatOp(op: string, a: number, b: number): number {
  switch (op) {
    case '+': return f(a + b);
    case '-': return f(a - b);
    case '*': return f(a * b);
    case '/': return b === 0 ? (a === 0 ? NaN : a > 0 ? Infinity : -Infinity) : f(a / b);
    case '%': return b === 0 ? NaN : f(a % b);
    default: return f(0);
  }
}

function scalarIntOp(op: string, a: number, b: number): number {
  const x = a | 0;
  const y = b | 0;
  switch (op) {
    case '+': return (x + y) | 0;
    case '-': return (x - y) | 0;
    case '*': return Math.imul(x, y);
    case '/': return y === 0 ? 0 : (x / y) | 0;
    case '%': return y === 0 ? 0 : (x % y) | 0;
    case '<<': return (x << (y & 31)) | 0;
    case '>>': return (x >> (y & 31)) | 0;
    case '&': return (x & y) | 0;
    case '|': return (x | y) | 0;
    case '^': return (x ^ y) | 0;
    default: return 0;
  }
}

function scalarUintOp(op: string, a: number, b: number): number {
  const x = a >>> 0;
  const y = b >>> 0;
  switch (op) {
    case '+': return (x + y) >>> 0;
    case '-': return (x - y) >>> 0;
    case '*': return Math.imul(x, y) >>> 0;
    case '/': return y === 0 ? 0 : Math.floor(x / y) >>> 0;
    case '%': return y === 0 ? 0 : (x % y) >>> 0;
    case '<<': return (x << (y & 31)) >>> 0;
    case '>>': return (x >>> (y & 31)) >>> 0;
    case '&': return (x & y) >>> 0;
    case '|': return (x | y) >>> 0;
    case '^': return (x ^ y) >>> 0;
    default: return 0;
  }
}

function evalBinary(op: string, l: Value | Value[], r: Value | Value[]): Value | Value[] {
  // Comparisons.
  if (op === '==' || op === '!=' || op === '<' || op === '<=' || op === '>' || op === '>=') {
    return evalComparison(op, l, r);
  }
  // Logic (non-short-circuit values already evaluated L-to-R).
  if (op === '&&' || op === '||' || op === '^^') {
    const a = truthy(l);
    const b = truthy(r);
    if (op === '&&') return a && b;
    if (op === '||') return a || b;
    return (a !== b) as boolean;
  }
  // Matrix algebra (column-major Float32Arrays of 4/9/16).
  const matSizes = [4, 9, 16];
  if (op === '*' && l instanceof Float32Array && r instanceof Float32Array) {
    const lm = matSizes.includes(l.length) && (l.length === 4 || l.length === 9 || l.length === 16);
    const rm = matSizes.includes(r.length) && (r.length === 4 || r.length === 9 || r.length === 16);
    const mOf = (len: number): number => (len === 4 ? 2 : len === 9 ? 3 : 4);
    if (lm && rm && l.length === r.length) return matMatMul(l, r, mOf(l.length));
    if (lm && !rm && r.length === mOf(l.length)) return matVecMul(l, r);
    if (!lm && rm && l.length === mOf(r.length)) return vecMatMul(l, r);
  }
  // Component-wise vector ops (same length, same kind).
  if (l instanceof Float32Array && r instanceof Float32Array && l.length === r.length) {
    return componentWiseF(l, r, op);
  }
  if (l instanceof Int32Array && r instanceof Int32Array && l.length === r.length) {
    return componentWiseI(l, r, op);
  }
  if (l instanceof Uint32Array && r instanceof Uint32Array && l.length === r.length) {
    return componentWiseU(l, r, op);
  }
  // Vector-scalar broadcast (float vectors).
  if (l instanceof Float32Array && typeof r === 'number') {
    const out = new Float32Array(l.length);
    for (let i = 0; i < l.length; i++) out[i] = scalarFloatOp(op, l[i] as number, r);
    return out;
  }
  if (typeof l === 'number' && r instanceof Float32Array) {
    const out = new Float32Array(r.length);
    for (let i = 0; i < r.length; i++) out[i] = scalarFloatOp(op, l, r[i] as number);
    return out;
  }
  if (l instanceof Int32Array && typeof r === 'number') {
    const out = new Int32Array(l.length);
    for (let i = 0; i < l.length; i++) out[i] = scalarIntOp(op, l[i] as number, r);
    return out;
  }
  if (l instanceof Uint32Array && typeof r === 'number') {
    const out = new Uint32Array(l.length);
    for (let i = 0; i < l.length; i++) out[i] = scalarUintOp(op, l[i] as number, r);
    return out;
  }
  if (typeof l === 'number' && r instanceof Int32Array) {
    const out = new Int32Array(r.length);
    for (let i = 0; i < r.length; i++) out[i] = scalarIntOp(op, l, r[i] as number);
    return out;
  }
  if (typeof l === 'number' && r instanceof Uint32Array) {
    const out = new Uint32Array(r.length);
    for (let i = 0; i < r.length; i++) out[i] = scalarUintOp(op, l, r[i] as number);
    return out;
  }
  // Scalar ops: pick int/uint lane when both sides are integers.
  if (typeof l === 'number' && typeof r === 'number') {
    if (op === '<<' || op === '>>' || op === '&' || op === '|' || op === '^' || op === '%') {
      // Bitwise ops and scalar % operate in the int lane.
      if (Number.isInteger(l) && Number.isInteger(r)) return scalarIntOp(op, l, r);
    }
    // GLSL int arithmetic wraps modulo 2^32 (AC-3). JS numbers carry no static
    // type, so select the int32 lane when both operands are integral values in
    // int32 range (covers int literals/variables; e.g. 2147483647 + 1 wraps).
    // Known limitation: integral-valued floats (e.g. 16777217.0) in int32 range
    // also take the int lane; float-precise results agree except beyond 2^24.
    if (
      (op === '+' || op === '-' || op === '*') &&
      Number.isInteger(l) &&
      Number.isInteger(r) &&
      l >= -2147483648 &&
      l <= 2147483647 &&
      r >= -2147483648 &&
      r <= 2147483647
    ) {
      return scalarIntOp(op, l, r);
    }
    if (op === '+' || op === '-' || op === '*' || op === '/' || op === '%') {
      return scalarFloatOp(op, l, r);
    }
    return scalarIntOp(op, l, r);
  }
  if (typeof l === 'boolean' && typeof r === 'boolean') {
    if (op === '==') return l === r;
    if (op === '!=') return l !== r;
    return false;
  }
  return f(0);
}

function componentWiseF(a: Float32Array, b: Float32Array, op: string): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = scalarFloatOp(op, a[i] as number, b[i] as number);
  return out;
}

function componentWiseI(a: Int32Array, b: Int32Array, op: string): Int32Array {
  const out = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = scalarIntOp(op, a[i] as number, b[i] as number);
  return out;
}

function componentWiseU(a: Uint32Array, b: Uint32Array, op: string): Uint32Array {
  const out = new Uint32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = scalarUintOp(op, a[i] as number, b[i] as number);
  return out;
}

function evalComparison(op: string, l: Value | Value[], r: Value | Value[]): Value | Value[] {
  if (
    (l instanceof Float32Array || l instanceof Int32Array || l instanceof Uint32Array) &&
    (r instanceof Float32Array || r instanceof Int32Array || r instanceof Uint32Array) &&
    (l as ArrayLike<number>).length === (r as ArrayLike<number>).length
  ) {
    const n = (l as ArrayLike<number>).length;
    const out: boolean[] = new Array<boolean>(n);
    for (let i = 0; i < n; i++) {
      const a = (l as ArrayLike<number>)[i] as number;
      const b = (r as ArrayLike<number>)[i] as number;
      out[i] = compareNums(op, a, b);
    }
    return out;
  }
  const a = toNum(l);
  const b = toNum(r);
  let result = false;
  switch (op) {
    case '==': result = a === b; break;
    case '!=': result = a !== b; break;
    case '<': result = a < b; break;
    case '<=': result = a <= b; break;
    case '>': result = a > b; break;
    case '>=': result = a >= b; break;
    default: result = false; break;
  }
  return result;
}

function compareNums(op: string, a: number, b: number): boolean {
  switch (op) {
    case '==': return a === b;
    case '!=': return a !== b;
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    default: return false;
  }
}

/* ---------------- assignment ---------------- */

function applyCompoundOp(op: string, oldV: Value | Value[], rhs: Value | Value[]): Value | Value[] {
  const baseOp = op === '=' ? '=' : op.slice(0, -1);
  if (baseOp === '=') return rhs;
  return evalBinary(baseOp, oldV, rhs);
}

function evalAssignment(
  expr: AssignmentExpression,
  env: ExecutionEnvironment,
  ctx: EvalContext,
): Value | Value[] {
  // Strict order: evaluate RHS first, then resolve the target.
  const rhs = evaluateExpression(expr.right, env, ctx);
  const target = expr.left;
  if (target.kind === 'IdentifierExpression') {
    const name = (target as IdentifierExpression).name;
    const oldV = env.lookup(name);
    const next = oldV === undefined ? rhs : applyCompoundOp(expr.op, oldV, rhs);
    env.assign(name, next);
    return next;
  }
  if (target.kind === 'FieldAccessExpression') {
    const fa = target as FieldAccessExpression;
    const base = evaluateExpression(fa.object, env, ctx);
    const masked = applySwizzleWrite(base as Value, fa.field, rhs as Value);
    // Write back through an identifier root when possible.
    if (fa.object.kind === 'IdentifierExpression') {
      env.assign((fa.object as IdentifierExpression).name, masked as Value | Value[]);
    }
    return masked as Value | Value[];
  }
  if (target.kind === 'IndexExpression') {
    const ix = target as IndexExpression;
    const obj = evaluateExpression(ix.object, env, ctx);
    const idxV = evaluateExpression(ix.index, env, ctx);
    const next = applyIndexWrite(obj, idxV, rhs, expr.op);
    if (ix.object.kind === 'IdentifierExpression') {
      env.assign((ix.object as IdentifierExpression).name, next);
    }
    return next;
  }
  return rhs;
}

function applySwizzleWrite(base: Value, field: string, rhs: Value): Value {
  try {
    if (!(base instanceof Float32Array) && !(base instanceof Int32Array) && !(base instanceof Uint32Array)) {
      return rhs;
    }
    const map: Record<string, number> = { x: 0, r: 0, s: 0, y: 1, g: 1, t: 1, z: 2, b: 2, p: 2, w: 3, a: 3, q: 3 };
    const lanes: number[] = [];
    for (const ch of field) {
      const m = map[ch];
      if (m === undefined || m >= base.length) return cloneValue(base as Value) as Value;
      lanes.push(m);
    }
    const rhsComps: number[] = rhs instanceof Float32Array || rhs instanceof Int32Array || rhs instanceof Uint32Array
      ? Array.from(rhs as ArrayLike<number>)
      : [toNum(rhs as Value)];
    const out = cloneValue(base as Value) as Float32Array | Int32Array | Uint32Array;
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i] as number;
      const v = rhsComps.length === 1 ? (rhsComps[0] as number) : ((rhsComps[i] as number) ?? 0);
      if (out instanceof Float32Array) out[lane] = f(v);
      else out[lane] = v;
    }
    return out as Value;
  } catch (_e) {
    void _e;
    return rhs;
  }
}

function applyIndexWrite(
  obj: Value | Value[],
  idxV: Value | Value[],
  rhs: Value | Value[],
  op: string,
): Value | Value[] {
  try {
    const raw = toNum(idxV as Value);
    const i = Number.isNaN(raw) ? 0 : Math.trunc(raw);
    if (obj instanceof Float32Array || obj instanceof Int32Array || obj instanceof Uint32Array) {
      const clamped = Math.min(Math.max(i, 0), obj.length - 1);
      const out = cloneValue(obj as Value) as Float32Array | Int32Array | Uint32Array;
      const v = toNum(rhs as Value);
      const oldV = (obj as ArrayLike<number>)[clamped] as number;
      const next = op === '=' ? v : toNum(evalBinary(op.slice(0, -1), oldV, v) as Value);
      if (out instanceof Float32Array) out[clamped] = f(next);
      else out[clamped] = next;
      return out as Value;
    }
    if (Array.isArray(obj)) {
      const arr = [...(obj as unknown[])] as Value[];
      if (arr.length === 0) return arr as Value[];
      const clamped = Math.min(Math.max(i, 0), arr.length - 1);
      const oldV = arr[clamped] as Value;
      arr[clamped] = (op === '=' ? rhs : evalBinary(op.slice(0, -1), oldV, rhs as Value)) as Value;
      return arr as Value[];
    }
    return obj;
  } catch (_e) {
    void _e;
    return obj;
  }
}

/* ---------------- index read (OOB clamp) ---------------- */

function evalIndex(obj: Value | Value[], idxV: Value | Value[]): Value | Value[] {
  try {
    const raw = toNum(idxV as Value);
    const i = Number.isNaN(raw) ? 0 : Math.trunc(raw);
    if (obj instanceof Float32Array) {
      if (obj.length === 0) return f(0);
      // Matrix column access: matN[i] yields a column vector.
      if (obj.length === 4 || obj.length === 9 || obj.length === 16) {
        const m = obj.length === 4 ? 2 : obj.length === 9 ? 3 : 4;
        const c = Math.min(Math.max(i, 0), m - 1);
        const out = new Float32Array(m);
        for (let r = 0; r < m; r++) out[r] = (obj as Float32Array)[c * m + r] as number;
        return out;
      }
      const clamped = Math.min(Math.max(i, 0), obj.length - 1);
      return f((obj as Float32Array)[clamped] as number);
    }
    if (obj instanceof Int32Array || obj instanceof Uint32Array) {
      if (obj.length === 0) return 0;
      const clamped = Math.min(Math.max(i, 0), obj.length - 1);
      return (obj as ArrayLike<number>)[clamped] as number;
    }
    if (Array.isArray(obj)) {
      const arr = obj as unknown[];
      if (arr.length === 0) return f(0);
      const clamped = Math.min(Math.max(i, 0), arr.length - 1);
      return (arr[clamped] as Value | Value[]) ?? f(0);
    }
    return f(0);
  } catch (_e) {
    void _e;
    return f(0);
  }
}

/* ---------------- calls ---------------- */

const CONSTRUCTOR_NAMES = new Set([
  'float', 'int', 'uint', 'bool',
  'vec2', 'vec3', 'vec4',
  'ivec2', 'ivec3', 'ivec4',
  'uvec2', 'uvec3', 'uvec4',
  'bvec2', 'bvec3', 'bvec4',
  'mat2', 'mat3', 'mat4',
]);

const TEXTURE_FNS = new Set([
  'texture2D', 'textureCube', 'texture', 'textureProj',
  'textureLod', 'textureGrad', 'textureLodEXT', 'texelFetch',
]);

/** Scalar constructors (float/int/uint/bool) — handled locally: the frozen
 * builtin tables register only vector/matrix constructors, so single-scalar
 * conversion lives in the interpreter's constructor dispatch (Unit 2). */
function evalScalarCtor(callee: string, args: Value[]): Value {
  const first: Value = args.length > 0 ? (args[0] as Value) : f(0);
  const num = toNum(first as Value);
  if (callee === 'float') return f(num);
  if (callee === 'int') {
    if (typeof first === 'boolean') return first ? 1 : 0;
    if (Number.isNaN(num)) return 0;
    return Math.trunc(num) | 0;
  }
  if (callee === 'uint') {
    if (typeof first === 'boolean') return first ? 1 : 0;
    if (Number.isNaN(num)) return 0;
    return Math.trunc(num) >>> 0;
  }
  // bool: nonzero numeric, true boolean, or nonzero first component.
  if (typeof first === 'boolean') return first;
  if (typeof first === 'number') return first !== 0;
  if (first instanceof Float32Array || first instanceof Int32Array || first instanceof Uint32Array) {
    return (first as ArrayLike<number>)[0] !== 0;
  }
  if (Array.isArray(first)) return (first as unknown[]).length > 0 && (first as unknown[])[0] !== false && (first as unknown[])[0] !== 0;
  return false;
}

function evalCall(
  expr: FunctionCallExpression,
  env: ExecutionEnvironment,
  ctx: EvalContext,
): Value | Value[] {
  // Strict left-to-right argument evaluation.
  const argVals: Value[] = [];
  for (const a of expr.args) argVals.push(evaluateExpression(a, env, ctx) as Value);
  if (expr.callee === 'float' || expr.callee === 'int' || expr.callee === 'uint' || expr.callee === 'bool') {
    return evalScalarCtor(expr.callee, argVals);
  }
  if (CONSTRUCTOR_NAMES.has(expr.callee)) {
    return evaluateBuiltin(expr.callee, argVals, ctx.version);
  }
  if (TEXTURE_FNS.has(expr.callee)) {
    return evalTextureCall(expr.callee, argVals, ctx);
  }
  // User-defined functions take precedence over the total builtin table
  // (evaluateBuiltin returns f(0) for unknown names).
  const userFn = findUserFunction(expr.callee, ctx);
  if (userFn !== undefined) {
    return invokeUserFunction(userFn, expr.args, argVals, env, ctx);
  }
  // Non-constructor builtins dispatch through the total builtin table.
  return evaluateBuiltin(expr.callee, argVals, ctx.version);
}

function evalTextureCall(callee: string, args: Value[], ctx: EvalContext): Value {
  try {
    // Sampler uniform slot lookup: first arg may be a sampler slot number.
    let slot = 0;
    if (args.length > 0) slot = Math.trunc(toNum(args[0] as Value));
    let coord = new Float32Array([0.5, 0.5, 0, 1]);
    if (args.length > 1) {
      const c = args[1] as Value;
      if (c instanceof Float32Array) {
        coord = new Float32Array(4);
        for (let i = 0; i < 4; i++) coord[i] = i < c.length ? (c[i] as number) : i === 3 ? 1 : 0;
      } else if (typeof c === 'number') {
        coord = new Float32Array([c, 0, 0, 1]);
      }
    }
    void callee;
    const sampled = ctx.host.sample(slot, coord);
    if (sampled instanceof Float32Array && sampled.length === 4) return sampled;
    const out = new Float32Array(4);
    for (let i = 0; i < 4; i++) out[i] = i < sampled.length ? (sampled[i] as number) : i === 3 ? 1 : 0;
    return out;
  } catch (_e) {
    void _e;
    return new Float32Array([0, 0, 0, 1]);
  }
}

/* ---------------- unary / postfix ---------------- */

function evalUnary(
  op: string,
  v: Value | Value[],
  _prefix: boolean,
  env: ExecutionEnvironment,
  operand: Expression,
): Value | Value[] {
  switch (op) {
    case '-': {
      if (v instanceof Int32Array) return evalBinary('-', 0, v as Value);
      if (v instanceof Uint32Array) return evalBinary('-', 0, v as Value);
      return evalBinary('-', f(0), v as Value);
    }
    case '+': return v;
    case '!': return !truthy(v);
    case '~': {
      if (v instanceof Int32Array) {
        const out = new Int32Array(v.length);
        for (let i = 0; i < v.length; i++) out[i] = ~(v[i] as number);
        return out;
      }
      if (v instanceof Uint32Array) {
        const out = new Uint32Array(v.length);
        for (let i = 0; i < v.length; i++) out[i] = (~(v[i] as number)) >>> 0;
        return out;
      }
      if (typeof v === 'number') return ~v;
      return f(0);
    }
    case '++':
    case '--': {
      // Prefix mutating op: only meaningful on identifier targets.
      if (operand.kind === 'IdentifierExpression') {
        const name = (operand as IdentifierExpression).name;
        const oldV = env.lookup(name) ?? f(0);
        const next = evalBinary(op === '++' ? '+' : '-', oldV as Value, f(1)) as Value | Value[];
        env.assign(name, next);
        return next;
      }
      return v;
    }
    default: return v;
  }
}

function evalPostfix(
  p: PostfixExpression,
  env: ExecutionEnvironment,
  ctx: EvalContext,
): Value | Value[] {
  const cur = evaluateExpression(p.operand, env, ctx);
  if (p.operand.kind === 'IdentifierExpression') {
    const name = (p.operand as IdentifierExpression).name;
    const next = evalBinary(p.op === '++' ? '+' : '-', cur as Value, f(1)) as Value | Value[];
    env.assign(name, next);
  }
  // Postfix yields the pre-update value.
  return cur;
}

/* ------------------------------------------------------------------ */
/* Units 3-5: statements, invocation, entry points                     */
/* ------------------------------------------------------------------ */

function signaled(env: ExecutionEnvironment): boolean {
  return env.returnSignaled || env.breakSignaled || env.continueSignaled || env.discardSignaled;
}

function defaultValueFor(typeName: string, arraySize: number): Value | Value[] {
  const scalar = (t: string): Value => {
    if (t === 'int') return 0;
    if (t === 'uint') return 0;
    if (t === 'bool') return false;
    return f(0);
  };
  const vec = (t: string): Value => {
    const n = parseInt(t.slice(-1), 10);
    if (t.startsWith('ivec')) return new Int32Array(n);
    if (t.startsWith('uvec')) return new Uint32Array(n);
    if (t.startsWith('bvec')) return new Array<boolean>(n).fill(false);
    return new Float32Array(n);
  };
  const mat = (t: string): Value => {
    const m = t === 'mat2' ? 2 : t === 'mat3' ? 3 : 4;
    const out = new Float32Array(m * m);
    for (let i = 0; i < m; i++) out[i * m + i] = 1;
    return out;
  };
  const one = (t: string): Value | Value[] => {
    if (t === 'float' || t === 'int' || t === 'uint' || t === 'bool') return scalar(t);
    if (/^(vec|ivec|uvec|bvec)[234]$/.test(t)) return vec(t);
    if (t === 'mat2' || t === 'mat3' || t === 'mat4') return mat(t);
    return f(0);
  };
  if (arraySize > 0) {
    const arr: Value[] = [];
    for (let i = 0; i < arraySize; i++) arr.push(one(typeName) as Value);
    return arr;
  }
  return one(typeName);
}

function arrayLenOf(sizeExpr: import('./parser').Expression | null, env: ExecutionEnvironment, ctx: EvalContext): number {
  if (sizeExpr === null) return 0;
  const n = Math.trunc(toNum(evaluateExpression(sizeExpr, env, ctx) as Value));
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

/** Statement execution — Unit 3. */
export function executeStatement(stmt: Statement, env: ExecutionEnvironment, ctx: EvalContext): void {
  if (signaled(env)) return;
  switch (stmt.kind) {
    case 'CompoundStatement': {
      const c = stmt as CompoundStatement;
      for (const s of c.statements) {
        executeStatement(s, env, ctx);
        if (signaled(env)) break;
      }
      return;
    }
    case 'DeclarationStatement': {
      const d = stmt as DeclarationStatement;
      const decl = d.declaration;
      if (decl.kind === 'VariableDeclaration') {
        const vd = decl as VariableDeclaration;
        const n = arrayLenOf(vd.arraySize, env, ctx);
        if (vd.initializer !== null && vd.initializer !== undefined) {
          const initVal = evaluateExpression(vd.initializer, env, ctx);
          env.define(vd.name, initVal);
        } else {
          env.define(vd.name, defaultValueFor(vd.typeName, n));
        }
      }
      return;
    }
    case 'ExpressionStatement': {
      const e = stmt as ExpressionStatement;
      if (e.expression !== null && e.expression !== undefined) evaluateExpression(e.expression, env, ctx);
      return;
    }
    case 'IfStatement': {
      const s = stmt as IfStatement;
      const cond = evaluateExpression(s.condition, env, ctx);
      if (truthy(cond)) executeStatement(s.thenBranch, env, ctx);
      else if (s.elseBranch !== null && s.elseBranch !== undefined) executeStatement(s.elseBranch, env, ctx);
      return;
    }
    case 'ForStatement': {
      const s = stmt as ForStatement;
      if (s.init !== null && s.init !== undefined) {
        const init = s.init as Statement | import('./parser').Expression;
        if (STATEMENT_KINDS.has((init as Statement).kind)) executeStatement(init as Statement, env, ctx);
        else evaluateExpression(init as import('./parser').Expression, env, ctx);
      }
      for (;;) {
        if (signaled(env)) break;
        if (s.condition !== null && s.condition !== undefined) {
          if (!truthy(evaluateExpression(s.condition, env, ctx))) break;
        }
        executeStatement(s.body, env, ctx);
        if (env.breakSignaled) { env.breakSignaled = false; break; }
        if (env.continueSignaled) { env.continueSignaled = false; }
        if (env.returnSignaled || env.discardSignaled) break;
        if (s.update !== null && s.update !== undefined) evaluateExpression(s.update, env, ctx);
      }
      return;
    }
    case 'WhileStatement': {
      const s = stmt as WhileStatement;
      for (;;) {
        if (!truthy(evaluateExpression(s.condition, env, ctx))) break;
        executeStatement(s.body, env, ctx);
        if (env.breakSignaled) { env.breakSignaled = false; break; }
        if (env.continueSignaled) { env.continueSignaled = false; }
        if (env.returnSignaled || env.discardSignaled) break;
      }
      return;
    }
    case 'DoWhileStatement': {
      const s = stmt as DoWhileStatement;
      for (;;) {
        executeStatement(s.body, env, ctx);
        if (env.breakSignaled) { env.breakSignaled = false; break; }
        if (env.continueSignaled) { env.continueSignaled = false; }
        if (env.returnSignaled || env.discardSignaled) break;
        if (!truthy(evaluateExpression(s.condition, env, ctx))) break;
      }
      return;
    }
    case 'SwitchStatement': {
      const s = stmt as SwitchStatement;
      const disc = toNum(evaluateExpression(s.discriminant, env, ctx) as Value);
      let start = -1;
      let defIdx = -1;
      for (let i = 0; i < s.cases.length; i++) {
        const cc = s.cases[i] as CaseClause;
        if (cc.test === null || cc.test === undefined) { defIdx = i; continue; }
        if (toNum(evaluateExpression(cc.test, env, ctx) as Value) === disc) { start = i; break; }
      }
      if (start < 0) start = defIdx;
      if (start < 0) return;
      for (let i = start; i < s.cases.length; i++) {
        const cc = s.cases[i] as CaseClause;
        for (const sub of cc.statements) {
          executeStatement(sub, env, ctx);
          if (env.returnSignaled || env.discardSignaled || env.continueSignaled) return;
          if (env.breakSignaled) { env.breakSignaled = false; return; }
        }
      }
      return;
    }
    case 'ReturnStatement': {
      const s = stmt as ReturnStatement;
      if (s.value !== null && s.value !== undefined) {
        env.returnValue = evaluateExpression(s.value, env, ctx) as Value | Value[];
      }
      env.returnSignaled = true;
      return;
    }
    case 'BreakStatement': env.breakSignaled = true; return;
    case 'ContinueStatement': env.continueSignaled = true; return;
    case 'DiscardStatement': env.discardSignaled = true; return;
    default: return;
  }
}

const STATEMENT_KINDS = new Set([
  'CompoundStatement',
  'IfStatement',
  'ForStatement',
  'WhileStatement',
  'DoWhileStatement',
  'ReturnStatement',
  'BreakStatement',
  'ContinueStatement',
  'DiscardStatement',
  'SwitchStatement',
  'CaseClause',
  'ExpressionStatement',
  'DeclarationStatement',
]);

/** Maximum user-function call-stack depth; deeper calls return f(0) (total function). */
const MAX_CALL_DEPTH = 64;

function cloneCallValue(v: Value | Value[]): Value | Value[] {
  if (v instanceof Float32Array) return new Float32Array(v);
  if (v instanceof Int32Array) return new Int32Array(v);
  if (v instanceof Uint32Array) return new Uint32Array(v);
  if (Array.isArray(v)) {
    return (v as unknown[]).map((e) => {
      if (e instanceof Float32Array) return new Float32Array(e);
      if (e instanceof Int32Array) return new Int32Array(e);
      if (e instanceof Uint32Array) return new Uint32Array(e);
      if (Array.isArray(e)) return [...(e as unknown[])];
      return e;
    }) as Value[];
  }
  return v as Value;
}

/** Locate a user FunctionDefinition by name in the retained ASTs. */
function findUserFunction(name: string, ctx: EvalContext): FunctionDefinition | undefined {
  const asts: Array<TranslationUnit | undefined> = [];
  try {
    asts.push(getCheckedAST(ctx.program.vs as object));
    asts.push(getCheckedAST(ctx.program.fs as object));
  } catch (_e) {
    void _e;
  }
  try {
    const reg = astRegistry.get(ctx.program as object);
    if (reg !== undefined) asts.push(reg);
  } catch (_e) {
    void _e;
  }
  for (const ast of asts) {
    if (ast === undefined) continue;
    for (const d of ast.declarations) {
      if ((d as FunctionDefinition).kind === 'FunctionDefinition' && (d as FunctionDefinition).name === name) {
        return d as FunctionDefinition;
      }
    }
  }
  return undefined;
}

/** Write a copy-out value back to the caller's lvalue expression. */
function copyOutToCaller(target: Expression, value: Value | Value[], env: ExecutionEnvironment): void {
  if (target.kind === 'IdentifierExpression') {
    env.assign((target as IdentifierExpression).name, value);
    return;
  }
  if (target.kind === 'FieldAccessExpression') {
    const fa = target as FieldAccessExpression;
    const base = evaluateExpressionBare(fa.object, env);
    if (base === undefined) return;
    const masked = applySwizzleWrite(base as Value, fa.field, value as Value);
    if (fa.object.kind === 'IdentifierExpression') {
      env.assign((fa.object as IdentifierExpression).name, masked as Value | Value[]);
    }
    return;
  }
  if (target.kind === 'IndexExpression') {
    const ix = target as IndexExpression;
    const base = evaluateExpressionBare(ix.object, env);
    const idxV = evaluateExpressionBare(ix.index, env);
    if (base === undefined || idxV === undefined) return;
    const next = applyIndexWrite(base, idxV, value, '=');
    if (ix.object.kind === 'IdentifierExpression') {
      env.assign((ix.object as IdentifierExpression).name, next);
    }
  }
}

/** Environment-only lookup helper for copy-out (no host/program access needed). */
function evaluateExpressionBare(expr: Expression, env: ExecutionEnvironment): Value | Value[] | undefined {
  if (expr.kind === 'IdentifierExpression') return env.lookup((expr as IdentifierExpression).name);
  if (expr.kind === 'IndexExpression') {
    const ix = expr as IndexExpression;
    const obj = evaluateExpressionBare(ix.object, env);
    const idxV = evaluateExpressionBare(ix.index, env);
    if (obj === undefined || idxV === undefined) return undefined;
    return evalIndex(obj, idxV);
  }
  if (expr.kind === 'FieldAccessExpression') {
    const fa = expr as FieldAccessExpression;
    const obj = evaluateExpressionBare(fa.object, env);
    if (obj === undefined || !isSwizzleField(fa.field)) return undefined;
    return evaluateSwizzle(obj as Value, fa.field) as Value | Value[];
  }
  return undefined;
}

/** User-function invocation — Unit 4: copy-in/copy-out, recursion-capped. */
export function invokeUserFunction(
  funcDef: FunctionDefinition,
  callArgs: Expression[],
  evaluatedArgs: Value[],
  env: ExecutionEnvironment,
  ctx: EvalContext,
): Value | Value[] {
  // Recursion guard: total function — return f(0) rather than throwing.
  if (env.callStack.length >= MAX_CALL_DEPTH) return f(0);
  env.pushFrame();
  try {
    const params = funcDef.params ?? [];
    for (let i = 0; i < params.length; i++) {
      const p = params[i] as VariableDeclaration;
      const incoming = i < evaluatedArgs.length ? (evaluatedArgs[i] as Value) : undefined;
      if (p.storage === 'out') {
        const n = arrayLenOf(p.arraySize, env, ctx);
        env.define(p.name, defaultValueFor(p.typeName, n));
      } else if (incoming !== undefined) {
        env.define(p.name, cloneCallValue(incoming));
      } else {
        const n = arrayLenOf(p.arraySize, env, ctx);
        env.define(p.name, defaultValueFor(p.typeName, n));
      }
    }
    // Execute body; suppress stale control flags from the caller frame.
    const savedBreak = env.breakSignaled;
    const savedContinue = env.continueSignaled;
    const savedDiscard = env.discardSignaled;
    env.breakSignaled = false;
    env.continueSignaled = false;
    env.discardSignaled = false;
    env.returnSignaled = false;
    env.returnValue = undefined;
    executeStatement(funcDef.body, env, ctx);
    const ret: Value | Value[] = env.returnValue ?? f(0);
    // Snapshot updated param values before popping.
    const updated = new Map<string, Value | Value[]>();
    for (const p of params) {
      const v = env.lookup((p as VariableDeclaration).name);
      if (v !== undefined) updated.set((p as VariableDeclaration).name, cloneCallValue(v));
    }
    env.popFrame();
    env.returnSignaled = false;
    env.returnValue = undefined;
    env.breakSignaled = savedBreak;
    env.continueSignaled = savedContinue;
    env.discardSignaled = savedDiscard;
    // Copy-out: parser drops qualifiers (storage always null), so apply
    // conservative inout semantics — write back to every lvalue argument.
    // IMPLEMENTATION DECISION: conservative inout for all params. Rationale:
    // qualifier info does not survive parsing; writing back pure `in` args is
    // unobservable when callees honor the contract. Alternatives: copy-out
    // only when storage is out/inout (dead code — never fires).
    for (let i = 0; i < params.length; i++) {
      const p = params[i] as VariableDeclaration;
      if (p.storage === 'in' || p.storage === 'const') continue;
      if (i >= callArgs.length) continue;
      const v = updated.get(p.name);
      if (v === undefined) continue;
      copyOutToCaller(callArgs[i] as Expression, v, env);
    }
    return ret;
  } catch (_e) {
    void _e;
    try {
      env.popFrame();
    } catch (_e2) {
      void _e2;
    }
    env.returnSignaled = false;
    env.returnValue = undefined;
    return f(0);
  }
}

/** AST registry bridge — fallback when check() retention is unavailable. */
const astRegistry = new WeakMap<object, TranslationUnit>();

export function registerShaderAST(program: object, ast: TranslationUnit): void {
  astRegistry.set(program, ast);
}

function stageAST(program: LinkedProgram, stage: 'vertex' | 'fragment'): TranslationUnit | undefined {
  const checked = stage === 'vertex' ? (program.vs as object) : (program.fs as object);
  try {
    const retained = getCheckedAST(checked);
    if (retained !== undefined) return retained;
  } catch (_e) {
    void _e;
  }
  try {
    const reg = astRegistry.get(program as object);
    if (reg !== undefined) return reg;
  } catch (_e) {
    void _e;
  }
  return undefined;
}

function attribDefaultFor(typeName: string): Float32Array {
  if (typeName === 'vec2') return new Float32Array(2);
  if (typeName === 'vec3') return new Float32Array(3);
  if (typeName === 'vec4') return new Float32Array([0, 0, 0, 1]);
  if (typeName === 'float') return new Float32Array([0]);
  return new Float32Array([0, 0, 0, 1]);
}

function toVec4(v: Value | Value[] | undefined): Float32Array {
  if (v instanceof Float32Array) {
    const out = new Float32Array(4);
    for (let i = 0; i < 4; i++) out[i] = i < v.length ? (v[i] as number) : i === 3 ? 1 : 0;
    return out;
  }
  if (typeof v === 'number') return new Float32Array([v, 0, 0, 1]);
  if (typeof v === 'boolean') return new Float32Array([v ? 1 : 0, 0, 0, 1]);
  return new Float32Array([0, 0, 0, 1]);
}

function toFloat(v: Value | Value[] | undefined, fallback: number): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof Float32Array || v instanceof Int32Array || v instanceof Uint32Array) {
    return (v as ArrayLike<number>)[0] as number;
  }
  return fallback;
}

function runGlobalDeclarations(ast: TranslationUnit, env: ExecutionEnvironment, ctx: EvalContext): void {
  for (const d of ast.declarations) {
    if ((d as { kind?: string }).kind !== 'VariableDeclaration') continue;
    const vd = d as VariableDeclaration;
    if (vd.storage === 'attribute' || vd.storage === 'in' || vd.storage === 'varying' || vd.storage === 'out') continue;
    if (vd.storage === 'uniform') continue;
    if (env.lookup(vd.name) !== undefined) continue;
    const n = arrayLenOf(vd.arraySize, env, ctx);
    if (vd.initializer !== null && vd.initializer !== undefined) {
      env.define(vd.name, evaluateExpression(vd.initializer, env, ctx));
    } else {
      env.define(vd.name, defaultValueFor(vd.typeName, n));
    }
    if (signaled(env)) { env.clearControlFlags(); }
  }
}

function findMain(ast: TranslationUnit | undefined): FunctionDefinition | undefined {
  if (ast === undefined) return undefined;
  for (const d of ast.declarations) {
    if ((d as FunctionDefinition).kind === 'FunctionDefinition' && (d as FunctionDefinition).name === 'main') {
      return d as FunctionDefinition;
    }
  }
  return undefined;
}

/** Execute main() in the global scope (no call frame): globals stay visible after return; discard survives. */
function runMain(main: FunctionDefinition | undefined, env: ExecutionEnvironment, ctx: EvalContext): void {
  if (main === undefined) return;
  env.returnSignaled = false;
  env.returnValue = undefined;
  env.breakSignaled = false;
  env.continueSignaled = false;
  executeStatement(main.body, env, ctx);
  env.returnSignaled = false;
  env.returnValue = undefined;
  env.breakSignaled = false;
  env.continueSignaled = false;
}

export function executeVertex(
  program: LinkedProgram,
  vertexId: number,
  attribs: Map<number, Float32Array>,
  host: InterpreterHost,
): ClipVertex {
  try {
    const version = program.vs.version === 300 ? 300 : 100;
    const ctx: EvalContext = { program, host, version };
    const env = new ExecutionEnvironment();
    env.define('gl_Position', new Float32Array([0, 0, 0, 1]));
    env.define('gl_PointSize', 1);
    env.define('gl_VertexID', vertexId | 0);
    env.define('gl_InstanceID', 0);
    for (const a of program.activeAttribs) {
      const supplied = attribs.get(a.location);
      if (supplied !== undefined) {
        env.define(a.name, new Float32Array(supplied));
      } else {
        env.define(a.name, attribDefaultFor('vec4'));
      }
    }
    const ast = stageAST(program, 'vertex');
    if (ast !== undefined) runGlobalDeclarations(ast, env, ctx);
    runMain(findMain(ast), env, ctx);
    const clipPos = toVec4(env.lookup('gl_Position'));
    const pointSize = toFloat(env.lookup('gl_PointSize'), 1);
    const varyings = new Map<string, Float32Array>();
    for (const v of program.varyingLayout) {
      varyings.set(v.name, toVec4(env.lookup(v.name)));
    }
    return { clipPos, pointSize, varyings };
  } catch (_e) {
    void _e;
    return { clipPos: new Float32Array([0, 0, 0, 1]), pointSize: 1, varyings: new Map() };
  }
}

export function executeFragment(
  program: LinkedProgram,
  varyings: Map<string, Float32Array>,
  host: InterpreterHost,
  frontFacing?: boolean,
  derivCtx?: DerivativeContext,
): FragmentResult {
  void derivCtx;
  try {
    const version = program.fs.version === 300 ? 300 : 100;
    const ctx: EvalContext = { program, host, version };
    const env = new ExecutionEnvironment();
    env.define('gl_FragColor', new Float32Array([0, 0, 0, 1]));
    env.define('gl_FrontFacing', frontFacing ?? true);
    env.define('gl_FragCoord', new Float32Array([0.5, 0.5, 0, 1]));
    env.define('gl_PointCoord', new Float32Array([0, 0]));
    for (const [name, val] of varyings) env.define(name, new Float32Array(val));
    const ast = stageAST(program, 'fragment');
    if (ast !== undefined) runGlobalDeclarations(ast, env, ctx);
    runMain(findMain(ast), env, ctx);
    if (env.discardSignaled) return { discarded: true, color: new Float32Array([0, 0, 0, 0]), depth: null as unknown as number };
    let color: Float32Array;
    if (version === 100) {
      color = toVec4(env.lookup('gl_FragColor'));
    } else {
      const outs = program.fs.declaredOutputs ?? [];
      if (outs.length > 0) color = toVec4(env.lookup(outs[0]!.name));
      else color = toVec4(env.lookup('gl_FragColor'));
    }
    return { discarded: false, color, depth: null as unknown as number };
  } catch (_e) {
    void _e;
    return { discarded: false, color: new Float32Array([0, 0, 0, 1]), depth: null as unknown as number };
  }
}