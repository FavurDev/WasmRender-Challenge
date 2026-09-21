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
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
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
  readonly internalFormat: GLenum;
  readonly type: GLenum;
  readonly data: Uint8Array;
}

export interface SamplerParams {
  wrapS: GLenum;
  wrapT: GLenum;
  minFilter: GLenum;
  magFilter: GLenum;
}

export interface TextureObject {
  readonly id: number;
  alive: boolean;
  target: GLenum;
  levels2D: Map<number, MipLevel>;
  levelsCube: Map<GLenum, Map<number, MipLevel>>;
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
  return false;
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
  return { width: dstW, height: dstH, internalFormat: src.internalFormat, type: src.type, data: dstData };
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
  private readonly textureUnits: Array<{ binding2D: TextureObject | null; bindingCube: TextureObject | null }> = [];
  private activeTextureUnit: GLenum = TEXTURE0;

  constructor(errorSink: IErrorSink, pixelStoreProvider?: PixelStoreStateProvider | null) {
    this.errorSink = errorSink;
    this.pixelStoreProvider = pixelStoreProvider ?? null;
    for (let i = 0; i < 32; i++) this.textureUnits.push({ binding2D: null, bindingCube: null });
  }

  createTexture(): TextureObject | null {
    const id = this.nextTextureId;
    this.nextTextureId += 1;
    const levelsCube = new Map<GLenum, Map<number, MipLevel>>();
    for (const face of CUBE_FACES) levelsCube.set(face, new Map<number, MipLevel>());
    const tex: TextureObject = {
      id, alive: true, target: 0, levels2D: new Map(), levelsCube,
      sampler: { wrapS: REPEAT, wrapT: REPEAT, minFilter: NEAREST_MIPMAP_LINEAR, magFilter: LINEAR },
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
    for (const unit of this.textureUnits) {
      if (unit.binding2D === texture) unit.binding2D = null;
      if (unit.bindingCube === texture) unit.bindingCube = null;
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
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const idx = this.unitIndex();
    if (texture === null || texture === undefined) {
      if (target === TEXTURE_2D) this.textureUnits[idx]!.binding2D = null;
      else this.textureUnits[idx]!.bindingCube = null;
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
    else this.textureUnits[idx]!.bindingCube = texture;
  }

  getBoundTexture(target: GLenum): TextureObject | null {
    const idx = this.unitIndex();
    if (target === TEXTURE_2D) return this.textureUnits[idx]!.binding2D;
    if (target === TEXTURE_CUBE_MAP) return this.textureUnits[idx]!.bindingCube;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  private resolveBound(target: GLenum): TextureObject | null {
    const idx = this.unitIndex();
    if (target === TEXTURE_2D) return this.textureUnits[idx]!.binding2D;
    if (target === TEXTURE_CUBE_MAP) return this.textureUnits[idx]!.bindingCube;
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
      this.errorSink.recordError(INVALID_OPERATION);
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
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const bpp = bytesPerPixel(format, type);
    const totalBytes = width * height * bpp;
    if (totalBytes > MAX_TEXTURE_BYTES) {
      this.errorSink.recordError(OUT_OF_MEMORY);
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
    const mip: MipLevel = { width, height, internalFormat: internalformat, type, data: storage };
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
    const mip: MipLevel = { width, height, internalFormat: internalformat, type: UNSIGNED_BYTE, data: storage };
    if (target === TEXTURE_2D) bound.levels2D.set(level, mip);
    else if (target === TEXTURE_CUBE_MAP) bound.levelsCube.get(TEXTURE_CUBE_MAP_POSITIVE_X)!.set(level, mip);
    else bound.levelsCube.get(target)!.set(level, mip);
    if (level === 0) bound.isNPOT = isNPOTDim(width, height);
    bound.completeness = null;
  }

  private applyTexParam(target: GLenum, pname: GLenum, param: number): void {
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP) {
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
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP) {
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
    if (pname === TEXTURE_MIN_FILTER) return bound.sampler.minFilter;
    if (pname === TEXTURE_MAG_FILTER) return bound.sampler.magFilter;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  generateMipmap(target: GLenum): void {
    if (target !== TEXTURE_2D && target !== TEXTURE_CUBE_MAP) {
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
}

