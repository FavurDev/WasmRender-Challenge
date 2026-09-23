/** Sprint 10 Task 7 CTS threshold report — RED-phase vitest suite (module not yet implemented). */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CTSReportAggregator,
  InvalidManifestError,
  ReconciliationError,
  ThresholdReportFormatter,
} from './cts-threshold-report';

function buildTriageLog(totals: Record<string, number>, tests: unknown[] = []): unknown {
  return { totals, tests };
}

describe('test_webgl1_metric_extraction', () => {
  it('extracts WebGL1 counts and pass rate against 10/673 baseline', () => {
    // Arrange:
    const aggregator = new CTSReportAggregator();
    const log = buildTriageLog({ discovered: 673, executed: 673, passed: 10, failed: 663, crashed: 0, skipped: 0 });
    // Act:
    const metrics = aggregator.aggregateSuite('webgl1', log);
    // Assert:
    expect(metrics.discovered).toBe(673);
    expect(metrics.passed).toBe(10);
    expect(metrics.failed).toBe(663);
    expect(metrics.passRate.toFixed(2)).toBe('1.49');
  });
});

describe('test_webgl2_metric_extraction', () => {
  it('extracts WebGL2 counts and pass rate against 16/2598 baseline', () => {
    // Arrange:
    const aggregator = new CTSReportAggregator();
    const log = buildTriageLog({ discovered: 2598, executed: 2598, passed: 16, failed: 2582, crashed: 0, skipped: 0 });
    // Act:
    const metrics = aggregator.aggregateSuite('webgl2', log);
    // Assert:
    expect(metrics.discovered).toBe(2598);
    expect(metrics.passed).toBe(16);
    expect(metrics.passRate.toFixed(2)).toBe('0.62');
  });
});

describe('test_verdict_reconciliation', () => {
  it('holds strict arithmetic closure and raises ReconciliationError on mismatch', () => {
    // Arrange:
    const aggregator = new CTSReportAggregator();
    const validLog = buildTriageLog({ discovered: 100, executed: 80, passed: 70, failed: 10, crashed: 0, skipped: 20 });
    const invalidLog = buildTriageLog({ discovered: 100, executed: 80, passed: 70, failed: 10, crashed: 0, skipped: 15 });
    // Act:
    const resultValid = aggregator.checkReconciliation(validLog);
    // Assert:
    expect(resultValid).toBe(true);
    expect(() => aggregator.checkReconciliation(invalidLog)).toThrow(ReconciliationError);
    expect(() => aggregator.checkReconciliation(invalidLog)).toThrow('discovered != executed + skipped');
  });
});

describe('test_threshold_gap_calculation', () => {
  it('calculates residual gap and tests needed without altering gates', () => {
    // Arrange:
    const aggregator = new CTSReportAggregator();
    // Act:
    const gap1 = aggregator.calculateGap('webgl1', 673, 10);
    const gap2 = aggregator.calculateGap('webgl2', 2598, 16);
    // Assert:
    expect(gap1.passGap.toFixed(2)).toBe('93.51');
    expect(gap1.testsNeeded).toBe(630);
    expect(gap2.passGap.toFixed(2)).toBe('89.38');
    expect(gap2.testsNeeded).toBe(2323);
    expect(gap1.targetGate).toBe(95.0);
    expect(gap2.targetGate).toBe(90.0);
  });
});

describe('test_root_cause_distribution', () => {
  it('tallies failures deterministically with unclassified defaulting to G1', () => {
    // Arrange:
    const aggregator = new CTSReportAggregator();
    const records: unknown[] = [];
    for (let i = 0; i < 10; i += 1) records.push({ status: 'FAIL', rootCauseGroup: 'G1' });
    for (let i = 0; i < 5; i += 1) records.push({ status: 'FAIL', rootCauseGroup: 'G2' });
    for (let i = 0; i < 8; i += 1) records.push({ status: 'FAIL', rootCauseGroup: 'G3' });
    for (let i = 0; i < 2; i += 1) records.push({ status: 'FAIL', rootCauseGroup: 'G4' });
    records.push({ status: 'FAIL' });
    // Act:
    const distribution = aggregator.tallyRootCauses(records);
    // Assert:
    expect(distribution.G1).toBe(11);
    expect(distribution.G2).toBe(5);
    expect(distribution.G3).toBe(8);
    expect(distribution.G4).toBe(2);
    expect(distribution.total).toBe(26);
  });
});

describe('test_threshold_report_generation', () => {
  it('emits JSON and Markdown threshold reports to temp paths', () => {
    // Arrange:
    const dir = mkdtempSync(join(tmpdir(), 'cts-threshold-'));
    const mdPath = join(dir, 'threshold-report.md');
    const jsonPath = join(dir, 'threshold-report.json');
    const metrics = {
      suites: { webgl1: { discovered: 673, passed: 10 }, webgl2: { discovered: 2598, passed: 16 } },
      reconciliationValid: true,
    };
    // Act:
    const ok = ThresholdReportFormatter.writeReports(metrics, mdPath, jsonPath);
    // Assert:
    expect(ok).toBe(true);
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    expect(json.suites.webgl1).toBeDefined();
    expect(json.suites.webgl2).toBeDefined();
    expect(json.reconciliationValid).toBe(true);
    const md = readFileSync(mdPath, 'utf8');
    expect(md).toContain('# Sprint 10 CTS Conformance Threshold & Gap Report');
    expect(md).toContain('Executive Summary');
    expect(md).toContain('Reconciliation');
    expect(md).toContain('Root Cause Attribution');
  });
});

describe('test_zero_discovered_tests_error', () => {
  it('throws InvalidManifestError when discovered count is zero', () => {
    // Arrange:
    const aggregator = new CTSReportAggregator();
    const emptyLog = buildTriageLog({ discovered: 0, executed: 0, passed: 0, failed: 0, crashed: 0, skipped: 0 });
    // Act & Assert:
    expect(() => aggregator.aggregateSuite('webgl1', emptyLog)).toThrow(InvalidManifestError);
  });
});

describe('test_unexplained_skips_accounted_in_gap', () => {
  it('counts unexplained skips as non-passing in rate and gap', () => {
    // Arrange:
    const aggregator = new CTSReportAggregator();
    const tests: unknown[] = [];
    for (let i = 0; i < 10; i += 1) tests.push({ status: 'PASS' });
    for (let i = 0; i < 20; i += 1) tests.push({ status: 'FAIL' });
    for (let i = 0; i < 5; i += 1) tests.push({ status: 'SKIP', skipReason: 'UNEXPLAINED_SKIP' });
    const log = buildTriageLog({ discovered: 35, executed: 30, passed: 10, failed: 20, crashed: 0, skipped: 5 }, tests);
    // Act:
    const metrics = aggregator.aggregateSuite('webgl1', log);
    // Assert:
    expect(metrics.passed).toBe(10);
    expect(metrics.passRate.toFixed(2)).toBe('28.57');
    expect(metrics.testsNeeded).toBe(Math.ceil(0.95 * 35) - 10);
  });
});
