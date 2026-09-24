/** Sprint 12 Task 4 Unit 6 — parser coverage via the parse() entry point. */
import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/glsl/tokenizer';
import { runPreprocessor } from '../../src/glsl/preprocessor';
import { MAX_PARSER_DEPTH, parse } from '../../src/glsl/parser';
import type { Token } from '../../src/glsl/tokenizer';

function lex(src: string, version: 100 | 300 = 100): Token[] {
  // Arrange helper (version is classification-only per TD-008: 300-only
  // keywords such as switch/case lex as KEYWORD only with version 300)
  const lexed = tokenize(src, version);
  if (!lexed.ok) throw new Error(`tokenize failed: ${lexed.log}`);
  const pre = runPreprocessor(lexed.tokens, version);
  if (!pre.ok) throw new Error(`preprocess failed: ${pre.log}`);
  return pre.tokens;
}

describe('sprint12 parser coverage', () => {
  it('parses an empty translation unit', () => {
    // Arrange
    const tokens = lex('');
    // Act
    const r = parse(tokens, 100);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.tokens.declarations).toEqual([]);
  });

  it('parses a uniform declaration with exact AST shape', () => {
    // Arrange
    const tokens = lex('uniform vec4 uColor;\n');
    // Act
    const r = parse(tokens, 100);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.tokens.declarations.length).toBe(1);
      const d = r.tokens.declarations[0] as { kind: string; name?: string };
      expect(d.kind).toBe('VariableDeclaration');
      expect(d.name).toBe('uColor');
    }
  });

  it('parses a function definition with a return statement', () => {
    // Arrange
    const tokens = lex('float f() { return 1.0; }\n');
    // Act
    const r = parse(tokens, 100);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = r.tokens.declarations[0] as { kind: string; name?: string };
      expect(d.kind).toBe('FunctionDefinition');
      expect(d.name).toBe('f');
    }
  });

  it('parses an if statement with exact node kind', () => {
    // Arrange
    const tokens = lex('void main() { if (true) { gl_Position = vec4(0.0); } }\n');
    // Act
    const r = parse(tokens, 100);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const fn = r.tokens.declarations[0] as { body?: { statements?: Array<{ kind: string }> } };
      expect(fn.body?.statements?.[0]?.kind).toBe('IfStatement');
    }
  });

  it('parses a for loop with exact node kind', () => {
    // Arrange
    const tokens = lex('void main() { for (int i = 0; i < 3; i = i + 1) { gl_Position = vec4(0.0); } }\n');
    // Act
    const r = parse(tokens, 100);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const fn = r.tokens.declarations[0] as { body?: { statements?: Array<{ kind: string }> } };
      expect(fn.body?.statements?.[0]?.kind).toBe('ForStatement');
    }
  });

  it('parses a lone semicolon as an empty expression statement', () => {
    // Arrange
    const tokens = lex('void main() { ; gl_Position = vec4(0.0); }\n');
    // Act
    const r = parse(tokens, 100);
    // Assert
    expect(r.ok).toBe(true);
    if (r.ok) {
      const fn = r.tokens.declarations[0] as {
        body?: { statements?: Array<{ kind: string; expression?: unknown }> };
      };
      expect(fn.body?.statements?.[0]?.kind).toBe('ExpressionStatement');
      expect(fn.body?.statements?.[0]?.expression ?? null).toBeNull();
    }
  });

  it('rejects switch/case under GLSL ES 1.00', () => {
    // Arrange
    const tokens = lex('void main() { switch (1) { case 1: break; } }\n', 100);
    // Act
    const r = parse(tokens, 100);
    // Assert
    expect(r.ok).toBe(false);
  });

  it('accepts switch/case under GLSL ES 3.00', () => {
    // Arrange
    const tokens = lex('void main() { switch (1) { case 1: break; } }\n', 300);
    // Act
    const r = parse(tokens, 300);
    // Assert
    expect(r.ok).toBe(true);
  });

  it('reports an error for an unterminated construct', () => {
    // Arrange
    const tokens = lex('void main() { gl_Position = vec4(0.0);\n');
    // Act
    const r = parse(tokens, 100);
    // Assert
    expect(r.ok).toBe(false);
    if (!r.ok) expect(typeof r.log).toBe('string');
  });

  it('exposes MAX_PARSER_DEPTH as 64', () => {
    // Arrange (no pipeline needed)
    // Act
    const depth: number = MAX_PARSER_DEPTH;
    // Assert
    expect(depth).toBe(64);
  });
});
