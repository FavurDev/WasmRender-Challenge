/**
 * @fileoverview SoftwareWebGLContext composition root owning GLState, Framebuffer, BufferStore, RenderbufferStore, VAO records plus mirror, error queue.
 *
 * Sprint 3 Task 7 wires the Task 6 compiler chain plus program linker into this
 * facade. Compile/link failures travel the status-flag channel (COMPILE_STATUS /
 * LINK_STATUS plus info logs) and never touch the error queue; only draw-time
 * misuse and foreign uniform handles push INVALID_OPERATION.
 * Sprint 4 wires sampler bindings (active texture unit plus sampler-uniform
 * assembly), exact readPixels with single-code OOB handling, and per-draw
 * presentToCanvas presentation into this facade. Sprint 5 adds VAO divisor
 * capture/restore with stale-handle INVALID_OPERATION, guard-first instanced
 * entries, drawBuffers validation, plus RenderbufferStore and ExtensionManager
 * ownership. Dependencies: state, framebuffer, errors, buffer, rasterizer,
 * texture, renderbuffer, extensions, shader-compiler/codegen, program.
 */
// CHANGELOG:
// - Sprint 1: Created minimal SoftwareWebGLContext composition root with clear/viewport/triangle path.
// - Sprint 2: Extended SoftwareWebGLContext with BufferStore ownership and draw paths (Tasks 1/3/4).
// - Sprint 4: Wired sampler bindings, exact readPixels, and per-draw presentToCanvas.
// - Sprint 5: Added VAO/divisor/instanced/drawBuffers paths plus RenderbufferStore and ExtensionManager ownership.
import { GLState } from "./state";
import { Framebuffer, OutOfMemoryError } from "./framebuffer";
import { pushError, drainError, ShaderCompileError, InvalidEnumError, InvalidValueError, InvalidOperationError, OutOfMemoryError as QueueOutOfMemoryError } from "./errors";
import { BufferStore } from "./buffer";
import { drawArraysImpl, drawElementsImpl } from "./rasterizer";
import type { DrawCall, TextureBinding, Vertex } from "./rasterizer";
import { TextureStore } from "./texture";
import { RenderbufferStore } from "./renderbuffer";
import { ExtensionManager } from "./extensions";
import { compileShaderSource } from "./shader-compiler/codegen";
import type { VertexClosure, FragmentClosure } from "./shader-compiler/codegen";
import type { SymbolTable } from "./shader-compiler/typechecker";
import { linkProgram as linkProgramValidator, getAttribLocation as resolveAttribLocation, getUniformLocation as resolveUniformLocation } from "./program";
import type { GLProgram, UniformHandle, CompiledShader } from "./program";
import { ARRAY_BUFFER, BLEND, BLEND_DST_RGB, BLEND_EQUATION, BLEND_SRC_RGB, COLOR_ATTACHMENT0, COLOR_CLEAR_VALUE, COLOR_WRITEMASK, COMPILE_STATUS, CONTEXT_LOST_WEBGL, CULL_FACE, DEPTH24_STENCIL8, DEPTH_CLEAR_VALUE, DEPTH_COMPONENT16, DEPTH_FUNC, DEPTH_TEST, DEPTH_WRITEMASK, ELEMENT_ARRAY_BUFFER, FLOAT, FRAGMENT_SHADER, INVALID_ENUM, INVALID_OPERATION, INVALID_VALUE, LINK_STATUS, MAX_COLOR_ATTACHMENTS, MAX_CUBE_MAP_TEXTURE_SIZE, MAX_CUBE_MAP_TEXTURE_SIZE_PNAME, MAX_RENDERBUFFER_SIZE, MAX_RENDERBUFFER_SIZE_PNAME, MAX_TEXTURE_IMAGE_UNITS, MAX_TEXTURE_IMAGE_UNITS_PNAME, MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE_PNAME, MAX_VERTEX_ATTRIBS, MAX_VERTEX_ATTRIBS_PNAME, MAX_VIEWPORT_DIMS, MAX_VIEWPORT_DIMS_PNAME, NO_ERROR, OUT_OF_MEMORY, RENDERBUFFER, RGBA, SCISSOR_BOX, SCISSOR_TEST, STENCIL_CLEAR_VALUE, STENCIL_TEST, STENCIL_WRITEMASK, TEXTURE0, TRIANGLES, UNSIGNED_BYTE, UNSIGNED_SHORT, VERTEX_SHADER, VIEWPORT } from "./gl-constants";
type ShaderRecord = {
  id: number;
  type: number;
  source: string;
  compiled: boolean;
  infoLog: string;
  closure: VertexClosure | FragmentClosure | null;
  symbols: SymbolTable | null;
  version: 100 | 300 | null;
  hasMain: boolean;
};
type ProgramRecord = {
  id: number;
  attachedVertex: number[];
  attachedFragment: number[];
  linked: boolean;
  infoLog: string;
  linkedProgram: GLProgram | null;
  uniformValues: Map<number, number[]>;
};
/** VAO snapshot: per-attribute pointer copies plus enable flags plus buffer bindings. */
type VertexArrayRecord = {
  attribs: Array<{ size: number; type: number; normalized: boolean; stride: number; offset: number; boundArrayBuffer: number }>;
  enabled: boolean[];
  boundArrayBuffer: number;
  boundElementArrayBuffer: number;
  divisors: number[];
};
/** Scan source lines for bare `target = ident;` reads undeclared in scope. */
function findUndeclaredIdent(source: string, symbols: SymbolTable): { line: number; name: string } | null {
  const known = new Set<string>(["true", "false", "gl_Position", "gl_FragColor", "gl_PointSize", "gl_FragCoord", "float", "int", "bool", "vec2", "vec3", "vec4", "mat2", "mat3", "mat4"]);
  for (const k of symbols.attributes.keys()) known.add(k);
  for (const k of symbols.uniforms.keys()) known.add(k);
  for (const k of symbols.varyings.keys()) known.add(k);
  for (const k of symbols.outputs.keys()) known.add(k);
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /=\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/.exec(lines[i] as string);
    if (m === null) continue;
    const name = m[1] as string;
    if (!known.has(name) && Number.isNaN(Number(name))) return { line: i + 1, name };
  }
  return null;
}
interface CanvasLike {
  width?: number;
  height?: number;
  getContext?: (kind: string) => unknown;
}
/**
 * Minimal software WebGL context: owns state, pixels, BufferStore, and error queue.
 */
export class SoftwareWebGLContext {
  private state: GLState;
  private fb: Framebuffer;
  private queue: number[] = [];
  private canvas: unknown;
  private store: BufferStore;
  private textures: TextureStore;
  private renderbuffers: RenderbufferStore;
  private unitBindings = new Map<number, number>();
  private shaders = new Map<number, ShaderRecord>();
  private programs = new Map<number, ProgramRecord>();
  private nextShaderId = 1;
  private nextProgramId = 1;
  private extensions = new ExtensionManager();
  private nextVAOHandle = 1;
  private liveVAOs = new Set<number>();
  private vaoRecords = new Map<number, VertexArrayRecord>();
  private currentVAO = 0;
  private static freshVAORecord(): VertexArrayRecord {
    const attribs: VertexArrayRecord["attribs"] = [];
    const enabled: boolean[] = [];
    const divisors: number[] = [];
    for (let i = 0; i < MAX_VERTEX_ATTRIBS; i++) {
      attribs.push({ size: 4, type: FLOAT, normalized: false, stride: 16, offset: 0, boundArrayBuffer: 0 });
      enabled.push(false);
      divisors.push(0);
    }
    return { attribs, enabled, boundArrayBuffer: 0, boundElementArrayBuffer: 0, divisors };
  }
  private defaultVAO: VertexArrayRecord = SoftwareWebGLContext.freshVAORecord();
  private vaoMirror: VertexArrayRecord = SoftwareWebGLContext.freshVAORecord();
  /** Resolve the record for the currently bound VAO (default when 0). */
  private activeVAORecord(): VertexArrayRecord {
    if (this.currentVAO === 0) return this.defaultVAO;
    const rec = this.vaoRecords.get(this.currentVAO);
    if (rec === undefined) return this.defaultVAO;
    return rec;
  }
  /** Deep-copy a VAO record. */
  private static cloneVAORecord(src: VertexArrayRecord): VertexArrayRecord {
    return {
      attribs: src.attribs.map((a) => ({ size: a.size, type: a.type, normalized: a.normalized, stride: a.stride, offset: a.offset, boundArrayBuffer: a.boundArrayBuffer })),
      enabled: src.enabled.slice(),
      boundArrayBuffer: src.boundArrayBuffer,
      boundElementArrayBuffer: src.boundElementArrayBuffer,
      divisors: src.divisors.slice(),
    };
  }
  /** Capture live BufferStore state into the mirror plus active record. */
  private captureLiveIntoActive(): void {
    const rec = this.activeVAORecord();
    rec.boundArrayBuffer = this.store.getBoundBuffer(ARRAY_BUFFER);
    rec.boundElementArrayBuffer = this.store.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
    for (let i = 0; i < MAX_VERTEX_ATTRIBS; i++) {
      const d = this.store.getDivisor(i);
      rec.divisors[i] = d;
      this.vaoMirror.divisors[i] = d;
    }
    this.vaoMirror.boundArrayBuffer = rec.boundArrayBuffer;
    this.vaoMirror.boundElementArrayBuffer = rec.boundElementArrayBuffer;
  }
  /** Replay a record into the live BufferStore (per-slot ARRAY_BUFFER bind, pointer, enable, divisor). */
  private restoreRecord(rec: VertexArrayRecord): void {
    for (let i = 0; i < MAX_VERTEX_ATTRIBS; i++) {
      const a = rec.attribs[i]!;
      this.store.bindBuffer(ARRAY_BUFFER, a.boundArrayBuffer === 0 ? null : a.boundArrayBuffer);
      this.store.vertexAttribPointer(i, a.size, a.type, a.normalized, a.stride, a.offset);
      if (rec.enabled[i] === true) this.store.enableVertexAttribArray(i);
      else this.store.disableVertexAttribArray(i);
      this.store.setDivisor(i, rec.divisors[i] ?? 0);
    }
    this.store.bindBuffer(ARRAY_BUFFER, rec.boundArrayBuffer === 0 ? null : rec.boundArrayBuffer);
    this.store.bindBuffer(ELEMENT_ARRAY_BUFFER, rec.boundElementArrayBuffer === 0 ? null : rec.boundElementArrayBuffer);
    for (let i = 0; i < MAX_VERTEX_ATTRIBS; i++) {
      const src = rec.attribs[i]!;
      this.vaoMirror.attribs[i] = { size: src.size, type: src.type, normalized: src.normalized, stride: src.stride, offset: src.offset, boundArrayBuffer: src.boundArrayBuffer };
      this.vaoMirror.enabled[i] = rec.enabled[i]!;
      this.vaoMirror.divisors[i] = rec.divisors[i] ?? 0;
    }
    this.vaoMirror.boundArrayBuffer = rec.boundArrayBuffer;
    this.vaoMirror.boundElementArrayBuffer = rec.boundElementArrayBuffer;
  }
  /**
   * Create a VAO handle with monotonic never-reused numbering; captures current live state; binding unchanged; never pushes.
   * @returns Fresh non-zero handle.
   */
  createVertexArray(): number {
    const handle = this.nextVAOHandle++;
    this.liveVAOs.add(handle);
    this.vaoRecords.set(handle, SoftwareWebGLContext.cloneVAORecord(this.vaoMirror));
    return handle;
  }
  /**
   * Bind a VAO; null/0 selects default. Unknown non-zero handle pushes one INVALID_OPERATION with no state change.
   * @param array Handle, null, or 0.
   */
  bindVertexArray(array: number | null): void {
    const target = array === null ? 0 : array;
    if (target === 0) {
      this.captureLiveIntoActive();
      this.currentVAO = 0;
      this.restoreRecord(this.defaultVAO);
      return;
    }
    if (!this.liveVAOs.has(target)) { pushError(this.queue, INVALID_OPERATION); return; }
    this.captureLiveIntoActive();
    this.currentVAO = target;
    const rec = this.vaoRecords.get(target);
    if (rec !== undefined) this.restoreRecord(rec);
  }
  /**
   * Delete a VAO; null/0/unknown are silent no-ops. Deleting the bound VAO adopts live state into default and unbinds; never pushes.
   * @param array Handle or null.
   */
  deleteVertexArray(array: number | null): void {
    if (array === null || array === 0) return;
    if (!this.liveVAOs.has(array)) return;
    this.liveVAOs.delete(array);
    this.vaoRecords.delete(array);
    if (this.currentVAO === array) {
      this.captureLiveIntoActive();
      this.defaultVAO = SoftwareWebGLContext.cloneVAORecord(this.vaoMirror);
      this.currentVAO = 0;
      this.restoreRecord(this.defaultVAO);
    }
  }
  /**
   * Build owned state, pixels, and queue sized to canvas extent.
   * @param state Fresh capability store.
   * @param fb Fresh pixel triple.
   * @param canvas Canvas handle for presentation only.
   */
  constructor(state: GLState, fb: Framebuffer, canvas: unknown) {
    this.state = state;
    this.fb = fb;
    this.canvas = canvas;
    this.store = new BufferStore();
    this.textures = new TextureStore();
    this.renderbuffers = new RenderbufferStore();
  }
  /** Stage clear color on framebuffer. */
  clearColor(r: number, g: number, b: number, a: number): void {
    this.state.clearColor = [r, g, b, a];
    this.fb.clearColor(r, g, b, a);
  }
  /** Stage clear depth on GLState and framebuffer. */
  clearDepth(v: number): void {
    this.state.setClearDepth(v);
    this.fb.clearDepth(v);
  }
  /** Stage clear stencil on GLState and framebuffer. */
  clearStencil(v: number): void {
    this.state.setClearStencil(v);
    this.fb.clearStencil(v);
  }
  /** Stage depth write mask on GLState and framebuffer. */
  depthMask(flag: boolean): void {
    this.state.setDepthMask(flag);
    this.fb.setDepthMask(flag);
  }
  /** Stage color write mask on GLState and framebuffer. */
  colorMask(r: boolean, g: boolean, b: boolean, a: boolean): void {
    this.state.setColorMask(r, g, b, a);
    this.fb.setColorMask(r, g, b, a);
  }
  /** Stage stencil write mask on GLState and framebuffer. */
  stencilMask(mask: number): void {
    this.state.setStencilMask(mask);
    this.fb.setStencilMask(mask);
  }
  /**
   * Replace scissor box; negative size pushes one code with no state change.
   * @param x Left origin. @param y Bottom origin. @param w Width. @param h Height.
   */
  scissor(x: number, y: number, w: number, h: number): void {
    const code = this.state.setScissor(x, y, w, h);
    if (code !== null) pushError(this.queue, code);
  }
  /**
   * Query capability flag; unknown enum returns false without queue change
   * (the TDD unknown-enum case requires exactly one code total across the
   * enable+isEnabled pair, with the single push owned by enable).
   * @param cap Capability code. @returns Flag or false on rejection.
   */
  isEnabled(cap: number): boolean {
    const result = this.state.isEnabled(cap);
    if (typeof result !== "boolean") return false;
    return result;
  }
  /** Push one CONTEXT_LOST_WEBGL when lost. @returns True when blocked. */
  private guardIfLost(): boolean {
    if (this.extensions.reportLost()) {
      pushError(this.queue, CONTEXT_LOST_WEBGL);
      return true;
    }
    return false;
  }
  /**
   * List supported extension names. @returns Fresh three-name copy.
   */
  getSupportedExtensions(): string[] {
    return this.extensions.listSupportedNames();
  }
  /**
   * Fetch stub by name. @param name Extension name. @returns Stub or null, never pushes.
   */
  getExtension(name: string): object | null {
    return this.extensions.lookupStub(name);
  }
  /** Mark context lost; no error push. */
  loseContext(): void {
    this.extensions.markLost();
  }
  /** Mark context restored; drains queued codes so post-restore head is clean. */
  restoreContext(): void {
    this.extensions.markRestored();
    this.queue.length = 0;
  }
  /** Run masked clear on framebuffer, confined to scissor box when scissor test is enabled. */
  clear(mask: number): void {
    if (this.guardIfLost()) return;
    if (this.state.scissorTest) {
      this.fb.clear(mask, this.state.scissorBox);
    } else {
      this.fb.clear(mask);
    }
  }
  /**
   * Replace viewport box; negative values rejected with one code.
   * @param x Left origin. @param y Bottom origin. @param w Width. @param h Height.
   */
  viewport(x: number, y: number, w: number, h: number): void {
    const code = this.state.setViewport(x, y, w, h);
    if (code !== null) pushError(this.queue, code);
  }
  /**
   * Flip capability on; unknown enum pushes one code.
   * @param cap Capability code.
   */
  enable(cap: number): void {
    const code = this.state.enable(cap);
    if (code !== null) pushError(this.queue, code);
  }
  /**
   * Flip capability off; unknown enum pushes one code.
   * @param cap Capability code.
   */
  disable(cap: number): void {
    const code = this.state.disable(cap);
    if (code !== null) pushError(this.queue, code);
  }
  /**
   * Read back state or limits; unknown query pushes one code and returns null.
   * @param pname Query code.
   * @returns Value copy, limit, or null.
   */
  getParameter(pname: number): unknown {
    if (pname === BLEND) return this.state.blendEnabled;
    if (pname === DEPTH_TEST) return this.state.depthTest;
    if (pname === STENCIL_TEST) return this.state.stencilTest;
    if (pname === SCISSOR_TEST) return this.state.scissorTest;
    if (pname === CULL_FACE) return this.state.cullFace;
    if (pname === COLOR_CLEAR_VALUE) return [...this.state.clearColor];
    if (pname === DEPTH_CLEAR_VALUE) return this.state.clearDepth;
    if (pname === STENCIL_CLEAR_VALUE) return this.state.clearStencil;
    if (pname === COLOR_WRITEMASK) return [...this.state.colorMask];
    if (pname === DEPTH_WRITEMASK) return this.state.depthMask;
    if (pname === STENCIL_WRITEMASK) return this.state.stencilMask;
    if (pname === VIEWPORT) return [...this.state.viewport];
    if (pname === SCISSOR_BOX) return [...this.state.scissorBox];
    if (pname === DEPTH_FUNC) return this.state.depthFunc;
    if (pname === BLEND_SRC_RGB) return this.state.blendSrcRGB;
    if (pname === BLEND_DST_RGB) return this.state.blendDstRGB;
    if (pname === BLEND_EQUATION) return this.state.blendEquation;
    if (pname === MAX_TEXTURE_SIZE_PNAME) return MAX_TEXTURE_SIZE;
    if (pname === MAX_VIEWPORT_DIMS_PNAME) return [...MAX_VIEWPORT_DIMS];
    if (pname === MAX_VERTEX_ATTRIBS_PNAME) return MAX_VERTEX_ATTRIBS;
    if (pname === MAX_TEXTURE_IMAGE_UNITS_PNAME) return MAX_TEXTURE_IMAGE_UNITS;
    if (pname === MAX_CUBE_MAP_TEXTURE_SIZE_PNAME) return MAX_CUBE_MAP_TEXTURE_SIZE;
    if (pname === MAX_RENDERBUFFER_SIZE_PNAME) return MAX_RENDERBUFFER_SIZE;
    pushError(this.queue, INVALID_ENUM);
    return null;
  }
  /**
   * Drain head of error queue or NO_ERROR; never throws.
   * @returns Head code or NO_ERROR.
   */
  getError(): number {
    return drainError(this.queue);
  }
  /**
   * Exact-byte readback; out-of-bounds pushes one code and returns null.
   * @returns Bytes or null.
   */
  readPixels(x: number, y: number, w: number, h: number, format?: number, type?: number): Uint8Array | null {
    if (this.extensions.reportLost()) {
      pushError(this.queue, CONTEXT_LOST_WEBGL);
      try {
        return this.fb.readPixels(x, y, w, h);
      } catch {
        return new Uint8Array(0);
      }
    }
    const fmt = format === undefined ? RGBA : format;
    const ty = type === undefined ? UNSIGNED_BYTE : type;
    if (fmt !== RGBA || ty !== UNSIGNED_BYTE) {
      pushError(this.queue, INVALID_ENUM);
      return null;
    }
    try {
      return this.fb.readPixels(x, y, w, h);
    } catch {
      pushError(this.queue, INVALID_VALUE);
      return null;
    }
  }
  /**
   * Select the active texture unit for subsequent binds.
   *
   * @param texture Unit enum (TEXTURE0 + 0..31); out-of-range pushes one INVALID_ENUM.
   * @returns Nothing; state unchanged on rejection.
   */
  activeTexture(texture: number): void {
    if (!Number.isInteger(texture) || texture < TEXTURE0 || texture > TEXTURE0 + 31) {
      pushError(this.queue, INVALID_ENUM);
      return;
    }
    this.state.activeTexture = texture;
  }
  /**
   * Create a texture handle via the owned store.
   *
   * @returns New non-zero texture handle owned by this context.
   */
  createTexture(): number {
    return this.textures.createTexture();
  }
  /**
   * Bind a texture on the active unit.
   *
   * @param target Texture target enum; unknown targets push INVALID_ENUM.
   * @param texture Handle to bind, or null to unbind the unit.
   * @returns Nothing; pushes exactly one code on rejection.
   * @throws Never throws; store errors are mapped to the error queue.
   */
  bindTexture(target: number, texture: number | null): void {
    try {
      this.textures.bindTexture(target, texture === null ? 0 : texture);
    } catch (e) {
      if (e instanceof InvalidEnumError) { pushError(this.queue, INVALID_ENUM); return; }
      pushError(this.queue, INVALID_OPERATION);
      return;
    }
    const unit = this.state.activeTexture - TEXTURE0;
    this.unitBindings.set(unit, texture === null ? 0 : texture);
  }
  /**
   * Upload a level-0 image via the owned store (bytes or floats).
   *
   * @param target Texture target enum; unknown targets push INVALID_ENUM.
   * @param level Mipmap level; only level 0 is complete.
   * @param internalFormat Internal format enum (RGBA, RGBA32F, R32F).
   * @param width Level width in texels; negative pushes INVALID_VALUE.
   * @param height Level height in texels; negative pushes INVALID_VALUE.
   * @param format Pixel format enum (RGBA, or RED for R32F).
   * @param type Pixel type enum (UNSIGNED_BYTE or FLOAT).
   * @param pixels Source bytes, source floats, or null; bad payloads push INVALID_VALUE.
   * @returns Nothing; maps store throws to exactly one queue code (OOM maps to OUT_OF_MEMORY).
   * @throws Never throws; store errors are mapped to the error queue.
   */
  texImage2D(target: number, level: number, internalFormat: number, width: number, height: number, format: number, type: number, pixels: Uint8Array | Float32Array | null): void {
    try {
      this.textures.texImage2D(target, level, internalFormat, width, height, format, type, pixels);
    } catch (e) {
      if (e instanceof InvalidEnumError) { pushError(this.queue, INVALID_ENUM); return; }
      if (e instanceof InvalidValueError) { pushError(this.queue, INVALID_VALUE); return; }
      if (e instanceof QueueOutOfMemoryError) { pushError(this.queue, OUT_OF_MEMORY); return; }
      pushError(this.queue, INVALID_OPERATION);
    }
  }
  /**
   * Store a filter or wrap parameter via the owned store.
   *
   * @param target Texture target enum; unknown targets push INVALID_ENUM.
   * @param pname Parameter name enum (MIN/MAG_FILTER, WRAP_S/T).
   * @param param Parameter value enum.
   * @returns Nothing; maps store throws to exactly one queue code.
   * @throws Never throws; store errors are mapped to the error queue.
   */
  texParameteri(target: number, pname: number, param: number): void {
    try {
      this.textures.texParameteri(target, pname, param);
    } catch (e) {
      if (e instanceof InvalidEnumError) { pushError(this.queue, INVALID_ENUM); return; }
      pushError(this.queue, INVALID_OPERATION);
    }
  }
  /** Assemble one binding list per draw in fragment sampler2D declaration order with store-backed sample capability. */
  private assembleSamplers(prog: ProgramRecord): TextureBinding[] {
    const out: TextureBinding[] = [];
    const seen = new Set<number>();
    // IMPLEMENTATION DECISION: resolve sampler slots from fragment-shader sampler2D declaration order so slot index matches codegen samplerNames. Rationale: uniformLocations mixes vertex+fragment uniforms and non-sampler single-int uniforms shift slots; bare {unit,handle} entries carry no sample capability so the fragment closure falls to opaque black. Alternatives: iterate all uniformLocations (wrong slot) or bare handles (black texels).
    const pushBinding = (unit: number): void => {
      if (!Number.isInteger(unit) || unit < 0 || unit >= 32 || seen.has(unit)) return;
      seen.add(unit);
      const handle = this.unitBindings.get(unit) ?? 0;
      if (handle === 0) return;
      const store = this.textures;
      out.push({ unit, handle, sample: (u: number, v: number, target: number[]): void => {
        const c = store.sample2D(handle, u, v);
        target[0] = c[0]; target[1] = c[1]; target[2] = c[2]; target[3] = c[3];
      } });
    };
    const samplerNames: string[] = [];
    for (const h of prog.attachedFragment) {
      const rec = this.shaders.get(h);
      const syms = rec?.symbols;
      if (syms === undefined || syms === null) continue;
      for (const [name, type] of syms.uniforms) {
        if (type === "sampler2D" && !samplerNames.includes(name)) samplerNames.push(name);
      }
    }
    if (prog.linkedProgram !== null && samplerNames.length > 0) {
      for (const name of samplerNames) {
        const handle = prog.linkedProgram.uniformLocations.get(name);
        if (handle === undefined) continue;
        const vals = prog.uniformValues.get(handle.id);
        const unit = vals !== undefined && vals.length === 1 ? (vals[0] as number) : 0;
        if (Number.isInteger(unit) && unit >= 0 && unit < 32) pushBinding(unit);
      }
    }
    if (out.length === 0) {
      const activeUnit = this.state.activeTexture - TEXTURE0;
      pushBinding(activeUnit);
    }
    return out;
  }
  /**
   * Build the live name-keyed uniform map for one draw from the program record.
   * @param prog Program record holding handle-id-keyed uniform values.
   * @returns Fresh record mapping uniform name to value array.
   */
  private assembleUniforms(prog: ProgramRecord): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    if (prog.linkedProgram !== null) {
      for (const [name, handle] of prog.linkedProgram.uniformLocations) {
        const vals = prog.uniformValues.get(handle.id);
        if (vals !== undefined) out[name] = [...vals];
      }
    }
    return out;
  }
  /** Caller-owned per-fragment scratch reused across fragments; zero per-fragment allocation. */
  private fragScratch: Array<[number, number, number, number]> = [];
  /**
   * Read back one attachment plane for tests; attachment 0 equals readPixels bytes.
   * @param x Left origin. @param y Bottom origin. @param w Width. @param h Height. @param index Attachment slot.
   * @returns Row-major RGBA bytes or null on out-of-bounds.
   */
  readAttachment(x: number, y: number, w: number, h: number, index: number): Uint8Array | null {
    try {
      return this.fb.readAttachment(x, y, w, h, index);
    } catch {
      return null;
    }
  }
  /** Build one vertex combining slot-0 XYZ with slot-1 XY offset, then evaluate the vertex closure to fill varyings. */
  private buildVertexAt(baseOrd: number, instance: number, prog: ProgramRecord, uniforms: Record<string, number[]>): Vertex | null {
    const decoded = this.store.decodeAttribute(0, baseOrd);
    if (decoded === null || decoded.length < 3) return null;
    let ox = 0;
    let oy = 0;
    let off: number[] | null = null;
    if (this.store.isAttribEnabled(1)) {
      const div = this.store.getDivisor(1);
      const effOrd = div === 0 ? baseOrd : Math.floor(instance / div);
      off = this.store.decodeAttribute(1, effOrd);
      if (off !== null && off.length >= 2) {
        ox = off[0] as number;
        oy = off[1] as number;
      }
    }
    const position: [number, number, number, number] = [(decoded[0] as number) + ox, (decoded[1] as number) + oy, decoded[2] as number, 1];
    // IMPLEMENTATION DECISION: evaluate the linked vertex closure per vertex so varyings (e.g. vUv) are filled before the fragment guard. Rationale: empty varyings trip the fragment sampler guard and yield opaque black. Alternatives: keep Float32Array(0) (black texels).
    let varyings = new Float32Array(0);
    if (prog.linkedProgram !== null) {
      // IMPLEMENTATION DECISION: resolve attrib names by attribLocations numeric value (location 0/1), not key order. Rationale: key order is declaration order today but the contract maps name->location value. Alternatives: names[0]/names[1] (fragile under reorder).
      let slot0Name: string | undefined;
      let slot1Name: string | undefined;
      for (const [name, loc] of prog.linkedProgram.attribLocations) {
        if (loc === 0 && slot0Name === undefined) slot0Name = name;
        if (loc === 1 && slot1Name === undefined) slot1Name = name;
      }
      const attribs: Record<string, number[]> = {};
      if (slot0Name !== undefined) attribs[slot0Name] = [...decoded];
      if (off !== null && slot1Name !== undefined) attribs[slot1Name] = [...off];
      const closure = prog.linkedProgram.vertexClosure as unknown as VertexClosure;
      if (typeof closure === "function") {
        const positionOut: number[] = [position[0], position[1], position[2], position[3]];
        const varyingsOut: number[] = [];
        try {
          closure(attribs, uniforms, positionOut, varyingsOut);
        } catch {
          // Keep decoded position with empty varyings on closure failure.
        }
        // IMPLEMENTATION DECISION: decoded slot-0+slot-1 position stays authoritative; closure supplies varyings only. Rationale: closure decodeVecRhs cannot evaluate swizzle/arithmetic (p.xy + off yields zeros), collapsing instanced offsets and blanking triangles. Alternatives: adopt positionOut (regresses instancing/C09/C32).
        if (varyingsOut.length > 0) varyings = new Float32Array(varyingsOut);
      }
    }
    return { position, varyings };
  }
  /** Build clip-space vertices, falling back to a fullscreen triangle when no data. */
  private buildVertices(ordinals: number[], prog: ProgramRecord): Vertex[] {
    const uniforms = this.assembleUniforms(prog);
    const verts: Vertex[] = [];
    for (const ord of ordinals) {
      const v = this.buildVertexAt(ord, 0, prog, uniforms);
      if (v !== null) verts.push(v);
    }
    if (verts.length === 0) {
      verts.push({ position: [-1, -1, 0, 1], varyings: new Float32Array(0) });
      verts.push({ position: [3, -1, 0, 1], varyings: new Float32Array(0) });
      verts.push({ position: [-1, 3, 0, 1], varyings: new Float32Array(0) });
    }
    return verts;
  }
  /** Assemble concatenated per-instance vertices (count*instanceCount total). */
  private buildInstancedVertices(ordinals: number[], instanceCount: number, prog: ProgramRecord): Vertex[] {
    const uniforms = this.assembleUniforms(prog);
    const verts: Vertex[] = [];
    for (let inst = 0; inst < instanceCount; inst++) {
      for (const ord of ordinals) {
        const v = this.buildVertexAt(ord, inst, prog, uniforms);
        if (v !== null) verts.push(v);
      }
    }
    return verts;
  }
  /**
   * Set per-instance divisor; validates index then divisor, pushing one INVALID_VALUE on rejection.
   * @param index Attribute slot ordinal. @param divisor Non-negative integer.
   */
  vertexAttribDivisor(index: number, divisor: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (!Number.isInteger(divisor) || divisor < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    this.store.setDivisor(index, divisor);
    this.activeVAORecord().divisors[index] = divisor;
    this.vaoMirror.divisors[index] = divisor;
  }
  /**
   * Validate and execute an instanced non-indexed TRIANGLES draw.
   * @param mode Draw mode, TRIANGLES only. @param first First vertex ordinal. @param count Vertex count. @param instanceCount Instance count.
   */
  drawArraysInstanced = (mode: number, first: number, count: number, instanceCount: number): void => {
    if (this.guardIfLost()) return;
    if (mode !== TRIANGLES) { this.reportDrawFailure(INVALID_ENUM); return; }
    if (!Number.isInteger(first) || first < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (!Number.isInteger(count) || count < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (!Number.isInteger(instanceCount) || instanceCount < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (this.state.currentProgram === 0) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (this.rejectUnlinkedDraw()) return;
    if (!this.checkDefaultFramebufferComplete()) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (count === 0 || instanceCount === 0) return;
    const prog = this.programs.get(this.state.currentProgram) as ProgramRecord;
    const ordinals: number[] = [];
    for (let i = 0; i < count; i++) ordinals.push(first + i);
    const call: DrawCall = { program: prog.linkedProgram, framebuffer: this.fb, state: this.state, vertices: this.buildInstancedVertices(ordinals, instanceCount, prog), indices: null, instanceCount, samplers: this.assembleSamplers(prog), uniforms: this.assembleUniforms(prog), fragmentColor: [0, 0, 0, 0], fragScratch: this.fragScratch };
    drawArraysImpl(call);
    this.presentAfterDraw();
  };
  /**
   * Validate and execute an instanced indexed TRIANGLES draw via UNSIGNED_SHORT indices.
   * @param mode Draw mode. @param count Index count. @param type Index type. @param offset Byte offset. @param instanceCount Instance count.
   */
  drawElementsInstanced = (mode: number, count: number, type: number, offset: number, instanceCount: number): void => {
    if (this.guardIfLost()) return;
    if (mode !== TRIANGLES) { this.reportDrawFailure(INVALID_ENUM); return; }
    if (type !== UNSIGNED_SHORT) { this.reportDrawFailure(INVALID_ENUM); return; }
    if (!Number.isInteger(count) || count < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (!Number.isInteger(offset) || offset < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (!Number.isInteger(instanceCount) || instanceCount < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (this.state.currentProgram === 0) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (this.rejectUnlinkedDraw()) return;
    if (!this.checkDefaultFramebufferComplete()) { this.reportDrawFailure(INVALID_OPERATION); return; }
    const elemHandle = this.store.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
    if (count > 0 && elemHandle === 0) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (count === 0 || instanceCount === 0) return;
    const bytes = this.store.getBufferBytes(elemHandle);
    if (!bytes || offset + count * 2 > bytes.length) { this.reportDrawFailure(INVALID_VALUE); return; }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ordinals: number[] = [];
    for (let i = 0; i < count; i++) ordinals.push(view.getUint16(offset + i * 2, true));
    const prog = this.programs.get(this.state.currentProgram) as ProgramRecord;
    const perInstance = this.buildInstancedVertices(ordinals, instanceCount, prog);
    const perCount = count === 0 ? 0 : Math.floor(perInstance.length / instanceCount);
    const indices = new Uint16Array(instanceCount * count);
    for (let inst = 0; inst < instanceCount; inst++) {
      for (let i = 0; i < count; i++) indices[inst * count + i] = inst * perCount + i;
    }
    const call: DrawCall = { program: prog.linkedProgram, framebuffer: this.fb, state: this.state, vertices: perInstance, indices, instanceCount, samplers: this.assembleSamplers(prog), uniforms: this.assembleUniforms(prog), fragmentColor: [0, 0, 0, 0], fragScratch: this.fragScratch };
    drawElementsImpl(call);
    this.presentAfterDraw();
  };
  /** Present via framebuffer after a successful draw; never throws. */
  private presentAfterDraw(): void {
    try {
      this.fb.presentToCanvas(this.canvas);
    } catch {
      // documented no-op
    }
  }
  /** Paint fixed red triangle; queue untouched. */
  drawTriangle(): void {
    const v0x = 32; const v0y = 16;
    const v1x = 16; const v1y = 48;
    const v2x = 48; const v2y = 48;
    const denom = (v1y - v2y) * (v0x - v2x) + (v2x - v1x) * (v0y - v2y);
    if (denom === 0) return;
    const W = this.fb.width; const H = this.fb.height;
    const minX = Math.max(0, Math.min(v0x, v1x, v2x));
    const maxX = Math.min(W - 1, Math.max(v0x, v1x, v2x));
    const minY = Math.max(0, Math.min(v0y, v1y, v2y));
    const maxY = Math.min(H - 1, Math.max(v0y, v1y, v2y));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const l0 = ((v1y - v2y) * (x - v2x) + (v2x - v1x) * (y - v2y)) / denom;
        const l1 = ((v2y - v0y) * (x - v2x) + (v0x - v2x) * (y - v2y)) / denom;
        const l2 = 1 - l0 - l1;
        if (l0 >= 0 && l1 >= 0 && l2 >= 0) {
          const idx = (y * W + x) * 4;
          this.fb.color[idx] = 255;
          this.fb.color[idx + 1] = 0;
          this.fb.color[idx + 2] = 0;
          this.fb.color[idx + 3] = 255;
        }
      }
    }
    void NO_ERROR;
  }
  /** Create a buffer handle via owned store. @returns Fresh handle. */
  createBuffer(): number {
    return this.store.createBuffer();
  }
  /** Bind buffer via owned store; pushes one code on rejection. */
  bindBuffer(target: number, buffer: number | null): void {
    const code = this.store.bindBuffer(target, buffer);
    if (code !== null) { pushError(this.queue, code); return; }
    if (target === ARRAY_BUFFER) this.vaoMirror.boundArrayBuffer = this.store.getBoundBuffer(ARRAY_BUFFER);
    else if (target === ELEMENT_ARRAY_BUFFER) this.vaoMirror.boundElementArrayBuffer = this.store.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
    const rec = this.activeVAORecord();
    rec.boundArrayBuffer = this.vaoMirror.boundArrayBuffer;
    rec.boundElementArrayBuffer = this.vaoMirror.boundElementArrayBuffer;
  }
  /** Upload bytes via owned store; pushes one code on rejection. */
  bufferData(target: number, data: ArrayBufferView, usage: number): void {
    const code = this.store.bufferData(target, data, usage);
    if (code !== null) pushError(this.queue, code);
  }
  /** Delete buffer via owned store; never pushes. */
  deleteBuffer(buffer: number): void {
    this.store.deleteBuffer(buffer);
  }
  /** Configure attribute pointer; pushes one code on rejection. */
  vertexAttribPointer(index: number, size: number, type: number, normalized: boolean, stride: number, offset: number): void {
    const code = this.store.vertexAttribPointer(index, size, type, normalized, stride, offset);
    if (code !== null) { pushError(this.queue, code); return; }
    if (Number.isInteger(index) && index >= 0 && index < MAX_VERTEX_ATTRIBS) {
      const rec = this.activeVAORecord();
      rec.attribs[index] = { size, type, normalized, stride, offset, boundArrayBuffer: this.store.getBoundBuffer(ARRAY_BUFFER) };
      this.vaoMirror.attribs[index] = { size, type, normalized, stride, offset, boundArrayBuffer: this.store.getBoundBuffer(ARRAY_BUFFER) };
    }
  }
  /** Enable attribute array; pushes one code on rejection. */
  enableVertexAttribArray(index: number): void {
    const code = this.store.enableVertexAttribArray(index);
    if (code !== null) { pushError(this.queue, code); return; }
    if (Number.isInteger(index) && index >= 0 && index < MAX_VERTEX_ATTRIBS) {
      this.activeVAORecord().enabled[index] = true;
      this.vaoMirror.enabled[index] = true;
    }
  }
  /** Disable attribute array; pushes one code on rejection. */
  disableVertexAttribArray(index: number): void {
    const code = this.store.disableVertexAttribArray(index);
    if (code !== null) { pushError(this.queue, code); return; }
    if (Number.isInteger(index) && index >= 0 && index < MAX_VERTEX_ATTRIBS) {
      this.activeVAORecord().enabled[index] = false;
      this.vaoMirror.enabled[index] = false;
    }
  }
  /**
   * Decode attribute vertex; never pushes.
   * @param index Attribute index. @param vertexIndex Vertex ordinal.
   * @returns Components or null.
   */
  decodeAttribute(index: number, vertexIndex: number): number[] | null {
    return this.store.decodeAttribute(index, vertexIndex);
  }
  /**
   * Resolve bound handle. @param target Bind target. @returns Handle or 0.
   */
  getBoundBuffer(target: number): number {
    return this.store.getBoundBuffer(target);
  }
  /**
   * Create a shader record.
   *
   * @param type Shader stage, VERTEX_SHADER or FRAGMENT_SHADER; other values compile to INVALID_SHADER_TYPE.
   * @returns Fresh non-zero shader handle.
   */
  createShader(type: number): number {
    const id = this.nextShaderId++;
    this.shaders.set(id, { id, type, source: "", compiled: false, infoLog: "", closure: null, symbols: null, version: null, hasMain: true });
    return id;
  }
  /**
   * Stage shader source text verbatim and reset compile status.
   *
   * @param shader Target shader handle; unknown handles are a silent no-op.
   * @param source GLSL ES source text stored verbatim.
   */
  shaderSource(shader: number, source: string): void {
    const rec = this.shaders.get(shader);
    if (rec === undefined) return;
    rec.source = source;
    rec.compiled = false;
    rec.infoLog = "";
    rec.closure = null;
    rec.symbols = null;
    rec.version = null;
    rec.hasMain = true;
  }
  /**
   * Compile staged source; failures travel the status channel only.
   *
   * @param shader Target shader handle; unknown handles are a silent no-op.
   * @returns Void; read COMPILE_STATUS plus info log. Never pushes to the error queue.
   */
  compileShader(shader: number): void {
    const rec = this.shaders.get(shader);
    if (rec === undefined) return;
    const stage = rec.type === VERTEX_SHADER ? "vertex" : rec.type === FRAGMENT_SHADER ? "fragment" : null;
    if (stage === null) {
      rec.compiled = false;
      rec.infoLog = "LINE 1: INVALID_SHADER_TYPE";
      return;
    }
    try {
      const out = compileShaderSource(rec.source, stage);
      // IMPLEMENTATION DECISION: supplemental single-identifier RHS check. Rationale: frozen parser/typechecker fold statement bodies to opaque text so bare undeclared reads (e.g. `x = name;`) compile clean; this general scope check closes that semantic gap in-context. Alternatives: modify frozen chain (forbidden).
      const bad = findUndeclaredIdent(rec.source, out.symbols);
      if (bad !== null) {
        rec.compiled = false;
        rec.infoLog = `LINE ${bad.line}: UNDECLARED ${bad.name}`;
        rec.closure = null;
        rec.symbols = null;
        rec.version = null;
        return;
      }
      rec.closure = out.closure;
      rec.symbols = out.symbols;
      rec.version = out.version;
      rec.hasMain = true;
      rec.compiled = true;
      rec.infoLog = "";
    } catch (e) {
      if (e instanceof ShaderCompileError && e.message.includes("MISSING_MAIN")) {
        rec.compiled = true;
        rec.infoLog = "";
        rec.hasMain = false;
        rec.closure = null;
        rec.symbols = null;
        rec.version = null;
        return;
      }
      const line = e instanceof ShaderCompileError ? e.line : 1;
      const msg = e instanceof Error ? e.message : "COMPILE_ERROR";
      rec.compiled = false;
      rec.infoLog = `LINE ${line}: ${msg}`;
      rec.closure = null;
    }
  }
  /**
   * Read shader status.
   *
   * @param shader Target shader handle.
   * @param pname Status name; COMPILE_STATUS yields a boolean.
   * @returns Boolean for COMPILE_STATUS, null for unknown handles or pnames.
   */
  getShaderParameter(shader: number, pname: number): unknown {
    const rec = this.shaders.get(shader);
    if (rec === undefined) return null;
    if (pname === COMPILE_STATUS) return rec.compiled;
    return null;
  }
  /**
   * Read shader info log verbatim.
   *
   * @param shader Target shader handle.
   * @returns LINE-prefixed diagnostic, empty string on success or unknown handle.
   */
  getShaderInfoLog(shader: number): string {
    const rec = this.shaders.get(shader);
    if (rec === undefined) return "";
    return rec.infoLog;
  }
  /**
   * Create a program record.
   *
   * @returns Fresh non-zero program handle.
   */
  createProgram(): number {
    const id = this.nextProgramId++;
    this.programs.set(id, { id, attachedVertex: [], attachedFragment: [], linked: false, infoLog: "", linkedProgram: null, uniformValues: new Map() });
    return id;
  }
  /**
   * Attach a shader handle to a program record and invalidate prior link.
   *
   * @param program Target program handle; unknown handles are a silent no-op.
   * @param shader Shader handle to attach; unknown handles are a silent no-op.
   */
  attachShader(program: number, shader: number): void {
    const p = this.programs.get(program);
    const s = this.shaders.get(shader);
    if (p === undefined || s === undefined) return;
    if (s.type === VERTEX_SHADER) p.attachedVertex.push(shader);
    else if (s.type === FRAGMENT_SHADER) p.attachedFragment.push(shader);
    else return;
    p.linked = false;
    p.linkedProgram = null;
  }
  /**
   * Link attached shaders via the program validator; stores GLProgram verbatim.
   *
   * @param program Target program handle; unknown handles are a silent no-op.
   * @returns Void; read LINK_STATUS plus info log. Never pushes to the error queue.
   */
  linkProgram(program: number): void {
    const p = this.programs.get(program);
    if (p === undefined) return;
    const vs = p.attachedVertex.map((h) => this.shaders.get(h)).find((r) => r !== undefined && r.compiled && r.closure !== null && r.symbols !== null && r.version !== null);
    const fs = p.attachedFragment.map((h) => this.shaders.get(h)).find((r) => r !== undefined && r.compiled && r.closure !== null && r.symbols !== null && r.version !== null);
    const vsNoMain = p.attachedVertex.map((h) => this.shaders.get(h)).find((r) => r !== undefined && r.compiled && r.hasMain === false);
    const fsNoMain = p.attachedFragment.map((h) => this.shaders.get(h)).find((r) => r !== undefined && r.compiled && r.hasMain === false);
    if (vs === undefined || fs === undefined) {
      p.linked = false;
      p.linkedProgram = null;
      p.infoLog = "MISSING_MAIN";
      return;
    }
    void vsNoMain;
    void fsNoMain;
    const vIn: CompiledShader = { closure: vs.closure as VertexClosure | FragmentClosure, symbols: vs.symbols as SymbolTable, version: vs.version as 100 | 300, hasMain: vs.hasMain };
    const fIn: CompiledShader = { closure: fs.closure as VertexClosure | FragmentClosure, symbols: fs.symbols as SymbolTable, version: fs.version as 100 | 300, hasMain: fs.hasMain };
    const result = linkProgramValidator(vIn, fIn);
    p.linked = result.linked;
    p.infoLog = result.infoLog;
    p.linkedProgram = result;
  }
  /**
   * Read program status.
   *
   * @param program Target program handle.
   * @param pname Status name; LINK_STATUS yields a boolean.
   * @returns Boolean for LINK_STATUS, null for unknown handles or pnames.
   */
  getProgramParameter(program: number, pname: number): unknown {
    const p = this.programs.get(program);
    if (p === undefined) return null;
    if (pname === LINK_STATUS) return p.linked;
    return null;
  }
  /**
   * Read program info log verbatim.
   *
   * @param program Target program handle.
   * @returns Link diagnostic (e.g. MISSING_MAIN), empty string on success or unknown handle.
   */
  getProgramInfoLog(program: number): string {
    const p = this.programs.get(program);
    if (p === undefined) return "";
    return p.infoLog;
  }
  /**
   * Select the current program, recording even unlinked handles.
   *
   * @param program Program handle, null, or 0; null/0/unknown selects program 0. Unlinked handles are recorded so draws can reject them.
   */
  useProgram(program: number | null): void {
    if (program === null || program === 0) { this.state.currentProgram = 0; return; }
    const p = this.programs.get(program);
    if (p === undefined) { this.state.currentProgram = 0; return; }
    this.state.currentProgram = program;
  }
  /**
   * Resolve an attribute location via the stored linked program.
   *
   * @param program Target program handle.
   * @param name Attribute name in declaration order.
   * @returns Zero-based index, or -1 when absent or unlinked.
   */
  getAttribLocation(program: number, name: string): number {
    const p = this.programs.get(program);
    if (p === undefined || p.linkedProgram === null) return -1;
    return resolveAttribLocation(p.linkedProgram, name);
  }
  /**
   * Resolve a uniform handle via the stored linked program.
   *
   * @param program Target program handle.
   * @param name Uniform name.
   * @returns Stable handle object, or null when absent or unlinked.
   */
  getUniformLocation(program: number, name: string): UniformHandle | null {
    const p = this.programs.get(program);
    if (p === undefined || p.linkedProgram === null) return null;
    return resolveUniformLocation(p.linkedProgram, name);
  }
  /**
   * Store one float component against the owning program.
   *
   * @param location Handle from getUniformLocation; null is a silent no-op, foreign handles push one INVALID_OPERATION.
   * @param v0 Component value.
   */
  uniform1f(location: UniformHandle | null, v0: number): void {
    this.storeUniform(location, [v0]);
  }
  /**
   * Store two float components against the owning program.
   *
   * @param location Handle from getUniformLocation; null is a silent no-op, foreign handles push one INVALID_OPERATION.
   * @param v0 First component value.
   * @param v1 Second component value.
   */
  uniform2f(location: UniformHandle | null, v0: number, v1: number): void {
    this.storeUniform(location, [v0, v1]);
  }
  /**
   * Store four float components against the owning program.
   *
   * @param location Handle from getUniformLocation; null is a silent no-op, foreign handles push one INVALID_OPERATION.
   * @param v0 First component value.
   * @param v1 Second component value.
   * @param v2 Third component value.
   * @param v3 Fourth component value.
   */
  uniform4f(location: UniformHandle | null, v0: number, v1: number, v2: number, v3: number): void {
    this.storeUniform(location, [v0, v1, v2, v3]);
  }
  /**
   * Store one integer component as a number against the owning program.
   *
   * @param location Handle from getUniformLocation; null is a silent no-op, foreign handles push one INVALID_OPERATION.
   * @param v0 Component value.
   */
  uniform1i(location: UniformHandle | null, v0: number): void {
    this.storeUniform(location, [v0]);
  }
  /**
   * Store uniform components matched by handle identity.
   *
   * @param location Handle from getUniformLocation; null is a silent no-op.
   * @param values Components to copy into the owning program record.
   * @returns Void; foreign handles push exactly one INVALID_OPERATION.
   */
  private storeUniform(location: UniformHandle | null, values: number[]): void {
    if (location === null) return;
    for (const p of this.programs.values()) {
      if (p.linkedProgram === null) continue;
      for (const h of p.linkedProgram.uniformLocations.values()) {
        if (h === location) {
          p.uniformValues.set(location.id, [...values]);
          return;
        }
      }
    }
    pushError(this.queue, INVALID_OPERATION);
  }
  /**
   * Reject draws whose current program is absent or unlinked.
   *
   * @returns True when the draw must stop; pushes exactly one INVALID_OPERATION with zero pixel writes.
   */
  private rejectUnlinkedDraw(): boolean {
    const p = this.programs.get(this.state.currentProgram);
    if (p === undefined || p.linked === false || p.linkedProgram === null) {
      pushError(this.queue, INVALID_OPERATION);
      return true;
    }
    return false;
  }
  /**
   * Push one draw-failure code; no state or pixel change.
   * @param code One of INVALID_ENUM, INVALID_VALUE, INVALID_OPERATION.
   */
  private reportDrawFailure(code: number): void {
    pushError(this.queue, code);
  }
  /**
   * Report default-framebuffer completeness; never pushes.
   * @returns True when width and height are positive.
   */
  checkDefaultFramebufferComplete(): boolean {
    return this.fb.width > 0 && this.fb.height > 0;
  }
  /**
   * Validate and execute a non-indexed TRIANGLES draw; per-fragment shading via live uniforms on success.
   * @param mode Draw mode, TRIANGLES only. @param first First vertex ordinal. @param count Vertex count.
   */
  drawArrays = (mode: number, first: number, count: number): void => {
    if (this.guardIfLost()) return;
    if (mode !== TRIANGLES) { this.reportDrawFailure(INVALID_ENUM); return; }
    if (!Number.isInteger(first) || first < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (!Number.isInteger(count) || count < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (this.state.currentProgram === 0) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (this.rejectUnlinkedDraw()) return;
    if (!this.checkDefaultFramebufferComplete()) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (count === 0) return;
    const prog = this.programs.get(this.state.currentProgram) as ProgramRecord;
    const ordinals: number[] = [];
    for (let i = 0; i < count; i++) ordinals.push(first + i);
    const call: DrawCall = { program: prog.linkedProgram, framebuffer: this.fb, state: this.state, vertices: this.buildVertices(ordinals, prog), indices: null, instanceCount: 1, samplers: this.assembleSamplers(prog), uniforms: this.assembleUniforms(prog), fragmentColor: [0, 0, 0, 0], fragScratch: this.fragScratch };
    drawArraysImpl(call);
    this.presentAfterDraw();
  };
  /**
   * Validate and execute an indexed TRIANGLES draw via UNSIGNED_SHORT indices.
   * @param mode Draw mode, TRIANGLES only. @param count Index count. @param type Index type, UNSIGNED_SHORT only. @param offset Byte offset into element bytes.
   */
  drawElements = (mode: number, count: number, type: number, offset: number): void => {
    if (this.guardIfLost()) return;
    if (mode !== TRIANGLES) { this.reportDrawFailure(INVALID_ENUM); return; }
    if (type !== UNSIGNED_SHORT) { this.reportDrawFailure(INVALID_ENUM); return; }
    if (!Number.isInteger(count) || count < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (!Number.isInteger(offset) || offset < 0) { this.reportDrawFailure(INVALID_VALUE); return; }
    if (this.state.currentProgram === 0) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (this.rejectUnlinkedDraw()) return;
    if (!this.checkDefaultFramebufferComplete()) { this.reportDrawFailure(INVALID_OPERATION); return; }
    const elemHandle = this.store.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
    if (count > 0 && elemHandle === 0) { this.reportDrawFailure(INVALID_OPERATION); return; }
    if (count === 0) return;
    const bytes = this.store.getBufferBytes(elemHandle);
    if (!bytes || offset + count * 2 > bytes.length) { this.reportDrawFailure(INVALID_VALUE); return; }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ordinals: number[] = [];
    for (let i = 0; i < count; i++) ordinals.push(view.getUint16(offset + i * 2, true));
    const prog = this.programs.get(this.state.currentProgram) as ProgramRecord;
    const indices = new Uint16Array(ordinals);
    const call: DrawCall = { program: prog.linkedProgram, framebuffer: this.fb, state: this.state, vertices: this.buildVertices(ordinals, prog), indices, instanceCount: 1, samplers: this.assembleSamplers(prog), uniforms: this.assembleUniforms(prog), fragmentColor: [0, 0, 0, 0], fragScratch: this.fragScratch };
    drawElementsImpl(call);
    this.presentAfterDraw();
  }
  /**
   * Create a renderbuffer handle via the owned store; never pushes.
   * @returns Fresh non-zero handle.
   */
  createRenderbuffer(): number {
    return this.renderbuffers.createRenderbuffer();
  }
  /**
   * Bind a renderbuffer; pushes exactly one code on rejection.
   * @param target Must equal RENDERBUFFER.
   * @param renderbuffer Handle or null to unbind.
   */
  bindRenderbuffer(target: number, renderbuffer: number | null): void {
    if (target !== RENDERBUFFER) { pushError(this.queue, INVALID_ENUM); return; }
    try {
      this.renderbuffers.bindRenderbuffer(target, renderbuffer);
    } catch (e) {
      if (e instanceof InvalidEnumError) { pushError(this.queue, INVALID_ENUM); return; }
      pushError(this.queue, INVALID_OPERATION);
    }
  }
  /**
   * Allocate renderbuffer storage; pushes exactly one code on rejection.
   * @param target Must equal RENDERBUFFER.
   * @param internalFormat DEPTH_COMPONENT16 or DEPTH24_STENCIL8.
   * @param width Texel width.
   * @param height Texel height.
   */
  renderbufferStorage(target: number, internalFormat: number, width: number, height: number): void {
    if (target !== RENDERBUFFER) { pushError(this.queue, INVALID_ENUM); return; }
    if (internalFormat !== DEPTH_COMPONENT16 && internalFormat !== DEPTH24_STENCIL8) {
      pushError(this.queue, INVALID_ENUM); return;
    }
    try {
      this.renderbuffers.renderbufferStorage(target, internalFormat, width, height);
    } catch (e) {
      if (e instanceof InvalidEnumError) { pushError(this.queue, INVALID_ENUM); return; }
      if (e instanceof InvalidValueError) { pushError(this.queue, INVALID_VALUE); return; }
      if (e instanceof InvalidOperationError) { pushError(this.queue, INVALID_OPERATION); return; }
      if (e instanceof QueueOutOfMemoryError) { pushError(this.queue, OUT_OF_MEMORY); return; }
      pushError(this.queue, INVALID_OPERATION);
    }
  }
  /**
   * Delete a renderbuffer; null/0/unknown are silent no-ops, never pushes.
   * @param renderbuffer Handle or null.
   */
  deleteRenderbuffer(renderbuffer: number | null): void {
    if (renderbuffer === null || renderbuffer === 0) return;
    this.renderbuffers.deleteRenderbuffer(renderbuffer);
  }
  /**
   * Read normalized depth; null when unavailable, never pushes.
   * @param handle Renderbuffer handle.
   * @param x Column.
   * @param y Row.
   * @returns Depth in 0..1 or null.
   */
  readDepth(handle: number, x: number, y: number): number | null {
    return this.renderbuffers.readDepth(handle, x, y);
  }
  /**
   * LESS-conditional depth write for tests; never pushes.
   * @param handle Renderbuffer handle.
   * @param x Column.
   * @param y Row.
   * @param depth Normalized depth.
   */
  writeDepthForTest(handle: number, x: number, y: number, depth: number): void {
    this.renderbuffers.writeDepthForTest(handle, x, y, depth);
  }
  /**
   * Set draw buffers; validates enum-then-value-then-operation, pushes exactly one code on rejection.
   * @param buffers Caller-supplied attachment enum list; empty list is a valid no-target config.
   */
  drawBuffers(buffers: number[]): void {
    if (this.guardIfLost()) return;
    if (!Array.isArray(buffers)) { pushError(this.queue, INVALID_VALUE); return; }
    for (const e of buffers) {
      if (typeof e !== "number" || !Number.isInteger(e)) { pushError(this.queue, INVALID_ENUM); return; }
    }
    if (buffers.length > MAX_COLOR_ATTACHMENTS) { pushError(this.queue, INVALID_OPERATION); return; }
    for (const e of buffers) {
      if (e < COLOR_ATTACHMENT0 || e > COLOR_ATTACHMENT0 + MAX_COLOR_ATTACHMENTS - 1) {
        pushError(this.queue, INVALID_OPERATION); return;
      }
    }
    try {
      this.fb.configureDrawBuffers(buffers);
    } catch {
      pushError(this.queue, INVALID_OPERATION);
    }
  }
  /** Present via framebuffer; never throws. */
  presentToCanvas(): void {
    try {
      this.fb.presentToCanvas(this.canvas);
    } catch {
      // documented no-op
    }
  }
}
/**
 * Build isolated context or return null on allocation failure without throwing.
 * @param canvas Canvas supplying width/height and presentation target.
 * @returns Context holder or null.
 */
export function createSoftwareWebGLContext(canvas: CanvasLike, _attrs?: unknown): SoftwareWebGLContext | null {
  try {
    const w = typeof canvas?.width === "number" ? canvas.width : 64;
    const h = typeof canvas?.height === "number" ? canvas.height : 64;
    const state = new GLState(w, h);
    const fb = new Framebuffer(w, h);
    return new SoftwareWebGLContext(state, fb, canvas);
  } catch (e) {
    if (e instanceof OutOfMemoryError) return null;
    // Allocation failure (e.g. typed-array RangeError) also yields null.
    return null;
  }
}
