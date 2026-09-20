// CHANGELOG: Sprint 2 (2026-09-20): Sprint 2 T1 perspective-correct barycentric and depth interpolation
/** Perspective-correct barycentric interpolation (L4 raster, ADR-012 float32). */

export function perspectiveCorrect(
  bary: [number, number, number],
  invW: [number, number, number],
  sources: Float32Array[],
  out: Float32Array,
  flatMask?: number,
  provokingIndex?: number,
): void {
  const b0f = Math.fround(bary[0]);
  const b1f = Math.fround(bary[1]);
  const b2f = Math.fround(bary[2]);
  const w0f = Math.fround(invW[0]);
  const w1f = Math.fround(invW[1]);
  const w2f = Math.fround(invW[2]);

  const term0 = Math.fround(b0f * w0f);
  const term1 = Math.fround(b1f * w1f);
  const term2 = Math.fround(b2f * w2f);
  const sum01 = Math.fround(term0 + term1);
  const denom = Math.fround(sum01 + term2);

  let recipDenom = 0;
  if (!(denom === 0 || Number.isNaN(denom))) {
    recipDenom = Math.fround(1 / denom);
  }

  const weight0 = Math.fround(term0 * recipDenom);
  const weight1 = Math.fround(term1 * recipDenom);
  const weight2 = Math.fround(term2 * recipDenom);

  const vCount = out.length;
  let provIdx = 0;
  if (provokingIndex !== undefined && provokingIndex >= 0 && provokingIndex <= 2) {
    provIdx = Math.trunc(provokingIndex);
  }
  const provSource = sources[provIdx] as Float32Array;
  const src0 = sources[0] as Float32Array;
  const src1 = sources[1] as Float32Array;
  const src2 = sources[2] as Float32Array;
  let mask = 0;
  if (flatMask !== undefined) {
    mask = flatMask;
  }

  for (let i = 0; i < vCount; i++) {
    const isFlat = ((mask >>> i) & 1) !== 0;
    if (isFlat) {
      out[i] = Math.fround(provSource[i] as number);
    } else {
      const val0 = Math.fround(src0[i] as number);
      const val1 = Math.fround(src1[i] as number);
      const val2 = Math.fround(src2[i] as number);
      const wVal0 = Math.fround(val0 * weight0);
      const wVal1 = Math.fround(val1 * weight1);
      const wVal2 = Math.fround(val2 * weight2);
      const partialSum = Math.fround(wVal0 + wVal1);
      const finalVal = Math.fround(partialSum + wVal2);
      out[i] = finalVal;
    }
  }
}

export function interpolateDepth(bary: [number, number, number], z: [number, number, number]): number {
  const b0f = Math.fround(bary[0]);
  const b1f = Math.fround(bary[1]);
  const b2f = Math.fround(bary[2]);
  const z0f = Math.fround(z[0]);
  const z1f = Math.fround(z[1]);
  const z2f = Math.fround(z[2]);

  const prod0 = Math.fround(b0f * z0f);
  const prod1 = Math.fround(b1f * z1f);
  const prod2 = Math.fround(b2f * z2f);

  const sum01 = Math.fround(prod0 + prod1);
  const depthResult = Math.fround(sum01 + prod2);
  return depthResult;
}
