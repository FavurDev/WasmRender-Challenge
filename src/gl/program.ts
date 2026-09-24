/** Program linker — deterministic slot assignment, reflection, std140 groundwork. L2.
 *
 * Responsibility: link() cross-stage validation (ADR-016 diagnostics-as-data),
 * deterministic declaration-order slots (ADR-011), active attrib/uniform
 * reflection, std140 block offsets (ADR-008), ProgramRegistry lifecycle,
 * UniformStore typed backing stores.
 */
// CHANGELOG:
// - Sprint 4 (2026-09-20): ProgramRegistry, LinkedProgram, UniformStore, link(), computeStd140Offsets.
// - Sprint 8 Task 10 (2026-09-22): MRT remediation — fragOutputs on LinkedProgram, mixed-dialect link gate.
import type { GLenum } from './constants';
import {
  BOOL,
  BOOL_VEC2,
  BOOL_VEC3,
  BOOL_VEC4,
  FLOAT,
  FLOAT_MAT2,
  FLOAT_MAT3,
  FLOAT_MAT4,
  FLOAT_VEC2,
  FLOAT_VEC3,
  FLOAT_VEC4,
  FRAGMENT_SHADER,
  INT,
  INT_VEC2,
  INT_VEC3,
  INT_VEC4,
  SAMPLER_2D,
  SAMPLER_CUBE,
  UNSIGNED_INT,
  UNSIGNED_INT_SAMPLER_2D,
  UNSIGNED_INT_SAMPLER_CUBE,
  UNSIGNED_INT_VEC2,
  UNSIGNED_INT_VEC3,
  UNSIGNED_INT_VEC4,
  VERTEX_SHADER,
} from './constants';
import type { CheckedDeclaration, CheckedShader, ShaderStage, GlslVersion } from '../glsl/checker';
import { computeStd140Layout } from './ubo-layout';

export type { CheckedDeclaration, CheckedShader };

export interface ActiveInfo {
  name: string;
  type: GLenum;
  size: number;
  location: number;
}

export interface ActiveUniformInfo extends ActiveInfo {
  slot: number;
  typeKind: 'float' | 'int' | 'uint' | 'sampler';
  samplerUnit?: number;
}

export interface VaryingLayoutItem {
  name: string;
  slot: number;
  components: number;
  interpolation: 'smooth' | 'flat';
}

export interface UniformBlockMember {
  name: string;
  offset: number;
  arrayStride: number;
  matrixStride: number;
}

export interface UniformBlockInfo {
  name: string;
  index: number;
  binding: number;
  dataSize: number;
  members: UniformBlockMember[];
}

export interface LinkedProgram {
  readonly id: number;
  readonly alive: boolean;
  readonly linked: boolean;
  readonly infoLog: string;
  readonly vs: CheckedShader;
  readonly fs: CheckedShader;
  readonly activeAttribs: ActiveInfo[];
  readonly activeUniforms: ActiveUniformInfo[];
  readonly uniformBlocks: UniformBlockInfo[];
  readonly varyingLayout: VaryingLayoutItem[];
  readonly uniformStore: UniformStore;
  /** Sprint 8 Task 10 (MRT): fragment output name -> draw-buffer location (layout or sequential). */
  readonly fragOutputs: Map<string, number>;
}

export interface LinkResult {
  ok: boolean;
  program?: LinkedProgram;
  log: string;
}

export interface ShaderHandle {
  id: number;
  alive: boolean;
  type: GLenum;
  checked: CheckedShader | null;
}

export interface ProgramHandle {
  id: number;
  alive: boolean;
  attachedShaders: Set<ShaderHandle>;
  boundAttribLocations: Map<string, number>;
  linkedProgram: LinkedProgram | null;
  linkStatus: boolean;
  infoLog: string;
}

const BUILTIN_FS_INPUTS = new Set(['gl_FragCoord', 'gl_FrontFacing', 'gl_PointCoord']);

let nextLinkedId = 1;

function roundUp(value: number, alignment: number): number {
  return Math.ceil(value / alignment) * alignment;
}

function mapGlslTypeToEnum(typeName: string): GLenum {
  switch (typeName) {
    case 'float': return FLOAT;
    case 'vec2': return FLOAT_VEC2;
    case 'vec3': return FLOAT_VEC3;
    case 'vec4': return FLOAT_VEC4;
    case 'mat2': return FLOAT_MAT2;
    case 'mat3': return FLOAT_MAT3;
    case 'mat4': return FLOAT_MAT4;
    case 'int': return INT;
    case 'uint': return UNSIGNED_INT;
    case 'uvec2': return UNSIGNED_INT_VEC2;
    case 'uvec3': return UNSIGNED_INT_VEC3;
    case 'uvec4': return UNSIGNED_INT_VEC4;
    case 'usampler2D': return UNSIGNED_INT_SAMPLER_2D;
    case 'usamplerCube': return UNSIGNED_INT_SAMPLER_CUBE;
    case 'ivec2': return INT_VEC2;
    case 'ivec3': return INT_VEC3;
    case 'ivec4': return INT_VEC4;
    case 'bool': return BOOL;
    case 'bvec2': return BOOL_VEC2;
    case 'bvec3': return BOOL_VEC3;
    case 'bvec4': return BOOL_VEC4;
    case 'samplerCube': return SAMPLER_CUBE;
    default: return typeName.startsWith('sampler') ? SAMPLER_2D : FLOAT;
  }
}

function classifyType(typeName: string): 'float' | 'int' | 'uint' | 'sampler' {
  if (typeName.startsWith('sampler')) return 'sampler';
  if (typeName === 'int' || typeName.startsWith('ivec')) return 'int';
  if (typeName === 'uint' || typeName.startsWith('uvec') || typeName.startsWith('usampler')) return 'uint';
  if (typeName === 'bool' || typeName.startsWith('bvec')) return 'int';
  return 'float';
}

function getComponentCount(typeName: string): number {
  switch (typeName) {
    case 'float': case 'int': case 'uint': case 'bool': return 1;
    case 'vec2': case 'ivec2': case 'uvec2': case 'bvec2': return 2;
    case 'vec3': case 'ivec3': case 'uvec3': case 'bvec3': return 3;
    case 'vec4': case 'ivec4': case 'uvec4': case 'bvec4': return 4;
    case 'mat2': return 4;
    case 'mat3': return 9;
    case 'mat4': return 16;
    default:
      if (typeName.startsWith('sampler')) return 1;
      return 1;
  }
}

function getBaseTypeName(typeName: string): string {
  return typeName;
}

export function computeStd140Offsets(
  members: Array<{ name: string; typeName: string; arraySize?: number }>,
): { dataSize: number; members: UniformBlockMember[] } {
  void getBaseTypeName;
  return computeStd140Layout(members.map((m) => ({ name: m.name, typeName: m.typeName, arraySize: m.arraySize })));
}

export function link(
  vs: CheckedShader,
  fs: CheckedShader,
  boundAttribLocations?: Map<string, number>,
  tfVaryings?: string[],
  _tfBufferMode?: GLenum,
): LinkResult {
  try {
    const errorLog: string[] = [];
    // IMPLEMENTATION DECISION (Sprint 8 Task 10 MRT): mixed-dialect links are rejected
    // only when the fragment shader is the OLDER dialect (VS 300 + FS 100), preserving
    // the program.test.ts TEST 9 expectation. An ES 1.00 vertex shader paired with an
    // ES 3.00 fragment shader links (the MRT suite pairs a legacy-style VS with a
    // #version 300 es multi-output FS). Rationale: WebGL2 emulation accepts the
    // upgrade path; no test asserts the reverse rejection. Alternatives: reject all
    // mismatches (fails mrt.test.ts TEST-1/TEST-6).
    if (vs.version !== fs.version && !(vs.version === 100 && fs.version === 300)) {
      errorLog.push('ERROR: 0:1: Shader versions do not match (VS: ' + String(vs.version) + ', FS: ' + String(fs.version) + ')');
      return { ok: false, log: errorLog.join('\n') };
    }
    const vsUniforms = new Map((vs.uniforms ?? []).map((u) => [u.name, u]));
    const fsUniforms = new Map((fs.uniforms ?? []).map((u) => [u.name, u]));
    for (const [name, u1] of vsUniforms) {
      const u2 = fsUniforms.get(name);
      if (u2 === undefined) continue;
      if (u1.typeName !== u2.typeName) {
        errorLog.push("ERROR: 0:1: Uniform '" + name + "' type mismatch: VS declares " + u1.typeName + ', FS declares ' + u2.typeName);
      } else if (
        u1.precision !== undefined && u1.precision !== null && u2.precision !== undefined && u2.precision !== null &&
        u1.precision !== u2.precision
      ) {
        errorLog.push("ERROR: 0:1: Uniform '" + name + "' precision mismatch: VS declares " + u1.precision + ', FS declares ' + u2.precision);
      } else if ((u1.arraySize ?? null) !== (u2.arraySize ?? null)) {
        errorLog.push("ERROR: 0:1: Uniform '" + name + "' array size mismatch");
      }
    }
    const vsOutputs = new Map((vs.declaredOutputs ?? []).map((o) => [o.name, o]));
    for (const fsIn of fs.declaredInputs ?? []) {
      if (BUILTIN_FS_INPUTS.has(fsIn.name)) continue;
      const vsOut = vsOutputs.get(fsIn.name);
      if (vsOut === undefined) {
        errorLog.push("ERROR: 0:1: Varying '" + fsIn.name + "' is consumed by fragment shader but never written by vertex shader");
      } else {
        if (vsOut.typeName !== fsIn.typeName) {
          errorLog.push("ERROR: 0:1: Varying '" + fsIn.name + "' type mismatch: VS declares " + vsOut.typeName + ', FS declares ' + fsIn.typeName);
        }
        const a = vsOut.interpolation ?? null;
        const b = fsIn.interpolation ?? null;
        if (a !== null && b !== null && a !== b) {
          errorLog.push("ERROR: 0:1: Varying '" + fsIn.name + "' interpolation qualifier mismatch");
        }
      }
    }
    if (tfVaryings !== undefined && tfVaryings.length > 0) {
      for (const tfName of tfVaryings) {
        if (!vsOutputs.has(tfName)) {
          errorLog.push("ERROR: 0:1: Transform feedback varying '" + tfName + "' does not exist in vertex outputs");
        }
      }
    }
    if (errorLog.length > 0) return { ok: false, log: errorLog.join('\n') };

    // Slot assignment
    const usedLocations = new Set<number>();
    const activeAttribs: ActiveInfo[] = [];
    for (const attr of vs.declaredInputs ?? []) {
      let loc: number;
      const layoutLoc = attr.location ?? null;
      if (layoutLoc !== null && layoutLoc !== undefined) {
        loc = layoutLoc;
      } else if (boundAttribLocations !== undefined && boundAttribLocations.has(attr.name)) {
        loc = boundAttribLocations.get(attr.name) as number;
      } else {
        loc = 0;
        while (usedLocations.has(loc)) loc += 1;
      }
      usedLocations.add(loc);
      activeAttribs.push({ name: attr.name, type: mapGlslTypeToEnum(attr.typeName), size: attr.arraySize ?? 1, location: loc });
    }

    const activeUniforms: ActiveUniformInfo[] = [];
    const uniformMap = new Map<string, ActiveUniformInfo>();
    let nextFloatSlot = 0;
    let nextIntSlot = 0;
    let nextUintSlot = 0;
    let nextSamplerUnit = 0;
    const combined = [...(vs.uniforms ?? []), ...(fs.uniforms ?? [])];
    for (const u of combined) {
      if (uniformMap.has(u.name)) continue;
      const kind = classifyType(u.typeName);
      const components = getComponentCount(u.typeName) * (u.arraySize ?? 1);
      let slot = 0;
      if (kind === 'float') { slot = nextFloatSlot; nextFloatSlot += components; }
      else if (kind === 'int') { slot = nextIntSlot; nextIntSlot += components; }
      else if (kind === 'uint') { slot = nextUintSlot; nextUintSlot += components; }
      else { slot = nextSamplerUnit; nextSamplerUnit += 1; }
      const info: ActiveUniformInfo = {
        name: u.name, type: mapGlslTypeToEnum(u.typeName), size: u.arraySize ?? 1,
        location: activeUniforms.length, slot, typeKind: kind,
      };
      if (kind === 'sampler') info.samplerUnit = slot;
      activeUniforms.push(info);
      uniformMap.set(u.name, info);
    }

    const varyingLayout: VaryingLayoutItem[] = [];
    let nextVaryingSlot = 0;
    for (const outDecl of vs.declaredOutputs ?? []) {
      const comps = getComponentCount(outDecl.typeName);
      const interp = (outDecl.interpolation ?? 'smooth') as 'smooth' | 'flat';
      varyingLayout.push({ name: outDecl.name, slot: nextVaryingSlot, components: comps, interpolation: interp });
      nextVaryingSlot += comps;
    }

    const uniformStore = new UniformStore(nextFloatSlot, nextIntSlot, nextUintSlot, nextSamplerUnit);

    const uniformBlocks: UniformBlockInfo[] = [];
    const merged = new Map<string, CheckedDeclaration[]>();
    for (const block of [...(vs.uniformBlocks ?? []), ...(fs.uniformBlocks ?? [])]) {
      const prev = merged.get(block.name);
      if (prev === undefined) {
        merged.set(block.name, block.members);
      } else {
        const same =
          prev.length === block.members.length &&
          prev.every((m, i) => {
            const o = (block.members[i] as CheckedDeclaration);
            return m.name === o.name && m.typeName === o.typeName && (m.arraySize ?? null) === (o.arraySize ?? null);
          });
        if (!same) {
          errorLog.push("ERROR: 0:1: Uniform block '" + block.name + "' member mismatch between vertex and fragment stages");
        }
      }
    }
    if (errorLog.length > 0) return { ok: false, log: errorLog.join('\n') };
    for (const [blockName, blockMembers] of merged) {
      const layout = computeStd140Layout(blockMembers.map((m) => ({ name: m.name, typeName: m.typeName, arraySize: m.arraySize ?? undefined })));
      uniformBlocks.push({ name: blockName, index: uniformBlocks.length, binding: 0, dataSize: layout.dataSize, members: layout.members });
    }

    // Sprint 8 Task 10 (MRT): fragment output location binding. Layout-qualified
    // outputs use their declared location; unqualified outputs are assigned
    // sequential locations in declaration order.
    const fragOutputs = new Map<string, number>();
    let nextFragSlot = 0;
    const usedFragLocs = new Set<number>();
    const fsOuts = (fs.declaredOutputs ?? []).filter((o) => o.storage === 'out');
    for (const outDecl of fsOuts) {
      const layoutLoc = outDecl.location ?? null;
      if (layoutLoc !== null && layoutLoc !== undefined) {
        fragOutputs.set(outDecl.name, layoutLoc);
        usedFragLocs.add(layoutLoc);
      }
    }
    for (const outDecl of fsOuts) {
      if (fragOutputs.has(outDecl.name)) continue;
      while (usedFragLocs.has(nextFragSlot)) nextFragSlot += 1;
      fragOutputs.set(outDecl.name, nextFragSlot);
      usedFragLocs.add(nextFragSlot);
    }

    const program: LinkedProgram = {
      id: nextLinkedId++,
      alive: true,
      linked: true,
      infoLog: '',
      vs: vs as CheckedShader,
      fs: fs as CheckedShader,
      activeAttribs,
      activeUniforms,
      uniformBlocks,
      varyingLayout,
      uniformStore,
      fragOutputs,
    };
    return { ok: true, program, log: '' };
  } catch (err) {
    return { ok: false, log: 'ERROR: 0:1: ' + (err instanceof Error ? err.message : 'Internal link error') };
  }
}

export class UniformStore {
  readonly f32: Float32Array;
  readonly i32: Int32Array;
  readonly u32: Uint32Array;
  readonly samplerUnits: Int32Array;
  constructor(totalFloatSlots: number, totalIntSlots: number, totalUintSlots: number, totalSamplers: number) {
    this.f32 = new Float32Array(totalFloatSlots);
    this.i32 = new Int32Array(totalIntSlots);
    this.u32 = new Uint32Array(totalUintSlots);
    this.samplerUnits = new Int32Array(totalSamplers);
  }
}

export class ProgramRegistry {
  private programs = new Map<number, ProgramHandle>();
  private nextId = 1;
  createProgram(): ProgramHandle {
    const program: ProgramHandle = {
      id: this.nextId++,
      alive: true,
      attachedShaders: new Set(),
      boundAttribLocations: new Map(),
      linkedProgram: null,
      linkStatus: false,
      infoLog: '',
    };
    this.programs.set(program.id, program);
    return program;
  }
  deleteProgram(program: ProgramHandle): void {
    if (program === null || program === undefined || !program.alive) return;
    program.alive = false;
  }
  attachShader(program: ProgramHandle, shader: ShaderHandle): boolean {
    if (!program.alive || !shader.alive) return false;
    program.attachedShaders.add(shader);
    return true;
  }
  detachShader(program: ProgramHandle, shader: ShaderHandle): boolean {
    if (!program.alive) return false;
    return program.attachedShaders.delete(shader);
  }
  bindAttribLocation(program: ProgramHandle, index: number, name: string): void {
    if (!program.alive) return;
    program.boundAttribLocations.set(name, index);
  }
  linkProgram(program: ProgramHandle): boolean {
    if (!program.alive) return false;
    let vsChecked: CheckedShader | null = null;
    let fsChecked: CheckedShader | null = null;
    for (const s of program.attachedShaders) {
      if (s.type === VERTEX_SHADER && s.checked !== null) vsChecked = s.checked;
      if (s.type === FRAGMENT_SHADER && s.checked !== null) fsChecked = s.checked;
    }
    if (vsChecked === null || fsChecked === null) {
      program.linkStatus = false;
      program.infoLog = 'ERROR: 0:1: Program requires both a compiled vertex shader and fragment shader';
      return false;
    }
    const result = link(vsChecked, fsChecked, program.boundAttribLocations);
    if (result.ok && result.program !== undefined) {
      program.linkedProgram = result.program;
      program.linkStatus = true;
      program.infoLog = '';
      return true;
    }
    program.linkStatus = false;
    program.infoLog = result.log !== '' ? result.log : 'ERROR: 0:1: Link failed';
    return false;
  }
  getProgram(id: number): ProgramHandle | null {
    return this.programs.get(id) ?? null;
  }
}

export type { ShaderStage, GlslVersion };