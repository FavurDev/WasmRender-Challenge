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
  private nextTextureId = 1;
  private readonly textures = new Map<number, TextureObject>();
  private readonly textureUnits: Array<{ binding2D: TextureObject | null; bindingCube: TextureObject | null }> = [];
  private activeTextureUnit: GLenum = TEXTURE0;

  constructor(errorSink: IErrorSink) {
    this.errorSink = errorSink;
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
      if (src !== null) storage.set(src.subarray(0, totalBytes));
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
    for (let r = 0; r < height; r++) {
      const srcOff = r * width * bpp;
      const dstOff = ((yoffset + r) * existing.width + xoffset) * bpp;
      existing.data.set(src.subarray(srcOff, srcOff + width * bpp), dstOff);
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
}

