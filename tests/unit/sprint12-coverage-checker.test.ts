/** Sprint 12 Task 4 Unit 5 — semantic checker coverage via the real tokenize->preprocess->parse pipeline. */
import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/glsl/tokenizer';
import { runPreprocessor } from '../../src/glsl/preprocessor';
import { parse } from '../../src/glsl/parser';
import { check } from '../../src/glsl/checker';
import type { TranslationUnit } from '../../src/glsl/parser';

function compile(src: string, version: 100 | 300 = 100): TranslationUnit {
  // Arrange helper: full front-end pipeline, throwing on upstream failure
  const lexed = tokenize(src);
  if (!lexed.ok) throw new Error(`tokenize failed: ${lexed.log}`);
  const pre = runPreprocessor(lexed.tokens, version);
  if (!pre.ok) throw new Error(`preprocess failed: ${pre.log}`);
  const parsed = parse(pre.tokens, version);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.log}`);
  return parsed.tokens;
}

const VERT = 'void main() { gl_Position = vec4(0.0); }';
const FRAG_OK = 'precision mediump float;\nvoid main() { gl_FragColor = vec4(1.0); }';

describe('sprint12 checker coverage', () => {
  it('accepts a minimal valid vertex shader', () => {
    // Arrange
    const ast = compile(VERT);
    // Act
    const r = check(ast, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('rejects use of an undeclared identifier', () => {
    // Arrange
    const ast = compile('void main() { gl_Position = vec4(nope); }');
    // Act
    const r = check(ast, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.log).toContain('nope');
  });

  it('rejects assignment of a float expression to an int variable', () => {
    // Arrange
    const ast = compile('void main() { int x = 1.5; gl_Position = vec4(0.0); }');
    // Act
    const r = check(ast, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('rejects a fragment shader with no default float precision', () => {
    // Arrange
    const ast = compile('void main() { float x = 1.0; gl_FragColor = vec4(x); }');
    // Act
    const r = check(ast, 'fragment', 100);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.log.toLowerCase()).toContain('precision');
  });

  it('accepts a fragment shader declaring default float precision', () => {
    // Arrange
    const ast = compile(FRAG_OK);
    // Act
    const r = check(ast, 'fragment', 100);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tokens.stage).toBe('fragment');
      expect(r.tokens.version).toBe(100);
    }
  });

  it('rejects writes to read-only built-ins', () => {
    // Arrange
    const ast = compile('void main() { gl_FragCoord = vec4(0.0); gl_Position = vec4(0.0); }');
    // Act
    const r = check(ast, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.log).toContain('gl_FragCoord');
  });

  it('rejects direct recursive function calls', () => {
    // Arrange
    const ast = compile('void f() { f(); }\nvoid main() { gl_Position = vec4(0.0); }');
    // Act
    const r = check(ast, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.log.toLowerCase()).toContain('recurs');
  });

  it('rejects calling normalize with a float argument', () => {
    // Arrange
    const ast = compile('void main() { float x = normalize(1.0); gl_Position = vec4(x); }');
    // Act
    const r = check(ast, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('rejects cross() with non-vec3 arguments', () => {
    // Arrange
    const ast = compile('void main() { vec2 a = vec2(1.0); gl_Position = vec4(cross(a, a), 0.0, 1.0); }');
    // Act
    const r = check(ast, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('exposes declared uniforms and functions in CheckedShader metadata', () => {
    // Arrange
    const ast = compile('uniform vec4 uColor;\nvoid main() { gl_Position = uColor; }');
    // Act
    const r = check(ast, 'vertex', 100);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tokens.uniforms.map((u) => u.name)).toContain('uColor');
      expect(r.tokens.functions).toContain('main');
    }
  });
});
