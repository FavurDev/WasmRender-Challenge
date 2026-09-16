/**
 * @fileoverview BufferStore owning buffer lifecycle and vertex attribute decoding.
 */
import { ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, FLOAT, INVALID_ENUM, INVALID_VALUE, MAX_VERTEX_ATTRIBS } from "./gl-constants";

interface AttribSlot {
  size: number;
  type: number;
  normalized: boolean;
  stride: number;
  offset: number;
  snapshot: number;
  hasSnapshot: boolean;
}

/**
 * Owned buffer records, binding points, and attribute pointer state.
 */
export class BufferStore {
  private nextHandle = 1;
  private liveHandles = new Set<number>();
  private buffers = new Map<number, { bytes: Uint8Array; usage: number }>();
  private boundArrayBuffer = 0;
  private boundElementArrayBuffer = 0;
  private attribPointers: AttribSlot[] = [];
  private attribEnabled: boolean[] = [];

  constructor() {
    for (let i = 0; i < MAX_VERTEX_ATTRIBS; i++) {
      this.attribPointers.push({ size: 4, type: FLOAT, normalized: false, stride: 16, offset: 0, snapshot: 0, hasSnapshot: false });
      this.attribEnabled.push(false);
    }
  }

  /** Issue a fresh never-reused handle. @returns Fresh handle. */
  createBuffer(): number {
    const h = this.nextHandle;
    this.liveHandles.add(h);
    this.buffers.set(h, { bytes: new Uint8Array(0), usage: 0 });
    this.nextHandle += 1;
    return h;
  }

  /**
   * Bind live buffer or unbind to a target.
   * @param target Bind target enum. @param buffer Handle, null, or 0.
   * @returns Error code or null on success.
   */
  bindBuffer(target: number, buffer: number | null): number | null {
    if (target !== ARRAY_BUFFER && target !== ELEMENT_ARRAY_BUFFER) return INVALID_ENUM;
    if (buffer === null || buffer === 0) {
      if (target === ARRAY_BUFFER) this.boundArrayBuffer = 0;
      else this.boundElementArrayBuffer = 0;
      return null;
    }
    if (!this.liveHandles.has(buffer)) {
      if (target === ARRAY_BUFFER) this.boundArrayBuffer = 0;
      else this.boundElementArrayBuffer = 0;
      return null;
    }
    if (target === ARRAY_BUFFER) this.boundArrayBuffer = buffer;
    else this.boundElementArrayBuffer = buffer;
    return null;
  }

  /**
   * Copy source view bytes into bound buffer.
   * @param target Bind target. @param data Source view bytes. @param usage Usage hint.
   * @returns Error code or null on success.
   */
  bufferData(target: number, data: ArrayBufferView, usage: number): number | null {
    if (target !== ARRAY_BUFFER && target !== ELEMENT_ARRAY_BUFFER) return INVALID_ENUM;
    const bound = target === ARRAY_BUFFER ? this.boundArrayBuffer : this.boundElementArrayBuffer;
    if (bound === 0) return INVALID_VALUE;
    const src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const copy = new Uint8Array(src.length);
    for (let i = 0; i < src.length; i++) copy[i] = src[i]!;
    this.buffers.set(bound, { bytes: copy, usage });
    return null;
  }

  /**
   * Release handle, clear bindings and snapshots referencing it.
   * @param buffer Handle to release.
   */
  deleteBuffer(buffer: number): void {
    if (!this.liveHandles.has(buffer)) return;
    this.liveHandles.delete(buffer);
    this.buffers.delete(buffer);
    if (this.boundArrayBuffer === buffer) this.boundArrayBuffer = 0;
    if (this.boundElementArrayBuffer === buffer) this.boundElementArrayBuffer = 0;
    for (const slot of this.attribPointers) {
      if (slot.hasSnapshot && slot.snapshot === buffer) {
        slot.hasSnapshot = false;
        slot.snapshot = 0;
      }
    }
  }

  /**
   * Record per-attribute fetch description.
   *
   * @param index Attribute slot ordinal.
   * @param size Components per vertex.
   * @param type Component enum, FLOAT only.
   * @param normalized Normalization flag.
   * @param stride Byte stride, zero means tightly packed.
   * @param offset Byte offset into bound data.
   * @returns Error code or null on success.
   */
  vertexAttribPointer(index: number, size: number, type: number, normalized: boolean, stride: number, offset: number): number | null {
    if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) return INVALID_VALUE;
    if (type !== FLOAT) return INVALID_ENUM;
    if (!Number.isInteger(size) || size < 1 || size > 4) return INVALID_VALUE;
    if (!Number.isInteger(stride) || stride < 0) return INVALID_VALUE;
    if (!Number.isInteger(offset) || offset < 0) return INVALID_VALUE;
    if (typeof normalized !== "boolean") return INVALID_VALUE;
    const effectiveStride = stride === 0 ? size * 4 : stride;
    const slot = this.attribPointers[index]!;
    slot.size = size;
    slot.type = type;
    slot.normalized = normalized;
    slot.stride = effectiveStride;
    slot.offset = offset;
    slot.snapshot = this.boundArrayBuffer;
    slot.hasSnapshot = this.boundArrayBuffer !== 0;
    return null;
  }

  /**
   * Enable attribute array. @param index Attribute index. @returns Error code or null.
   */
  enableVertexAttribArray(index: number): number | null {
    if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) return INVALID_VALUE;
    this.attribEnabled[index] = true;
    return null;
  }

  /**
   * Disable attribute array. @param index Attribute index. @returns Error code or null.
   */
  disableVertexAttribArray(index: number): number | null {
    if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) return INVALID_VALUE;
    this.attribEnabled[index] = false;
    return null;
  }

  /**
   * Fetch one decoded vertex through stride/offset math.
   * @param index Attribute index. @param vertexIndex Vertex ordinal.
   * @returns Component list or null when unavailable.
   */
  decodeAttribute(index: number, vertexIndex: number): number[] | null {
    if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) return null;
    const slot = this.attribPointers[index]!;
    if (!slot.hasSnapshot || slot.snapshot === 0) return null;
    if (!this.liveHandles.has(slot.snapshot)) return null;
    const rec = this.buffers.get(slot.snapshot);
    if (!rec) return null;
    const laneBase = slot.offset + vertexIndex * slot.stride;
    const view = new DataView(rec.bytes.buffer, rec.bytes.byteOffset, rec.bytes.byteLength);
    const out: number[] = [];
    for (let k = 0; k < slot.size; k++) {
      const addr = laneBase + k * 4;
      if (addr + 4 > rec.bytes.length) return null;
      out.push(view.getFloat32(addr, true));
    }
    return out;
  }

  /**
   * Resolve bound handle for target.
   * @param target Bind target. @returns Bound handle or 0.
   */
  getBoundBuffer(target: number): number {
    if (target === ARRAY_BUFFER) return this.boundArrayBuffer;
    if (target === ELEMENT_ARRAY_BUFFER) return this.boundElementArrayBuffer;
    return 0;
  }

  /**
   * Check handle liveness. @param handle Handle value. @returns True when live.
   */
  isLiveHandle(handle: number): boolean {
    return this.liveHandles.has(handle);
  }
}
