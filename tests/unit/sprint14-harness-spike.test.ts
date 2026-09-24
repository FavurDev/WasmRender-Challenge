/** Sprint 14 Task 2 spike suite (NO_LIFT_STOP outcome).
 *
 * The time-boxed XHR/inline-script deepening measured +0.00pp on both CTS
 * suites, so per the ADR-006 stop rule tests/conformance/webgl1-harness.ts
 * was reverted to HEAD. This suite locks in: (a) the HEAD-harness XHR/script
 * behaviors the spike verified, exercised through the public
 * CTSHeadlessEnvironment surface; (b) the measurement/stop-rule protocol in
 * tests/conformance/spike-measurement.ts; (c) the spike evidence artifact.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CTSHeadlessEnvironment, DOMElementStub } from '../conformance/webgl1-harness';
import {
  computeSpikeDelta,
  evaluateStopRule,
  revertNonLiftingChanges,
  verifyZeroSrcModified,
} from '../conformance/spike-measurement';
import type { SpikeMeasurementDelta } from '../conformance/spike-measurement';
import { createSoftwareWebGLContext } from '../../src/entry';

function makeEnv() {
  const env = new CTSHeadlessEnvironment('dummy-bundle.js', 1000);
  const g = env.setup(() => createSoftwareWebGLContext({ width: 300, height: 150 }) as never);
  return { env, g };
}

function writePage(dir: string, name: string, html: string): string {
  const page = join(dir, name);
  writeFileSync(page, html, 'utf8');
  return page;
}

describe('Case 1: script-src resolution + ordered execution (HEAD harness)', () => {
  it('executes an external helper script before the inline script', () => {
    // Arrange:
    const dir = mkdtempSync(join(tmpdir(), 'td023-xhr-'));
    try {
      writeFileSync(join(dir, 'helper.js'), 'window.helperVal = 42;', 'utf8');
      const page = writePage(
        dir,
        't.html',
        '<html><body><script src="helper.js"></script><script>window.result = window.helperVal + 10; testPassed("ok"); finishTest();</script></body></html>',
      );
      const { env, g } = makeEnv();
      // Act:
      const report = env.executeTestPage(page, g);
      // Assert:
      expect(report.verdict).toBe('PASS');
      expect((g['window'] as Record<string, unknown>)['result']).toBe(52);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('records a missing external script as a failed assertion stub', () => {
    // Arrange:
    const dir = mkdtempSync(join(tmpdir(), 'td023-xhr-'));
    try {
      const scripts = (
        CTSHeadlessEnvironment as unknown as {
          extractScripts: (h: string, b: string, m?: Map<string, DOMElementStub>) => Array<{ code: string }>;
        }
      ).extractScripts('<script src="resources/does-not-exist.js"></script>', dir, new Map());
      // Act: (extraction above)
      // Assert:
      expect(scripts.length).toBe(1);
      expect(scripts[0]?.code ?? '').toContain('Missing script');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Case 2: shader script tag preservation (HEAD harness)', () => {
  it('preserves fragment shader script elements without execution', () => {
    // Arrange:
    const html =
      '<script id="fshader" type="x-shader/x-fragment">precision mediump float; void main() { gl_FragColor = vec4(1.0); }</script>';
    const map = new Map<string, DOMElementStub>();
    // Act:
    const scripts = (
      CTSHeadlessEnvironment as unknown as {
        extractScripts: (h: string, b: string, m?: Map<string, DOMElementStub>) => Array<{ code: string }>;
      }
    ).extractScripts(html, '/tmp', map);
    // Assert:
    expect(scripts.length).toBe(0);
    expect(map.has('fshader')).toBe(true);
    expect(map.get('fshader')?.text).toContain('gl_FragColor = vec4(1.0);');
  });

  it('preserves vertex shader script elements without execution', () => {
    // Arrange:
    const html = '<script id="vshader" type="x-shader/x-vertex">attribute vec4 a;</script>';
    const map = new Map<string, DOMElementStub>();
    // Act:
    const scripts = (
      CTSHeadlessEnvironment as unknown as {
        extractScripts: (h: string, b: string, m?: Map<string, DOMElementStub>) => Array<{ code: string }>;
      }
    ).extractScripts(html, '/tmp', map);
    // Assert:
    expect(scripts.length).toBe(0);
    expect(map.get('vshader')?.text).toContain('attribute vec4 a;');
  });
});

describe('Case 3: XHR file resolution through page scripts (HEAD harness)', () => {
  it('page XHR reads a tmpdir fixture with status 200', () => {
    // Arrange:
    const dir = mkdtempSync(join(tmpdir(), 'td023-xhr-'));
    try {
      writeFileSync(join(dir, 'data.txt'), 'hello-spike', 'utf8');
      const page = writePage(
        dir,
        't.html',
        '<html><body><script>var xhr = new XMLHttpRequest(); xhr.open("GET", "data.txt"); xhr.send(); if (xhr.status === 200 && xhr.responseText.indexOf("hello-spike") !== -1) { testPassed("xhr-ok"); } else { testFailed("xhr bad: " + xhr.status); } finishTest();</script></body></html>',
      );
      const { env, g } = makeEnv();
      // Act:
      const report = env.executeTestPage(page, g);
      // Assert:
      expect(report.verdict).toBe('PASS');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('page XHR strips query strings and fragments before resolving', () => {
    // Arrange:
    const dir = mkdtempSync(join(tmpdir(), 'td023-xhr-'));
    try {
      writeFileSync(join(dir, 'test.json'), '{"a":1}', 'utf8');
      const page = writePage(
        dir,
        't.html',
        '<html><body><script>var xhr = new XMLHttpRequest(); xhr.open("GET", "test.json?nocache=123#frag"); xhr.send(); if (xhr.status === 200 && xhr.responseText.indexOf("\\"a\\":1") !== -1) { testPassed("xhr-ok"); } else { testFailed("xhr bad: " + xhr.status); } finishTest();</script></body></html>',
      );
      const { env, g } = makeEnv();
      // Act:
      const report = env.executeTestPage(page, g);
      // Assert:
      expect(report.verdict).toBe('PASS');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('page XHR overrideMimeType does not throw', () => {
    // Arrange:
    const dir = mkdtempSync(join(tmpdir(), 'td023-xhr-'));
    try {
      writeFileSync(join(dir, 'test.data'), 'raw-data', 'utf8');
      const page = writePage(
        dir,
        't.html',
        '<html><body><script>var xhr = new XMLHttpRequest(); xhr.open("GET", "test.data"); xhr.overrideMimeType("text/plain; charset=x-user-defined"); xhr.send(); if (xhr.status === 200) { testPassed("xhr-ok"); } else { testFailed("xhr bad: " + xhr.status); } finishTest();</script></body></html>',
      );
      const { env, g } = makeEnv();
      // Act:
      const report = env.executeTestPage(page, g);
      // Assert:
      expect(report.verdict).toBe('PASS');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Case 4: falsifiable measurement delta calculation', () => {
  it('computes exact percentage-point deltas against the v5 baseline', () => {
    // Arrange:
    const baseline = { webgl1: { passed: 13, total: 672 }, webgl2: { passed: 20, total: 2598 } };
    const post = { webgl1: { passed: 15, total: 672 }, webgl2: { passed: 20, total: 2598 } };
    // Act:
    const d1: SpikeMeasurementDelta = computeSpikeDelta('webgl1', baseline.webgl1.passed, post.webgl1.passed, post.webgl1.total);
    const d2: SpikeMeasurementDelta = computeSpikeDelta('webgl2', baseline.webgl2.passed, post.webgl2.passed, post.webgl2.total);
    // Assert:
    expect(d1.deltaPercentagePoints).toBe('+0.30%');
    expect(d2.deltaPercentagePoints).toBe('+0.00%');
    expect(d1.gateVerdict).toBe('GAP_RECORDED');
    expect(d2.gateVerdict).toBe('GAP_RECORDED');
  });

  it('reports no lift for the measured zero-delta outcome', () => {
    // Arrange: measured post-spike counts equal the v5 baseline.
    // Act:
    const d1 = computeSpikeDelta('webgl1', 13, 13, 672);
    const d2 = computeSpikeDelta('webgl2', 20, 20, 2598);
    // Assert:
    expect(d1.deltaPercentagePoints).toBe('+0.00%');
    expect(d2.deltaPercentagePoints).toBe('+0.00%');
    expect(d1.liftAchieved).toBe(false);
    expect(d2.liftAchieved).toBe(false);
  });
});

describe('Case 5: stop-rule revert', () => {
  it('evaluates NO_LIFT_STOP and issues git checkout on webgl1-harness.ts', () => {
    // Arrange:
    const executor = vi.fn().mockReturnValue(0);
    // Act:
    const verdict = evaluateStopRule(0, 0);
    revertNonLiftingChanges(executor);
    // Assert:
    expect(verdict).toBe('NO_LIFT_STOP');
    expect(executor).toHaveBeenCalledWith('git checkout tests/conformance/webgl1-harness.ts');
  });

  it('invokes the revert exactly once naming webgl1-harness.ts', () => {
    // Arrange:
    const executor = vi.fn().mockReturnValue(0);
    // Act:
    revertNonLiftingChanges(executor);
    // Assert:
    expect(executor).toHaveBeenCalledTimes(1);
    expect(String(executor.mock.calls[0]?.[0] ?? '')).toContain('webgl1-harness.ts');
  });
});

describe('Case 6: src immutability and spike evidence', () => {
  it('verification confirms zero src/ renderer files modified', () => {
    // Arrange:
    const files = ['tests/conformance/webgl1-harness.ts', 'tests/unit/sprint14-harness-spike.test.ts'];
    // Act:
    const matched = files.filter((f) => f.startsWith('src/'));
    const report = verifyZeroSrcModified(files);
    // Assert:
    expect(matched.length).toBe(0);
    expect(report.zeroSrcModified).toBe(true);
  });

  it('spike-report.json records the NO_LIFT_STOP verdict', () => {
    // Arrange:
    const reportPath = join(process.cwd(), 'test-results', 'conformance', 'spike-report.json');
    // Act:
    const exists = existsSync(reportPath);
    const raw = exists ? readFileSync(reportPath, 'utf8') : '{}';
    const report = JSON.parse(raw) as { verdict?: string };
    // Assert:
    expect(exists).toBe(true);
    expect(report.verdict).toBe('NO_LIFT_STOP');
  });
});
