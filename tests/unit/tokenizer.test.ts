import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/renderer/shader-compiler/tokenizer';
import { ShaderCompileError } from '../../src/renderer/errors';

describe('tokenizer', () => {
  it('line numbers advance across newlines', () => {
    // Arrange
    const source = 'float a;\nfloat b;\nfloat c;';
    // Act
    const tokens = tokenize(source);
    // Assert
    expect(tokens.filter((t) => t.line === 1).length).toBeGreaterThan(0);
    expect(tokens.filter((t) => t.line === 2).length).toBeGreaterThan(0);
    expect(tokens.filter((t) => t.line === 3).length).toBeGreaterThan(0);
  });

  it('line comment skipped without shifting lines', () => {
    // Arrange
    const source = 'float a; // trailing comment\nfloat b;';
    // Act
    const tokens = tokenize(source);
    // Assert
    expect(tokens.some((t) => t.lexeme.includes('trailing'))).toBe(false);
    expect(tokens.filter((t) => t.line === 2).length).toBeGreaterThan(0);
  });

  it('block comment with embedded newlines skipped with counting', () => {
    // Arrange
    const source = 'float a;\n/* multi\nline\ncomment */\nfloat b;';
    // Act
    const tokens = tokenize(source);
    // Assert
    expect(tokens.some((t) => t.lexeme.includes('multi'))).toBe(false);
    const b = tokens.find((t) => t.lexeme === 'b');
    expect(b?.line).toBe(5);
  });

  it('directive line captured as single token', () => {
    // Arrange
    const source = '#version 300 es\nfloat a;';
    // Act
    const tokens = tokenize(source);
    // Assert
    expect(tokens[0]?.kind).toBe('directive');
    expect(tokens[0]?.lexeme).toBe('#version 300 es');
    expect(tokens[0]?.line).toBe(1);
    expect(tokens[1]?.line).toBe(2);
  });

  it('keyword versus identifier classification', () => {
    // Arrange
    const source = 'float myVar;';
    // Act
    const tokens = tokenize(source);
    // Assert
    expect(tokens.find((t) => t.lexeme === 'float')?.kind).toBe('keyword');
    expect(tokens.find((t) => t.lexeme === 'myVar')?.kind).toBe('ident');
  });

  it('integer versus float classification', () => {
    // Arrange
    const source = '1 1.5 2e3';
    // Act
    const tokens = tokenize(source);
    // Assert
    expect(tokens.find((t) => t.lexeme === '1')?.kind).toBe('int');
    expect(tokens.find((t) => t.lexeme === '1.5')?.kind).toBe('float');
    expect(tokens.find((t) => t.lexeme === '2e3')?.kind).toBe('float');
  });

  it('unterminated block comment raises naming opening line', () => {
    // Arrange
    const source = 'float a;\n/* never closed';
    // Act
    let err: unknown;
    try {
      tokenize(source);
    } catch (e) {
      err = e;
    }
    // Assert
    expect(err).toBeInstanceOf(ShaderCompileError);
    expect((err as ShaderCompileError).line).toBe(2);
  });

  it('malformed numeric literal raises naming current line', () => {
    // Arrange
    const fixtures = ['1..2', '1e', '123abc'];
    // Act + Assert
    for (const f of fixtures) {
      let err: unknown;
      try {
        tokenize(f);
      } catch (e) {
        err = e;
      }
      expect(err).toBeInstanceOf(ShaderCompileError);
      expect((err as ShaderCompileError).line).toBe(1);
    }
  });
});
