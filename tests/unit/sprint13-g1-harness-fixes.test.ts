/** Sprint 13 remediation red-phase: G1 harness defects (T2 wave). All must FAIL until fixed. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CTSHeadlessEnvironment, DOMElementStub } from '../conformance/webgl1-harness';
import { createSoftwareWebGLContext } from '../../src/entry';

function makeEnv() {
  // Arrange helper: headless env with a software GL factory.
  const env = new CTSHeadlessEnvironment('dummy-bundle.js', 1000);
  const g = env.setup(() => createSoftwareWebGLContext({ width: 300, height: 150 }) as never);
  return { env, g };
}

describe('Sprint13 G1 harness Defect 1: getElementsByTagName numeric indexing', () => {
  it('D1 canvas collection supports [i], length, and item(i)', () => {
    // Arrange:
    const { g } = makeEnv();
    const doc = g['document'] as { getElementsByTagName: (t: string) => any };
    // Act:
    const coll = doc.getElementsByTagName('canvas');
    // Assert:
    expect(coll.length).toBe(1);
    expect(coll[0]).toBeDefined();
    expect((coll[0] as DOMElementStub).tagName).toBe('CANVAS');
    expect(typeof coll.item).toBe('function');
    expect(coll.item(0)).toBe(coll[0]);
  });
});

describe('Sprint13 G1 harness Defect 2: XHR overrideMimeType + inline scripts', () => {
  it('D2 MockXHR exposes overrideMimeType and fires onload for inline-script env', () => {
    // Arrange:
    const { env, g } = makeEnv();
    const XHR = g['XMLHttpRequest'] as new () => any;
    // Act:
    const xhr = new XHR();
    // Assert: overrideMimeType must exist and be callable without TypeError.
    expect(typeof xhr.overrideMimeType).toBe('function');
    expect(() => xhr.overrideMimeType('text/plain; charset=x-user-defined')).not.toThrow();
    // Assert: runnable inline-script environment — executeTestPage runs a trivial page.
    const dir = mkdtempSync(join(tmpdir(), 'td023-xhr-'));
    try {
      writeFileSync(join(dir, 'probe.txt'), 'hello', 'utf8');
      const page = join(dir, 't.html');
      writeFileSync(page, '<html><body><script>testPassed("inline-ok");finishTest();</script></body></html>', 'utf8');
      const report = env.executeTestPage(page, g);
      expect(report.assertions.length).toBeGreaterThan(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Sprint13 G1 harness Defect 3: resolveXhrFile relative resources path', () => {
  it('D3 XHR resolves relative resources/default.vert against baseDir without 404', () => {
    // Arrange:
    const { g } = makeEnv();
    const XHR = g['XMLHttpRequest'] as new () => any;
    const dir = mkdtempSync(join(tmpdir(), 'td023-xhr-'));
    // Act:
    try {
      writeFileSync(join(dir, 'default.vert'), 'attribute vec4 a; void main(){gl_Position=a;}', 'utf8');
      const xhr = new XHR();
      xhr.open('GET', 'resources/default.vert', true);
      let loaded = false;
      xhr.onload = () => { loaded = true; };
      xhr.send();
      // Assert: resolved content, status 200, no 404.
      expect(xhr.status).toBe(200);
      expect(loaded).toBe(true);
      expect(xhr.responseText).toContain('gl_Position');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Sprint13 G1 harness Defect 4: canPlayType stub returns string', () => {
  it('D4 video element canPlayType returns a string for video/ types', () => {
    // Arrange:
    const el = new DOMElementStub('VIDEO');
    // Act:
    const fn = (el as unknown as { canPlayType?: (t: string) => string }).canPlayType;
    // Assert:
    expect(typeof fn).toBe('function');
    expect(typeof (fn as (t: string) => string).call(el, 'video/mp4')).toBe('string');
  });
});
