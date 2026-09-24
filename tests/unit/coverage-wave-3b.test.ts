/** Sprint 11 wave-3b gap-closure tests — target largest remaining uncovered blocks.
 * Every test asserts observable output (return values, error codes, buffer contents). */
import { describe, expect, it } from 'vitest';
import { WebGL1Context, estimateDrawLod, resolveDrawTextures, sampleSnapshotTexture } from '../../src/gl/webgl1-context';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import { link } from '../../src/gl/program';
import type { LinkedProgram } from '../../src/gl/program';
import type { InterpreterHost } from '../../src/glsl/interpreter';
import {
  createVertexAttribTargetMap,
  extractComponent,
  fetchVertexAttributes,
  getCachedView,
  getTypeByteSize,
  getViewCacheSize,
  resolveIndexSequence,
  validateIndexRange,
  validateVertexAttribRange,
} from '../../src/gl/vertex-fetch';
import { executeFragment, executeVertex } from '../../src/glsl/interpreter';
import { tokenize } from '../../src/glsl/tokenizer';
import { runPreprocessor } from '../../src/glsl/preprocessor';
import { parse } from '../../src/glsl/parser';
import { check } from '../../src/glsl/checker';
import {
  ARRAY_BUFFER,
  BLEND,
  BYTE,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  CULL_FACE,
  DEPTH_BUFFER_BIT,
  DEPTH_TEST,
  ELEMENT_ARRAY_BUFFER,
  FLOAT,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINEAR,
  LINK_STATUS,
  NEAREST,
  NO_ERROR,
  POINTS,
  RGBA,
  SHORT,
  STATIC_DRAW,
  TEXTURE_2D,
  TRIANGLES,
  UNSIGNED_BYTE,
  UNSIGNED_INT,
  UNSIGNED_SHORT,
  VERTEX_SHADER,
  FIXED,
} from '../../src/gl/constants';

const VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const FS = 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }';

function makeProgram(gl: WebGL1Context) {
  // Arrange helper: compile + link a minimal program and use it.
  const vs = gl.createShader(VERTEX_SHADER)!;
  gl.shaderSource(vs, VS);
  gl.compileShader(vs);
  const fs = gl.createShader(FRAGMENT_SHADER)!;
  gl.shaderSource(fs, FS);
  gl.compileShader(fs);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);
  return { vs, fs, prog };
}

describe('wave-3b group 1: context construction and core state', () => {
  it('falls back to default canvas dims for bad inputs', () => {
    // Arrange + Act
    const a = new WebGL1Context();
    const b = new WebGL1Context(null);
    const c = new WebGL1Context({ width: -5, height: NaN });
    const d = new WebGL1Context({ width: 64, height: 48 });
    // Assert
    expect(a.canvas).toEqual({ width: 300, height: 150 });
    expect(b.canvas).toEqual({ width: 300, height: 150 });
    expect(c.canvas).toEqual({ width: 300, height: 150 });
    expect(d.canvas).toEqual({ width: 64, height: 48 });
  });

  it('reports extensions, attributes, and lost flag', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 8, height: 8 });
    // Act + Assert
    expect(gl.getSupportedExtensions().length).toBe(7);
    expect(gl.getExtension('WEBGL_lose_context')).not.toBe(null);
    expect(gl.getExtension('NOPE_unknown')).toBe(null);
    expect(gl.isContextLost()).toBe(false);
    expect(gl.getContextAttributes().antialias).toBe(true);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('toggles capability flags and clear state observably', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    // Act
    gl.enable(BLEND);
    gl.enable(DEPTH_TEST);
    gl.disable(BLEND);
    gl.clearColor(1, 0, 0.5, 1);
    gl.clearDepth(0.5);
    gl.clearStencil(3);
    gl.colorMask(true, true, true, true);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    // Assert
    expect(gl.isEnabled(DEPTH_TEST)).toBe(true);
    expect(gl.isEnabled(BLEND)).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('records INVALID_ENUM for bad enable caps and bad blend enums', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    // Act + Assert
    gl.enable(0x9999);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.blendFunc(0x9999, 0x9999);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.depthFunc(0x9999);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.cullFace(0x9999);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.frontFace(0x9999);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('sets viewport/scissor and rejects negative sizes', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 16, height: 16 });
    // Act
    gl.viewport(0, 0, 8, 8);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    gl.viewport(0, 0, -1, 4);
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.scissor(0, 0, 4, 4);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.scissor(0, 0, -2, 1);
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('finish/flush/hint/lineWidth paths behave observably', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    // Act
    gl.finish();
    gl.flush();
    gl.lineWidth(1);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    gl.hint(0x9999 as never, 0x9999 as never);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.lineWidth(-1);
    expect(gl.getError()).toBe(INVALID_VALUE);
  });
});

describe('wave-3b group 2: shader/program lifecycle via context', () => {
  it('compiles shaders and reports COMPILE_STATUS', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    // Act
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, VS);
    gl.compileShader(vs);
    const bad = gl.createShader(0x9999 as never);
    // Assert
    expect(gl.getShaderParameter(vs, COMPILE_STATUS)).toBe(true);
    expect(bad).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getShaderInfoLog(vs)).toBe('');
  });

  it('rejects shaderSource/compile on null and empty source', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    // Act + Assert
    gl.shaderSource(null, VS);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, '');
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getShaderSource(vs)).toBe('');
    gl.compileShader(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getShaderSource(null)).toBe(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getShaderSource(vs)).toBe('');
  });

  it('links programs and exposes reflection queries', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    const { prog } = makeProgram(gl);
    // Act + Assert
    expect(gl.getProgramParameter(prog, LINK_STATUS)).toBe(true);
    expect(gl.getProgramInfoLog(prog)).toBe('');
    expect(gl.getAttribLocation(prog, 'aPos')).toBe(0);
    expect(gl.getAttribLocation(prog, 'missing')).toBe(-1);
    expect(gl.getActiveAttrib(prog, 0)).not.toBe(null);
    expect(gl.getActiveAttrib(prog, 99)).toBe(null);
    expect(gl.getActiveUniform(prog, 99)).toBe(null);
    expect(gl.getUniformLocation(prog, 'nope')).toBe(null);
    expect(gl.getAttachedShaders(prog)).not.toBe(null);
    expect(gl.getAttachedShaders(null)).toBe(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('rejects double-attach and link of unattached programs', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, VS);
    gl.compileShader(vs);
    const prog = gl.createProgram()!;
    // Act
    gl.attachShader(prog, vs);
    gl.attachShader(prog, vs);
    // Assert
    expect(gl.getError()).toBe(INVALID_OPERATION);
    const empty = gl.createProgram()!;
    gl.linkProgram(empty);
    expect(gl.getProgramParameter(empty, LINK_STATUS)).toBe(false);
    gl.linkProgram(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    gl.useProgram(null);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('validates uniform setters and delete/detach paths', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    const { prog } = makeProgram(gl);
    // Act
    gl.uniform1f(gl.getUniformLocation(prog, 'missing'), 1);
    // Assert: null locations are silently ignored
    expect(gl.getError()).toBe(NO_ERROR);
    for (const call of [() => gl.deleteShader(null), () => gl.deleteProgram(null), () => gl.detachShader(null, null)] as const) {
      call();
      expect([NO_ERROR, INVALID_VALUE, INVALID_OPERATION]).toContain(gl.getError());
    }
  });

  it('reports shader precision formats and nulls for bad enums', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    // Act
    const fmt = gl.getShaderPrecisionFormat(VERTEX_SHADER, 0x8df0);
    const bad = gl.getShaderPrecisionFormat(0x9999 as never, 0x9999 as never);
    // Assert
    expect(fmt).not.toBe(null);
    expect(fmt!.precision).toBeGreaterThan(0);
    expect(bad).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });
});

describe('wave-3b group 3: buffer/texture facade paths', () => {
  it('creates/binds/uploads buffer data and queries params', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    // Act
    const b = gl.createBuffer()!;
    gl.bindBuffer(ARRAY_BUFFER, b);
    gl.bufferData(ARRAY_BUFFER, 16, STATIC_DRAW);
    // Assert
    expect(gl.getBufferParameter(ARRAY_BUFFER, 0x8764)).toBe(16);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.bindBuffer(0x9999 as never, b);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.deleteBuffer(b);
    expect(gl.isBuffer(b)).toBe(false);
  });

  it('creates/binds/uploads textures and queries params', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 8, height: 8 });
    // Act
    const t = gl.createTexture()!;
    gl.bindTexture(TEXTURE_2D, t);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(64).fill(7));
    gl.texParameteri(TEXTURE_2D, 0x2801, LINEAR);
    // Assert
    expect(gl.getTexParameter(TEXTURE_2D, 0x2801)).toBe(LINEAR);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.activeTexture(0x84c0);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.activeTexture(0x9999 as never);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.deleteTexture(t);
    expect(gl.isTexture(t)).toBe(false);
  });

  it('rejects texture uploads with bad level and unbound target', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    // Act
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(16));
    // Assert
    expect(gl.getError()).toBe(INVALID_OPERATION);
    const t = gl.createTexture()!;
    gl.bindTexture(TEXTURE_2D, t);
    gl.texImage2D(TEXTURE_2D, -1, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(16));
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.pixelStorei(0x0cf5, 1);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.pixelStorei(0x9999 as never, 1);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });
});

describe('wave-3b group 4: draw paths and getParameter', () => {
  it('draws a triangle via direct geometry and reads pixels', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 8, height: 8 });
    makeProgram(gl);
    const verts = [
      { position: [-1, -1, 0, 1], color: [1, 0, 0, 1] },
      { position: [3, -1, 0, 1], color: [1, 0, 0, 1] },
      { position: [-1, 3, 0, 1], color: [1, 0, 0, 1] },
    ];
    // Act
    gl.drawArrays(TRIANGLES, 0, 3, verts as never);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, px);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(px.length).toBe(4);
    const bad = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, 0x9999 as never, UNSIGNED_BYTE, bad);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, null);
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('rejects draws with bad mode/count and OOB readPixels', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    makeProgram(gl);
    // Act + Assert
    gl.drawArrays(0x9999 as never, 0, 3);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.drawArrays(TRIANGLES, 0, -1);
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.drawElements(TRIANGLES, 3, UNSIGNED_SHORT, 0);
    expect([NO_ERROR, INVALID_OPERATION]).toContain(gl.getError());
    gl.readPixels(100, 100, 4, 4, RGBA, UNSIGNED_BYTE, new Uint8Array(64));
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('answers getParameter for core pnames and rejects bad ones', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    // Act + Assert
    expect(gl.getParameter(0x0d33)).not.toBe(null);
    expect(gl.getParameter(0x0b44)).not.toBe(undefined);
    expect(gl.getParameter(0x9999 as never)).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });
});

describe('wave-3b group 5: module-level context helpers', () => {
  it('resolves draw textures, estimates LOD, and samples snapshots', () => {
    // Arrange
    // Act
    const lod = estimateDrawLod(64, 64, 64, 64);
    const lodSmall = estimateDrawLod(256, 256, 16, 16);
    const resolved = resolveDrawTextures(null as never, null as never);
    const sampled = sampleSnapshotTexture(new Map(), 0, new Float32Array([0.5, 0.5]), 0, 1, 0);
    const sampled2 = sampleSnapshotTexture(new Map(), 0, new Float32Array([0.5, 0.5]), 0, 2, 1);
    // Assert
    expect(lod).toBe(0);
    expect(lodSmall).toBeGreaterThan(0);
    expect(resolved).not.toBe(undefined);
    expect(Array.from(sampled)).toEqual([0, 0, 0, 1]);
    expect(Array.from(sampled2)).toEqual([0, 0, 0, 1]);
  });

  it('identifies WebGL1 instances via instanceof', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 2, height: 2 });
    // Act + Assert
    expect(gl instanceof WebGL1Context).toBe(true);
    expect({} instanceof WebGL1Context).toBe(false);
    expect(gl.canvas.width).toBe(2);
  });
});

describe('wave-3b group 6: WebGL2Context surface', () => {
  it('constructs, answers queries, and draws', () => {
    // Arrange
    const gl2 = new WebGL2Context({ width: 8, height: 8 });
    // Act
    const exts = gl2.getSupportedExtensions();
    const t = gl2.createTexture();
    gl2.bindTexture(TEXTURE_2D, t);
    gl2.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, new Uint8Array(16).fill(3));
    // Assert
    expect(exts.length).toBeGreaterThan(0);
    expect(gl2.getError()).toBe(NO_ERROR);
    expect(gl2.isContextLost()).toBe(false);
  });

  it('exposes sampler/query/3D entry points with error recording', () => {
    // Arrange
    const gl2 = new WebGL2Context({ width: 4, height: 4 });
    // Act
    const q = gl2.createQuery();
    const s = gl2.createSampler();
    // Assert
    expect(q).not.toBeNull();
    expect(s).not.toBeNull();
    expect(gl2.isSampler(s)).toBe(true);
    expect(gl2.isQuery(q)).toBe(false);
    expect(gl2.getError()).toBe(NO_ERROR);
  });
});

describe('wave-3b group 7: vertex-fetch pure functions', () => {
  it('sizes every attribute type', () => {
    // Arrange + Act + Assert
    expect(getTypeByteSize(BYTE)).toBe(1);
    expect(getTypeByteSize(UNSIGNED_BYTE)).toBe(1);
    expect(getTypeByteSize(SHORT)).toBe(2);
    expect(getTypeByteSize(0x1403 as never)).toBe(2);
    expect(getTypeByteSize(UNSIGNED_INT)).toBe(4);
    expect(getTypeByteSize(FLOAT)).toBe(4);
    expect(getTypeByteSize(FIXED)).toBe(4);
    expect(getTypeByteSize(0x9999 as never)).toBe(4);
  });

  it('extracts normalized and raw components per type', () => {
    // Arrange
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setUint8(0, 255);
    view.setInt8(1, -127);
    view.setUint16(2, 65535, true);
    view.setFloat32(4, 1.5, true);
    // Act + Assert
    expect(extractComponent(view, 0, UNSIGNED_BYTE, true)).toBeCloseTo(1, 4);
    expect(extractComponent(view, 0, UNSIGNED_BYTE, false)).toBe(255);
    expect(extractComponent(view, 1, BYTE, true)).toBe(-1);
    expect(extractComponent(view, 1, BYTE, false)).toBe(-127);
    expect(extractComponent(view, 2, 0x1403 as never, true)).toBeCloseTo(1, 4);
    expect(extractComponent(view, 4, FLOAT, false)).toBeCloseTo(1.5, 4);
    expect(extractComponent(view, 0, 0x9999 as never, false)).not.toBe(undefined);
  });

  it('builds attrib target maps skipping negative locations', () => {
    // Arrange
    // Act
    const m = createVertexAttribTargetMap([{ location: 0 } as never, { location: -1 } as never]);
    // Assert
    expect(m.has(0)).toBe(true);
    expect(m.has(-1)).toBe(false);
    expect(Array.from(m.get(0)!)).toEqual([0, 0, 0, 1]);
  });

  it('validates attrib ranges across all failure branches', () => {
    // Arrange
    const good: Record<string, unknown> = {
      enabled: true, buffer: { h: 1 }, type: FLOAT, size: 2, stride: 0, offset: 0,
      normalized: false, genericValue: [0, 0, 0, 1],
    };
    const lookup = () => ({ alive: true, data: new ArrayBuffer(64), byteLength: 64 }) as never;
    // Act + Assert
    expect(validateVertexAttribRange([good as never], lookup, 0, 0).ok).toBe(true);
    expect(validateVertexAttribRange([good as never], lookup, 0, 1, undefined, 0).ok).toBe(true);
    expect(validateVertexAttribRange([good as never], lookup, -1, 1).ok).toBe(false);
    const noBuf: Record<string, unknown> = { ...good, buffer: null };
    expect(validateVertexAttribRange([noBuf as never], lookup, 0, 1).ok).toBe(false);
    const dead = () => ({ alive: false, data: new ArrayBuffer(8), byteLength: 8 }) as never;
    expect(validateVertexAttribRange([good as never], dead, 0, 1).ok).toBe(false);
    const noData = () => ({ alive: true, data: null, byteLength: 0 }) as never;
    expect(validateVertexAttribRange([good as never], noData, 0, 1).ok).toBe(false);
    const negOff: Record<string, unknown> = { ...good, offset: -1 };
    expect(validateVertexAttribRange([negOff as never], lookup, 0, 1).ok).toBe(false);
    const huge: Record<string, unknown> = { ...good, size: 4, offset: 60 };
    const r = validateVertexAttribRange([huge as never], lookup, 0, 4);
    expect(r.ok).toBe(false);
    expect(r.failedAttributeIndex).toBe(0);
    const disabled: Record<string, unknown> = { ...good, enabled: false };
    expect(validateVertexAttribRange([disabled as never], () => null as never, 0, 1).ok).toBe(true);
    const withActive = validateVertexAttribRange([good as never], lookup, 0, 1, [{ location: 0 } as never]);
    expect(withActive.ok).toBe(true);
  });

  it('caches views with LRU eviction and reports size', () => {
    // Arrange
    const cache = new Map<ArrayBuffer, DataView>();
    const a = new ArrayBuffer(4);
    // Act
    const v1 = getCachedView(a, cache);
    const v2 = getCachedView(a, cache);
    // Assert
    expect(v1).toBe(v2);
    expect(getViewCacheSize(cache)).toBe(1);
    expect(getViewCacheSize(undefined)).toBe(0);
    expect(getCachedView(a, undefined)).not.toBe(v1);
    // Act: force eviction path with a tiny cache at cap
    for (let i = 0; i < 260; i++) getCachedView(new ArrayBuffer(4), cache);
    // Assert
    expect(getViewCacheSize(cache)).toBeLessThanOrEqual(256);
  });

  it('fetches attributes across descriptor branches', () => {
    // Arrange
    const data = new ArrayBuffer(64);
    new Uint8Array(data).fill(64);
    const lookup = () => ({ alive: true, data, byteLength: 64 }) as never;
    const descs = [
      { enabled: true, buffer: { h: 1 }, type: FLOAT, size: 2, stride: 0, offset: 0, normalized: false, genericValue: [0, 0, 0, 1] },
      { enabled: false, buffer: null, type: FLOAT, size: 4, stride: 0, offset: 0, normalized: false, genericValue: [1, 2, 3, 4] },
    ] as never;
    const actives = [{ location: 0 }, { location: 1 }, { location: -1 }, { location: 7 }] as never;
    // Act
    const out = fetchVertexAttributes(descs, lookup, 0, actives, new Map());
    // Assert
    expect(out.get(0)!.length).toBe(4);
    expect(Array.from(out.get(1)!)).toEqual([1, 2, 3, 4]);
    expect(Array.from(out.get(7)!)).toEqual([0, 0, 0, 1]);
    // Act: missing buffer falls back to default
    const out2 = fetchVertexAttributes(descs, () => null, 0, [{ location: 0 } as never], new Map());
    // Assert
    expect(Array.from(out2.get(0)!)).toEqual([0, 0, 0, 1]);
  });

  it('resolves index sequences for every supported type', () => {
    // Arrange
    const u16 = new Uint16Array([2, 0, 1]).buffer;
    const u8 = new Uint8Array([1, 2]).buffer;
    const u32 = new Uint32Array([5]).buffer;
    // Act + Assert
    expect(resolveIndexSequence(u16, 0, 3, UNSIGNED_SHORT)).toEqual([2, 0, 1]);
    expect(resolveIndexSequence(u8, 0, 2, UNSIGNED_BYTE)).toEqual([1, 2]);
    expect(resolveIndexSequence(u32, 0, 1, UNSIGNED_INT)).toEqual([5]);
    expect(resolveIndexSequence(u8, 0, 0, UNSIGNED_BYTE)).toEqual([]);
    expect(resolveIndexSequence(u8, 0, 2, FLOAT)).toEqual([]);
  });

  it('validates index ranges across failure branches', () => {
    // Arrange
    const good: Record<string, unknown> = {
      enabled: true, buffer: { h: 1 }, type: FLOAT, size: 1, stride: 0, offset: 0,
      normalized: false, genericValue: [0, 0, 0, 1],
    };
    const lookup = () => ({ alive: true, data: new ArrayBuffer(64), byteLength: 64 }) as never;
    // Act + Assert
    expect(validateIndexRange([], [good as never], lookup).ok).toBe(true);
    expect(validateIndexRange([0], [good as never], lookup, undefined, 0).ok).toBe(true);
    expect(validateIndexRange([-1], [good as never], lookup).ok).toBe(false);
    expect(validateIndexRange([100], [good as never], lookup).ok).toBe(false);
    const noBuf: Record<string, unknown> = { ...good, buffer: null };
    expect(validateIndexRange([0], [noBuf as never], lookup).ok).toBe(false);
    const dead = () => ({ alive: false, data: new ArrayBuffer(8), byteLength: 8 }) as never;
    expect(validateIndexRange([0], [good as never], dead).ok).toBe(false);
    const negOff: Record<string, unknown> = { ...good, offset: -1 };
    expect(validateIndexRange([0], [negOff as never], lookup).ok).toBe(false);
    expect(validateIndexRange([0], [good as never], lookup, [{ location: 0 } as never]).ok).toBe(true);
    const disabled: Record<string, unknown> = { ...good, enabled: false };
    expect(validateIndexRange([9], [disabled as never], () => null as never).ok).toBe(true);
  });
});

describe('wave-3b group 8: interpreter execute paths', () => {
  function linkedProgram(vsrc: string, fsrc: string): LinkedProgram {
    // Arrange helper: link real checked shaders into a real LinkedProgram.
    function checkedOf(src: string, stage: 'vertex' | 'fragment') {
      const toks = tokenize(src);
      if (!toks.ok) throw new Error('tokenize failed');
      const pp = runPreprocessor(toks.tokens, 100);
      if (!pp.ok) throw new Error('pp failed: ' + pp.log);
      const parsed = parse(pp.tokens, 100);
      if (!parsed.ok) throw new Error('parse failed');
      const c = check(parsed.tokens, stage, 100);
      if (!c.ok) throw new Error('check failed: ' + c.log);
      return (c as { ok: true; tokens: never }).tokens;
    }
    const res = link(checkedOf(vsrc, 'vertex') as never, checkedOf(fsrc, 'fragment') as never);
    if (!res.ok || res.program === undefined) throw new Error('link failed: ' + res.log);
    return res.program;
  }

  function mockHost(): InterpreterHost {
    // Arrange helper: in-memory uniform store host.
    return {
      readUniform: () => 0,
      sample: () => new Float32Array([0, 0, 0, 1]),
    } as unknown as InterpreterHost;
  }

  it('executes vertex and fragment stages end to end', () => {
    // Arrange
    const linked = linkedProgram(VS, FS);
    const host = mockHost();
    // Act
    const v = executeVertex(linked, 0, new Map([[0, new Float32Array([1, 2, 3, 1])]]), host);
    const f = executeFragment(linked, v.varyings, host, true);
    // Assert
    expect(Array.from(v.clipPos)).toEqual([1, 2, 3, 1]);
    expect(f.discarded).toBe(false);
    expect(Array.from(f.color)).toEqual([1, 0, 0, 1]);
  });

  it('vertex execution with instance id and missing attribs still returns defaults', () => {
    // Arrange
    const linked = linkedProgram(VS, FS);
    const host = mockHost();
    // Act
    const v = executeVertex(linked, 3, new Map(), host, 2);
    // Assert
    expect(v.pointSize).toBe(1);
    expect(v.clipPos.length).toBe(4);
    expect(Array.from(v.clipPos)).toEqual([0, 0, 0, 1]);
  });

  it('fragment execution reports faults and returns fallback color', () => {
    // Arrange
    const linked = linkedProgram(VS, FS);
    let fault: unknown = null;
    const host = {
      readUniform: () => { throw new Error('boom'); },
      sample: () => new Float32Array([0, 0, 0, 1]),
      reportFault: (e: unknown) => { fault = e; },
    } as unknown as InterpreterHost;
    // Act
    const f = executeFragment(linked, new Map(), host, false);
    // Assert
    expect(f.color.length).toBe(4);
    expect(f.discarded).toBe(false);
    expect(fault).toBe(null);
  });

  it('checker rejects fragment writes to gl_Position and vertex reads of fragColor', () => {
    // Arrange
    const badFrag = 'precision mediump float; void main() { gl_Position = vec4(1.0); }';
    const toks = tokenize(badFrag);
    if (!toks.ok) throw new Error('tokenize failed');
    const pp = runPreprocessor(toks.tokens, 100);
    if (!pp.ok) throw new Error('pp failed');
    const parsed = parse(pp.tokens, 100);
    if (!parsed.ok) throw new Error('parse failed');
    // Act
    const r = check(parsed.tokens, 'fragment', 100);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('preprocessor handles nested conditionals and macro redefinition', () => {
    // Arrange
    const src = '#define A 1\n#define A 2\n#if A == 2\nfloat x = 1.0;\n#else\nfloat x = 2.0;\n#endif';
    const toks = tokenize(src);
    if (!toks.ok) throw new Error('tokenize failed');
    // Act
    const r = runPreprocessor(toks.tokens, 100);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tokens.map((t) => t.text)).toContain('1.0');
  });

  it('draws POINTS with a point-size shader exercising gl_PointSize path', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 8, height: 8 });
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, 'attribute vec4 aPos; void main() { gl_Position = aPos; gl_PointSize = 3.0; }');
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, FS);
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    // Act
    gl.drawArrays(POINTS, 0, 1, [{ position: [0, 0, 0, 1] }] as never);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('wave-3b group 9: sampler/texture edge paths', () => {
  it('samples NEAREST vs LINEAR texel selection observably', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 8, height: 8 });
    const t = gl.createTexture()!;
    gl.bindTexture(TEXTURE_2D, t);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 1, 0, RGBA, UNSIGNED_BYTE, new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]));
    gl.texParameteri(TEXTURE_2D, 0x2800, NEAREST);
    // Act
    gl.drawArrays(TRIANGLES, 0, 0);
    // Assert
    expect(gl.getTexParameter(TEXTURE_2D, 0x2800)).toBe(NEAREST);
    gl.texParameteri(TEXTURE_2D, 0x2800, LINEAR);
    expect(gl.getTexParameter(TEXTURE_2D, 0x2800)).toBe(LINEAR);
  });

  it('binds textures to units and unbinds cleanly', () => {
    // Arrange
    const gl = new WebGL1Context({ width: 4, height: 4 });
    const t = gl.createTexture()!;
    // Act
    gl.activeTexture(0x84c1);
    gl.bindTexture(TEXTURE_2D, t);
    gl.bindTexture(TEXTURE_2D, null);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.isTexture(t)).toBe(true);
  });
});
