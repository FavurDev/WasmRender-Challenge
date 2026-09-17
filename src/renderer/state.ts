/**
 * @fileoverview Mutable capability and binding store for one context.
 *
 * Owns no pixel memory and never touches the error queue — violations are
 * reported to the caller as return codes.
 */
// CHANGELOG:
// - Sprint 1: Created GLState capability store with spec-exact defaults and validation.
// - Sprint 2: Extended GLState for Sprint 2 draw-path state (Task 2).
// - Sprint 5: Verified GLState wiring for VAO/divisor/instanced/drawBuffers paths (no state-shape change).
import {
  BLEND,
  CULL_FACE,
  DEPTH_TEST,
  FUNC_ADD,
  INVALID_ENUM,
  INVALID_VALUE,
  LESS,
  ONE,
  SCISSOR_TEST,
  STENCIL_TEST,
  TEXTURE0,
  ZERO,
} from "./gl-constants";

/**
 * Capability flags, binding points, boxes, clear values, blend/depth config.
 */
export class GLState {
  clearColor: [number, number, number, number] = [0, 0, 0, 0];
  clearDepth = 1.0;
  clearStencil = 0;
  depthTest = false;
  depthFunc: number = LESS;
  depthMask = true;
  colorMask: [boolean, boolean, boolean, boolean] = [true, true, true, true];
  stencilTest = false;
  blendEnabled = false;
  blendSrcRGB: number = ONE;
  blendDstRGB: number = ZERO;
  blendEquation: number = FUNC_ADD;
  scissorTest = false;
  cullFace = false;
  stencilMask = 0xff;
  scissorBox: [number, number, number, number];
  viewport: [number, number, number, number];
  activeTexture: number = TEXTURE0;
  boundArrayBuffer = 0;
  boundElementArrayBuffer = 0;
  currentProgram = 0;

  /**
   * Size both boxes to the canvas extent.
   *
   * @param canvasWidth Canvas width sizing scissorBox and viewport.
   * @param canvasHeight Canvas height sizing scissorBox and viewport.
   */
  constructor(canvasWidth: number, canvasHeight: number) {
    this.scissorBox = [0, 0, canvasWidth, canvasHeight];
    this.viewport = [0, 0, canvasWidth, canvasHeight];
  }

  /**
   * Flip a capability flag on, reporting unknown enums to the caller.
   *
   * @param cap Capability code.
   * @returns Error code or null on success.
   */
  enable(cap: number): number | null {
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
  disable(cap: number): number | null {
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
  isEnabled(cap: number): boolean | number {
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
  setScissor(x: number, y: number, w: number, h: number): number | null {
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
  setDepthMask(flag: boolean): null {
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
  setColorMask(r: boolean, g: boolean, b: boolean, a: boolean): null {
    this.colorMask = [r, g, b, a];
    return null;
  }

  /**
   * Stage stencil write mask.
   *
   * @param mask Stencil write mask value.
   * @returns Null always.
   */
  setStencilMask(mask: number): null {
    this.stencilMask = mask;
    return null;
  }

  /**
   * Stage clear depth.
   *
   * @param v Depth clear value.
   * @returns Null always.
   */
  setClearDepth(v: number): null {
    this.clearDepth = v;
    return null;
  }

  /**
   * Stage clear stencil.
   *
   * @param v Stencil clear value.
   * @returns Null always.
   */
  setClearStencil(v: number): null {
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
  setViewport(x: number, y: number, w: number, h: number): number | null {
    // Negative origin or size is rejected; zero size is accepted.
    if (x < 0 || y < 0 || w < 0 || h < 0) return INVALID_VALUE;
    this.viewport = [x, y, w, h];
    return null;
  }
}
