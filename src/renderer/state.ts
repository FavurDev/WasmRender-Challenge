/**
 * @fileoverview Mutable capability and binding store for one context.
 *
 * Owns no pixel memory and never touches the error queue — violations are
 * reported to the caller as return codes.
 */
// CHANGELOG:
// - Sprint 1: Created GLState capability store with spec-exact defaults and validation.
import {
  BLEND,
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
  setViewport(x: number, y: number, w: number, h: number): number | null {
    // Negative origin or size is rejected; zero size is accepted.
    if (x < 0 || y < 0 || w < 0 || h < 0) return INVALID_VALUE;
    this.viewport = [x, y, w, h];
    return null;
  }
}
