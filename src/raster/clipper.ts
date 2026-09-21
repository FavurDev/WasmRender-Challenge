// CHANGELOG: Sprint 2 (2026-09-20): Sprint 2 T2 Sutherland-Hodgman frustum clipper with clip-space varying interpolation
/** Sutherland-Hodgman frustum clipper (L4 raster, ADR-012 float32). */

export interface ClipVertex {
  clip: [number, number, number, number];
  pointSize: number;
  varyings: Float32Array;
}

export const CLIP_EPSILON: number = Math.fround(1e-6);

function copyVertex(v: ClipVertex): ClipVertex {
  const varyings = new Float32Array(v.varyings.length);
  varyings.set(v.varyings);
  return {
    clip: [v.clip[0] as number, v.clip[1] as number, v.clip[2] as number, v.clip[3] as number],
    pointSize: v.pointSize,
    varyings,
  };
}

function evaluatePlane(planeId: number, v: ClipVertex): number {
  const x = Math.fround(v.clip[0] as number);
  const y = Math.fround(v.clip[1] as number);
  const z = Math.fround(v.clip[2] as number);
  const w = Math.fround(v.clip[3] as number);
  switch (planeId) {
    case 0:
      return Math.fround(w - CLIP_EPSILON);
    case 1:
      return Math.fround(w - x);
    case 2:
      return Math.fround(w + x);
    case 3:
      return Math.fround(w - y);
    case 4:
      return Math.fround(w + y);
    case 5:
      return Math.fround(w - z);
    case 6:
      return Math.fround(w + z);
    default:
      return 0.0;
  }
}

function interpolateClipVertex(vA: ClipVertex, vB: ClipVertex, t: number): ClipVertex {
  const tf = Math.fround(t);
  const newClip: [number, number, number, number] = [0, 0, 0, 1];
  for (let i = 0; i < 4; i++) {
    const aCoord = Math.fround(vA.clip[i] as number);
    const bCoord = Math.fround(vB.clip[i] as number);
    const diff = Math.fround(bCoord - aCoord);
    const prod = Math.fround(diff * tf);
    newClip[i] = Math.fround(aCoord + prod);
  }
  const aSize = Math.fround(vA.pointSize);
  const bSize = Math.fround(vB.pointSize);
  const diffSize = Math.fround(bSize - aSize);
  const newPointSize = Math.fround(aSize + Math.fround(diffSize * tf));
  const vLen = Math.min(vA.varyings.length, vB.varyings.length);
  const newVaryings = new Float32Array(vLen);
  for (let k = 0; k < vLen; k++) {
    const aV = Math.fround(vA.varyings[k] as number);
    const bV = Math.fround(vB.varyings[k] as number);
    const diffV = Math.fround(bV - aV);
    const prodV = Math.fround(diffV * tf);
    newVaryings[k] = Math.fround(aV + prodV);
  }
  return { clip: newClip, pointSize: newPointSize, varyings: newVaryings };
}

export function computeCrossingT(prevDist: number, currDist: number): number {
  let t = Math.fround(prevDist / Math.fround(prevDist - currDist));
  if (!(t >= 0 && t <= 1) || Number.isNaN(t)) {
    t = t < 0 ? 0 : 1;
    if (Number.isNaN(t)) t = 0;
  }
  return Math.min(1, Math.max(0, t));
}

function isValidVertex(v: ClipVertex | null | undefined): boolean {
  if (v === null || v === undefined) return false;
  if (!Array.isArray(v.clip) || v.clip.length < 4) return false;
  for (let i = 0; i < 4; i++) {
    const c = v.clip[i] as number;
    if (typeof c !== 'number' || Number.isNaN(c) || !Number.isFinite(c)) return false;
  }
  if (typeof v.pointSize !== 'number' || Number.isNaN(v.pointSize) || !Number.isFinite(v.pointSize)) return false;
  if (!(v.varyings instanceof Float32Array)) return false;
  for (let k = 0; k < v.varyings.length; k++) {
    const c = v.varyings[k] as number;
    if (Number.isNaN(c) || !Number.isFinite(c)) return false;
  }
  return true;
}

export function clipTriangle(v0: ClipVertex, v1: ClipVertex, v2: ClipVertex): ClipVertex[] {
  if (!isValidVertex(v0) || !isValidVertex(v1) || !isValidVertex(v2)) return [];
  const a = v0 as ClipVertex;
  const b = v1 as ClipVertex;
  const c = v2 as ClipVertex;
  if (
    a.clip[0] === b.clip[0] && a.clip[1] === b.clip[1] && a.clip[2] === b.clip[2] && a.clip[3] === b.clip[3] &&
    b.clip[0] === c.clip[0] && b.clip[1] === c.clip[1] && b.clip[2] === c.clip[2] && b.clip[3] === c.clip[3]
  ) {
    return [];
  }
  const e1x = Math.fround((b.clip[0] as number) - (a.clip[0] as number));
  const e1y = Math.fround((b.clip[1] as number) - (a.clip[1] as number));
  const e1z = Math.fround((b.clip[2] as number) - (a.clip[2] as number));
  const e2x = Math.fround((c.clip[0] as number) - (a.clip[0] as number));
  const e2y = Math.fround((c.clip[1] as number) - (a.clip[1] as number));
  const e2z = Math.fround((c.clip[2] as number) - (a.clip[2] as number));
  const crossX = Math.fround(Math.fround(e1y * e2z) - Math.fround(e1z * e2y));
  const crossY = Math.fround(Math.fround(e1z * e2x) - Math.fround(e1x * e2z));
  const crossZ = Math.fround(Math.fround(e1x * e2y) - Math.fround(e1y * e2x));
  if (crossX === 0 && crossY === 0 && crossZ === 0) return [];
  const sqLen = Math.fround(Math.fround(Math.fround(crossX * crossX) + Math.fround(crossY * crossY)) + Math.fround(crossZ * crossZ));
  if (sqLen === 0) return [];

  let polygon: ClipVertex[] = [copyVertex(a), copyVertex(b), copyVertex(c)];

  for (let plane = 0; plane < 7; plane++) {
    if (polygon.length === 0) return [];
    const inputList = polygon;
    const outputList: ClipVertex[] = [];
    const count = inputList.length;
    let prevVertex = inputList[count - 1] as ClipVertex;
    let prevDist = evaluatePlane(plane, prevVertex);
    for (let currIndex = 0; currIndex < count; currIndex++) {
      const currVertex = inputList[currIndex] as ClipVertex;
      const currDist = evaluatePlane(plane, currVertex);
      if (currDist >= 0) {
        if (prevDist >= 0) {
          outputList.push(currVertex);
        } else {
          const t = computeCrossingT(prevDist, currDist);
          outputList.push(interpolateClipVertex(prevVertex, currVertex, t));
          outputList.push(currVertex);
        }
      } else {
        if (prevDist >= 0) {
          const t = computeCrossingT(prevDist, currDist);
          outputList.push(interpolateClipVertex(prevVertex, currVertex, t));
        }
      }
      prevVertex = currVertex;
      prevDist = currDist;
    }
    polygon = outputList;
  }

  if (polygon.length < 3) return [];
  if (polygon.length > 9) polygon = polygon.slice(0, 9);
  return polygon;
}
