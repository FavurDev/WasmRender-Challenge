/**
 * @fileoverview Program link validation with status-flag channel.
 */
import type { VertexClosure, FragmentClosure } from "./shader-compiler/codegen";
import type { SymbolTable } from "./shader-compiler/typechecker";

/** Compiled shader input: codegen output plus optional main marker. */
export type CompiledShader = {
  closure: VertexClosure | FragmentClosure;
  symbols: SymbolTable;
  version: 100 | 300;
  hasMain?: boolean;
};

/** Opaque uniform handle with monotonic numeric id. */
export type UniformHandle = { id: number };

/** Linked program record carrying status-flag channel. */
export type GLProgram = {
  id: number;
  vertexClosure: VertexClosure | FragmentClosure;
  fragmentClosure: VertexClosure | FragmentClosure;
  attribLocations: Map<string, number>;
  uniformLocations: Map<string, UniformHandle>;
  linked: boolean;
  infoLog: string;
};

let nextProgramId = 1;

/**
 * Validate version, main presence, and varying agreement, then assign locations.
 *
 * @param vertex Compiled vertex shader.
 * @param fragment Compiled fragment shader.
 * @returns Linked or failed program record; failures set linked false plus infoLog.
 */
export function linkProgram(vertex: CompiledShader, fragment: CompiledShader): GLProgram {
  const fail = (infoLog: string): GLProgram => ({
    id: nextProgramId++,
    vertexClosure: vertex.closure,
    fragmentClosure: fragment.closure,
    attribLocations: new Map(),
    uniformLocations: new Map(),
    linked: false,
    infoLog,
  });
  if (vertex.version !== fragment.version) return fail("VERSION_MISMATCH");
  const vMain = vertex.hasMain ?? true;
  const fMain = fragment.hasMain ?? true;
  if (vMain === false || fMain === false) return fail("MISSING_MAIN");
  for (const [name, type] of vertex.symbols.varyings) {
    const ft = fragment.symbols.varyings.get(name);
    if (ft === undefined || ft !== type) return fail(`VARYING_MISMATCH ${name}`);
  }
  for (const [name] of fragment.symbols.varyings) {
    if (!vertex.symbols.varyings.has(name)) return fail(`VARYING_MISMATCH ${name}`);
  }
  const attribLocations = new Map<string, number>();
  let loc = 0;
  for (const name of vertex.symbols.attributes.keys()) attribLocations.set(name, loc++);
  const uniformLocations = new Map<string, UniformHandle>();
  let uid = 0;
  for (const name of vertex.symbols.uniforms.keys()) {
    if (!uniformLocations.has(name)) uniformLocations.set(name, { id: uid++ });
  }
  for (const name of fragment.symbols.uniforms.keys()) {
    if (!uniformLocations.has(name)) uniformLocations.set(name, { id: uid++ });
  }
  return {
    id: nextProgramId++,
    vertexClosure: vertex.closure,
    fragmentClosure: fragment.closure,
    attribLocations,
    uniformLocations,
    linked: true,
    infoLog: "",
  };
}

/**
 * Return declaration-order location for a vertex attribute name.
 *
 * @param program Linked program record.
 * @param name Attribute name.
 * @returns Location or -1 when absent.
 */
export function getAttribLocation(program: GLProgram, name: string): number {
  const v = program.attribLocations.get(name);
  return v === undefined ? -1 : v;
}

/**
 * Return stable opaque uniform handle for a declared uniform name.
 *
 * @param program Linked program record.
 * @param name Uniform name.
 * @returns Same handle object on repeat lookup, or null when absent.
 */
export function getUniformLocation(program: GLProgram, name: string): UniformHandle | null {
  const h = program.uniformLocations.get(name);
  return h === undefined ? null : h;
}
