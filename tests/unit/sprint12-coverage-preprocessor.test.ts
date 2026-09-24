/** Sprint 12 Task 4 Unit 4 — preprocessor macro engine coverage. */
import { describe, expect, it } from 'vitest';
import { runPreprocessor } from '../../src/glsl/preprocessor';
import { tokenize } from '../../src/glsl/tokenizer';
import type { Token } from '../../src/glsl/tokenizer';

function lex(src: string): Token[] {
  // Arrange helper: tokenize source, throwing on lexer failure
  const r = tokenize(src);
  if (!r.ok) throw new Error(`tokenize failed: ${(r as { log: string }).log}`);
  return (r as { ok: true; tokens: Token[] }).tokens;
}

function preprocess(src: string, version?: number) {
  // Arrange helper
  return runPreprocessor(lex(src), version);
}

describe('sprint12 preprocessor coverage', () => {
  it('expands an object-like macro to its replacement tokens', () => {
    // Arrange
    const src = '#define ONE 1\nint x = ONE;\n';
    // Act
    const r = preprocess(src);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const texts = r.tokens.map((t) => t.text);
      expect(texts).toContain('1');
      expect(texts).not.toContain('ONE');
    }
  });

  it('expands a function-like macro with arguments', () => {
    // Arrange
    const src = '#define ADD(a, b) ((a) + (b))\nint y = ADD(1, 2);\n';
    // Act
    const r = preprocess(src);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const texts = r.tokens.map((t) => t.text);
      expect(texts).not.toContain('ADD');
      expect(texts).toContain('1');
      expect(texts).toContain('2');
    }
  });

  it('reports use of a macro name after #undef as undeclared identifier', () => {
    // Arrange
    const src = '#define FOO 1\n#undef FOO\nint z = FOO;\n';
    // Act
    const r = preprocess(src);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.log).toContain("Undeclared identifier 'FOO'");
  });

  it('takes the true #if branch and drops the false branch', () => {
    // Arrange
    const src = '#if 1\nint a = 1;\n#else\nint a = 2;\n#endif\n';
    // Act
    const r = preprocess(src);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const nums = r.tokens.filter((t) => t.kind === 'INT_CONSTANT').map((t) => t.text);
      expect(nums).toContain('1');
      expect(nums).not.toContain('2');
    }
  });

  it('evaluates defined() and comparison operators in #if expressions', () => {
    // Arrange
    const src = '#define V 3\n#if defined(V) && V >= 3\nint ok1 = 1;\n#endif\n#if V == 2 || V != 3\nint bad = 1;\n#endif\n';
    // Act
    const r = preprocess(src);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const idents = r.tokens.filter((t) => t.kind === 'IDENTIFIER').map((t) => t.text);
      expect(idents).toContain('ok1');
      expect(idents).not.toContain('bad');
    }
  });

  it('treats unknown identifiers as 0 in #if conditions', () => {
    // Arrange
    const src = '#if UNKNOWN_FLAG\nint x = 1;\n#else\nint y = 2;\n#endif\n';
    // Act
    const r = preprocess(src);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const idents = r.tokens.filter((t) => t.kind === 'IDENTIFIER').map((t) => t.text);
      expect(idents).toContain('y');
      expect(idents).not.toContain('x');
    }
  });

  it('supports #ifdef / #ifndef guards', () => {
    // Arrange
    const src = '#define HAS_IT\n#ifdef HAS_IT\nint p = 1;\n#endif\n#ifndef HAS_IT\nint q = 1;\n#endif\n#ifndef MISSING\nint m = 1;\n#endif\n';
    // Act
    const r = preprocess(src);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const idents = r.tokens.filter((t) => t.kind === 'IDENTIFIER').map((t) => t.text);
      expect(idents).toContain('p');
      expect(idents).toContain('m');
      expect(idents).not.toContain('q');
    }
  });

  it('enforces the macro expansion depth limit of 64', () => {
    // Arrange: 70-deep chain of function-like macros forces nesting past 64
    // (object-like chains and mutual recursion terminate via the disabled set)
    const lines = ['#define F0(x) ((x))'];
    for (let i = 1; i <= 70; i++) lines.push(`#define F${i}(x) F${i - 1}(x)`);
    lines.push('int v = F70(1);');
    const src = lines.join('\n') + '\n';
    // Act
    const r = preprocess(src);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.log).toContain('Macro expansion depth limit exceeded (64)');
  });

  it('passes through tokens unchanged when no directives are present', () => {
    // Arrange
    const src = 'int plain = 42;\n';
    // Act
    const r = preprocess(src);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tokens.map((t) => t.text)).toContain('plain');
  });
});
