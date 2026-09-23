/** TD-015/TD-016 harness closure RED-phase tests — harness impl lands next step. */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CTSHeadlessEnvironment,
  CTSManifestParser,
  CTSRunner,
  CTSTriageLogger,
} from '../conformance/webgl1-harness';
import type { ExecutionReport } from '../conformance/webgl1-harness';

function harnessModule(): Record<string, unknown> {
  // Type-safe dynamic view: missing exports read as undefined (tsc-clean, vitest-red).
  return CTSManifestParser as unknown as Record<string, unknown>;
}

async function harnessAsync(): Promise<Record<string, unknown>> {
  const mod = (await import('../conformance/webgl1-harness')) as unknown as Record<string, unknown>;
  return mod;
}

describe('TD-015 path constants export and integrity (TEST 1)', () => {
  it('exports single shared path definitions consumed by both suites', async () => {
    // Arrange:
    const mod = await harnessAsync();
    // Act:
    const w1r = mod['WEBGL1_MANIFEST_ROOT'];
    const w1t = mod['WEBGL1_TRIAGE_LOG'];
    const w2r = mod['WEBGL2_MANIFEST_ROOT'];
    const w2t = mod['WEBGL2_TRIAGE_LOG'];
    // Assert:
    expect(w1r).toBe('vendor/WebGL/conformance-suites/1.0.3');
    expect(w1t).toBe('test-results/conformance/webgl1-triage.json');
    expect(w2r).toBe('vendor/WebGL/conformance-suites/2.0.0');
    expect(w2t).toBe('test-results/conformance/webgl2-triage.json');
  });
});

describe('TD-015 resolveChildPath helper equivalence (TEST 2)', () => {
  it('resolves child paths identically to the inline ternary', () => {
    // Arrange:
    const parserClass = harnessModule()['resolveChildPath'] as unknown as
      | ((a: string, b: string) => string)
      | undefined;
    // Act:
    const dotRes = parserClass?.('.', 'sub/test.html');
    const dirRes = parserClass?.('conformance/glsl', '00_test_list.txt');
    // Assert:
    expect(dotRes).toBe('sub/test.html');
    expect(dirRes).toBe('conformance/glsl/00_test_list.txt');
  });
});

describe('TD-015 full 672-entry manifest invariance (TEST 3)', () => {
  it('parseManifest resolves identical 672 entries using extracted helper', async () => {
    // Arrange:
    const mod = await harnessAsync();
    const root = mod['WEBGL1_MANIFEST_ROOT'] as string;
    const parser = new CTSManifestParser(root);
    // Act:
    const entries = parser.parseManifest('00_test_list.txt', new Map());
    // Assert:
    expect(entries.length).toBe(672);
    expect(entries.every((e) => e.id.endsWith('.html'))).toBe(true);
  });
});

describe('TD-015 injected TIMEOUT verdict and status in triage logger (TEST 4)', () => {
  it('records TIMEOUT verdict and status when script execution times out', () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'td015-timeout-'));
    const testLogPath = join(tempDir, 'triage-timeout-test.json');
    const logger = new CTSTriageLogger(testLogPath);
    const timeoutReport: ExecutionReport = {
      verdict: 'TIMEOUT',
      assertions: [{ success: false, message: 'Script timeout in test.js: Script execution timed out after 50ms' }],
      drainedErrors: [],
      crash: null,
    };
    // Act:
    logger.setDiscoveredCount(1);
    logger.recordTestResult('conformance/timeout-test.html', timeoutReport);
    const summary = logger.finalizeReport();
    // Assert:
    expect(summary.totals.executed).toBe(1);
    expect(summary.totals.failed).toBe(1);
    expect(summary.totals.passed).toBe(0);
    expect(summary.totals.crashed).toBe(0);
    expect(summary.tests[0].id).toBe('conformance/timeout-test.html');
    expect(summary.tests[0].status).toBe('TIMEOUT');
    expect(summary.tests[0].passed).toBe(false);
    expect(summary.tests[0].classification).toBe('harness-limitation');
    expect(summary.tests[0].rootCauseGroup).toBe('G4');
    expect(summary.verdictReconciliation.valid).toBe(true);
  });
});

describe('TD-015 headless env TIMEOUT on infinite loop (TEST 5)', () => {
  it('emits TIMEOUT verdict on infinite-loop script with 50ms timeout', () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'td015-loop-'));
    const loopHtml = join(tempDir, 'loop.html');
    writeFileSync(loopHtml, '<html><head><script>while(true){}</script></head><body></body></html>');
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 50);
    const factory = (): { getError: () => number } => ({ getError: () => 0 });
    const globalObject = env.setup(factory);
    // Act:
    const report = env.executeTestPage(loopHtml, globalObject);
    // Assert:
    expect(report.verdict).toBe('TIMEOUT');
    expect(report.assertions.length).toBeGreaterThanOrEqual(1);
    expect(report.assertions[0].success).toBe(false);
    expect(report.assertions[0].message).toContain('Script timeout');
    expect(report.assertions[0].message).toContain('Script execution timed out');
  });
});

describe('TD-015 headless env FAIL on generic error (TEST 6)', () => {
  it('emits FAIL (not TIMEOUT) on generic script error', () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'td015-err-'));
    const errorHtml = join(tempDir, 'error.html');
    writeFileSync(
      errorHtml,
      '<html><head><script>throw new Error("Generic syntax or execution bug");</script></head><body></body></html>',
    );
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 5000);
    const factory = (): { getError: () => number } => ({ getError: () => 0 });
    const globalObject = env.setup(factory);
    // Act:
    const report = env.executeTestPage(errorHtml, globalObject);
    // Assert:
    expect(report.verdict).toBe('FAIL');
    expect(report.assertions[0].message).toContain('Script error in');
    expect(report.assertions[0].message).not.toContain('Script timeout');
  });
});

describe('TD-015 verifyDeterminism runs parameter (TEST 7)', () => {
  it('executes configured number of runs and checks consistency', async () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'td015-det-'));
    const logPath = join(tempDir, 'triage-det.json');
    const mod = await harnessAsync();
    const root = mod['WEBGL1_MANIFEST_ROOT'] as string;
    const runner = new CTSRunner('/app/renderer.js', root, logPath);
    const singleEntry = [{ id: 'test-stub.html', fullPath: 'stub.html', options: new Map(), category: 'conformance' }];
    let passCount = 0;
    const proto = CTSHeadlessEnvironment.prototype as unknown as Record<string, unknown>;
    const orig = proto['executeTestPage'] as (this: unknown, ...a: unknown[]) => unknown;
    (proto as Record<string, unknown>)['executeTestPage'] = function (this: unknown, ...args: unknown[]): unknown {
      passCount += 1;
      return (orig as (this: unknown, ...a: unknown[]) => unknown).apply(this, args);
    };
    try {
      // Act:
      passCount = 0;
      const stableRuns1 = await runner.verifyDeterminism(singleEntry, 1);
      const count1 = passCount;
      passCount = 0;
      const stableRuns3 = await runner.verifyDeterminism(singleEntry, 3);
      const count3 = passCount;
      // Assert:
      expect(stableRuns1).toBe(true);
      expect(count1).toBe(1);
      expect(stableRuns3).toBe(true);
      expect(count3).toBe(3);
    } finally {
      (proto as Record<string, unknown>)['executeTestPage'] = orig;
    }
  });
});

describe('TD-016 stale RED-phase header removed (TEST 8)', () => {
  it('webgl1.test.ts header reflects current conformance status', async () => {
    // Arrange:
    const fs = await import('node:fs');
    const firstLine = fs.readFileSync('tests/conformance/webgl1.test.ts', 'utf8').split('\n')[0] ?? '';
    void readFileSync;
    // Act:
    const content = firstLine;
    // Assert:
    expect(content).not.toContain('RED-phase');
    expect(content).not.toContain('Sprint 7 Task 6');
    expect(content).toContain('WebGL1 CTS conformance');
  });
});
