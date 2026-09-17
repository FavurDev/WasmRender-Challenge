/**
 * @fileoverview TDD red-phase tests for codegen fragment closure rewire (Phase 2 Sprint 1 Task 1).
 * Headless Node Vitest, fixed fixtures, caller-owned scratch reused, no GUI.
 */
import { describe, expect, it } from 'vitest';
import { compileShaderSource } from '../../src/renderer/shader-compiler/codegen';
import type { FragmentClosure } from '../../src/renderer/shader-compiler/codegen';
import { TextureStore } from '../../src/renderer/texture';
import {
  CLAMP_TO_EDGE,
  NEAREST,
  RGBA,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  UNSIGNED_BYTE,
} from '../../src/renderer/gl-constants';

const VARYING_SRC = [
  'precision mediump float;',
  'varying vec4 vColor;',
  'void main() {',
  '  gl_FragColor = vColor;',
  '}',
].join('\n');

const SAMPLER_SRC = [
  'precision mediump float;',
  'varying vec2 vUv;',
  'uniform sampler2D uTex;',
  'void main() {',
  '  gl_FragColor = texture2D(uTex, vUv);',
  '}',
].join('\n');

const UNIFORM_SRC = [
  'precision mediump float;',
  'uniform vec4 uColor;',
  'void main() {',
  '  gl_FragColor = uColor;',
  '}',
].join('\n');

// Caller-owned scratch arrays allocated once per file and reused.
const scratchA = [0, 0, 0, 0];
const scratchB = [0, 0, 0, 0];

function asFragment(source: string): FragmentClosure {
  const result = compileShaderSource(source, 'fragment');
  return result.closure as unknown as FragmentClosure;
}

function upload2x2(store: TextureStore): number {
  const h = store.createTexture();
  store.bindTexture(TEXTURE_2D, h);
  store.texImage2D(
    TEXTURE_2D, 0, RGBA, 2, 2, RGBA, UNSIGNED_BYTE,
    new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
  );
  store.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
  store.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
  store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
  store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, CLAMP_TO_EDGE);
  return h;
}

describe('codegen fragment closure rewire (TDD red phase)', () => {
  it('varying vectors drive distinct colors', () => {
    // Arrange
    const frag = asFragment(VARYING_SRC);
    const varyingsA = [1, 0, 0, 1];
    const varyingsB = [0, 0, 1, 1];
    const uniforms: Record<string, number[]> = {};
    const samplers: unknown[] = [];
    const colorOutA = [0, 0, 0, 0];
    const colorOutB = [0, 0, 0, 0];
    // Act
    frag(varyingsA, uniforms, samplers, colorOutA);
    frag(varyingsB, uniforms, samplers, colorOutB);
    scratchA[0] = colorOutA[0] as number;
    scratchB[0] = colorOutB[0] as number;
    // Assert
    expect(colorOutA).toEqual([1, 0, 0, 1]);
    expect(colorOutB).toEqual([0, 0, 1, 1]);
    expect(JSON.stringify(colorOutA)).not.toBe(JSON.stringify(colorOutB));
  });

  it('sampler bindings reach real texels', () => {
    // Arrange
    const store = new TextureStore();
    const handle = upload2x2(store);
    const frag = asFragment(SAMPLER_SRC);
    const samplers: unknown[] = [
      { sample: (u: number, v: number, out: number[]): void => {
        const t = store.sample2D(handle, u, v);
        out[0] = t[0]; out[1] = t[1]; out[2] = t[2]; out[3] = t[3];
      } },
    ];
    const uniforms: Record<string, number[]> = {};
    const colorRed = [0, 0, 0, 0];
    const colorWhite = [0, 0, 0, 0];
    // Act
    frag([0.25, 0.25], uniforms, samplers, colorRed);
    frag([0.75, 0.75], uniforms, samplers, colorWhite);
    // Assert
    for (let i = 0; i < 4; i++) {
      expect(Math.abs((colorRed[i] as number) - [1, 0, 0, 1][i]!)).toBeLessThan(0.01);
      expect(Math.abs((colorWhite[i] as number) - [1, 1, 1, 1][i]!)).toBeLessThan(0.01);
    }
    expect(JSON.stringify(colorRed)).not.toBe(JSON.stringify(colorWhite));
  });

  it('live uniforms change output', () => {
    // Arrange
    const frag = asFragment(UNIFORM_SRC);
    const varyings: number[] = [];
    const uniformsA: Record<string, number[]> = { uColor: [1, 0, 0, 1] };
    const uniformsB: Record<string, number[]> = { uColor: [0, 1, 0, 1] };
    const samplers: unknown[] = [];
    const colorA = [0, 0, 0, 0];
    const colorB = [0, 0, 0, 0];
    // Act
    frag(varyings, uniformsA, samplers, colorA);
    frag(varyings, uniformsB, samplers, colorB);
    // Assert
    expect(colorA).toEqual([1, 0, 0, 1]);
    expect(colorB).toEqual([0, 1, 0, 1]);
    expect(JSON.stringify(colorA)).not.toBe(JSON.stringify(colorB));
  });

  it('no per-fragment allocation guard', () => {
    // Arrange
    const frag = asFragment(VARYING_SRC);
    const body = Function.prototype.toString.call(frag);
    // Act: inspect closure body + invoke twice reusing scratch
    const colorA = [0, 0, 0, 0];
    const colorB = [0, 0, 0, 0];
    frag([1, 0, 0, 1], {}, [], colorA);
    frag([0, 0, 1, 1], {}, [], colorB);
    // Assert: no per-invocation allocation constructs in closure body
    expect(body).not.toContain('void samplers');
    expect(body).not.toContain('new Map');
    expect(body).not.toContain('new Array');
    expect(body).not.toContain('.slice(');
    expect(colorA).toEqual([1, 0, 0, 1]);
    expect(colorB).toEqual([0, 0, 1, 1]);
    // Assert: closure body has no spread/object-literal/Map allocation on hot path
    expect(body).not.toContain('...');
    expect(body).not.toContain('new Map');
    // Behavioral check: double-invoke reusing caller-owned scratch yields correct colors
    const reuseA = [0, 0, 0, 0];
    const reuseB = [0, 0, 0, 0];
    frag([1, 0, 0, 1], {}, [], reuseA);
    frag([0, 0, 1, 1], {}, [], reuseB);
    expect(reuseA).toEqual([1, 0, 0, 1]);
    expect(reuseB).toEqual([0, 0, 1, 1]);
  });
});
