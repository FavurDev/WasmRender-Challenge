/** Sprint 11 Task 6 WebGL1 CTS fix-wave TDD RED-phase tests — blueprint-conformant suite. */
import { existsSync, readFileSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { DirectVertex, WebGL1Context } from '../../src/gl/webgl1-context';
import { CTSTriageLogger, WEBGL1_TRIAGE_LOG } from '../../tests/conformance/webgl1-harness';
import {
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  FLOAT,
  FRAGMENT_SHADER,
  HIGH_FLOAT,
  INVALID_ENUM,
  INVALID_VALUE,
  LINE_WIDTH,
  LINK_STATUS,
  LOW_INT,
  MEDIUM_FLOAT,
  NO_ERROR,
  RGBA,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

function freshContext(w: number, h: number): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('freshContext: factory returned null');
  return gl;
}

function linkPair(gl: WebGL1Context, vsrc: string, fsrc: string) {
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('linkPair: shader creation failed');
  gl.shaderSource(vs, vsrc);
  gl.shaderSource(fs, fsrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('linkPair: VS failed: ' + gl.getShaderInfoLog(vs));
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('linkPair: FS failed: ' + gl.getShaderInfoLog(fs));
  const program = gl.createProgram();
  if (program === null) throw new Error('linkPair: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('linkPair: link failed: ' + gl.getProgramInfoLog(program));
  return { program };
}

const FULL_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';

function sandboxPath(tag: string): string {
  return join(tmpdir(), `cts-fix-wave-${tag}-${process.pid}.json`);
}

describe('WebGL1 CTS fix wave (red phase)', () => {
  it('T01_glsl_fround_expression_normalization', () => {
    // Arrange:
    const gl = freshContext(4, 4);
    const fsrc = 'precision mediump float; void main() { gl_FragColor = vec4(0.5 - 0.000000001, 0.0, 0.0, 1.0); }';
    const { program } = linkPair(gl, FULL_VS, fsrc);
    gl.useProgram(program);
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const loc = gl.getAttribLocation(program, 'aPos');
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const dst = new Uint8Array(4 * 4 * 4);
    gl.readPixels(0, 0, 4, 4, RGBA, UNSIGNED_BYTE, dst);
    // Assert: float32(0.5 - 1e-9) rounds to byte 128; double drift gives 127.
    expect(dst[0]).toBe(128);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T02_perspective_correct_barycentric_fround', () => {
    // Arrange:
    const gl = freshContext(64, 64);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(COLOR_BUFFER_BIT);
    const red: readonly [number, number, number, number] = [1, 0, 0, 1];
    const q: DirectVertex[] = [
      { position: [-1, -1, 0, 1], color: red },
      { position: [1, -1, 0, 1], color: red },
      { position: [1, 1, 0, 1], color: red },
      { position: [-1, -1, 0, 1], color: red },
      { position: [1, 1, 0, 1], color: red },
      { position: [-1, 1, 0, 1], color: red },
    ];
    // Act:
    gl.drawArrays(TRIANGLES, 0, 6, q);
    const dst = new Uint8Array(4 * 64 * 64);
    gl.readPixels(0, 0, 64, 64, RGBA, UNSIGNED_BYTE, dst);
    // Assert: no seams/cracks/NaN along diagonal; every pixel solid red.
    for (let i = 0; i < 64 * 64; i++) {
      const o = i * 4;
      expect(dst[o]).toBe(255);
      expect(dst[o + 1]).toBe(0);
      expect(dst[o + 2]).toBe(0);
      expect(dst[o + 3]).toBe(255);
    }
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T03_getShaderPrecisionFormat_valid_ranges', () => {
    // Arrange:
    const gl = freshContext(16, 16);
    // Act:
    const high = gl.getShaderPrecisionFormat(VERTEX_SHADER, HIGH_FLOAT);
    const med = gl.getShaderPrecisionFormat(FRAGMENT_SHADER, MEDIUM_FLOAT);
    const low = gl.getShaderPrecisionFormat(FRAGMENT_SHADER, LOW_INT);
    // Assert:
    expect(high).not.toBeNull();
    expect(high?.rangeMin).toBeGreaterThanOrEqual(126);
    expect(high?.rangeMax).toBeGreaterThanOrEqual(126);
    expect(high?.precision).toBeGreaterThanOrEqual(23);
    expect(med?.rangeMin).toBeGreaterThanOrEqual(14);
    expect(med?.rangeMax).toBeGreaterThanOrEqual(14);
    expect(med?.precision).toBeGreaterThanOrEqual(10);
    expect(low?.rangeMin).toBeGreaterThanOrEqual(8);
    expect(low?.rangeMax).toBeGreaterThanOrEqual(8);
    expect(low?.precision).toBe(0);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T04_getShaderPrecisionFormat_invalid_enum_handling', () => {
    // Arrange:
    const gl = freshContext(16, 16);
    // Act:
    const r1 = gl.getShaderPrecisionFormat(0x1234, HIGH_FLOAT);
    const e1 = gl.getError();
    const r2 = gl.getShaderPrecisionFormat(VERTEX_SHADER, 0x5678);
    const e2 = gl.getError();
    // Assert:
    expect(r1).toBeNull();
    expect(e1).toBe(INVALID_ENUM);
    expect(r2).toBeNull();
    expect(e2).toBe(INVALID_ENUM);
  });

  it('T05_finish_and_flush_spec_no_ops', () => {
    // Arrange:
    const gl = freshContext(16, 16);
    // Act:
    gl.flush();
    gl.finish();
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('T06_lineWidth_clamping_and_parameter_query', () => {
    // Arrange:
    const gl = freshContext(16, 16);
    // Act:
    gl.lineWidth(1.0);
    const initial = gl.getParameter(LINE_WIDTH) as unknown as number;
    gl.lineWidth(-1.0);
    const err = gl.getError();
    const after = gl.getParameter(LINE_WIDTH) as unknown as number;
    // Assert:
    expect(initial).toBe(1.0);
    expect(err).toBe(INVALID_VALUE);
    expect(after).toBe(1.0);
  });

  it('T07_triage_log_isolation_from_synthetic_fixtures', () => {
    // Arrange:
    const sandbox = sandboxPath('t07');
    const before = existsSync(WEBGL1_TRIAGE_LOG) ? readFileSync(WEBGL1_TRIAGE_LOG, 'utf8') : null;
    const beforeMtime = existsSync(WEBGL1_TRIAGE_LOG) ? statSync(WEBGL1_TRIAGE_LOG).mtimeMs : -1;
    const logger = new CTSTriageLogger(sandbox);
    logger.setDiscoveredCount(2);
    logger.recordSkip('synthetic/skip.html', 'Shard filtered');
    logger.recordTestResult('synthetic/fail.html', { verdict: 'FAIL', assertions: [{ success: false, message: 'synthetic' }], drainedErrors: [], crash: null });
    // Act:
    logger.finalizeReport();
    // Assert:
    expect(existsSync(sandbox)).toBe(true);
    if (before !== null) {
      expect(readFileSync(WEBGL1_TRIAGE_LOG, 'utf8')).toBe(before);
      expect(statSync(WEBGL1_TRIAGE_LOG).mtimeMs).toBe(beforeMtime);
    }
    if (existsSync(sandbox)) unlinkSync(sandbox);
  });

  it('T08_reconciliation_formula_invariance', () => {
    // Arrange:
    const sandbox = sandboxPath('t08');
    const logger = new CTSTriageLogger(sandbox);
    logger.setDiscoveredCount(673);
    for (let i = 0; i < 500; i++) {
      logger.recordTestResult(`pass/${i}.html`, { verdict: 'PASS', assertions: [{ success: true, message: 'ok' }], drainedErrors: [], crash: null });
    }
    for (let i = 0; i < 150; i++) {
      logger.recordTestResult(`fail/${i}.html`, { verdict: 'FAIL', assertions: [{ success: false, message: 'bad' }], drainedErrors: [], crash: null });
    }
    for (let i = 0; i < 23; i++) {
      logger.recordSkip(`skip/${i}.html`, 'Shard filtered');
    }
    // Act:
    const summary = logger.finalizeReport();
    // Assert:
    expect(summary.verdictReconciliation.valid).toBe(true);
    expect(summary.totals.discovered).toBe(673);
    expect(summary.totals.executed + summary.totals.skipped).toBe(673);
    expect(summary.totals.executed).toBe(650);
    if (existsSync(sandbox)) unlinkSync(sandbox);
  });
});
