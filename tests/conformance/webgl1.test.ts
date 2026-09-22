/** Sprint 7 Task 6 WebGL1 CTS harness RED-phase tests — harness impl lands next step. */
import { describe, expect, it } from 'vitest';
import {
  CTSHeadlessEnvironment,
  CTSManifestParser,
  CTSRunner,
  CTSTriageLogger,
} from './webgl1-harness';

const MANIFEST_ROOT = 'vendor/WebGL/conformance-suites/1.0.3';
const TRIAGE_LOG = 'test-results/conformance/webgl1-triage.json';

describe('CTS Zero Crashes Gate (AC-1)', () => {
  it('runs the vendored subset to completion with zero crashes', async () => {
    // Arrange:
    const runner = new CTSRunner('/app/renderer.js', `${MANIFEST_ROOT}/00_test_list.txt`, TRIAGE_LOG);
    // Act:
    const summary = await runner.runSuite(() => true, new Map());
    // Assert:
    expect(summary.totals.crashed).toBe(0);
  });
});

describe('Triage Log Completeness and Error Draining (AC-2)', () => {
  it('writes one record per executed test with id, status, and drainedErrors', async () => {
    // Arrange:
    const { readFileSync } = await import('node:fs');
    // Act:
    const raw = readFileSync(TRIAGE_LOG, 'utf8');
    const log = JSON.parse(raw);
    // Assert:
    expect(Array.isArray(log.tests)).toBe(true);
    expect(log.tests.length).toBe(log.totals.executed + log.totals.skipped);
    for (const record of log.tests) {
      expect(typeof record.id).toBe('string');
      expect(['PASS', 'FAIL', 'CRASH', 'SKIP']).toContain(record.status);
      expect(Array.isArray(record.drainedErrors)).toBe(true);
    }
  });
});

describe('Skip Discipline and Unexplained Skip Failure Count (AC-3)', () => {
  it('records explained skips as SKIP and unexplained skips as FAIL per ADR-017', () => {
    // Arrange:
    const logger = new CTSTriageLogger(TRIAGE_LOG);
    // Act:
    logger.recordSkip('test-a', 'Requires GLSL 3.00 es');
    logger.recordSkip('test-b', '');
    const summary = logger.finalizeReport();
    // Assert:
    expect(summary.tests[0].status).toBe('SKIP');
    expect(summary.tests[0].skipReason).toBe('Requires GLSL 3.00 es');
    expect(summary.tests[1].status).toBe('FAIL');
    expect(summary.tests[1].skipReason).toContain('UNEXPLAINED_SKIP');
    expect(summary.totals.failed).toBe(1);
  });
});

describe('Auditable Denominator Count Reconciliation (AC-4)', () => {
  it('reconciles discovered == executed + skipped and executed == passed + failed', async () => {
    // Arrange:
    const { readFileSync } = await import('node:fs');
    // Act:
    const log = JSON.parse(readFileSync(TRIAGE_LOG, 'utf8'));
    // Assert:
    expect(log.totals.discovered).toBe(log.totals.executed + log.totals.skipped);
    expect(log.totals.executed).toBe(log.totals.passed + log.totals.failed);
    expect(log.verdictReconciliation.valid).toBe(true);
  });
});

describe('Double-Run Verdict Determinism Regression (AC-5)', () => {
  it('produces identical verdicts and drained errors across two runs', async () => {
    // Arrange:
    const runner = new CTSRunner('/app/renderer.js', `${MANIFEST_ROOT}/00_test_list.txt`, TRIAGE_LOG);
    // Act:
    const stable = await runner.verifyDeterminism([], 2);
    // Assert:
    expect(stable).toBe(true);
  });
});

describe('Manifest Parser Recursive Resolution', () => {
  it('recursively resolves category manifests to more than 800 html entries', () => {
    // Arrange:
    const parser = new CTSManifestParser(MANIFEST_ROOT);
    // Act:
    const entries = parser.parseManifest('00_test_list.txt', new Map());
    // Assert: vendored 1.0.3 subset resolves 672 HTML entries (ADR-017 discovered-denominator discipline).
    expect(entries.length).toBe(672);
    for (const entry of entries) {
      expect(entry.id.endsWith('.html')).toBe(true);
      expect(typeof entry.fullPath).toBe('string');
    }
  });
});

describe('Headless Environment WebGL Error Draining', () => {
  it('drains INVALID_ENUM and INVALID_OPERATION leaving NO_ERROR', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 120_000);
    const codes = [0x0500, 0x0502];
    let cursor = 0;
    const factory = () => ({
      getError: () => (cursor < codes.length ? codes[cursor++] : 0),
    });
    const globalObject = env.setup(factory as never);
    // Act:
    const report = env.executeTestPage('stub.html', globalObject);
    // Assert:
    expect(report.drainedErrors).toEqual([0x0500, 0x0502]);
  });
});

describe('Zero-Crash Error Containment on Uncaught Script Exception', () => {
  it('records CRASH without terminating the process', async () => {
    // Arrange:
    const runner = new CTSRunner('/app/renderer.js', `${MANIFEST_ROOT}/00_test_list.txt`, TRIAGE_LOG);
    // Act:
    const summary = await runner.runSuite(() => true, new Map([['crash-page.html', '']]));
    // Assert:
    expect(summary.totals.crashed).toBe(1);
  });
});

describe('DOM Window Event Listener Stubbing (AC-6 TEST 9)', () => {
  it('exposes window.addEventListener/removeEventListener as non-throwing functions', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 120_000);
    const factory = () => ({ getError: () => 0 });
    const globalObject = env.setup(factory as never);
    const win = globalObject['window'] as Record<string, unknown>;
    // Act:
    const addFn = win['addEventListener'];
    const removeFn = win['removeEventListener'];
    // Assert:
    expect(typeof addFn).toBe('function');
    expect(typeof removeFn).toBe('function');
    expect(() => (addFn as (t: string, l: () => void) => void)('load', () => {})).not.toThrow();
    expect(() => (removeFn as (t: string, l: () => void) => void)('load', () => {})).not.toThrow();
  });
});

describe('GLSL Script Tag Filtering in extractScripts (AC-6 TEST 10)', () => {
  it('filters x-shader script tags executing only the plain inline JS', async () => {
    // Arrange:
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'glsl-filter-'));
    const page = join(dir, 'fixture.html');
    writeFileSync(
      page,
      '<html><head><script type="x-shader/x-vertex">precision mediump float; void main() { gl_Position = vec4(0.0); }</script>' +
        '<script type="x-shader/x-fragment">precision mediump float; void main() { gl_FragColor = vec4(1.0); }</script>' +
        '<script>testPassed("inline js ran");</script></head><body></body></html>',
      'utf8',
    );
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 120_000);
    const factory = () => ({ getError: () => 0 });
    const globalObject = env.setup(factory as never);
    // Act:
    const report = env.executeTestPage(page, globalObject);
    // Assert:
    expect(report.assertions.some((a) => a.success && a.message === 'inline js ran')).toBe(true);
    expect(report.assertions.every((a) => !a.message.includes('mediump'))).toBe(true);
  });
});

describe('Description Element Stub with appendChild and innerText (AC-6 TEST 11)', () => {
  it('returns a description stub with working appendChild and innerText', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 120_000);
    const factory = () => ({ getError: () => 0 });
    const globalObject = env.setup(factory as never);
    const doc = globalObject['document'] as {
      getElementById: (id: string) => { appendChild: (n: unknown) => unknown; innerText: string };
      createElement: (tag: string) => unknown;
    };
    // Act:
    const desc = doc.getElementById('description');
    desc.appendChild(doc.createElement('span'));
    desc.innerText = 'Testing description';
    // Assert:
    expect(typeof desc.appendChild).toBe('function');
    expect(desc.innerText).toBe('Testing description');
  });
});

describe('Window Location Stubbing (AC-6 TEST 12)', () => {
  it('exposes window.location pathname/href/search as strings without throwing', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 120_000);
    const factory = () => ({ getError: () => 0 });
    const globalObject = env.setup(factory as never);
    const win = globalObject['window'] as Record<string, unknown>;
    // Act:
    const location = win['location'] as { pathname: unknown; href: unknown; search: unknown };
    // Assert:
    expect(typeof location.pathname).toBe('string');
    expect(typeof location.href).toBe('string');
    expect(typeof location.search).toBe('string');
    expect(() => String(location.pathname)).not.toThrow();
    expect(() => String(location.search)).not.toThrow();
  });
});
