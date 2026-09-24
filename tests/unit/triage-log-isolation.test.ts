/** Sprint 11 Task 4 (TD-025): triage-log isolation RED-phase tests (Test Cases 1-7). */
import { existsSync, readFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  __resetTriageRenameSync,
  __setTriageRenameSync,
  CTSRunner,
  CTSTriageLogger,
  WEBGL1_TRIAGE_LOG,
  WEBGL2_TRIAGE_LOG,
  createRunScopedLogPath,
} from '../conformance/webgl1-harness';

const created: string[] = [];
function track(p: string): string {
  created.push(p);
  return p;
}

afterAll(() => {
  for (const p of created) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch {
      // best-effort cleanup
    }
  }
});

describe('Triage Log Isolation Suite (TD-025)', () => {
  it('synthetic fixture writing triage data leaves production webgl1-triage.json untouched', () => {
    // Arrange
    const productionPath = WEBGL1_TRIAGE_LOG;
    const prodStat = statSync(productionPath);
    const prodMtime = prodStat.mtimeMs;
    const prodSize = prodStat.size;
    const prodContent = readFileSync(productionPath, 'utf8');
    const sandboxPath = track(createRunScopedLogPath('synth-test'));
    const logger = new CTSTriageLogger(sandboxPath);
    try {
      // Act
      logger.recordTestResult('synth-case-1', {
        verdict: 'FAIL',
        assertions: [{ success: false, message: 'synthetic failure probe' }],
        drainedErrors: [],
        crash: null,
      });
      logger.finalizeReport();
      // Assert
      expect(existsSync(sandboxPath)).toBe(true);
      expect(readFileSync(productionPath, 'utf8')).toBe(prodContent);
      expect(statSync(productionPath).mtimeMs).toBe(prodMtime);
      expect(statSync(productionPath).size).toBe(prodSize);
    } finally {
      try {
        if (existsSync(sandboxPath)) unlinkSync(sandboxPath);
      } catch {
        // ignore
      }
    }
  });

  it('two concurrent/sequential runs produce distinct log paths and do not clobber', () => {
    // Arrange
    const pathA = track(createRunScopedLogPath('runA'));
    const pathB = track(createRunScopedLogPath('runB'));
    const loggerA = new CTSTriageLogger(pathA);
    const loggerB = new CTSTriageLogger(pathB);
    try {
      // Act
      loggerA.recordTestResult('test-a', { verdict: 'PASS', assertions: [], drainedErrors: [], crash: null });
      const summaryA = loggerA.finalizeReport();
      loggerB.recordTestResult('test-b', {
        verdict: 'FAIL',
        assertions: [{ success: false, message: 'failed' }],
        drainedErrors: [],
        crash: null,
      });
      const summaryB = loggerB.finalizeReport();
      // Assert
      expect(pathA).not.toBe(pathB);
      const logA = JSON.parse(readFileSync(pathA, 'utf8'));
      const logB = JSON.parse(readFileSync(pathB, 'utf8'));
      expect(logA.totals.passed).toBe(1);
      expect(logA.totals.failed).toBe(0);
      expect(logB.totals.passed).toBe(0);
      expect(logB.totals.failed).toBe(1);
      expect(summaryA.tests.map((t) => t.id)).not.toContain('test-b');
      expect(summaryB.tests.map((t) => t.id)).not.toContain('test-a');
    } finally {
      for (const p of [pathA, pathB]) {
        try {
          if (existsSync(p)) unlinkSync(p);
        } catch {
          // ignore
        }
      }
    }
  });

  it('atomic write lands canonical production path without leaving temporary artifacts', () => {
    // Arrange
    const testProdPath = track(join(tmpdir(), `canonical-test-${process.pid}-${Date.now()}.json`));
    const logger = new CTSTriageLogger(testProdPath);
    try {
      // Act
      logger.recordTestResult('test-c', { verdict: 'PASS', assertions: [], drainedErrors: [], crash: null });
      const summary = logger.finalizeReport();
      // Assert
      expect(existsSync(testProdPath)).toBe(true);
      expect(summary.verdictReconciliation.valid).toBe(true);
      const leftovers = readdirSync(tmpdir()).filter((f) => f.startsWith(basename(testProdPath)) && f.endsWith('.tmp'));
      expect(leftovers.length).toBe(0);
    } finally {
      try {
        if (existsSync(testProdPath)) unlinkSync(testProdPath);
      } catch {
        // ignore
      }
    }
  });

  it('CTSRunner with isolated option defaults to non-production run-scoped log', () => {
    // Arrange
    const runner = new CTSRunner(
      '/app/renderer.js',
      'vendor/WebGL/conformance-suites/1.0.3/00_test_list.txt',
      undefined,
      'webgl',
      { isolated: true },
    );
    // Act
    const resolvedPath = runner.options.triageLogPath as unknown as string;
    // Assert
    expect(resolvedPath).not.toBe(WEBGL1_TRIAGE_LOG);
    expect(resolvedPath).not.toBe(WEBGL2_TRIAGE_LOG);
    expect(typeof resolvedPath === 'string' ? resolvedPath : '').toContain('cts-runner-run');
  });

  it('finalizeReport falls back to copy and unlink if renameSync throws', () => {
    // Arrange
    const testTarget = track(join(tmpdir(), `fallback-test-${process.pid}-${Date.now()}.json`));
    const logger = new CTSTriageLogger(testTarget);
    __setTriageRenameSync(() => {
      throw new Error('EBUSY: resource locked');
    });
    try {
      // Act
      logger.recordTestResult('test-lock', { verdict: 'PASS', assertions: [], drainedErrors: [], crash: null });
      const summary = logger.finalizeReport();
      // Assert
      expect(existsSync(testTarget)).toBe(true);
      expect(summary.totals.passed).toBe(1);
    } finally {
      __resetTriageRenameSync();
      try {
        if (existsSync(testTarget)) unlinkSync(testTarget);
      } catch {
        // ignore
      }
    }
  });

  it('full WebGL1 CTS re-run regenerates webgl1-triage.json with valid reconciliation and zero crashes', () => {
    // Arrange
    const target = WEBGL1_TRIAGE_LOG;
    // Act
    const log = JSON.parse(readFileSync(target, 'utf8'));
    // Assert
    expect(log.totals.discovered).toBe(672);
    expect(log.totals.crashed).toBe(0);
    expect(log.totals.executed + log.totals.skipped).toBe(log.totals.discovered);
    expect(log.totals.passed + log.totals.failed).toBe(log.totals.executed);
    expect(log.verdictReconciliation.valid).toBe(true);
  });

  it('every non-passing or skipped test in regenerated log carries valid classification and root cause', () => {
    // Arrange
    const target = WEBGL1_TRIAGE_LOG;
    const log = JSON.parse(readFileSync(target, 'utf8'));
    // Act
    const nonPasses = log.tests.filter((t: { status: string }) => t.status !== 'PASS');
    // Assert
    expect(nonPasses.length).toBeGreaterThan(0);
    const validClass = ['spec-defect', 'float-edge', 'missing-entry-point', 'harness-limitation'];
    const validGroup = ['G1', 'G2', 'G3', 'G4'];
    for (const t of nonPasses) {
      expect(validClass).toContain(t.classification);
      expect(validGroup).toContain(t.rootCauseGroup);
      expect(t.classification).not.toBeUndefined();
      expect(t.rootCauseGroup).not.toBeUndefined();
    }
  });
});
