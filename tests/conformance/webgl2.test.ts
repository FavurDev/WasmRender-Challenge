/** Sprint 8 Fix 6: WebGL2 CTS conformance harness RED-phase tests. */
import { describe, expect, it } from 'vitest';
import { CTSRunner } from './webgl1-harness';

const MANIFEST_ROOT = 'vendor/WebGL/conformance-suites/2.0.0';
const TRIAGE_LOG = 'test-results/conformance/webgl2-triage.json';

describe('WebGL2 CTS Zero Crashes Gate (TEST 4.1)', () => {
  it('runs the vendored WebGL2 subset to completion with zero crashes', async () => {
    // Arrange:
    const runner = new CTSRunner('/app/renderer.js', `${MANIFEST_ROOT}/00_test_list.txt`, TRIAGE_LOG);
    // Act:
    const summary = await runner.runSuite(() => true, new Map());
    // Assert:
    expect(summary.totals.crashed).toBe(0);
  });
});

describe('WebGL2 Triage Log Completeness and Reconciliation (TEST 4.2)', () => {
  it('writes a complete triage log with reconciled denominators', async () => {
    // Arrange:
    const { readFileSync } = await import('node:fs');
    // Act:
    const log = JSON.parse(readFileSync(TRIAGE_LOG, 'utf8'));
    // Assert:
    expect(Array.isArray(log.tests)).toBe(true);
    expect(log.totals.discovered).toBe(log.totals.executed + log.totals.skipped);
    expect(log.verdictReconciliation.valid).toBe(true);
  });

  it('produces identical verdicts across two runs (double-run stability)', async () => {
    // Arrange:
    const runner = new CTSRunner('/app/renderer.js', `${MANIFEST_ROOT}/00_test_list.txt`, TRIAGE_LOG);
    // Act:
    const stable = await runner.verifyDeterminism([], 2);
    // Assert:
    expect(stable).toBe(true);
  });
});
