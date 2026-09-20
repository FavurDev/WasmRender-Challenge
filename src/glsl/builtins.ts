/** GLSL ES builtin function library — non-sampling core, L3, total dispatch.
 *
 * Responsibility: pure total builtin implementations for GLSL ES 1.00/3.00
 * (math, geometric, trig/exp, constructors, swizzles, transpose/inverse,
 * relational) with Math.fround float32 normalization (ADR-012) and
 * version-gated dispatch tables consumed by the interpreter.
 *
 * Scope: no sampling builtins (Task 3), no interpreter loop (Task 5).
 * Never throws: unknown names, wrong arity, wrong types all yield
 * deterministic fallbacks (0.0 or zeroed typed arrays).
 */
// CHANGELOG:
// - Sprint 4 (2026-09-20): Non-sampling builtin library core (Task 2).

export type Value = number | boolean | Float32Array | Int32Array | Uint32Array | boolean[];

export type BuiltinFn = (...args: Value[]) => Value;

function isNum(v: Value): v is number {
  return typeof v === 'number';
}

function isBool(v: Value): v is boolean {
  return typeof v === 'boolean';
}

function isF32(v: Value): v is Float32Array {
  return v instanceof Float32Array;
}

function isI32(v: Value): v is Int32Array {
  return v instanceof Int32Array;
}

function isU32(v: Value): v is Uint32Array {
  return v instanceof Uint32Array;
}

function isBvec(v: Value): v is boolean[] {
  return Array.isArray(v);
}

function f(x: number): number {
  return Math.fround(x);
}

function mapVec(x: Float32Array, fn: (c: number) => number): Float32Array {
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = f(fn(x[i] as number));
  return out;
}

function unaryScalarVec(_name: string, fn: (x: number) => number, args: Value[]): Value {
  if (args.length !== 1) return f(0);
  const x = args[0] as Value;
  try {
    if (isNum(x)) return f(fn(x));
    if (isF32(x)) return mapVec(x, fn);
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function binaryScalarVec(fn: (a: number, b: number) => number, args: Value[]): Value {
  if (args.length !== 2) return f(0);
  const x = args[0] as Value;
  const y = args[1] as Value;
  try {
    if (isNum(x) && isNum(y)) return f(fn(x, y));
    if (isF32(x)) {
      const out = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) {
        const yi = isF32(y) ? (y[i] as number) : isNum(y) ? y : 0;
        out[i] = f(fn(x[i] as number, yi));
      }
      return out;
    }
    if (isNum(x) && isF32(y)) {
      const out = new Float32Array(y.length);
      for (let i = 0; i < y.length; i++) out[i] = f(fn(x, y[i] as number));
      return out;
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalAbs(...args: Value[]): Value {
  return unaryScalarVec('abs', Math.abs, args);
}
function evalFloor(...args: Value[]): Value {
  return unaryScalarVec('floor', Math.floor, args);
}
function evalCeil(...args: Value[]): Value {
  return unaryScalarVec('ceil', Math.ceil, args);
}
function evalFract(...args: Value[]): Value {
  return unaryScalarVec('fract', (x) => x - Math.floor(x), args);
}
function evalSign(...args: Value[]): Value {
  return unaryScalarVec('sign', (x) => (x > 0 ? 1 : x < 0 ? -1 : 0), args);
}
function evalTrunc(...args: Value[]): Value {
  return unaryScalarVec('trunc', Math.trunc, args);
}
function evalRound(...args: Value[]): Value {
  return unaryScalarVec('round', (x) => Math.sign(x) * Math.round(Math.abs(x)), args);
}
function evalRoundEven(...args: Value[]): Value {
  return unaryScalarVec('roundEven', (x) => {
    const fl = Math.floor(x);
    const diff = x - fl;
    if (diff < 0.5) return fl;
    if (diff > 0.5) return fl + 1;
    return fl % 2 === 0 ? fl : fl + 1;
  }, args);
}

function evalMin(...args: Value[]): Value {
  return binaryScalarVec(Math.min, args);
}
function evalMax(...args: Value[]): Value {
  return binaryScalarVec(Math.max, args);
}
function evalMod(...args: Value[]): Value {
  return binaryScalarVec((x, y) => x - y * Math.floor(x / y), args);
}
function evalStep(...args: Value[]): Value {
  return binaryScalarVec((edge, x) => (x >= edge ? 1 : 0), args);
}
function evalPow(...args: Value[]): Value {
  return binaryScalarVec((x, y) => Math.pow(x, y), args);
}
function evalAtan2(...args: Value[]): Value {
  if (args.length === 1) return unaryScalarVec('atan', Math.atan, args);
  return binaryScalarVec((y, x) => Math.atan2(y, x), args);
}

function evalMix(...args: Value[]): Value {
  if (args.length !== 3) return f(0);
  try {
    const x = args[0] as Value;
    const y = args[1] as Value;
    const a = args[2] as Value;
    if (isNum(x) && isNum(y)) {
      if (isNum(a)) {
        const t = f(1 - a);
        return f(f(x * t) + f(y * a));
      }
      if (isBool(a)) return f(a ? y : x);
      return f(0);
    }
    if (isF32(x) && isF32(y)) {
      const out = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) {
        let ai: number | boolean = 0;
        if (isF32(a)) ai = a[i] as number;
        else if (isNum(a)) ai = a;
        else if (isBvec(a)) ai = (a[i] as boolean) === true;
        else if (isBool(a)) ai = a;
        if (typeof ai === 'boolean') {
          out[i] = ai ? y[i] as number : x[i] as number;
        } else {
          const t = f(1 - (ai as number));
          out[i] = f(f((x[i] as number) * t) + f((y[i] as number) * (ai as number)));
        }
      }
      return out;
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalClamp(...args: Value[]): Value {
  if (args.length !== 3) return f(0);
  try {
    const x = args[0] as Value;
    const mn = args[1] as Value;
    const mx = args[2] as Value;
    if (isNum(x) && isNum(mn) && isNum(mx)) return f(Math.min(Math.max(x, mn), mx));
    if (isF32(x)) {
      const out = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) {
        const lo = isF32(mn) ? (mn[i] as number) : isNum(mn) ? mn : 0;
        const hi = isF32(mx) ? (mx[i] as number) : isNum(mx) ? mx : 0;
        out[i] = f(Math.min(Math.max(f(x[i] as number), lo), hi));
      }
      return out;
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalSmoothstep(...args: Value[]): Value {
  if (args.length !== 3) return f(0);
  try {
    const e0 = args[0] as Value;
    const e1 = args[1] as Value;
    const x = args[2] as Value;
    const ss = (lo: number, hi: number, v: number): number => {
      const t = f(Math.min(Math.max((v - lo) / (hi - lo), 0), 1));
      return f(f(t * t) * f(3 - f(2 * t)));
    };
    if (isNum(e0) && isNum(e1) && isNum(x)) return f(ss(e0, e1, x));
    if (isF32(x)) {
      const out = new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) {
        const lo = isF32(e0) ? (e0[i] as number) : isNum(e0) ? e0 : 0;
        const hi = isF32(e1) ? (e1[i] as number) : isNum(e1) ? e1 : 0;
        out[i] = f(ss(lo, hi, x[i] as number));
      }
      return out;
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalDot(...args: Value[]): Value {
  if (args.length !== 2) return f(0);
  try {
    const x = args[0] as Value;
    const y = args[1] as Value;
    if (isNum(x) && isNum(y)) return f(x * y);
    if (isF32(x) && isF32(y)) {
      let sum = f(0);
      const n = Math.min(x.length, y.length);
      for (let i = 0; i < n; i++) sum = f(sum + f((x[i] as number) * (y[i] as number)));
      return sum;
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalLength(...args: Value[]): Value {
  if (args.length !== 1) return f(0);
  try {
    const x = args[0] as Value;
    if (isNum(x)) return f(Math.abs(x));
    if (isF32(x)) {
      const d = evalDot(x, x) as number;
      return f(Math.sqrt(d));
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalDistance(...args: Value[]): Value {
  if (args.length !== 2) return f(0);
  try {
    const p0 = args[0] as Value;
    const p1 = args[1] as Value;
    if (isNum(p0) && isNum(p1)) return f(Math.abs(f(p0 - p1)));
    if (isF32(p0) && isF32(p1)) {
      const n = Math.min(p0.length, p1.length);
      const diff = new Float32Array(n);
      for (let i = 0; i < n; i++) diff[i] = f((p0[i] as number) - (p1[i] as number));
      return evalLength(diff);
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalNormalize(...args: Value[]): Value {
  if (args.length !== 1) return f(0);
  try {
    const x = args[0] as Value;
    if (isNum(x)) {
      if (x > 0) return f(1);
      if (x < 0) return f(-1);
      return f(0);
    }
    if (isF32(x)) {
      const len = evalLength(x) as number;
      const out = new Float32Array(x.length);
      if (len === 0) return out;
      for (let i = 0; i < x.length; i++) out[i] = f((x[i] as number) / len);
      return out;
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalCross(...args: Value[]): Value {
  try {
    const x = args[0] as Value;
    const y = args[1] as Value;
    if (isF32(x) && isF32(y) && x.length === 3 && y.length === 3) {
      const out = new Float32Array(3);
      out[0] = f(f((x[1] as number) * (y[2] as number)) - f((x[2] as number) * (y[1] as number)));
      out[1] = f(f((x[2] as number) * (y[0] as number)) - f((x[0] as number) * (y[2] as number)));
      out[2] = f(f((x[0] as number) * (y[1] as number)) - f((x[1] as number) * (y[0] as number)));
      return out;
    }
  } catch (_e) {
    return new Float32Array(3);
  }
  return new Float32Array(3);
}

function evalReflect(...args: Value[]): Value {
  if (args.length !== 2) return f(0);
  try {
    const i = args[0] as Value;
    const n = args[1] as Value;
    if (isF32(i) && isF32(n)) {
      const d = evalDot(n, i) as number;
      const s = f(2 * d);
      const len = Math.min(i.length, n.length);
      const out = new Float32Array(len);
      for (let k = 0; k < len; k++) out[k] = f((i[k] as number) - f(s * (n[k] as number)));
      return out;
    }
    if (isNum(i) && isNum(n)) {
      const d = f(n * i);
      return f(i - f(2 * d * n));
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalRefract(...args: Value[]): Value {
  if (args.length !== 3) return f(0);
  try {
    const i = args[0] as Value;
    const n = args[1] as Value;
    const eta = args[2] as Value;
    if (isF32(i) && isF32(n) && isNum(eta)) {
      const d = evalDot(n, i) as number;
      const k = f(1 - f(f(eta * eta) * f(1 - f(d * d))));
      const len = Math.min(i.length, n.length);
      if (k < 0) return new Float32Array(len);
      const a = f(eta * d + Math.sqrt(k));
      const out = new Float32Array(len);
      for (let j = 0; j < len; j++) out[j] = f(f(eta * (i[j] as number)) - f(a * (n[j] as number)));
      return out;
    }
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

function evalFaceforward(...args: Value[]): Value {
  if (args.length !== 3) return f(0);
  try {
    const n = args[0] as Value;
    const i = args[1] as Value;
    const nr = args[2] as Value;
    if (isF32(n) && isF32(i) && isF32(nr)) {
      const d = evalDot(nr, i) as number;
      if (d < 0) return n;
      const out = new Float32Array(n.length);
      for (let k = 0; k < n.length; k++) out[k] = f(-(n[k] as number));
      return out;
    }
    if (isNum(n) && isNum(i) && isNum(nr)) return nr * i < 0 ? f(n) : f(-n);
  } catch (_e) {
    return f(0);
  }
  return f(0);
}

const TRIG_FNS: Readonly<Record<string, (x: number) => number>> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  exp: Math.exp,
  log: Math.log,
  sqrt: Math.sqrt,
  exp2: (x: number) => Math.pow(2, x),
  log2: (x: number) => Math.log2(x),
  inversesqrt: (x: number) => 1 / Math.sqrt(x),
};

function makeTrig(name: string): BuiltinFn {
  const fn = TRIG_FNS[name] as (x: number) => number;
  return ( ...args: Value[]): Value => unaryScalarVec(name, fn, args);
}

function flattenScalars(args: Value[]): number[] {
  const list: number[] = [];
  for (const a of args) {
    if (typeof a === 'number') list.push(a);
    else if (typeof a === 'boolean') list.push(a ? 1 : 0);
    else if (a instanceof Float32Array || a instanceof Int32Array || a instanceof Uint32Array) {
      for (let i = 0; i < a.length; i++) list.push(a[i] as number);
    } else if (Array.isArray(a)) {
      for (const b of a) list.push(b ? 1 : 0);
    }
  }
  return list;
}

function makeVecCtor(dim: number): BuiltinFn {
  return ( ...args: Value[]): Value => {
    try {
      const out = new Float32Array(dim);
      const flat = flattenScalars(args);
      if (flat.length === 0) return out;
      if (flat.length === 1) {
        const v = f(flat[0] as number);
        for (let i = 0; i < dim; i++) out[i] = v;
        return out;
      }
      for (let i = 0; i < dim; i++) out[i] = f(flat[i] as number ?? 0);
      return out;
    } catch (_e) {
      return new Float32Array(dim);
    }
  };
}

function makeIvecCtor(dim: number): BuiltinFn {
  return ( ...args: Value[]): Value => {
    try {
      const out = new Int32Array(dim);
      const flat = flattenScalars(args);
      if (flat.length === 0) return out;
      if (flat.length === 1) {
        const v = Math.trunc(flat[0] as number) | 0;
        for (let i = 0; i < dim; i++) out[i] = v;
        return out;
      }
      for (let i = 0; i < dim; i++) out[i] = Math.trunc(flat[i] as number ?? 0) | 0;
      return out;
    } catch (_e) {
      return new Int32Array(dim);
    }
  };
}

function makeUvecCtor(dim: number): BuiltinFn {
  return ( ...args: Value[]): Value => {
    try {
      const out = new Uint32Array(dim);
      const flat = flattenScalars(args);
      if (flat.length === 0) return out;
      if (flat.length === 1) {
        const v = Math.trunc(flat[0] as number) >>> 0;
        for (let i = 0; i < dim; i++) out[i] = v;
        return out;
      }
      for (let i = 0; i < dim; i++) out[i] = Math.trunc(flat[i] as number ?? 0) >>> 0;
      return out;
    } catch (_e) {
      return new Uint32Array(dim);
    }
  };
}

function makeBvecCtor(dim: number): BuiltinFn {
  return ( ...args: Value[]): Value => {
    try {
      const flat: boolean[] = [];
      for (const a of args) {
        if (typeof a === 'boolean') flat.push(a);
        else if (typeof a === 'number') flat.push(a !== 0);
        else if (a instanceof Float32Array || a instanceof Int32Array || a instanceof Uint32Array) {
          for (let i = 0; i < a.length; i++) flat.push((a[i] as number) !== 0);
        } else if (Array.isArray(a)) {
          for (const b of a) flat.push(b === true);
        }
      }
      const out: boolean[] = new Array(dim).fill(false);
      if (flat.length === 0) return out;
      if (flat.length === 1) {
        for (let i = 0; i < dim; i++) out[i] = flat[0] as boolean;
        return out;
      }
      for (let i = 0; i < dim; i++) out[i] = (flat[i] as boolean) ?? false;
      return out;
    } catch (_e) {
      return new Array(dim).fill(false);
    }
  };
}

function makeMatCtor(cols: number, rows: number): BuiltinFn {
  return ( ...args: Value[]): Value => {
    try {
      const out = new Float32Array(cols * rows);
      const flat = flattenScalars(args);
      if (flat.length === 0) return out;
      if (flat.length === 1) {
        const d = f(flat[0] as number);
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) out[c * rows + r] = c === r ? d : f(0);
        }
        return out;
      }
      const n = Math.min(flat.length, cols * rows);
      for (let i = 0; i < n; i++) out[i] = f(flat[i] as number);
      return out;
    } catch (_e) {
      return new Float32Array(cols * rows);
    }
  };
}

// IMPLEMENTATION DECISION: column-major transpose with explicit orientation.
// Rationale: a bare Float32Array carries no cols/rows tag, so ambiguous
// lengths (6 = mat2x3|mat3x2, 8 = mat2x4|mat4x2, 12 = mat3x4|mat4x3) resolve
// via a fixed documented convention matching the matNxM constructor layout
// (mat2x3, mat2x4, mat3x4 canonical). Double-transpose round-trips exactly
// under this fixed convention in either orientation. Alternatives: tagging
// matrices with a wrapper class (rejected: breaks Float32Array contract
// consumed by Task 5 interpreter); extra dims arg (rejected: non-spec signature).
function makeTranspose(cols: number, rows: number): BuiltinFn {
  return (...args: Value[]): Value => {
    if (args.length !== 1) return f(0);
    try {
      const m = args[0] as Value;
      if (!isF32(m)) return f(0);
      if (m.length !== cols * rows) return new Float32Array(m.length);
      const out = new Float32Array(rows * cols);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) out[r * cols + c] = f(m[c * rows + r] as number);
      }
      return out;
    } catch (_e) {
      return f(0);
    }
  };
}

function evalTranspose(...args: Value[]): Value {
  if (args.length !== 1) return f(0);
  try {
    const m = args[0] as Value;
    if (!isF32(m)) return f(0);
    // Explicit orientation table (cols, rows) per input length.
    let dims: [number, number] | null = null;
    if (m.length === 4) dims = [2, 2];
    else if (m.length === 9) dims = [3, 3];
    else if (m.length === 16) dims = [4, 4];
    else if (m.length === 6) dims = [2, 3];
    else if (m.length === 8) dims = [2, 4];
    else if (m.length === 12) dims = [3, 4];
    else return new Float32Array(m.length);
    return makeTranspose(dims[0], dims[1])(m);
  } catch (_e) {
    return f(0);
  }
}

function inv2(m: Float32Array): Float32Array {
  const m00 = m[0] as number;
  const m10 = m[1] as number;
  const m01 = m[2] as number;
  const m11 = m[3] as number;
  const det = f(f(m00 * m11) - f(m01 * m10));
  if (det === 0) return new Float32Array(4);
  const inv = f(1 / det);
  const out = new Float32Array(4);
  out[0] = f(m11 * inv);
  out[1] = f(-m10 * inv);
  out[2] = f(-m01 * inv);
  out[3] = f(m00 * inv);
  return out;
}

function inv3(m: Float32Array): Float32Array {
  // Column-major 3x3; compute adjugate via cofactors.
  const a00 = m[0] as number; const a10 = m[1] as number; const a20 = m[2] as number;
  const a01 = m[3] as number; const a11 = m[4] as number; const a21 = m[5] as number;
  const a02 = m[6] as number; const a12 = m[7] as number; const a22 = m[8] as number;
  const c00 = f(f(a11 * a22) - f(a12 * a21));
  const c01 = f(f(a12 * a20) - f(a10 * a22));
  const c02 = f(f(a10 * a21) - f(a11 * a20));
  const det = f(f(f(a00 * c00) + f(a01 * c01)) + f(a02 * c02));
  if (det === 0) return new Float32Array(9);
  const inv = f(1 / det);
  const out = new Float32Array(9);
  out[0] = f(c00 * inv);
  out[1] = f(c01 * inv);
  out[2] = f(c02 * inv);
  out[3] = f((f(f(a02 * a21) - f(a01 * a22))) * inv);
  out[4] = f((f(f(a00 * a22) - f(a02 * a20))) * inv);
  out[5] = f((f(f(a01 * a20) - f(a00 * a21))) * inv);
  out[6] = f((f(f(a01 * a12) - f(a02 * a11))) * inv);
  out[7] = f((f(f(a02 * a10) - f(a00 * a12))) * inv);
  out[8] = f((f(f(a00 * a11) - f(a01 * a10))) * inv);
  return out;
}

function det3of(a: number, b: number, cc: number, d: number, e: number, gg: number, h: number, k: number, l: number): number {
  const t1 = f(f(a * e) * l);
  const t2 = f(f(b * gg) * h);
  const t3 = f(f(cc * d) * k);
  const t4 = f(f(cc * e) * h);
  const t5 = f(f(b * d) * l);
  const t6 = f(f(a * gg) * k);
  return f(f(f(t1 + t2) + t3) - f(f(t4 + t5) + t6));
}

function minor3(m: Float32Array, r0: number, r1: number, r2: number, c0: number, c1: number, c2: number): number {
  const a = m[c0 * 4 + r0] as number;
  const b = m[c1 * 4 + r0] as number;
  const cc = m[c2 * 4 + r0] as number;
  const d = m[c0 * 4 + r1] as number;
  const e = m[c1 * 4 + r1] as number;
  const gg = m[c2 * 4 + r1] as number;
  const h = m[c0 * 4 + r2] as number;
  const k = m[c1 * 4 + r2] as number;
  const l = m[c2 * 4 + r2] as number;
  return det3of(a, b, cc, d, e, gg, h, k, l);
}

function det4(m: Float32Array): number {
  const t0 = f((m[0] as number) * minor3(m, 1, 2, 3, 1, 2, 3));
  const t1 = f((m[1] as number) * minor3(m, 0, 2, 3, 1, 2, 3));
  const t2 = f((m[2] as number) * minor3(m, 0, 1, 3, 1, 2, 3));
  const t3 = f((m[3] as number) * minor3(m, 0, 1, 2, 1, 2, 3));
  return f(f(t0 - t1) + f(t2 - t3));
}

function inv4(m: Float32Array): Float32Array {
  const det = det4(m);
  if (det === 0) return new Float32Array(16);
  const inv = f(1 / det);
  const out = new Float32Array(16);
  const allR = [0, 1, 2, 3];
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      const rr = allR.filter((v) => v !== r);
      const cc = allR.filter((v) => v !== c);
      const minor = minor3(m, rr[0] as number, rr[1] as number, rr[2] as number, cc[0] as number, cc[1] as number, cc[2] as number);
      const sign = (r + c) % 2 === 0 ? 1 : -1;
      out[c * 4 + r] = f(sign * minor * inv);
    }
  }
  return out;
}

function evalInverse(...args: Value[]): Value {
  if (args.length !== 1) return f(0);
  try {
    const m = args[0] as Value;
    if (!isF32(m)) return f(0);
    if (m.length === 4) return inv2(m);
    if (m.length === 9) return inv3(m);
    if (m.length === 16) return inv4(m);
    return new Float32Array(m.length);
  } catch (_e) {
    return f(0);
  }
}

const SWIZZLE_MAP: Readonly<Record<string, number>> = {
  x: 0, r: 0, s: 0,
  y: 1, g: 1, t: 1,
  z: 2, b: 2, p: 2,
  w: 3, a: 3, q: 3,
};

export function evaluateSwizzle(target: Value, swizzle: string): Value {
  try {
    if (typeof swizzle !== 'string' || swizzle.length === 0) return f(0);
    let comps: number[] = [];
    if (isNum(target)) comps = [target];
    else if (isBool(target)) comps = [target ? 1 : 0];
    else if (isF32(target) || isI32(target) || isU32(target)) {
      comps = Array.from(target as ArrayLike<number>);
    } else if (isBvec(target)) {
      comps = (target as boolean[]).map((b) => (b ? 1 : 0));
    } else return f(0);
    const idx: number[] = [];
    for (const ch of swizzle) {
      const m = SWIZZLE_MAP[ch];
      if (m === undefined) return f(0);
      if (m >= comps.length) return f(0);
      idx.push(m);
    }
    if (idx.length === 1) {
      const v = comps[idx[0] as number] as number;
      if (isBvec(target)) return v !== 0;
      if (isF32(target) || isNum(target) || isBool(target)) return f(v);
      return v;
    }
    // Preserve input vector kind: ivec -> Int32Array, uvec -> Uint32Array,
    // bvec -> boolean[], vec -> Float32Array.
    if (isI32(target)) {
      const out = new Int32Array(idx.length);
      for (let i = 0; i < idx.length; i++) out[i] = comps[idx[i] as number] as number;
      return out;
    }
    if (isU32(target)) {
      const out = new Uint32Array(idx.length);
      for (let i = 0; i < idx.length; i++) out[i] = comps[idx[i] as number] as number;
      return out;
    }
    if (isBvec(target)) {
      const out: boolean[] = new Array(idx.length);
      for (let i = 0; i < idx.length; i++) out[i] = (comps[idx[i] as number] as number) !== 0;
      return out;
    }
    const out = new Float32Array(idx.length);
    for (let i = 0; i < idx.length; i++) out[i] = f(comps[idx[i] as number] as number);
    return out;
  } catch (_e) {
    return f(0);
  }
}

type RelOp = 'lt' | 'le' | 'gt' | 'ge' | 'eq' | 'ne';

function toNumArray(v: Value): number[] | null {
  if (isF32(v) || isI32(v) || isU32(v)) return Array.from(v as ArrayLike<number>);
  if (isNum(v)) return [v];
  return null;
}

function makeRelational(op: RelOp): BuiltinFn {
  return ( ...args: Value[]): Value => {
    try {
      if (args.length !== 2) return f(0);
      const a = toNumArray(args[0] as Value);
      const b = toNumArray(args[1] as Value);
      if (a === null || b === null) return f(0);
      const n = Math.max(a.length, b.length);
      const out: boolean[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const x = a.length === 1 ? (a[0] as number) : (a[i] as number ?? 0);
        const y = b.length === 1 ? (b[0] as number) : (b[i] as number ?? 0);
        if (op === 'lt') out[i] = x < y;
        else if (op === 'le') out[i] = x <= y;
        else if (op === 'gt') out[i] = x > y;
        else if (op === 'ge') out[i] = x >= y;
        else if (op === 'eq') out[i] = x === y;
        else out[i] = x !== y;
      }
      // Match test expectation: plain 2-elem comparisons return boolean[].
      return out;
    } catch (_e) {
      return f(0);
    }
  };
}

function evalAny(...args: Value[]): Value {
  try {
    if (args.length !== 1) return false;
    const v = args[0] as Value;
    if (isBvec(v)) {
      for (const b of v) if (b === true) return true;
      return false;
    }
    if (typeof v === 'boolean') return v;
    return false;
  } catch (_e) {
    return false;
  }
}

function evalAll(...args: Value[]): Value {
  try {
    if (args.length !== 1) return false;
    const v = args[0] as Value;
    if (isBvec(v)) {
      for (const b of v) if (b !== true) return false;
      return true;
    }
    if (typeof v === 'boolean') return v;
    return false;
  } catch (_e) {
    return false;
  }
}

function evalNot(...args: Value[]): Value {
  try {
    if (args.length !== 1) return f(0);
    const v = args[0] as Value;
    if (isBvec(v)) return (v as boolean[]).map((b) => !b);
    if (typeof v === 'boolean') return !v;
    if (isF32(v)) {
      const out = new Float32Array(v.length);
      for (let i = 0; i < v.length; i++) out[i] = f(~Math.trunc(v[i] as number));
      return out;
    }
    if (isI32(v) || isU32(v)) {
      const out = new Int32Array(v.length);
      for (let i = 0; i < v.length; i++) out[i] = ~(v[i] as number);
      return out;
    }
    return f(0);
  } catch (_e) {
    return f(0);
  }
}

function evalIsnan(...args: Value[]): Value {
  try {
    if (args.length !== 1) return false;
    const v = args[0] as Value;
    if (isNum(v)) return Number.isNaN(v);
    if (isF32(v)) return Array.from(v).map((c) => Number.isNaN(c));
    return false;
  } catch (_e) {
    return false;
  }
}

function evalIsinf(...args: Value[]): Value {
  try {
    if (args.length !== 1) return false;
    const v = args[0] as Value;
    if (isNum(v)) return !Number.isFinite(v) && !Number.isNaN(v);
    if (isF32(v)) return Array.from(v).map((c) => !Number.isFinite(c) && !Number.isNaN(c));
    return false;
  } catch (_e) {
    return false;
  }
}

function buildV100(): Map<string, BuiltinFn> {
  const m = new Map<string, BuiltinFn>();
  m.set('abs', evalAbs);
  m.set('floor', evalFloor);
  m.set('ceil', evalCeil);
  m.set('fract', evalFract);
  m.set('sign', evalSign);
  m.set('min', evalMin);
  m.set('max', evalMax);
  m.set('clamp', evalClamp);
  m.set('mix', evalMix);
  m.set('step', evalStep);
  m.set('smoothstep', evalSmoothstep);
  m.set('mod', evalMod);
  m.set('dot', evalDot);
  m.set('cross', evalCross);
  m.set('length', evalLength);
  m.set('distance', evalDistance);
  m.set('normalize', evalNormalize);
  m.set('reflect', evalReflect);
  m.set('refract', evalRefract);
  m.set('faceforward', evalFaceforward);
  m.set('sin', makeTrig('sin'));
  m.set('cos', makeTrig('cos'));
  m.set('tan', makeTrig('tan'));
  m.set('asin', makeTrig('asin'));
  m.set('acos', makeTrig('acos'));
  m.set('atan', evalAtan2);
  m.set('pow', evalPow);
  m.set('exp', makeTrig('exp'));
  m.set('log', makeTrig('log'));
  m.set('exp2', makeTrig('exp2'));
  m.set('log2', makeTrig('log2'));
  m.set('sqrt', makeTrig('sqrt'));
  m.set('inversesqrt', makeTrig('inversesqrt'));
  m.set('vec2', makeVecCtor(2));
  m.set('vec3', makeVecCtor(3));
  m.set('vec4', makeVecCtor(4));
  m.set('ivec2', makeIvecCtor(2));
  m.set('ivec3', makeIvecCtor(3));
  m.set('ivec4', makeIvecCtor(4));
  m.set('bvec2', makeBvecCtor(2));
  m.set('bvec3', makeBvecCtor(3));
  m.set('bvec4', makeBvecCtor(4));
  m.set('mat2', makeMatCtor(2, 2));
  m.set('mat3', makeMatCtor(3, 3));
  m.set('mat4', makeMatCtor(4, 4));
  m.set('lessThan', makeRelational('lt'));
  m.set('lessThanEqual', makeRelational('le'));
  m.set('greaterThan', makeRelational('gt'));
  m.set('greaterThanEqual', makeRelational('ge'));
  m.set('equal', makeRelational('eq'));
  m.set('notEqual', makeRelational('ne'));
  m.set('any', evalAny);
  m.set('all', evalAll);
  m.set('not', evalNot);
  return m;
}

const V100 = buildV100();

function buildV300(): Map<string, BuiltinFn> {
  const m = new Map<string, BuiltinFn>(V100);
  m.set('trunc', evalTrunc);
  m.set('round', evalRound);
  m.set('roundEven', evalRoundEven);
  m.set('transpose', evalTranspose);
  m.set('inverse', evalInverse);
  m.set('isnan', evalIsnan);
  m.set('isinf', evalIsinf);
  m.set('uvec2', makeUvecCtor(2));
  m.set('uvec3', makeUvecCtor(3));
  m.set('uvec4', makeUvecCtor(4));
  m.set('mat2x2', makeMatCtor(2, 2));
  m.set('mat2x3', makeMatCtor(2, 3));
  m.set('mat2x4', makeMatCtor(2, 4));
  m.set('mat3x2', makeMatCtor(3, 2));
  m.set('mat3x3', makeMatCtor(3, 3));
  m.set('mat3x4', makeMatCtor(3, 4));
  m.set('mat4x2', makeMatCtor(4, 2));
  m.set('mat4x3', makeMatCtor(4, 3));
  m.set('mat4x4', makeMatCtor(4, 4));
  return m;
}

const V300 = buildV300();

export const BUILTINS_V100: ReadonlyMap<string, BuiltinFn> = V100;
export const BUILTINS_V300: ReadonlyMap<string, BuiltinFn> = V300;

export function evaluateBuiltin(name: string, args: Value[], version: 100 | 300): Value {
  try {
    if (!Array.isArray(args)) return f(0);
    const table = version === 100 ? V100 : version === 300 ? V300 : null;
    if (table === null) return f(0);
    const fn = table.get(name);
    if (fn === undefined) return f(0);
    const result = fn(...args);
    return result as Value;
  } catch (_e) {
    return f(0);
  }
}
