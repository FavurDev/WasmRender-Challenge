/**
 * @fileoverview Renderbuffer object store: DEPTH_COMPONENT16 and DEPTH24_STENCIL8 backing.
 */
// CHANGELOG:
// - Sprint 5: Created RenderbufferStore with monotonic handles and typed-array backing.
import { DEPTH24_STENCIL8, DEPTH_COMPONENT16, MAX_RENDERBUFFER_SIZE, RENDERBUFFER } from "./gl-constants";
import { InvalidEnumError, InvalidOperationError, InvalidValueError, OutOfMemoryError } from "./errors";

interface RenderbufferObject {
  handle: number;
  internalFormat: number;
  width: number;
  height: number;
  depth16: Uint16Array | null;
  packed: Uint32Array | null;
  depthView: Float32Array | null;
  stencil: Uint8Array | null;
}

/**
 * Independent renderbuffer object store owning handle table and bound target.
 */
export class RenderbufferStore {
  private records = new Map<number, RenderbufferObject>();
  private live = new Set<number>();
  private nextHandle = 1;
  private boundHandle = 0;

  /**
   * Allocate a fresh never-reused handle with empty storage.
   * @returns Fresh non-zero handle.
   */
  createRenderbuffer(): number {
    const h = this.nextHandle;
    this.records.set(h, { handle: h, internalFormat: 0, width: 0, height: 0, depth16: null, packed: null, depthView: null, stencil: null });
    this.live.add(h);
    this.nextHandle += 1;
    return h;
  }

  /**
   * Bind a live handle or unbind on the RENDERBUFFER target.
   * @param target Must equal RENDERBUFFER.
   * @param handle Handle to bind, or 0/null to unbind.
   * @throws InvalidEnumError For non-RENDERBUFFER target.
   * @throws InvalidOperationError For unknown nonzero handle.
   */
  bindRenderbuffer(target: number, handle: number | null): void {
    if (target !== RENDERBUFFER) throw new InvalidEnumError("bindRenderbuffer: bad target");
    if (handle === null || handle === 0) { this.boundHandle = 0; return; }
    if (!this.live.has(handle)) throw new InvalidOperationError(`bindRenderbuffer: unknown handle ${String(handle)}`);
    this.boundHandle = handle;
  }

  /**
   * Allocate typed-array storage for the bound renderbuffer.
   * @param target Must equal RENDERBUFFER.
   * @param internalFormat DEPTH_COMPONENT16 or DEPTH24_STENCIL8.
   * @param width Positive integer within MAX_RENDERBUFFER_SIZE.
   * @param height Positive integer within MAX_RENDERBUFFER_SIZE.
   * @throws InvalidEnumError For bad target or format.
   * @throws InvalidValueError For bad dimensions.
   * @throws InvalidOperationError When nothing is bound.
   * @throws OutOfMemoryError When dims exceed the cap; prior backing intact.
   */
  renderbufferStorage(target: number, internalFormat: number, width: number, height: number): void {
    if (target !== RENDERBUFFER) throw new InvalidEnumError("renderbufferStorage: bad target");
    if (internalFormat !== DEPTH_COMPONENT16 && internalFormat !== DEPTH24_STENCIL8) {
      throw new InvalidEnumError("renderbufferStorage: bad format");
    }
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
      throw new InvalidValueError("renderbufferStorage: bad dimensions");
    }
    const rec = this.records.get(this.boundHandle);
    if (this.boundHandle === 0 || rec === undefined || !this.live.has(this.boundHandle)) {
      throw new InvalidOperationError("renderbufferStorage: nothing bound");
    }
    if (width > MAX_RENDERBUFFER_SIZE || height > MAX_RENDERBUFFER_SIZE) {
      throw new OutOfMemoryError("renderbufferStorage: exceeds MAX_RENDERBUFFER_SIZE");
    }
    // IMPLEMENTATION DECISION: guard-then-swap, fresh backing first. Rationale: rejected request keeps prior backing. Alternatives: in-place resize (risks partial state).
    const n = width * height;
    if (internalFormat === DEPTH_COMPONENT16) {
      const fresh = new Uint16Array(n);
      fresh.fill(0xffff);
      rec.depth16 = fresh;
      rec.packed = null;
      rec.depthView = null;
      rec.stencil = null;
    } else {
      const packed = new Uint32Array(n);
      const depthView = new Float32Array(n);
      const stencil = new Uint8Array(n);
      for (let i = 0; i < n; i++) { packed[i] = 0xffffff00; depthView[i] = 1.0; stencil[i] = 0; }
      rec.packed = packed;
      rec.depthView = depthView;
      rec.stencil = stencil;
      rec.depth16 = null;
    }
    rec.internalFormat = internalFormat;
    rec.width = width;
    rec.height = height;
  }

  /**
   * Release a handle permanently; silent no-op for unknown values.
   * @param handle Handle to release.
   */
  deleteRenderbuffer(handle: number): void {
    if (!this.live.has(handle)) return;
    this.live.delete(handle);
    this.records.delete(handle);
    if (this.boundHandle === handle) this.boundHandle = 0;
    // Counter never decrements and released values are never reissued; advance
    // past the released value so a subsequent create skips it deterministically.
    this.nextHandle += 1;
  }

  /**
   * Check handle liveness.
   * @param handle Handle value.
   * @returns True only when live.
   */
  isLiveHandle(handle: number): boolean {
    return this.live.has(handle);
  }

  /**
   * Read normalized depth at a texel; null when unavailable.
   * @param handle Live handle with allocated storage.
   * @param x Column in range.
   * @param y Row in range.
   * @returns Depth in 0..1 or null.
   */
  readDepth(handle: number, x: number, y: number): number | null {
    const rec = this.records.get(handle);
    if (rec === undefined || !this.live.has(handle)) return null;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= rec.width || y >= rec.height) return null;
    const idx = y * rec.width + x;
    if (rec.internalFormat === DEPTH_COMPONENT16 && rec.depth16 !== null) {
      return (rec.depth16[idx] as number) / 65535;
    }
    if (rec.internalFormat === DEPTH24_STENCIL8 && rec.packed !== null) {
      const depth24 = ((rec.packed[idx] as number) >>> 8) & 0xffffff;
      return depth24 / 16777215;
    }
    return null;
  }

  /**
   * LESS-conditional depth write for tests: keeps nearer (smaller) value.
   * @param handle Live handle with allocated storage.
   * @param x Column in range.
   * @param y Row in range.
   * @param depth Normalized depth in 0..1.
   */
  writeDepthForTest(handle: number, x: number, y: number, depth: number): void {
    const rec = this.records.get(handle);
    if (rec === undefined || !this.live.has(handle)) return;
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= rec.width || y >= rec.height) return;
    if (typeof depth !== "number" || Number.isNaN(depth)) return;
    const d = Math.max(0, Math.min(1, depth));
    const idx = y * rec.width + x;
    const cur = this.readDepth(handle, x, y);
    if (cur !== null && !(d < cur)) return;
    if (rec.internalFormat === DEPTH_COMPONENT16 && rec.depth16 !== null) {
      rec.depth16[idx] = Math.round(d * 65535);
      return;
    }
    if (rec.internalFormat === DEPTH24_STENCIL8 && rec.packed !== null && rec.depthView !== null) {
      const depth24 = Math.round(d * 16777215);
      const st = (rec.packed[idx] as number) & 0xff;
      rec.packed[idx] = ((depth24 & 0xffffff) << 8) | st;
      rec.depthView[idx] = d;
    }
  }
}
