// CHANGELOG: Sprint 6 (2026-09-21): New pure 2D sampler core with generateMipmap box-filter chain, NPOT completeness, NEAREST/LINEAR and wrap modes (Task 2)
// CHANGELOG: Sprint 8 Task 5 (2026-09-22): 3D/array volume sampling — sample3D/sample2DArray with trilinear filtering and wrapR
/** Pure 2D/3D sampler core — read-only sampling, wrap math, mip filtering. L2: runtime imports constants + pure evaluator only. */
import {
  ALPHA,
  CLAMP_TO_EDGE,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST,
  LUMINANCE,
  LUMINANCE_ALPHA,
  MIRRORED_REPEAT,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
  REPEAT,
  RGB,
  RGBA,
  TEXTURE_2D_ARRAY,
  UNSIGNED_BYTE,
} from './constants';
import type { GLenum } from './constants';
import { evaluateTextureCompleteness } from './texture';
import type { MipLevel, TextureObject } from './texture';

/** Canonical completeness — re-exported single source from texture.ts (H4). Defaults to WebGL1 (H1). */
export { evaluateTextureCompleteness };
export { isTextureComplete } from './texture';

/** Pure wrap coordinate transformation. */
export function applyWrap(coord: number, wrapMode: GLenum): number {
  const u = Math.fround(coord);
  if (wrapMode === CLAMP_TO_EDGE) {
    if (u < 0) return Math.fround(0);
    if (u > 1) return Math.fround(1);
    return u;
  }
  if (wrapMode === REPEAT) {
    let rem = Math.fround(u - Math.fround(Math.floor(u)));
    if (rem < 0) rem = Math.fround(rem + 1);
    if (rem === 1) rem = Math.fround(0);
    return rem;
  }
  if (wrapMode === MIRRORED_REPEAT) {
    const t = Math.fround(Math.abs(u));
    const fl = Math.floor(t);
    const frac = Math.fround(t - Math.fround(fl));
    if (fl % 2 === 0) return frac;
    return Math.fround(1 - frac);
  }
  return u;
}

function bytesPerPixel(format: GLenum, type: GLenum): number {
  if (format === RGBA && type === UNSIGNED_BYTE) return 4;
  if (format === RGB && type === UNSIGNED_BYTE) return 3;
  if (format === LUMINANCE_ALPHA && type === UNSIGNED_BYTE) return 2;
  if ((format === ALPHA || format === LUMINANCE) && type === UNSIGNED_BYTE) return 1;
  return 4;
}

function unpackLevel(level: MipLevel, x: number, y: number): Float32Array {
  const clX = Math.max(0, Math.min(level.width - 1, Math.trunc(x)));
  const clY = Math.max(0, Math.min(level.height - 1, Math.trunc(y)));
  const bpp = bytesPerPixel(level.internalFormat, level.type);
  const idx = (clY * level.width + clX) * bpp;
  if (level.internalFormat === RGBA && level.type === UNSIGNED_BYTE) {
    return new Float32Array([
      Math.fround(level.data[idx]! / 255),
      Math.fround(level.data[idx + 1]! / 255),
      Math.fround(level.data[idx + 2]! / 255),
      Math.fround(level.data[idx + 3]! / 255),
    ]);
  }
  if (level.internalFormat === RGB && level.type === UNSIGNED_BYTE) {
    return new Float32Array([
      Math.fround(level.data[idx]! / 255),
      Math.fround(level.data[idx + 1]! / 255),
      Math.fround(level.data[idx + 2]! / 255),
      Math.fround(1),
    ]);
  }
  if (level.internalFormat === LUMINANCE_ALPHA && level.type === UNSIGNED_BYTE) {
    const l = Math.fround(level.data[idx]! / 255);
    const a = Math.fround(level.data[idx + 1]! / 255);
    return new Float32Array([l, l, l, a]);
  }
  if (level.internalFormat === LUMINANCE && level.type === UNSIGNED_BYTE) {
    const l = Math.fround(level.data[idx]! / 255);
    return new Float32Array([l, l, l, Math.fround(1)]);
  }
  if (level.internalFormat === ALPHA && level.type === UNSIGNED_BYTE) {
    const a = Math.fround(level.data[idx]! / 255);
    return new Float32Array([Math.fround(0), Math.fround(0), Math.fround(0), a]);
  }
  return new Float32Array([Math.fround(0), Math.fround(0), Math.fround(0), Math.fround(1)]);
}

/** Fetch texel — supports (level,x,y) and (texture,level,x,y) shapes (M3: dual overloads intentional). */
export function fetchTexel2D(level: MipLevel, x: number, y: number): Float32Array;
export function fetchTexel2D(texture: TextureObject, level: number, x: number, y: number): Float32Array;
export function fetchTexel2D(a: MipLevel | TextureObject, b: number, c: number, d?: number): Float32Array {
  if (d !== undefined) {
    const tex = a as TextureObject;
    const lvl = tex.levels2D.get(b);
    if (lvl === undefined) return new Float32Array([0, 0, 0, 1]);
    return unpackLevel(lvl, c, d);
  }
  return unpackLevel(a as MipLevel, b, c);
}

function sampleLevel(level: MipLevel, u: number, v: number, filter: GLenum): Float32Array {
  if (filter === NEAREST) {
    const i = Math.floor(u * level.width);
    const j = Math.floor(v * level.height);
    return unpackLevel(level, i, j);
  }
  if (filter === LINEAR) {
    const texX = u * level.width - 0.5;
    const texY = v * level.height - 0.5;
    const x0 = Math.floor(texX);
    const y0 = Math.floor(texY);
    const s = Math.fround(texX - x0);
    const t = Math.fround(texY - y0);
    const c00 = unpackLevel(level, x0, y0);
    const c10 = unpackLevel(level, x0 + 1, y0);
    const c01 = unpackLevel(level, x0, y0 + 1);
    const c11 = unpackLevel(level, x0 + 1, y0 + 1);
    const oneMinusS = Math.fround(1 - s);
    const oneMinusT = Math.fround(1 - t);
    const out = new Float32Array(4);
    for (let k = 0; k < 4; k++) {
      const top = Math.fround(c00[k]! * oneMinusS + c10[k]! * s);
      const bottom = Math.fround(c01[k]! * oneMinusS + c11[k]! * s);
      out[k] = Math.fround(top * oneMinusT + bottom * t);
    }
    return out;
  }
  return unpackLevel(level, 0, 0);
}

function computeMaxLod(w: number, h: number): number {
  let count = 1;
  let cw = w;
  let ch = h;
  while (cw > 1 || ch > 1) {
    cw = Math.max(1, Math.floor(cw / 2));
    ch = Math.max(1, Math.floor(ch / 2));
    count += 1;
  }
  return count - 1;
}

/** Sample single mip level — supports (level,u,v,filter) and (texture,lod,u,v,filter) shapes (M3). */
export function sampleMipLevel2D(level: MipLevel, u: number, v: number, filter: GLenum): Float32Array;
export function sampleMipLevel2D(texture: TextureObject, level: number, u: number, v: number, filter: GLenum): Float32Array;
export function sampleMipLevel2D(a: MipLevel | TextureObject, b: number, c: number, d: number, e?: GLenum): Float32Array {
  if (e !== undefined) {
    const tex = a as TextureObject;
    const lvl = tex.levels2D.get(b);
    if (lvl === undefined) return new Float32Array([0, 0, 0, 1]);
    return sampleLevel(lvl, c, d, e);
  }
  return sampleLevel(a as MipLevel, b, c, d as unknown as GLenum);
}

/** Resolve the effective sampler params for a draw: a live bound sampler supersedes the texture params. Returns a NEW object; never mutates texture.sampler. */
export function resolveEffectiveSamplerParams(
  texture: TextureObject,
  boundSampler: unknown,
): import('./texture').SamplerParams {
  if (boundSampler !== null && boundSampler !== undefined && typeof boundSampler === 'object') {
    const holder = boundSampler as { alive?: unknown; params?: import('./texture').SamplerParams };
    if (holder.params !== undefined && holder.params !== null) {
      if (holder.alive === true) return { ...(holder.params as import('./texture').SamplerParams) };
    } else {
      return { ...(boundSampler as import('./texture').SamplerParams) };
    }
  }
  return { ...texture.sampler };
}

function sample2DCore(texture: TextureObject, uRaw: number, vRaw: number, lodVal: number | null | undefined, contextVersion: 1 | 2, effectiveSampler?: import('./texture').SamplerParams): Float32Array {
  // Read-only: NEVER writes texture.completeness or levels maps (H2). Uses pure evaluator only.
  if (texture === null || texture === undefined || texture.alive !== true) return new Float32Array([0, 0, 0, 1]);
  if (!evaluateTextureCompleteness(texture, contextVersion)) return new Float32Array([0, 0, 0, 1]);
  const sp = effectiveSampler ?? texture.sampler;
  const u = applyWrap(uRaw, sp.wrapS);
  const v = applyWrap(vRaw, sp.wrapT);
  const explicitLod = lodVal === null || lodVal === undefined ? 0 : Math.max(0, lodVal);
  const minFilter = sp.minFilter;
  const magFilter = sp.magFilter;
  const baseLevel = texture.levels2D.get(0);
  if (baseLevel === undefined) return new Float32Array([0, 0, 0, 1]);
  if (explicitLod <= 0) return sampleLevel(baseLevel, u, v, magFilter);
  if (minFilter === NEAREST || minFilter === LINEAR) return sampleLevel(baseLevel, u, v, minFilter);
  const maxLod = computeMaxLod(baseLevel.width, baseLevel.height);
  const clampedLod = Math.min(explicitLod, maxLod);
  if (minFilter === NEAREST_MIPMAP_NEAREST) {
    const dd = Math.round(clampedLod);
    const lvl = texture.levels2D.get(dd) ?? baseLevel;
    return sampleLevel(lvl, u, v, NEAREST);
  }
  if (minFilter === LINEAR_MIPMAP_NEAREST) {
    const dd = Math.round(clampedLod);
    const lvl = texture.levels2D.get(dd) ?? baseLevel;
    return sampleLevel(lvl, u, v, LINEAR);
  }
  if (minFilter === NEAREST_MIPMAP_LINEAR || minFilter === LINEAR_MIPMAP_LINEAR) {
    const d0 = Math.floor(clampedLod);
    const d1 = Math.min(d0 + 1, maxLod);
    const frac = Math.fround(clampedLod - d0);
    const l0 = texture.levels2D.get(d0) ?? baseLevel;
    const l1 = texture.levels2D.get(d1) ?? l0;
    const inner = minFilter === NEAREST_MIPMAP_LINEAR ? NEAREST : LINEAR;
    const c0 = sampleLevel(l0, u, v, inner);
    const c1 = sampleLevel(l1, u, v, inner);
    const out = new Float32Array(4);
    for (let k = 0; k < 4; k++) out[k] = Math.fround(c0[k]! * (1 - frac) + c1[k]! * frac);
    return out;
  }
  return new Float32Array([0, 0, 0, 1]);
}

/** Pure 2D sampling entry — supports (texture,coords,lod,version) and (texture,u,v,lod,version) shapes (M3). */
export function sample2D(texture: TextureObject, coords: Float32Array | number[], lod?: number | null, contextVersion?: 1 | 2, effectiveSampler?: import('./texture').SamplerParams): Float32Array;
export function sample2D(texture: TextureObject, u: number, v: number, lod?: number | null, contextVersion?: 1 | 2, effectiveSampler?: import('./texture').SamplerParams): Float32Array;
export function sample2D(
  texture: TextureObject,
  coordsOrU: Float32Array | number[] | number,
  vOrLod?: number | number[] | Float32Array | null,
  lodArg?: number | null | (1 | 2),
  versionArg?: 1 | 2 | import('./texture').SamplerParams,
  effectiveArg?: import('./texture').SamplerParams,
): Float32Array {
  const defaultVersion: 1 | 2 = 1;
  if (typeof coordsOrU === 'number') {
    const uRaw = coordsOrU;
    const vRaw = typeof vOrLod === 'number' ? vOrLod : 0;
    let lodVal: number | null | undefined;
    let ver: 1 | 2 = defaultVersion;
    if (typeof lodArg === 'number' || lodArg === null || lodArg === undefined) {
      lodVal = lodArg as number | null | undefined;
      if (versionArg === 1 || versionArg === 2) ver = versionArg as 1 | 2;
      else if (typeof versionArg === 'object' && versionArg !== null && 'magFilter' in (versionArg as unknown as Record<string, unknown>)) {
        return sample2DCore(texture, uRaw, vRaw, lodVal, ver, versionArg as import('./texture').SamplerParams);
      }
    } else {
      lodVal = undefined;
    }
    return sample2DCore(texture, uRaw, vRaw, lodVal, ver, effectiveArg);
  }
  const arr = coordsOrU as ArrayLike<number>;
  const uRaw = arr[0] as number;
  const vRaw = arr[1] as number;
  let lodVal: number | null | undefined;
  let ver: 1 | 2 = defaultVersion;
  const isParams = (v: unknown): v is import('./texture').SamplerParams =>
    typeof v === 'object' && v !== null && 'magFilter' in (v as Record<string, unknown>);
  let effective = effectiveArg;
  if (isParams(versionArg)) effective = versionArg as import('./texture').SamplerParams;
  else if (isParams(lodArg)) effective = lodArg as unknown as import('./texture').SamplerParams;
  if (typeof vOrLod === 'number' || vOrLod === null || vOrLod === undefined) {
    lodVal = vOrLod as number | null | undefined;
    if (lodArg === 1 || lodArg === 2) ver = lodArg as 1 | 2;
    else if (versionArg === 1 || versionArg === 2) ver = versionArg as 1 | 2;
  } else {
    if (lodArg === 1 || lodArg === 2) ver = lodArg as 1 | 2;
    else if (versionArg === 1 || versionArg === 2) ver = versionArg as 1 | 2;
  }
  return sample2DCore(texture, uRaw, vRaw, lodVal, ver, effective);
}

/** Unpack a single volume texel at integer (x, y, z), clamped. */
function unpackVolumeTexel(level: MipLevel, x: number, y: number, z: number): Float32Array {
  const depth = level.depth ?? 1;
  const clX = Math.max(0, Math.min(level.width - 1, Math.trunc(x)));
  const clY = Math.max(0, Math.min(level.height - 1, Math.trunc(y)));
  const clZ = Math.max(0, Math.min(depth - 1, Math.trunc(z)));
  const bpp = bytesPerPixel(level.internalFormat, level.type);
  const idx = (clZ * level.height + clY) * level.width * bpp + clX * bpp;
  if (level.internalFormat === RGBA && level.type === UNSIGNED_BYTE) {
    return new Float32Array([
      Math.fround(level.data[idx]! / 255),
      Math.fround(level.data[idx + 1]! / 255),
      Math.fround(level.data[idx + 2]! / 255),
      Math.fround(level.data[idx + 3]! / 255),
    ]);
  }
  if (level.internalFormat === RGB && level.type === UNSIGNED_BYTE) {
    return new Float32Array([
      Math.fround(level.data[idx]! / 255),
      Math.fround(level.data[idx + 1]! / 255),
      Math.fround(level.data[idx + 2]! / 255),
      Math.fround(1),
    ]);
  }
  return new Float32Array([Math.fround(0), Math.fround(0), Math.fround(0), Math.fround(1)]);
}

/** Sample one volume level with NEAREST or trilinear LINEAR filtering. */
function sampleVolumeLevel(level: MipLevel, u: number, v: number, w: number, filter: GLenum): Float32Array {
  const depth = level.depth ?? 1;
  if (filter === NEAREST) {
    const i = Math.floor(u * level.width);
    const j = Math.floor(v * level.height);
    const k = Math.floor(w * depth);
    return unpackVolumeTexel(level, i, j, k);
  }
  if (filter === LINEAR) {
    const texX = u * level.width - 0.5;
    const texY = v * level.height - 0.5;
    const texZ = w * depth - 0.5;
    const x0 = Math.floor(texX);
    const y0 = Math.floor(texY);
    const z0 = Math.floor(texZ);
    const s = Math.fround(texX - x0);
    const t = Math.fround(texY - y0);
    const r = Math.fround(texZ - z0);
    const c000 = unpackVolumeTexel(level, x0, y0, z0);
    const c100 = unpackVolumeTexel(level, x0 + 1, y0, z0);
    const c010 = unpackVolumeTexel(level, x0, y0 + 1, z0);
    const c110 = unpackVolumeTexel(level, x0 + 1, y0 + 1, z0);
    const c001 = unpackVolumeTexel(level, x0, y0, z0 + 1);
    const c101 = unpackVolumeTexel(level, x0 + 1, y0, z0 + 1);
    const c011 = unpackVolumeTexel(level, x0, y0 + 1, z0 + 1);
    const c111 = unpackVolumeTexel(level, x0 + 1, y0 + 1, z0 + 1);
    const out = new Float32Array(4);
    for (let k = 0; k < 4; k++) {
      const t00 = Math.fround(c000[k]! * (1 - s) + c100[k]! * s);
      const t10 = Math.fround(c010[k]! * (1 - s) + c110[k]! * s);
      const t01 = Math.fround(c001[k]! * (1 - s) + c101[k]! * s);
      const t11 = Math.fround(c011[k]! * (1 - s) + c111[k]! * s);
      const b0 = Math.fround(t00 * (1 - t) + t10 * t);
      const b1 = Math.fround(t01 * (1 - t) + t11 * t);
      out[k] = Math.fround(b0 * (1 - r) + b1 * r);
    }
    return out;
  }
  return unpackVolumeTexel(level, 0, 0, 0);
}

/** Fetch a volume texel — supports (level,x,y,z) and (texture,level,x,y,z) shapes. */
export function fetchTexel3D(level: MipLevel, x: number, y: number, z: number): Float32Array;
export function fetchTexel3D(texture: TextureObject, level: number, x: number, y: number, z: number): Float32Array;
export function fetchTexel3D(a: MipLevel | TextureObject, b: number, c: number, d: number, e?: number): Float32Array {
  if (e !== undefined) {
    const tex = a as TextureObject;
    const lvl = tex.levels3D?.get(b) ?? tex.levels2DArray?.get(b);
    if (lvl === undefined) return new Float32Array([0, 0, 0, 1]);
    return unpackVolumeTexel(lvl, c, d, e);
  }
  return unpackVolumeTexel(a as MipLevel, b, c, d);
}

/** Pure 3D sampling entry — (texture,coords,lod?,version?) and (texture,s,t,r,lod?,version?) shapes. */
export function sample3D(texture: TextureObject, coords: Float32Array | number[], lod?: number | null, contextVersion?: 1 | 2): Float32Array;
export function sample3D(texture: TextureObject, s: number, t: number, r: number, lod?: number | null, contextVersion?: 1 | 2): Float32Array;
export function sample3D(
  texture: TextureObject,
  coordsOrS: Float32Array | number[] | number,
  tOrLod?: number | null,
  rOrVersion?: number | null,
  lodArg?: number | null,
  versionArg?: 1 | 2,
): Float32Array {
  let sRaw: number;
  let tRaw: number;
  let rRaw: number;
  let lodVal: number | null | undefined;
  let ver: 1 | 2 = 2;
  if (typeof coordsOrS === 'number') {
    sRaw = coordsOrS;
    tRaw = typeof tOrLod === 'number' ? tOrLod : 0;
    rRaw = typeof rOrVersion === 'number' ? rOrVersion : 0;
    lodVal = lodArg;
    if (versionArg === 1 || versionArg === 2) ver = versionArg;
  } else {
    const arr = coordsOrS as ArrayLike<number>;
    sRaw = arr[0] as number;
    tRaw = arr[1] as number;
    rRaw = arr[2] as number;
    lodVal = typeof tOrLod === 'number' || tOrLod === null || tOrLod === undefined ? (tOrLod as number | null | undefined) : undefined;
    if (rOrVersion === 1 || rOrVersion === 2) ver = rOrVersion;
    else if (lodArg === 1 || lodArg === 2) ver = lodArg as 1 | 2;
    else if (versionArg === 1 || versionArg === 2) ver = versionArg;
  }
  if (texture === null || texture === undefined || texture.alive !== true) return new Float32Array([0, 0, 0, 1]);
  if (!evaluateTextureCompleteness(texture, ver)) return new Float32Array([0, 0, 0, 1]);
  const store = texture.target === TEXTURE_2D_ARRAY ? texture.levels2DArray : texture.levels3D;
  const baseLevel = store?.get(0);
  if (baseLevel === undefined) return new Float32Array([0, 0, 0, 1]);
  const u = applyWrap(sRaw, texture.sampler.wrapS);
  const v = applyWrap(tRaw, texture.sampler.wrapT);
  const w = applyWrap(rRaw, texture.sampler.wrapR ?? REPEAT);
  const explicitLod = lodVal === null || lodVal === undefined ? 0 : Math.max(0, lodVal);
  if (explicitLod <= 0) return sampleVolumeLevel(baseLevel, u, v, w, texture.sampler.magFilter);
  return sampleVolumeLevel(baseLevel, u, v, w, texture.sampler.minFilter);
}

/** Pure 2D-array sampling entry — layer selected via clamped Math.round(r * (depth - 1)), then bilinear within the layer. */
export function sample2DArray(texture: TextureObject, coords: Float32Array | number[], lod?: number | null, contextVersion?: 1 | 2): Float32Array;
export function sample2DArray(texture: TextureObject, s: number, t: number, r: number, lod?: number | null, contextVersion?: 1 | 2): Float32Array;
export function sample2DArray(
  texture: TextureObject,
  coordsOrS: Float32Array | number[] | number,
  tOrLod?: number | null,
  rOrVersion?: number | null,
  lodArg?: number | null,
  versionArg?: 1 | 2,
): Float32Array {
  let sRaw: number;
  let tRaw: number;
  let rRaw: number;
  let lodVal: number | null | undefined;
  let ver: 1 | 2 = 2;
  if (typeof coordsOrS === 'number') {
    sRaw = coordsOrS;
    tRaw = typeof tOrLod === 'number' ? tOrLod : 0;
    rRaw = typeof rOrVersion === 'number' ? rOrVersion : 0;
    lodVal = lodArg;
    if (versionArg === 1 || versionArg === 2) ver = versionArg;
  } else {
    const arr = coordsOrS as ArrayLike<number>;
    sRaw = arr[0] as number;
    tRaw = arr[1] as number;
    rRaw = arr[2] as number;
    lodVal = typeof tOrLod === 'number' || tOrLod === null || tOrLod === undefined ? (tOrLod as number | null | undefined) : undefined;
    if (rOrVersion === 1 || rOrVersion === 2) ver = rOrVersion;
    else if (lodArg === 1 || lodArg === 2) ver = lodArg as 1 | 2;
    else if (versionArg === 1 || versionArg === 2) ver = versionArg;
  }
  if (texture === null || texture === undefined || texture.alive !== true) return new Float32Array([0, 0, 0, 1]);
  if (!evaluateTextureCompleteness(texture, ver)) return new Float32Array([0, 0, 0, 1]);
  const baseLevel = texture.levels2DArray?.get(0);
  if (baseLevel === undefined) return new Float32Array([0, 0, 0, 1]);
  const depth = baseLevel.depth ?? 1;
  const u = applyWrap(sRaw, texture.sampler.wrapS);
  const v = applyWrap(tRaw, texture.sampler.wrapT);
  const layer = Math.max(0, Math.min(depth - 1, Math.round(rRaw * (depth - 1))));
  const explicitLod = lodVal === null || lodVal === undefined ? 0 : Math.max(0, lodVal);
  const filter = explicitLod <= 0 ? texture.sampler.magFilter : texture.sampler.minFilter;
  if (filter === NEAREST) {
    const i = Math.floor(u * baseLevel.width);
    const j = Math.floor(v * baseLevel.height);
    return unpackVolumeTexel(baseLevel, i, j, layer);
  }
  if (filter === LINEAR) {
    const texX = u * baseLevel.width - 0.5;
    const texY = v * baseLevel.height - 0.5;
    const x0 = Math.floor(texX);
    const y0 = Math.floor(texY);
    const s = Math.fround(texX - x0);
    const t = Math.fround(texY - y0);
    const c00 = unpackVolumeTexel(baseLevel, x0, y0, layer);
    const c10 = unpackVolumeTexel(baseLevel, x0 + 1, y0, layer);
    const c01 = unpackVolumeTexel(baseLevel, x0, y0 + 1, layer);
    const c11 = unpackVolumeTexel(baseLevel, x0 + 1, y0 + 1, layer);
    const out = new Float32Array(4);
    for (let k = 0; k < 4; k++) {
      const top = Math.fround(c00[k]! * (1 - s) + c10[k]! * s);
      const bottom = Math.fround(c01[k]! * (1 - s) + c11[k]! * s);
      out[k] = Math.fround(top * (1 - t) + bottom * t);
    }
    return out;
  }
  return unpackVolumeTexel(baseLevel, 0, 0, layer);
}