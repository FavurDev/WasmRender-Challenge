/**
 * @fileoverview Texture object store: RGBA UNSIGNED_BYTE level-0 upload with NEAREST/LINEAR sampling.
 */
// CHANGELOG:
// - Sprint 4: Created TextureStore with upload, parameters, completeness, and sampling math.
// - Sprint 5: Added R32F/RGBA32F Float32Array formats with exact float sampling.
import {
  CLAMP_TO_EDGE,
  FLOAT,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST,
  MAX_TEXTURE_SIZE,
  MIRRORED_REPEAT,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
  R32F,
  RED,
  REPEAT,
  RGBA,
  RGBA32F,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  UNSIGNED_BYTE,
} from "./gl-constants";
import { InvalidEnumError, InvalidOperationError, InvalidValueError, OutOfMemoryError } from "./errors";

/**
 * Level-0 texture backing with derived completeness flag.
 */
interface TextureObject {
  id: number;
  width: number;
  height: number;
  data: Uint8Array | Float32Array;
  tag: "BYTE" | "FLOAT32";
  channels: 1 | 4;
  minFilter: number;
  magFilter: number;
  wrapS: number;
  wrapT: number;
  hasImage: boolean;
  complete: boolean;
}

/**
 * Test whether a dimension is a valid power of two.
 *
 * @param n Candidate dimension; non-integers and non-positives fail.
 * @returns True only for positive integer powers of two.
 */
function isPowerOfTwo(n: number): boolean {
  if (!Number.isInteger(n) || n <= 0) return false;
  let v = n;
  while (v % 2 === 0 && v > 1) v /= 2;
  return v === 1;
}

/**
 * Test whether a min-filter enum selects a mipmap path.
 *
 * @param f Filter enum under test.
 * @returns True for the four mipmap filter enums, forcing incomplete.
 */
function isMipmapFilter(f: number): boolean {
  return (
    f === NEAREST_MIPMAP_NEAREST ||
    f === LINEAR_MIPMAP_NEAREST ||
    f === NEAREST_MIPMAP_LINEAR ||
    f === LINEAR_MIPMAP_LINEAR
  );
}

/**
 * Fold one normalized coordinate through the active wrap mode.
 *
 * @param coord Unbounded normalized coordinate.
 * @param wrapMode One of CLAMP_TO_EDGE, REPEAT, MIRRORED_REPEAT.
 * @returns Wrapped coordinate in 0..1.
 */
function wrapCoordinate(coord: number, wrapMode: number): number {
  if (wrapMode === CLAMP_TO_EDGE) {
    if (coord < 0) return 0;
    if (coord > 1) return 1;
    return coord;
  }
  if (wrapMode === REPEAT) {
    return coord - Math.floor(coord);
  }
  // MIRRORED_REPEAT: fold into 0..2 period, mirror second half.
  let m = coord % 2;
  if (m < 0) m += 2;
  if (m > 1) m = 2 - m;
  return m;
}

/**
 * Fold one texel index through the active wrap mode.
 *
 * @param i Unbounded texel index, may be negative or past the edge.
 * @param size Texel extent along the axis.
 * @param wrapMode One of CLAMP_TO_EDGE, REPEAT, MIRRORED_REPEAT.
 * @returns In-range index in 0..size-1.
 */
function wrapIndex(i: number, size: number, wrapMode: number): number {
  if (wrapMode === CLAMP_TO_EDGE) {
    if (i < 0) return 0;
    if (i >= size) return size - 1;
    return i;
  }
  if (wrapMode === REPEAT) {
    let m = i % size;
    if (m < 0) m += size;
    return m;
  }
  // MIRRORED_REPEAT over texel indices: period 2*size.
  const period = 2 * size;
  let m = i % period;
  if (m < 0) m += period;
  if (m >= size) m = period - 1 - m;
  return m;
}

/**
 * Independent texture object store owning handle table and bound target.
 */
export class TextureStore {
  private textures = new Map<number, TextureObject>();
  private nextId = 1;
  private boundHandle = 0;

  /**
   * Allocate a new texture handle with 1x1 white default state.
   * @returns Stable handle number, never reused.
   */
  createTexture(): number {
    const id = this.nextId;
    const tex: TextureObject = {
      id,
      width: 1,
      height: 1,
      data: new Uint8Array([255, 255, 255, 255]),
      tag: "BYTE",
      channels: 4,
      minFilter: NEAREST,
      magFilter: NEAREST,
      wrapS: CLAMP_TO_EDGE,
      wrapT: CLAMP_TO_EDGE,
      hasImage: false,
      complete: false,
    };
    this.textures.set(id, tex);
    this.nextId += 1;
    this.recompute(tex);
    return id;
  }

  /**
   * Set the bound TEXTURE_2D handle for upload and parameter calls.
   * @param target Must equal TEXTURE_2D.
   * @param handle Texture handle, or 0 to unbind.
   * @throws InvalidEnumError For non-TEXTURE_2D target.
   * @throws InvalidOperationError For unknown nonzero handle.
   */
  bindTexture(target: number, handle: number): void {
    if (target !== TEXTURE_2D) throw new InvalidEnumError("bindTexture: target must be TEXTURE_2D");
    if (handle === 0) {
      this.boundHandle = 0;
      return;
    }
    if (!this.textures.has(handle)) throw new InvalidOperationError(`bindTexture: unknown handle ${String(handle)}`);
    this.boundHandle = handle;
  }

  /**
   * Upload a level-0 image into the bound texture (byte or float triple).
   *
   * Accepts exactly three triples: (RGBA, RGBA, UNSIGNED_BYTE) with a
   * Uint8Array payload, (RGBA32F, RGBA, FLOAT) with a Float32Array payload,
   * or (R32F, RED, FLOAT) with a single-channel Float32Array payload.
   * @param target Must equal TEXTURE_2D.
   * @param level Must equal 0.
   * @param internalFormat One of RGBA, RGBA32F, R32F.
   * @param width Positive integer within MAX_TEXTURE_SIZE.
   * @param height Positive integer within MAX_TEXTURE_SIZE.
   * @param format Must pair with internalFormat (RGBA, or RED for R32F).
   * @param type Must pair with the payload (UNSIGNED_BYTE or FLOAT).
   * @param pixels Non-null row-major texels of length width*height*channels.
   * @throws InvalidEnumError For bad target or unsupported format/type enums.
   * @throws InvalidValueError For bad level, dims, payload kind, or pixel length.
   * @throws InvalidOperationError When nothing is bound.
   * @throws OutOfMemoryError When dims exceed MAX_TEXTURE_SIZE.
   */
  texImage2D(
    target: number,
    level: number,
    internalFormat: number,
    width: number,
    height: number,
    format: number,
    type: number,
    pixels: Uint8Array | Float32Array | null,
  ): void {
    if (target !== TEXTURE_2D) throw new InvalidEnumError("texImage2D: target must be TEXTURE_2D");
    if (level !== 0) throw new InvalidValueError("texImage2D: level must be 0");
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new InvalidValueError("texImage2D: invalid dimensions");
    }
    const isTripleA =
      internalFormat === RGBA && format === RGBA && type === UNSIGNED_BYTE && pixels instanceof Uint8Array;
    const isTripleB =
      internalFormat === RGBA32F && format === RGBA && type === FLOAT && pixels instanceof Float32Array;
    const isTripleC =
      internalFormat === R32F && format === RED && type === FLOAT && pixels instanceof Float32Array;
    if (!isTripleA && !isTripleB && !isTripleC) {
      const enumsOk =
        (internalFormat === RGBA || internalFormat === RGBA32F || internalFormat === R32F) &&
        (format === RGBA || format === RED) &&
        (type === UNSIGNED_BYTE || type === FLOAT);
      if (!enumsOk) throw new InvalidEnumError("texImage2D: unsupported format/type pair");
      throw new InvalidValueError("texImage2D: bad pixel payload");
    }
    const tex = this.textures.get(this.boundHandle);
    if (this.boundHandle === 0 || tex === undefined) throw new InvalidOperationError("texImage2D: nothing bound");
    if (width > MAX_TEXTURE_SIZE || height > MAX_TEXTURE_SIZE) {
      throw new OutOfMemoryError("texImage2D: dimensions exceed MAX_TEXTURE_SIZE");
    }
    const channels: 1 | 4 = isTripleC ? 1 : 4;
    if (pixels === null || pixels.length !== width * height * channels) {
      throw new InvalidValueError("texImage2D: bad pixel payload");
    }
    // IMPLEMENTATION DECISION: guard-then-allocate, swap only after full copy. Rationale: failed upload retains prior backing. Alternatives: in-place resize (risks partial state).
    if (isTripleA) {
      const src = pixels as Uint8Array;
      const fresh = new Uint8Array(width * height * 4);
      for (let i = 0; i < fresh.length; i++) fresh[i] = src[i] as number;
      tex.width = width;
      tex.height = height;
      tex.data = fresh;
      tex.tag = "BYTE";
      tex.channels = 4;
    } else {
      const src = pixels as Float32Array;
      const fresh = new Float32Array(width * height * channels);
      for (let i = 0; i < fresh.length; i++) fresh[i] = src[i] as number;
      tex.width = width;
      tex.height = height;
      tex.data = fresh;
      tex.tag = "FLOAT32";
      tex.channels = channels;
    }
    tex.hasImage = true;
    this.recompute(tex);
  }

  /**
   * Store filter and wrap parameters on the bound texture.
   * @param target Must equal TEXTURE_2D.
   * @param pname One of TEXTURE_MIN_FILTER, TEXTURE_MAG_FILTER, TEXTURE_WRAP_S, TEXTURE_WRAP_T.
   * @param param Enum value for the slot.
   * @throws InvalidEnumError For bad target, pname, or param.
   * @throws InvalidOperationError When nothing is bound.
   */
  texParameteri(target: number, pname: number, param: number): void {
    if (target !== TEXTURE_2D) throw new InvalidEnumError("texParameteri: target must be TEXTURE_2D");
    const tex = this.textures.get(this.boundHandle);
    if (this.boundHandle === 0 || tex === undefined) throw new InvalidOperationError("texParameteri: nothing bound");
    if (pname === TEXTURE_MIN_FILTER) {
      if (param !== NEAREST && param !== LINEAR && !isMipmapFilter(param)) {
        throw new InvalidEnumError("texParameteri: bad min filter");
      }
      tex.minFilter = param;
    } else if (pname === TEXTURE_MAG_FILTER) {
      if (param !== NEAREST && param !== LINEAR && !isMipmapFilter(param)) {
        throw new InvalidEnumError("texParameteri: bad mag filter");
      }
      tex.magFilter = param;
    } else if (pname === TEXTURE_WRAP_S) {
      if (param !== CLAMP_TO_EDGE && param !== REPEAT && param !== MIRRORED_REPEAT) {
        throw new InvalidEnumError("texParameteri: bad wrapS");
      }
      tex.wrapS = param;
    } else if (pname === TEXTURE_WRAP_T) {
      if (param !== CLAMP_TO_EDGE && param !== REPEAT && param !== MIRRORED_REPEAT) {
        throw new InvalidEnumError("texParameteri: bad wrapT");
      }
      tex.wrapT = param;
    } else {
      throw new InvalidEnumError("texParameteri: bad pname");
    }
    this.recompute(tex);
  }

  /**
   * Sample the texture at normalized uv, returning 0-1 floats.
   * @param handle Texture handle.
   * @param u Normalized s coordinate.
   * @param v Normalized t coordinate.
   * @returns Four floats; incomplete textures yield opaque black without throwing.
   * @throws InvalidOperationError For unknown handle.
   */
  sample2D(handle: number, u: number, v: number): [number, number, number, number] {
    const tex = this.textures.get(handle);
    if (tex === undefined) throw new InvalidOperationError(`sample2D: unknown handle ${String(handle)}`);
    // Default 1x1 white path: fresh texture with no upload samples white.
    if (!tex.hasImage) return [1, 1, 1, 1];
    if (!tex.complete) return [0, 0, 0, 1];
    const wu = wrapCoordinate(u, tex.wrapS);
    const wv = wrapCoordinate(v, tex.wrapT);
    const w = tex.width;
    const h = tex.height;
    if (tex.tag === "FLOAT32" && tex.magFilter === LINEAR) {
      const sx = wu * w - 0.5;
      const sy = wv * h - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = wrapIndex(x0, w, tex.wrapS);
      const i10 = wrapIndex(x0 + 1, w, tex.wrapS);
      const j00 = wrapIndex(y0, h, tex.wrapT);
      const j10 = wrapIndex(y0 + 1, h, tex.wrapT);
      const t00 = this.fetchFloats(tex, i00, j00);
      const t10 = this.fetchFloats(tex, i10, j00);
      const t01 = this.fetchFloats(tex, i00, j10);
      const t11 = this.fetchFloats(tex, i10, j10);
      const out: [number, number, number, number] = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) {
        const top = (t00[c] as number) * (1 - fx) + (t10[c] as number) * fx;
        const bot = (t01[c] as number) * (1 - fx) + (t11[c] as number) * fx;
        out[c] = top * (1 - fy) + bot * fy;
      }
      return out;
    }
    if (tex.tag === "FLOAT32") {
      const xi = wrapIndex(Math.floor(u * w), w, tex.wrapS);
      const yi = wrapIndex(Math.floor(v * h), h, tex.wrapT);
      void wu;
      void wv;
      return this.fetchFloats(tex, xi, yi);
    }
    if (tex.magFilter === LINEAR) {
      const sx = wu * w - 0.5;
      const sy = wv * h - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const i00 = wrapIndex(x0, w, tex.wrapS);
      const i10 = wrapIndex(x1, w, tex.wrapS);
      const j00 = wrapIndex(y0, h, tex.wrapT);
      const j10 = wrapIndex(y1, h, tex.wrapT);
      const t00 = this.fetchBytes(tex, i00, j00);
      const t10 = this.fetchBytes(tex, i10, j00);
      const t01 = this.fetchBytes(tex, i00, j10);
      const t11 = this.fetchBytes(tex, i10, j10);
      const out: [number, number, number, number] = [0, 0, 0, 0];
      for (let c = 0; c < 4; c++) {
        const top = (t00[c] as number) * (1 - fx) + (t10[c] as number) * fx;
        const bot = (t01[c] as number) * (1 - fx) + (t11[c] as number) * fx;
        out[c] = (top * (1 - fy) + bot * fy) / 255;
      }
      return out;
    }
    // NEAREST: raw floor index folded through the active wrap mode (matches u=1.5 divergence).
    const xi = wrapIndex(Math.floor(u * w), w, tex.wrapS);
    const yi = wrapIndex(Math.floor(v * h), h, tex.wrapT);
    void wu;
    void wv;
    const t = this.fetchBytes(tex, xi, yi);
    return [(t[0] as number) / 255, (t[1] as number) / 255, (t[2] as number) / 255, (t[3] as number) / 255];
  }

  /**
   * Write a single texel in byte space.
   * @param handle Texture handle.
   * @param x Texel column in range.
   * @param y Texel row in range.
   * @param r Red byte.
   * @param g Green byte.
   * @param b Blue byte.
   * @param a Alpha byte.
   * @throws InvalidOperationError For unknown handle.
   * @throws InvalidValueError For out-of-range coordinates.
   */
  putTexel(handle: number, x: number, y: number, r: number, g: number, b: number, a: number): void {
    const tex = this.textures.get(handle);
    if (tex === undefined) throw new InvalidOperationError(`putTexel: unknown handle ${String(handle)}`);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= tex.width || y >= tex.height) {
      throw new InvalidValueError("putTexel: coordinates out of range");
    }
    const off = (y * tex.width + x) * 4;
    tex.data[off] = r;
    tex.data[off + 1] = g;
    tex.data[off + 2] = b;
    tex.data[off + 3] = a;
  }

  /**
   * Read a single texel in byte space.
   * @param handle Texture handle.
   * @param x Texel column in range.
   * @param y Texel row in range.
   * @returns Four bytes in RGBA order.
   * @throws InvalidOperationError For unknown handle.
   * @throws InvalidValueError For out-of-range coordinates.
   */
  getTexel(handle: number, x: number, y: number): [number, number, number, number] {
    const tex = this.textures.get(handle);
    if (tex === undefined) throw new InvalidOperationError(`getTexel: unknown handle ${String(handle)}`);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= tex.width || y >= tex.height) {
      throw new InvalidValueError("getTexel: coordinates out of range");
    }
    const off = (y * tex.width + x) * 4;
    return [
      tex.data[off] as number,
      tex.data[off + 1] as number,
      tex.data[off + 2] as number,
      tex.data[off + 3] as number,
    ];
  }

  /**
   * Report derived completeness for a handle.
   * @param handle Texture handle.
   * @returns True only when image present, dims valid, and filter-wrap rules hold.
   * @throws InvalidOperationError For unknown handle.
   */
  isComplete(handle: number): boolean {
    const tex = this.textures.get(handle);
    if (tex === undefined) throw new InvalidOperationError(`isComplete: unknown handle ${String(handle)}`);
    return this.recompute(tex);
  }

  /**
   * Fetch one texel in float space with handle and coordinate validation.
   *
   * Returns exact stored floats; R32F expands to [r, 0, 0, 1] per AD-2
   * and byte-backed textures normalize by 255.
   * @param handle Texture handle.
   * @param x Texel column in range.
   * @param y Texel row in range.
   * @returns Four floats in RGBA order.
   * @throws InvalidOperationError For unknown handle.
   * @throws InvalidValueError For out-of-range coordinates.
   */
  getFloatTexel(handle: number, x: number, y: number): [number, number, number, number] {
    const tex = this.textures.get(handle);
    if (tex === undefined) throw new InvalidOperationError(`getFloatTexel: unknown handle ${String(handle)}`);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= tex.width || y >= tex.height) {
      throw new InvalidValueError("getFloatTexel: coordinates out of range");
    }
    return this.fetchFloats(tex, x, y);
  }

  private fetchFloats(tex: TextureObject, x: number, y: number): [number, number, number, number] {
    if (tex.tag === "FLOAT32" && tex.channels === 1) {
      const data = tex.data as Float32Array;
      const r = data[y * tex.width + x] as number;
      return [r, 0, 0, 1];
    }
    if (tex.tag === "FLOAT32") {
      const data = tex.data as Float32Array;
      const off = (y * tex.width + x) * 4;
      return [
        data[off] as number,
        data[off + 1] as number,
        data[off + 2] as number,
        data[off + 3] as number,
      ];
    }
    const t = this.fetchBytes(tex, x, y);
    return [(t[0] as number) / 255, (t[1] as number) / 255, (t[2] as number) / 255, (t[3] as number) / 255];
  }

  private fetchBytes(tex: TextureObject, x: number, y: number): [number, number, number, number] {
    const off = (y * tex.width + x) * 4;
    return [
      tex.data[off] as number,
      tex.data[off + 1] as number,
      tex.data[off + 2] as number,
      tex.data[off + 3] as number,
    ];
  }

  /**
   * Derive the completeness flag from image presence and filter-wrap rules.
   *
   * @param tex Backing texture whose complete flag is updated in place.
   * @returns True only when image present, dims valid, and filter-wrap rules hold.
   */
  private recompute(tex: TextureObject): boolean {
    if (!tex.hasImage) {
      tex.complete = false;
      return false;
    }
    if (tex.width <= 0 || tex.height <= 0 || tex.width > MAX_TEXTURE_SIZE || tex.height > MAX_TEXTURE_SIZE) {
      tex.complete = false;
      return false;
    }
    if (isMipmapFilter(tex.minFilter)) {
      tex.complete = false;
      return false;
    }
    const needsPOT =
      tex.wrapS === REPEAT || tex.wrapS === MIRRORED_REPEAT || tex.wrapT === REPEAT || tex.wrapT === MIRRORED_REPEAT;
    if (needsPOT && (!isPowerOfTwo(tex.width) || !isPowerOfTwo(tex.height))) {
      tex.complete = false;
      return false;
    }
    tex.complete = true;
    return true;
  }
}
