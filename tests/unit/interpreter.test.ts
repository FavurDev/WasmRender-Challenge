/** Sprint 4 Task 5 AST interpreter red-phase suite — TDD TESTS 1-11 per blueprint. */
import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/glsl/tokenizer';
import type { Token } from '../../src/glsl/tokenizer';
import { runPreprocessor } from '../../src/glsl/preprocessor';
import { parse } from '../../src/glsl/parser';
import type { TranslationUnit } from '../../src/glsl/parser';
import { check } from '../../src/glsl/checker';
import type { CheckedShader as CheckerShader } from '../../src/glsl/checker';
import { link } from '../../src/gl/program';
import type { LinkedProgram } from '../../src/gl/program';
import {
  executeFragment,
  executeVertex,
} from '../../src/glsl/interpreter';
import type {
  ClipVertex,
  FragmentResult,
  InterpreterHost,
} from '../../src/glsl/interpreter';

class MockInterpreterHost implements InterpreterHost {
  uniforms = new Map<number, number | Float32Array | Int32Array | Uint32Array>();
  textures = new Map<number, unknown>();
  readUniformCalls = 0;
  sampleCalls = 0;
  readUniform(slot: number): number | Float32Array | Int32Array | Uint32Array {
    // Arrange seam: in-memory uniform store.
    this.readUniformCalls += 1;
    return this.uniforms.get(slot) ?? 0;
  }
  sample(_slot: number, _coord: Float32Array): Float32Array {
    // Arrange seam: incomplete texture yields black.
    this.sampleCalls += 1;
    return new Float32Array([0, 0, 0, 1]);
  }
}

function tokensOf(source: string, version: number): Token[] {
  // Arrange helper: tokenize then preprocess.
  const tres = tokenize(source, version);
  if (!tres.ok) throw new Error('tokenize failed: ' + (tres as { log: string }).log);
  const pres = runPreprocessor(tres.tokens, version);
  if (!pres.ok) throw new Error('preprocess failed: ' + (pres as { log: string }).log);
  return (pres as { ok: true; tokens: Token[] }).tokens;
}

function checked(source: string, stage: 'vertex' | 'fragment', version: 100 | 300): CheckerShader {
  // Arrange helper: full tokenize->preprocess->parse->check pipeline.
  const tokens = tokensOf(source, version);
  const pres = parse(tokens, version);
  if (!pres.ok) throw new Error('parse failed: ' + (pres as { log: string }).log);
  const ast = (pres as { ok: true; tokens: TranslationUnit }).tokens;
  const cres = check(ast, stage, version);
  if (!cres.ok) throw new Error('check failed: ' + (cres as { log: string }).log);
  return (cres as { ok: true; tokens: CheckerShader }).tokens;
}

function linked(vsrc: string, fsrc: string, version: 100 | 300): LinkedProgram {
  // Arrange helper: link real CheckedShaders into a real LinkedProgram.
  const vs = checked(vsrc, 'vertex', version);
  const fs = checked(fsrc, 'fragment', version);
  const res = link(vs, fs);
  if (!res.ok || res.program === undefined) throw new Error('link failed: ' + res.log);
  return res.program;
}

const VS_PASSTHROUGH =
  'attribute vec4 aPos;\nvarying vec4 vC;\nvoid main() {\n vC = aPos;\n gl_Position = aPos;\n}\n';
const FS_PASSTHROUGH =
  'precision mediump float;\nvarying vec4 vC;\nvoid main() {\n gl_FragColor = vC;\n}\n';

describe('Interpreter - runVertex ES100 clip and varyings (TEST 1)', () => {
  it('test_runVertex_es100_computes_clip_and_varyings', () => {
    // Arrange:
    const program = linked(VS_PASSTHROUGH, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    const attribs = new Map<number, Float32Array>([[0, new Float32Array([1, 2, 3, 1])]]);
    // Act:
    const out: ClipVertex = executeVertex(program, 0, attribs, host);
    // Assert:
    expect(out.clipPos[0]).toBeCloseTo(1, 5);
    expect(out.clipPos[3]).toBeCloseTo(1, 5);
    expect(out.varyings.get('vC')?.[1]).toBeCloseTo(2, 5);
  });
});

describe('Interpreter - fragment division by zero (TEST 2)', () => {
  it('test_runFragment_division_by_zero_yields_infinity', () => {
    // Arrange:
    const vs = 'attribute vec4 aPos;\nvarying vec4 vC;\nvoid main() {\n vC = aPos;\n gl_Position = aPos;\n}\n';
    const fs =
      'precision mediump float;\nvarying vec4 vC;\nvoid main() {\n float q = 1.0 / 0.0;\n gl_FragColor = vec4(q, vC.y, vC.z, 1.0);\n}\n';
    const program = linked(vs, fs, 100);
    const host = new MockInterpreterHost();
    const varyings = new Map<string, Float32Array>([['vC', new Float32Array([0, 0, 0, 1])]]);
    // Act:
    const out: FragmentResult = executeFragment(program, varyings, host);
    // Assert:
    expect(out.color[0]).toBe(Infinity);
  });
});

describe('Interpreter - int32 overflow wraps (TEST 3)', () => {
  it('test_int32_overflow_wraps_modulo_2_pow_32', () => {
    // Arrange:
    const vs =
      'attribute vec4 aPos;\nvarying vec4 vC;\nvoid main() {\n int big = 2147483647 + 1;\n vC = vec4(float(big), 0.0, 0.0, 1.0);\n gl_Position = aPos;\n}\n';
    const program = linked(vs, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    // Act:
    const out: ClipVertex = executeVertex(program, 0, new Map(), host);
    // Assert:
    expect(out.varyings.get('vC')?.[0]).toBeCloseTo(-2147483648, 0);
  });
});

describe('Interpreter - deterministic execution (TEST 4)', () => {
  it('test_deterministic_execution_byte_identical_outputs', () => {
    // Arrange:
    const program = linked(VS_PASSTHROUGH, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    const attribs = new Map<number, Float32Array>([[0, new Float32Array([0.5, 0.25, 0, 1])]]);
    // Act:
    const a: ClipVertex = executeVertex(program, 0, attribs, host);
    const b: ClipVertex = executeVertex(program, 0, attribs, host);
    // Assert:
    expect(Array.from(a.clipPos)).toEqual(Array.from(b.clipPos));
    expect(Array.from(a.varyings.get('vC') ?? []).join(',')).toBe(
      Array.from(b.varyings.get('vC') ?? []).join(','),
    );
  });
});

describe('Interpreter - incomplete texture sampling (TEST 5)', () => {
  it('test_incomplete_texture_sampling_yields_black_no_error', () => {
    // Arrange:
    const vs = VS_PASSTHROUGH;
    const fs =
      'precision mediump float;\nuniform sampler2D uTex;\nvarying vec4 vC;\nvoid main() {\n gl_FragColor = texture2D(uTex, vec2(0.5, 0.5));\n}\n';
    const program = linked(vs, fs, 100);
    const host = new MockInterpreterHost();
    host.textures.set(0, null);
    const varyings = new Map<string, Float32Array>([['vC', new Float32Array([1, 1, 1, 1])]]);
    // Act:
    const out: FragmentResult = executeFragment(program, varyings, host);
    // Assert:
    expect(Array.from(out.color)).toEqual([0, 0, 0, 1]);
    expect(out.discarded).toBe(false);
  });
});

describe('Interpreter - out/inout params (TEST 6)', () => {
  it('test_function_call_out_inout_parameter_copy_in_out', () => {
    // Arrange:
    const vs =
      'attribute vec4 aPos;\nvarying vec4 vC;\nvoid bump(inout float x, out float y) {\n x = x + 1.0;\n y = x * 2.0;\n}\nvoid main() {\n float a = 1.0;\n float b = 0.0;\n bump(a, b);\n vC = vec4(a, b, 0.0, 1.0);\n gl_Position = aPos;\n}\n';
    const program = linked(vs, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    // Act:
    const out: ClipVertex = executeVertex(program, 0, new Map(), host);
    // Assert:
    expect(out.varyings.get('vC')?.[0]).toBeCloseTo(2, 5);
    expect(out.varyings.get('vC')?.[1]).toBeCloseTo(4, 5);
  });
});

describe('Interpreter - control flow (TEST 7)', () => {
  it('test_control_flow_loops_breaks_continues_and_switches', () => {
    // Arrange:
    const vs =
      '#version 300 es\nlayout(location = 0) in vec4 aPos;\nout vec4 vC;\nvoid main() {\n float acc = 0.0;\n for (int i = 0; i < 10; i++) {\n if (i == 2) continue;\n if (i == 5) break;\n acc += 1.0;\n }\n int k = 1;\n switch (k) {\n case 1:\n acc += 10.0;\n break;\n default:\n acc += 100.0;\n }\n vC = vec4(acc, 0.0, 0.0, 1.0);\n gl_Position = aPos;\n}\n';
    const fs =
      '#version 300 es\nprecision mediump float;\nin vec4 vC;\nout vec4 fragColor;\nvoid main() {\n fragColor = vC;\n}\n';
    const program = linked(vs, fs, 300);
    const host = new MockInterpreterHost();
    // Act:
    const out: ClipVertex = executeVertex(program, 0, new Map(), host);
    // Assert:
    expect(out.varyings.get('vC')?.[0]).toBeCloseTo(14, 5);
  });
});

describe('Interpreter - swizzle kind preservation (TEST 8)', () => {
  it('test_swizzle_kind_preservation_and_write_masking', () => {
    // Arrange:
    const vs =
      'attribute vec4 aPos;\nvarying vec4 vC;\nvoid main() {\n ivec3 iv = ivec3(1, 2, 3);\n ivec2 sw = iv.zy;\n vec4 v = vec4(0.0);\n v.xw = vec2(5.0, 6.0);\n vC = vec4(float(sw.x), float(sw.y), v.x, v.w);\n gl_Position = aPos;\n}\n';
    const program = linked(vs, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    // Act:
    const out: ClipVertex = executeVertex(program, 0, new Map(), host);
    // Assert:
    expect(out.varyings.get('vC')?.[0]).toBe(3);
    expect(out.varyings.get('vC')?.[1]).toBe(2);
    expect(out.varyings.get('vC')?.[2]).toBeCloseTo(5, 5);
    expect(out.varyings.get('vC')?.[3]).toBeCloseTo(6, 5);
  });
});

describe('Interpreter - OOB array clamp (TEST 9)', () => {
  it('test_out_of_bounds_array_indexing_clamps_to_range', () => {
    // Arrange:
    const vs =
      'attribute vec4 aPos;\nvarying vec4 vC;\nvoid main() {\n float arr[3];\n arr[0] = 1.0;\n arr[1] = 2.0;\n arr[2] = 3.0;\n float oob = arr[10];\n float neg = arr[-1];\n vC = vec4(oob, neg, 0.0, 1.0);\n gl_Position = aPos;\n}\n';
    const program = linked(vs, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    // Act:
    const out: ClipVertex = executeVertex(program, 0, new Map(), host);
    // Assert:
    expect(out.varyings.get('vC')?.[0]).toBeCloseTo(3, 5);
    expect(out.varyings.get('vC')?.[1]).toBeCloseTo(1, 5);
  });
});

describe('Interpreter - LTR evaluation order (TEST 10)', () => {
  it('test_expression_evaluation_left_to_right_order', () => {
    // Arrange:
    const vs =
      'attribute vec4 aPos;\nvarying vec4 vC;\nint g = 0;\nint next() {\n g = g + 1;\n return g;\n}\nvoid main() {\n int r = next() + next() * 10;\n vC = vec4(float(r), float(g), 0.0, 1.0);\n gl_Position = aPos;\n}\n';
    const program = linked(vs, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    // Act:
    const out: ClipVertex = executeVertex(program, 0, new Map(), host);
    // Assert:
    expect(out.varyings.get('vC')?.[0]).toBe(21);
    expect(out.varyings.get('vC')?.[1]).toBe(2);
  });
});

describe('Interpreter - zero invocation allocation (TEST 11)', () => {
  it('test_slot_environment_zero_invocation_allocation', () => {
    // Arrange:
    const program = linked(VS_PASSTHROUGH, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    // Act:
    const before = host.readUniformCalls;
    const out: ClipVertex = executeVertex(program, 0, new Map(), host);
    // Assert:
    expect(out.clipPos.length).toBe(4);
    expect(host.readUniformCalls).toBe(before);
  });
});

describe('Interpreter - fragment discard (TEST 12)', () => {
  it('test_fragment_discard_sets_discarded_true', () => {
    // Arrange:
    const fs =
      'precision mediump float;\nvarying vec4 vC;\nvoid main() {\n gl_FragColor = vec4(1.0);\n discard;\n gl_FragColor = vec4(0.0);\n}\n';
    const program = linked(VS_PASSTHROUGH, fs, 100);
    const host = new MockInterpreterHost();
    const varyings = new Map<string, Float32Array>([['vC', new Float32Array([1, 1, 1, 1])]]);
    // Act:
    const out: FragmentResult = executeFragment(program, varyings, host);
    // Assert:
    expect(out.discarded).toBe(true);
  });
});

describe('Interpreter - builtin normalize dispatch (TEST 13)', () => {
  it('test_builtin_normalize_dispatch_fround', () => {
    // Arrange:
    const vs =
      'attribute vec4 aPos;\nvarying vec4 vC;\nvoid main() {\n vec3 v = normalize(vec3(0.0, 3.0, 4.0));\n vC = vec4(v, 1.0);\n gl_Position = aPos;\n}\n';
    const program = linked(vs, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    // Act:
    const out: ClipVertex = executeVertex(program, 0, new Map(), host);
    // Assert:
    expect(out.varyings.get('vC')?.[0]).toBeCloseTo(Math.fround(0), 5);
    expect(out.varyings.get('vC')?.[1]).toBeCloseTo(Math.fround(0.6), 5);
    expect(out.varyings.get('vC')?.[2]).toBeCloseTo(Math.fround(0.8), 5);
  });
});

describe('Interpreter - ES300 fragment out variable (TEST 14)', () => {
  it('test_es300_fragment_out_variable_color', () => {
    // Arrange:
    const vs =
      '#version 300 es\nlayout(location = 0) in vec4 aPos;\nout vec4 vC;\nvoid main() {\n vC = aPos;\n gl_Position = aPos;\n}\n';
    const fs =
      '#version 300 es\nprecision mediump float;\nin vec4 vC;\nout vec4 fragColor;\nvoid main() {\n fragColor = vC;\n}\n';
    const program = linked(vs, fs, 300);
    const host = new MockInterpreterHost();
    const varyings = new Map<string, Float32Array>([['vC', new Float32Array([0.25, 0.5, 0.75, 1])]]);
    // Act:
    const out: FragmentResult = executeFragment(program, varyings, host);
    // Assert:
    expect(out.discarded).toBe(false);
    expect(out.color[0]).toBeCloseTo(0.25, 5);
    expect(out.color[1]).toBeCloseTo(0.5, 5);
    expect(out.color[2]).toBeCloseTo(0.75, 5);
    expect(out.color[3]).toBeCloseTo(1, 5);
  });
});

describe('Interpreter - float32 fround exactness (TEST 15)', () => {
  it('test_precision_fround_exactness', () => {
    // Arrange:
    const vs =
      'attribute vec4 aPos;\nvarying vec4 vC;\nvoid main() {\n float s = 0.1 + 0.2;\n vC = vec4(s, 0.0, 0.0, 1.0);\n gl_Position = aPos;\n}\n';
    const program = linked(vs, FS_PASSTHROUGH, 100);
    const host = new MockInterpreterHost();
    // Act:
    const out: ClipVertex = executeVertex(program, 0, new Map(), host);
    // Assert:
    expect(out.varyings.get('vC')?.[0]).toBe(Math.fround(0.1 + 0.2));
  });
});