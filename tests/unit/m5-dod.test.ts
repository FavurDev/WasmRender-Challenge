/** Sprint 9 Task 9 — M5 Definition-of-Done suite (Demo Carrier). Entry-point semantics, error-taxonomy spot-checks, TD-003 determinism, CTS classification discipline. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { DirectVertex, WebGL1Context } from '../../src/gl/webgl1-context';
import { CTSTriageLogger, classifyFailure } from '../conformance/webgl1-harness';
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
