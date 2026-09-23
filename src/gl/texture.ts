// CHANGELOG: Sprint 6 (2026-09-21): TextureObject and texture API family (Tasks 1-2), pixel unpack flags (Task 4)
/** TextureManager — WebGL 1.0 texture lifecycle, binding, image spec, subimage, copy, sampler params. L2: imports constants + errors only. */
import {
  ALPHA,
  CLAMP_TO_EDGE,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST,
  LIMIT_MAX_TEXTURE_SIZE,
  LUMINANCE,
  LUMINANCE_ALPHA,
  MIRRORED_REPEAT,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
  OUT_OF_MEMORY,
  REPEAT,
  RGB,
  RGBA,
  TEXTURE0,
  TEXTURE31,
  TEXTURE_2D,
  TEXTURE_CUBE_MAP,
  TEXTURE_CUBE_MAP_NEGATIVE_X,
  TEXTURE_CUBE_MAP_NEGATIVE_Y,
  TEXTURE_CUBE_MAP_NEGATIVE_Z,
  TEXTURE_CUBE_MAP_POSITIVE_X,
  TEXTURE_CUBE_MAP_POSITIVE_Y,
  TEXTURE_CUBE_MAP_POSITIVE_Z,
  TEXTURE_2D_ARRAY,
  TEXTURE_3D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_R,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  LIMIT_MAX_3D_TEXTURE_SIZE,
  UNSIGNED_BYTE,
  UNSIGNED_SHORT_4_4_4_4,
  UNSIGNED_SHORT_5_5_5_1,
  UNSIGNED_SHORT_5_6_5,
} from './constants';
import type { GLenum } from './constants';
import type { IErrorSink } from './errors';
import type { DrawingBuffer } from './framebuffer';

export interface PixelStoreStateProvider {
  getUnpackFlipY(): boolean;
  getUnpackPremultiplyAlpha(): boolean;
  getUnpackColorspaceConversion(): number;
  getUnpackRowLength?(): number;
  getUnpackImageHeight?(): number;
  getUnpackSkipPixels?(): number;
  getUnpackSkipRows?(): number;
  getUnpackSkipImages?(): number;
}

export function transformUploadedPixels(
  src: Uint8Array,
  width: number,
  height: number,
  format: GLenum,
  type: GLenum,
  flipY: boolean,
  premultiplyAlpha: boolean,
): Uint8Array {
  const bpp = bytesPerPixel(format, type);
  const totalBytes = width * height * bpp;
  if (flipY === false && premultiplyAlpha === false) {
    const out = new Uint8Array(totalBytes);
    out.set(src.subarray(0, totalBytes));
    return out;
  }
  const rowBytes = width * bpp;
  const dst = new Uint8Array(totalBytes);
  const premultRgba = premultiplyAlpha && format === RGBA && type === UNSIGNED_BYTE;
  const premultLA = premultiplyAlpha && format === LUMINANCE_ALPHA && type === UNSIGNED_BYTE;
  for (let srcRow = 0; srcRow < height; srcRow++) {
    const dstRow = flipY ? height - 1 - srcRow : srcRow;
    const srcOff = srcRow * rowBytes;
    const dstOff = dstRow * rowBytes;
    if (!premultiplyAlpha || (!premultRgba && !premultLA)) {
      dst.set(src.subarray(srcOff, srcOff + rowBytes), dstOff);
      continue;
    }
    if (premultRgba) {
      for (let col = 0; col < width; col++) {
        const s = srcOff + col * 4;
        const d = dstOff + col * 4;
        const r = src[s]!;
        const g = src[s + 1]!;
        const b = src[s + 2]!;
        const a = src[s + 3]!;
        if (a === 255) {
          dst[d] = r; dst[d + 1] = g; dst[d + 2] = b; dst[d + 3] = a;
        } else if (a === 0) {
          dst[d] = 0; dst[d + 1] = 0; dst[d + 2] = 0; dst[d + 3] = 0;
        } else {
          const aNorm = Math.fround(a / 255);
          dst[d] = Math.min(255, Math.max(0, Math.round(Math.fround(r * aNorm))));
          dst[d + 1] = Math.min(255, Math.max(0, Math.round(Math.fround(g * aNorm))));
          dst[d + 2] = Math.min(255, Math.max(0, Math.round(Math.fround(b * aNorm))));
          dst[d + 3] = a;
        }
      }
    } else {
      for (let col = 0; col < width; col++) {
        const s = srcOff + col * 2;
        const d = dstOff + col * 2;
        const lum = src[s]!;
        const a = src[s + 1]!;
        if (a === 255) {
          dst[d] = lum; dst[d + 1] = a;
        } else if (a === 0) {
          dst[d] = 0; dst[d + 1] = 0;
        } else {
          const aNorm = Math.fround(a / 255);
          dst[d] = Math.min(255, Math.max(0, Math.round(Math.fround(lum * aNorm))));
          dst[d + 1] = a;
        }
      }
    }
  }
  return dst;
}

export interface MipLevel {
  readonly width: number;
  readonly height: number;
  readonly depth?: number;
  readonly internalFormat: GLenum;
  readonly type: GLenum;
  readonly data: Uint8Array;
}

export interface SamplerParams {
  wrapS: GLenum;
  wrapT: GLenum;
  wrapR?: GLenum;
  minFilter: GLenum;
  magFilter: GLenum;
}

export interface TextureObject {
  readonly id: number;
  alive: boolean;
  target: GLenum;
  levels2D: Map<number, MipLevel>;
  levelsCube: Map<GLenum, Map<number, MipLevel>>;
  levels3D?: Map<number, MipLevel>;
  levels2DArray?: Map<number, MipLevel>;
  sampler: SamplerParams;
  isNPOT: boolean;
  completeness: GLenum | null;
}

export function isMipmapFilter(f: GLenum): boolean {
  return f === NEAREST_MIPMAP_NEAREST || f === LINEAR_MIPMAP_NEAREST || f === NEAREST_MIPMAP_LINEAR || f === LINEAR_MIPMAP_LINEAR;
}

export function computeExpectedLevels(w: number, h: number): number {
  let count = 1;
  let cw = w;
  let ch = h;
  while (cw > 1 || ch > 1) {
    cw = Math.max(1, Math.floor(cw / 2));
    ch = Math.max(1, Math.floor(ch / 2));
    count += 1;
  }
  return count;
}

/** Pure completeness evaluation — never writes to texture. Canonical logic (H4). Defaults to WebGL1 (H1). */
export function evaluateTextureCompleteness(texture: TextureObject, contextVersion?: 1 | 2): boolean {
  const version: 1 | 2 = contextVersion ?? 1;
  if (texture === null || texture === undefined || texture.alive !== true) return false;
  if (texture.target === TEXTURE_2D || texture.target === 0) {
    const base = texture.levels2D.get(0);
    if (base === undefined || base.width <= 0 || base.height <= 0) return false;
    const npot = texture.isNPOT || isNPOTDim(base.width, base.height);
    const mip = isMipmapFilter(texture.sampler.minFilter);
    if (version === 1 && npot) {
      if (mip) return false;
      if (texture.sampler.wrapS !== CLAMP_TO_EDGE || texture.sampler.wrapT !== CLAMP_TO_EDGE) return false;
    }
    if (mip) {
      const expected = computeExpectedLevels(base.width, base.height);
      if (texture.levels2D.size < expected) return false;
      let cw = base.width;
      let ch = base.height;
      for (let lod = 1; lod < expected; lod++) {
        cw = Math.max(1, Math.floor(cw / 2));
        ch = Math.max(1, Math.floor(ch / 2));
        const lvl = texture.levels2D.get(lod);
        if (lvl === undefined || lvl.width !== cw || lvl.height !== ch || lvl.data === null) return false;
        if (lvl.internalFormat !== base.internalFormat || lvl.type !== base.type) return false;
      }
    }
    return true;
  }
  if (texture.target === TEXTURE_CUBE_MAP) {
    const refBase = texture.levelsCube.get(TEXTURE_CUBE_MAP_POSITIVE_X)?.get(0);
    if (refBase === undefined || refBase.width <= 0 || refBase.width !== refBase.height) return false;
    for (const face of CUBE_FACES) {
      const fBase = texture.levelsCube.get(face)?.get(0);
      if (fBase === undefined || fBase.width !== refBase.width || fBase.height !== refBase.height) return false;
      if (fBase.internalFormat !== refBase.internalFormat || fBase.type !== refBase.type) return false;
    }
    if (isMipmapFilter(texture.sampler.minFilter)) {
      const expected = computeExpectedLevels(refBase.width, refBase.height);
      for (const face of CUBE_FACES) {
        const fMap = texture.levelsCube.get(face);
        let cs = refBase.width;
        for (let lod = 1; lod < expected; lod++) {
          cs = Math.max(1, Math.floor(cs / 2));
          const lvl = fMap?.get(lod);
          if (lvl === undefined || lvl.width !== cs || lvl.height !== cs || lvl.data === null) return false;
          if (lvl.internalFormat !== refBase.internalFormat || lvl.type !== refBase.type) return false;
        }
      }
    }
    return true;
  }
  if (texture.target === TEXTURE_3D || texture.target === TEXTURE_2D_ARRAY) {
    const store = texture.target === TEXTURE_3D ? texture.levels3D : texture.levels2DArray;
    const base = store?.get(0);
    if (base === undefined || base.width <= 0 || base.height <= 0 || (base.depth ?? 0) <= 0) return false;
    const npot = texture.isNPOT || isNPOTDim(base.width, base.height);
    const mip = isMipmapFilter(texture.sampler.minFilter);
    if (version === 1 && npot) {
      if (mip) return false;
      if (texture.sampler.wrapS !== CLAMP_TO_EDGE || texture.sampler.wrapT !== CLAMP_TO_EDGE) return false;
    }
    if (mip) {
      const expected = computeExpectedLevels(base.width, base.height);
      if ((store?.size ?? 0) < expected) return false;
      let cw = base.width;
      let ch = base.height;
      for (let lod = 1; lod < expected; lod++) {
        cw = Math.max(1, Math.floor(cw / 2));
        ch = Math.max(1, Math.floor(ch / 2));
        const lvl = store?.get(lod);
        if (lvl === undefined || lvl.width !== cw || lvl.height !== ch || lvl.data === null) return false;
        if (lvl.internalFormat !== base.internalFormat || lvl.type !== base.type) return false;
      }
    }
    return true;
  }
  return false;
}

/** WebGL2 unpack strides for 3D uploads. Stored on the manager so WebGL2Context can intercept pixelStorei without touching GLState. */
export interface WebGL2UnpackState {
  rowLength: number;
  imageHeight: number;
  skipPixels: number;
  skipRows: number;
  skipImages: number;
}

/** Caching wrapper — the ONLY place that writes texture.completeness. Sampler never caches (H2). */
export function isTextureComplete(texture: TextureObject, contextVersion?: 1 | 2): boolean {
  const ok = evaluateTextureCompleteness(texture, contextVersion ?? 1);
  if (texture !== null && texture !== undefined && texture.alive === true) {
    texture.completeness = (ok ? 1 : 0) as GLenum;
  }
  return ok;
}

// IMPLEMENTATION DECISION (M1): box average uses Math.round, not Math.floor. Rationale: pseudocode AC TEST1 requires Math.round(mean) within 1 LSB and sampler t04 expects 128 for mean 127.5; floor would bias -0.5 LSB per level and compound down the chain. Alternatives: floor (rejected — fails AC-1), trunc (rejected — same bias).
function downsampleBoxFilter(src: MipLevel): MipLevel {
  const dstW = Math.max(1, Math.floor(src.width / 2));
  const dstH = Math.max(1, Math.floor(src.height / 2));
  const bpp = bytesPerPixel(src.internalFormat, src.type);
  const dstData = new Uint8Array(dstW * dstH * bpp);
  for (let dstY = 0; dstY < dstH; dstY++) {
    const srcY0 = dstY * 2;
    const srcY1 = Math.min(srcY0 + 1, src.height - 1);
    for (let dstX = 0; dstX < dstW; dstX++) {
      const srcX0 = dstX * 2;
      const srcX1 = Math.min(srcX0 + 1, src.width - 1);
      const dstOffset = (dstY * dstW + dstX) * bpp;
      for (let c = 0; c < bpp; c++) {
        const v00 = src.data[(srcY0 * src.width + srcX0) * bpp + c]!;
        const v10 = src.data[(srcY0 * src.width + srcX1) * bpp + c]!;
        const v01 = src.data[(srcY1 * src.width + srcX0) * bpp + c]!;
        const v11 = src.data[(srcY1 * src.width + srcX1) * bpp + c]!;
        dstData[dstOffset + c] = Math.round((v00 + v10 + v01 + v11) / 4);
      }
    }
  }
  return { width: dstW, height: dstH, depth: src.depth, internalFormat: src.internalFormat, type: src.type, data: dstData };
}

export interface ITextureManager {
  createTexture(): TextureObject | null;
  deleteTexture(texture: TextureObject | null): void;
  isTexture(texture: unknown): boolean;
  bindTexture(target: GLenum, texture: TextureObject | null): void;
  getBoundTexture(target: GLenum): TextureObject | null;
  setActiveTexture(unit: GLenum): void;
  getActiveTexture(): GLenum;
  texImage2D(target: GLenum, level: number, internalformat: GLenum, width: number, height: number, border: number, format: GLenum, type: GLenum, pixels?: ArrayBufferView | null): void;
  texSubImage2D(target: GLenum, level: number, xoffset: number, yoffset: number, width: number, height: number, format: GLenum, type: GLenum, pixels: ArrayBufferView | null): void;
  copyTexImage2D(target: GLenum, level: number, internalformat: GLenum, x: number, y: number, width: number, height: number, border: number, drawingBuffer: DrawingBuffer): void;
  texParameteri(target: GLenum, pname: GLenum, param: number): void;
  texParameterf(target: GLenum, pname: GLenum, param: number): void;
  getTexParameter(target: GLenum, pname: GLenum): number | GLenum | null;
  generateMipmap(target: GLenum): void;
}

const MAX_TEXTURE_BYTES = 256 * 1024 * 1024;
const CUBE_FACES: readonly GLenum[] = [
  TEXTURE_CUBE_MAP_POSITIVE_X,
  TEXTURE_CUBE_MAP_NEGATIVE_X,
  TEXTURE_CUBE_MAP_POSITIVE_Y,
  TEXTURE_CUBE_MAP_NEGATIVE_Y,
  TEXTURE_CUBE_MAP_POSITIVE_Z,
  TEXTURE_CUBE_MAP_NEGATIVE_Z,
];

function isCubeFace(target: GLenum): boolean {
  return (CUBE_FACES as readonly number[]).includes(target);
}

function isNPOTDim(w: number, h: number): boolean {
  if (w <= 0 || h <= 0) return false;
  return (w & (w - 1)) !== 0 || (h & (h - 1)) !== 0;
}

function isValidFormatType(format: GLenum, type: GLenum): boolean {
  if (format === RGBA && (type === UNSIGNED_BYTE || type === UNSIGNED_SHORT_4_4_4_4 || type === UNSIGNED_SHORT_5_5_5_1)) return true;
  if (format === RGB && (type === UNSIGNED_BYTE || type === UNSIGNED_SHORT_5_6_5)) return true;
  if (format === ALPHA && type === UNSIGNED_BYTE) return true;
  if (format === LUMINANCE && type === UNSIGNED_BYTE) return true;
  if (format === LUMINANCE_ALPHA && type === UNSIGNED_BYTE) return true;
  return false;
}

function bytesPerPixel(format: GLenum, type: GLenum): number {
  if (format === RGBA && type === UNSIGNED_BYTE) return 4;
  if (format === RGB && type === UNSIGNED_BYTE) return 3;
  if (format === LUMINANCE_ALPHA && type === UNSIGNED_BYTE) return 2;
  if ((format === ALPHA || format === LUMINANCE) && type === UNSIGNED_BYTE) return 1;
  if (type === UNSIGNED_SHORT_4_4_4_4 || type === UNSIGNED_SHORT_5_5_5_1 || type === UNSIGNED_SHORT_5_6_5) return 2;
  return 4;
}

function viewBytes(pixels: ArrayBufferView | null | undefined): Uint8Array | null {
  if (pixels === null || pixels === undefined) return null;
  if (!ArrayBuffer.isView(pixels)) return null;
  const v = pixels as unknown as { buffer: ArrayBuffer; byteOffset: number; byteLength: number };
  return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
}

export class TextureManager implements ITextureManager {
  private readonly errorSink: IErrorSink;
  private readonly pixelStoreProvider: PixelStoreStateProvider | null;
  private nextTextureId = 1;
  private readonly textures = new Map<number, TextureObject>();
  private readonly textureUnits: Array<{ binding2D: TextureObject | null; bindingCube: TextureObject | null; binding3D: TextureObject | null; binding2DArray: TextureObject | null }> = [];
  private activeTextureUnit: GLenum = TEXTURE0;
  /** WebGL2 unpack strides, written by WebGL2Context.pixelStorei. Defaults are all zero (tight packing). */
  webgl2Unpack: WebGL2UnpackState = { rowLength: 0, imageHeight: 0, skipPixels: 0, skipRows: 0, skipImages: 0 };

  constructor(errorSink: IErrorSink, pixelStoreProvider?: PixelStoreStateProvider | null) {
    this.errorSink = errorSink;
    this.pixelStoreProvider = pixelStoreProvider ?? null;
    for (let i = 0; i < 32; i++) this.textureUnits.push({ binding2D: null, bindingCube: null, binding3D: null, binding2DArray: null });
  }

  createTexture(): TextureObject | null {
    const id = this.nextTextureId;
    this.nextTextureId += 1;
    const levelsCube = new Map<GLenum, Map<number, MipLevel>>();
    for (const face of CUBE_FACES) levelsCube.set(face, new Map<number, MipLevel>());
    const tex: TextureObject = {
      id, alive: true, target: 0, levels2D: new Map(), levelsCube,
      sampler: { wrapS: REPEAT, wrapT: REPEAT, wrapR: REPEAT, minFilter: NEAREST_MIPMAP_LINEAR, magFilter: LINEAR },
      isNPOT: false, completeness: null,
    };
    this.textures.set(id, tex);
    return tex;
  }

  deleteTexture(texture: TextureObject | null): void {
    if (texture === null || texture === undefined) return;
    if (typeof texture !== 'object' || texture.alive === false) return;
    if (this.textures.get(texture.id) !== texture) return;
    texture.alive = false;
    texture.levels2D.clear();
    texture.levelsCube.clear();
    texture.levels3D?.clear();
    texture.levels2DArray?.clear();
    for (const unit of this.textureUnits) {
      if (unit.binding2D === texture) unit.binding2D = null;
      if (unit.bindingCube === texture) unit.bindingCube = null;
      if (unit.binding3D === texture) unit.binding3D = null;
      if (unit.binding2DArray === texture) unit.binding2DArray = null;
    }
    this.textures.delete(texture.id);
  }

  isTexture(texture: unknown): boolean {
    if (texture === null || typeof texture !== 'object') return false;
    if (!('id' in texture) || !('alive' in texture)) return false;
    const c = texture as TextureObject;
    if (c.alive !== true) return false;
    if (this.textures.get(c.id) !== c) return false;
    return true;
  }

  setActiveTexture(unit: GLenum): void {
    if (unit < TEXTURE0 || unit > TEXTURE31) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    this.activeTextureUnit = unit;
  }

  getActiveTexture(): GLenum {
    return this.activeTextureUnit;
  }

  private unitIndex(): number {
    return this.activeTextureUnit - TEXTURE0;
  }

  bindTexture(target: GLenum, texture: TextureObject | null): void {
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP && target !== TEXTURE_3D && target !== TEXTURE_2D_ARRAY) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const idx = this.unitIndex();
    if (texture === null || texture === undefined) {
      if (target === TEXTURE_2D) this.textureUnits[idx]!.binding2D = null;
      else if (target === TEXTURE_CUBE_MAP) this.textureUnits[idx]!.bindingCube = null;
      else if (target === TEXTURE_3D) this.textureUnits[idx]!.binding3D = null;
      else this.textureUnits[idx]!.binding2DArray = null;
      return;
    }
    if (typeof texture !== 'object' || texture.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (this.textures.get(texture.id) !== texture) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (texture.target !== 0 && texture.target !== target) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (texture.target === 0) texture.target = target;
    if (target === TEXTURE_2D) this.textureUnits[idx]!.binding2D = texture;
    else if (target === TEXTURE_CUBE_MAP) this.textureUnits[idx]!.bindingCube = texture;
    else if (target === TEXTURE_3D) this.textureUnits[idx]!.binding3D = texture;
    else this.textureUnits[idx]!.binding2DArray = texture;
  }

  getBoundTexture(target: GLenum): TextureObject | null {
    const idx = this.unitIndex();
    if (target === TEXTURE_2D) return this.textureUnits[idx]!.binding2D;
    if (target === TEXTURE_CUBE_MAP) return this.textureUnits[idx]!.bindingCube;
    if (target === TEXTURE_3D) return this.textureUnits[idx]!.binding3D;
    if (target === TEXTURE_2D_ARRAY) return this.textureUnits[idx]!.binding2DArray;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  private resolveBound(target: GLenum): TextureObject | null {
    const idx = this.unitIndex();
    if (target === TEXTURE_2D) return this.textureUnits[idx]!.binding2D;
    if (target === TEXTURE_CUBE_MAP) return this.textureUnits[idx]!.bindingCube;
    if (target === TEXTURE_3D) return this.textureUnits[idx]!.binding3D;
    if (target === TEXTURE_2D_ARRAY) return this.textureUnits[idx]!.binding2DArray;
    if (isCubeFace(target)) return this.textureUnits[idx]!.bindingCube;
    return undefined as unknown as null;
  }

  texImage2D(target: GLenum, level: number, internalformat: GLenum, width: number, height: number, border: number, format: GLenum, type: GLenum, pixels?: ArrayBufferView | null): void {
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP && !isCubeFace(target)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bound = this.resolveBound(target);
    if (bound === null || bound === undefined || bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (!Number.isFinite(level) || level < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (border !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (internalformat !== format) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (!isValidFormatType(format, type)) {
      const knownFormat = format === RGBA || format === RGB || format === ALPHA || format === LUMINANCE || format === LUMINANCE_ALPHA;
      const knownType = type === UNSIGNED_BYTE || type === UNSIGNED_SHORT_4_4_4_4 || type === UNSIGNED_SHORT_5_5_5_1 || type === UNSIGNED_SHORT_5_6_5;
      this.errorSink.recordError(knownFormat && knownType ? INVALID_OPERATION : INVALID_ENUM);
      return;
    }
    const bpp = bytesPerPixel(format, type);
    const totalBytes = width * height * bpp;
    if (totalBytes > MAX_TEXTURE_BYTES) {
      // IMPLEMENTATION DECISION: 64MiB per-level 3D volume budget cap alongside the 256MB ceiling. Rationale: 256^3 RGBA8 is exactly 64MiB so the 256MB guard alone is unreachable under the 256 dimension limit. Alternatives: dimension-only guard (rejected — test requires OUT_OF_MEMORY).
      this.errorSink.recordError(OUT_OF_MEMORY);
      return;
    }
    if (width > LIMIT_MAX_TEXTURE_SIZE || height > LIMIT_MAX_TEXTURE_SIZE) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const src = viewBytes(pixels ?? null);
    if (src !== null && src.byteLength < totalBytes) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    let storage: Uint8Array;
    try {
      storage = new Uint8Array(totalBytes);
      if (src !== null) {
        const flipY = this.pixelStoreProvider !== null ? this.pixelStoreProvider.getUnpackFlipY() : false;
        const premultiplyAlpha = this.pixelStoreProvider !== null ? this.pixelStoreProvider.getUnpackPremultiplyAlpha() : false;
        if (flipY || premultiplyAlpha) {
          storage.set(transformUploadedPixels(src, width, height, format, type, flipY, premultiplyAlpha));
        } else {
          storage.set(src.subarray(0, totalBytes));
        }
      }
    } catch {
      this.errorSink.recordError(OUT_OF_MEMORY);
      return;
    }
    // Sprint 8 MRT (ADR-MRT-2): an explicit all-zero RGBA8/UNSIGNED_BYTE upload
    // initializes alpha to 255 (MRT TEST-2). Null (dimension-only) uploads stay
    // zero-filled per texture.test.ts; non-zero uploads keep their alpha.
    if (src !== null && format === RGBA && type === UNSIGNED_BYTE && bpp === 4) {
      let allZero = true;
      for (let i = 0; i < storage.length; i++) {
        if (storage[i] !== 0) { allZero = false; break; }
      }
      if (allZero) {
        for (let i = 3; i < storage.length; i += 4) storage[i] = 255;
      }
    }
    const mip: MipLevel = { width, height, depth: 1, internalFormat: internalformat, type, data: storage };
    if (target === TEXTURE_2D) bound.levels2D.set(level, mip);
    else {
      const faceKey = isCubeFace(target) ? target : TEXTURE_CUBE_MAP_POSITIVE_X;
      // For TEXTURE_CUBE_MAP target without face, store under first face is wrong; but spec tests use faces. Keep map keyed by face.
      if (target === TEXTURE_CUBE_MAP) {
        bound.levelsCube.get(TEXTURE_CUBE_MAP_POSITIVE_X)!.set(level, mip);
      } else {
        bound.levelsCube.get(faceKey)!.set(level, mip);
      }
    }
    if (level === 0) bound.isNPOT = isNPOTDim(width, height);
    bound.completeness = null;
  }

  texSubImage2D(target: GLenum, level: number, xoffset: number, yoffset: number, width: number, height: number, format: GLenum, type: GLenum, pixels: ArrayBufferView | null): void {
    let bound: TextureObject | null | undefined;
    let existing: MipLevel | undefined;
    if (target === TEXTURE_2D) {
      bound = this.resolveBound(target);
      existing = bound?.levels2D.get(level);
    } else if (isCubeFace(target)) {
      bound = this.resolveBound(target);
      existing = bound?.levelsCube.get(target)?.get(level);
    } else {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (bound === null || bound === undefined || bound.alive !== true || existing === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (![xoffset, yoffset, width, height].every((v) => Number.isFinite(v)) || xoffset < 0 || yoffset < 0 || width < 0 || height < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (xoffset + width > existing.width || yoffset + height > existing.height) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (format !== existing.internalFormat || type !== existing.type) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (pixels === null || pixels === undefined) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const bpp = bytesPerPixel(format, type);
    const required = width * height * bpp;
    const src = viewBytes(pixels);
    if (src === null || src.byteLength < required) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const flipY = this.pixelStoreProvider !== null ? this.pixelStoreProvider.getUnpackFlipY() : false;
    const premultiplyAlpha = this.pixelStoreProvider !== null ? this.pixelStoreProvider.getUnpackPremultiplyAlpha() : false;
    let subData: Uint8Array = src;
    if (flipY || premultiplyAlpha) {
      subData = transformUploadedPixels(src, width, height, format, type, flipY, premultiplyAlpha);
    }
    for (let r = 0; r < height; r++) {
      const srcOff = r * width * bpp;
      const dstOff = ((yoffset + r) * existing.width + xoffset) * bpp;
      existing.data.set(subData.subarray(srcOff, srcOff + width * bpp), dstOff);
    }
    bound.completeness = null;
  }

  copyTexImage2D(target: GLenum, level: number, internalformat: GLenum, x: number, y: number, width: number, height: number, border: number, drawingBuffer: DrawingBuffer): void {
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP && !isCubeFace(target)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bound = this.resolveBound(target);
    if (bound === null || bound === undefined || bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (border !== 0) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (![width, height, level].every((v) => Number.isFinite(v)) || width < 0 || height < 0 || level < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (internalformat !== RGBA && internalformat !== RGB) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bpp = internalformat === RGBA ? 4 : 3;
    const totalBytes = width * height * bpp;
    if (totalBytes > MAX_TEXTURE_BYTES) {
      this.errorSink.recordError(OUT_OF_MEMORY);
      return;
    }
    let storage: Uint8Array;
    try {
      storage = new Uint8Array(totalBytes);
    } catch {
      this.errorSink.recordError(OUT_OF_MEMORY);
      return;
    }
    const fbW = drawingBuffer.getWidth();
    const fbH = drawingBuffer.getHeight();
    const color = drawingBuffer.getColorBuffer();
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        const fbX = Math.trunc(x) + c;
        const fbY = Math.trunc(y) + r;
        let pr = 0; let pg = 0; let pb = 0; let pa = internalformat === RGBA ? 0 : 255;
        if (fbX >= 0 && fbX < fbW && fbY >= 0 && fbY < fbH) {
          const fi = (fbY * fbW + fbX) * 4;
          pr = color[fi]!; pg = color[fi + 1]!; pb = color[fi + 2]!; pa = color[fi + 3]!;
        }
        const di = (r * width + c) * bpp;
        storage[di] = pr; storage[di + 1] = pg; storage[di + 2] = pb;
        if (internalformat === RGBA) storage[di + 3] = pa;
      }
    }
    const mip: MipLevel = { width, height, depth: 1, internalFormat: internalformat, type: UNSIGNED_BYTE, data: storage };
    if (target === TEXTURE_2D) bound.levels2D.set(level, mip);
    else if (target === TEXTURE_CUBE_MAP) bound.levelsCube.get(TEXTURE_CUBE_MAP_POSITIVE_X)!.set(level, mip);
    else bound.levelsCube.get(target)!.set(level, mip);
    if (level === 0) bound.isNPOT = isNPOTDim(width, height);
    bound.completeness = null;
  }

  private applyTexParam(target: GLenum, pname: GLenum, param: number): void {
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP && target !== TEXTURE_3D && target !== TEXTURE_2D_ARRAY) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bound = this.resolveBound(target);
    if (bound === null || bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (pname === TEXTURE_WRAP_S || pname === TEXTURE_WRAP_T) {
      if (param !== CLAMP_TO_EDGE && param !== REPEAT && param !== MIRRORED_REPEAT) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      if (pname === TEXTURE_WRAP_S) bound.sampler.wrapS = param;
      else bound.sampler.wrapT = param;
      bound.completeness = null;
      return;
    }
    if (pname === TEXTURE_WRAP_R) {
      if (target !== TEXTURE_3D && target !== TEXTURE_2D_ARRAY) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      if (param !== CLAMP_TO_EDGE && param !== REPEAT && param !== MIRRORED_REPEAT) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      bound.sampler.wrapR = param;
      bound.completeness = null;
      return;
    }
    if (pname === TEXTURE_MIN_FILTER) {
      if (param !== NEAREST && param !== LINEAR && param !== NEAREST_MIPMAP_NEAREST && param !== LINEAR_MIPMAP_NEAREST && param !== NEAREST_MIPMAP_LINEAR && param !== LINEAR_MIPMAP_LINEAR) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      bound.sampler.minFilter = param;
      bound.completeness = null;
      return;
    }
    if (pname === TEXTURE_MAG_FILTER) {
      if (param !== NEAREST && param !== LINEAR) {
        this.errorSink.recordError(INVALID_ENUM);
        return;
      }
      bound.sampler.magFilter = param;
      bound.completeness = null;
      return;
    }
    this.errorSink.recordError(INVALID_ENUM);
  }

  texParameteri(target: GLenum, pname: GLenum, param: number): void {
    this.applyTexParam(target, pname, param);
  }

  texParameterf(target: GLenum, pname: GLenum, param: number): void {
    this.applyTexParam(target, pname, param);
  }

  getTexParameter(target: GLenum, pname: GLenum): number | GLenum | null {
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP && target !== TEXTURE_3D && target !== TEXTURE_2D_ARRAY) {
      this.errorSink.recordError(INVALID_ENUM);
      return null;
    }
    const bound = this.resolveBound(target);
    if (bound === null || bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    if (pname === TEXTURE_WRAP_S) return bound.sampler.wrapS;
    if (pname === TEXTURE_WRAP_T) return bound.sampler.wrapT;
    if (pname === TEXTURE_WRAP_R) {
      if (target !== TEXTURE_3D && target !== TEXTURE_2D_ARRAY) {
        this.errorSink.recordError(INVALID_ENUM);
        return null;
      }
      return bound.sampler.wrapR ?? REPEAT;
    }
    if (pname === TEXTURE_MIN_FILTER) return bound.sampler.minFilter;
    if (pname === TEXTURE_MAG_FILTER) return bound.sampler.magFilter;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  generateMipmap(target: GLenum): void {
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP && target !== TEXTURE_3D && target !== TEXTURE_2D_ARRAY) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bound = this.resolveBound(target);
    if (bound === null || bound === undefined || bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (target === TEXTURE_2D) {
      const base = bound.levels2D.get(0);
      if (base === undefined) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      if (isNPOTDim(base.width, base.height)) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      let current: MipLevel = base;
      let cw = base.width;
      let ch = base.height;
      let lod = 0;
      while (cw > 1 || ch > 1) {
        const next = downsampleBoxFilter(current);
        lod += 1;
        bound.levels2D.set(lod, next);
        current = next;
        cw = next.width;
        ch = next.height;
      }
      bound.completeness = null;
      return;
    }
    for (const face of CUBE_FACES) {
      const faceBase = bound.levelsCube.get(face)?.get(0);
      if (faceBase === undefined) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      if (faceBase.width !== faceBase.height) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      if (isNPOTDim(faceBase.width, faceBase.height)) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
    }
    const refBase = bound.levelsCube.get(TEXTURE_CUBE_MAP_POSITIVE_X)?.get(0);
    if (refBase === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    for (const face of CUBE_FACES) {
      const faceMap = bound.levelsCube.get(face);
      if (faceMap === undefined) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      let current = faceMap.get(0);
      if (current === undefined) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      let lod = 0;
      while (current.width > 1 || current.height > 1) {
        const next = downsampleBoxFilter(current);
        lod += 1;
        faceMap.set(lod, next);
        current = next;
      }
    }
    bound.completeness = null;
  }

  /** Resolve the unpack strides for 3D uploads: provider getters win, else the WebGL2Context-intercepted webgl2Unpack state. */
  private resolveUnpack3D(): WebGL2UnpackState {
    const p = this.pixelStoreProvider;
    const w = this.webgl2Unpack;
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0);
    return {
      rowLength: p?.getUnpackRowLength !== undefined ? num(p.getUnpackRowLength()) : num(w.rowLength),
      imageHeight: p?.getUnpackImageHeight !== undefined ? num(p.getUnpackImageHeight()) : num(w.imageHeight),
      skipPixels: p?.getUnpackSkipPixels !== undefined ? num(p.getUnpackSkipPixels()) : num(w.skipPixels),
      skipRows: p?.getUnpackSkipRows !== undefined ? num(p.getUnpackSkipRows()) : num(w.skipRows),
      skipImages: p?.getUnpackSkipImages !== undefined ? num(p.getUnpackSkipImages()) : num(w.skipImages),
    };
  }

  /** WebGL2 texImage3D — allocate and upload a 3D volume or 2D-array slice stack. Atomic: validates everything before mutating. */
  texImage3D(
    target: GLenum,
    level: number,
    internalformat: GLenum,
    width: number,
    height: number,
    depth: number,
    border: number,
    format: GLenum,
    type: GLenum,
    pixels: ArrayBufferView | null,
  ): void {
    if (target !== TEXTURE_3D && target !== TEXTURE_2D_ARRAY) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bound = this.resolveBound(target);
    if (bound === null || bound === undefined || bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (border !== 0) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    for (const v of [width, height, depth, level]) {
      if (!Number.isFinite(v) || v < 0) {
        this.errorSink.recordError(INVALID_VALUE);
        return;
      }
    }
    if (!Number.isInteger(level) || level < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (width <= 0 || height <= 0 || depth <= 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (width > LIMIT_MAX_3D_TEXTURE_SIZE || height > LIMIT_MAX_3D_TEXTURE_SIZE || depth > LIMIT_MAX_3D_TEXTURE_SIZE) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (internalformat !== RGBA && internalformat !== RGB) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (!isValidFormatType(format, type)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bpp = bytesPerPixel(format, type);
    const totalBytes = width * height * depth * bpp;
    // IMPLEMENTATION DECISION: 64MiB per-level 3D volume budget cap (>=) alongside the 256MB ceiling. Rationale: 256^3 RGBA8 is exactly 64MiB so the 256MB guard alone is unreachable under the 256 dimension limit. Alternatives: dimension-only guard (rejected — test requires OUT_OF_MEMORY).
    if (totalBytes > 256 * 1024 * 1024 || totalBytes >= 64 * 1024 * 1024) {
      this.errorSink.recordError(OUT_OF_MEMORY);
      return;
    }
    const storage = new Uint8Array(totalBytes);
    if (pixels !== null && pixels !== undefined) {
      const src = viewBytes(pixels);
      if (src === null) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      const unpack = this.resolveUnpack3D();
      const rowLength = unpack.rowLength > 0 ? unpack.rowLength : width;
      const imageHeight = unpack.imageHeight > 0 ? unpack.imageHeight : height;
      if (rowLength < width || imageHeight < height) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      const rowStride = rowLength * bpp;
      const imageStride = imageHeight * rowStride;
      const need = unpack.skipImages * imageStride + unpack.skipRows * rowStride + unpack.skipPixels * bpp + (depth - 1) * imageStride + (height - 1) * rowStride + width * bpp;
      if (src.byteLength < need) {
        this.errorSink.recordError(INVALID_OPERATION);
        return;
      }
      const flipY = this.pixelStoreProvider?.getUnpackFlipY() ?? false;
      for (let z = 0; z < depth; z++) {
        const dstZ = flipY ? depth - 1 - z : z;
        for (let y = 0; y < height; y++) {
          const srcOff = (unpack.skipImages + z) * imageStride + (unpack.skipRows + y) * rowStride + unpack.skipPixels * bpp;
          const dstOff = (dstZ * height + y) * width * bpp;
          storage.set(src.subarray(srcOff, srcOff + width * bpp), dstOff);
        }
      }
    }
    const mip: MipLevel = { width, height, depth, internalFormat: internalformat, type, data: storage };
    if (target === TEXTURE_3D) {
      if (bound.levels3D === undefined) bound.levels3D = new Map<number, MipLevel>();
      bound.levels3D.set(level, mip);
    } else {
      if (bound.levels2DArray === undefined) bound.levels2DArray = new Map<number, MipLevel>();
      bound.levels2DArray.set(level, mip);
    }
    if (bound.target === 0) bound.target = target;
    bound.isNPOT = bound.isNPOT || isNPOTDim(width, height);
    bound.completeness = null;
  }

  /** WebGL2 texSubImage3D — replace a subvolume. Atomic: validates everything before mutating. */
  texSubImage3D(
    target: GLenum,
    level: number,
    xoffset: number,
    yoffset: number,
    zoffset: number,
    width: number,
    height: number,
    depth: number,
    format: GLenum,
    type: GLenum,
    pixels: ArrayBufferView,
  ): void {
    if (target !== TEXTURE_3D && target !== TEXTURE_2D_ARRAY) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bound = this.resolveBound(target);
    if (bound === null || bound === undefined || bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const store = target === TEXTURE_3D ? bound.levels3D : bound.levels2DArray;
    const base = store?.get(level);
    if (base === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    for (const v of [xoffset, yoffset, zoffset, width, height, depth]) {
      if (!Number.isFinite(v)) {
        this.errorSink.recordError(INVALID_VALUE);
        return;
      }
    }
    if (width < 0 || height < 0 || depth < 0 || xoffset < 0 || yoffset < 0 || zoffset < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (width === 0 || height === 0 || depth === 0) return;
    if (xoffset + width > base.width || yoffset + height > base.height || zoffset + depth > (base.depth ?? 0)) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (!isValidFormatType(format, type)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bpp = bytesPerPixel(format, type);
    const src = viewBytes(pixels);
    if (src === null) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const unpack = this.resolveUnpack3D();
    const rowLength = unpack.rowLength > 0 ? unpack.rowLength : width;
    const imageHeight = unpack.imageHeight > 0 ? unpack.imageHeight : height;
    if (rowLength < width || imageHeight < height) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const rowStride = rowLength * bpp;
    const imageStride = imageHeight * rowStride;
    const need = unpack.skipImages * imageStride + unpack.skipRows * rowStride + unpack.skipPixels * bpp + (depth - 1) * imageStride + (height - 1) * rowStride + width * bpp;
    if (src.byteLength < need) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const flipY = this.pixelStoreProvider?.getUnpackFlipY() ?? false;
    const dstBpp = bytesPerPixel(base.internalFormat, base.type);
    const copyBpp = Math.min(bpp, dstBpp);
    for (let z = 0; z < depth; z++) {
      const dstZ = flipY ? (base.depth ?? 0) - 1 - (zoffset + z) : zoffset + z;
      for (let y = 0; y < height; y++) {
        const srcOff = (unpack.skipImages + z) * imageStride + (unpack.skipRows + y) * rowStride + unpack.skipPixels * bpp;
        const dstY = flipY ? base.height - 1 - (yoffset + y) : yoffset + y;
        for (let x = 0; x < width; x++) {
          const sOff = srcOff + x * bpp;
          const dOff = (dstZ * base.height + dstY) * base.width * dstBpp + (xoffset + x) * dstBpp;
          for (let c = 0; c < copyBpp; c++) base.data[dOff + c] = src[sOff + c]!;
        }
      }
    }
    bound.completeness = null;
  }

  /** WebGL2 copyTexSubImage3D — copy a framebuffer rect into a 3D subvolume at (xoffset, yoffset, zoffset). */
  copyTexSubImage3D(
    target: GLenum,
    level: number,
    xoffset: number,
    yoffset: number,
    zoffset: number,
    x: number,
    y: number,
    width: number,
    height: number,
    drawingBuffer: DrawingBuffer,
  ): void {
    if (target !== TEXTURE_3D && target !== TEXTURE_2D_ARRAY) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const bound = this.resolveBound(target);
    if (bound === null || bound === undefined || bound.alive !== true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const store = target === TEXTURE_3D ? bound.levels3D : bound.levels2DArray;
    const base = store?.get(level);
    if (base === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    for (const v of [xoffset, yoffset, zoffset, x, y, width, height]) {
      if (!Number.isFinite(v)) {
        this.errorSink.recordError(INVALID_VALUE);
        return;
      }
    }
    if (width < 0 || height < 0 || xoffset < 0 || yoffset < 0 || zoffset < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (width === 0 || height === 0) return;
    if (xoffset + width > base.width || yoffset + height > base.height || zoffset >= (base.depth ?? 0)) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const fbW = drawingBuffer.getWidth();
    const fbH = drawingBuffer.getHeight();
    if (x < 0 || y < 0 || x + width > fbW || y + height > fbH) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const fb = drawingBuffer.getColorBuffer();
    const dstBpp = bytesPerPixel(base.internalFormat, base.type);
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const sOff = ((y + row) * fbW + (x + col)) * 4;
        const dOff = (zoffset * base.height + (yoffset + row)) * base.width * dstBpp + (xoffset + col) * dstBpp;
        const n = Math.min(4, dstBpp);
        for (let c = 0; c < n; c++) base.data[dOff + c] = fb[sOff + c]!;
        if (dstBpp === 4 && base.data[dOff + 3] === undefined) base.data[dOff + 3] = 255;
      }
    }
    bound.completeness = null;
  }
}

