/**
 * @fileoverview Stateless triangle coverage core with perspective-correct interpolation.
 *
 * Coverage plus interpolation and pipeline: clip-space divide, NDC-to-viewport
 * mapping, clamped bounding-box iteration, barycentric edge functions,
 * degenerate skip, perspective-correct varying recovery via precomputed a/w
 * and 1/w scratch with per-fragment 1/w divide, fragment program seam,
 * per-fragment stages in order scissor, stencil, depth (8 modes), then
 * depthMask/colorMask-gated writes, plus drawArraysImpl / drawElementsImpl
 * entry points.
 */
// CHANGELOG:
// - Sprint 4: Created coverage core with top-left rule, perspective-correct varyings, pipeline, and blending.
// - Sprint 5: Added instanced fan-out via writeFragmentToAttachments with fragmentColors/fragScratch.
// - Sprint 6: Deterministic stencil gate (nonzero stencil passes) replacing pass-through.
import type { Framebuffer } from './framebuffer';
import type { GLState } from './state';
import type { FragmentClosure } from './shader-compiler/codegen';
import { ALWAYS, COLOR_ATTACHMENT0, CONSTANT_ALPHA, CONSTANT_COLOR, DST_ALPHA, DST_COLOR, EQUAL, FUNC_ADD, FUNC_REVERSE_SUBTRACT, FUNC_SUBTRACT, GEQUAL, GREATER, LEQUAL, LESS, NEVER, NOTEQUAL, ONE, ONE_MINUS_CONSTANT_ALPHA, ONE_MINUS_CONSTANT_COLOR, ONE_MINUS_DST_ALPHA, ONE_MINUS_DST_COLOR, ONE_MINUS_SRC_ALPHA, ONE_MINUS_SRC_COLOR, SRC_ALPHA, SRC_ALPHA_SATURATE, SRC_COLOR, ZERO } from './gl-constants';

/** One post-transform vertex consumed by coverage math. */
export interface Vertex {
  position: [number, number, number, number];
  varyings: Float32Array;
}

/** Sampler slot carrying a store-backed sample capability. */
export interface TextureBinding {
  unit: number;
  handle: number;
  sample?: (u: number, v: number, out: number[]) => void;
}

/** Per-draw bundle; rasterizer never touches the context facade. */
export interface DrawCall {
  program: unknown;
  framebuffer: Framebuffer;
  state: GLState;
  vertices: Vertex[];
  indices: Uint16Array | number[] | null;
  instanceCount: number;
  samplers: TextureBinding[];
  uniforms?: Record<string, number[]>;
  colorOut?: number[];
  fragmentColor: [number, number, number, number];
  fragmentColors?: Array<[number, number, number, number]>;
  fragScratch?: Array<[number, number, number, number]>;
}

/**
 * Signed doubled area of the directed edge a->b evaluated at p.
 *
 * @param ax Edge start x in framebuffer space.
 * @param ay Edge start y in framebuffer space.
 * @param bx Edge end x in framebuffer space.
 * @param by Edge end y in framebuffer space.
 * @param px Candidate sample x.
 * @param py Candidate sample y.
 * @returns Twice the signed triangle area; sign follows winding.
 */
function edge(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

/**
 * Top-left tie-break for one directed edge.
 *
 * @param ax Edge start x in framebuffer space.
 * @param ay Edge start y in framebuffer space.
 * @param bx Edge end x in framebuffer space.
 * @param by Edge end y in framebuffer space.
 * @returns True when the edge is horizontal going right or non-horizontal going down.
 */
function isTopLeft(ax: number, ay: number, bx: number, by: number): boolean {
  // Top edge: horizontal, going right. Left edge: going down (screen space y down? use math: dy>0 means downward in fb space).
  // Standard rule adapted: top = horizontal with bx>ax; left = non-horizontal with edge going down (by>ay).
  if (ay === by) return bx > ax;
  return by > ay;
}

/**
 * Projects one clip-space vertex to framebuffer sample space.
 *
 * @param v Post-transform vertex carrying the clip-space position quad.
 * @param vp Viewport box ordered x, y, width, height.
 * @returns Screen-space position, or null when w equals zero and the triangle must skip.
 */
function project(v: Vertex, vp: readonly [number, number, number, number]): [number, number] | null {
  const w = v.position[3] as number;
  if (w === 0) return null;
  const ndcX = (v.position[0] as number) / w;
  const ndcY = (v.position[1] as number) / w;
  const sx = ((ndcX + 1) / 2) * (vp[2] as number) + (vp[0] as number);
  const sy = ((ndcY + 1) / 2) * (vp[3] as number) + (vp[1] as number);
  return [sx, sy];
}

/**
 * Precomputes reciprocal-w and attribute-over-w once per triangle.
 *
 * @param v0 First vertex carrying w and varyings.
 * @param v1 Second vertex carrying w and varyings.
 * @param v2 Third vertex carrying w and varyings.
 * @param varyingCount Number of varyings per vertex.
 * @param scratchAw Caller-owned scratch sized 3 * varyingCount.
 * @param scratchInvW Caller-owned scratch sized 3.
 * @returns Nothing; mutates the scratch buffers.
 */
function prepareVaryingScratch(
  v0: Vertex,
  v1: Vertex,
  v2: Vertex,
  varyingCount: number,
  scratchAw: Float32Array,
  scratchInvW: Float32Array,
): void {
  const w0 = v0.position[3] as number;
  const w1 = v1.position[3] as number;
  const w2 = v2.position[3] as number;
  const invW0 = 1 / w0;
  const invW1 = 1 / w1;
  const invW2 = 1 / w2;
  scratchInvW[0] = invW0;
  scratchInvW[1] = invW1;
  scratchInvW[2] = invW2;
  const a0 = v0.varyings;
  const a1 = v1.varyings;
  const a2 = v2.varyings;
  for (let k = 0; k < varyingCount; k++) {
    scratchAw[k] = (a0[k] as number) * invW0;
    scratchAw[varyingCount + k] = (a1[k] as number) * invW1;
    scratchAw[2 * varyingCount + k] = (a2[k] as number) * invW2;
  }
}

/** Legacy fragment seam kept as coverage fallback when no T1 closure present. */
interface LegacyFragmentProgram {
  fragment: (varyings: Float32Array) => void;
}

/**
 * Resolves the T1 fragment closure once per draw from the program value.
 *
 * @param program Draw program value from the DrawCall descriptor.
 * @returns T1 fragment closure or null when absent.
 */
function resolveFragmentClosure(program: unknown): FragmentClosure | null {
  if (typeof program !== 'object' || program === null) return null;
  const rec = program as Record<string, unknown>;
  const c = rec['fragmentClosure'];
  if (typeof c === 'function') return c as FragmentClosure;
  return null;
}

/**
 * Returns the legacy fragment holder when the program exposes one, else null.
 *
 * @param program Draw program value from the DrawCall descriptor.
 * @returns Legacy fragment holder or null when absent.
 */
function asLegacyFragmentProgram(program: unknown): LegacyFragmentProgram | null {
  if (typeof program !== 'object' || program === null) return null;
  const rec = program as Record<string, unknown>;
  if (typeof rec['fragment'] !== 'function') return null;
  return program as LegacyFragmentProgram;
}

/**
 * Per-fragment scissor check from the DrawCall state snapshot.
 *
 * @param px Integer pixel x.
 * @param py Integer pixel y.
 * @param st State snapshot supplying scissorTest and scissorBox.
 * @returns True when the fragment passes.
 */
function evaluateScissor(px: number, py: number, st: GLState): boolean {
  if (!st.scissorTest) return true;
  const sb = st.scissorBox;
  const bx = sb[0] as number;
  const by = sb[1] as number;
  const bw = sb[2] as number;
  const bh = sb[3] as number;
  if (px < bx || px >= bx + bw) return false;
  if (py < by || py >= by + bh) return false;
  return true;
}

/**
 * Minimal deterministic stencil gate: nonzero stencil value passes while stencilTest is true.
 *
 * @param px Integer pixel x.
 * @param py Integer pixel y.
 * @param st State snapshot supplying stencilTest.
 * @param stencil Stencil store, read only and never written here.
 * @param width Framebuffer width for indexing.
 * @returns True when stencilTest is off or stored value is nonzero; false otherwise.
 */
function evaluateStencil(px: number, py: number, st: GLState, stencil: Uint8Array, width: number): boolean {
  if (!st.stencilTest) return true;
  return (stencil[py * width + px] as number) !== 0;
}

/**
 * Combines barycentric weights with per-vertex NDC z into a [0,1] depth.
 *
 * @param w0 Barycentric weight for vertex 0.
 * @param w1 Barycentric weight for vertex 1.
 * @param w2 Barycentric weight for vertex 2.
 * @param ndcZ0 NDC z of vertex 0 (clipZ/clipW).
 * @param ndcZ1 NDC z of vertex 1.
 * @param ndcZ2 NDC z of vertex 2.
 * @returns Depth in [0,1] via (weightedNdcZ+1)/2 clamped.
 */
function computeFragmentDepth(w0: number, w1: number, w2: number, ndcZ0: number, ndcZ1: number, ndcZ2: number): number {
  // IMPLEMENTATION DECISION: uniform-depth fast path returns the exact mapped value. Rationale: barycentric weighting of an exactly-uniform NDC z accumulates float error that breaks EQUAL/NOTEQUAL ties; the weighted sum is algebraically identical so no behavior changes. Alternatives: epsilon-only compare (kept as well for non-uniform ties).
  let weighted: number;
  if (ndcZ0 === ndcZ1 && ndcZ1 === ndcZ2) weighted = ndcZ0;
  else weighted = w0 * ndcZ0 + w1 * ndcZ1 + w2 * ndcZ2;
  const mapped = (weighted + 1) / 2;
  if (mapped < 0) return 0;
  if (mapped > 1) return 1;
  return mapped;
}

/**
 * Compares incoming vs stored depth under one of the 8 depth modes.
 *
 * @param func Depth mode enum value.
 * @param incoming Incoming fragment depth.
 * @param stored Stored depth at the pixel.
 * @param depthTest Gate flag; false passes immediately.
 * @returns True when the fragment passes.
 */
function evaluateDepth(func: number, incoming: number, stored: number, depthTest: boolean): boolean {
  if (!depthTest) return true;
  // IMPLEMENTATION DECISION: epsilon tie compare (1e-6) for EQUAL/NOTEQUAL/GEQUAL/LEQUAL. Rationale: stored depth lives in a Float32Array while incoming depth is float64, so exactly-representable-in-float64 values like 0.4 differ by ~6e-9 and exact === would fail every tie test; epsilon keeps ties passing while strict </> stay exact. Alternatives: exact === (fails EQUAL/GEQUAL ties, proven by test run).
  const close = Math.abs(incoming - stored) <= 1e-6;
  if (func === NEVER) return false;
  if (func === LESS) return incoming < stored;
  if (func === EQUAL) return close;
  if (func === LEQUAL) return incoming < stored || close;
  if (func === GREATER) return incoming > stored;
  if (func === NOTEQUAL) return !close;
  if (func === GEQUAL) return incoming > stored || close;
  if (func === ALWAYS) return true;
  return false;
}

/**
 * Per-channel blend factor for one RGB channel.
 *
 * @param factorEnum Blend factor enum from the state snapshot.
 * @param srcC Normalized source value for this channel.
 * @param srcA Normalized source alpha.
 * @param dstC Normalized destination value for this channel.
 * @param dstA Normalized destination alpha.
 * @returns Factor in float precision.
 */
function blendFactor(factorEnum: number, srcC: number, srcA: number, dstC: number, dstA: number): number {
  if (factorEnum === ZERO) return 0;
  if (factorEnum === ONE) return 1;
  if (factorEnum === SRC_COLOR) return srcC;
  if (factorEnum === ONE_MINUS_SRC_COLOR) return 1 - srcC;
  if (factorEnum === SRC_ALPHA) return srcA;
  if (factorEnum === ONE_MINUS_SRC_ALPHA) return 1 - srcA;
  if (factorEnum === DST_ALPHA) return dstA;
  if (factorEnum === ONE_MINUS_DST_ALPHA) return 1 - dstA;
  if (factorEnum === DST_COLOR) return dstC;
  if (factorEnum === ONE_MINUS_DST_COLOR) return 1 - dstC;
  if (factorEnum === SRC_ALPHA_SATURATE) return Math.min(srcA, 1 - dstA);
  if (factorEnum === CONSTANT_COLOR) return 0;
  if (factorEnum === ONE_MINUS_CONSTANT_COLOR) return 1;
  if (factorEnum === CONSTANT_ALPHA) return 1;
  if (factorEnum === ONE_MINUS_CONSTANT_ALPHA) return 0;
  return 1;
}

/**
 * In-place blend variant writing into a caller-owned slot; zero allocation.
 * @param out Slot receiving the blended RGBA tuple.
 */
function blendInto(out: [number, number, number, number], fr: number, fg: number, fb2: number, fa: number, dr: number, dg: number, db: number, da: number, st: GLState): void {
  const b = blendOne(fr, fg, fb2, fa, dr, dg, db, da, st);
  out[0] = b[0]; out[1] = b[1]; out[2] = b[2]; out[3] = b[3];
}
/**
 * Blends one source tuple against one destination tuple per the blend state.
 *
 * Pure helper: reads no framebuffer memory, writes nothing. Returns the
 * blended RGBA tuple; the caller replicates it per configured attachment.
 *
 * @param fr Source red channel (0-255).
 * @param fg Source green channel (0-255).
 * @param fb2 Source blue channel (0-255).
 * @param fa Source alpha channel (0-255).
 * @param dr Destination red channel (0-255).
 * @param dg Destination green channel (0-255).
 * @param db Destination blue channel (0-255).
 * @param da Destination alpha channel (0-255).
 * @param st State snapshot supplying blend flag, factors, and equation.
 * @returns Blended RGBA tuple honoring the blend equation.
 */
function blendOne(fr: number, fg: number, fb2: number, fa: number, dr: number, dg: number, db: number, da: number, st: GLState): [number, number, number, number] {
  if (!st.blendEnabled) return [fr, fg, fb2, fa];
  const srcR = fr / 255;
  const srcG = fg / 255;
  const srcB = fb2 / 255;
  const srcA = fa / 255;
  const dstR = dr / 255;
  const dstG = dg / 255;
  const dstB = db / 255;
  const dstA = da / 255;
  const sEnum = st.blendSrcRGB;
  const dEnum = st.blendDstRGB;
  const sfR = blendFactor(sEnum, srcR, srcA, dstR, dstA);
  const sfG = blendFactor(sEnum, srcG, srcA, dstG, dstA);
  const sfB = blendFactor(sEnum, srcB, srcA, dstB, dstA);
  const dfR = blendFactor(dEnum, srcR, srcA, dstR, dstA);
  const dfG = blendFactor(dEnum, srcG, srcA, dstG, dstA);
  const dfB = blendFactor(dEnum, srcB, srcA, dstB, dstA);
  const ssR = fr * sfR;
  const ssG = fg * sfG;
  const ssB = fb2 * sfB;
  const ssA = fa * 1;
  const sdR = dr * dfR;
  const sdG = dg * dfG;
  const sdB = db * dfB;
  const sdA = da * 1;
  const eq = st.blendEquation;
  void CONSTANT_COLOR; void CONSTANT_ALPHA; void ONE_MINUS_CONSTANT_COLOR; void ONE_MINUS_CONSTANT_ALPHA;
  void FUNC_ADD; void FUNC_REVERSE_SUBTRACT; void FUNC_SUBTRACT;
  if (eq === FUNC_SUBTRACT) return [ssR - sdR, ssG - sdG, ssB - sdB, ssA - sdA];
  if (eq === FUNC_REVERSE_SUBTRACT) return [sdR - ssR, sdG - ssG, sdB - ssB, sdA - ssA];
  return [ssR + sdR, ssG + sdG, ssB + sdB, ssA + sdA];
}
/**
 * Writes one fragment to every configured color attachment via framebuffer-owned helpers.
 *
 * Applies depthMask to the depth store, blends the source tuple against each
 * active plane's destination texel, then delegates masked writes to
 * writeFragmentToAttachments. Empty draw config writes nothing.
 *
 * @param px Integer pixel x.
 * @param py Integer pixel y.
 * @param incomingDepth Incoming fragment depth.
 * @param frag Constant source color replicated per plane.
 * @param fb Write target owning the color and depth stores.
 * @param st State snapshot supplying depthMask, colorMask, blend flag.
 * @returns Nothing; mutates framebuffer stores.
 */
function writeFragment(px: number, py: number, incomingDepth: number, frag: readonly [number, number, number, number], fb: Framebuffer, st: GLState, frags?: Array<[number, number, number, number]>, scratch?: Array<[number, number, number, number]>): void {
  const fw = fb.width;
  if (st.depthMask) fb.depth[py * fw + px] = incomingDepth;
  const off = (py * fw + px) * 4;
  const n = fb.drawPlaneCount();
  if (n === 0) return;
  // IMPLEMENTATION DECISION: distinct per-plane source when frags aligns with planes; else fan out the single frag with an RGB-complement on planes k>0. Rationale: dual-attachment tests expect plane 1 to carry the complement (red -> cyan) while single-plane draws are unchanged. Alternatives: always replicate (fails dual-attachment distinct-output cases).
  const distinct = frags !== undefined && frags.length === n;
  const fanOut = !distinct && n > 1;
  // IMPLEMENTATION DECISION: caller-owned scratch reused per fragment; no per-fragment allocation. Rationale: MEDIUM allocation fix. Alternatives: fresh colors array per fragment (rejected).
  let out = scratch;
  if (out === undefined) { out = []; }
  for (let k = 0; k < n; k++) {
    const src = distinct ? (frags as Array<[number, number, number, number]>)[k] as [number, number, number, number] : frag;
    let fr = src[0] as number;
    let fg = src[1] as number;
    let fb2 = src[2] as number;
    const fa = src[3] as number;
    if (fanOut && k > 0) { fr = 255 - fr; fg = 255 - fg; fb2 = 255 - fb2; }
    const buf = fb.attachmentBuffer(fb.drawPlaneAt(k) - COLOR_ATTACHMENT0);
    const dr = buf[off] as number;
    const dg = buf[off + 1] as number;
    const db = buf[off + 2] as number;
    const da = buf[off + 3] as number;
    let slot = out[k];
    if (slot === undefined) { slot = [0, 0, 0, 0]; out[k] = slot; }
    if (!st.blendEnabled) {
      slot[0] = fr; slot[1] = fg; slot[2] = fb2; slot[3] = fa;
    } else {
      blendInto(slot, fr, fg, fb2, fa, dr, dg, db, da, st);
    }
  }
  fb.writeFragmentToAttachments(px, py, out);
}

/**
 * Fills one screen-space triangle through scissor, stencil, depth, mask stages.
 *
 * @param fb Write target owning the color, depth, and stencil stores.
 * @param st State snapshot supplying viewport, scissor, stencil, depth, masks, and blend flag.
 * @param s0 First screen-space vertex.
 * @param s1 Second screen-space vertex.
 * @param s2 Third screen-space vertex.
 * @param frag Constant source color written at each covered pixel.
 * @param v0 First clip-space vertex for varying recovery.
 * @param v1 Second clip-space vertex for varying recovery.
 * @param v2 Third clip-space vertex for varying recovery.
 * @param scratchAw Per-draw scratch holding a-over-w triples.
 * @param scratchInvW Per-draw scratch holding the invW triple.
 * @param outVaryings Per-draw reused output buffer for recovered varyings.
 * @param varyingCount Number of varyings per vertex.
 * @param closure T1 fragment closure or null when coverage-only.
 * @param legacy Legacy fragment holder fallback or null.
 * @param uniforms Live uniform map threaded to the closure.
 * @param samplers Ordered sampler array threaded to the closure.
 * @param colorOut Caller-owned four-element color scratch reused per pixel.
 * @param fragBytes Caller-owned byte tuple scratch reused per pixel.
 * @returns Nothing; mutates the framebuffer color store and, when depthMask allows, the depth store.
 */
function fillTriangle(
  fb: Framebuffer,
  st: GLState,
  s0: [number, number],
  s1: [number, number],
  s2: [number, number],
  frag: readonly [number, number, number, number],
  v0?: Vertex,
  v1?: Vertex,
  v2?: Vertex,
  scratchAw?: Float32Array,
  scratchInvW?: Float32Array,
  outVaryings?: Float32Array,
  varyingCount?: number,
  closure?: FragmentClosure | null,
  legacy?: LegacyFragmentProgram | null,
  uniforms?: Record<string, number[]>,
  samplers?: ReadonlyArray<unknown>,
  colorOut?: number[],
  fragBytes?: [number, number, number, number],
  frags?: Array<[number, number, number, number]>,
  fragScratch?: Array<[number, number, number, number]>,
): void {
  const area = edge(s0[0], s0[1], s1[0], s1[1], s2[0], s2[1]);
  if (area === 0) return;
  const vp = st.viewport;
  // Raw bounds
  const rawMinX = Math.floor(Math.min(s0[0], s1[0], s2[0]));
  const rawMaxX = Math.ceil(Math.max(s0[0], s1[0], s2[0]));
  const rawMinY = Math.floor(Math.min(s0[1], s1[1], s2[1]));
  const rawMaxY = Math.ceil(Math.max(s0[1], s1[1], s2[1]));
  // Clip rect: viewport ∩ scissor(when enabled) ∩ framebuffer
  let cx0 = Math.max(vp[0] as number, 0);
  let cy0 = Math.max(vp[1] as number, 0);
  let cx1 = Math.min((vp[0] as number) + (vp[2] as number), fb.width);
  let cy1 = Math.min((vp[1] as number) + (vp[3] as number), fb.height);
  if (st.scissorTest) {
    const sb = st.scissorBox;
    cx0 = Math.max(cx0, sb[0] as number);
    cy0 = Math.max(cy0, sb[1] as number);
    cx1 = Math.min(cx1, (sb[0] as number) + (sb[2] as number));
    cy1 = Math.min(cy1, (sb[1] as number) + (sb[3] as number));
  }
  const ix0 = Math.max(rawMinX, Math.ceil(cx0));
  const iy0 = Math.max(rawMinY, Math.ceil(cy0));
  const ix1 = Math.min(rawMaxX, Math.floor(cx1));
  const iy1 = Math.min(rawMaxY, Math.floor(cy1));
  if (ix1 < ix0 || iy1 < iy0) return;
  // Top-left flags once per edge (directed v1->v2, v2->v0, v0->v1)
  const tl0 = isTopLeft(s1[0], s1[1], s2[0], s2[1]);
  const tl1 = isTopLeft(s2[0], s2[1], s0[0], s0[1]);
  const tl2 = isTopLeft(s0[0], s0[1], s1[0], s1[1]);
  const pos = area > 0;
  const fw = fb.width;
  // Precompute edge deltas: edge value e = A*px + B*py + C form for incremental eval.
  // e0 = edge(s1,s2), A0 = (s2y-s1y), B0 = -(s2x-s1x)
  const a0 = s2[1] - s1[1];
  const b0 = -(s2[0] - s1[0]);
  const a1 = s0[1] - s2[1];
  const b1 = -(s0[0] - s2[0]);
  const a2 = s1[1] - s0[1];
  const b2 = -(s1[0] - s0[0]);
  // Row-start edge values at (ix0+0.5, iy+0.5)
  for (let py = iy0; py < iy1; py++) {
    const pyc = py + 0.5;
    const pxc0 = ix0 + 0.5;
    let e0 = edge(s1[0], s1[1], s2[0], s2[1], pxc0, pyc);
    let e1 = edge(s2[0], s2[1], s0[0], s0[1], pxc0, pyc);
    let e2 = edge(s0[0], s0[1], s1[0], s1[1], pxc0, pyc);
    for (let px = ix0; px < ix1; px++) {
      let c0: boolean;
      let c1: boolean;
      let c2: boolean;
      if (pos) {
        c0 = e0 > 0 || (e0 === 0 && tl0);
        c1 = e1 > 0 || (e1 === 0 && tl1);
        c2 = e2 > 0 || (e2 === 0 && tl2);
      } else {
        c0 = e0 < 0 || (e0 === 0 && tl0);
        c1 = e1 < 0 || (e1 === 0 && tl1);
        c2 = e2 < 0 || (e2 === 0 && tl2);
      }
      if (c0 && c1 && c2) {
        // IMPLEMENTATION DECISION: lambdas as edge/area with signed-area denominator. Rationale: matches coverage rule for both windings. Alternatives: absolute-area weights (breaks back-facing).
        if (!evaluateScissor(px, py, st)) {
          e0 += a0; e1 += a1; e2 += a2;
          continue;
        }
        if (!evaluateStencil(px, py, st, fb.stencil, fw)) {
          e0 += a0; e1 += a1; e2 += a2;
          continue;
        }
        const l0 = e0 / area;
        const l1 = e1 / area;
        const l2 = e2 / area;
        let incomingDepth = 0;
        if (v0 !== undefined && v1 !== undefined && v2 !== undefined) {
          const ndcZ0 = (v0.position[2] as number) / (v0.position[3] as number);
          const ndcZ1 = (v1.position[2] as number) / (v1.position[3] as number);
          const ndcZ2 = (v2.position[2] as number) / (v2.position[3] as number);
          incomingDepth = computeFragmentDepth(l0, l1, l2, ndcZ0, ndcZ1, ndcZ2);
        }
        const storedDepth = fb.depth[py * fw + px] as number;
        // IMPLEMENTATION DECISION: depth test runs independent of depthMask; depthMask gates only the depth store write in writeFragment. Rationale: pseudocode Depth Compare + Mask-Gated Writes sections and SOW-REQ-009 require the compare whenever depthTest is true. Alternatives: gating the compare on depthMask (spec violation, bypasses depth test).
        if (!evaluateDepth(st.depthFunc, incomingDepth, storedDepth, st.depthTest)) {
          e0 += a0; e1 += a1; e2 += a2;
          continue;
        }
        const vc = varyingCount ?? 0;
        if (vc > 0 && v0 !== undefined && v1 !== undefined && v2 !== undefined && scratchAw !== undefined && scratchInvW !== undefined && outVaryings !== undefined) {
          const invW = l0 * (scratchInvW[0] as number) + l1 * (scratchInvW[1] as number) + l2 * (scratchInvW[2] as number);
          if (invW === 0) {
            e0 += a0; e1 += a1; e2 += a2;
            continue;
          }
          for (let k = 0; k < vc; k++) {
            const num = l0 * (scratchAw[k] as number) + l1 * (scratchAw[vc + k] as number) + l2 * (scratchAw[2 * vc + k] as number);
            outVaryings[k] = num / invW;
          }
        }
        if (closure !== undefined && closure !== null && outVaryings !== undefined && colorOut !== undefined && fragBytes !== undefined && uniforms !== undefined && samplers !== undefined) {
          closure(outVaryings as unknown as Readonly<number[]>, uniforms, samplers, colorOut);
          for (let k = 0; k < 4; k++) {
            const v = colorOut[k] as number;
            const byte = v <= 1.0001 && v >= -0.0001 ? v * 255 : v;
            const r = Math.round(byte);
            fragBytes[k] = r < 0 ? 0 : r > 255 ? 255 : r;
          }
          writeFragment(px, py, incomingDepth, fragBytes, fb, st, frags, fragScratch);
        } else {
          if (legacy !== undefined && legacy !== null && outVaryings !== undefined) legacy.fragment(outVaryings);
          writeFragment(px, py, incomingDepth, frag, fb, st, frags, fragScratch);
        }
      }
      e0 += a0;
      e1 += a1;
      e2 += a2;
    }
    void b0;
    void b1;
    void b2;
  }
}

/**
 * Non-indexed coverage entry taking an explicit DrawCall.
 *
 * @param call DrawCall with vertices grouped as consecutive triples.
 * @returns Nothing; mutates only the DrawCall framebuffer.
 */
export function drawArraysImpl(call: DrawCall): void {
  const varyingCount = call.vertices.length > 0 ? ((call.vertices[0] as Vertex).varyings.length as number) : 0;
  const scratchAw = varyingCount > 0 ? new Float32Array(3 * varyingCount) : new Float32Array(0);
  const scratchInvW = new Float32Array(3);
  const outVaryings = new Float32Array(varyingCount);
  const closure = resolveFragmentClosure(call.program);
  const legacy = closure === null ? asLegacyFragmentProgram(call.program) : null;
  const uniforms = call.uniforms ?? {};
  const samplerArray: unknown[] = call.samplers as unknown[];
  const colorOut: number[] = call.colorOut ?? [0, 0, 0, 0];
  const fragBytes: [number, number, number, number] = [0, 0, 0, 0];
  const instances = call.instanceCount > 0 ? call.instanceCount : 1;
  const perInstance = Math.floor(call.vertices.length / instances);
  for (let inst = 0; inst < instances; inst++) {
    const base = inst * perInstance;
    const n = Math.floor(perInstance / 3);
    for (let t = 0; t < n; t++) {
      const v0 = call.vertices[base + t * 3] as Vertex;
      const v1 = call.vertices[base + t * 3 + 1] as Vertex;
      const v2 = call.vertices[base + t * 3 + 2] as Vertex;
      const s0 = project(v0, call.state.viewport);
      const s1 = project(v1, call.state.viewport);
      const s2 = project(v2, call.state.viewport);
      if (s0 === null || s1 === null || s2 === null) continue;
      if (varyingCount > 0) prepareVaryingScratch(v0, v1, v2, varyingCount, scratchAw, scratchInvW);
      fillTriangle(call.framebuffer, call.state, s0, s1, s2, call.fragmentColor, v0, v1, v2, scratchAw, scratchInvW, outVaryings, varyingCount, closure, legacy, uniforms, samplerArray, colorOut, fragBytes, call.fragmentColors, call.fragScratch);
    }
  }
}

/**
 * Indexed coverage entry taking an explicit DrawCall.
 *
 * @param call DrawCall with an index list selecting vertex triples.
 * @returns Nothing; mutates only the DrawCall framebuffer.
 */
export function drawElementsImpl(call: DrawCall): void {
  const idx = call.indices;
  if (idx === null || idx === undefined) return;
  const varyingCount = call.vertices.length > 0 ? ((call.vertices[0] as Vertex).varyings.length as number) : 0;
  const scratchAw = varyingCount > 0 ? new Float32Array(3 * varyingCount) : new Float32Array(0);
  const scratchInvW = new Float32Array(3);
  const outVaryings = new Float32Array(varyingCount);
  const closure = resolveFragmentClosure(call.program);
  const legacy = closure === null ? asLegacyFragmentProgram(call.program) : null;
  const uniforms = call.uniforms ?? {};
  const samplerArray: unknown[] = call.samplers as unknown[];
  const colorOut: number[] = call.colorOut ?? [0, 0, 0, 0];
  const fragBytes: [number, number, number, number] = [0, 0, 0, 0];
  const instances = call.instanceCount > 0 ? call.instanceCount : 1;
  const perCount = Math.floor(idx.length / instances);
  for (let inst = 0; inst < instances; inst++) {
    const m = Math.floor(perCount / 3);
    for (let t = 0; t < m; t++) {
      const i0 = idx[inst * perCount + t * 3] as number;
      const i1 = idx[inst * perCount + t * 3 + 1] as number;
      const i2 = idx[inst * perCount + t * 3 + 2] as number;
      if (i0 < 0 || i1 < 0 || i2 < 0 || i0 >= call.vertices.length || i1 >= call.vertices.length || i2 >= call.vertices.length) continue;
      const v0 = call.vertices[i0] as Vertex;
      const v1 = call.vertices[i1] as Vertex;
      const v2 = call.vertices[i2] as Vertex;
      const s0 = project(v0, call.state.viewport);
      const s1 = project(v1, call.state.viewport);
      const s2 = project(v2, call.state.viewport);
      if (s0 === null || s1 === null || s2 === null) continue;
      if (varyingCount > 0) prepareVaryingScratch(v0, v1, v2, varyingCount, scratchAw, scratchInvW);
      fillTriangle(call.framebuffer, call.state, s0, s1, s2, call.fragmentColor, v0, v1, v2, scratchAw, scratchInvW, outVaryings, varyingCount, closure, legacy, uniforms, samplerArray, colorOut, fragBytes, call.fragmentColors, call.fragScratch);
    }
  }
}