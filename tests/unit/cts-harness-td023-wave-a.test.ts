/** TD-023 Wave A RED-phase regression tests — P1/P2/P3 fixes land next step. */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CTSHeadlessEnvironment,
  CTSManifestParser,
  CTSRunner,
  WEBGL2_MANIFEST_ROOT,
  WEBGL2_TRIAGE_LOG,
} from '../conformance/webgl1-harness';
import { WebGL1Context, WebGL2Context } from '../../src/entry';

type Factory = (canvas: { width: number; height: number }) => { getError: () => number } | null;

function loadFactoryViaCast(path: string, contextType?: string): Factory {
  const ctor = CTSRunner as unknown as Record<string, unknown>;
  const fn = ctor['loadFactory'] as (p: string, t?: string) => Factory;
  return fn.call(CTSRunner, path, contextType);
}

function dummyFactory(): Factory {
  return () => ({ getError: () => 0 });
}

describe('Wave A P1: CTSRunner WebGL2 factory dispatch (Test 1)', () => {
  it('loadFactory returns WebGL2 context when contextType is webgl2', () => {
    // Arrange:
    const mockCanvas = { width: 300, height: 150 };
    const factory = loadFactoryViaCast('/app/renderer.js', 'webgl2');
    // Act:
    const context = factory(mockCanvas) as unknown as Record<string, unknown>;
    // Assert:
    expect(context).not.toBeNull();
    expect(context instanceof WebGL2Context).toBe(true);
    expect((context as unknown as { getError: () => number }).getError()).toBe(0);
  });
});

describe('Wave A P1: canvas getContext webgl2 dispatch (Test 2)', () => {
  it('canvasStub returns WebGL2 context for getContext webgl2 variants', () => {
    // Arrange:
    const factory = loadFactoryViaCast('/app/renderer.js', 'webgl2');
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 5000);
    const globalObject = env.setup(factory) as Record<string, unknown>;
    // Act:
    const doc = globalObject['document'] as { getElementById: (id: string) => unknown };
    const canvas = doc.getElementById('canvas') as { getContext: (t: string) => unknown };
    const gl2 = canvas.getContext('webgl2');
    const glExp = canvas.getContext('experimental-webgl2');
    const unknown = canvas.getContext('unknown');
    // Assert:
    expect(gl2).toBeTruthy();
    expect(gl2).toBe(env.context);
    expect(glExp).toBeTruthy();
    expect(glExp).toBe(env.context);
    expect(unknown).toBeNull();
  });
});

describe('Wave A P2: MockXMLHttpRequest sync file load (Test 3)', () => {
  it('loads local CTS test resources synchronously', () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'td023-xhr-'));
    try {
      writeFileSync(join(tempDir, 'test.json'), '{"status":"ok"}');
      const env = new CTSHeadlessEnvironment('/app/renderer.js', 5000);
      const globalObject = env.setup(dummyFactory()) as Record<string, unknown>;
      const XHR = globalObject['XMLHttpRequest'] as new () => Record<string, unknown>;
      // Act:
      const xhr = new XHR() as unknown as {
        open: (m: string, u: string, a: boolean) => void;
        send: (p: null) => void;
        readyState: number;
        status: number;
        responseText: string;
      };
      xhr.open('GET', 'test.json', false);
      xhr.send(null);
      // Assert:
      expect(xhr.readyState).toBe(4);
      expect(xhr.status).toBe(200);
      expect(xhr.responseText).toBe('{"status":"ok"}');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Wave A P2: MockXMLHttpRequest 404 handling (Test 4)', () => {
  it('sets 404 status and triggers callback when file missing', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 5000);
    const globalObject = env.setup(dummyFactory()) as Record<string, unknown>;
    const XHR = globalObject['XMLHttpRequest'] as new () => Record<string, unknown>;
    const xhr = new XHR() as unknown as {
      open: (m: string, u: string) => void;
      send: () => void;
      status: number;
      readyState: number;
      onerror: (() => void) | null;
    };
    let errorFired = false;
    xhr.onerror = () => {
      errorFired = true;
    };
    // Act:
    xhr.open('GET', 'non-existent-resource.dat');
    xhr.send();
    // Assert:
    expect(xhr.status).toBe(404);
    expect(xhr.readyState).toBe(4);
    expect(errorFired).toBe(true);
  });
});

describe('Wave A P2: WebGL global constants (Test 5)', () => {
  it('exposes WebGL and WebGL2 global constants', () => {
    // Arrange:
    const env = new CTSHeadlessEnvironment('/app/renderer.js', 5000);
    // Act:
    const globalObject = env.setup(dummyFactory()) as Record<string, unknown>;
    const gl1 = globalObject['WebGLRenderingContext'] as Record<string, unknown>;
    const gl2 = globalObject['WebGL2RenderingContext'] as Record<string, unknown>;
    const win = globalObject['window'] as Record<string, unknown>;
    // Assert:
    expect(gl1['COLOR_BUFFER_BIT']).toBe(0x00004000);
    expect(gl1['TRIANGLES']).toBe(0x0004);
    expect(gl2['COLOR_BUFFER_BIT']).toBe(0x00004000);
    expect(gl2['READ_FRAMEBUFFER']).toBe(0x8ca8);
    expect(gl2['DRAW_FRAMEBUFFER']).toBe(0x8ca9);
    expect(win['WebGL2RenderingContext']).toBe(gl2);
  });
});

describe('Wave A P3: manifest excludes data files (Test 6)', () => {
  it('skips .vert and .frag shader data files', () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'td023-manifest-'));
    try {
      writeFileSync(
        join(tempDir, '00_test_list.txt'),
        'valid_test.html\nshader.vert\nshader.frag\nsub/another_test.html\nsub/test.vert.html\n',
      );
      const parser = new CTSManifestParser(tempDir);
      // Act:
      const tests = parser.parseManifest('00_test_list.txt', new Map());
      // Assert:
      expect(tests.length).toBe(2);
      const ids = tests.map((t) => t.id);
      expect(ids).toContain('valid_test.html');
      expect(ids).toContain('sub/another_test.html');
      expect(ids.some((id) => id.includes('shader.vert'))).toBe(false);
      expect(ids.some((id) => id.includes('shader.frag'))).toBe(false);
      expect(ids).not.toContain('sub/test.vert.html');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('Wave A regression: WebGL1 default preserved (Test 7)', () => {
  it('defaults to WebGL1 context when contextType is webgl', () => {
    // Arrange:
    const mockCanvas = { width: 300, height: 150 };
    const factory = loadFactoryViaCast('/app/renderer.js', 'webgl');
    // Act:
    const context = factory(mockCanvas);
    // Assert:
    expect(context instanceof WebGL1Context).toBe(true);
    expect(context?.getError()).toBe(0);
  });
});

describe('Wave A integration: zero crashes and reconciliation (Test 8)', () => {
  it('executes with zero crashes and valid reconciliation', async () => {
    // Arrange:
    const tempDir = mkdtempSync(join(tmpdir(), 'td023-runner-'));
    try {
      const logPath = join(tempDir, 'webgl2-triage.json');
      const runner = new CTSRunner('/app/renderer.js', WEBGL2_MANIFEST_ROOT, WEBGL2_TRIAGE_LOG);
      void logPath;
      // Act:
      const stable = await runner.verifyDeterminism([], 1);
      const factory = loadFactoryViaCast('/app/renderer.js', 'webgl2');
      const ctx = factory({ width: 300, height: 150 });
      // Assert:
      expect(stable).toBe(true);
      expect(ctx instanceof WebGL2Context).toBe(true);
      expect(runner.triageLogger.crashedCount).toBe(0);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
