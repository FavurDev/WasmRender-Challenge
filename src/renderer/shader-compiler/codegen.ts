/**
 * @fileoverview AST-to-closure lowering plus compileShaderSource orchestration.
 */
// CHANGELOG:
// - Sprint 3: Created AST-to-closure lowering plus compileShaderSource orchestration (Task 5).
// - Phase 2 Sprint 1: Rewired fragment closure for per-fragment shading (T1).
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
/**
 * One precomputed color lane feeding the allocation-free fragment closure.
 *
 * vKind selects the lane source: 0 = literal in lit, 1 = varying scalar at
 * vOff, 2 = uniform scalar named by uName at uIdx. vOff is an index into the
 * packed varying vector; uName/uIdx address the live uniform map.
 */
type FragLane = { vKind: number; vOff: number; uName: string; uIdx: number; lit: number };

/**
 * Parse a sampler color expression into its binding and coordinate names.
 *
 * @param rhs Raw gl_FragColor right-hand side text, expected as a texture call.
 * @returns Sampler and coordinate identifiers, or undefined when rhs is not a texture call.
 */
function parseSamplerRhs(rhs: string): { sampler: string; coord: string } | undefined {
  const m = /^(texture2D|texture)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*$/.exec(rhs.trim());
  if (m === null) return undefined;
  return { sampler: m[2] as string, coord: m[3] as string };
}

export function lowerFragmentClosure(program: ASTProgram, symbols: SymbolTable): FragmentClosure {
  const varyingNames: string[] = [...symbols.varyings.keys()];
  const uniformNames: string[] = [...symbols.uniforms.keys()];
  const colorRhs = rhsFor(program, "gl_FragColor") ?? "";
  const varyingOffsets: number[] = [];
  const varyingSizes: number[] = [];
  let totalVaryingLen = 0;
  for (let i = 0; i < varyingNames.length; i++) {
    const t = symbols.varyings.get(varyingNames[i] as string) as string;
    const size = typeSize(t);
    varyingOffsets.push(totalVaryingLen);
    varyingSizes.push(size);
    totalVaryingLen += size;
  }
  const samplerNames: string[] = [];
  for (const n of uniformNames) {
    const t = symbols.uniforms.get(n);
    if (t === "sampler2D") samplerNames.push(n);
  }
  const colorTrim = colorRhs.trim();
  const samplerDesc = parseSamplerRhs(colorRhs);
  const samplerLike = samplerDesc !== undefined || /texture/i.test(colorTrim);
  let samplerSlot = -1;
  let uvVaryingOff = -1;
  let uvUniformName = "";
  let unknownSampler = false;
  if (samplerDesc !== undefined) {
    for (let i = 0; i < samplerNames.length; i++) {
      if (samplerNames[i] === samplerDesc.sampler) samplerSlot = i;
    }
    // Sampler slots index samplerNames (declaration order of sampler2D uniforms).
    // A non-sampler uniform sharing the name must NOT alias a sampler slot.
    for (let i = 0; i < varyingNames.length; i++) {
      if (varyingNames[i] === samplerDesc.coord) uvVaryingOff = varyingOffsets[i] as number;
    }
    if (uvVaryingOff < 0) uvUniformName = samplerDesc.coord;
    if (samplerSlot < 0) unknownSampler = true;
  } else if (samplerLike) {
    samplerSlot = 0;
    if (varyingOffsets.length > 0) uvVaryingOff = varyingOffsets[0] as number;
    for (let i = 0; i < varyingNames.length && uvVaryingOff < 0; i++) {
      if (colorTrim.indexOf(varyingNames[i] as string) >= 0) uvVaryingOff = varyingOffsets[i] as number;
    }
  }
  let varyingColorOff = -1;
  for (let i = 0; i < varyingNames.length; i++) {
    if (varyingNames[i] === colorTrim) varyingColorOff = varyingOffsets[i] as number;
  }
  let varyingColorSize = 0;
  if (varyingColorOff >= 0) {
    for (let i = 0; i < varyingNames.length; i++) {
      if (varyingNames[i] === colorTrim) varyingColorSize = varyingSizes[i] as number;
    }
  }
  let uniformColorName = "";
  for (let i = 0; i < uniformNames.length; i++) {
    if (uniformNames[i] === colorTrim) uniformColorName = uniformNames[i] as string;
  }
  const isSampler = samplerLike;
  const isVarying = !samplerLike && varyingColorOff >= 0;
  const isUniform = !samplerLike && varyingColorOff < 0 && uniformColorName.length > 0;
  const laneCount = 4;
  const lanes: FragLane[] = [];
  const vecMatch = /^vec([234])\s*\((.*)\)$/s.exec(colorTrim);
  if (!isSampler && !isVarying && !isUniform && vecMatch !== null) {
    const parts = splitTopLevelArgs(vecMatch[2] as string);
    for (let p = 0; p < parts.length && lanes.length < 4; p++) {
      const tok = (parts[p] as string).trim();
      let done = false;
      for (let i = 0; i < varyingNames.length && !done; i++) {
        if (varyingNames[i] === tok) {
          const sz = varyingSizes[i] as number;
          const off = varyingOffsets[i] as number;
          for (let k = 0; k < sz && lanes.length < 4; k++) {
            lanes.push({ vKind: 1, vOff: off + k, uName: "", uIdx: 0, lit: 0 });
          }
          done = true;
        }
      }
      if (done) continue;
      let uHit = false;
      for (let i = 0; i < uniformNames.length && !uHit; i++) {
        if (uniformNames[i] === tok) {
          lanes.push({ vKind: 2, vOff: 0, uName: tok, uIdx: 0, lit: 0 });
          uHit = true;
        }
      }
      if (uHit) continue;
      const num = Number(tok);
      if (tok.length > 0 && Number.isFinite(num)) {
        lanes.push({ vKind: 0, vOff: 0, uName: "", uIdx: 0, lit: num });
      }
    }
  }
  const isVec = lanes.length > 0;
  const scratch: number[] = [0, 0, 0, 0];
  return (varyingsIn, uniforms, samplers, colorOut): void => {
    if (varyingsIn.length < totalVaryingLen) {
      colorOut[0] = 0;
      colorOut[1] = 0;
      colorOut[2] = 0;
      colorOut[3] = 1;
      return;
    }
    for (let i = 0; i < laneCount; i++) scratch[i] = 0;
    if (isSampler) {
      if (unknownSampler) {
        colorOut[0] = 0;
        colorOut[1] = 0;
        colorOut[2] = 0;
        colorOut[3] = 1;
        return;
      }
      let u = 0;
      let v = 0;
      if (uvVaryingOff >= 0) {
        u = varyingsIn[uvVaryingOff] as number;
        v = varyingsIn[uvVaryingOff + 1] as number;
      } else if (uvUniformName.length > 0) {
        const uv = (uniforms as Record<string, number[]>)[uvUniformName];
        if (uv !== undefined && uv.length >= 2) {
          u = uv[0] as number;
          v = uv[1] as number;
        } else if (varyingsIn.length >= 2) {
          u = varyingsIn[0] as number;
          v = varyingsIn[1] as number;
        }
      }
      const binding = samplerSlot >= 0 && samplerSlot < samplers.length ? samplers[samplerSlot] : undefined;
      const rec = binding as unknown as { sample: (uu: number, vv: number, out: number[]) => void };
      if (rec !== undefined && rec !== null && typeof rec.sample === "function") {
        try {
          rec.sample(u, v, scratch);
        } catch (_e) {
          scratch[0] = 0;
          scratch[1] = 0;
          scratch[2] = 0;
          scratch[3] = 1;
        }
      } else {
        scratch[0] = 0;
        scratch[1] = 0;
        scratch[2] = 0;
        scratch[3] = 1;
      }
      colorOut[0] = scratch[0] as number;
      colorOut[1] = scratch[1] as number;
      colorOut[2] = scratch[2] as number;
      colorOut[3] = scratch[3] as number;
      return;
    }
    if (isVarying) {
      for (let k = 0; k < varyingColorSize && k < 4; k++) {
        scratch[k] = varyingsIn[varyingColorOff + k] as number;
      }
      if (varyingColorSize < 4) scratch[3] = 1;
      colorOut[0] = scratch[0] as number;
      colorOut[1] = scratch[1] as number;
      colorOut[2] = scratch[2] as number;
      colorOut[3] = scratch[3] as number;
      return;
    }
    if (isUniform) {
      const arr = (uniforms as Record<string, number[]>)[uniformColorName];
      if (arr !== undefined) {
        for (let k = 0; k < 4; k++) scratch[k] = arr[k] as number;
      } else {
        scratch[0] = 0;
        scratch[1] = 0;
        scratch[2] = 0;
        scratch[3] = 1;
      }
      colorOut[0] = scratch[0] as number;
      colorOut[1] = scratch[1] as number;
      colorOut[2] = scratch[2] as number;
      colorOut[3] = scratch[3] as number;
      return;
    }
    if (isVec) {
      for (let i = 0; i < lanes.length && i < 4; i++) {
        const lane = lanes[i] as FragLane;
        if (lane.vKind === 0) scratch[i] = lane.lit;
        else if (lane.vKind === 1) scratch[i] = varyingsIn[lane.vOff] as number;
        else {
          const arr = (uniforms as Record<string, number[]>)[lane.uName];
          if (arr !== undefined) scratch[i] = arr[lane.uIdx] as number;
        }
      }
      colorOut[0] = scratch[0] as number;
      colorOut[1] = scratch[1] as number;
      colorOut[2] = scratch[2] as number;
      colorOut[3] = scratch[3] as number;
      return;
    }
    scratch[0] = 0;
    scratch[1] = 0;
    scratch[2] = 0;
    scratch[3] = 1;
    colorOut[0] = scratch[0] as number;
    colorOut[1] = scratch[1] as number;
    colorOut[2] = scratch[2] as number;
    colorOut[3] = scratch[3] as number;
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
