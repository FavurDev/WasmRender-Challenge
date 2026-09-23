/** Generate real threshold-report.json/.md from refreshed triage logs (read-only). */
import { readFileSync } from 'node:fs';
import { CTSReportAggregator, ThresholdReportFormatter } from '../tests/conformance/cts-threshold-report.ts';

const w1 = JSON.parse(readFileSync('test-results/conformance/webgl1-triage.json', 'utf8'));
const w2 = JSON.parse(readFileSync('test-results/conformance/webgl2-triage.json', 'utf8'));
const agg = new CTSReportAggregator();
const m1 = agg.aggregateSuite('webgl1', w1);
const m2 = agg.aggregateSuite('webgl2', w2);
const metrics = { suites: { webgl1: m1, webgl2: m2 }, reconciliationValid: true };
ThresholdReportFormatter.writeReports(
  metrics,
  'test-results/conformance/threshold-report.md',
  'test-results/conformance/threshold-report.json',
);
console.log(JSON.stringify({ webgl1: m1.passRateFormatted, webgl2: m2.passRateFormatted }));
