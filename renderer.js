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
  var ZERO = 0;
  var ONE = 1;
  var FUNC_ADD = 32774;
  var LESS = 513;
  var BLEND = 3042;
  var DEPTH_TEST = 2929;
  var STENCIL_TEST = 2960;
  var SCISSOR_TEST = 3089;
  var COLOR_BUFFER_BIT = 16384;
  var DEPTH_BUFFER_BIT = 256;
  var STENCIL_BUFFER_BIT = 1024;
  var TEXTURE0 = 33984;
  var NO_ERROR = 0;
  var INVALID_ENUM = 1280;
  var INVALID_VALUE = 1281;
  var MAX_TEXTURE_SIZE = 4096;
  var MAX_VIEWPORT_DIMS = [4096, 4096];

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
        default:
          return INVALID_ENUM;
      }
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
     * @returns Nothing; selected planes filled honoring write masks.
     */
    clear(mask) {
      const rb = Math.round(clamp01(this.ccR) * 255);
      const gb = Math.round(clamp01(this.ccG) * 255);
      const bb = Math.round(clamp01(this.ccB) * 255);
      const ab = Math.round(clamp01(this.ccA) * 255);
      const dv = clamp01(this.cd);
      const sv = this.cs & 255;
      if ((mask & COLOR_BUFFER_BIT) !== 0) {
        const c = this.color;
        for (let i = 0; i < c.length; i += 4) {
          if (this.cmR) c[i] = rb;
          if (this.cmG) c[i + 1] = gb;
          if (this.cmB) c[i + 2] = bb;
          if (this.cmA) c[i + 3] = ab;
        }
      }
      if ((mask & DEPTH_BUFFER_BIT) !== 0 && this.dm) {
        this.depth.fill(dv);
      }
      if ((mask & STENCIL_BUFFER_BIT) !== 0) {
        const inv = ~this.sm & 255;
        const s = this.stencil;
        for (let i = 0; i < s.length; i++) {
          s[i] = s[i] & inv | sv & this.sm;
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

  // src/renderer/context.ts
  var MAX_TEXTURE_SIZE_PNAME = 3379;
  var VIEWPORT_PNAME = 2978;
  var CLEAR_COLOR_PNAME = 2816;
  var DEPTH_FUNC_PNAME = 2932;
  var SoftwareWebGLContext = class {
    state;
    fb;
    queue = [];
    canvas;
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
    }
    /** Stage clear color on framebuffer. */
    clearColor(r, g, b, a) {
      this.state.clearColor = [r, g, b, a];
      this.fb.clearColor(r, g, b, a);
    }
    /** Stage clear depth on framebuffer (fb-authoritative; GLState holds no depth-clear copy in Sprint 1 minimal scope). */
    clearDepth(v) {
      this.fb.clearDepth(v);
    }
    /** Stage clear stencil on framebuffer (fb-authoritative; GLState holds no stencil-clear copy in Sprint 1 minimal scope). */
    clearStencil(v) {
      this.fb.clearStencil(v);
    }
    /** Run masked clear on framebuffer. */
    clear(mask) {
      this.fb.clear(mask);
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
      if (pname === MAX_TEXTURE_SIZE_PNAME) return MAX_TEXTURE_SIZE;
      if (pname === VIEWPORT_PNAME) return [...this.state.viewport];
      if (pname === CLEAR_COLOR_PNAME) return [...this.state.clearColor];
      if (pname === DEPTH_FUNC_PNAME) return this.state.depthFunc;
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
