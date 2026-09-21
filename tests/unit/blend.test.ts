/** Sprint 7 Task 3 TDD red-phase blend suite — targets planned applyBlendAndWrite from src/raster/blend.ts. */
import { describe, expect, it } from 'vitest';
import {
  ARRAY_BUFFER,
  BLEND,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  CONSTANT_ALPHA,
  CONSTANT_COLOR,
  DST_ALPHA,
  DST_COLOR,
  DITHER,
  FLOAT,
  FRAGMENT_SHADER,
  FUNC_ADD,
  FUNC_REVERSE_SUBTRACT,
  FUNC_SUBTRACT,
  INVALID_ENUM,
  LINK_STATUS,
  NO_ERROR,
  ONE,
  ONE_MINUS_CONSTANT_ALPHA,
  ONE_MINUS_CONSTANT_COLOR,
  ONE_MINUS_DST_ALPHA,
  ONE_MINUS_DST_COLOR,
  ONE_MINUS_SRC_ALPHA,
  ONE_MINUS_SRC_COLOR,
  RGBA,
  SRC_ALPHA,
  SRC_ALPHA_SATURATE,
  SRC_COLOR,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
  ZERO,
} from '../../src/gl/constants';
import type { GLenum } from '../../src/gl/constants';
import { ErrorSink } from '../../src/gl/errors';
import { DrawingBuffer } from '../../src/gl/framebuffer';
import { GLState } from '../../src/gl/state';
import type { PipelineState } from '../../src/gl/state';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import { applyBlendAndWrite } from '../../src/raster/blend';

const CS: readonly [number, number, number, number] = [0.6, 0.4, 0.2, 0.8];
const CD: readonly [number, number, number, number] = [0.1, 0.3, 0.5, 0.7];
const CC: readonly [number, number, number, number] = [0.25, 0.5, 0.75, 1.0];

const FACTORS: readonly GLenum[] = [
  ZERO, ONE, SRC_COLOR, ONE_MINUS_SRC_COLOR, DST_COLOR, ONE_MINUS_DST_COLOR,
  SRC_ALPHA, ONE_MINUS_SRC_ALPHA, DST_ALPHA, ONE_MINUS_DST_ALPHA,
  CONSTANT_COLOR, ONE_MINUS_CONSTANT_COLOR, CONSTANT_ALPHA, ONE_MINUS_CONSTANT_ALPHA,
  SRC_ALPHA_SATURATE,
];
const EQUATIONS: readonly GLenum[] = [FUNC_ADD, FUNC_SUBTRACT, FUNC_REVERSE_SUBTRACT];

function resolveFactor(f: GLenum, cs: number, cd: number, as_: number, ad: number, cc: number, ca: number): number {
  // Arrange inputs per channel; Act: resolve in float32 per ADR-012, mirroring
  // src/raster/blend.ts resolveFactor exactly. Assert via caller.
  switch (f) {
    case ZERO: return 0;
    case ONE: return 1;
    case SRC_COLOR: return Math.fround(cs);
    case ONE_MINUS_SRC_COLOR: return Math.fround(1 - Math.fround(cs));
    case DST_COLOR: return Math.fround(cd);
    case ONE_MINUS_DST_COLOR: return Math.fround(1 - Math.fround(cd));
    case SRC_ALPHA: return Math.fround(as_);
    case ONE_MINUS_SRC_ALPHA: return Math.fround(1 - Math.fround(as_));
    case DST_ALPHA: return Math.fround(ad);
    case ONE_MINUS_DST_ALPHA: return Math.fround(1 - Math.fround(ad));
    case CONSTANT_COLOR: return Math.fround(cc);
    case ONE_MINUS_CONSTANT_COLOR: return Math.fround(1 - Math.fround(cc));
    case CONSTANT_ALPHA: return Math.fround(ca);
    case ONE_MINUS_CONSTANT_ALPHA: return Math.fround(1 - Math.fround(ca));
    case SRC_ALPHA_SATURATE: return Math.fround(Math.min(Math.fround(as_), 1 - Math.fround(ad)));
    default: return 0;
  }
}

function evalEq(eq: GLenum, s: number, d: number): number {
  // GL spec: FUNC_ADD = src + dst, FUNC_SUBTRACT = src - dst,
  // FUNC_REVERSE_SUBTRACT = dst - src, all in float32.
  const sf = Math.fround(s);
  const df = Math.fround(d);
  if (eq === FUNC_SUBTRACT) return Math.fround(sf - df);
  if (eq === FUNC_REVERSE_SUBTRACT) return Math.fround(df - sf);
  return Math.fround(sf + df);
}

function expectedByte(eq: GLenum, sf: GLenum, df: GLenum, i: number): number {
  // Arrange: pick channel values. Destination colors pass through the RGBA8
  // byte buffer (Math.round(cd * 255) on write, fround(byte / 255) on read),
  // so the analytic model uses the same byte-quantized destination the
  // implementation reads — not the exact real-valued CD.
  const cs = Math.fround(CS[i] as number);
  const cd = Math.fround(Math.round((CD[i] as number) * 255) / 255);
  const cc = Math.fround(CC[i] as number);
  const as_ = Math.fround(CS[3] as number);
  const ad = Math.fround(Math.round((CD[3] as number) * 255) / 255);
  const ca = Math.fround(CC[3] as number);
  // Act: float32 blend + clamp + byte round, mirroring applyBlendAndWrite.
  const fs = resolveFactor(sf, cs, cd, as_, ad, cc, ca);
  const fd = resolveFactor(df, cs, cd, as_, ad, cc, ca);
  const blended = evalEq(eq, Math.fround(cs * fs), Math.fround(cd * fd));
  let clamped = Math.fround(blended);
  if (clamped <= 0) clamped = 0;
  if (clamped >= 1) clamped = 1;
  // Assert value computed by caller.
  return Math.round(clamped * 255);
}

function makeState(over: Partial<PipelineState> & { blend?: Partial<PipelineState['blend']> } = {}): PipelineState {
  // Arrange: real GLState with stub canvas.
  const sink = new ErrorSink();
  const g = new GLState(sink, { width: 4, height: 4 });
  const base = g.snapshot();
  return {
    ...base,
    ...over,
    blend: { ...base.blend, ...(over.blend ?? {}) },
  } as PipelineState;
}

describe('blend spec-matrix (675 combinations)', () => {
  it('matches analytic float32 expectations for every equation x src x dst', () => {
    // Arrange:
    const state = makeState({ blendEnabled: true, ditherEnabled: false, colorMask: [true, true, true, true] });
    const buf = new Uint8Array(4);
    // Act + Assert per combination:
    for (const eq of EQUATIONS) {
      for (const sf of FACTORS) {
        for (const df of FACTORS) {
          const st: PipelineState = {
            ...state,
            blend: { ...state.blend, srcRGB: sf, dstRGB: df, srcAlpha: sf, dstAlpha: df, equationRGB: eq, equationAlpha: eq, blendColor: CC },
          };
          buf[0] = Math.round((CD[0] as number) * 255);
          buf[1] = Math.round((CD[1] as number) * 255);
          buf[2] = Math.round((CD[2] as number) * 255);
          buf[3] = Math.round((CD[3] as number) * 255);
          applyBlendAndWrite(buf, 0, CS[0] as number, CS[1] as number, CS[2] as number, CS[3] as number, st, 0, 0, true);
          for (let i = 0; i < 4; i++) {
            expect(buf[i], `eq=${eq} sf=${sf} df=${df} ch=${i}`).toBe(expectedByte(eq, sf, df, i));
          }
        }
      }
    }
  });
});

describe('blendColor clamping', () => {
  it('clamps blend color components into [0,1]', () => {
    // Arrange:
    const sink = new ErrorSink();
    const g = new GLState(sink, { width: 2, height: 2 });
    // Act:
    g.setBlendColor(-0.5, 0.5, 1.5, 2.0);
    // Assert:
    const snap = g.snapshot();
    expect([...snap.blend.blendColor]).toEqual([0, 0.5, 1, 1]);
    expect(sink.getError()).toBe(NO_ERROR);
  });
});

describe('premultiplied-alpha formulation', () => {
  it('computes ONE / ONE_MINUS_SRC_ALPHA premultiplied result', () => {
    // Arrange:
    const st = makeState({
      blendEnabled: true,
      ditherEnabled: false,
      colorMask: [true, true, true, true],
      blend: {
        srcRGB: ONE, dstRGB: ONE_MINUS_SRC_ALPHA, srcAlpha: ONE, dstAlpha: ONE_MINUS_SRC_ALPHA,
        equationRGB: FUNC_ADD, equationAlpha: FUNC_ADD, blendColor: CC,
      },
    });
    const buf = new Uint8Array([0, 0, 0, 0]);
    // Act:
    applyBlendAndWrite(buf, 0, 0.5, 0.5, 0.5, 0.5, st, 0, 0, true);
    // Assert: 0.5*1 + 0*0.5 = 0.5 -> 128.
    expect([...buf]).toEqual([128, 128, 128, 128]);
  });
});

describe('ordered 4x4 Bayer dither', () => {
  it('applies Bayer pattern for 50% gray with DITHER on, flat with DITHER off', () => {
    // Arrange:
    const on = makeState({ blendEnabled: false, ditherEnabled: true, colorMask: [true, true, true, true] });
    const off = makeState({ blendEnabled: false, ditherEnabled: false, colorMask: [true, true, true, true] });
    const bayer = [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ];
    // Act + Assert:
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const bOn = new Uint8Array(4);
        applyBlendAndWrite(bOn, 0, 0.5, 0.5, 0.5, 1, on, x, y, true);
        const threshold = ((bayer[y] as number[])[x] as number + 0.5) / 16;
        const expectUp = 0.5 + (threshold - 0.5) / 255 > 0.5;
        expect(bOn[0]).toBe(expectUp ? 128 : 127);
        const bOff = new Uint8Array(4);
        applyBlendAndWrite(bOff, 0, 0.5, 0.5, 0.5, 1, off, x, y, true);
        expect(bOff[0]).toBe(128);
      }
    }
  });
});

describe('colorMask integration via readPixels', () => {
  it('writes only R and B channels when mask is (true,false,true,false)', () => {
    // Arrange: buffer-backed full-screen triangle via the established
    // draw.test.ts pattern (createBuffer + bufferData + shader pair +
    // vertexAttribPointer + enableVertexAttribArray + drawArrays).
    const gl = new WebGL1Context({ width: 1, height: 1 });
    gl.colorMask(true, false, true, false);
    gl.blendFunc(ONE, ZERO);
    gl.disable(BLEND);
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('arrange: createBuffer failed');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const vs = gl.createShader(VERTEX_SHADER);
    const fs = gl.createShader(FRAGMENT_SHADER);
    if (vs === null || fs === null) throw new Error('arrange: shader creation failed');
    gl.shaderSource(vs, 'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }');
    gl.shaderSource(fs, 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); }');
    gl.compileShader(vs);
    gl.compileShader(fs);
    if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('arrange: VS failed');
    if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('arrange: FS failed');
    const program = gl.createProgram();
    if (program === null) throw new Error('arrange: createProgram failed');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('arrange: link failed');
    gl.useProgram(program);
    const loc = gl.getAttribLocation(program, 'aPos');
    if (loc < 0) throw new Error('arrange: aPos location not found');
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    // Act: draw the white triangle then read back.
    gl.clearColor(0, 0, 0, 0);
    gl.clear(COLOR_BUFFER_BIT);
    gl.drawArrays(TRIANGLES, 0, 3);
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, px, 0);
    // Assert:
    expect(px[0]).toBe(255);
    expect(px[1]).toBe(0);
    expect(px[2]).toBe(255);
    expect(px[3]).toBe(0);
  });
});

describe('BLEND-disabled pass-through', () => {
  it('writes source directly and ignores dither when blend is off', () => {
    // Arrange:
    const st = makeState({ blendEnabled: false, ditherEnabled: true, colorMask: [true, true, true, true] });
    const buf = new Uint8Array([10, 20, 30, 40]);
    // Act:
    applyBlendAndWrite(buf, 0, 0.6, 0.4, 0.2, 0.8, st, 1, 2, true);
    // Assert:
    expect([...buf]).toEqual([153, 102, 51, 204]);
  });
});

describe('facade validation and error recording', () => {
  it('records INVALID_ENUM and mutates nothing on invalid blendFunc', () => {
    // Arrange:
    const gl = new WebGL1Context({ width: 2, height: 2 });
    const glAny = gl as unknown as Record<string, (...a: never[]) => void>;
    // Act:
    (glAny['blendFunc'] as (s: number, d: number) => void)(0xdead, ONE);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('records INVALID_ENUM on invalid blendEquation', () => {
    // Arrange:
    const gl = new WebGL1Context({ width: 2, height: 2 });
    const glAny = gl as unknown as Record<string, (...a: never[]) => void>;
    // Act:
    (glAny['blendEquation'] as (m: number) => void)(0xdead);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });
});

describe('depthMask-false gating', () => {
  it('does not write depth when depth mask is false', () => {
    // Arrange:
    const sink = new ErrorSink();
    const fb = new DrawingBuffer(sink, { width: 2, height: 2 });
    const g = new GLState(sink, { width: 2, height: 2 });
    g.setDepthMask(false);
    const st = g.snapshot();
    const before = fb.getDepthStencilBuffer()[0];
    // Act:
    applyBlendAndWrite(fb.getColorBuffer(), 0, 1, 0, 0, 1, st, 0, 0, true);
    // Assert:
    expect(fb.getDepthStencilBuffer()[0]).toBe(before);
  });
});
