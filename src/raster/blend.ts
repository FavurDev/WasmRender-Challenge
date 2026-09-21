// CHANGELOG: Sprint 7 (2026-09-21): Sprint 7 T3 output-merge stage — blend equation/factor matrix, 4x4 Bayer dither, colorMask write gating
/** Output-merge stage: per-fragment blending, ordered dithering, masked color writes. L4 raster: imports constants + state (type-only) only. */
import {
  CONSTANT_ALPHA,
  CONSTANT_COLOR,
  DST_ALPHA,
  DST_COLOR,
  FUNC_ADD,
  FUNC_REVERSE_SUBTRACT,
  FUNC_SUBTRACT,
  ONE,
  ONE_MINUS_CONSTANT_ALPHA,
  ONE_MINUS_CONSTANT_COLOR,
  ONE_MINUS_DST_ALPHA,
  ONE_MINUS_DST_COLOR,
  ONE_MINUS_SRC_ALPHA,
  ONE_MINUS_SRC_COLOR,
  SRC_ALPHA,
  SRC_ALPHA_SATURATE,
  SRC_COLOR,
  ZERO,
} from '../gl/constants';
import type { GLenum } from '../gl/constants';
import type { PipelineState } from '../gl/state';

/** 4x4 Bayer threshold matrix, row-major, module scope (zero per-fragment allocation). */
const BAYER_4X4: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Clamp to [0, 1] in float32. */
function clamp01f(v: number): number {
  const f = Math.fround(v);
  if (f <= 0) return 0;
  if (f >= 1) return 1;
  return f;
}

/**
 * Resolve a blend factor to a float32 weight for one channel.
 *
 * Args:
 *   factor: Blend factor enum.
 *   channel: Channel index (0=R, 1=G, 2=B, 3=A).
 *   src: Source RGBA color in [0, 1].
 *   dst: Destination RGBA color in [0, 1].
 *   blendColor: Clamped blend color RGBA in [0, 1].
 *
 * Returns:
 *   Float32 factor weight. SRC_ALPHA_SATURATE yields min(srcA, 1-dstA)
 *   (meaningful as a source RGB factor; evaluated identically for alpha).
 */
export function resolveFactor(
  factor: GLenum,
  channel: number,
  src: readonly [number, number, number, number],
  dst: readonly [number, number, number, number],
  blendColor: readonly [number, number, number, number],
): number {
  const cs = Math.fround(src[channel] as number);
  const cd = Math.fround(dst[channel] as number);
  const as = Math.fround(src[3]);
  const ad = Math.fround(dst[3]);
  const cc = Math.fround(blendColor[channel] as number);
  const ca = Math.fround(blendColor[3]);
  switch (factor) {
    case ZERO: return 0;
    case ONE: return 1;
    case SRC_COLOR: return cs;
    case ONE_MINUS_SRC_COLOR: return Math.fround(1 - cs);
    case DST_COLOR: return cd;
    case ONE_MINUS_DST_COLOR: return Math.fround(1 - cd);
    case SRC_ALPHA: return as;
    case ONE_MINUS_SRC_ALPHA: return Math.fround(1 - as);
    case DST_ALPHA: return ad;
    case ONE_MINUS_DST_ALPHA: return Math.fround(1 - ad);
    case CONSTANT_COLOR: return cc;
    case ONE_MINUS_CONSTANT_COLOR: return Math.fround(1 - cc);
    case CONSTANT_ALPHA: return ca;
    case ONE_MINUS_CONSTANT_ALPHA: return Math.fround(1 - ca);
    case SRC_ALPHA_SATURATE: return Math.fround(Math.min(as, 1 - ad));
    default: return 0;
  }
}

/**
 * Evaluate a blend equation on scaled source/destination terms.
 *
 * Args:
 *   equation: FUNC_ADD, FUNC_SUBTRACT, or FUNC_REVERSE_SUBTRACT.
 *   s: Scaled source term (float32).
 *   d: Scaled destination term (float32).
 *
 * Returns:
 *   Blended value clamped to [0, 1].
 */
export function evaluateEquation(equation: GLenum, s: number, d: number): number {
  const sf = Math.fround(s);
  const df = Math.fround(d);
  if (equation === FUNC_SUBTRACT) return clamp01f(Math.fround(sf - df));
  if (equation === FUNC_REVERSE_SUBTRACT) return clamp01f(Math.fround(df - sf));
  void FUNC_ADD;
  return clamp01f(Math.fround(sf + df));
}

/**
 * Apply the 4x4 Bayer ordered-dither offset (zero-mean).
 *
 * Args:
 *   value: Linear channel value in [0, 1].
 *   x: Fragment x coordinate.
 *   y: Fragment y coordinate.
 *
 * Returns:
 *   Dithered value clamped to [0, 1]. Offset is
 *   (threshold - 7.5) / (16 * 255), i.e. at most half an LSB.
 */
export function applyBayerDither(value: number, x: number, y: number): number {
  const t = BAYER_4X4[(((y & 3) * 4 + (x & 3)) as number)] as number;
  const offset = Math.fround(Math.fround(t - 7.5) / Math.fround(16 * 255));
  return clamp01f(Math.fround(Math.fround(value) + offset));
}

/**
 * Blend one fragment against the destination byte and write masked channels.
 *
 * Args:
 *   buffer: RGBA8 destination buffer.
 *   offset: Byte offset of the target pixel (pixelIndex * 4).
 *   srcR: Source color channels in [0, 1].
 *   srcG: Source color channels in [0, 1].
 *   srcB: Source color channels in [0, 1].
 *   srcA: Source color channels in [0, 1].
 *   state: Frozen pipeline snapshot (blend factors/equations/color, masks, enables).
 *   x: Fragment x coordinate (dither pattern).
 *   y: Fragment y coordinate (dither pattern).
 *   premultipliedAlpha: Accepted for API shape; blend factors already encode
 *     premultiplied vs non-premultiplied formulations, so no extra scaling.
 */
export function applyBlendAndWrite(
  buffer: Uint8Array,
  offset: number,
  srcR: number,
  srcG: number,
  srcB: number,
  srcA: number,
  state: PipelineState,
  x: number,
  y: number,
  premultipliedAlpha: boolean,
): void {
  void premultipliedAlpha;
  const src: readonly [number, number, number, number] = [
    clamp01f(srcR),
    clamp01f(srcG),
    clamp01f(srcB),
    clamp01f(srcA),
  ];
  const dst: readonly [number, number, number, number] = [
    Math.fround((buffer[offset] as number) / 255),
    Math.fround((buffer[(offset + 1) as number] as number) / 255),
    Math.fround((buffer[(offset + 2) as number] as number) / 255),
    Math.fround((buffer[(offset + 3) as number] as number) / 255),
  ];
  const bc = state.blend.blendColor;
  const blendColor: readonly [number, number, number, number] = [
    clamp01f(bc[0]),
    clamp01f(bc[1]),
    clamp01f(bc[2]),
    clamp01f(bc[3]),
  ];
  let r = src[0];
  let g = src[1];
  let b = src[2];
  let a = src[3];
  if (state.blendEnabled) {
    const b0 = state.blend;
    const fsR = resolveFactor(b0.srcRGB, 0, src, dst, blendColor);
    const fdR = resolveFactor(b0.dstRGB, 0, src, dst, blendColor);
    const fsG = resolveFactor(b0.srcRGB, 1, src, dst, blendColor);
    const fdG = resolveFactor(b0.dstRGB, 1, src, dst, blendColor);
    const fsB = resolveFactor(b0.srcRGB, 2, src, dst, blendColor);
    const fdB = resolveFactor(b0.dstRGB, 2, src, dst, blendColor);
    const fsA = resolveFactor(b0.srcAlpha, 3, src, dst, blendColor);
    const fdA = resolveFactor(b0.dstAlpha, 3, src, dst, blendColor);
    r = evaluateEquation(b0.equationRGB, Math.fround(src[0] * fsR), Math.fround(dst[0] * fdR));
    g = evaluateEquation(b0.equationRGB, Math.fround(src[1] * fsG), Math.fround(dst[1] * fdG));
    b = evaluateEquation(b0.equationRGB, Math.fround(src[2] * fsB), Math.fround(dst[2] * fdB));
    a = evaluateEquation(b0.equationAlpha, Math.fround(src[3] * fsA), Math.fround(dst[3] * fdA));
  }
  if (state.ditherEnabled) {
    r = applyBayerDither(r, x, y);
    g = applyBayerDither(g, x, y);
    b = applyBayerDither(b, x, y);
    a = applyBayerDither(a, x, y);
  }
  const mask = state.colorMask;
  if (mask[0]) buffer[offset] = Math.round(clamp01f(r) * 255);
  if (mask[1]) buffer[(offset + 1) as number] = Math.round(clamp01f(g) * 255);
  if (mask[2]) buffer[(offset + 2) as number] = Math.round(clamp01f(b) * 255);
  if (mask[3]) buffer[(offset + 3) as number] = Math.round(clamp01f(a) * 255);
}
