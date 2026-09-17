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
  var SRC_COLOR = 768;
  var ONE_MINUS_SRC_COLOR = 769;
  var SRC_ALPHA = 770;
  var ONE_MINUS_SRC_ALPHA = 771;
  var DST_ALPHA = 772;
  var ONE_MINUS_DST_ALPHA = 773;
  var DST_COLOR = 774;
  var ONE_MINUS_DST_COLOR = 775;
  var SRC_ALPHA_SATURATE = 776;
  var FUNC_ADD = 32774;
  var BLEND_EQUATION = 32777;
  var FUNC_SUBTRACT = 32778;
  var FUNC_REVERSE_SUBTRACT = 32779;
  var BLEND_DST_RGB = 32968;
  var BLEND_SRC_RGB = 32969;
  var CONSTANT_COLOR = 32769;
  var ONE_MINUS_CONSTANT_COLOR = 32770;
  var CONSTANT_ALPHA = 32771;
  var ONE_MINUS_CONSTANT_ALPHA = 32772;
  var NEVER = 512;
  var LESS = 513;
  var EQUAL = 514;
  var LEQUAL = 515;
  var GREATER = 516;
  var NOTEQUAL = 517;
  var GEQUAL = 518;
  var ALWAYS = 519;
  var BLEND = 3042;
  var DEPTH_TEST = 2929;
  var STENCIL_TEST = 2960;
  var SCISSOR_TEST = 3089;
  var CULL_FACE = 2884;
  var TEXTURE_2D = 3553;
  var NEAREST = 9728;
  var LINEAR = 9729;
  var NEAREST_MIPMAP_NEAREST = 9984;
  var LINEAR_MIPMAP_NEAREST = 9985;
  var NEAREST_MIPMAP_LINEAR = 9986;
  var LINEAR_MIPMAP_LINEAR = 9987;
  var TEXTURE_MAG_FILTER = 10240;
  var TEXTURE_MIN_FILTER = 10241;
  var TEXTURE_WRAP_S = 10242;
  var TEXTURE_WRAP_T = 10243;
  var CLAMP_TO_EDGE = 33071;
  var REPEAT = 10497;
  var MIRRORED_REPEAT = 33648;
  var RGBA = 6408;
  var UNSIGNED_BYTE = 5121;
  var UNSIGNED_SHORT = 5123;
  var FLOAT = 5126;
  var COLOR_BUFFER_BIT = 16384;
  var DEPTH_BUFFER_BIT = 256;
  var STENCIL_BUFFER_BIT = 1024;
  var ARRAY_BUFFER = 34962;
  var ELEMENT_ARRAY_BUFFER = 34963;
  var VERTEX_SHADER = 35633;
  var FRAGMENT_SHADER = 35632;
  var COMPILE_STATUS = 35713;
  var LINK_STATUS = 35714;
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
  var ShaderCompileError = class extends Error {
    line;
    constructor(message, line) {
      super(message);
      this.name = "ShaderCompileError";
      this.line = line;
    }
  };
  var InvalidEnumError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "InvalidEnumError";
    }
  };
  var InvalidValueError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "InvalidValueError";
    }
  };
  var InvalidOperationError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "InvalidOperationError";
    }
  };
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

  // src/renderer/rasterizer.ts
  function edge(ax, ay, bx, by, px, py) {
    return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
  }
  function isTopLeft(ax, ay, bx, by) {
    if (ay === by) return bx > ax;
    return by > ay;
  }
  function project(v, vp) {
    const w = v.position[3];
    if (w === 0) return null;
    const ndcX = v.position[0] / w;
    const ndcY = v.position[1] / w;
    const sx = (ndcX + 1) / 2 * vp[2] + vp[0];
    const sy = (ndcY + 1) / 2 * vp[3] + vp[1];
    return [sx, sy];
  }
  function prepareVaryingScratch(v0, v1, v2, varyingCount, scratchAw, scratchInvW) {
    const w0 = v0.position[3];
    const w1 = v1.position[3];
    const w2 = v2.position[3];
    const invW0 = 1 / w0;
    const invW1 = 1 / w1;
    const invW2 = 1 / w2;
    scratchInvW[0] = invW0;
    scratchInvW[1] = invW1;
    scratchInvW[2] = invW2;
    const a0 = v0.varyings;
    const a1 = v1.varyings;
    const a2 = v2.varyings;
    for (let k = 0; k < varyingCount; k++) {
      scratchAw[k] = a0[k] * invW0;
      scratchAw[varyingCount + k] = a1[k] * invW1;
      scratchAw[2 * varyingCount + k] = a2[k] * invW2;
    }
  }
  function asFragmentProgram(program) {
    if (typeof program !== "object" || program === null) return null;
    const rec = program;
    if (typeof rec["fragment"] !== "function") return null;
    return program;
  }
  function evaluateScissor(px, py, st) {
    if (!st.scissorTest) return true;
    const sb = st.scissorBox;
    const bx = sb[0];
    const by = sb[1];
    const bw = sb[2];
    const bh = sb[3];
    if (px < bx || px >= bx + bw) return false;
    if (py < by || py >= by + bh) return false;
    return true;
  }
  function evaluateStencil(px, py, st, stencil, width) {
    if (!st.stencilTest) return true;
    void stencil[py * width + px];
    return true;
  }
  function computeFragmentDepth(w0, w1, w2, ndcZ0, ndcZ1, ndcZ2) {
    let weighted;
    if (ndcZ0 === ndcZ1 && ndcZ1 === ndcZ2) weighted = ndcZ0;
    else weighted = w0 * ndcZ0 + w1 * ndcZ1 + w2 * ndcZ2;
    const mapped = (weighted + 1) / 2;
    if (mapped < 0) return 0;
    if (mapped > 1) return 1;
    return mapped;
  }
  function evaluateDepth(func, incoming, stored, depthTest) {
    if (!depthTest) return true;
    const close = Math.abs(incoming - stored) <= 1e-6;
    if (func === NEVER) return false;
    if (func === LESS) return incoming < stored;
    if (func === EQUAL) return close;
    if (func === LEQUAL) return incoming < stored || close;
    if (func === GREATER) return incoming > stored;
    if (func === NOTEQUAL) return !close;
    if (func === GEQUAL) return incoming > stored || close;
    if (func === ALWAYS) return true;
    return false;
  }
  function blendFactor(factorEnum, srcC, srcA, dstC, dstA) {
    if (factorEnum === ZERO) return 0;
    if (factorEnum === ONE) return 1;
    if (factorEnum === SRC_COLOR) return srcC;
    if (factorEnum === ONE_MINUS_SRC_COLOR) return 1 - srcC;
    if (factorEnum === SRC_ALPHA) return srcA;
    if (factorEnum === ONE_MINUS_SRC_ALPHA) return 1 - srcA;
    if (factorEnum === DST_ALPHA) return dstA;
    if (factorEnum === ONE_MINUS_DST_ALPHA) return 1 - dstA;
    if (factorEnum === DST_COLOR) return dstC;
    if (factorEnum === ONE_MINUS_DST_COLOR) return 1 - dstC;
    if (factorEnum === SRC_ALPHA_SATURATE) return Math.min(srcA, 1 - dstA);
    if (factorEnum === CONSTANT_COLOR) return 0;
    if (factorEnum === ONE_MINUS_CONSTANT_COLOR) return 1;
    if (factorEnum === CONSTANT_ALPHA) return 1;
    if (factorEnum === ONE_MINUS_CONSTANT_ALPHA) return 0;
    return 1;
  }
  function writeFragment(px, py, incomingDepth, frag, fb, st) {
    const fw = fb.width;
    if (st.depthMask) fb.depth[py * fw + px] = incomingDepth;
    const color = fb.color;
    const off = (py * fw + px) * 4;
    const cm = st.colorMask;
    const fr = frag[0];
    const fg = frag[1];
    const fb2 = frag[2];
    const fa = frag[3];
    if (!st.blendEnabled) {
      if (cm[0]) color[off] = fr;
      if (cm[1]) color[off + 1] = fg;
      if (cm[2]) color[off + 2] = fb2;
      if (cm[3]) color[off + 3] = fa;
      return;
    }
    const dr = color[off];
    const dg = color[off + 1];
    const db = color[off + 2];
    const da = color[off + 3];
    const srcR = fr / 255;
    const srcG = fg / 255;
    const srcB = fb2 / 255;
    const srcA = fa / 255;
    const dstR = dr / 255;
    const dstG = dg / 255;
    const dstB = db / 255;
    const dstA = da / 255;
    const sEnum = st.blendSrcRGB;
    const dEnum = st.blendDstRGB;
    const sfR = blendFactor(sEnum, srcR, srcA, dstR, dstA);
    const sfG = blendFactor(sEnum, srcG, srcA, dstG, dstA);
    const sfB = blendFactor(sEnum, srcB, srcA, dstB, dstA);
    const dfR = blendFactor(dEnum, srcR, srcA, dstR, dstA);
    const dfG = blendFactor(dEnum, srcG, srcA, dstG, dstA);
    const dfB = blendFactor(dEnum, srcB, srcA, dstB, dstA);
    const ssR = fr * sfR;
    const ssG = fg * sfG;
    const ssB = fb2 * sfB;
    const ssA = fa * 1;
    const sdR = dr * dfR;
    const sdG = dg * dfG;
    const sdB = db * dfB;
    const sdA = da * 1;
    const eq = st.blendEquation;
    let r;
    let g;
    let b;
    let a;
    if (eq === FUNC_SUBTRACT) {
      r = ssR - sdR;
      g = ssG - sdG;
      b = ssB - sdB;
      a = ssA - sdA;
    } else if (eq === FUNC_REVERSE_SUBTRACT) {
      r = sdR - ssR;
      g = sdG - ssG;
      b = sdB - ssB;
      a = sdA - ssA;
    } else {
      r = ssR + sdR;
      g = ssG + sdG;
      b = ssB + sdB;
      a = ssA + sdA;
    }
    if (cm[0]) color[off] = r;
    if (cm[1]) color[off + 1] = g;
    if (cm[2]) color[off + 2] = b;
    if (cm[3]) color[off + 3] = a;
  }
  function fillTriangle(fb, st, s0, s1, s2, frag, v0, v1, v2, scratchAw, scratchInvW, outVaryings, varyingCount, prog) {
    const area = edge(s0[0], s0[1], s1[0], s1[1], s2[0], s2[1]);
    if (area === 0) return;
    const vp = st.viewport;
    const rawMinX = Math.floor(Math.min(s0[0], s1[0], s2[0]));
    const rawMaxX = Math.ceil(Math.max(s0[0], s1[0], s2[0]));
    const rawMinY = Math.floor(Math.min(s0[1], s1[1], s2[1]));
    const rawMaxY = Math.ceil(Math.max(s0[1], s1[1], s2[1]));
    let cx0 = Math.max(vp[0], 0);
    let cy0 = Math.max(vp[1], 0);
    let cx1 = Math.min(vp[0] + vp[2], fb.width);
    let cy1 = Math.min(vp[1] + vp[3], fb.height);
    if (st.scissorTest) {
      const sb = st.scissorBox;
      cx0 = Math.max(cx0, sb[0]);
      cy0 = Math.max(cy0, sb[1]);
      cx1 = Math.min(cx1, sb[0] + sb[2]);
      cy1 = Math.min(cy1, sb[1] + sb[3]);
    }
    const ix0 = Math.max(rawMinX, Math.ceil(cx0));
    const iy0 = Math.max(rawMinY, Math.ceil(cy0));
    const ix1 = Math.min(rawMaxX, Math.floor(cx1));
    const iy1 = Math.min(rawMaxY, Math.floor(cy1));
    if (ix1 < ix0 || iy1 < iy0) return;
    const tl0 = isTopLeft(s1[0], s1[1], s2[0], s2[1]);
    const tl1 = isTopLeft(s2[0], s2[1], s0[0], s0[1]);
    const tl2 = isTopLeft(s0[0], s0[1], s1[0], s1[1]);
    const pos = area > 0;
    const fw = fb.width;
    const a0 = s2[1] - s1[1];
    const b0 = -(s2[0] - s1[0]);
    const a1 = s0[1] - s2[1];
    const b1 = -(s0[0] - s2[0]);
    const a2 = s1[1] - s0[1];
    const b2 = -(s1[0] - s0[0]);
    for (let py = iy0; py < iy1; py++) {
      const pyc = py + 0.5;
      const pxc0 = ix0 + 0.5;
      let e0 = edge(s1[0], s1[1], s2[0], s2[1], pxc0, pyc);
      let e1 = edge(s2[0], s2[1], s0[0], s0[1], pxc0, pyc);
      let e2 = edge(s0[0], s0[1], s1[0], s1[1], pxc0, pyc);
      for (let px = ix0; px < ix1; px++) {
        let c0;
        let c1;
        let c2;
        if (pos) {
          c0 = e0 > 0 || e0 === 0 && tl0;
          c1 = e1 > 0 || e1 === 0 && tl1;
          c2 = e2 > 0 || e2 === 0 && tl2;
        } else {
          c0 = e0 < 0 || e0 === 0 && tl0;
          c1 = e1 < 0 || e1 === 0 && tl1;
          c2 = e2 < 0 || e2 === 0 && tl2;
        }
        if (c0 && c1 && c2) {
          if (!evaluateScissor(px, py, st)) {
            e0 += a0;
            e1 += a1;
            e2 += a2;
            continue;
          }
          if (!evaluateStencil(px, py, st, fb.stencil, fw)) {
            e0 += a0;
            e1 += a1;
            e2 += a2;
            continue;
          }
          const l0 = e0 / area;
          const l1 = e1 / area;
          const l2 = e2 / area;
          let incomingDepth = 0;
          if (v0 !== void 0 && v1 !== void 0 && v2 !== void 0) {
            const ndcZ0 = v0.position[2] / v0.position[3];
            const ndcZ1 = v1.position[2] / v1.position[3];
            const ndcZ2 = v2.position[2] / v2.position[3];
            incomingDepth = computeFragmentDepth(l0, l1, l2, ndcZ0, ndcZ1, ndcZ2);
          }
          const storedDepth = fb.depth[py * fw + px];
          if (!evaluateDepth(st.depthFunc, incomingDepth, storedDepth, st.depthTest)) {
            e0 += a0;
            e1 += a1;
            e2 += a2;
            continue;
          }
          const vc = varyingCount ?? 0;
          if (vc > 0 && v0 !== void 0 && v1 !== void 0 && v2 !== void 0 && scratchAw !== void 0 && scratchInvW !== void 0 && outVaryings !== void 0) {
            const invW = l0 * scratchInvW[0] + l1 * scratchInvW[1] + l2 * scratchInvW[2];
            if (invW === 0) {
              e0 += a0;
              e1 += a1;
              e2 += a2;
              continue;
            }
            for (let k = 0; k < vc; k++) {
              const num = l0 * scratchAw[k] + l1 * scratchAw[vc + k] + l2 * scratchAw[2 * vc + k];
              outVaryings[k] = num / invW;
            }
            if (prog !== void 0 && prog !== null) prog.fragment(outVaryings);
          } else if (prog !== void 0 && prog !== null && outVaryings !== void 0) {
            prog.fragment(outVaryings);
          }
          writeFragment(px, py, incomingDepth, frag, fb, st);
        }
        e0 += a0;
        e1 += a1;
        e2 += a2;
      }
    }
  }
  function drawArraysImpl(call) {
    const varyingCount = call.vertices.length > 0 ? call.vertices[0].varyings.length : 0;
    const scratchAw = varyingCount > 0 ? new Float32Array(3 * varyingCount) : new Float32Array(0);
    const scratchInvW = new Float32Array(3);
    const outVaryings = new Float32Array(varyingCount);
    const prog = asFragmentProgram(call.program);
    const n = Math.floor(call.vertices.length / 3);
    for (let t = 0; t < n; t++) {
      const v0 = call.vertices[t * 3];
      const v1 = call.vertices[t * 3 + 1];
      const v2 = call.vertices[t * 3 + 2];
      const s0 = project(v0, call.state.viewport);
      const s1 = project(v1, call.state.viewport);
      const s2 = project(v2, call.state.viewport);
      if (s0 === null || s1 === null || s2 === null) continue;
      if (varyingCount > 0) prepareVaryingScratch(v0, v1, v2, varyingCount, scratchAw, scratchInvW);
      fillTriangle(call.framebuffer, call.state, s0, s1, s2, call.fragmentColor, v0, v1, v2, scratchAw, scratchInvW, outVaryings, varyingCount, prog);
    }
  }
  function drawElementsImpl(call) {
    const idx = call.indices;
    if (idx === null || idx === void 0) return;
    const varyingCount = call.vertices.length > 0 ? call.vertices[0].varyings.length : 0;
    const scratchAw = varyingCount > 0 ? new Float32Array(3 * varyingCount) : new Float32Array(0);
    const scratchInvW = new Float32Array(3);
    const outVaryings = new Float32Array(varyingCount);
    const prog = asFragmentProgram(call.program);
    const m = Math.floor(idx.length / 3);
    for (let t = 0; t < m; t++) {
      const i0 = idx[t * 3];
      const i1 = idx[t * 3 + 1];
      const i2 = idx[t * 3 + 2];
      if (i0 < 0 || i1 < 0 || i2 < 0 || i0 >= call.vertices.length || i1 >= call.vertices.length || i2 >= call.vertices.length) continue;
      const v0 = call.vertices[i0];
      const v1 = call.vertices[i1];
      const v2 = call.vertices[i2];
      const s0 = project(v0, call.state.viewport);
      const s1 = project(v1, call.state.viewport);
      const s2 = project(v2, call.state.viewport);
      if (s0 === null || s1 === null || s2 === null) continue;
      if (varyingCount > 0) prepareVaryingScratch(v0, v1, v2, varyingCount, scratchAw, scratchInvW);
      fillTriangle(call.framebuffer, call.state, s0, s1, s2, call.fragmentColor, v0, v1, v2, scratchAw, scratchInvW, outVaryings, varyingCount, prog);
    }
  }

  // src/renderer/texture.ts
  function isPowerOfTwo(n) {
    if (!Number.isInteger(n) || n <= 0) return false;
    let v = n;
    while (v % 2 === 0 && v > 1) v /= 2;
    return v === 1;
  }
  function isMipmapFilter(f) {
    return f === NEAREST_MIPMAP_NEAREST || f === LINEAR_MIPMAP_NEAREST || f === NEAREST_MIPMAP_LINEAR || f === LINEAR_MIPMAP_LINEAR;
  }
  function wrapCoordinate(coord, wrapMode) {
    if (wrapMode === CLAMP_TO_EDGE) {
      if (coord < 0) return 0;
      if (coord > 1) return 1;
      return coord;
    }
    if (wrapMode === REPEAT) {
      return coord - Math.floor(coord);
    }
    let m = coord % 2;
    if (m < 0) m += 2;
    if (m > 1) m = 2 - m;
    return m;
  }
  function wrapIndex(i, size, wrapMode) {
    if (wrapMode === CLAMP_TO_EDGE) {
      if (i < 0) return 0;
      if (i >= size) return size - 1;
      return i;
    }
    if (wrapMode === REPEAT) {
      let m2 = i % size;
      if (m2 < 0) m2 += size;
      return m2;
    }
    const period = 2 * size;
    let m = i % period;
    if (m < 0) m += period;
    if (m >= size) m = period - 1 - m;
    return m;
  }
  var TextureStore = class {
    textures = /* @__PURE__ */ new Map();
    nextId = 1;
    boundHandle = 0;
    /**
     * Allocate a new texture handle with 1x1 white default state.
     * @returns Stable handle number, never reused.
     */
    createTexture() {
      const id = this.nextId;
      const tex = {
        id,
        width: 1,
        height: 1,
        data: new Uint8Array([255, 255, 255, 255]),
        minFilter: NEAREST,
        magFilter: NEAREST,
        wrapS: CLAMP_TO_EDGE,
        wrapT: CLAMP_TO_EDGE,
        hasImage: false,
        complete: false
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
    bindTexture(target, handle) {
      if (target !== TEXTURE_2D) throw new InvalidEnumError("bindTexture: target must be TEXTURE_2D");
      if (handle === 0) {
        this.boundHandle = 0;
        return;
      }
      if (!this.textures.has(handle)) throw new InvalidOperationError(`bindTexture: unknown handle ${String(handle)}`);
      this.boundHandle = handle;
    }
    /**
     * Upload RGBA UNSIGNED_BYTE level-0 image into the bound texture.
     * @param target Must equal TEXTURE_2D.
     * @param level Must equal 0.
     * @param internalFormat Ignored beyond validation path; format must equal RGBA.
     * @param width Positive integer within MAX_TEXTURE_SIZE.
     * @param height Positive integer within MAX_TEXTURE_SIZE.
     * @param format Must equal RGBA.
     * @param type Must equal UNSIGNED_BYTE.
     * @param pixels Non-null RGBA row-major bytes of length width*height*4.
     * @throws InvalidEnumError For bad target/format/type.
     * @throws InvalidValueError For bad level, dims, or pixel length.
     * @throws InvalidOperationError When nothing is bound.
     * @throws OutOfMemoryError When dims exceed MAX_TEXTURE_SIZE.
     */
    texImage2D(target, level, internalFormat, width, height, format, type, pixels) {
      if (target !== TEXTURE_2D) throw new InvalidEnumError("texImage2D: target must be TEXTURE_2D");
      if (level !== 0) throw new InvalidValueError("texImage2D: level must be 0");
      if (format !== RGBA) throw new InvalidEnumError("texImage2D: format must be RGBA");
      if (type !== UNSIGNED_BYTE) throw new InvalidEnumError("texImage2D: type must be UNSIGNED_BYTE");
      const tex = this.textures.get(this.boundHandle);
      if (this.boundHandle === 0 || tex === void 0) throw new InvalidOperationError("texImage2D: nothing bound");
      if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
        throw new InvalidValueError("texImage2D: invalid dimensions");
      }
      if (width > MAX_TEXTURE_SIZE || height > MAX_TEXTURE_SIZE) {
        throw new OutOfMemoryError("texImage2D: dimensions exceed MAX_TEXTURE_SIZE");
      }
      if (pixels === null || pixels.length !== width * height * 4) {
        throw new InvalidValueError("texImage2D: bad pixel payload");
      }
      const fresh = new Uint8Array(width * height * 4);
      for (let i = 0; i < fresh.length; i++) fresh[i] = pixels[i];
      tex.width = width;
      tex.height = height;
      tex.data = fresh;
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
    texParameteri(target, pname, param) {
      if (target !== TEXTURE_2D) throw new InvalidEnumError("texParameteri: target must be TEXTURE_2D");
      const tex = this.textures.get(this.boundHandle);
      if (this.boundHandle === 0 || tex === void 0) throw new InvalidOperationError("texParameteri: nothing bound");
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
    sample2D(handle, u, v) {
      const tex = this.textures.get(handle);
      if (tex === void 0) throw new InvalidOperationError(`sample2D: unknown handle ${String(handle)}`);
      if (!tex.hasImage) return [1, 1, 1, 1];
      if (!tex.complete) return [0, 0, 0, 1];
      const wu = wrapCoordinate(u, tex.wrapS);
      const wv = wrapCoordinate(v, tex.wrapT);
      const w = tex.width;
      const h = tex.height;
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
        const out = [0, 0, 0, 0];
        for (let c = 0; c < 4; c++) {
          const top = t00[c] * (1 - fx) + t10[c] * fx;
          const bot = t01[c] * (1 - fx) + t11[c] * fx;
          out[c] = (top * (1 - fy) + bot * fy) / 255;
        }
        return out;
      }
      const xi = wrapIndex(Math.floor(u * w), w, tex.wrapS);
      const yi = wrapIndex(Math.floor(v * h), h, tex.wrapT);
      const t = this.fetchBytes(tex, xi, yi);
      return [t[0] / 255, t[1] / 255, t[2] / 255, t[3] / 255];
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
    putTexel(handle, x, y, r, g, b, a) {
      const tex = this.textures.get(handle);
      if (tex === void 0) throw new InvalidOperationError(`putTexel: unknown handle ${String(handle)}`);
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
    getTexel(handle, x, y) {
      const tex = this.textures.get(handle);
      if (tex === void 0) throw new InvalidOperationError(`getTexel: unknown handle ${String(handle)}`);
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= tex.width || y >= tex.height) {
        throw new InvalidValueError("getTexel: coordinates out of range");
      }
      const off = (y * tex.width + x) * 4;
      return [
        tex.data[off],
        tex.data[off + 1],
        tex.data[off + 2],
        tex.data[off + 3]
      ];
    }
    /**
     * Report derived completeness for a handle.
     * @param handle Texture handle.
     * @returns True only when image present, dims valid, and filter-wrap rules hold.
     * @throws InvalidOperationError For unknown handle.
     */
    isComplete(handle) {
      const tex = this.textures.get(handle);
      if (tex === void 0) throw new InvalidOperationError(`isComplete: unknown handle ${String(handle)}`);
      return this.recompute(tex);
    }
    /**
     * Fetch one texel in byte space without validation.
     *
     * @param tex Backing texture holding row-major RGBA bytes.
     * @param x Texel column already folded into range.
     * @param y Texel row already folded into range.
     * @returns Four bytes in RGBA order.
     */
    fetchBytes(tex, x, y) {
      const off = (y * tex.width + x) * 4;
      return [
        tex.data[off],
        tex.data[off + 1],
        tex.data[off + 2],
        tex.data[off + 3]
      ];
    }
    /**
     * Derive the completeness flag from image presence and filter-wrap rules.
     *
     * @param tex Backing texture whose complete flag is updated in place.
     * @returns True only when image present, dims valid, and filter-wrap rules hold.
     */
    recompute(tex) {
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
      const needsPOT = tex.wrapS === REPEAT || tex.wrapS === MIRRORED_REPEAT || tex.wrapT === REPEAT || tex.wrapT === MIRRORED_REPEAT;
      if (needsPOT && (!isPowerOfTwo(tex.width) || !isPowerOfTwo(tex.height))) {
        tex.complete = false;
        return false;
      }
      tex.complete = true;
      return true;
    }
  };

  // src/renderer/shader-compiler/tokenizer.ts
  var KEYWORDS = /* @__PURE__ */ new Set([
    "attribute",
    "const",
    "uniform",
    "varying",
    "break",
    "continue",
    "do",
    "for",
    "while",
    "if",
    "else",
    "in",
    "out",
    "inout",
    "float",
    "int",
    "void",
    "bool",
    "true",
    "false",
    "lowp",
    "mediump",
    "highp",
    "precision",
    "invariant",
    "discard",
    "return",
    "mat2",
    "mat3",
    "mat4",
    "vec2",
    "vec3",
    "vec4",
    "ivec2",
    "ivec3",
    "ivec4",
    "bvec2",
    "bvec3",
    "bvec4",
    "sampler2D",
    "samplerCube",
    "struct"
  ]);
  var THREE_OPS = /* @__PURE__ */ new Set(["<<=", ">>="]);
  var TWO_OPS = /* @__PURE__ */ new Set([
    "==",
    "!=",
    "<=",
    ">=",
    "&&",
    "||",
    "++",
    "--",
    "+=",
    "-=",
    "*=",
    "/=",
    "%=",
    "<<",
    ">>",
    "&=",
    "|=",
    "^=",
    "->"
  ]);
  function isLetter(c) {
    return c >= "a" && c <= "z" || c >= "A" && c <= "Z";
  }
  function isDigit(c) {
    return c >= "0" && c <= "9";
  }
  function isWordChar(c) {
    return isLetter(c) || isDigit(c) || c === "_";
  }
  function tokenize(source) {
    const tokens = [];
    let pos = 0;
    let line = 1;
    let atLineStart = true;
    const n = source.length;
    while (pos < n) {
      const c = source[pos];
      const next = pos + 1 < n ? source[pos + 1] : "";
      if (c === "\r" && next === "\n") {
        line += 1;
        pos += 2;
        atLineStart = true;
        continue;
      }
      if (c === "\n" || c === "\r") {
        line += 1;
        pos += 1;
        atLineStart = true;
        continue;
      }
      if (c === " " || c === "	" || c === "\f" || c === "\v") {
        pos += 1;
        continue;
      }
      if (c === "#" && atLineStart) {
        const start = pos;
        while (pos < n && source[pos] !== "\n" && source[pos] !== "\r") pos += 1;
        tokens.push({ kind: "directive", lexeme: source.slice(start, pos), line });
        atLineStart = false;
        continue;
      }
      if (c === "/" && next === "/") {
        pos += 2;
        while (pos < n && source[pos] !== "\n" && source[pos] !== "\r") pos += 1;
        atLineStart = false;
        if (pos < n) continue;
        continue;
      }
      if (c === "/" && next === "*") {
        const openingLine = line;
        pos += 2;
        let closed = false;
        while (pos < n) {
          const d = source[pos];
          const d2 = pos + 1 < n ? source[pos + 1] : "";
          if (d === "*" && d2 === "/") {
            pos += 2;
            closed = true;
            break;
          }
          if (d === "\r" && d2 === "\n") {
            line += 1;
            pos += 2;
            continue;
          }
          if (d === "\n" || d === "\r") line += 1;
          pos += 1;
        }
        if (!closed) throw new ShaderCompileError("Unterminated block comment", openingLine);
        atLineStart = false;
        continue;
      }
      if (isLetter(c) || c === "_") {
        const start = pos;
        while (pos < n && isWordChar(source[pos])) pos += 1;
        const word = source.slice(start, pos);
        tokens.push({ kind: KEYWORDS.has(word) ? "keyword" : "ident", lexeme: word, line });
        atLineStart = false;
        continue;
      }
      const dotDigit = c === "." && isDigit(next);
      if (isDigit(c) || dotDigit) {
        const start = pos;
        const tokLine = line;
        while (pos < n && isDigit(source[pos])) pos += 1;
        if (pos < n && source[pos] === ".") {
          pos += 1;
          while (pos < n && isDigit(source[pos])) pos += 1;
        }
        if (pos < n && (source[pos] === "e" || source[pos] === "E")) {
          pos += 1;
          if (pos < n && (source[pos] === "+" || source[pos] === "-")) pos += 1;
          while (pos < n && isDigit(source[pos])) pos += 1;
        }
        while (pos < n && (isLetter(source[pos]) || source[pos] === "_")) pos += 1;
        if (pos < n && source[pos] === ".") {
          let end = pos + 1;
          while (end < n && isDigit(source[end])) end += 1;
          throw new ShaderCompileError(`Malformed numeric literal '${source.slice(start, end)}'`, tokLine);
        }
        const raw = source.slice(start, pos);
        const valid = /^(?:\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)$/.test(raw);
        if (!valid) throw new ShaderCompileError(`Malformed numeric literal '${raw}'`, tokLine);
        const kind = raw.includes(".") || /[eE]/.test(raw) ? "float" : "int";
        tokens.push({ kind, lexeme: raw, line: tokLine });
        atLineStart = false;
        continue;
      }
      const three = source.slice(pos, pos + 3);
      if (three.length === 3 && THREE_OPS.has(three)) {
        tokens.push({ kind: "op", lexeme: three, line });
        pos += 3;
        atLineStart = false;
        continue;
      }
      const two = source.slice(pos, pos + 2);
      if (two.length === 2 && TWO_OPS.has(two)) {
        tokens.push({ kind: "op", lexeme: two, line });
        pos += 2;
        atLineStart = false;
        continue;
      }
      tokens.push({ kind: "op", lexeme: c, line });
      pos += 1;
      atLineStart = false;
    }
    return tokens;
  }

  // src/renderer/shader-compiler/parser.ts
  var QUALIFIERS = /* @__PURE__ */ new Set([
    "invariant",
    "const",
    "uniform",
    "attribute",
    "varying",
    "in",
    "out",
    "inout"
  ]);
  var TYPE_NAMES = /* @__PURE__ */ new Set([
    "float",
    "int",
    "bool",
    "void",
    "vec2",
    "vec3",
    "vec4",
    "ivec2",
    "ivec3",
    "ivec4",
    "bvec2",
    "bvec3",
    "bvec4",
    "mat2",
    "mat3",
    "mat4",
    "sampler2D",
    "samplerCube",
    "lowp",
    "mediump",
    "highp"
  ]);
  function isVersionDirective(t) {
    const parts = t.lexeme.trim().split(/\s+/);
    return parts[0] === "#version";
  }
  function parseVersionParts(t) {
    const parts = t.lexeme.trim().split(/\s+/);
    if (parts[0] !== "#version" || parts.length < 2) return null;
    const num = Number(parts[1]);
    if (!Number.isFinite(num)) return null;
    return { num, profile: parts[2] ?? "" };
  }
  function resolveVersion(directives) {
    if (directives.length === 0) return 100;
    const first = directives[0];
    if (isVersionDirective(first)) {
      if (first.line !== 1) throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
      const parts = parseVersionParts(first);
      if (parts === null) throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
      if (parts.num === 300 && parts.profile === "es") {
        for (let i = 1; i < directives.length; i++) {
          if (isVersionDirective(directives[i])) {
            throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
          }
        }
        return 300;
      }
      if (parts.num === 100) {
        for (let i = 1; i < directives.length; i++) {
          if (isVersionDirective(directives[i])) {
            throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
          }
        }
        return 100;
      }
      throw new ShaderCompileError(`UNSUPPORTED_VERSION ${parts.num}`, first.line);
    }
    for (const d of directives) {
      if (isVersionDirective(d)) throw new ShaderCompileError("VERSION_MUST_BE_FIRST_LINE", 1);
    }
    return 100;
  }
  function checkQualifier(lexeme, line, version) {
    if (version === 300) {
      if (lexeme === "attribute") throw new ShaderCompileError("ATTRIBUTE_RESERVED_IN_300", line);
      if (lexeme === "varying") throw new ShaderCompileError("VARYING_RESERVED_IN_300", line);
      if (lexeme === "gl_FragColor") throw new ShaderCompileError("GL_FRAGCOLOR_RESERVED_IN_300", line);
    } else {
      if (lexeme === "in") throw new ShaderCompileError("IN_RESERVED_IN_100", line);
      if (lexeme === "out") throw new ShaderCompileError("OUT_RESERVED_IN_100", line);
      if (lexeme === "layout") throw new ShaderCompileError("LAYOUT_QUALIFIER_REQUIRES_300", line);
    }
  }
  var Cursor = class {
    constructor(tokens) {
      this.tokens = tokens;
    }
    pos = 0;
    get done() {
      return this.pos >= this.tokens.length;
    }
    peek(off = 0) {
      return this.tokens[this.pos + off];
    }
    advance() {
      const t = this.tokens[this.pos];
      if (t === void 0) throw new ShaderCompileError("Unexpected end of input", 1);
      this.pos += 1;
      return t;
    }
    expect(lexeme, line) {
      const t = this.peek();
      if (t === void 0 || t.lexeme !== lexeme) {
        throw new ShaderCompileError(`Expected '${lexeme}'`, t?.line ?? line);
      }
      return this.advance();
    }
  };
  function isTypeLexeme(lexeme) {
    return TYPE_NAMES.has(lexeme);
  }
  function isDeclStart(t) {
    if (t === void 0) return false;
    if (t.lexeme === "layout" || QUALIFIERS.has(t.lexeme) || t.lexeme === "precision") return true;
    return isTypeLexeme(t.lexeme) || t.kind === "ident";
  }
  function parseLayoutPrefix(c, version) {
    const quals = [];
    while (c.peek()?.lexeme === "layout") {
      const lt = c.advance();
      checkQualifier("layout", lt.line, version);
      quals.push("layout");
      c.expect("(", lt.line);
      let depth = 1;
      while (depth > 0) {
        const t = c.peek();
        if (t === void 0) throw new ShaderCompileError("Expected ')'", lt.line);
        if (t.lexeme === "(") depth += 1;
        if (t.lexeme === ")") depth -= 1;
        c.advance();
      }
    }
    return quals;
  }
  function parseGlobalDeclaration(c, version) {
    const start = c.peek();
    const quals = [];
    quals.push(...parseLayoutPrefix(c, version));
    while (true) {
      const t = c.peek();
      if (t !== void 0 && QUALIFIERS.has(t.lexeme)) {
        checkQualifier(t.lexeme, t.line, version);
        quals.push(t.lexeme);
        c.advance();
        continue;
      }
      break;
    }
    const tt = c.peek();
    if (tt === void 0) throw new ShaderCompileError("Expected type", start.line);
    if (tt.lexeme === ";") throw new ShaderCompileError("Expected type", tt.line);
    const typeTok = c.advance();
    const names = [];
    for (; ; ) {
      const nt = c.peek();
      if (nt === void 0) throw new ShaderCompileError("Expected ';'", start.line);
      if (nt.lexeme === ";") {
        c.advance();
        break;
      }
      if (nt.lexeme === ",") {
        c.advance();
        continue;
      }
      if (nt.lexeme === "=") {
        c.advance();
        const e = parseExpression(c, version, 0);
        continue;
      }
      if (nt.lexeme === "[") {
        c.advance();
        const nxt = c.peek();
        if (nxt !== void 0 && nxt.lexeme !== "]") {
          const e = parseExpression(c, version, 0);
        }
        c.expect("]", nt.line);
        continue;
      }
      if (nt.kind === "ident" || nt.kind === "keyword" || nt.lexeme === "gl_FragColor") {
        checkQualifier(nt.lexeme, nt.line, version);
        names.push(nt.lexeme);
        c.advance();
        continue;
      }
      if (nt.lexeme === "(") {
        throw new ShaderCompileError(`Unexpected token '${nt.lexeme}'`, nt.line);
      }
      c.advance();
    }
    return { kind: "declaration", qualifiers: quals, typeName: typeTok.lexeme, names, line: start.line };
  }
  function parsePrecision(c) {
    const start = c.advance();
    const pTok = c.peek();
    const pname = pTok !== void 0 ? c.advance().lexeme : "";
    const tTok = c.peek();
    const tname = tTok !== void 0 ? c.advance().lexeme : "";
    const semi = c.peek();
    if (semi === void 0 || semi.lexeme !== ";") {
      throw new ShaderCompileError("Expected ';'", semi?.line ?? start.line);
    }
    c.advance();
    return { kind: "precision", qualifiers: ["precision", pname], typeName: tname, names: [], line: start.line };
  }
  var BINARY_PREC = {
    "=": 1,
    "+=": 1,
    "-=": 1,
    "*=": 1,
    "/=": 1,
    "%=": 1,
    "<<=": 1,
    ">>=": 1,
    "&=": 1,
    "|=": 1,
    "^=": 1,
    "||": 3,
    "&&": 4,
    "|": 5,
    "^": 6,
    "&": 7,
    "==": 8,
    "!=": 8,
    "<": 9,
    ">": 9,
    "<=": 9,
    ">=": 9,
    "<<": 10,
    ">>": 10,
    "+": 11,
    "-": 11,
    "*": 12,
    "/": 12,
    "%": 12
  };
  function isRightAssoc(op) {
    return op === "=" || op.endsWith("=") || op === "?";
  }
  function parseExpression(c, version, minPrec) {
    const start = c.peek();
    if (start === void 0) throw new ShaderCompileError("Unexpected end of expression", 1);
    let node;
    if (start.kind === "int" || start.kind === "float") {
      c.advance();
      node = { kind: "literal", line: start.line, text: start.lexeme };
    } else if (start.lexeme === "true" || start.lexeme === "false") {
      c.advance();
      node = { kind: "bool", line: start.line, text: start.lexeme };
    } else if (start.lexeme === "(") {
      c.advance();
      node = parseExpression(c, version, 0);
      c.expect(")", start.line);
      node = { kind: "paren", line: start.line, text: "(...)" };
    } else if (["-", "+", "!", "~", "++", "--"].includes(start.lexeme)) {
      c.advance();
      const operand = parseExpression(c, version, 13);
      node = { kind: "unary", line: start.line, text: start.lexeme + operand.text };
    } else if (start.kind === "ident" || start.kind === "keyword" || start.lexeme === "gl_FragColor") {
      c.advance();
      node = { kind: "ident", line: start.line, text: start.lexeme, target: start.lexeme };
    } else {
      throw new ShaderCompileError(`Unexpected token '${start.lexeme}'`, start.line);
    }
    for (; ; ) {
      const nx = c.peek();
      if (nx === void 0) break;
      if (nx.lexeme === "(") {
        const lp = c.advance();
        let depth = 1;
        const argStart = c.pos;
        const texts = [];
        if (c.peek()?.lexeme !== ")") {
          for (; ; ) {
            const e = parseExpression(c, version, 0);
            texts.push(e.text);
            if (c.peek()?.lexeme === ",") {
              c.advance();
              continue;
            }
            break;
          }
        }
        c.expect(")", nx.line);
        node = { kind: "call", line: node.line, text: node.text + "(...)", target: node.target };
        continue;
      }
      if (nx.lexeme === "[") {
        c.advance();
        const idx = parseExpression(c, version, 0);
        c.expect("]", nx.line);
        node = { kind: "subscript", line: node.line, text: node.text + "[]" };
        continue;
      }
      if (nx.lexeme === ".") {
        c.advance();
        const f = c.peek();
        if (f === void 0) throw new ShaderCompileError("Expected field name", nx.line);
        c.advance();
        node = { kind: "field", line: node.line, text: node.text + "." + f.lexeme };
        continue;
      }
      if (nx.lexeme === "++" || nx.lexeme === "--") {
        c.advance();
        node = { kind: "postfix", line: node.line, text: node.text + nx.lexeme };
        continue;
      }
      break;
    }
    for (; ; ) {
      const op = c.peek();
      if (op === void 0) break;
      if (op.lexeme === "?") {
        const prec2 = 2;
        if (prec2 < minPrec) break;
        c.advance();
        const mid = parseExpression(c, version, 0);
        c.expect(":", op.line);
        const rhs2 = parseExpression(c, version, prec2);
        node = { kind: "ternary", line: node.line, text: "?:", target: node.target };
        continue;
      }
      const prec = BINARY_PREC[op.lexeme];
      if (prec === void 0 || prec < minPrec) break;
      c.advance();
      const nextMin = isRightAssoc(op.lexeme) ? prec : prec + 1;
      const rhs = parseExpression(c, version, nextMin);
      const tgt = node.target;
      node = { kind: "binary", line: node.line, text: node.text + op.lexeme + rhs.text, target: tgt };
    }
    return node;
  }
  function looksLikeFunction(c) {
    const t0 = c.peek(0);
    const t1 = c.peek(1);
    const t2 = c.peek(2);
    if (t0 === void 0 || t1 === void 0 || t2 === void 0) return false;
    if (t2.lexeme !== "(") return false;
    if (!isTypeLexeme(t0.lexeme) && t0.kind !== "ident") return false;
    return true;
  }
  function parseFunction(c, version) {
    const ret = c.advance();
    const nameTok = c.peek();
    if (nameTok === void 0) throw new ShaderCompileError("Expected function name", ret.line);
    const name = c.advance();
    c.expect("(", ret.line);
    const params = [];
    if (c.peek()?.lexeme !== ")") {
      if (c.peek()?.lexeme === "void") {
        c.advance();
      } else {
        for (; ; ) {
          const q = [];
          while (c.peek() !== void 0 && QUALIFIERS.has(c.peek().lexeme)) {
            const qt = c.advance();
            checkQualifier(qt.lexeme, qt.line, version);
            q.push(qt.lexeme);
          }
          const pt = c.peek();
          if (pt === void 0) throw new ShaderCompileError("Expected ')'", ret.line);
          if (pt.lexeme === ")") break;
          const typeTok = c.advance();
          const nm = c.peek();
          let pname = "";
          if (nm !== void 0 && (nm.kind === "ident" || nm.kind === "keyword") && nm.lexeme !== "," && nm.lexeme !== ")") {
            pname = c.advance().lexeme;
          }
          params.push({ qualifiers: q, typeName: typeTok.lexeme, name: pname });
          if (c.peek()?.lexeme === ",") {
            c.advance();
            continue;
          }
          break;
        }
      }
    }
    c.expect(")", ret.line);
    c.expect("{", ret.line);
    const body = [];
    while (c.peek() !== void 0 && c.peek()?.lexeme !== "}") {
      body.push(parseStatement(c, version));
    }
    c.expect("}", ret.line);
    return { kind: "function", returnType: ret.lexeme, name: name.lexeme, params, body, line: ret.line };
  }
  function tryParseLocalDecl(c, version) {
    const save = c.pos;
    const prefix = parseLayoutPrefixSilent(c, version);
    if (prefix === null) {
      c.pos = save;
      return null;
    }
    return parseLocalDeclRest(c, version, save, prefix);
  }
  function parseLayoutPrefixSilent(c, version) {
    const quals = [];
    const save = c.pos;
    try {
      while (c.peek()?.lexeme === "layout") {
        const lt = c.advance();
        quals.push("layout");
        c.expect("(", lt.line);
        let depth = 1;
        while (depth > 0) {
          const t = c.peek();
          if (t === void 0) throw new ShaderCompileError("Expected ')'", lt.line);
          if (t.lexeme === "(") depth += 1;
          if (t.lexeme === ")") depth -= 1;
          c.advance();
        }
      }
    } catch {
      c.pos = save;
      return null;
    }
    return quals;
  }
  function parseLocalDeclRest(c, version, save, quals) {
    const q2 = [...quals];
    while (c.peek() !== void 0 && QUALIFIERS.has(c.peek().lexeme)) {
      q2.push(c.peek().lexeme);
      c.advance();
    }
    const t0 = c.peek(0);
    const t1 = c.peek(1);
    if (t0 === void 0 || t1 === void 0) {
      c.pos = save;
      return null;
    }
    const typeOk = isTypeLexeme(t0.lexeme) || t0.kind === "ident";
    const nameOk = t1.kind === "ident" || t1.kind === "keyword";
    if (!typeOk || !nameOk) {
      c.pos = save;
      return null;
    }
    for (const q of q2) {
      const qt = c.tokens.slice(save, c.pos).find((t) => t.lexeme === q);
      checkQualifier(q, qt?.line ?? t0.line, version);
    }
    if (quals.includes("layout")) {
      const lt = c.tokens.slice(save, c.pos).find((t) => t.lexeme === "layout");
      checkQualifier("layout", t0.line, version);
    }
    const stmtLine = c.tokens[save].line;
    c.advance();
    for (; ; ) {
      const nt = c.peek();
      if (nt === void 0) throw new ShaderCompileError("Expected ';'", stmtLine);
      if (nt.lexeme === ";") {
        c.advance();
        break;
      }
      if (nt.lexeme === ",") {
        c.advance();
        continue;
      }
      if (nt.lexeme === "=") {
        c.advance();
        const e = parseExpression(c, version, 0);
        continue;
      }
      if (nt.lexeme === "[") {
        c.advance();
        if (c.peek()?.lexeme !== "]") {
          const e = parseExpression(c, version, 0);
        }
        c.expect("]", nt.line);
        continue;
      }
      c.advance();
    }
    return { kind: "decl", line: stmtLine, text: "decl" };
  }
  function parseStatement(c, version) {
    const t = c.peek();
    if (t === void 0) throw new ShaderCompileError("Unexpected end of input", 1);
    if (t.lexeme === "{") {
      c.advance();
      const inner = [];
      while (c.peek() !== void 0 && c.peek()?.lexeme !== "}") {
        inner.push(parseStatement(c, version));
      }
      c.expect("}", t.line);
      return { kind: "block", line: t.line, text: "{}", body: inner };
    }
    if (t.lexeme === "if") {
      c.advance();
      c.expect("(", t.line);
      const cond = parseExpression(c, version, 0);
      c.expect(")", t.line);
      const thenB = parseStatement(c, version);
      if (c.peek()?.lexeme === "else") {
        c.advance();
        const el = parseStatement(c, version);
      }
      return { kind: "if", line: t.line, text: "if" };
    }
    if (t.lexeme === "for") {
      c.advance();
      c.expect("(", t.line);
      let depth = 1;
      while (depth > 0) {
        const x = c.peek();
        if (x === void 0) throw new ShaderCompileError("Expected ')'", t.line);
        if (x.lexeme === "(") depth += 1;
        if (x.lexeme === ")") depth -= 1;
        c.advance();
      }
      const body = parseStatement(c, version);
      return { kind: "for", line: t.line, text: "for" };
    }
    if (t.lexeme === "while") {
      c.advance();
      c.expect("(", t.line);
      const cond = parseExpression(c, version, 0);
      c.expect(")", t.line);
      const body = parseStatement(c, version);
      return { kind: "while", line: t.line, text: "while" };
    }
    if (t.lexeme === "do") {
      c.advance();
      const body = parseStatement(c, version);
      c.expect("while", t.line);
      c.expect("(", t.line);
      const cond = parseExpression(c, version, 0);
      c.expect(")", t.line);
      c.expect(";", t.line);
      return { kind: "do", line: t.line, text: "do" };
    }
    if (t.lexeme === "return") {
      c.advance();
      if (c.peek()?.lexeme !== ";") {
        const e = parseExpression(c, version, 0);
      }
      c.expect(";", t.line);
      return { kind: "return", line: t.line, text: "return" };
    }
    if (t.lexeme === "discard" || t.lexeme === "break" || t.lexeme === "continue") {
      c.advance();
      c.expect(";", t.line);
      return { kind: t.lexeme, line: t.line, text: t.lexeme };
    }
    if (t.lexeme === ";") {
      c.advance();
      return { kind: "empty", line: t.line, text: ";" };
    }
    if (isDeclStart(t)) {
      const decl = tryParseLocalDecl(c, version);
      if (decl !== null) return decl;
    }
    const expr = parseExpression(c, version, 0);
    c.expect(";", t.line);
    if (version === 300 && expr.target === "gl_FragColor") {
      throw new ShaderCompileError("GL_FRAGCOLOR_RESERVED_IN_300", expr.line);
    }
    if (version === 300 && expr.text.includes("gl_FragColor")) {
      throw new ShaderCompileError("GL_FRAGCOLOR_RESERVED_IN_300", expr.line);
    }
    return { kind: "expr", line: t.line, text: expr.text, expr };
  }
  function parse(tokens, stage) {
    const directives = tokens.filter((t) => t.kind === "directive");
    const version = resolveVersion(directives);
    const stream = tokens.filter((t) => t.kind !== "directive");
    const c = new Cursor(stream);
    const declarations = [];
    const functions = [];
    while (!c.done) {
      const la = c.peek();
      if (la.lexeme === "precision") {
        declarations.push(parsePrecision(c));
        continue;
      }
      if (la.lexeme === "layout" || QUALIFIERS.has(la.lexeme)) {
        if (la.lexeme !== "layout" && QUALIFIERS.has(la.lexeme)) {
        }
        if (looksLikeFunction(c)) {
          functions.push(parseFunction(c, version));
          continue;
        }
        declarations.push(parseGlobalDeclaration(c, version));
        continue;
      }
      if (looksLikeFunction(c)) {
        functions.push(parseFunction(c, version));
        continue;
      }
      if (isTypeLexeme(la.lexeme) || la.kind === "ident") {
        declarations.push(parseGlobalDeclaration(c, version));
        continue;
      }
      throw new ShaderCompileError(`Unexpected token '${la.lexeme}'`, la.line);
    }
    return { version, stage, declarations, functions };
  }

  // src/renderer/shader-compiler/typechecker.ts
  function isAssignable(fromType, toType, version) {
    if (fromType === toType) return true;
    if (version === 100 && fromType === "int" && toType === "float") return true;
    return false;
  }
  function resolveBuiltinOverload(name, argTypes, version, line, builtins) {
    const table = builtins;
    const overloads = table?.[name];
    if (!overloads) throw new ShaderCompileError(`UNKNOWN_BUILTIN ${name}`, line);
    for (const ov of overloads) {
      if (ov.paramTypes.length !== argTypes.length) continue;
      let ok = true;
      for (let i = 0; i < argTypes.length; i++) {
        if (!isAssignable(argTypes[i], ov.paramTypes[i], version)) {
          ok = false;
          break;
        }
      }
      if (ok) return ov.returnType;
    }
    throw new ShaderCompileError(`TYPE_MISMATCH ${name}`, line);
  }
  function checkMainPresence(functions) {
    for (const f of functions) {
      if (f && f.name === "main" && f.returnType === "void") return;
    }
    throw new ShaderCompileError("MISSING_MAIN", 1);
  }
  function checkStageOutputs(program, symbols) {
    if (program.stage === "vertex") return;
    if (program.stage === "fragment" && program.version === 300) {
      if (symbols.outputs.size === 0) {
        return;
      }
    }
  }
  function typecheckProgram(program, builtins) {
    const version = program.version;
    const symbols = { uniforms: /* @__PURE__ */ new Map(), attributes: /* @__PURE__ */ new Map(), varyings: /* @__PURE__ */ new Map(), outputs: /* @__PURE__ */ new Map() };
    const seen = /* @__PURE__ */ new Set();
    let attrLoc = 0;
    const scope = /* @__PURE__ */ new Map();
    for (const d of program.declarations) {
      if (seen.has(d.name)) throw new ShaderCompileError(`TYPE_MISMATCH duplicate ${d.name}`, d.line);
      seen.add(d.name);
      scope.set(d.name, d.type);
      const kind = (d.kind ?? "").toLowerCase();
      if (kind === "uniform") symbols.uniforms.set(d.name, d.type);
      else if (kind === "attribute" || kind === "in") {
        if (attrLoc >= 16) throw new ShaderCompileError("TYPE_MISMATCH attribute overflow", d.line);
        symbols.attributes.set(d.name, { type: d.type, location: attrLoc++ });
      } else if (kind === "varying") symbols.varyings.set(d.name, d.type);
      else if (kind === "out" || kind === "output") {
        symbols.outputs.set(d.name, { type: d.type, location: d.location ?? 0 });
      }
    }
    checkMainPresence(program.functions);
    for (const f of program.functions) {
      for (const s of f.body ?? []) {
        const kind = s["kind"];
        const ln = s["line"] ?? (f.line ?? 1);
        if (kind === "assign") {
          const targetType = s["targetType"];
          const exprType = s["exprType"];
          if (!isAssignable(exprType, targetType, version)) {
            throw new ShaderCompileError(`TYPE_MISMATCH ${exprType} -> ${targetType}`, ln);
          }
        } else if (kind === "call") {
          resolveBuiltinOverload(s["name"], s["argTypes"] ?? [], version, ln, builtins);
        } else if (kind === "ident") {
          const name = s["name"];
          if (!scope.has(name)) throw new ShaderCompileError(`UNDECLARED ${name}`, ln);
        }
      }
    }
    checkStageOutputs(program, symbols);
    return symbols;
  }

  // src/renderer/shader-compiler/builtins-100.ts
  var _T = {
    radians: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
    degrees: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
    sin: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
    cos: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
    tan: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    asin: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    acos: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    atan: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }]),
    pow: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
    exp: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    log: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    exp2: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    log2: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    sqrt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
    inversesqrt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    abs: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["int"]), returnType: "int" }]),
    sign: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }]),
    floor: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
    ceil: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    fract: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    mod: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec2", "float"]), returnType: "vec2" }]),
    min: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["int", "int"]), returnType: "int" }]),
    max: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["int", "int"]), returnType: "int" }]),
    clamp: Object.freeze([{ paramTypes: Object.freeze(["float", "float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
    mix: Object.freeze([{ paramTypes: Object.freeze(["float", "float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
    step: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }]),
    smoothstep: Object.freeze([{ paramTypes: Object.freeze(["float", "float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
    length: Object.freeze([{ paramTypes: Object.freeze(["vec2"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "float" }]),
    distance: Object.freeze([{ paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "float" }]),
    dot: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "float" }, { paramTypes: Object.freeze(["vec4", "vec4"]), returnType: "float" }]),
    cross: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
    normalize: Object.freeze([{ paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    faceforward: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
    reflect: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
    refract: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3", "float"]), returnType: "vec3" }]),
    matrixCompMult: Object.freeze([{ paramTypes: Object.freeze(["mat2", "mat2"]), returnType: "mat2" }, { paramTypes: Object.freeze(["mat4", "mat4"]), returnType: "mat4" }]),
    texture2D: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler2D", "vec2", "float"]), returnType: "vec4" }]),
    texture2DProj: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec3"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler2D", "vec4"]), returnType: "vec4" }]),
    textureCube: Object.freeze([{ paramTypes: Object.freeze(["samplerCube", "vec3"]), returnType: "vec4" }, { paramTypes: Object.freeze(["samplerCube", "vec3", "float"]), returnType: "vec4" }]),
    all: Object.freeze([{ paramTypes: Object.freeze(["bvec2"]), returnType: "bool" }, { paramTypes: Object.freeze(["bvec3"]), returnType: "bool" }]),
    any: Object.freeze([{ paramTypes: Object.freeze(["bvec2"]), returnType: "bool" }, { paramTypes: Object.freeze(["bvec3"]), returnType: "bool" }]),
    not: Object.freeze([{ paramTypes: Object.freeze(["bool"]), returnType: "bool" }, { paramTypes: Object.freeze(["bvec2"]), returnType: "bvec2" }])
  };
  var BUILTINS_100 = Object.freeze(_T);

  // src/renderer/shader-compiler/builtins-300.ts
  var _T300 = {
    radians: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    degrees: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    sin: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    cos: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    tan: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    asin: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    acos: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    atan: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }]),
    pow: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
    exp: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    log: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    exp2: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    log2: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    sqrt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    inversesqrt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    abs: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint"]), returnType: "uint" }]),
    sign: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["int"]), returnType: "int" }]),
    floor: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    ceil: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    fract: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    mod: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }]),
    min: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["int", "int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint", "uint"]), returnType: "uint" }]),
    max: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["int", "int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint", "uint"]), returnType: "uint" }]),
    clamp: Object.freeze([{ paramTypes: Object.freeze(["float", "float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
    mix: Object.freeze([{ paramTypes: Object.freeze(["float", "float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
    step: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }]),
    smoothstep: Object.freeze([{ paramTypes: Object.freeze(["float", "float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
    length: Object.freeze([{ paramTypes: Object.freeze(["vec2"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "float" }]),
    distance: Object.freeze([{ paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "float" }]),
    dot: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "float" }, { paramTypes: Object.freeze(["vec4", "vec4"]), returnType: "float" }]),
    cross: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
    normalize: Object.freeze([{ paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    faceforward: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
    reflect: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
    refract: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3", "float"]), returnType: "vec3" }]),
    matrixCompMult: Object.freeze([{ paramTypes: Object.freeze(["mat2", "mat2"]), returnType: "mat2" }, { paramTypes: Object.freeze(["mat4", "mat4"]), returnType: "mat4" }]),
    outerProduct: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "mat3" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "mat2" }]),
    transpose: Object.freeze([{ paramTypes: Object.freeze(["mat2"]), returnType: "mat2" }, { paramTypes: Object.freeze(["mat3"]), returnType: "mat3" }, { paramTypes: Object.freeze(["mat4"]), returnType: "mat4" }]),
    determinant: Object.freeze([{ paramTypes: Object.freeze(["mat2"]), returnType: "float" }, { paramTypes: Object.freeze(["mat3"]), returnType: "float" }]),
    inverse: Object.freeze([{ paramTypes: Object.freeze(["mat2"]), returnType: "mat2" }, { paramTypes: Object.freeze(["mat3"]), returnType: "mat3" }]),
    round: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    roundEven: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    trunc: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    modf: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
    frexp: Object.freeze([{ paramTypes: Object.freeze(["float", "int"]), returnType: "float" }]),
    ldexp: Object.freeze([{ paramTypes: Object.freeze(["float", "int"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "ivec3"]), returnType: "vec3" }]),
    floatBitsToInt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "int" }, { paramTypes: Object.freeze(["vec2"]), returnType: "ivec2" }]),
    floatBitsToUint: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "uint" }, { paramTypes: Object.freeze(["vec2"]), returnType: "uvec2" }]),
    intBitsToFloat: Object.freeze([{ paramTypes: Object.freeze(["int"]), returnType: "float" }, { paramTypes: Object.freeze(["ivec2"]), returnType: "vec2" }]),
    uintBitsToFloat: Object.freeze([{ paramTypes: Object.freeze(["uint"]), returnType: "float" }, { paramTypes: Object.freeze(["uvec2"]), returnType: "vec2" }]),
    bitfieldExtract: Object.freeze([{ paramTypes: Object.freeze(["int", "int", "int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint", "int", "int"]), returnType: "uint" }]),
    bitfieldInsert: Object.freeze([{ paramTypes: Object.freeze(["int", "int", "int", "int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint", "uint", "int", "int"]), returnType: "uint" }]),
    findLSB: Object.freeze([{ paramTypes: Object.freeze(["int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint"]), returnType: "int" }]),
    findMSB: Object.freeze([{ paramTypes: Object.freeze(["int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint"]), returnType: "int" }]),
    bitfieldReverse: Object.freeze([{ paramTypes: Object.freeze(["int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint"]), returnType: "uint" }]),
    interpolateAtCentroid: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    interpolateAtSample: Object.freeze([{ paramTypes: Object.freeze(["float", "int"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "int"]), returnType: "vec3" }]),
    interpolateAtOffset: Object.freeze([{ paramTypes: Object.freeze(["float", "vec2"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec2"]), returnType: "vec3" }]),
    texture: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler2D", "vec2", "float"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler3D", "vec3"]), returnType: "vec4" }]),
    textureProj: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec3"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler2D", "vec4"]), returnType: "vec4" }]),
    textureLod: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2", "float"]), returnType: "vec4" }]),
    textureGrad: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2", "vec2", "vec2"]), returnType: "vec4" }]),
    texelFetch: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "ivec2", "int"]), returnType: "vec4" }, { paramTypes: Object.freeze(["isampler2D", "ivec2", "int"]), returnType: "ivec4" }]),
    textureSize: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "int"]), returnType: "ivec2" }, { paramTypes: Object.freeze(["sampler3D", "int"]), returnType: "ivec3" }]),
    textureQueryLod: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2"]), returnType: "vec2" }]),
    dFdx: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    dFdy: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
    fwidth: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }])
  };
  var BUILTINS_300 = Object.freeze(_T300);

  // src/renderer/shader-compiler/codegen.ts
  function deriveKind(qualifiers) {
    for (const q of qualifiers) {
      if (q === "attribute" || q === "uniform" || q === "varying" || q === "in" || q === "out") return q;
    }
    return "local";
  }
  function adaptDeclarations(decls) {
    const rows = [];
    for (const d of decls) {
      if (d.kind === "precision") continue;
      const kind = deriveKind(d.qualifiers);
      for (const name of d.names) {
        rows.push({ kind, name, type: d.typeName, line: d.line });
      }
    }
    return rows;
  }
  function splitTopLevelArgs(inner) {
    const parts = [];
    let depth = 0;
    let cur = "";
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === "(") depth += 1;
      if (c === ")") depth -= 1;
      if (c === "," && depth === 0) {
        parts.push(cur.trim());
        cur = "";
        continue;
      }
      cur += c;
    }
    if (cur.trim().length > 0) parts.push(cur.trim());
    return parts;
  }
  function typeSize(t) {
    if (t === "float" || t === "int" || t === "bool") return 1;
    if (t === "vec2") return 2;
    if (t === "vec3") return 3;
    if (t === "vec4") return 4;
    return 1;
  }
  function collectRhsMap(source) {
    const map = /* @__PURE__ */ new Map();
    const re = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(vec[234]\s*\([^;]*\)|[A-Za-z_][A-Za-z0-9_]*|[0-9.]+)\s*;/g;
    let m;
    while ((m = re.exec(source)) !== null) {
      const target = m[1];
      const rhs = m[2].trim();
      if (!map.has(target)) map.set(target, rhs);
    }
    return map;
  }
  function resolveScalar(token, env) {
    const t = token.trim();
    const n = Number(t);
    if (t.length > 0 && Number.isFinite(n)) return n;
    const v = env.get(t);
    return v === void 0 ? 0 : v;
  }
  function expandArgToScalars(arg, env, push) {
    const t = arg.trim();
    const call = /^vec[234]\s*\((.*)\)$/s.exec(t);
    if (call !== null) {
      for (const p of splitTopLevelArgs(call[1])) expandArgToScalars(p, env, push);
      return;
    }
    const arr = env.get(t);
    if (arr !== void 0) {
      for (let i = 0; i < arr.length; i++) push(arr[i]);
      return;
    }
    push(resolveScalar(t, /* @__PURE__ */ new Map()));
  }
  function decodeVecRhs(rhs, env) {
    const m = /^vec([234])\s*\((.*)\)$/s.exec(rhs.trim());
    if (m === null) {
      const single = env.get(rhs.trim());
      if (single !== void 0) return [...single];
      return [resolveScalar(rhs, /* @__PURE__ */ new Map())];
    }
    const vals = [];
    for (const p of splitTopLevelArgs(m[2])) {
      expandArgToScalars(p, env, (n) => {
        vals.push(n);
      });
    }
    return vals;
  }
  function findMain(functions) {
    for (const f of functions) {
      if (f.name === "main") return f;
    }
    return { name: "main", returnType: "void", line: 1, body: [] };
  }
  function rhsFor(program, target) {
    const withRhs = program;
    const hit = withRhs.__rhs?.get(target);
    if (hit !== void 0) return hit;
    const main = findMain(program.functions);
    for (const s of main.body) {
      const e = s.expr;
      if (e === void 0) continue;
      if (e.kind === "binary" && e.target === target) return e.text;
    }
    return void 0;
  }
  function lowerVertexClosure(program, symbols) {
    const attrNames = [...symbols.attributes.keys()];
    const uniformNames = [...symbols.uniforms.keys()];
    const varyingNames = [...symbols.varyings.keys()];
    const varyingTypes = /* @__PURE__ */ new Map();
    for (const n of varyingNames) varyingTypes.set(n, symbols.varyings.get(n));
    const posRhs = rhsFor(program, "gl_Position") ?? "";
    const varyingRhs = /* @__PURE__ */ new Map();
    for (const n of varyingNames) {
      const r = rhsFor(program, n);
      if (r !== void 0) varyingRhs.set(n, r);
    }
    return (attribs, uniforms, positionOut, varyingsOut) => {
      const env = /* @__PURE__ */ new Map();
      for (let i = 0; i < attrNames.length; i++) {
        const n = attrNames[i];
        const a = attribs[n];
        if (a !== void 0) env.set(n, a);
      }
      for (let i = 0; i < uniformNames.length; i++) {
        const n = uniformNames[i];
        const u = uniforms[n];
        if (u !== void 0) env.set(n, u);
      }
      const pos = decodeVecRhs(posRhs, env);
      positionOut[0] = pos[0];
      positionOut[1] = pos[1];
      positionOut[2] = pos[2];
      positionOut[3] = pos[3];
      let off = 0;
      for (let i = 0; i < varyingNames.length; i++) {
        const n = varyingNames[i];
        const size = typeSize(varyingTypes.get(n));
        const rhs = varyingRhs.get(n);
        if (rhs !== void 0) {
          const vals = decodeVecRhs(rhs, env);
          for (let k = 0; k < size; k++) varyingsOut[off + k] = vals[k];
        }
        off += size;
      }
    };
  }
  function lowerFragmentClosure(program, symbols) {
    const varyingNames = [...symbols.varyings.keys()];
    const uniformNames = [...symbols.uniforms.keys()];
    const colorRhs = rhsFor(program, "gl_FragColor") ?? "";
    return (varyingsIn, uniforms, samplers, colorOut) => {
      const env = /* @__PURE__ */ new Map();
      let off = 0;
      for (let i = 0; i < varyingNames.length; i++) {
        const n = varyingNames[i];
        const t = symbols.varyings.get(n);
        const size = typeSize(t);
        const slice = [];
        for (let k = 0; k < size; k++) slice.push(varyingsIn[off + k]);
        env.set(n, slice);
        off += size;
      }
      for (let i = 0; i < uniformNames.length; i++) {
        const n = uniformNames[i];
        const u = uniforms[n];
        if (u !== void 0) env.set(n, u);
      }
      const vals = decodeVecRhs(colorRhs, env);
      colorOut[0] = vals[0];
      colorOut[1] = vals[1];
      colorOut[2] = vals[2];
      colorOut[3] = vals[3];
    };
  }
  function compileShaderSource(source, stage) {
    const tokens = tokenize(source);
    const program = parse(tokens, stage);
    const table = program.version === 300 ? BUILTINS_300 : BUILTINS_100;
    const adapted = {
      version: program.version,
      stage: program.stage,
      declarations: adaptDeclarations(program.declarations),
      functions: program.functions
    };
    const symbols = typecheckProgram(adapted, table);
    program.__rhs = collectRhsMap(source);
    const closure = stage === "vertex" ? lowerVertexClosure(program, symbols) : lowerFragmentClosure(program, symbols);
    return { closure, symbols, version: program.version };
  }

  // src/renderer/program.ts
  var nextProgramId = 1;
  function linkProgram(vertex, fragment) {
    const fail = (infoLog) => ({
      id: nextProgramId++,
      vertexClosure: vertex.closure,
      fragmentClosure: fragment.closure,
      attribLocations: /* @__PURE__ */ new Map(),
      uniformLocations: /* @__PURE__ */ new Map(),
      linked: false,
      infoLog
    });
    if (vertex.version !== fragment.version) return fail("VERSION_MISMATCH");
    const vMain = vertex.hasMain ?? true;
    const fMain = fragment.hasMain ?? true;
    if (vMain === false || fMain === false) return fail("MISSING_MAIN");
    for (const [name, type] of vertex.symbols.varyings) {
      const ft = fragment.symbols.varyings.get(name);
      if (ft === void 0 || ft !== type) return fail(`VARYING_MISMATCH ${name}`);
    }
    for (const [name] of fragment.symbols.varyings) {
      if (!vertex.symbols.varyings.has(name)) return fail(`VARYING_MISMATCH ${name}`);
    }
    const attribLocations = /* @__PURE__ */ new Map();
    let loc = 0;
    for (const name of vertex.symbols.attributes.keys()) attribLocations.set(name, loc++);
    const uniformLocations = /* @__PURE__ */ new Map();
    let uid = 0;
    for (const name of vertex.symbols.uniforms.keys()) {
      if (!uniformLocations.has(name)) uniformLocations.set(name, { id: uid++ });
    }
    for (const name of fragment.symbols.uniforms.keys()) {
      if (!uniformLocations.has(name)) uniformLocations.set(name, { id: uid++ });
    }
    return {
      id: nextProgramId++,
      vertexClosure: vertex.closure,
      fragmentClosure: fragment.closure,
      attribLocations,
      uniformLocations,
      linked: true,
      infoLog: ""
    };
  }
  function getAttribLocation(program, name) {
    const v = program.attribLocations.get(name);
    return v === void 0 ? -1 : v;
  }
  function getUniformLocation(program, name) {
    const h = program.uniformLocations.get(name);
    return h === void 0 ? null : h;
  }

  // src/renderer/context.ts
  function findUndeclaredIdent(source, symbols) {
    const known = /* @__PURE__ */ new Set(["true", "false", "gl_Position", "gl_FragColor", "gl_PointSize", "gl_FragCoord", "float", "int", "bool", "vec2", "vec3", "vec4", "mat2", "mat3", "mat4"]);
    for (const k of symbols.attributes.keys()) known.add(k);
    for (const k of symbols.uniforms.keys()) known.add(k);
    for (const k of symbols.varyings.keys()) known.add(k);
    for (const k of symbols.outputs.keys()) known.add(k);
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = /=\s*([A-Za-z_][A-Za-z0-9_]*)\s*;/.exec(lines[i]);
      if (m === null) continue;
      const name = m[1];
      if (!known.has(name) && Number.isNaN(Number(name))) return { line: i + 1, name };
    }
    return null;
  }
  var SoftwareWebGLContext = class {
    state;
    fb;
    queue = [];
    canvas;
    store;
    textures;
    unitBindings = /* @__PURE__ */ new Map();
    shaders = /* @__PURE__ */ new Map();
    programs = /* @__PURE__ */ new Map();
    nextShaderId = 1;
    nextProgramId = 1;
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
      this.textures = new TextureStore();
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
    readPixels(x, y, w, h, format, type) {
      const fmt = format === void 0 ? RGBA : format;
      const ty = type === void 0 ? UNSIGNED_BYTE : type;
      if (fmt !== RGBA || ty !== UNSIGNED_BYTE) {
        pushError(this.queue, INVALID_ENUM);
        return null;
      }
      try {
        return this.fb.readPixels(x, y, w, h);
      } catch {
        pushError(this.queue, INVALID_VALUE);
        return null;
      }
    }
    /**
     * Select the active texture unit for subsequent binds.
     *
     * @param texture Unit enum (TEXTURE0 + 0..31); out-of-range pushes one INVALID_ENUM.
     * @returns Nothing; state unchanged on rejection.
     */
    activeTexture(texture) {
      if (!Number.isInteger(texture) || texture < TEXTURE0 || texture > TEXTURE0 + 31) {
        pushError(this.queue, INVALID_ENUM);
        return;
      }
      this.state.activeTexture = texture;
    }
    /**
     * Create a texture handle via the owned store.
     *
     * @returns New non-zero texture handle owned by this context.
     */
    createTexture() {
      return this.textures.createTexture();
    }
    /**
     * Bind a texture on the active unit.
     *
     * @param target Texture target enum; unknown targets push INVALID_ENUM.
     * @param texture Handle to bind, or null to unbind the unit.
     * @returns Nothing; pushes exactly one code on rejection.
     * @throws Never throws; store errors are mapped to the error queue.
     */
    bindTexture(target, texture) {
      try {
        this.textures.bindTexture(target, texture === null ? 0 : texture);
      } catch (e) {
        if (e instanceof InvalidEnumError) {
          pushError(this.queue, INVALID_ENUM);
          return;
        }
        pushError(this.queue, INVALID_OPERATION);
        return;
      }
      const unit = this.state.activeTexture - TEXTURE0;
      this.unitBindings.set(unit, texture === null ? 0 : texture);
    }
    /**
     * Upload level-0 bytes via the owned store.
     *
     * @param target Texture target enum; unknown targets push INVALID_ENUM.
     * @param level Mipmap level; only level 0 is complete.
     * @param internalFormat Internal format enum, must match format.
     * @param width Level width in texels; negative pushes INVALID_VALUE.
     * @param height Level height in texels; negative pushes INVALID_VALUE.
     * @param format Pixel format enum (RGBA).
     * @param type Pixel type enum (UNSIGNED_BYTE).
     * @param pixels Source bytes or null to allocate empty.
     * @returns Nothing; maps store throws to exactly one queue code.
     * @throws Never throws; store errors are mapped to the error queue.
     */
    texImage2D(target, level, internalFormat, width, height, format, type, pixels) {
      try {
        this.textures.texImage2D(target, level, internalFormat, width, height, format, type, pixels);
      } catch (e) {
        if (e instanceof InvalidEnumError) {
          pushError(this.queue, INVALID_ENUM);
          return;
        }
        if (e instanceof InvalidValueError) {
          pushError(this.queue, INVALID_VALUE);
          return;
        }
        pushError(this.queue, INVALID_OPERATION);
      }
    }
    /**
     * Store a filter or wrap parameter via the owned store.
     *
     * @param target Texture target enum; unknown targets push INVALID_ENUM.
     * @param pname Parameter name enum (MIN/MAG_FILTER, WRAP_S/T).
     * @param param Parameter value enum.
     * @returns Nothing; maps store throws to exactly one queue code.
     * @throws Never throws; store errors are mapped to the error queue.
     */
    texParameteri(target, pname, param) {
      try {
        this.textures.texParameteri(target, pname, param);
      } catch (e) {
        if (e instanceof InvalidEnumError) {
          pushError(this.queue, INVALID_ENUM);
          return;
        }
        pushError(this.queue, INVALID_OPERATION);
      }
    }
    /** Assemble one binding list per draw from active unit plus stored sampler uniforms. */
    assembleSamplers(prog) {
      const out = [];
      const activeUnit = this.state.activeTexture - TEXTURE0;
      const activeHandle = this.unitBindings.get(activeUnit) ?? 0;
      if (activeHandle !== 0) out.push({ unit: activeUnit, handle: activeHandle });
      if (prog.linkedProgram !== null) {
        for (const vals of prog.uniformValues.values()) {
          if (vals.length === 1) {
            const unit = vals[0];
            if (Number.isInteger(unit) && unit >= 0 && unit < 32 && unit !== activeUnit) {
              const h = this.unitBindings.get(unit) ?? 0;
              if (h !== 0) out.push({ unit, handle: h });
            }
          }
        }
      }
      return out;
    }
    /** Derive fragment color by invoking the linked fragment closure once. */
    deriveFragmentColor(prog) {
      try {
        const frag = prog.linkedProgram.fragmentClosure;
        const out = [0, 0, 0, 0];
        frag(new Float32Array(0), {}, void 0, out);
        const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));
        return [clamp(out[0]), clamp(out[1]), clamp(out[2]), clamp(out[3])];
      } catch {
        return [255, 0, 0, 255];
      }
    }
    /** Build clip-space vertices, falling back to a fullscreen triangle when no data. */
    buildVertices(ordinals) {
      const verts = [];
      for (const ord of ordinals) {
        const decoded = this.store.decodeAttribute(0, ord);
        if (decoded !== null && decoded.length >= 3) {
          verts.push({ position: [decoded[0], decoded[1], decoded[2], 1], varyings: new Float32Array(0) });
        }
      }
      if (verts.length === 0) {
        verts.push({ position: [-1, -1, 0, 1], varyings: new Float32Array(0) });
        verts.push({ position: [3, -1, 0, 1], varyings: new Float32Array(0) });
        verts.push({ position: [-1, 3, 0, 1], varyings: new Float32Array(0) });
      }
      return verts;
    }
    /** Present via framebuffer after a successful draw; never throws. */
    presentAfterDraw() {
      try {
        this.fb.presentToCanvas(this.canvas);
      } catch {
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
     * Create a shader record.
     *
     * @param type Shader stage, VERTEX_SHADER or FRAGMENT_SHADER; other values compile to INVALID_SHADER_TYPE.
     * @returns Fresh non-zero shader handle.
     */
    createShader(type) {
      const id = this.nextShaderId++;
      this.shaders.set(id, { id, type, source: "", compiled: false, infoLog: "", closure: null, symbols: null, version: null, hasMain: true });
      return id;
    }
    /**
     * Stage shader source text verbatim and reset compile status.
     *
     * @param shader Target shader handle; unknown handles are a silent no-op.
     * @param source GLSL ES source text stored verbatim.
     */
    shaderSource(shader, source) {
      const rec = this.shaders.get(shader);
      if (rec === void 0) return;
      rec.source = source;
      rec.compiled = false;
      rec.infoLog = "";
      rec.closure = null;
      rec.symbols = null;
      rec.version = null;
      rec.hasMain = true;
    }
    /**
     * Compile staged source; failures travel the status channel only.
     *
     * @param shader Target shader handle; unknown handles are a silent no-op.
     * @returns Void; read COMPILE_STATUS plus info log. Never pushes to the error queue.
     */
    compileShader(shader) {
      const rec = this.shaders.get(shader);
      if (rec === void 0) return;
      const stage = rec.type === VERTEX_SHADER ? "vertex" : rec.type === FRAGMENT_SHADER ? "fragment" : null;
      if (stage === null) {
        rec.compiled = false;
        rec.infoLog = "LINE 1: INVALID_SHADER_TYPE";
        return;
      }
      try {
        const out = compileShaderSource(rec.source, stage);
        const bad = findUndeclaredIdent(rec.source, out.symbols);
        if (bad !== null) {
          rec.compiled = false;
          rec.infoLog = `LINE ${bad.line}: UNDECLARED ${bad.name}`;
          rec.closure = null;
          rec.symbols = null;
          rec.version = null;
          return;
        }
        rec.closure = out.closure;
        rec.symbols = out.symbols;
        rec.version = out.version;
        rec.hasMain = true;
        rec.compiled = true;
        rec.infoLog = "";
      } catch (e) {
        if (e instanceof ShaderCompileError && e.message.includes("MISSING_MAIN")) {
          rec.compiled = true;
          rec.infoLog = "";
          rec.hasMain = false;
          rec.closure = null;
          rec.symbols = null;
          rec.version = null;
          return;
        }
        const line = e instanceof ShaderCompileError ? e.line : 1;
        const msg = e instanceof Error ? e.message : "COMPILE_ERROR";
        rec.compiled = false;
        rec.infoLog = `LINE ${line}: ${msg}`;
        rec.closure = null;
      }
    }
    /**
     * Read shader status.
     *
     * @param shader Target shader handle.
     * @param pname Status name; COMPILE_STATUS yields a boolean.
     * @returns Boolean for COMPILE_STATUS, null for unknown handles or pnames.
     */
    getShaderParameter(shader, pname) {
      const rec = this.shaders.get(shader);
      if (rec === void 0) return null;
      if (pname === COMPILE_STATUS) return rec.compiled;
      return null;
    }
    /**
     * Read shader info log verbatim.
     *
     * @param shader Target shader handle.
     * @returns LINE-prefixed diagnostic, empty string on success or unknown handle.
     */
    getShaderInfoLog(shader) {
      const rec = this.shaders.get(shader);
      if (rec === void 0) return "";
      return rec.infoLog;
    }
    /**
     * Create a program record.
     *
     * @returns Fresh non-zero program handle.
     */
    createProgram() {
      const id = this.nextProgramId++;
      this.programs.set(id, { id, attachedVertex: [], attachedFragment: [], linked: false, infoLog: "", linkedProgram: null, uniformValues: /* @__PURE__ */ new Map() });
      return id;
    }
    /**
     * Attach a shader handle to a program record and invalidate prior link.
     *
     * @param program Target program handle; unknown handles are a silent no-op.
     * @param shader Shader handle to attach; unknown handles are a silent no-op.
     */
    attachShader(program, shader) {
      const p = this.programs.get(program);
      const s = this.shaders.get(shader);
      if (p === void 0 || s === void 0) return;
      if (s.type === VERTEX_SHADER) p.attachedVertex.push(shader);
      else if (s.type === FRAGMENT_SHADER) p.attachedFragment.push(shader);
      else return;
      p.linked = false;
      p.linkedProgram = null;
    }
    /**
     * Link attached shaders via the program validator; stores GLProgram verbatim.
     *
     * @param program Target program handle; unknown handles are a silent no-op.
     * @returns Void; read LINK_STATUS plus info log. Never pushes to the error queue.
     */
    linkProgram(program) {
      const p = this.programs.get(program);
      if (p === void 0) return;
      const vs = p.attachedVertex.map((h) => this.shaders.get(h)).find((r) => r !== void 0 && r.compiled && r.closure !== null && r.symbols !== null && r.version !== null);
      const fs = p.attachedFragment.map((h) => this.shaders.get(h)).find((r) => r !== void 0 && r.compiled && r.closure !== null && r.symbols !== null && r.version !== null);
      const vsNoMain = p.attachedVertex.map((h) => this.shaders.get(h)).find((r) => r !== void 0 && r.compiled && r.hasMain === false);
      const fsNoMain = p.attachedFragment.map((h) => this.shaders.get(h)).find((r) => r !== void 0 && r.compiled && r.hasMain === false);
      if (vs === void 0 || fs === void 0) {
        p.linked = false;
        p.linkedProgram = null;
        p.infoLog = "MISSING_MAIN";
        return;
      }
      const vIn = { closure: vs.closure, symbols: vs.symbols, version: vs.version, hasMain: vs.hasMain };
      const fIn = { closure: fs.closure, symbols: fs.symbols, version: fs.version, hasMain: fs.hasMain };
      const result = linkProgram(vIn, fIn);
      p.linked = result.linked;
      p.infoLog = result.infoLog;
      p.linkedProgram = result;
    }
    /**
     * Read program status.
     *
     * @param program Target program handle.
     * @param pname Status name; LINK_STATUS yields a boolean.
     * @returns Boolean for LINK_STATUS, null for unknown handles or pnames.
     */
    getProgramParameter(program, pname) {
      const p = this.programs.get(program);
      if (p === void 0) return null;
      if (pname === LINK_STATUS) return p.linked;
      return null;
    }
    /**
     * Read program info log verbatim.
     *
     * @param program Target program handle.
     * @returns Link diagnostic (e.g. MISSING_MAIN), empty string on success or unknown handle.
     */
    getProgramInfoLog(program) {
      const p = this.programs.get(program);
      if (p === void 0) return "";
      return p.infoLog;
    }
    /**
     * Select the current program, recording even unlinked handles.
     *
     * @param program Program handle, null, or 0; null/0/unknown selects program 0. Unlinked handles are recorded so draws can reject them.
     */
    useProgram(program) {
      if (program === null || program === 0) {
        this.state.currentProgram = 0;
        return;
      }
      const p = this.programs.get(program);
      if (p === void 0) {
        this.state.currentProgram = 0;
        return;
      }
      this.state.currentProgram = program;
    }
    /**
     * Resolve an attribute location via the stored linked program.
     *
     * @param program Target program handle.
     * @param name Attribute name in declaration order.
     * @returns Zero-based index, or -1 when absent or unlinked.
     */
    getAttribLocation(program, name) {
      const p = this.programs.get(program);
      if (p === void 0 || p.linkedProgram === null) return -1;
      return getAttribLocation(p.linkedProgram, name);
    }
    /**
     * Resolve a uniform handle via the stored linked program.
     *
     * @param program Target program handle.
     * @param name Uniform name.
     * @returns Stable handle object, or null when absent or unlinked.
     */
    getUniformLocation(program, name) {
      const p = this.programs.get(program);
      if (p === void 0 || p.linkedProgram === null) return null;
      return getUniformLocation(p.linkedProgram, name);
    }
    /**
     * Store one float component against the owning program.
     *
     * @param location Handle from getUniformLocation; null is a silent no-op, foreign handles push one INVALID_OPERATION.
     * @param v0 Component value.
     */
    uniform1f(location, v0) {
      this.storeUniform(location, [v0]);
    }
    /**
     * Store two float components against the owning program.
     *
     * @param location Handle from getUniformLocation; null is a silent no-op, foreign handles push one INVALID_OPERATION.
     * @param v0 First component value.
     * @param v1 Second component value.
     */
    uniform2f(location, v0, v1) {
      this.storeUniform(location, [v0, v1]);
    }
    /**
     * Store four float components against the owning program.
     *
     * @param location Handle from getUniformLocation; null is a silent no-op, foreign handles push one INVALID_OPERATION.
     * @param v0 First component value.
     * @param v1 Second component value.
     * @param v2 Third component value.
     * @param v3 Fourth component value.
     */
    uniform4f(location, v0, v1, v2, v3) {
      this.storeUniform(location, [v0, v1, v2, v3]);
    }
    /**
     * Store one integer component as a number against the owning program.
     *
     * @param location Handle from getUniformLocation; null is a silent no-op, foreign handles push one INVALID_OPERATION.
     * @param v0 Component value.
     */
    uniform1i(location, v0) {
      this.storeUniform(location, [v0]);
    }
    /**
     * Store uniform components matched by handle identity.
     *
     * @param location Handle from getUniformLocation; null is a silent no-op.
     * @param values Components to copy into the owning program record.
     * @returns Void; foreign handles push exactly one INVALID_OPERATION.
     */
    storeUniform(location, values) {
      if (location === null) return;
      for (const p of this.programs.values()) {
        if (p.linkedProgram === null) continue;
        for (const h of p.linkedProgram.uniformLocations.values()) {
          if (h === location) {
            p.uniformValues.set(location.id, [...values]);
            return;
          }
        }
      }
      pushError(this.queue, INVALID_OPERATION);
    }
    /**
     * Reject draws whose current program is absent or unlinked.
     *
     * @returns True when the draw must stop; pushes exactly one INVALID_OPERATION with zero pixel writes.
     */
    rejectUnlinkedDraw() {
      const p = this.programs.get(this.state.currentProgram);
      if (p === void 0 || p.linked === false || p.linkedProgram === null) {
        pushError(this.queue, INVALID_OPERATION);
        return true;
      }
      return false;
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
      if (this.rejectUnlinkedDraw()) return;
      if (!this.checkDefaultFramebufferComplete()) {
        this.reportDrawFailure(INVALID_OPERATION);
        return;
      }
      if (count === 0) return;
      const prog = this.programs.get(this.state.currentProgram);
      const ordinals = [];
      for (let i = 0; i < count; i++) ordinals.push(first + i);
      const call = { program: prog.linkedProgram, framebuffer: this.fb, state: this.state, vertices: this.buildVertices(ordinals), indices: null, instanceCount: 1, samplers: this.assembleSamplers(prog), fragmentColor: this.deriveFragmentColor(prog) };
      drawArraysImpl(call);
      this.presentAfterDraw();
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
      if (this.rejectUnlinkedDraw()) return;
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
      const ordinals = [];
      for (let i = 0; i < count; i++) ordinals.push(view.getUint16(offset + i * 2, true));
      const prog = this.programs.get(this.state.currentProgram);
      const indices = new Uint16Array(ordinals);
      const call = { program: prog.linkedProgram, framebuffer: this.fb, state: this.state, vertices: this.buildVertices(ordinals), indices, instanceCount: 1, samplers: this.assembleSamplers(prog), fragmentColor: this.deriveFragmentColor(prog) };
      drawElementsImpl(call);
      this.presentAfterDraw();
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
