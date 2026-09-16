/**
 * @fileoverview Stateless triangle coverage core with top-left fill rule.
 *
 * Coverage only: clip-space divide, NDC-to-viewport mapping, clamped
 * bounding-box iteration, barycentric edge functions, degenerate skip,
 * plus drawArraysImpl / drawElementsImpl entry points.
 */
import type { Framebuffer } from './framebuffer';
import type { GLState } from './state';

/** One post-transform vertex consumed by coverage math. */
export interface Vertex {
  position: [number, number, number, number];
  varyings: Float32Array;
}

/** Sampler slot placeholder, no sampling behavior. */
export interface TextureBinding {
  unit: number;
  handle: number;
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
  fragmentColor: [number, number, number, number];
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
 * Fills one screen-space triangle with a constant fragment color.
 *
 * @param fb Write target owning the color store.
 * @param st State snapshot supplying viewport, scissor, and blend flag.
 * @param s0 First screen-space vertex.
 * @param s1 Second screen-space vertex.
 * @param s2 Third screen-space vertex.
 * @param frag Constant source color written at each covered pixel.
 * @returns Nothing; mutates only the framebuffer color store.
 */
function fillTriangle(
  fb: Framebuffer,
  st: GLState,
  s0: [number, number],
  s1: [number, number],
  s2: [number, number],
  frag: readonly [number, number, number, number],
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
  const color = fb.color;
  const fw = fb.width;
  const fr = frag[0] as number;
  const fg = frag[1] as number;
  const fb2 = frag[2] as number;
  const fa = frag[3] as number;
  const blend = st.blendEnabled;
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
        const off = (py * fw + px) * 4;
        if (!blend) {
          color[off] = fr;
          color[off + 1] = fg;
          color[off + 2] = fb2;
          color[off + 3] = fa;
        } else {
          color[off] = Math.min(255, (color[off] as number) + fr);
          color[off + 1] = Math.min(255, (color[off + 1] as number) + fg);
          color[off + 2] = Math.min(255, (color[off + 2] as number) + fb2);
          color[off + 3] = Math.min(255, (color[off + 3] as number) + fa);
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
  const n = Math.floor(call.vertices.length / 3);
  for (let t = 0; t < n; t++) {
    const v0 = call.vertices[t * 3] as Vertex;
    const v1 = call.vertices[t * 3 + 1] as Vertex;
    const v2 = call.vertices[t * 3 + 2] as Vertex;
    const s0 = project(v0, call.state.viewport);
    const s1 = project(v1, call.state.viewport);
    const s2 = project(v2, call.state.viewport);
    if (s0 === null || s1 === null || s2 === null) continue;
    fillTriangle(call.framebuffer, call.state, s0, s1, s2, call.fragmentColor);
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
  const m = Math.floor(idx.length / 3);
  for (let t = 0; t < m; t++) {
    const i0 = idx[t * 3] as number;
    const i1 = idx[t * 3 + 1] as number;
    const i2 = idx[t * 3 + 2] as number;
    if (i0 < 0 || i1 < 0 || i2 < 0 || i0 >= call.vertices.length || i1 >= call.vertices.length || i2 >= call.vertices.length) continue;
    const v0 = call.vertices[i0] as Vertex;
    const v1 = call.vertices[i1] as Vertex;
    const v2 = call.vertices[i2] as Vertex;
    const s0 = project(v0, call.state.viewport);
    const s1 = project(v1, call.state.viewport);
    const s2 = project(v2, call.state.viewport);
    if (s0 === null || s1 === null || s2 === null) continue;
    fillTriangle(call.framebuffer, call.state, s0, s1, s2, call.fragmentColor);
  }
}
