// CHANGELOG: Sprint 7 Task 2 (2026-09-21): Per-fragment scissor/stencil/depth pipeline, packed DEPTH24_STENCIL8 updates.
/** Depth/stencil per-fragment pipeline: scissor, stencil, depth stages. L4 raster: imports constants + state (type-only) only. */
import {
  ALWAYS,
  DECR,
  DECR_WRAP,
  EQUAL,
  GEQUAL,
  GREATER,
  INCR,
  INCR_WRAP,
  INVERT,
  KEEP,
  LESS,
  LEQUAL,
  NEVER,
  NOTEQUAL,
  REPLACE,
  ZERO,
} from '../gl/constants';
import type { GLenum } from '../gl/constants';
import type { PipelineState, ViewportRect } from '../gl/state';

const STENCIL_MASK_8 = 255;
const DEPTH_MASK_24 = 16777215;

interface ScissorBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Test whether a fragment lies inside the scissor box.
 *
 * Args:
 *   x: Fragment x in device pixels.
 *   y: Fragment y in device pixels.
 *   box: Scissor rectangle.
 *
 * Returns:
 *   True when (x, y) lies inside the box (inclusive min, exclusive max).
 */
export function passesScissorTest(x: number, y: number, box: ScissorBox | ViewportRect): boolean {
  return x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
}

/**
 * Evaluate a stencil comparison function on masked ref vs masked stored value.
 *
 * Args:
 *   func: Stencil comparison enum.
 *   ref: Reference value (already masked by caller convention).
 *   mask: Value mask applied to both ref and stored.
 *   stored: Stored stencil value.
 *
 * Returns:
 *   True when the comparison passes.
 */
export function evaluateStencilTest(func: GLenum, ref: number, mask: number, stored: number): boolean {
  const m = mask & STENCIL_MASK_8;
  const r = (ref & m) & STENCIL_MASK_8;
  const s = (stored & m) & STENCIL_MASK_8;
  if (func === NEVER) return false;
  if (func === LESS) return r < s;
  if (func === EQUAL) return r === s;
  if (func === LEQUAL) return r <= s;
  if (func === GREATER) return r > s;
  if (func === NOTEQUAL) return r !== s;
  if (func === GEQUAL) return r >= s;
  if (func === ALWAYS) return true;
  return false;
}

/**
 * Compute the new stencil value for a stencil op.
 *
 * Args:
 *   op: Stencil op enum.
 *   ref: Reference value.
 *   stored: Stored stencil value.
 *
 * Returns:
 *   New 8-bit stencil value.
 */
export function computeStencilOp(op: GLenum, stored: number, ref: number): number {
  const r = ref & STENCIL_MASK_8;
  const s = stored & STENCIL_MASK_8;
  if (op === KEEP) return s;
  if (op === ZERO) return 0;
  if (op === REPLACE) return r;
  if (op === INCR) return s >= STENCIL_MASK_8 ? STENCIL_MASK_8 : s + 1;
  if (op === DECR) return s <= 0 ? 0 : s - 1;
  if (op === INVERT) return (~s) & STENCIL_MASK_8;
  if (op === INCR_WRAP) return (s + 1) & STENCIL_MASK_8;
  if (op === DECR_WRAP) return (s - 1) & STENCIL_MASK_8;
  return s;
}

/**
 * Evaluate a depth comparison function.
 *
 * Args:
 *   func: Depth comparison enum.
 *   incoming: Incoming 24-bit depth.
 *   stored: Stored 24-bit depth.
 *
 * Returns:
 *   True when the comparison passes.
 */
export function passesDepthTest(func: GLenum, incoming: number, stored: number): boolean {
  if (func === NEVER) return false;
  if (func === LESS) return incoming < stored;
  if (func === EQUAL) return incoming === stored;
  if (func === LEQUAL) return incoming <= stored;
  if (func === GREATER) return incoming > stored;
  if (func === NOTEQUAL) return incoming !== stored;
  if (func === GEQUAL) return incoming >= stored;
  if (func === ALWAYS) return true;
  return incoming < stored;
}

/**
 * Execute scissor, stencil, and depth stages for one fragment, updating packed depth/stencil.
 *
 * Args:
 *   x: Fragment x in device pixels.
 *   y: Fragment y in device pixels.
 *   fragDepth24: Incoming 24-bit depth value.
 *   isFrontFacing: True for front-facing fragments (selects stencil face).
 *   state: Frozen pipeline snapshot.
 *   depthStencil: Packed DEPTH24_STENCIL8 buffer.
 *   index: Pixel index into depthStencil.
 *
 * Returns:
 *   True when the fragment passes all enabled stages.
 */
export function executeFragmentDepthStencil(
  x: number,
  y: number,
  fragDepth24: number,
  isFrontFacing: boolean,
  state: PipelineState,
  depthStencil: Uint32Array,
  index: number,
): boolean {
  const frag = (fragDepth24 & DEPTH_MASK_24) >>> 0;
  const word = (depthStencil[index] as number) >>> 0;
  const storedDepth = ((word >>> 8) & DEPTH_MASK_24) >>> 0;
  const storedStencil = (word & STENCIL_MASK_8) >>> 0;
  if (state.scissorTestEnabled && !passesScissorTest(x, y, state.scissorBox)) return false;
  if (state.stencilTestEnabled) {
    const face = isFrontFacing ? state.stencilFront : state.stencilBack;
    const stencilPass = evaluateStencilTest(face.func, face.ref, face.valueMask, storedStencil);
    const writeMask = (face.writeMask & STENCIL_MASK_8) >>> 0;
    if (!stencilPass) {
      const next = computeStencilOp(face.sfail, storedStencil, face.ref) & STENCIL_MASK_8;
      const merged = ((storedStencil & (~writeMask & STENCIL_MASK_8)) | (next & writeMask)) & STENCIL_MASK_8;
      depthStencil[index] = (((storedDepth * 256) | merged) >>> 0) as number;
      return false;
    }
    if (state.depthTestEnabled) {
      const depthPass = passesDepthTest(state.depth.func, frag, storedDepth);
      if (!depthPass) {
        const next = computeStencilOp(face.dpfail, storedStencil, face.ref) & STENCIL_MASK_8;
        const merged = ((storedStencil & (~writeMask & STENCIL_MASK_8)) | (next & writeMask)) & STENCIL_MASK_8;
        depthStencil[index] = (((storedDepth * 256) | merged) >>> 0) as number;
        return false;
      }
    }
    const next = computeStencilOp(face.dppass, storedStencil, face.ref) & STENCIL_MASK_8;
    const merged = ((storedStencil & (~writeMask & STENCIL_MASK_8)) | (next & writeMask)) & STENCIL_MASK_8;
    const finalDepth = state.depth.mask ? frag : storedDepth;
    depthStencil[index] = (((finalDepth * 256) | merged) >>> 0) as number;
    return true;
  }
  if (state.depthTestEnabled) {
    const depthPass = passesDepthTest(state.depth.func, frag, storedDepth);
    if (!depthPass) return false;
  }
  if (state.depth.mask) {
    depthStencil[index] = (((frag * 256) | storedStencil) >>> 0) as number;
  }
  return true;
}
