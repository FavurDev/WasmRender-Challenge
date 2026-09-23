/** Triage classification unit tests (Sprint 9 Task 3 — RED phase) + F5 shader diagnostic exactness. */
import { describe, expect, it } from 'vitest';
import { CTSTriageLogger, classifyFailure } from '../conformance/webgl1-harness';
import { createSoftwareWebGLContext } from '../../src/entry';

describe('classifyFailure mapping G1-G4', () => {
  it('maps shader compile failure to spec-defect/G1', () => {
    // Arrange
    const id = 'conformance/gl-shader-test.html';
    // Act
    const result = classifyFailure(id, 'FAIL', [], 'Compile failed', [
      { success: false, message: 'Compile failed' },
    ]);
    // Assert
    expect(result.classification).toBe('spec-defect');
    expect(result.rootCauseGroup).toBe('G1');
  });

  it('maps missing entry point crash to missing-entry-point/G2', () => {
    // Arrange
    const id = 'conformance/entry.html';
    // Act
    const result = classifyFailure(id, 'CRASH', [], 'finish is not a function', []);
    // Assert
    expect(result.classification).toBe('missing-entry-point');
    expect(result.rootCauseGroup).toBe('G2');
  });

  it('maps float tolerance failure to float-edge/G3', () => {
    // Arrange
    const id = 'conformance/precision.html';
    // Act
    const result = classifyFailure(id, 'FAIL', [], null, [
      { success: false, message: 'differs by 0.0001 within float epsilon' },
    ]);
    // Assert
    expect(result.classification).toBe('float-edge');
    expect(result.rootCauseGroup).toBe('G3');
  });

  it('maps harness timeout to harness-limitation/G4', () => {
    // Arrange
    const id = 'conformance/crash-page.html';
    // Act
    const result = classifyFailure(id, 'CRASH', [], 'synthetic uncaught exception: timeout', []);
    // Assert
    expect(result.classification).toBe('harness-limitation');
    expect(result.rootCauseGroup).toBe('G4');
  });
});

describe('CTSTriageLogger classification audit', () => {
  it('records FAIL/CRASH/SKIP with classification fields and valid reconciliation', () => {
    // Arrange
    const logger = new CTSTriageLogger('test-results/test-triage.json');
    // Act
    logger.recordTestResult('conformance/gl-shader-test.html', {
      verdict: 'FAIL',
      assertions: [{ success: false, message: 'Compile failed' }],
      drainedErrors: [],
      crash: null,
    });
    logger.recordTestResult('conformance/entry.html', {
      verdict: 'CRASH',
      assertions: [],
      drainedErrors: [],
      crash: { message: 'finish is not a function' },
    });
    logger.recordTestResult('conformance/precision.html', {
      verdict: 'FAIL',
      assertions: [{ success: false, message: 'differs by 0.0001 within float epsilon' }],
      drainedErrors: [],
      crash: null,
    });
    logger.recordSkip('conformance/ext.html', 'Requires GLSL 3.00 es');
    logger.recordSkip('conformance/unexplained.html', '');
    const summary = logger.finalizeReport();
    // Assert
    const byId = new Map(summary.tests.map((r) => [r.id, r]));
    expect(byId.get('conformance/gl-shader-test.html')?.classification).toBe('spec-defect');
    expect(byId.get('conformance/gl-shader-test.html')?.rootCauseGroup).toBe('G1');
    expect(byId.get('conformance/entry.html')?.classification).toBe('missing-entry-point');
    expect(byId.get('conformance/entry.html')?.rootCauseGroup).toBe('G2');
    expect(byId.get('conformance/precision.html')?.classification).toBe('float-edge');
    expect(byId.get('conformance/precision.html')?.rootCauseGroup).toBe('G3');
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

describe('F5 shader compile diagnostic exactness', () => {
  it('compile failure sets COMPILE_STATUS false, non-empty log, NO_ERROR', () => {
    // Arrange
    const gl = createSoftwareWebGLContext({ width: 300, height: 150 }, null, null);
    if (gl === null) throw new Error('Expected WebGL1 context');
    const shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(shader, 'syntax error source;');
    // Act
    gl.compileShader(shader);
    // Assert
    expect(gl.getShaderParameter(shader, gl.COMPILE_STATUS)).toBe(false);
    expect(gl.getShaderInfoLog(shader).length).toBeGreaterThan(0);
    expect(gl.getError()).toBe(gl.NO_ERROR);
  });
});
