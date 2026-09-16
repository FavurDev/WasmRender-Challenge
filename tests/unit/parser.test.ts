import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { tokenize } from '../../src/renderer/shader-compiler/tokenizer';
import { parse } from '../../src/renderer/shader-compiler/parser';
import { ShaderCompileError } from '../../src/renderer/errors';

function parseErr(source: string, stage: 'vertex' | 'fragment'): ShaderCompileError | null {
  // Arrange + Act
  const tokens = tokenize(source);
  try {
    parse(tokens, stage);
  } catch (e) {
    return e as ShaderCompileError;
  }
  return null;
}

describe('parser version gates (TDD red phase)', () => {
  it('version on line 2 fails with first-line diagnostic', () => {
    // Arrange
    const source = '\n#version 300 es\nvoid main() {}';
    // Act
    const err = parseErr(source, 'vertex');
    // Assert
    expect(err).toBeInstanceOf(ShaderCompileError);
    expect((err as unknown as ShaderCompileError).message).toBe('VERSION_MUST_BE_FIRST_LINE');
    expect((err as unknown as ShaderCompileError).line).toBe(1);
  });

  it('attribute in 300 fails with reserved diagnostic', () => {
    // Arrange
    const source = '#version 300 es\nattribute vec4 p;\nvoid main() {}';
    // Act
    const err = parseErr(source, 'vertex');
    // Assert
    expect(err).toBeInstanceOf(ShaderCompileError);
    expect((err as unknown as ShaderCompileError).message).toBe('ATTRIBUTE_RESERVED_IN_300');
    expect((err as unknown as ShaderCompileError).line).toBe(2);
  });

  it('absent version falls back to 100 accepting attribute', () => {
    // Arrange
    const source = 'attribute vec4 p;\nvarying vec2 v;\nvoid main() {}';
    // Act
    const prog = parse(tokenize(source), 'vertex');
    // Assert
    expect(prog.version).toBe(100);
    expect(prog.declarations.length).toBeGreaterThan(0);
    expect(prog.functions.length).toBeGreaterThan(0);
  });

  it('100-only qualifiers rejected in 300: varying and gl_FragColor', () => {
    // Arrange
    const varyingSrc = '#version 300 es\nvarying vec2 v;\nvoid main() {}';
    const fragSrc = '#version 300 es\nvoid main() { gl_FragColor = vec4(1.0); }';
    // Act
    const errVarying = parseErr(varyingSrc, 'vertex');
    const errFrag = parseErr(fragSrc, 'fragment');
    // Assert
    expect(errVarying).toBeInstanceOf(ShaderCompileError);
    expect((errVarying as unknown as ShaderCompileError).message).toBe('VARYING_RESERVED_IN_300');
    expect((errVarying as unknown as ShaderCompileError).line).toBe(2);
    expect(errFrag).toBeInstanceOf(ShaderCompileError);
    expect((errFrag as unknown as ShaderCompileError).message).toBe('GL_FRAGCOLOR_RESERVED_IN_300');
  });

  it('300-only qualifiers rejected in 100: in, out, layout', () => {
    // Arrange
    const inSrc = 'in vec4 p;\nvoid main() {}';
    const outSrc = 'out vec4 c;\nvoid main() {}';
    const layoutSrc = 'layout(location = 0) out vec4 c;\nvoid main() {}';
    // Act
    const errIn = parseErr(inSrc, 'vertex');
    const errOut = parseErr(outSrc, 'vertex');
    const errLayout = parseErr(layoutSrc, 'vertex');
    // Assert
    expect((errIn as unknown as ShaderCompileError).message).toBe('IN_RESERVED_IN_100');
    expect((errIn as unknown as ShaderCompileError).line).toBe(1);
    expect((errOut as unknown as ShaderCompileError).message).toBe('OUT_RESERVED_IN_100');
    expect((errLayout as unknown as ShaderCompileError).message).toBe('LAYOUT_QUALIFIER_REQUIRES_300');
  });

  it('valid programs in both versions produce tagged ASTProgram without type evaluation', () => {
    // Arrange
    const src100 = 'attribute vec4 p;\nvarying vec2 v;\nvoid main() { float x = 1.0 + 2.0 * 3.0; }';
    const src300 = '#version 300 es\nin vec4 p;\nout vec4 c;\nvoid main() { float x = 1.0 + 2.0 * 3.0; }';
    // Act
    const prog100 = parse(tokenize(src100), 'vertex');
    const prog300 = parse(tokenize(src300), 'vertex');
    const parserSrc = readFileSync('src/renderer/shader-compiler/parser.ts', 'utf8');
    // Assert
    expect(prog100.version).toBe(100);
    expect(prog100.stage).toBe('vertex');
    expect(prog100.declarations.length).toBeGreaterThan(0);
    expect(prog100.functions.length).toBeGreaterThan(0);
    expect(prog300.version).toBe(300);
    expect(prog300.stage).toBe('vertex');
    expect(prog300.declarations.length).toBeGreaterThan(0);
    expect(prog300.functions.length).toBeGreaterThan(0);
    const imports = [...parserSrc.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports.every((p) => p.includes('tokenizer') || p.includes('errors'))).toBe(true);
  });
});
