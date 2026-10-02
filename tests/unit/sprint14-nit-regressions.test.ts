/** Sprint 14 Task 7 TDD red-phase: 8 LOW nit regressions. Must FAIL until Step 3 fixes land. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SUBPIXEL_BITS, MAX_ELEMENT_INDEX, MAX_SERVER_WAIT_TIMEOUT } from '../../src/gl/constants';
import { createSoftwareWebGLContext } from '../../src/entry';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import { CTSHeadlessEnvironment } from '../conformance/webgl1-harness';

const NO_ERROR = 0;

function makeEnv() {
  const env = new CTSHeadlessEnvironment('dummy-bundle.js', 1000);
  const g = env.setup(() => createSoftwareWebGLContext({ width: 300, height: 150 }) as never);
  return { env, g };
}

describe('Sprint14 nit N7: named GL constant values', () => {
  it('SUBPIXEL_BITS/MAX_ELEMENT_INDEX/MAX_SERVER_WAIT_TIMEOUT equal replaced hex values', () => {
    // Arrange: imported constants.
    // Act: inspect values/types.
    // Assert:
    expect(SUBPIXEL_BITS).toBe(0x0d50);
    expect(MAX_ELEMENT_INDEX).toBe(0x8ffe);
    expect(MAX_SERVER_WAIT_TIMEOUT).toBe(0x9111);
    expect(typeof SUBPIXEL_BITS).toBe('number');
    expect(typeof MAX_ELEMENT_INDEX).toBe('number');
    expect(typeof MAX_SERVER_WAIT_TIMEOUT).toBe('number');
  });
});

describe('Sprint14 nit N7: WebGL1 getParameter limit readbacks', () => {
  it('SUBPIXEL_BITS->4 and MAX_ELEMENT_INDEX->0xffffff with NO_ERROR', () => {
    // Arrange:
    const gl = createSoftwareWebGLContext({ width: 4, height: 4 });
    if (gl === null) throw new Error('context creation failed');
    // Act:
    const sub = gl.getParameter(SUBPIXEL_BITS);
    const max = gl.getParameter(MAX_ELEMENT_INDEX);
    // Assert:
    expect(sub).toBe(4);
    expect(max).toBe(0xffffff);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('Sprint14 nit N7: WebGL2 getParameter limit readbacks', () => {
  it('MAX_ELEMENT_INDEX->0xffffff and MAX_SERVER_WAIT_TIMEOUT->0 with NO_ERROR', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 4, height: 4 });
    // Act:
    const max = gl.getParameter(MAX_ELEMENT_INDEX);
    const timeout = gl.getParameter(MAX_SERVER_WAIT_TIMEOUT);
    // Assert:
    expect(max).toBe(0xffffff);
    expect(timeout).toBe(0);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('Sprint14 nit N6: harness DOM collection stub shape', () => {
  it('canvas collection supports [i], ["0"], item(i), OOB guards', () => {
    // Arrange:
    const { g } = makeEnv();
    const doc = g['document'] as { getElementsByTagName: (t: string) => any };
    // Act:
    const coll = doc.getElementsByTagName('canvas');
    // Assert:
    expect(coll.length).toBe(1);
    expect(coll[0]).toBeDefined();
    expect(coll['0']).toBe(coll[0]);
    expect(coll.item(0)).toBe(coll[0]);
    expect(coll.item(1)).toBeNull();
    expect(coll[1]).toBeUndefined();
  });

  it('unknown tag yields empty collection with null item', () => {
    // Arrange:
    const { g } = makeEnv();
    const doc = g['document'] as { getElementsByTagName: (t: string) => any };
    // Act:
    const coll = doc.getElementsByTagName('div');
    // Assert:
    expect(coll.length).toBe(0);
    expect(coll[0]).toBeUndefined();
    expect(coll.item(0)).toBeNull();
  });
});

describe('Sprint14 nits N1/N2: threshold report v5 header markers', () => {
  it('cts-threshold-report.ts names Sprint 14 v5 with no stale v3 marker', () => {
    // Arrange:
    const src = readFileSync('tests/conformance/cts-threshold-report.ts', 'utf8');
    // Act: search header markers.
    // Assert:
    expect(src).toContain('Sprint 14');
    expect(src).toContain('(v5)');
    expect(src).not.toContain('Sprint 12 Task 5 CTS threshold report v3 vitest suite');
  });

  it('cts-threshold-report.test.ts line 2 names v5 suite with no stale v3 marker', () => {
    // Arrange:
    const src = readFileSync('tests/conformance/cts-threshold-report.test.ts', 'utf8');
    const line2 = src.split('\n')[1] ?? '';
    // Act: inspect line 2.
    // Assert:
    expect(line2).toContain('Sprint 14 CTS threshold report v5 vitest suite');
    expect(src).not.toContain('Sprint 12 Task 5 CTS threshold report v3 vitest suite');
  });
});

describe('Sprint14 nit N5: threshold report single Supersedes line', () => {
  it('threshold-report.md has exactly one Supersedes line naming v4', () => {
    // Arrange:
    const md = readFileSync('test-results/conformance/threshold-report.md', 'utf8');
    // Act:
    const lines = md.split('\n').filter((l) => l.startsWith('Supersedes:'));
    // Assert:
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Supersedes: # Sprint 13 CTS Conformance Threshold & Gap Report (v4)');
  });
});

describe('Sprint14 nits N3/N4: python scripts use with-blocks', () => {
  it.each([['g1-agg3.py'], ['g1-repro.py']] as const)('%s uses with open() and no bare json.load(open()', (file) => {
    // Arrange:
    const src = readFileSync(file, 'utf8');
    // Act: search open patterns.
    // Assert:
    expect(src).toContain('with open(');
    expect(src).not.toContain('json.load(open(');
  });
});
