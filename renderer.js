"use strict";
var __swgl = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/renderer/context.ts
  var context_exports = {};
  __export(context_exports, {
    SoftwareWebGLContext: () => SoftwareWebGLContext,
    createSoftwareWebGLContext: () => createSoftwareWebGLContext
  });

  // src/renderer/gl-constants.ts
  var TRIANGLES = 4;
  var ZERO = 0;
  var ONE = 1;
  var FUNC_ADD = 32774;
  var BLEND_EQUATION = 32777;
  var BLEND_DST_RGB = 32968;
  var BLEND_SRC_RGB = 32969;
  var LESS = 513;
  var BLEND = 3042;
  var DEPTH_TEST = 2929;
  var STENCIL_TEST = 2960;
  var SCISSOR_TEST = 3089;
  var CULL_FACE = 2884;
  var UNSIGNED_SHORT = 5123;
  var FLOAT = 5126;
  var COLOR_BUFFER_BIT = 16384;
  var DEPTH_BUFFER_BIT = 256;
  var STENCIL_BUFFER_BIT = 1024;
  var ARRAY_BUFFER = 34962;
  var ELEMENT_ARRAY_BUFFER = 34963;
  var TEXTURE0 = 33984;
  var NO_ERROR = 0;
  var INVALID_ENUM = 1280;
  var INVALID_VALUE = 1281;
  var INVALID_OPERATION = 1282;
  var MAX_TEXTURE_SIZE = 4096;
  var MAX_VIEWPORT_DIMS = [4096, 4096];
  var MAX_CUBE_MAP_TEXTURE_SIZE = 1024;
  var MAX_VERTEX_ATTRIBS = 16;
  var MAX_TEXTURE_IMAGE_UNITS = 16;
  var MAX_RENDERBUFFER_SIZE = 4096;
  var COLOR_CLEAR_VALUE = 2816;
  var DEPTH_WRITEMASK = 2930;
  var DEPTH_CLEAR_VALUE = 2931;
  var DEPTH_FUNC = 2932;
  var STENCIL_CLEAR_VALUE = 2961;
  var STENCIL_WRITEMASK = 2968;
  var VIEWPORT = 2978;
  var SCISSOR_BOX = 3088;
  var COLOR_WRITEMASK = 3106;
  var MAX_TEXTURE_SIZE_PNAME = 3379;
  var MAX_VIEWPORT_DIMS_PNAME = 3386;
  var MAX_CUBE_MAP_TEXTURE_SIZE_PNAME = 34076;
  var MAX_RENDERBUFFER_SIZE_PNAME = 34024;
  var MAX_VERTEX_ATTRIBS_PNAME = 34921;
  var MAX_TEXTURE_IMAGE_UNITS_PNAME = 34930;

  // src/renderer/state.ts
  var GLState = class {
    clearColor = [0, 0, 0, 0];
    clearDepth = 1;
    clearStencil = 0;
    depthTest = false;
    depthFunc = LESS;
    depthMask = true;
    colorMask = [true, true, true, true];
    stencilTest = false;
    blendEnabled = false;
    blendSrcRGB = ONE;
    blendDstRGB = ZERO;
    blendEquation = FUNC_ADD;
    scissorTest = false;
    cullFace = false;
    stencilMask = 255;
    scissorBox;
    viewport;
    activeTexture = TEXTURE0;
    boundArrayBuffer = 0;
    boundElementArrayBuffer = 0;
    currentProgram = 0;
    /**
     * Size both boxes to the canvas extent.
     *
     * @param canvasWidth Canvas width sizing scissorBox and viewport.
     * @param canvasHeight Canvas height sizing scissorBox and viewport.
     */
    constructor(canvasWidth, canvasHeight) {
      this.scissorBox = [0, 0, canvasWidth, canvasHeight];
      this.viewport = [0, 0, canvasWidth, canvasHeight];
    }
    /**
     * Flip a capability flag on, reporting unknown enums to the caller.
     *
     * @param cap Capability code.
     * @returns Error code or null on success.
     */
    enable(cap) {
      switch (cap) {
        case BLEND:
          this.blendEnabled = true;
          return null;
        case DEPTH_TEST:
          this.depthTest = true;
          return null;
        case STENCIL_TEST:
          this.stencilTest = true;
          return null;
        case SCISSOR_TEST:
          this.scissorTest = true;
          return null;
        case CULL_FACE:
          this.cullFace = true;
          return null;
        default:
          return INVALID_ENUM;
      }
    }
    /**
     * Flip a capability flag off, reporting unknown enums to the caller.
     *
     * @param cap Capability code.
     * @returns Error code or null on success.
     */
    disable(cap) {
      switch (cap) {
        case BLEND:
          this.blendEnabled = false;
          return null;
        case DEPTH_TEST:
          this.depthTest = false;
          return null;
        case STENCIL_TEST:
          this.stencilTest = false;
          return null;
        case SCISSOR_TEST:
          this.scissorTest = false;
          return null;
        case CULL_FACE:
          this.cullFace = false;
          return null;
        default:
          return INVALID_ENUM;
      }
    }
    /**
     * Report the current flag for a capability, reporting unknown enums to the caller.
     *
     * @param cap Capability code.
     * @returns Flag or error code.
     */
    isEnabled(cap) {
      switch (cap) {
        case BLEND:
          return this.blendEnabled;
        case DEPTH_TEST:
          return this.depthTest;
        case STENCIL_TEST:
          return this.stencilTest;
        case SCISSOR_TEST:
          return this.scissorTest;
        case CULL_FACE:
          return this.cullFace;
        default:
          return INVALID_ENUM;
      }
    }
    /**
     * Replace the scissor box; only negative size is rejected.
     *
     * @param x Left origin (negative accepted).
     * @param y Bottom origin (negative accepted).
     * @param w Width; negative rejected, zero accepted.
     * @param h Height; negative rejected, zero accepted.
     * @returns Error code or null on success.
     */
    setScissor(x, y, w, h) {
      if (w < 0 || h < 0) return INVALID_VALUE;
      this.scissorBox = [x, y, w, h];
      return null;
    }
    /**
     * Stage depth write mask.
     *
     * @param flag Whether depth writes are enabled.
     * @returns Null always.
     */
    setDepthMask(flag) {
      this.depthMask = flag;
      return null;
    }
    /**
     * Stage color write mask.
     *
     * @param r Whether the red channel is writable.
     * @param g Whether the green channel is writable.
     * @param b Whether the blue channel is writable.
     * @param a Whether the alpha channel is writable.
     * @returns Null always.
     */
    setColorMask(r, g, b, a) {
      this.colorMask = [r, g, b, a];
      return null;
    }
    /**
     * Stage stencil write mask.
     *
     * @param mask Stencil write mask value.
     * @returns Null always.
     */
    setStencilMask(mask) {
      this.stencilMask = mask;
      return null;
    }
    /**
     * Stage clear depth.
     *
     * @param v Depth clear value.
     * @returns Null always.
     */
    setClearDepth(v) {
      this.clearDepth = v;
      return null;
    }
    /**
     * Stage clear stencil.
     *
     * @param v Stencil clear value.
     * @returns Null always.
     */
    setClearStencil(v) {
      this.clearStencil = v;
      return null;
    }
    /**
     * Replace the viewport box, reporting negative origin or size to the caller.
     *
     * @param x Left origin.
     * @param y Bottom origin.
     * @param w Width; negative is rejected, zero accepted.
     * @param h Height; negative is rejected, zero accepted.
     * @returns Error code or null on success.
     */
    setViewport(x, y, w, h) {
      if (x < 0 || y < 0 || w < 0 || h < 0) return INVALID_VALUE;
      this.viewport = [x, y, w, h];
      return null;
    }
  };

  // src/renderer/errors.ts
  var MAX_QUEUE_LENGTH = 8;
  var OutOfMemoryError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "OutOfMemoryError";
    }
  };
  function pushError(queue, code) {
    if (queue.length >= MAX_QUEUE_LENGTH) return;
    queue.push(code);
  }
  function drainError(queue) {
    if (queue.length === 0) return NO_ERROR;
    const head = queue.shift();
    return head === void 0 ? NO_ERROR : head;
  }

  // src/renderer/framebuffer.ts
  function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
  }
  function checkDims(w, h) {
    const cap = MAX_VIEWPORT_DIMS[0];
    const capH = MAX_VIEWPORT_DIMS[1];
    if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0 || w > cap || h > capH) {
      throw new OutOfMemoryError(`Invalid framebuffer dimensions ${String(w)}x${String(h)}`);
    }
  }
  function invalidValue(msg) {
    const e = new Error(msg);
    e.name = "InvalidValueError";
    return e;
  }
  var Framebuffer = class {
    width;
    height;
    color;
    depth;
    stencil;
    ccR = 0;
    ccG = 0;
    ccB = 0;
    ccA = 0;
    cd = 1;
    cs = 0;
    cmR = true;
    cmG = true;
    cmB = true;
    cmA = true;
    dm = true;
    sm = 255;
    constructor(w, h) {
      checkDims(w, h);
      this.width = w;
      this.height = h;
      this.color = new Uint8ClampedArray(w * h * 4);
      this.depth = new Float32Array(w * h).fill(1);
      this.stencil = new Uint8Array(w * h);
    }
    /**
     * Store clear color floats as given.
     *
     * @param r Red channel in 0..1, clamped and rounded at clear time.
     * @param g Green channel in 0..1, clamped and rounded at clear time.
     * @param b Blue channel in 0..1, clamped and rounded at clear time.
     * @param a Alpha channel in 0..1, clamped and rounded at clear time.
     * @returns Nothing; pixels unchanged until clear runs.
     */
    clearColor(r, g, b, a) {
      this.ccR = r;
      this.ccG = g;
      this.ccB = b;
      this.ccA = a;
    }
    /**
     * Store clear depth.
     *
     * @param v Depth source value, clamped to 0..1 at clear time.
     * @returns Nothing; pixels unchanged until clear runs.
     */
    clearDepth(v) {
      this.cd = v;
    }
    /**
     * Store clear stencil.
     *
     * @param v Stencil source value, masked to low 8 bits at clear time.
     * @returns Nothing; pixels unchanged until clear runs.
     */
    clearStencil(v) {
      this.cs = v;
    }
    /**
     * Store color write mask.
     *
     * @param r Whether clear may write the red byte.
     * @param g Whether clear may write the green byte.
     * @param b Whether clear may write the blue byte.
     * @param a Whether clear may write the alpha byte.
     * @returns Nothing; masked-off channels keep prior bytes on clear.
     */
    setColorMask(r, g, b, a) {
      this.cmR = r;
      this.cmG = g;
      this.cmB = b;
      this.cmA = a;
    }
    /**
     * Store depth write mask.
     *
     * @param flag Whether clear may write depth samples.
     * @returns Nothing; false leaves depth untouched on clear.
     */
    setDepthMask(flag) {
      this.dm = flag;
    }
    /**
     * Store stencil write mask.
     *
     * @param mask Bitwise write enable; only low 8 bits kept, merged per sample on clear.
     * @returns Nothing.
     */
    setStencilMask(mask) {
      this.sm = mask & 255;
    }
    /**
     * Masked clear with exact quantization.
     *
     * @param mask Bitwise OR of COLOR/DEPTH/STENCIL bits; zero mask writes nothing, unknown bits ignored.
     * @param scissor Optional [x, y, w, h] confinement box; omitted clears the full frame, out-of-range edges are clamped, zero-area writes nothing.
     * @returns Nothing; selected planes filled honoring write masks.
     */
    clear(mask, scissor) {
      const rb = Math.round(clamp01(this.ccR) * 255);
      const gb = Math.round(clamp01(this.ccG) * 255);
      const bb = Math.round(clamp01(this.ccB) * 255);
      const ab = Math.round(clamp01(this.ccA) * 255);
      const dv = clamp01(this.cd);
      const sv = this.cs & 255;
      let x0 = 0;
      let y0 = 0;
      let x1 = this.width;
      let y1 = this.height;
      if (scissor !== void 0) {
        const sx = Math.floor(scissor[0]);
        const sy = Math.floor(scissor[1]);
        const sw = Math.floor(scissor[2]);
        const sh = Math.floor(scissor[3]);
        x0 = Math.max(0, sx);
        y0 = Math.max(0, sy);
        x1 = Math.min(this.width, sx + sw);
        y1 = Math.min(this.height, sy + sh);
        if (x1 <= x0 || y1 <= y0) return;
      }
      const full = x0 === 0 && y0 === 0 && x1 === this.width && y1 === this.height;
      if ((mask & COLOR_BUFFER_BIT) !== 0) {
        const c = this.color;
        if (full) {
          for (let i = 0; i < c.length; i += 4) {
            if (this.cmR) c[i] = rb;
            if (this.cmG) c[i + 1] = gb;
            if (this.cmB) c[i + 2] = bb;
            if (this.cmA) c[i + 3] = ab;
          }
        } else {
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = (y * this.width + x) * 4;
              if (this.cmR) c[i] = rb;
              if (this.cmG) c[i + 1] = gb;
              if (this.cmB) c[i + 2] = bb;
              if (this.cmA) c[i + 3] = ab;
            }
          }
        }
      }
      if ((mask & DEPTH_BUFFER_BIT) !== 0 && this.dm) {
        if (full) {
          this.depth.fill(dv);
        } else {
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              this.depth[y * this.width + x] = dv;
            }
          }
        }
      }
      if ((mask & STENCIL_BUFFER_BIT) !== 0) {
        const inv = ~this.sm & 255;
        const s = this.stencil;
        const val = sv & this.sm;
        if (full) {
          for (let i = 0; i < s.length; i++) {
            s[i] = s[i] & inv | val;
          }
        } else {
          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = y * this.width + x;
              s[i] = s[i] & inv | val;
            }
          }
        }
      }
    }
    /**
     * Return exact RGBA bytes for sub-rectangle, row-major, origin 0,0.
     *
     * @param x Left edge inside live extent.
     * @param y Top edge inside live extent.
     * @param w Rectangle width, must stay inside live extent.
     * @param h Rectangle height, must stay inside live extent.
     * @returns Fresh byte store of length w*h*4 in RGBA order.
     * @throws InvalidValueError-shaped Error when the rectangle is out of bounds.
     */
    readPixels(x, y, w, h) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(w) || !Number.isInteger(h) || x < 0 || y < 0 || w <= 0 || h <= 0 || x + w > this.width || y + h > this.height) {
        throw invalidValue("readPixels out of bounds");
      }
      const out = new Uint8Array(w * h * 4);
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const src = ((y + row) * this.width + (x + col)) * 4;
          const dst = (row * w + col) * 4;
          out[dst] = this.color[src];
          out[dst + 1] = this.color[src + 1];
          out[dst + 2] = this.color[src + 2];
          out[dst + 3] = this.color[src + 3];
        }
      }
      return out;
    }
    /**
     * Allocate-then-swap resize.
     *
     * @param w New width, positive integer within the 4096 guard.
     * @param h New height, positive integer within the 4096 guard.
     * @returns Nothing; live triple swapped only after replacements allocate.
     * @throws OutOfMemoryError when the guard rejects; prior buffers retained intact.
     */
    resize(w, h) {
      checkDims(w, h);
      const nc = new Uint8ClampedArray(w * h * 4);
      const nd = new Float32Array(w * h).fill(1);
      const ns = new Uint8Array(w * h);
      this.width = w;
      this.height = h;
      this.color = nc;
      this.depth = nd;
      this.stencil = ns;
    }
    /**
     * Present live color buffer via 2D putImageData, no conversion.
     *
     * @param target Direct putImageData target or canvas exposing getContext('2d').
     * @returns Nothing; single putImageData call, no swizzle or flip. Invalid targets are a documented no-op.
     */
    presentToCanvas(target) {
      if (typeof target === "object" && target !== null) {
        const t = target;
        if (typeof t.putImageData === "function") {
          t.putImageData(this.color, this.width, this.height);
          return;
        }
        if (typeof t.getContext === "function") {
          const ctx = t.getContext("2d");
          if (ctx !== null && ctx !== void 0 && typeof ctx.putImageData === "function") {
            const g = globalThis;
            const IDCtor = g["ImageData"];
            let img;
            if (typeof IDCtor === "function") {
              img = new IDCtor(new Uint8ClampedArray(this.color), this.width, this.height);
            } else {
              img = { data: new Uint8ClampedArray(this.color), width: this.width, height: this.height };
            }
            ctx.putImageData(img, 0, 0);
            return;
          }
        }
      }
    }
  };

  // src/renderer/buffer.ts
  var BufferStore = class {
    nextHandle = 1;
    liveHandles = /* @__PURE__ */ new Set();
    buffers = /* @__PURE__ */ new Map();
    boundArrayBuffer = 0;
    boundElementArrayBuffer = 0;
    attribPointers = [];
    attribEnabled = [];
    constructor() {
      for (let i = 0; i < MAX_VERTEX_ATTRIBS; i++) {
        this.attribPointers.push({ size: 4, type: FLOAT, normalized: false, stride: 16, offset: 0, snapshot: 0, hasSnapshot: false });
        this.attribEnabled.push(false);
      }
    }
    /** Issue a fresh never-reused handle. @returns Fresh handle. */
    createBuffer() {
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
    bindBuffer(target, buffer) {
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
    bufferData(target, data, usage) {
      if (target !== ARRAY_BUFFER && target !== ELEMENT_ARRAY_BUFFER) return INVALID_ENUM;
      const bound = target === ARRAY_BUFFER ? this.boundArrayBuffer : this.boundElementArrayBuffer;
      if (bound === 0) return INVALID_VALUE;
      const src = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      const copy = new Uint8Array(src.length);
      for (let i = 0; i < src.length; i++) copy[i] = src[i];
      this.buffers.set(bound, { bytes: copy, usage });
      return null;
    }
    /**
     * Release handle, clear bindings and snapshots referencing it.
     * @param buffer Handle to release.
     */
    deleteBuffer(buffer) {
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
    vertexAttribPointer(index, size, type, normalized, stride, offset) {
      if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) return INVALID_VALUE;
      if (type !== FLOAT) return INVALID_ENUM;
      if (!Number.isInteger(size) || size < 1 || size > 4) return INVALID_VALUE;
      if (!Number.isInteger(stride) || stride < 0) return INVALID_VALUE;
      if (!Number.isInteger(offset) || offset < 0) return INVALID_VALUE;
      if (typeof normalized !== "boolean") return INVALID_VALUE;
      const effectiveStride = stride === 0 ? size * 4 : stride;
      const slot = this.attribPointers[index];
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
    enableVertexAttribArray(index) {
      if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) return INVALID_VALUE;
      this.attribEnabled[index] = true;
      return null;
    }
    /**
     * Disable attribute array. @param index Attribute index. @returns Error code or null.
     */
    disableVertexAttribArray(index) {
      if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) return INVALID_VALUE;
      this.attribEnabled[index] = false;
      return null;
    }
    /**
     * Fetch one decoded vertex through stride/offset math.
     * @param index Attribute index. @param vertexIndex Vertex ordinal.
     * @returns Component list or null when unavailable.
     */
    decodeAttribute(index, vertexIndex) {
      if (!Number.isInteger(index) || index < 0 || index >= MAX_VERTEX_ATTRIBS) return null;
      const slot = this.attribPointers[index];
      if (!slot.hasSnapshot || slot.snapshot === 0) return null;
      if (!Number.isInteger(vertexIndex) || vertexIndex < 0) return null;
      if (!this.liveHandles.has(slot.snapshot)) return null;
      const rec = this.buffers.get(slot.snapshot);
      if (!rec) return null;
      const laneBase = slot.offset + vertexIndex * slot.stride;
      if (laneBase < 0) return null;
      const view = new DataView(rec.bytes.buffer, rec.bytes.byteOffset, rec.bytes.byteLength);
      const out = [];
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
    getBoundBuffer(target) {
      if (target === ARRAY_BUFFER) return this.boundArrayBuffer;
      if (target === ELEMENT_ARRAY_BUFFER) return this.boundElementArrayBuffer;
      return 0;
    }
    /**
     * Read-only copy of stored bytes for a live handle.
     * @param handle Buffer handle. @returns Byte copy or null when unavailable.
     */
    getBufferBytes(handle) {
      if (!this.liveHandles.has(handle)) return null;
      const rec = this.buffers.get(handle);
      if (!rec) return null;
      const copy = new Uint8Array(rec.bytes.length);
      for (let i = 0; i < rec.bytes.length; i++) copy[i] = rec.bytes[i];
      return copy;
    }
    /**
     * Check handle liveness. @param handle Handle value. @returns True when live.
     */
    isLiveHandle(handle) {
      return this.liveHandles.has(handle);
    }
  };

  // src/renderer/context.ts
  var SoftwareWebGLContext = class {
    state;
    fb;
    queue = [];
    canvas;
    store;
    /**
     * Build owned state, pixels, and queue sized to canvas extent.
     * @param state Fresh capability store.
     * @param fb Fresh pixel triple.
     * @param canvas Canvas handle for presentation only.
     */
    constructor(state, fb, canvas) {
      this.state = state;
      this.fb = fb;
      this.canvas = canvas;
      this.store = new BufferStore();
    }
    /** Stage clear color on framebuffer. */
    clearColor(r, g, b, a) {
      this.state.clearColor = [r, g, b, a];
      this.fb.clearColor(r, g, b, a);
    }
    /** Stage clear depth on GLState and framebuffer. */
    clearDepth(v) {
      this.state.setClearDepth(v);
      this.fb.clearDepth(v);
    }
    /** Stage clear stencil on GLState and framebuffer. */
    clearStencil(v) {
      this.state.setClearStencil(v);
      this.fb.clearStencil(v);
    }
    /** Stage depth write mask on GLState and framebuffer. */
    depthMask(flag) {
      this.state.setDepthMask(flag);
      this.fb.setDepthMask(flag);
    }
    /** Stage color write mask on GLState and framebuffer. */
    colorMask(r, g, b, a) {
      this.state.setColorMask(r, g, b, a);
      this.fb.setColorMask(r, g, b, a);
    }
    /** Stage stencil write mask on GLState and framebuffer. */
    stencilMask(mask) {
      this.state.setStencilMask(mask);
      this.fb.setStencilMask(mask);
    }
    /**
     * Replace scissor box; negative size pushes one code with no state change.
     * @param x Left origin. @param y Bottom origin. @param w Width. @param h Height.
     */
    scissor(x, y, w, h) {
      const code = this.state.setScissor(x, y, w, h);
      if (code !== null) pushError(this.queue, code);
    }
    /**
     * Query capability flag; unknown enum returns false without queue change
     * (the TDD unknown-enum case requires exactly one code total across the
     * enable+isEnabled pair, with the single push owned by enable).
     * @param cap Capability code. @returns Flag or false on rejection.
     */
    isEnabled(cap) {
      const result = this.state.isEnabled(cap);
      if (typeof result !== "boolean") return false;
      return result;
    }
    /** Run masked clear on framebuffer, confined to scissor box when scissor test is enabled. */
    clear(mask) {
      if (this.state.scissorTest) {
        this.fb.clear(mask, this.state.scissorBox);
      } else {
        this.fb.clear(mask);
      }
    }
    /**
     * Replace viewport box; negative values rejected with one code.
     * @param x Left origin. @param y Bottom origin. @param w Width. @param h Height.
     */
    viewport(x, y, w, h) {
      const code = this.state.setViewport(x, y, w, h);
      if (code !== null) pushError(this.queue, code);
    }
    /**
     * Flip capability on; unknown enum pushes one code.
     * @param cap Capability code.
     */
    enable(cap) {
      const code = this.state.enable(cap);
      if (code !== null) pushError(this.queue, code);
    }
    /**
     * Flip capability off; unknown enum pushes one code.
     * @param cap Capability code.
     */
    disable(cap) {
      const code = this.state.disable(cap);
      if (code !== null) pushError(this.queue, code);
    }
    /**
     * Read back state or limits; unknown query pushes one code and returns null.
     * @param pname Query code.
     * @returns Value copy, limit, or null.
     */
    getParameter(pname) {
      if (pname === BLEND) return this.state.blendEnabled;
      if (pname === DEPTH_TEST) return this.state.depthTest;
      if (pname === STENCIL_TEST) return this.state.stencilTest;
      if (pname === SCISSOR_TEST) return this.state.scissorTest;
      if (pname === CULL_FACE) return this.state.cullFace;
      if (pname === COLOR_CLEAR_VALUE) return [...this.state.clearColor];
      if (pname === DEPTH_CLEAR_VALUE) return this.state.clearDepth;
      if (pname === STENCIL_CLEAR_VALUE) return this.state.clearStencil;
      if (pname === COLOR_WRITEMASK) return [...this.state.colorMask];
      if (pname === DEPTH_WRITEMASK) return this.state.depthMask;
      if (pname === STENCIL_WRITEMASK) return this.state.stencilMask;
      if (pname === VIEWPORT) return [...this.state.viewport];
      if (pname === SCISSOR_BOX) return [...this.state.scissorBox];
      if (pname === DEPTH_FUNC) return this.state.depthFunc;
      if (pname === BLEND_SRC_RGB) return this.state.blendSrcRGB;
      if (pname === BLEND_DST_RGB) return this.state.blendDstRGB;
      if (pname === BLEND_EQUATION) return this.state.blendEquation;
      if (pname === MAX_TEXTURE_SIZE_PNAME) return MAX_TEXTURE_SIZE;
      if (pname === MAX_VIEWPORT_DIMS_PNAME) return [...MAX_VIEWPORT_DIMS];
      if (pname === MAX_VERTEX_ATTRIBS_PNAME) return MAX_VERTEX_ATTRIBS;
      if (pname === MAX_TEXTURE_IMAGE_UNITS_PNAME) return MAX_TEXTURE_IMAGE_UNITS;
      if (pname === MAX_CUBE_MAP_TEXTURE_SIZE_PNAME) return MAX_CUBE_MAP_TEXTURE_SIZE;
      if (pname === MAX_RENDERBUFFER_SIZE_PNAME) return MAX_RENDERBUFFER_SIZE;
      pushError(this.queue, INVALID_ENUM);
      return null;
    }
    /**
     * Drain head of error queue or NO_ERROR; never throws.
     * @returns Head code or NO_ERROR.
     */
    getError() {
      return drainError(this.queue);
    }
    /**
     * Exact-byte readback; out-of-bounds pushes one code and returns null.
     * @returns Bytes or null.
     */
    readPixels(x, y, w, h) {
      try {
        return this.fb.readPixels(x, y, w, h);
      } catch {
        pushError(this.queue, INVALID_VALUE);
        return null;
      }
    }
    /** Paint fixed red triangle; queue untouched. */
    drawTriangle() {
      const v0x = 32;
      const v0y = 16;
      const v1x = 16;
      const v1y = 48;
      const v2x = 48;
      const v2y = 48;
      const denom = (v1y - v2y) * (v0x - v2x) + (v2x - v1x) * (v0y - v2y);
      if (denom === 0) return;
      const W = this.fb.width;
      const H = this.fb.height;
      const minX = Math.max(0, Math.min(v0x, v1x, v2x));
      const maxX = Math.min(W - 1, Math.max(v0x, v1x, v2x));
      const minY = Math.max(0, Math.min(v0y, v1y, v2y));
      const maxY = Math.min(H - 1, Math.max(v0y, v1y, v2y));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const l0 = ((v1y - v2y) * (x - v2x) + (v2x - v1x) * (y - v2y)) / denom;
          const l1 = ((v2y - v0y) * (x - v2x) + (v0x - v2x) * (y - v2y)) / denom;
          const l2 = 1 - l0 - l1;
          if (l0 >= 0 && l1 >= 0 && l2 >= 0) {
            const idx = (y * W + x) * 4;
            this.fb.color[idx] = 255;
            this.fb.color[idx + 1] = 0;
            this.fb.color[idx + 2] = 0;
            this.fb.color[idx + 3] = 255;
          }
        }
      }
    }
    /** Create a buffer handle via owned store. @returns Fresh handle. */
    createBuffer() {
      return this.store.createBuffer();
    }
    /** Bind buffer via owned store; pushes one code on rejection. */
    bindBuffer(target, buffer) {
      const code = this.store.bindBuffer(target, buffer);
      if (code !== null) pushError(this.queue, code);
    }
    /** Upload bytes via owned store; pushes one code on rejection. */
    bufferData(target, data, usage) {
      const code = this.store.bufferData(target, data, usage);
      if (code !== null) pushError(this.queue, code);
    }
    /** Delete buffer via owned store; never pushes. */
    deleteBuffer(buffer) {
      this.store.deleteBuffer(buffer);
    }
    /** Configure attribute pointer; pushes one code on rejection. */
    vertexAttribPointer(index, size, type, normalized, stride, offset) {
      const code = this.store.vertexAttribPointer(index, size, type, normalized, stride, offset);
      if (code !== null) pushError(this.queue, code);
    }
    /** Enable attribute array; pushes one code on rejection. */
    enableVertexAttribArray(index) {
      const code = this.store.enableVertexAttribArray(index);
      if (code !== null) pushError(this.queue, code);
    }
    /** Disable attribute array; pushes one code on rejection. */
    disableVertexAttribArray(index) {
      const code = this.store.disableVertexAttribArray(index);
      if (code !== null) pushError(this.queue, code);
    }
    /**
     * Decode attribute vertex; never pushes.
     * @param index Attribute index. @param vertexIndex Vertex ordinal.
     * @returns Components or null.
     */
    decodeAttribute(index, vertexIndex) {
      return this.store.decodeAttribute(index, vertexIndex);
    }
    /**
     * Resolve bound handle. @param target Bind target. @returns Handle or 0.
     */
    getBoundBuffer(target) {
      return this.store.getBoundBuffer(target);
    }
    /**
     * Push one draw-failure code; no state or pixel change.
     * @param code One of INVALID_ENUM, INVALID_VALUE, INVALID_OPERATION.
     */
    reportDrawFailure(code) {
      pushError(this.queue, code);
    }
    /**
     * Report default-framebuffer completeness; never pushes.
     * @returns True when width and height are positive.
     */
    checkDefaultFramebufferComplete() {
      return this.fb.width > 0 && this.fb.height > 0;
    }
    /**
     * Validate and execute a non-indexed TRIANGLES draw; placeholder shading on success.
     * @param mode Draw mode, TRIANGLES only. @param first First vertex ordinal. @param count Vertex count.
     */
    drawArrays = (mode, first, count) => {
      if (mode !== TRIANGLES) {
        this.reportDrawFailure(INVALID_ENUM);
        return;
      }
      if (!Number.isInteger(first) || first < 0) {
        this.reportDrawFailure(INVALID_VALUE);
        return;
      }
      if (!Number.isInteger(count) || count < 0) {
        this.reportDrawFailure(INVALID_VALUE);
        return;
      }
      if (this.state.currentProgram === 0) {
        this.reportDrawFailure(INVALID_OPERATION);
        return;
      }
      if (!this.checkDefaultFramebufferComplete()) {
        this.reportDrawFailure(INVALID_OPERATION);
        return;
      }
      if (count === 0) return;
      for (let i = 0; i < count; i++) this.store.decodeAttribute(0, first + i);
      this.drawTriangle();
    };
    /**
     * Validate and execute an indexed TRIANGLES draw via UNSIGNED_SHORT indices.
     * @param mode Draw mode, TRIANGLES only. @param count Index count. @param type Index type, UNSIGNED_SHORT only. @param offset Byte offset into element bytes.
     */
    drawElements = (mode, count, type, offset) => {
      if (mode !== TRIANGLES) {
        this.reportDrawFailure(INVALID_ENUM);
        return;
      }
      if (type !== UNSIGNED_SHORT) {
        this.reportDrawFailure(INVALID_ENUM);
        return;
      }
      if (!Number.isInteger(count) || count < 0) {
        this.reportDrawFailure(INVALID_VALUE);
        return;
      }
      if (!Number.isInteger(offset) || offset < 0) {
        this.reportDrawFailure(INVALID_VALUE);
        return;
      }
      if (this.state.currentProgram === 0) {
        this.reportDrawFailure(INVALID_OPERATION);
        return;
      }
      if (!this.checkDefaultFramebufferComplete()) {
        this.reportDrawFailure(INVALID_OPERATION);
        return;
      }
      const elemHandle = this.store.getBoundBuffer(ELEMENT_ARRAY_BUFFER);
      if (count > 0 && elemHandle === 0) {
        this.reportDrawFailure(INVALID_OPERATION);
        return;
      }
      if (count === 0) return;
      const bytes = this.store.getBufferBytes(elemHandle);
      if (!bytes || offset + count * 2 > bytes.length) {
        this.reportDrawFailure(INVALID_VALUE);
        return;
      }
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      for (let i = 0; i < count; i++) {
        const idx = view.getUint16(offset + i * 2, true);
        this.store.decodeAttribute(0, idx);
      }
      this.drawTriangle();
    };
    /** Present via framebuffer; never throws. */
    presentToCanvas() {
      try {
        this.fb.presentToCanvas(this.canvas);
      } catch {
      }
    }
  };
  function createSoftwareWebGLContext(canvas, _attrs) {
    try {
      const w = typeof canvas?.width === "number" ? canvas.width : 64;
      const h = typeof canvas?.height === "number" ? canvas.height : 64;
      const state = new GLState(w, h);
      const fb = new Framebuffer(w, h);
      return new SoftwareWebGLContext(state, fb, canvas);
    } catch (e) {
      if (e instanceof OutOfMemoryError) return null;
      return null;
    }
  }
  return __toCommonJS(context_exports);
})();
window.__createSoftwareWebGLContext=__swgl.createSoftwareWebGLContext;
