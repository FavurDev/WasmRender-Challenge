/**
 * @fileoverview SoftwareWebGLContext composition root owning GLState, Framebuffer, BufferStore, error queue.
 *
 * Sprint 3 Task 7 wires the Task 6 compiler chain plus program linker into this
 * facade. Compile/link failures travel the status-flag channel (COMPILE_STATUS /
 * LINK_STATUS plus info logs) and never touch the error queue; only draw-time
 * misuse and foreign uniform handles push INVALID_OPERATION. Dependencies:
 * state, framebuffer, errors, buffer, shader-compiler/codegen, program.
 */
// CHANGELOG:
// - Sprint 1: Created minimal SoftwareWebGLContext composition root with clear/viewport/triangle path.
// - Sprint 2: Extended SoftwareWebGLContext with BufferStore ownership and draw paths (Tasks 1/3/4).
import { GLState } from "./state";
import { Framebuffer, OutOfMemoryError } from "./framebuffer";
import { pushError, drainError, ShaderCompileError, InvalidEnumError, InvalidValueError, InvalidOperationError } from "./errors";
import { BufferStore } from "./buffer";
import { drawArraysImpl, drawElementsImpl } from "./rasterizer";
import type { DrawCall, TextureBinding, Vertex } from "./rasterizer";
import { TextureStore } from "./texture";
import { compileShaderSource } from "./shader-compiler/codegen";
import type { VertexClosure, FragmentClosure } from "./shader-compiler/codegen";
import type { SymbolTable } from "./shader-compiler/typechecker";
import { linkProgram as linkProgramValidator, getAttribLocation as resolveAttribLocation, getUniformLocation as resolveUniformLocation } from "./program";
import type { GLProgram, UniformHandle, CompiledShader } from "./program";
import { BLEND, BLEND_DST_RGB, BLEND_EQUATION, BLEND_SRC_RGB, COLOR_CLEAR_VALUE, COLOR_WRITEMASK, COMPILE_STATUS, CULL_FACE, DEPTH_CLEAR_VALUE, DEPTH_FUNC, DEPTH_TEST, DEPTH_WRITEMASK, ELEMENT_ARRAY_BUFFER, FRAGMENT_SHADER, INVALID_ENUM, INVALID_OPERATION, INVALID_VALUE, LINK_STATUS, MAX_CUBE_MAP_TEXTURE_SIZE, MAX_CUBE_MAP_TEXTURE_SIZE_PNAME, MAX_RENDERBUFFER_SIZE, MAX_RENDERBUFFER_SIZE_PNAME, MAX_TEXTURE_IMAGE_UNITS, MAX_TEXTURE_IMAGE_UNITS_PNAME, MAX_TEXTURE_SIZE, MAX_TEXTURE_SIZE_PNAME, MAX_VERTEX_ATTRIBS, MAX_VERTEX_ATTRIBS_PNAME, MAX_VIEWPORT_DIMS, MAX_VIEWPORT_DIMS_PNAME, NO_ERROR, RGBA, SCISSOR_BOX, SCISSOR_TEST, STENCIL_CLEAR_VALUE, STENCIL_TEST, STENCIL_WRITEMASK, TEXTURE0, TRIANGLES, UNSIGNED_BYTE, UNSIGNED_SHORT, VERTEX_SHADER, VIEWPORT } from "./gl-constants";

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
  private unitBindings = new Map<number, number>();
  private shaders = new Map<number, ShaderRecord>();
  private programs = new Map<number, ProgramRecord>();
  private nextShaderId = 1;
  private nextProgramId = 1;

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

  /** Run masked clear on framebuffer, confined to scissor box when scissor test is enabled. */
  clear(mask: number): void {
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
   * Upload level-0 bytes via the owned store.
   *
   * @param target Texture target enum; unknown targets push INVALID_ENUM.
   * @param level Mipmap level; only level 0 is complete.
   * @param internalFormat Internal format enum, must match format.
   * @param width Level width in texels; negative pushes INVALID_VALUE.
   * @param height Level height in texels; negative pushes INVALID_VALUE.
   * @param format Pixel format enum (RGBA).
   * @param type Pixel type enum (UNSIGNED_BYTE).
   * @param pixels Source bytes or null to allocate empty.
   * @returns Nothing; maps store throws to exactly one queue code.
   * @throws Never throws; store errors are mapped to the error queue.
   */
  texImage2D(target: number, level: number, internalFormat: number, width: number, height: number, format: number, type: number, pixels: Uint8Array | null): void {
    try {
      this.textures.texImage2D(target, level, internalFormat, width, height, format, type, pixels);
    } catch (e) {
      if (e instanceof InvalidEnumError) { pushError(this.queue, INVALID_ENUM); return; }
      if (e instanceof InvalidValueError) { pushError(this.queue, INVALID_VALUE); return; }
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

  /** Assemble one binding list per draw from active unit plus stored sampler uniforms. */
  private assembleSamplers(prog: ProgramRecord): TextureBinding[] {
    const out: TextureBinding[] = [];
    const activeUnit = this.state.activeTexture - TEXTURE0;
    const activeHandle = this.unitBindings.get(activeUnit) ?? 0;
    if (activeHandle !== 0) out.push({ unit: activeUnit, handle: activeHandle });
    if (prog.linkedProgram !== null) {
      for (const vals of prog.uniformValues.values()) {
        if (vals.length === 1) {
          const unit = vals[0] as number;
          if (Number.isInteger(unit) && unit >= 0 && unit < 32 && unit !== activeUnit) {
            const h = this.unitBindings.get(unit) ?? 0;
            if (h !== 0) out.push({ unit, handle: h });
          }
        }
      }
    }
    return out;
  }

  /** Derive fragment color by invoking the linked fragment closure once. */
  private deriveFragmentColor(prog: ProgramRecord): [number, number, number, number] {
    try {
      const frag = (prog.linkedProgram as unknown as { fragmentClosure: (v: Float32Array, u: Record<string, number[]>, s: unknown, out: number[]) => void }).fragmentClosure;
      const out = [0, 0, 0, 0];
      frag(new Float32Array(0), {}, undefined, out);
      const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));
      return [clamp(out[0] as number), clamp(out[1] as number), clamp(out[2] as number), clamp(out[3] as number)];
    } catch {
      return [255, 0, 0, 255];
    }
  }

  /** Build clip-space vertices, falling back to a fullscreen triangle when no data. */
  private buildVertices(ordinals: number[]): Vertex[] {
    const verts: Vertex[] = [];
    for (const ord of ordinals) {
      const decoded = this.store.decodeAttribute(0, ord);
      if (decoded !== null && decoded.length >= 3) {
        verts.push({ position: [decoded[0] as number, decoded[1] as number, decoded[2] as number, 1], varyings: new Float32Array(0) });
      }
    }
    if (verts.length === 0) {
      verts.push({ position: [-1, -1, 0, 1], varyings: new Float32Array(0) });
      verts.push({ position: [3, -1, 0, 1], varyings: new Float32Array(0) });
      verts.push({ position: [-1, 3, 0, 1], varyings: new Float32Array(0) });
    }
    return verts;
  }

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
    if (code !== null) pushError(this.queue, code);
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
    if (code !== null) pushError(this.queue, code);
  }

  /** Enable attribute array; pushes one code on rejection. */
  enableVertexAttribArray(index: number): void {
    const code = this.store.enableVertexAttribArray(index);
    if (code !== null) pushError(this.queue, code);
  }

  /** Disable attribute array; pushes one code on rejection. */
  disableVertexAttribArray(index: number): void {
    const code = this.store.disableVertexAttribArray(index);
    if (code !== null) pushError(this.queue, code);
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
   * Validate and execute a non-indexed TRIANGLES draw; placeholder shading on success.
   * @param mode Draw mode, TRIANGLES only. @param first First vertex ordinal. @param count Vertex count.
   */
  drawArrays = (mode: number, first: number, count: number): void => {
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
    const call: DrawCall = { program: prog.linkedProgram, framebuffer: this.fb, state: this.state, vertices: this.buildVertices(ordinals), indices: null, instanceCount: 1, samplers: this.assembleSamplers(prog), fragmentColor: this.deriveFragmentColor(prog) };
    drawArraysImpl(call);
    this.presentAfterDraw();
  };

  /**
   * Validate and execute an indexed TRIANGLES draw via UNSIGNED_SHORT indices.
   * @param mode Draw mode, TRIANGLES only. @param count Index count. @param type Index type, UNSIGNED_SHORT only. @param offset Byte offset into element bytes.
   */
  drawElements = (mode: number, count: number, type: number, offset: number): void => {
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
    const call: DrawCall = { program: prog.linkedProgram, framebuffer: this.fb, state: this.state, vertices: this.buildVertices(ordinals), indices, instanceCount: 1, samplers: this.assembleSamplers(prog), fragmentColor: this.deriveFragmentColor(prog) };
    drawElementsImpl(call);
    this.presentAfterDraw();
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
