/** Codegen TDD red-phase tests (Task 5 TEST-1..TEST-4). Headless Node vitest, fixed GLSL fixtures, no GUI. */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { compileShaderSource } from '../../src/renderer/shader-compiler/codegen';
import { ShaderCompileError } from '../../src/renderer/errors';

const VERTEX_SRC = [
  'attribute vec3 aPos;',
  'varying vec2 vUv;',
  'void main() {',
  '  gl_Position = vec4(aPos, 1.0);',
  '  vUv = vec2(0.5, 0.5);',
  '}',
].join('\n');

const FRAGMENT_SRC = [
  'precision mediump float;',
  'varying vec2 vUv;',
  'void main() {',
  '  gl_FragColor = vec4(vUv, 0.0, 1.0);',
  '}',
].join('\n');

function collectRendererFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectRendererFiles(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('codegen TEST-1: ES1.00 vertex attribute/varying compiles to invocable closure', () => {
  it('invokes vertex closure writing positionOut and varyingsOut', () => {
    // Arrange: fixed vertex source plus preallocated caller-owned arrays
    const attribs = { aPos: [1, 2, 3] };
    const uniforms: Record<string, number[]> = {};
    const positionOut = [0, 0, 0, 0];
    const varyingsOut = [0, 0];
    // Act: compile then invoke
    const result = compileShaderSource(VERTEX_SRC, 'vertex');
    type VertexFn = (a: unknown, u: unknown, p: number[], v: number[]) => void;
    (result.closure as unknown as VertexFn)(attribs, uniforms, positionOut, varyingsOut);
    // Assert: invocable and outputs hold expected numbers
    expect(typeof result.closure).toBe('function');
    expect(positionOut).toEqual([1, 2, 3, 1]);
    expect(varyingsOut).toEqual([0.5, 0.5]);
  });
});

describe('codegen TEST-2: ES1.00 fragment gl_FragColor compiles to invocable closure', () => {
  it('invokes fragment closure writing colorOut', () => {
    // Arrange: fixed fragment source plus preallocated varyings and colorOut
    const varyingsIn = [0.25, 0.75];
    const uniforms: Record<string, number[]> = {};
    const samplers: unknown[] = [];
    const colorOut = [0, 0, 0, 0];
    // Act: compile then invoke
    const result = compileShaderSource(FRAGMENT_SRC, 'fragment');
    type FragmentFn = (v: readonly number[], u: unknown, s: readonly unknown[], c: number[]) => void;
    (result.closure as unknown as FragmentFn)(varyingsIn, uniforms, samplers, colorOut);
    // Assert: invocable and colorOut holds expected color numbers
    expect(typeof result.closure).toBe('function');
    expect(colorOut).toEqual([0.25, 0.75, 0, 1]);
  });
});

describe('codegen TEST-3: eval-ban source scan', () => {
  it('finds zero eval/new Function tokens in src/renderer', () => {
    // Arrange: renderer source text under scan
    const files = collectRendererFiles(join(process.cwd(), 'src', 'renderer'));
    // Act: scan for executable-string construction tokens
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      if (/(^|[^A-Za-z0-9_$])eval\s*\(/.test(text)) hits.push(`${f}: eval(`);
      if (/new\s+Function\s*\(/.test(text)) hits.push(`${f}: new Function(`);
    }
    // Assert: zero matches
    expect(hits).toEqual([]);
  });
});

describe('codegen TEST-4: orchestration order tokenize->parse->typecheck->codegen', () => {
  it('returns closure plus symbols plus version and propagates errors', () => {
    // Arrange: fixed valid source plus stage
    // Act: run compileShaderSource and observe result shape
    const ok = compileShaderSource(VERTEX_SRC, 'vertex');
    // Assert: result carries closure plus symbols plus version
    expect(typeof ok.closure).toBe('function');
    expect(ok.symbols.attributes.has('aPos')).toBe(true);
    expect(ok.symbols.varyings.has('vUv')).toBe(true);
    expect(ok.version).toBe(100);
    // Arrange: invalid source missing main
    const bad = 'attribute vec3 aPos;\nvoid helper() {}';
    // Act + Assert: ShaderCompileError propagates with no closure
    expect(() => compileShaderSource(bad, 'vertex')).toThrowError(ShaderCompileError);
  });
});
