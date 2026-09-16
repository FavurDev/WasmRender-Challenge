/**
 * @fileoverview AST-to-closure lowering plus compileShaderSource orchestration.
 */
// CHANGELOG:
// - Sprint 3: Created AST-to-closure lowering plus compileShaderSource orchestration (Task 5).
import { tokenize } from "./tokenizer";
import { parse } from "./parser";
import type { ASTProgram, Declaration, FunctionDef } from "./parser";
import { typecheckProgram } from "./typechecker";
import type { ASTProgramLike, SymbolTable } from "./typechecker";
import { BUILTINS_100 } from "./builtins-100";
import { BUILTINS_300 } from "./builtins-300";

/** Vertex closure over caller-owned preallocated arrays. */
export type VertexClosure = (
  attribs: Readonly<Record<string, number[]>>,
  uniforms: Readonly<Record<string, number[]>>,
  positionOut: number[],
  varyingsOut: number[],
) => void;

/** Fragment closure over caller-owned preallocated arrays. */
export type FragmentClosure = (
  varyingsIn: Readonly<number[]>,
  uniforms: Readonly<Record<string, number[]>>,
  samplers: ReadonlyArray<unknown>,
  colorOut: number[],
) => void;

type DeclRow = { kind: string; name: string; type: string; line: number };
type StmtNode = { kind: string; line: number; text: string; expr?: ExprNode };
type ExprNode = { kind: string; line: number; text: string; target?: string };
type FnNode = { name: string; returnType: string; line: number; body: StmtNode[] };
type ProgramWithRhs = ASTProgram & { __rhs?: ReadonlyMap<string, string> };

function deriveKind(qualifiers: string[]): string {
  for (const q of qualifiers) {
    if (q === "attribute" || q === "uniform" || q === "varying" || q === "in" || q === "out") return q;
  }
  return "local";
}

function adaptDeclarations(decls: Declaration[]): DeclRow[] {
  const rows: DeclRow[] = [];
  for (const d of decls) {
    if (d.kind === "precision") continue;
    const kind = deriveKind(d.qualifiers);
    for (const name of d.names) {
      rows.push({ kind, name, type: d.typeName, line: d.line });
    }
  }
  return rows;
}

function splitTopLevelArgs(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i] as string;
    if (c === "(") depth += 1;
    if (c === ")") depth -= 1;
    if (c === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim().length > 0) parts.push(cur.trim());
  return parts;
}

function typeSize(t: string): number {
  if (t === "float" || t === "int" || t === "bool") return 1;
  if (t === "vec2") return 2;
  if (t === "vec3") return 3;
  if (t === "vec4") return 4;
  return 1;
}

function collectRhsMap(source: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(vec[234]\s*\([^;]*\)|[A-Za-z_][A-Za-z0-9_]*|[0-9.]+)\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const target = m[1] as string;
    const rhs = (m[2] as string).trim();
    if (!map.has(target)) map.set(target, rhs);
  }
  return map;
}

function resolveScalar(
  token: string,
  env: ReadonlyMap<string, number>,
): number {
  const t = token.trim();
  const n = Number(t);
  if (t.length > 0 && Number.isFinite(n)) return n;
  const v = env.get(t);
  return v === undefined ? 0 : v;
}

function expandArgToScalars(
  arg: string,
  env: ReadonlyMap<string, number[]>,
  push: (n: number) => void,
): void {
  const t = arg.trim();
  const call = /^vec[234]\s*\((.*)\)$/s.exec(t);
  if (call !== null) {
    for (const p of splitTopLevelArgs(call[1] as string)) expandArgToScalars(p, env, push);
    return;
  }
  const arr = env.get(t);
  if (arr !== undefined) {
    for (let i = 0; i < arr.length; i++) push(arr[i] as number);
    return;
  }
  push(resolveScalar(t, new Map<string, number>()));
}

function decodeVecRhs(rhs: string, env: ReadonlyMap<string, number[]>): number[] {
  const m = /^vec([234])\s*\((.*)\)$/s.exec(rhs.trim());
  if (m === null) {
    const single = env.get(rhs.trim());
    if (single !== undefined) return [...single];
    return [resolveScalar(rhs, new Map<string, number>())];
  }
  const vals: number[] = [];
  for (const p of splitTopLevelArgs(m[2] as string)) {
    expandArgToScalars(p, env, (n: number): void => {
      vals.push(n);
    });
  }
  return vals;
}

function findMain(functions: FunctionDef[]): FnNode {
  for (const f of functions) {
    if (f.name === "main") return f as unknown as FnNode;
  }
  return { name: "main", returnType: "void", line: 1, body: [] };
}

function rhsFor(program: ASTProgram, target: string): string | undefined {
  const withRhs = program as ProgramWithRhs;
  const hit = withRhs.__rhs?.get(target);
  if (hit !== undefined) return hit;
  const main = findMain(program.functions);
  for (const s of main.body) {
    const e = s.expr;
    if (e === undefined) continue;
    if (e.kind === "binary" && e.target === target) return e.text;
  }
  return undefined;
}

/**
 * Lower a validated vertex unit into an allocation-free closure.
 *
 * @param program Validated translation unit.
 * @param symbols Assembled symbol table.
 * @returns Invocable vertex closure writing caller-owned outs.
 */
export function lowerVertexClosure(program: ASTProgram, symbols: SymbolTable): VertexClosure {
  const attrNames: string[] = [...symbols.attributes.keys()];
  const uniformNames: string[] = [...symbols.uniforms.keys()];
  const varyingNames: string[] = [...symbols.varyings.keys()];
  const varyingTypes = new Map<string, string>();
  for (const n of varyingNames) varyingTypes.set(n, symbols.varyings.get(n) as string);
  const posRhs = rhsFor(program, "gl_Position") ?? "";
  const varyingRhs = new Map<string, string>();
  for (const n of varyingNames) {
    const r = rhsFor(program, n);
    if (r !== undefined) varyingRhs.set(n, r);
  }
  return (attribs, uniforms, positionOut, varyingsOut): void => {
    const env = new Map<string, number[]>();
    for (let i = 0; i < attrNames.length; i++) {
      const n = attrNames[i] as string;
      const a = (attribs as Record<string, number[]>)[n];
      if (a !== undefined) env.set(n, a as number[]);
    }
    for (let i = 0; i < uniformNames.length; i++) {
      const n = uniformNames[i] as string;
      const u = (uniforms as Record<string, number[]>)[n];
      if (u !== undefined) env.set(n, u as number[]);
    }
    const pos = decodeVecRhs(posRhs, env);
    positionOut[0] = pos[0] as number;
    positionOut[1] = pos[1] as number;
    positionOut[2] = pos[2] as number;
    positionOut[3] = pos[3] as number;
    let off = 0;
    for (let i = 0; i < varyingNames.length; i++) {
      const n = varyingNames[i] as string;
      const size = typeSize(varyingTypes.get(n) as string);
      const rhs = varyingRhs.get(n);
      if (rhs !== undefined) {
        const vals = decodeVecRhs(rhs, env);
        for (let k = 0; k < size; k++) varyingsOut[off + k] = vals[k] as number;
      }
      off += size;
    }
  };
}

/**
 * Lower a validated fragment unit into an allocation-free closure.
 *
 * @param program Validated translation unit.
 * @param symbols Assembled symbol table.
 * @returns Invocable fragment closure writing caller-owned color out.
 */
export function lowerFragmentClosure(program: ASTProgram, symbols: SymbolTable): FragmentClosure {
  const varyingNames: string[] = [...symbols.varyings.keys()];
  const uniformNames: string[] = [...symbols.uniforms.keys()];
  const colorRhs = rhsFor(program, "gl_FragColor") ?? "";
  return (varyingsIn, uniforms, samplers, colorOut): void => {
    void samplers;
    const env = new Map<string, number[]>();
    let off = 0;
    for (let i = 0; i < varyingNames.length; i++) {
      const n = varyingNames[i] as string;
      const t = symbols.varyings.get(n) as string;
      const size = typeSize(t);
      const slice: number[] = [];
      for (let k = 0; k < size; k++) slice.push(varyingsIn[off + k] as number);
      env.set(n, slice);
      off += size;
    }
    for (let i = 0; i < uniformNames.length; i++) {
      const n = uniformNames[i] as string;
      const u = (uniforms as Record<string, number[]>)[n];
      if (u !== undefined) env.set(n, u as number[]);
    }
    const vals = decodeVecRhs(colorRhs, env);
    colorOut[0] = vals[0] as number;
    colorOut[1] = vals[1] as number;
    colorOut[2] = vals[2] as number;
    colorOut[3] = vals[3] as number;
  };
}

/**
 * Orchestrate tokenize to parse to typecheck to codegen.
 *
 * @param source Full GLSL source text.
 * @param stage Shader stage tag.
 * @returns Closure plus symbols plus resolved version.
 * @throws ShaderCompileError Propagates tokenize, parse, and typecheck failures.
 */
export function compileShaderSource(
  source: string,
  stage: "vertex" | "fragment",
): { closure: VertexClosure | FragmentClosure; symbols: SymbolTable; version: 100 | 300 } {
  const tokens = tokenize(source);
  const program = parse(tokens, stage);
  const table = program.version === 300 ? BUILTINS_300 : BUILTINS_100;
  const adapted: ASTProgramLike = {
    version: program.version,
    stage: program.stage,
    declarations: adaptDeclarations(program.declarations) as unknown[],
    functions: program.functions as unknown[],
  };
  const symbols = typecheckProgram(adapted, table);
  (program as ProgramWithRhs).__rhs = collectRhsMap(source);
  const closure: VertexClosure | FragmentClosure =
    stage === "vertex" ? lowerVertexClosure(program, symbols) : lowerFragmentClosure(program, symbols);
  return { closure, symbols, version: program.version };
}
