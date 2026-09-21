// CHANGELOG: Sprint 2 (2026-09-20): Sprint 2 T3 edge-function traversal rasterizer with top-left fill rule
/** Edge-function traversal rasterizer with top-left fill rule (L4 raster, ADR-012 float32).

Maps clip-space vertices to 1/16th subpixel screen vertices and rasterizes
triangles with integer orient2d edge functions, incremental scan stepping, and
a single reused Fragment record (zero per-fragment allocation).
 */
import { BACK, CCW, FRONT, FRONT_AND_BACK } from '../gl/constants';
import type { ClipVertex } from './clipper';
import type { DrawingBuffer } from '../gl/framebuffer';
import type { PipelineState } from '../gl/state';
import { interpolateDepth, perspectiveCorrect } from './interpolate';

export interface ScreenVertex {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly invW: number;
  readonly varyings: Float32Array;
}

/** Mutable per-fragment record, allocated once per rasterizeTriangle call. */
interface Fragment {
  x: number;
  y: number;
  depth: number;
  varyings: Float32Array;
}

const FIXED_SCALE = 16;
const FIXED_HALF = 8;
const DEPTH_MAX_24 = 16777215;

function finiteOrZero(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

/** Integer orient2d predicate: signed doubled area of (a, b, c). */
function orient2d(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** Top-left tie-break: covered if strictly inside, or exactly on a top-left edge. */
function isCovered(w: number, isTopLeft: boolean): boolean {
  return w > 0 || (w === 0 && isTopLeft);
}

export function mapClipToScreen(clipVertex: ClipVertex, state: PipelineState): ScreenVertex {
  const w = clipVertex.clip[3];
  let invW = 0;
  if (Math.abs(w) >= 1e-6 && Number.isFinite(w)) {
    invW = Math.fround(1 / w);
  }
  const ndcX = Math.fround(finiteOrZero(clipVertex.clip[0]) * invW);
  const ndcY = Math.fround(finiteOrZero(clipVertex.clip[1]) * invW);
  const ndcZ = Math.fround(finiteOrZero(clipVertex.clip[2]) * invW);
  const vp = state.viewport;
  const winX = Math.fround(finiteOrZero(vp.x) + Math.fround(Math.fround(Math.fround(ndcX * 0.5) + 0.5) * vp.width));
  const winY = Math.fround(finiteOrZero(vp.y) + Math.fround(Math.fround(Math.fround(ndcY * 0.5) + 0.5) * vp.height));
  const z01 = Math.fround(Math.fround(ndcZ * 0.5) + 0.5);
  const near = Math.fround(state.depth.range[0]);
  const far = Math.fround(state.depth.range[1]);
  const diff = Math.fround(far - near);
  const scaled = Math.fround(diff * z01);
  const z = Math.fround(near + scaled);
  const varyings = new Float32Array(clipVertex.varyings.length);
  varyings.set(clipVertex.varyings);
  return {
    x: Math.round(winX * FIXED_SCALE),
    y: Math.round(winY * FIXED_SCALE),
    z,
    invW,
    varyings,
  };
}

export function rasterizeTriangle(
  v0: ScreenVertex,
  v1: ScreenVertex,
  v2: ScreenVertex,
  state: PipelineState,
  fb: DrawingBuffer,
): void {
  let ax = v0;
  let bx = v1;
  let cx = v2;
  let area = orient2d(ax.x, ax.y, bx.x, bx.y, cx.x, cx.y);
  // Zero-area rejection: degenerate triangles silently emit no fragments.
  if (area === 0) {
    return;
  }
  // Back-face culling from the signed area before any fragment work.
  const frontIsCCW = state.raster.frontFace === CCW;
  const isFrontFacing = frontIsCCW ? area > 0 : area < 0;
  if (state.cullFaceEnabled) {
    const mode = state.raster.cullFaceMode;
    if (mode === FRONT_AND_BACK) {
      return;
    }
    if (mode === BACK && !isFrontFacing) {
      return;
    }
    if (mode === FRONT && isFrontFacing) {
      return;
    }
  }
  // Winding normalization: force counter-clockwise (positive area) traversal.
  if (area < 0) {
    const tmp = bx;
    bx = cx;
    cx = tmp;
    area = -area;
  }
  const bufW = fb.getWidth();
  const bufH = fb.getHeight();
  if (bufW <= 0 || bufH <= 0) {
    return;
  }
  // IMPLEMENTATION DECISION: bbox in whole pixels via floor(fixed/16), clamped to
  // viewport ∩ scissor ∩ buffer. Rationale: pixel centers at px*16+8 are the sample
  // points, so floor maps every covered center into the box. Alternatives: ceil-based
  // bounds (equivalent after clamping, harder to audit).
  let loX = Math.floor(Math.min(ax.x, bx.x, cx.x) / FIXED_SCALE);
  let hiX = Math.floor(Math.max(ax.x, bx.x, cx.x) / FIXED_SCALE);
  let loY = Math.floor(Math.min(ax.y, bx.y, cx.y) / FIXED_SCALE);
  let hiY = Math.floor(Math.max(ax.y, bx.y, cx.y) / FIXED_SCALE);
  const vp = state.viewport;
  loX = Math.max(loX, Math.floor(vp.x), 0);
  loY = Math.max(loY, Math.floor(vp.y), 0);
  hiX = Math.min(hiX, Math.ceil(vp.x + vp.width) - 1, bufW - 1);
  hiY = Math.min(hiY, Math.ceil(vp.y + vp.height) - 1, bufH - 1);
  if (state.scissorTestEnabled) {
    const sc = state.scissorBox;
    loX = Math.max(loX, Math.floor(sc.x));
    loY = Math.max(loY, Math.floor(sc.y));
    hiX = Math.min(hiX, Math.ceil(sc.x + sc.width) - 1);
    hiY = Math.min(hiY, Math.ceil(sc.y + sc.height) - 1);
  }
  if (loX > hiX || loY > hiY) {
    return;
  }
  // Directed edges opposite each vertex: e0 = b→c, e1 = c→a, e2 = a→b.
  const e0dx = cx.x - bx.x;
  const e0dy = cx.y - bx.y;
  const e1dx = ax.x - cx.x;
  const e1dy = ax.y - cx.y;
  const e2dx = bx.x - ax.x;
  const e2dy = bx.y - ax.y;
  const e0stepX = -e0dy * FIXED_SCALE;
  const e0stepY = e0dx * FIXED_SCALE;
  const e1stepX = -e1dy * FIXED_SCALE;
  const e1stepY = e1dx * FIXED_SCALE;
  const e2stepX = -e2dy * FIXED_SCALE;
  const e2stepY = e2dx * FIXED_SCALE;
  const e0tl = e0dy < 0 || (e0dy === 0 && e0dx < 0);
  const e1tl = e1dy < 0 || (e1dy === 0 && e1dx < 0);
  const e2tl = e2dy < 0 || (e2dy === 0 && e2dx < 0);
  // Edge values at the top-left sample center of the bbox.
  const startX = loX * FIXED_SCALE + FIXED_HALF;
  const startY = loY * FIXED_SCALE + FIXED_HALF;
  let w0row = orient2d(bx.x, bx.y, cx.x, cx.y, startX, startY);
  let w1row = orient2d(cx.x, cx.y, ax.x, ax.y, startX, startY);
  let w2row = orient2d(ax.x, ax.y, bx.x, bx.y, startX, startY);
  const invArea = Math.fround(1 / area);
  const invW: [number, number, number] = [ax.invW, bx.invW, cx.invW];
  const sources: Float32Array[] = [ax.varyings, bx.varyings, cx.varyings];
  const zVals: [number, number, number] = [ax.z, bx.z, cx.z];
  // Single reused Fragment record + interpolated-varyings buffer: zero allocation in the scan.
  const fragVaryings = new Float32Array(ax.varyings.length);
  const frag: Fragment = { x: 0, y: 0, depth: 0, varyings: fragVaryings };
  const color = fb.getColorBuffer();
  const ds = fb.getDepthStencilBuffer();
  const bary: [number, number, number] = [0, 0, 0];
  for (let py = loY; py <= hiY; py++) {
    let w0 = w0row;
    let w1 = w1row;
    let w2 = w2row;
    for (let px = loX; px <= hiX; px++) {
      if (isCovered(w0, e0tl) && isCovered(w1, e1tl) && isCovered(w2, e2tl)) {
        bary[0] = Math.fround(w0 * invArea);
        bary[1] = Math.fround(w1 * invArea);
        bary[2] = Math.fround(w2 * invArea);
        perspectiveCorrect(bary, invW, sources, fragVaryings);
        frag.x = px;
        frag.y = py;
        frag.depth = interpolateDepth(bary, zVals);
        const idx = frag.y * bufW + frag.x;
        const n = fragVaryings.length;
        if (n >= 4) {
          const o = idx * 4;
          color[o] = Math.round(clamp01(fragVaryings[0] as number) * 255);
          color[o + 1] = Math.round(clamp01(fragVaryings[1] as number) * 255);
          color[o + 2] = Math.round(clamp01(fragVaryings[2] as number) * 255);
          color[o + 3] = Math.round(clamp01(fragVaryings[3] as number) * 255);
        } else if (n === 3) {
          const o = idx * 4;
          color[o] = Math.round(clamp01(fragVaryings[0] as number) * 255);
          color[o + 1] = Math.round(clamp01(fragVaryings[1] as number) * 255);
          color[o + 2] = Math.round(clamp01(fragVaryings[2] as number) * 255);
          color[o + 3] = 255;
        } else {
          const o = idx * 4;
          color[o] = 255;
          color[o + 1] = 255;
          color[o + 2] = 255;
          color[o + 3] = 255;
        }
        const depth24 = Math.round(clamp01(frag.depth) * DEPTH_MAX_24) & DEPTH_MAX_24;
        ds[idx] = ((depth24 * 256) | ((ds[idx] as number) & 0xff)) >>> 0;
      }
      w0 += e0stepX;
      w1 += e1stepX;
      w2 += e2stepX;
    }
    w0row += e0stepY;
    w1row += e1stepY;
    w2row += e2stepY;
  }
}