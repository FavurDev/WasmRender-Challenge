/** Sprint 12 Task 2 — WebGL1 CTS Fix Wave A + TD-026 regression suite (TDD RED phase). */
import { describe, expect, it } from 'vitest';
import { CTSHeadlessEnvironment } from '../conformance/webgl1-harness';
import { createSoftwareWebGLContext } from '../../src/entry';
import {
  ACTIVE_TEXTURE,
  COLOR_ATTACHMENT0,
  DEPTH_STENCIL_ATTACHMENT,
  FRAMEBUFFER,
  FRAGMENT_SHADER,
  HIGH_FLOAT,
  INVALID_ENUM,
  NO_ERROR,
  RENDERER,
  TEXTURE0,
  TEXTURE_2D,
  VENDOR,
  VERTEX_SHADER,
  VERSION,
} from '../../src/gl/constants';

const COMPRESSED_TEXTURE_FORMATS = 0x86a3;
const POINTS = 0x0000;

function factory(canvas: { width: number; height: number }): { getError: () => number } {
  return createSoftwareWebGLContext(canvas, null, null) as unknown as { getError: () => number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySetup = (factoryArg: unknown, html?: string) => Record<string, any>;

describe('sprint12 webgl1 fixes (red phase)', () => {
  it('TEST 1 harness canvas registry parses HTML canvas id and size', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 1000);
    const html = '<canvas id="c" width="80" height="60"></canvas>';
    // Act:
    const globals = (env.setup as unknown as AnySetup)(factory, html);
    const doc = globals['document'] as {
      getElementById: (id: string) => { width: number; height: number };
    };
    const canvas = doc.getElementById('c');
    // Assert:
    expect(canvas.width).toBe(80);
    expect(canvas.height).toBe(60);
  });

  it('TEST 2 dynamic element getContext falls back to a working context', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 1000);
    const html = '<canvas id="main" width="300" height="150"></canvas>';
    // Act:
    const globals = (env.setup as unknown as AnySetup)(factory, html);
    const doc = globals['document'] as {
      getElementById: (id: string) => { getContext: (t: string) => unknown };
    };
    const el = doc.getElementById('late-canvas');
    const gl = el.getContext('webgl') as { getError: () => number } | null;
    // Assert:
    expect(gl).not.toBeNull();
    expect(gl?.getError()).toBe(NO_ERROR);
  });

  it('TEST 3 createElement returns fresh canvas instances', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 1000);
    // Act:
    const globals = (env.setup as unknown as AnySetup)(factory, '');
    const doc = globals['document'] as { createElement: (t: string) => unknown };
    const a = doc.createElement('canvas');
    const b = doc.createElement('canvas');
    // Assert:
    expect(a).not.toBe(b);
  });

  it('TEST 4 WebGLRenderingContext instanceof works in VM', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 1000);
    // Act:
    const globals = (env.setup as unknown as AnySetup)(factory, '');
    const Ctor = globals['WebGLRenderingContext'] as new (...args: never[]) => unknown;
    const gl = createSoftwareWebGLContext({ width: 300, height: 150 }, null, null);
    // Assert:
    expect(gl instanceof Ctor).toBe(true);
  });

  it('TEST 5 getParameter returns spec-correct defaults', () => {
    // Arrange:
    const gl = createSoftwareWebGLContext({ width: 300, height: 150 }, null, null) as unknown as {
      getParameter: (p: number) => unknown;
      POINTS?: number;
    };
    // Act:
    const compressed = gl.getParameter(COMPRESSED_TEXTURE_FORMATS) as unknown[];
    const active = gl.getParameter(ACTIVE_TEXTURE);
    const vendor = gl.getParameter(VENDOR);
    const renderer = gl.getParameter(RENDERER);
    const version = gl.getParameter(VERSION);
    // Assert:
    expect(compressed instanceof Uint32Array).toBe(true);
    expect(compressed.length).toBe(0);
    expect(active).toBe(TEXTURE0);
    expect(typeof vendor).toBe('string');
    expect((vendor as string).length).toBeGreaterThan(0);
    expect(typeof renderer).toBe('string');
    expect((renderer as string).length).toBeGreaterThan(0);
    expect(String(version).startsWith('WebGL 1.0')).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((gl as any).POINTS).toBe(POINTS);
  });

  it('TEST 6 getShaderPrecisionFormat returns instanceof WebGLShaderPrecisionFormat', async () => {
    // Arrange:
    const gl = createSoftwareWebGLContext({ width: 300, height: 150 }, null, null) as unknown as {
      getShaderPrecisionFormat: (s: number, p: number) => unknown;
    };
    // Act:
    const fmt = gl.getShaderPrecisionFormat(FRAGMENT_SHADER, HIGH_FLOAT);
    const ns = (await import('../../src/gl/webgl1-context')) as unknown as Record<string, unknown>;
    // Assert:
    expect(typeof ns['WebGLShaderPrecisionFormat']).toBe('function');
    expect(fmt instanceof (ns['WebGLShaderPrecisionFormat'] as new (...a: never[]) => unknown)).toBe(true);
  });

  it('TEST 7 getContextAttributes reflects requested values', () => {
    // Arrange:
    const attrs = { preserveDrawingBuffer: true, alpha: false, stencil: true };
    // Act:
    const gl = createSoftwareWebGLContext({ width: 300, height: 150 }, attrs, null) as unknown as {
      getContextAttributes: () => Record<string, unknown>;
    };
    const got = gl.getContextAttributes();
    // Assert:
    expect(got['preserveDrawingBuffer']).toBe(true);
    expect(got['alpha']).toBe(false);
    expect(got['stencil']).toBe(true);
    // Spec-correct behavior: each call returns a fresh copy, never a live reference.
    const again = gl.getContextAttributes();
    expect(again).not.toBe(got);
  });

  it('TEST 8 compressedTexImage2D emits INVALID_ENUM', () => {
    // Arrange:
    const gl = createSoftwareWebGLContext({ width: 300, height: 150 }, null, null) as unknown as {
      getError: () => number;
      compressedTexImage2D?: (...args: unknown[]) => void;
    };
    // Act:
    expect(typeof gl.compressedTexImage2D).toBe('function');
    gl.compressedTexImage2D?.(TEXTURE_2D, 0, 0x83f1, 4, 4, 0, new Uint8Array(8));
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TEST 9 unknown uniform location returns null with NO_ERROR', () => {
    // Arrange:
    const gl = createSoftwareWebGLContext({ width: 300, height: 150 }, null, null) as unknown as {
      createProgram: () => unknown;
      getUniformLocation: (p: unknown, n: string) => unknown;
      getError: () => number;
    };
    // Act:
    const prog = gl.createProgram();
    const loc = gl.getUniformLocation(prog, 'u_missing_no_such_uniform');
    // Assert:
    expect(loc).toBeNull();
    expect(gl.getError()).toBe(NO_ERROR);
    void VERTEX_SHADER;
  });

  it('TEST 10 TD-026 framebufferTexture2D accepts DEPTH_STENCIL_ATTACHMENT', () => {
    // Arrange:
    const gl = createSoftwareWebGLContext({ width: 300, height: 150 }, null, null) as unknown as {
      createFramebuffer: () => unknown;
      bindFramebuffer: (t: number, f: unknown) => void;
      createTexture: () => unknown;
      bindTexture: (t: number, x: unknown) => void;
      texImage2D: (...args: unknown[]) => void;
      framebufferTexture2D: (t: number, a: number, tt: number, x: unknown, l: number) => void;
      getError: () => number;
    };
    // Act:
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(FRAMEBUFFER, fb);
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, COLOR_ATTACHMENT0, 4, 4, 0, COLOR_ATTACHMENT0, 0x1401, null);
    gl.framebufferTexture2D(FRAMEBUFFER, DEPTH_STENCIL_ATTACHMENT, TEXTURE_2D, tex, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
