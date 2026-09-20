/** Sprint 3 Task 6 smoke-script TDD red-phase tests — target scripts/glsl-smoke exports. */
import { describe, expect, it } from 'vitest';
import { runFrontEndPipeline, SMOKE_FIXTURES } from '../../scripts/glsl-smoke';

describe('glsl-smoke - ES 1.00 vertex (case 1)', () => {
  it('compiles clean with ok:true and empty log', () => {
    // Arrange:
    const source =
      'attribute vec4 aPosition;\nuniform mat4 uModelViewMatrix;\nvec4 transform(vec4 pos) { return uModelViewMatrix * pos; }\nvoid main() {\n gl_Position = transform(aPosition);\n}\n';
    // Act:
    const result = runFrontEndPipeline(source, 'vertex', 100);
    // Assert:
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.log).toBe('');
  });
});

describe('glsl-smoke - ES 1.00 fragment (case 2)', () => {
  it('compiles clean with ok:true and empty log', () => {
    // Arrange:
    const source =
      'precision mediump float;\nvarying vec4 vColor;\nvoid main() {\n gl_FragColor = vColor;\n}\n';
    // Act:
    const result = runFrontEndPipeline(source, 'fragment', 100);
    // Assert:
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.log).toBe('');
  });
});

describe('glsl-smoke - ES 3.00 vertex (case 3)', () => {
  it('compiles clean with ok:true and empty log', () => {
    // Arrange:
    const source =
      '#version 300 es\nlayout(location = 0) in vec4 aPosition;\nout vec4 vColor;\nvoid main() {\n vColor = aPosition;\n gl_Position = aPosition;\n}\n';
    // Act:
    const result = runFrontEndPipeline(source, 'vertex', 300);
    // Assert:
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.log).toBe('');
  });
});

describe('glsl-smoke - ES 3.00 fragment (case 4)', () => {
  it('compiles clean with ok:true and empty log', () => {
    // Arrange:
    const source =
      '#version 300 es\nprecision mediump float;\nin vec4 vColor;\nout vec4 fragColor;\nvoid main() {\n fragColor = vColor;\n}\n';
    // Act:
    const result = runFrontEndPipeline(source, 'fragment', 300);
    // Assert:
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.log).toBe('');
  });
});

describe('glsl-smoke - malformed shader (case 5)', () => {
  it('yields ok:false with log starting ERROR: 0:', () => {
    // Arrange:
    const source = 'void main() {\n $ illegal\n}\n';
    // Act:
    const result = runFrontEndPipeline(source, 'vertex', 100);
    // Assert:
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.log).toMatch(/^ERROR: 0:/);
  });
});

describe('glsl-smoke - SMOKE_FIXTURES', () => {
  it('has exactly 4 entries with correct names and versions', () => {
    // Arrange:
    const fixtures = SMOKE_FIXTURES;
    // Act:
    const versions = fixtures.map((f) => f.dialectVersion);
    const names = fixtures.map((f) => f.name);
    // Assert:
    expect(fixtures).toHaveLength(4);
    expect(versions).toEqual([100, 100, 300, 300]);
    expect(names[0]).toContain('GLSL ES 1.00 Vertex');
    expect(names[1]).toContain('GLSL ES 1.00 Fragment');
    expect(names[2]).toContain('GLSL ES 3.00 Vertex');
    expect(names[3]).toContain('GLSL ES 3.00 Fragment');
  });
});
