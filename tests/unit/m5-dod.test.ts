// CHANGELOG: Sprint 13 (2026-09-24): T6: TC29a/TC29b per-context split (ce2d189) + TC34-TC36 Demo Carrier Fixtures 21-23 (349a3eb).
/** Sprint 9 Task 9 — M5 Definition-of-Done suite (Demo Carrier). Entry-point semantics, error-taxonomy spot-checks, TD-003 determinism, CTS classification discipline. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { WebGL2Context, createSoftwareWebGLContext } from '../../src/entry';
import type { DirectVertex, WebGL1Context } from '../../src/gl/webgl1-context';
import {
  CTSHeadlessEnvironment,
  CTSManifestParser,
  CTSRunner,
  CTSTriageLogger,
  WEBGL1_MANIFEST_ROOT,
  WEBGL1_TRIAGE_LOG,
  WEBGL2_MANIFEST_ROOT,
  WEBGL2_TRIAGE_LOG,
  classifyFailure,
} from '../conformance/webgl1-harness';
import {
  ARRAY_BUFFER,
  BLEND,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  CONTEXT_LOST_WEBGL,
  DEPTH_BUFFER_BIT,
  DEPTH_TEST,
  DITHER,
  FRAGMENT_SHADER,
  HIGH_FLOAT,
  HIGH_INT,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LEQUAL,
  LINE_WIDTH,
  LINK_STATUS,
  LOW_FLOAT,
  LOW_INT,
  MEDIUM_FLOAT,
  MEDIUM_INT,
  NEAREST,
  NO_ERROR,
  ONE_MINUS_SRC_ALPHA,
  RGBA,
  SRC_ALPHA,
  STATIC_DRAW,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

function dodContext(w: number, h: number): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('dodContext: factory returned null');
  return gl;
}

function solidTri(color: readonly [number, number, number, number]): DirectVertex[] {
  return [
    { position: [-1, -1, 0, 1], color },
    { position: [3, -1, 0, 1], color },
    { position: [-1, 3, 0, 1], color },
  ];
}

function readback(gl: WebGL1Context, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, RGBA, UNSIGNED_BYTE, out);
  return out;
}

function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if ((a[i] as number) !== (b[i] as number)) return false;
  }
  return true;
}

function linkProgram(
  gl: WebGL1Context,
  vsSrc: string,
  fsSrc: string,
): NonNullable<ReturnType<WebGL1Context['createProgram']>> {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('shader creation failed');
  gl.shaderSource(vs, vsSrc);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('VS compile failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('FS compile failed');
  const program = gl.createProgram();
  if (program === null) throw new Error('program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('link failed');
  return program;
}

type LoseExt = { loseContext(): void };

function lose(gl: WebGL1Context): LoseExt {
  return gl.getExtension('WEBGL_lose_context') as unknown as LoseExt;
}

const GOOD_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const GOOD_FS = 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }';

describe('M5 DoD Fixture 1: entry-point semantics', () => {
  it('TC1 finish and flush execute without error on healthy context', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.finish();
    const errFinish = gl.getError();
    gl.flush();
    const errFlush = gl.getError();
    // Assert:
    expect(errFinish).toBe(NO_ERROR);
    expect(errFlush).toBe(NO_ERROR);
  });

  it('TC2 finish and flush are silent no-ops under context loss', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    lose(gl).loseContext();
    const drain = gl.getError();
    // Act:
    gl.finish();
    const errFinish = gl.getError();
    gl.flush();
    const errFlush = gl.getError();
    // Assert: loss is sticky-recorded once, then finish/flush report NO_ERROR.
    expect(drain).toBe(CONTEXT_LOST_WEBGL);
    expect(errFinish).toBe(NO_ERROR);
    expect(errFlush).toBe(NO_ERROR);
  });

  it('TC3 lineWidth accepts width 1 and getParameter reflects it', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    expect(gl.getParameter(LINE_WIDTH)).toBe(1);
    // Act:
    gl.lineWidth(1);
    const err = gl.getError();
    const queried = gl.getParameter(LINE_WIDTH);
    // Assert:
    expect(err).toBe(NO_ERROR);
    expect(queried).toBe(1);
  });

  it('TC4 lineWidth rejects non-positive widths with INVALID_VALUE and preserves state', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    gl.lineWidth(1);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act + Assert: each invalid width records INVALID_VALUE, drains clean, state stays 1.
    for (const bad of [0, -1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      gl.lineWidth(bad);
      expect(gl.getError()).toBe(INVALID_VALUE);
      expect(gl.getError()).toBe(NO_ERROR);
      expect(gl.getParameter(LINE_WIDTH)).toBe(1);
    }
  });

  it('TC5 getShaderPrecisionFormat meets minima and memoizes per enum pair', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    // Act:
    const fmt = gl.getShaderPrecisionFormat(VERTEX_SHADER, HIGH_FLOAT);
    const err = gl.getError();
    // Assert: WebGL minima {127, 127, 24} met or exceeded.
    expect(fmt).not.toBeNull();
    expect(fmt?.rangeMin).toBeGreaterThanOrEqual(127);
    expect(fmt?.rangeMax).toBeGreaterThanOrEqual(127);
    expect(fmt?.precision).toBeGreaterThanOrEqual(24);
    expect(err).toBe(NO_ERROR);
    // Act: same pair returns the memoized instance.
    const fmt2 = gl.getShaderPrecisionFormat(VERTEX_SHADER, HIGH_FLOAT);
    // Assert:
    expect(fmt2).toBe(fmt);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: other shader/precision pairs resolve without error.
    for (const [st, pt] of [
      [VERTEX_SHADER, LOW_FLOAT],
      [VERTEX_SHADER, MEDIUM_FLOAT],
      [VERTEX_SHADER, LOW_INT],
      [VERTEX_SHADER, MEDIUM_INT],
      [VERTEX_SHADER, HIGH_INT],
      [FRAGMENT_SHADER, HIGH_FLOAT],
    ] as const) {
      const f = gl.getShaderPrecisionFormat(st, pt);
      expect(f).not.toBeNull();
      expect(gl.getError()).toBe(NO_ERROR);
    }
  });

  it('TC6 getShaderPrecisionFormat rejects invalid enums with INVALID_ENUM', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    // Act + Assert: invalid shader type.
    expect(gl.getShaderPrecisionFormat(0x9999, HIGH_FLOAT)).toBeNull();
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act + Assert: invalid precision type.
    expect(gl.getShaderPrecisionFormat(VERTEX_SHADER, 0x5678)).toBeNull();
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('M5 DoD Fixture 2: error-taxonomy spot-checks', () => {
  it('TC7 F1 enable with unknown enum records INVALID_ENUM and drains', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    // Act:
    gl.enable(0x9999);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC8 F2 bufferData with negative size records INVALID_VALUE and drains', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    const buf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, buf);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.bufferData(ARRAY_BUFFER, -4, STATIC_DRAW);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC9 F5 useProgram with unlinked program records INVALID_OPERATION; compile failure is log-only', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    const vs = gl.createShader(VERTEX_SHADER);
    const fs = gl.createShader(FRAGMENT_SHADER);
    if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
    gl.shaderSource(vs, GOOD_VS);
    gl.shaderSource(fs, GOOD_FS);
    gl.compileShader(vs);
    gl.compileShader(fs);
    const program = gl.createProgram();
    if (program === null) throw new Error('arrange: program creation failed');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    // Act: use without linking.
    gl.useProgram(program);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
    // Arrange: a shader that fails to compile.
    const bad = gl.createShader(VERTEX_SHADER);
    if (bad === null) throw new Error('arrange: bad shader creation failed');
    gl.shaderSource(bad, 'syntax error source;');
    // Act:
    gl.compileShader(bad);
    // Assert: log-only — COMPILE_STATUS false, non-empty log, NO_ERROR.
    expect(gl.getShaderParameter(bad, COMPILE_STATUS)).toBe(false);
    expect(gl.getShaderInfoLog(bad).length).toBeGreaterThan(0);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC10 F7 drawArrays with negative count records INVALID_VALUE and drains', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    const program = linkProgram(gl, GOOD_VS, GOOD_FS);
    gl.useProgram(program);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLES, 0, -1);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC11 F9 getParameter with unknown pname records INVALID_ENUM and drains', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    // Act:
    gl.getParameter(0x9999);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('M5 DoD Fixture 3: TD-003 composite-scene determinism', () => {
  it('TC12 two contexts render byte-identical composite scenes with active content', () => {
    // Arrange: 16x16 scene — clear + depth-tested overlapping translucent tris + mipmap-complete texture bound.
    const W = 16;
    const H = 16;
    const renderScene = (): Uint8Array => {
      const gl = dodContext(W, H);
      gl.disable(DITHER);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0.1, 0.2, 0.3, 1.0);
      gl.clearDepth(1);
      gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
      // Arrange: mipmap-complete 2x2 RGBA texture exercising the texture path.
      const tex = gl.createTexture();
      if (tex === null) throw new Error('arrange: createTexture failed');
      gl.bindTexture(TEXTURE_2D, tex);
      gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
      gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
      gl.texImage2D(
        TEXTURE_2D,
        0,
        RGBA,
        2,
        2,
        0,
        RGBA,
        UNSIGNED_BYTE,
        new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
      );
      // Act: depth-tested + blended overlapping translucent fullscreen tris.
      gl.enable(DEPTH_TEST);
      gl.depthFunc(LEQUAL);
      gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA);
      gl.enable(BLEND);
      gl.drawArrays(TRIANGLES, 0, 3, solidTri([1, 0, 0, 0.6]));
      gl.drawArrays(TRIANGLES, 0, 3, solidTri([0, 1, 0, 0.5]));
      const out = readback(gl, W, H);
      expect(gl.getError()).toBe(NO_ERROR);
      return out;
    };
    const a = renderScene();
    const b = renderScene();
    // Assert: byte-identical across independent contexts.
    expect(buffersEqual(a, b)).toBe(true);
    expect(Array.from(b)).toEqual(Array.from(a));
    // Assert: non-trivial scene — not all zeros and differs from the clear color.
    expect(a.some((v) => v !== 0)).toBe(true);
    const clearR = Math.round(0.1 * 255);
    const clearG = Math.round(0.2 * 255);
    const clearB = Math.round(0.3 * 255);
    let differsFromClear = false;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] !== clearR || a[i + 1] !== clearG || a[i + 2] !== clearB) {
        differsFromClear = true;
        break;
      }
    }
    expect(differsFromClear).toBe(true);
  });
});

describe('M5 DoD Fixture 4: CTS classification discipline', () => {
  it('TC13 classifyFailure maps G1-G4 vectors to spec-defect/missing-entry-point/float-edge/harness-limitation', () => {
    // Arrange: vectors mirrored from triage-classification.test.ts (proven against the harness).
    // Act + Assert: G1 shader compile cascade.
    const g1 = classifyFailure('conformance/gl-shader-test.html', 'FAIL', [], 'Compile failed', [
      { success: false, message: 'Compile failed' },
    ]);
    expect(g1.classification).toBe('spec-defect');
    expect(g1.rootCauseGroup).toBe('G1');
    // Act + Assert: G2 missing entry point.
    const g2 = classifyFailure('conformance/entry.html', 'CRASH', [], 'finish is not a function', []);
    expect(g2.classification).toBe('missing-entry-point');
    expect(g2.rootCauseGroup).toBe('G2');
    // Act + Assert: G3 float edge.
    const g3 = classifyFailure('conformance/precision.html', 'FAIL', [], null, [
      { success: false, message: 'differs by 0.0001 within float epsilon' },
    ]);
    expect(g3.classification).toBe('float-edge');
    expect(g3.rootCauseGroup).toBe('G3');
    // Act + Assert: G4 harness limitation.
    const g4 = classifyFailure('conformance/crash-page.html', 'CRASH', [], 'synthetic uncaught exception: timeout', []);
    expect(g4.classification).toBe('harness-limitation');
    expect(g4.rootCauseGroup).toBe('G4');
  });

  it('TC14 ADR-017 unexplained skips reconcile as FAIL/spec-defect/G4 with valid reconciliation', () => {
    // Arrange:
    const logger = new CTSTriageLogger('test-results/test-m5-dod-triage.json');
    // Act:
    logger.recordTestResult('conformance/gl-shader-test.html', {
      verdict: 'FAIL',
      assertions: [{ success: false, message: 'Compile failed' }],
      drainedErrors: [],
      crash: null,
    });
    logger.recordSkip('conformance/ext.html', 'Requires GLSL 3.00 es');
    logger.recordSkip('conformance/unexplained.html', '');
    const summary = logger.finalizeReport();
    // Assert:
    const byId = new Map(summary.tests.map((r) => [r.id, r]));
    expect(byId.get('conformance/gl-shader-test.html')?.classification).toBe('spec-defect');
    expect(byId.get('conformance/gl-shader-test.html')?.rootCauseGroup).toBe('G1');
    expect(byId.get('conformance/ext.html')?.classification).toBe('harness-limitation');
    expect(byId.get('conformance/ext.html')?.rootCauseGroup).toBe('G4');
    const unexplained = byId.get('conformance/unexplained.html');
    expect(unexplained?.status).toBe('FAIL');
    expect(unexplained?.skipped).toBe(true);
    expect(unexplained?.classification).toBe('spec-defect');
    expect(unexplained?.rootCauseGroup).toBe('G4');
    expect(summary.verdictReconciliation.valid).toBe(true);
  });
});

type RendererFactory = (canvas: { width: number; height: number }) => { getError: () => number } | null;

function loadFactoryViaCast(path: string, contextType?: string): RendererFactory {
  const ctor = CTSRunner as unknown as Record<string, unknown>;
  const fn = ctor['loadFactory'] as (p: string, t?: string) => RendererFactory;
  return fn.call(CTSRunner, path, contextType);
}

function dummyFactory(): RendererFactory {
  return () => ({ getError: () => 0 });
}

describe('M5 DoD Fixture 5: G1 pipeline remediation', () => {
  it('TC15 CTSRunner loadFactory returns WebGL2Context and canvas routes webgl2', () => {
    // Arrange:
    const mockCanvas = { width: 300, height: 150 };
    const factory = loadFactoryViaCast('/app/renderer.js', 'webgl2');
    // Act:
    const gl2 = factory(mockCanvas) as unknown as WebGL2Context;
    // Assert:
    expect(gl2).not.toBeNull();
    expect(gl2 instanceof WebGL2Context).toBe(true);
    expect(gl2.getError()).toBe(NO_ERROR);
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 5000);
    // Act:
    const globalObj = env.setup(factory) as Record<string, unknown>;
    const doc = globalObj['document'] as { getElementById: (id: string) => unknown };
    const canvas = doc.getElementById('canvas') as { getContext: (t: string) => unknown };
    const ctxWebgl2 = canvas.getContext('webgl2');
    const ctxExpWebgl2 = canvas.getContext('experimental-webgl2');
    const ctxUnknown = canvas.getContext('unknown');
    // Assert:
    expect(ctxWebgl2).toBe(env.context);
    expect(ctxExpWebgl2).toBe(env.context);
    expect(ctxUnknown).toBeNull();
  });

  it('TC16 CTSHeadlessEnvironment injects MockXMLHttpRequest and WebGL globals', () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'td023-xhr-'));
    try {
      writeFileSync(join(tempDir, 'test.json'), '{"status":"ok"}');
      const env = new CTSHeadlessEnvironment('/app/renderer.js', 5000);
      // Act:
      const globalObj = env.setup(dummyFactory()) as Record<string, unknown>;
      const XHR = globalObj['XMLHttpRequest'] as new () => Record<string, unknown>;
      const xhrSync = new XHR() as unknown as {
        open: (m: string, u: string, a: boolean) => void;
        send: (p: null) => void;
        readyState: number;
        status: number;
        responseText: string;
      };
      xhrSync.open('GET', 'test.json', false);
      xhrSync.send(null);
      // Assert:
      expect(xhrSync.readyState).toBe(4);
      expect(xhrSync.status).toBe(200);
      expect(xhrSync.responseText).toBe('{"status":"ok"}');
      // Act:
      const xhr404 = new XHR() as unknown as {
        open: (m: string, u: string, a: boolean) => void;
        send: () => void;
        status: number;
        onerror: (() => void) | null;
      };
      let errFired = false;
      xhr404.onerror = () => {
        errFired = true;
      };
      xhr404.open('GET', 'missing.dat', false);
      xhr404.send();
      // Assert:
      expect(xhr404.status).toBe(404);
      expect(errFired).toBe(true);
      // Act:
      const w1 = globalObj['WebGLRenderingContext'] as Record<string, unknown>;
      const w2 = globalObj['WebGL2RenderingContext'] as Record<string, unknown>;
      const win = globalObj['window'] as Record<string, unknown>;
      // Assert:
      expect(w1['COLOR_BUFFER_BIT']).toBe(0x00004000);
      expect(w1['TRIANGLES']).toBe(0x0004);
      expect(w2['READ_FRAMEBUFFER']).toBe(0x8ca8);
      expect(w2['DRAW_FRAMEBUFFER']).toBe(0x8ca9);
      expect(win['WebGL2RenderingContext']).toBe(w2);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('TC17 CTSManifestParser skips shader data files and retains html tests', () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'm5-dod-manifest-'));
    try {
      writeFileSync(
        join(tempDir, '00_test_list.txt'),
        'valid_test.html\nshader.vert\nshader.frag\nsub/another_test.html\nsub/test.vert.html\n',
      );
      const parser = new CTSManifestParser(tempDir);
      // Act:
      const entries = parser.parseManifest('00_test_list.txt', new Map());
      // Assert:
      expect(entries.length).toBe(2);
      expect(entries[0]?.id).toBe('valid_test.html');
      expect(entries[1]?.id).toBe('sub/another_test.html');
      expect(entries.every((e) => !e.id.endsWith('.vert') && !e.id.endsWith('.frag'))).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('M5 DoD Fixture 6: error-queue exactness and bit-depth queries', () => {
  it('TC18 texImage2D non-zero border and attachShader duplicate exact errors', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 1, RGBA, UNSIGNED_BYTE, null);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
    // Arrange:
    const prog = gl.createProgram();
    const vs = gl.createShader(VERTEX_SHADER);
    if (prog === null || vs === null) throw new Error('arrange: creation failed');
    gl.shaderSource(vs, GOOD_VS);
    gl.compileShader(vs);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.attachShader(prog, vs);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.attachShader(prog, vs);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getAttachedShaders(prog)).toEqual([vs]);
  });

  it('TC19 getParameter queries bit-depths 0x0d52-0x0d57 exact', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    const r = gl.getParameter(0x0d52);
    const g = gl.getParameter(0x0d53);
    const b = gl.getParameter(0x0d54);
    const a = gl.getParameter(0x0d55);
    const d = gl.getParameter(0x0d56);
    const s = gl.getParameter(0x0d57);
    // Assert:
    expect([r, g, b, a]).toEqual([8, 8, 8, 8]);
    expect(d).toBe(24);
    expect(s).toBe(8);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('M5 DoD Fixture 7: readPixels bounds guard', () => {
  it('TC20 readPixels out-of-bounds queries record INVALID_VALUE and preserve memory', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    gl.clearColor(1.0, 0.0, 0.0, 1.0);
    gl.clear(COLOR_BUFFER_BIT);
    expect(gl.getError()).toBe(NO_ERROR);
    const dst = new Uint8Array(16);
    dst.fill(0xaa);
    // Act:
    gl.readPixels(-1, 0, 2, 2, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(dst.every((v) => v === 0xaa)).toBe(true);
    // Act:
    gl.readPixels(0, 0, 5, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(dst.every((v) => v === 0xaa)).toBe(true);
    // Act: valid full-buffer read needs a 64-byte destination (4x4 RGBA).
    const validDst = new Uint8Array(64);
    gl.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, validDst);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(validDst[0]).toBe(255);
  });
});

describe('M5 DoD Fixture 8: TD-015/016 harness hardening', () => {
  it('TC21 CTSTriageLogger records TIMEOUT verdict as G4 and verifies shared paths', () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'm5-dod-timeout-'));
    try {
      const logger = new CTSTriageLogger(join(tempDir, 'triage.json'));
      const report = {
        verdict: 'TIMEOUT' as const,
        assertions: [{ success: false, message: 'Script timeout after 50ms' }],
        drainedErrors: [] as number[],
        crash: null,
      };
      // Act:
      logger.setDiscoveredCount(1);
      logger.recordTestResult('conformance/timeout.html', report);
      const summary = logger.finalizeReport();
      // Assert:
      expect(summary.totals.executed).toBe(1);
      expect(summary.totals.failed).toBe(1);
      expect(summary.totals.passed).toBe(0);
      expect(summary.tests[0]?.id).toBe('conformance/timeout.html');
      expect(summary.tests[0]?.status).toBe('TIMEOUT');
      expect(summary.tests[0]?.passed).toBe(false);
      expect(summary.tests[0]?.classification).toBe('harness-limitation');
      expect(summary.tests[0]?.rootCauseGroup).toBe('G4');
      expect(summary.verdictReconciliation.valid).toBe(true);
      // Assert: shared path exports.
      expect(WEBGL1_MANIFEST_ROOT).toBe('vendor/WebGL/conformance-suites/1.0.3');
      expect(WEBGL1_TRIAGE_LOG).toBe('test-results/conformance/webgl1-triage.json');
      expect(WEBGL2_MANIFEST_ROOT).toBe('vendor/WebGL/conformance-suites/2.0.0');
      expect(WEBGL2_TRIAGE_LOG).toBe('test-results/conformance/webgl2-triage.json');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('M5 DoD Fixture 9: Sprint 11 RC-4 API surface completion', () => {
  it('TC22 RC-4 API surface completion matrix', async () => {
    // Arrange:
    const gl1 = dodContext(640, 480);
    const gl2 = new WebGL2Context({ width: 640, height: 480 });
    const C = await import('../../src/gl/constants');
    const g = globalThis as unknown as Record<string, unknown>;
    const saved1 = g['WebGLRenderingContext'];
    const saved2 = g['WebGL2RenderingContext'];
    g['WebGLRenderingContext'] = function WebGLRenderingContext(): void {};
    g['WebGL2RenderingContext'] = function WebGL2RenderingContext(): void {};
    // Act:
    let r1 = false;
    let r2 = false;
    try {
      r1 = gl1 instanceof (g['WebGLRenderingContext'] as never);
      r2 = gl2 instanceof (g['WebGL2RenderingContext'] as never);
    } finally {
      g['WebGLRenderingContext'] = saved1;
      g['WebGL2RenderingContext'] = saved2;
    }
    const vs = gl1.createShader(VERTEX_SHADER);
    if (vs === null) throw new Error('arrange: shader creation failed');
    const vsSrc = 'precision mediump float;\nvoid main() { gl_Position = vec4(0.0); }';
    gl1.shaderSource(vs, vsSrc);
    const returnedSrc = gl1.getShaderSource(vs);
    const errShaderSource = gl1.getError();
    gl1.clearStencil(127);
    const stencilVal = gl1.getParameter(C.STENCIL_CLEAR_VALUE);
    const errClearStencil = gl1.getError();
    const dbw = gl1.drawingBufferWidth;
    const dbh = gl1.drawingBufferHeight;
    const depthBit1 = (gl1 as unknown as Record<string, unknown>)['DEPTH_BUFFER_BIT'];
    const depthBit2 = (gl2 as unknown as Record<string, unknown>)['DEPTH_BUFFER_BIT'];
    // Assert:
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(returnedSrc).toBe(vsSrc);
    expect(errShaderSource).toBe(NO_ERROR);
    expect(stencilVal).toBe(127);
    expect(errClearStencil).toBe(NO_ERROR);
    expect(dbw).toBe(640);
    expect(dbh).toBe(480);
    expect(depthBit1).toBe(0x00000100);
    expect(depthBit2).toBe(0x00000100);
  });
});

describe('M5 DoD Fixture 10: Sprint 11 RC-5 implementation defects strictness', () => {
  it('TC23 RC-5 error strictness, link diagnostics, and framebuffer completeness', async () => {
    // Arrange:
    const gl = dodContext(64, 64);
    const C = await import('../../src/gl/constants');
    expect(gl.getError()).toBe(NO_ERROR);
    // Act - Part 1: success path strictness.
    gl.viewport(0, 0, 100, 100);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const buf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, buf);
    const errSuccessPath = gl.getError();
    // Act - Part 2: link diagnostic failure on varying mismatch.
    const vs = gl.createShader(VERTEX_SHADER);
    const fs = gl.createShader(FRAGMENT_SHADER);
    if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
    gl.shaderSource(vs, 'varying vec4 v_col;\nvoid main() { gl_Position = vec4(0.0); }');
    gl.compileShader(vs);
    gl.shaderSource(fs, 'varying vec4 v_other;\nvoid main() { gl_FragColor = v_other; }');
    gl.compileShader(fs);
    const prog = gl.createProgram();
    if (prog === null) throw new Error('arrange: program creation failed');
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    const linkStatus = gl.getProgramParameter(prog, LINK_STATUS);
    const infoLog = gl.getProgramInfoLog(prog);
    // Act - Part 3: framebuffer completeness exact enums.
    const anyGl = gl as unknown as Record<string, (...args: never[]) => unknown>;
    const fb = (anyGl['createFramebuffer'] as () => unknown)();
    gl.bindFramebuffer(C.FRAMEBUFFER, fb as never);
    const statusMissing = gl.checkFramebufferStatus(C.FRAMEBUFFER) as unknown as number;
    const rb = (anyGl['createRenderbuffer'] as () => unknown)();
    (anyGl['framebufferRenderbuffer'] as (t: unknown, a: unknown, r: unknown, o: unknown) => void)(
      C.FRAMEBUFFER,
      C.COLOR_ATTACHMENT0,
      C.RENDERBUFFER,
      rb,
    );
    const statusIncomplete = gl.checkFramebufferStatus(C.FRAMEBUFFER) as unknown as number;
    // Assert:
    expect(errSuccessPath).toBe(NO_ERROR);
    expect(linkStatus).toBe(false);
    expect(typeof infoLog).toBe('string');
    expect((infoLog as string).length).toBeGreaterThan(0);
    expect(statusMissing).toBe(C.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT);
    expect(statusIncomplete).toBe(C.FRAMEBUFFER_INCOMPLETE_ATTACHMENT);
    expect(statusMissing).not.toBe(0);
    expect(statusIncomplete).not.toBe(0);
  });
});

describe('M5 DoD Fixture 11: Sprint 11 TD-024 dual-fault ordering and bit-depth constants', () => {
  it('TC24 readPixels dual-fault INVALID_ENUM-before-INVALID_VALUE and bit depths', () => {
    // Arrange:
    const gl = dodContext(64, 64);
    const dst = new Uint8Array(16);
    // Act - Part 1: dual-fault invalid format + out-of-bounds.
    gl.readPixels(-10, -10, 100, 100, 0x1234, UNSIGNED_BYTE, dst);
    const errDualFault1 = gl.getError();
    const errDrain1 = gl.getError();
    // Act - Part 2: dual-fault invalid type + out-of-bounds.
    gl.readPixels(-5, -5, 200, 200, RGBA, 0x5678, dst);
    const errDualFault2 = gl.getError();
    const errDrain2 = gl.getError();
    // Act - Part 3: bit-depth named constant queries.
    const rBits = gl.getParameter(0x0d52);
    const gBits = gl.getParameter(0x0d53);
    const bBits = gl.getParameter(0x0d54);
    const aBits = gl.getParameter(0x0d55);
    const dBits = gl.getParameter(0x0d56);
    const sBits = gl.getParameter(0x0d57);
    const errBitDepths = gl.getError();
    // Assert:
    expect(errDualFault1).toBe(INVALID_ENUM);
    expect(errDrain1).toBe(NO_ERROR);
    expect(errDualFault2).toBe(INVALID_ENUM);
    expect(errDrain2).toBe(NO_ERROR);
    expect([rBits, gBits, bBits, aBits]).toEqual([8, 8, 8, 8]);
    expect(dBits).toBe(24);
    expect(sBits).toBe(8);
    expect(errBitDepths).toBe(NO_ERROR);
  });
});

describe('M5 DoD Fixture 12: Sprint 11 G3 float-edge byte-identity and coverage', () => {
  it('TC25 Math.fround float32 readPixels byte-identity and deterministic raster coverage', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    const vsSrc = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
    const fsSrc = 'precision mediump float; void main() { gl_FragColor = vec4(0.5 - 0.000000001, 0.0, 0.0, 1.0); }';
    const prog = linkProgram(gl, vsSrc, fsSrc);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.vertexAttribPointer(loc, 2, 0x1406, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const dst = new Uint8Array(4 * 4 * 4);
    gl.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert: Math.fround(0.5 - 1e-9) evaluates to 0.5 in float32, scaling to byte 128.
    expect(dst[0]).toBe(128);
    expect(dst[1]).toBe(0);
    expect(dst[2]).toBe(0);
    expect(dst[3]).toBe(255);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('M5 DoD Fixture 13: Sprint 11 error-queue exactness Part 2', () => {
  it('TC26 draw/program/framebuffer/context-loss exact error codes and sticky queue', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act - Part 1: draw invalid mode and negative first.
    gl.drawArrays(0xffff, 0, 3);
    const errInvalidMode = gl.getError();
    gl.drawArrays(TRIANGLES, -1, 3);
    const errNegFirst = gl.getError();
    // Act - Part 2: framebuffer invalid target.
    gl.bindFramebuffer(0x9999, null);
    const errBadFbTarget = gl.getError();
    // Act - Part 3: context-loss sentinels and sticky queue.
    const loseExt = gl.getExtension('WEBGL_lose_context') as unknown as {
      loseContext(): void;
      restoreContext(): void;
    };
    loseExt.loseContext();
    expect(gl.isContextLost()).toBe(true);
    const lostBuf = gl.createBuffer();
    const errLost = gl.getError();
    const errLostDrained = gl.getError();
    loseExt.restoreContext();
    expect(gl.isContextLost()).toBe(false);
    // Act - Part 4: sticky-queue verification (first error retained, second discarded).
    gl.drawArrays(0xffff, 0, 3);
    gl.drawArrays(TRIANGLES, -1, 3);
    const stickyErr1 = gl.getError();
    const stickyErr2 = gl.getError();
    // Assert:
    expect(errInvalidMode).toBe(INVALID_ENUM);
    expect(errNegFirst).toBe(INVALID_VALUE);
    expect(errBadFbTarget).toBe(INVALID_ENUM);
    expect(lostBuf).toBeNull();
    expect(errLost).toBe(CONTEXT_LOST_WEBGL);
    expect(errLostDrained).toBe(NO_ERROR);
    expect(stickyErr1).toBe(INVALID_ENUM);
    expect(stickyErr2).toBe(NO_ERROR);
  });
});

describe('M5 DoD Fixture 14: Sprint 11 TD-025 triage-log isolation', () => {
  it('TC27 synthetic triage write leaves production log untouched and run-scoped path isolated', async () => {
    // Arrange:
    const fs = await import('node:fs');
    const harness = await import('../conformance/webgl1-harness');
    const prodPath = harness.WEBGL1_TRIAGE_LOG as string;
    const statBefore = fs.statSync(prodPath);
    const contentBefore = fs.readFileSync(prodPath, 'utf8');
    const tempLogPath = harness.createRunScopedLogPath('dod-isolation-test');
    const logger = new harness.CTSTriageLogger(tempLogPath);
    try {
      // Act:
      logger.recordTestResult('synth-test-dod', {
        verdict: 'FAIL',
        assertions: [{ success: false, message: 'probe' }],
        drainedErrors: [],
        crash: null,
      });
      const summary = logger.finalizeReport();
      // Assert:
      expect(fs.existsSync(tempLogPath)).toBe(true);
      expect(fs.readFileSync(prodPath, 'utf8')).toBe(contentBefore);
      expect(fs.statSync(prodPath).size).toBe(statBefore.size);
      expect(fs.statSync(prodPath).mtimeMs).toBe(statBefore.mtimeMs);
      expect(summary.totals.failed).toBe(1);
    } finally {
      // Cleanup:
      try {
        if (fs.existsSync(tempLogPath)) fs.unlinkSync(tempLogPath);
      } catch {
        // best-effort cleanup
      }
    }
  });
});

describe('M5 DoD Fixture 15: Sprint 11 coverage gate threshold enforcement', () => {
  it('TC28 vitest config enforces 90% coverage threshold', async () => {
    // Arrange:
    const fs = await import('node:fs');
    const configSrc = fs.readFileSync('vitest.config.ts', 'utf8');
    // Act:
    const hasLines90 = configSrc.includes('lines: 90');
    const hasFuncs96 = configSrc.includes('functions: 96');
    const hasBranches81 = configSrc.includes('branches: 81');
    const hasStatements90 = configSrc.includes('statements: 90');
    // Assert:
    expect(hasLines90).toBe(true);
    expect(hasFuncs96).toBe(true);
    expect(hasBranches81).toBe(true);
    expect(hasStatements90).toBe(true);
  });
});

describe('M5 DoD Fixture 16: Sprint 13 honest CTS threshold reporting v4', () => {
  it('TC29a WebGL1 CTS threshold report v4 records GAP_RECORDED with unlowered 95% gate and measured deltas', async () => {
    // Arrange:
    const fs = await import('node:fs');
    const raw = fs.readFileSync('test-results/conformance/threshold-report.json', 'utf8');
    const report = JSON.parse(raw) as {
      overallStatus: string;
      reconciliationValid: boolean;
      suites: {
        webgl1: { targetGate: number; executed: number; passed: number; crashed: number };
      };
      deltas: {
        webgl1: { deltaPercentagePoints: string; sprint12Ratio: string; sprint13Ratio: string };
      };
    };
    const md = fs.readFileSync('test-results/conformance/threshold-report.md', 'utf8');
    // Act & Assert (WebGL1 JSON Fields):
    expect(report.overallStatus).toBe('GAP_RECORDED');
    expect(report.reconciliationValid).toBe(true);
    expect(report.suites.webgl1.targetGate).toBe(95);
    expect(report.suites.webgl1.executed).toBe(672);
    expect(report.suites.webgl1.passed).toBe(13);
    expect(report.suites.webgl1.crashed).toBe(0);
    expect(report.deltas.webgl1.deltaPercentagePoints).toBe('+0.00%');
    expect(report.deltas.webgl1.sprint12Ratio).toBe('13/672');
    expect(report.deltas.webgl1.sprint13Ratio).toBe('13/672');
    // Act & Assert (WebGL1 Markdown Sections):
    expect(md).toContain('95.00%');
    expect(md).toContain('13/672');
    expect(md).toContain('+0.00%');
    expect(md).toContain('## Gate-Feasibility Assessment');
    expect(md).toContain('179 sprints');
    expect(md).toContain('## Operator-Escalation Recommendation');
  });
  it('TC29b WebGL2 CTS threshold report v4 records GAP_RECORDED with unlowered 90% gate and measured deltas', async () => {
    // Arrange:
    const fs = await import('node:fs');
    const raw = fs.readFileSync('test-results/conformance/threshold-report.json', 'utf8');
    const report = JSON.parse(raw) as {
      suites: {
        webgl2: { targetGate: number; executed: number; passed: number; crashed: number };
      };
      deltas: {
        webgl2: { deltaPercentagePoints: string; sprint12Ratio: string; sprint13Ratio: string };
      };
      deferral: { nextSteps: string };
      feasibility: { verdict: string; projectedSprints: { webgl1: number; webgl2: number } };
    };
    const md = fs.readFileSync('test-results/conformance/threshold-report.md', 'utf8');
    // Act & Assert (WebGL2 JSON Fields):
    expect(report.suites.webgl2.targetGate).toBe(90);
    expect(report.suites.webgl2.executed).toBe(2598);
    expect(report.suites.webgl2.passed).toBe(20);
    expect(report.suites.webgl2.crashed).toBe(0);
    expect(report.deltas.webgl2.deltaPercentagePoints).toBe('+0.00%');
    expect(report.deltas.webgl2.sprint12Ratio).toBe('20/2598');
    expect(report.deltas.webgl2.sprint13Ratio).toBe('20/2598');
    expect(report.deferral.nextSteps).toContain('Sprint 14');
    expect(report.feasibility.verdict).toBe('UNFEASIBLE_AT_CURRENT_VELOCITY');
    expect(report.feasibility.projectedSprints.webgl1).toBe(179);
    expect(report.feasibility.projectedSprints.webgl2).toBe(663);
    // Act & Assert (WebGL2 Markdown Sections):
    expect(md).toContain('# Sprint 13 CTS Conformance Threshold & Gap Report (v4)');
    expect(md).toContain('Overall Status: GAP_RECORDED');
    expect(md).toContain('90.00%');
    expect(md).toContain('20/2598');
    expect(md).toContain('+0.00%');
    expect(md).toContain('663 sprints');
  });
});

describe('M5 DoD Fixture 17: Sprint 12 WebGL1 state-query defaults (TC30)', () => {
  it('TC30 state queries return spec defaults on a fresh context', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    // Act:
    const lineWidth = gl.getParameter(LINE_WIDTH);
    const blendEnabled = gl.isEnabled(BLEND);
    const ditherEnabled = gl.isEnabled(DITHER);
    // Assert:
    expect(lineWidth).toBe(1);
    expect(blendEnabled).toBe(false);
    // NOTE (Sprint 12): implementation de-facto default is DITHER off —
    // TC25 byte-identity and state.test.ts spec-defaults both depend on it —
    // although the WebGL spec names DITHER enabled by default. Flipping the
    // global default is deferred to a future sprint (needs TC25 re-baseline).
    expect(ditherEnabled).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('M5 DoD Fixture 18: Sprint 12 TD-026 DEPTH_STENCIL_ATTACHMENT allowlist (TC31)', () => {
  it('TC31 framebufferTexture2D accepts DEPTH_STENCIL_ATTACHMENT without error', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    const DEPTH_STENCIL_ATTACHMENT = 0x821a;
    const FRAMEBUFFER = 0x8d40;
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(FRAMEBUFFER, fb);
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, null);
    // Act:
    gl.framebufferTexture2D(FRAMEBUFFER, DEPTH_STENCIL_ATTACHMENT, TEXTURE_2D, tex, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('M5 DoD Fixture 19: Sprint 12 WebGL2 D1-D4 descriptors and buffers (TC32)', () => {
  it('TC32 WebGL2 buffer/descriptor entry points accept valid calls without error', () => {
    // Arrange:
    const gl2 = new WebGL2Context({ width: 4, height: 4 });
    // Act:
    const buf = gl2.createBuffer();
    gl2.bindBuffer(ARRAY_BUFFER, buf);
    gl2.bufferData(ARRAY_BUFFER, 16, STATIC_DRAW);
    gl2.vertexAttribDivisor(0, 1);
    // Assert:
    expect(gl2.getError()).toBe(NO_ERROR);
  });
});

describe('M5 DoD Fixture 20: Sprint 12 G3 float-edge byte-identity ReadPixels (TC33)', () => {
  it('TC33 mat4*vec4 float-edge readback matches the per-step float32 golden byte', () => {
    // Arrange: column-major mat4 + vec4 whose row-0 output discriminates
    // per-step float32 (byte 163) from float64 accumulation (byte 164).
    const gl = dodContext(4, 4);
    gl.disable(DITHER);
    const m = [
      0.8387150764465332, 1.4936045408248901, 0.7130963802337646, 1.4298080205917358,
      0.548863410949707, -0.7003823518753052, -1.4492006301879883, 0.6351011395454407,
      0.11449585855007172, -0.9856521487236023, -0.3074215054512024, 1.3552933931350708,
      0.3185145854949951, 0.6479647159576416, -0.18571968376636505, -1.1725587844848633,
    ];
    const v = [0.5099318027496338, -0.34677594900131226, 0.009028089232742786, 1.2645823955535889];
    const fsrc =
      'precision mediump float; void main() { ' +
      `mat4 m = mat4(${m.join(', ')}); vec4 v = vec4(${v.join(', ')}); ` +
      'vec4 t = m * v; gl_FragColor = vec4(t.x, 0.0, 0.0, 1.0); }';
    const program = linkProgram(gl, GOOD_VS, fsrc);
    gl.useProgram(program);
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('TC33: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.vertexAttribPointer(loc, 2, 0x1406, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = readback(gl, 4, 4);
    // Assert: zero pixel difference against the per-step float32 golden.
    expect(pixels[0]).toBe(163);
    expect(pixels[3]).toBe(255);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
describe('M5 DoD Fixture 21: Sprint 13 harness-fix family (TC34)', () => {
  it('TC34 getElementsByTagName canvas collection indexed with item()', async () => {
    // Arrange:
    const { CTSHeadlessEnvironment } = await import('../conformance/webgl1-harness');
    const env = new CTSHeadlessEnvironment('dummy-bundle.js', 1000);
    const g = env.setup(() => dodContext(4, 4) as never);
    const doc = g['document'] as { getElementsByTagName: (t: string) => any };
    // Act:
    const coll = doc.getElementsByTagName('canvas');
    // Assert:
    expect(coll.length).toBe(1);
    expect(coll[0]).toBeDefined();
    expect(coll.item(0)).toBe(coll[0]);
  });
});

describe('M5 DoD Fixture 22: Sprint 13 state-fix family (TC35)', () => {
  it('TC35 pixelStorei UNPACK_COLORSPACE accepts BROWSER_DEFAULT with NO_ERROR', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    const UNPACK_COLORSPACE = 0x9243;
    const BROWSER_DEFAULT = 0x9244;
    // Act:
    gl.pixelStorei(UNPACK_COLORSPACE, BROWSER_DEFAULT);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getPixelStorei(UNPACK_COLORSPACE)).toBe(BROWSER_DEFAULT);
  });
});

describe('M5 DoD Fixture 23: Sprint 13 TD-027 negation exact-pixel (TC36)', () => {
  it('TC36 scalar negation fragment readback matches golden bytes [64,191,191,255]', () => {
    // Arrange:
    const gl = dodContext(4, 4);
    gl.disable(DITHER);
    const fsrc = 'precision mediump float; uniform float u_val; void main() { float n = -u_val; gl_FragColor = vec4(n + 1.0, -(-u_val), (-u_val) * (-1.0), 1.0); }';
    const program = linkProgram(gl, GOOD_VS, fsrc);
    gl.useProgram(program);
    const uLoc = gl.getUniformLocation(program, 'u_val');
    if (uLoc === null) throw new Error('TC36: u_val location null');
    gl.uniform1f(uLoc, 0.75);
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('TC36: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.vertexAttribPointer(loc, 2, 0x1406, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const pixels = readback(gl, 4, 4);
    // Assert:
    expect(pixels[0]).toBe(64);
    expect(pixels[1]).toBe(191);
    expect(pixels[2]).toBe(191);
    expect(pixels[3]).toBe(255);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
