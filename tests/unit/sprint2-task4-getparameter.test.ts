/**
 * @fileoverview Sprint 2 Task 4 TDD red-phase: getParameter/isEnabled coverage.
 *
 * Per-test fresh SoftwareWebGLContext via createSoftwareWebGLContext; Node only.
 */
import { describe, expect, it } from "vitest";
import { createSoftwareWebGLContext } from "../../src/renderer/context";
import {
  BLEND,
  CULL_FACE,
  DEPTH_TEST,
  INVALID_ENUM,
  LESS,
  MAX_CUBE_MAP_TEXTURE_SIZE,
  MAX_RENDERBUFFER_SIZE,
  MAX_TEXTURE_IMAGE_UNITS,
  MAX_TEXTURE_SIZE,
  MAX_VERTEX_ATTRIBS,
  MAX_VIEWPORT_DIMS,
  NO_ERROR,
  SCISSOR_TEST,
  STENCIL_TEST,
} from "../../src/renderer/gl-constants";

// Query pnames (WebGL spec values); named exports are Task 4 production scope.
const COLOR_CLEAR_VALUE = 0x0b00;
const DEPTH_WRITEMASK = 0x0b72;
const COLOR_WRITEMASK = 0x0c22;
const DEPTH_CLEAR_VALUE = 0x0b73;
const STENCIL_CLEAR_VALUE = 0x0b91;
const STENCIL_WRITEMASK = 0x0b98;
const VIEWPORT = 0x0ba2;
const SCISSOR_BOX = 0x0c10;
const DEPTH_FUNC = 0x0b74;
const BLEND_PNAME = 0x0be2;
const MAX_TEXTURE_SIZE_PNAME = 0x0d33;
const MAX_VIEWPORT_DIMS_PNAME = 0x0d3a;
const MAX_VERTEX_ATTRIBS_PNAME = 0x8869;
const MAX_TEXTURE_IMAGE_UNITS_PNAME = 0x8872;
const MAX_CUBE_MAP_TEXTURE_SIZE_PNAME = 0x851c;
const MAX_RENDERBUFFER_SIZE_PNAME = 0x84e8;
const UNKNOWN_PNAME = 0x9999;

function freshContext(): NonNullable<ReturnType<typeof createSoftwareWebGLContext>> {
  const ctx = createSoftwareWebGLContext({ width: 64, height: 64 });
  if (ctx === null) throw new Error("context creation failed");
  return ctx;
}

describe("sprint2 task4 getParameter coverage (red phase)", () => {
  it("fresh defaults via getParameter", () => {
    // Arrange
    const ctx = freshContext();
    // Act
    const clear = ctx.getParameter(COLOR_CLEAR_VALUE);
    const depthFunc = ctx.getParameter(DEPTH_FUNC);
    const depthMask = ctx.getParameter(DEPTH_WRITEMASK);
    const blend = ctx.getParameter(BLEND_PNAME);
    const colorMask = ctx.getParameter(COLOR_WRITEMASK);
    // Assert
    expect(clear).toEqual([0, 0, 0, 0]);
    expect(depthFunc).toBe(LESS);
    expect(depthMask).toBe(true);
    expect(blend).toBe(false);
    expect(colorMask).toEqual([true, true, true, true]);
  });

  it("capability reflection after enable and disable", () => {
    // Arrange
    const ctx = freshContext();
    // Act
    ctx.enable(BLEND);
    const onFlag = ctx.isEnabled(BLEND);
    const onParam = ctx.getParameter(BLEND_PNAME);
    ctx.disable(BLEND);
    const offFlag = ctx.isEnabled(BLEND);
    const offParam = ctx.getParameter(BLEND_PNAME);
    // Assert
    expect(onFlag).toBe(true);
    expect(onParam).toBe(true);
    expect(offFlag).toBe(false);
    expect(offParam).toBe(false);
    expect(ctx.isEnabled(DEPTH_TEST)).toBe(false);
    expect(ctx.isEnabled(STENCIL_TEST)).toBe(false);
    expect(ctx.isEnabled(SCISSOR_TEST)).toBe(false);
    expect(ctx.isEnabled(CULL_FACE)).toBe(false);
  });

  it("mask and clear-value round-trip with defensive copy", () => {
    // Arrange
    const ctx = freshContext();
    // Act
    ctx.clearColor(0.25, 0.5, 0.75, 1);
    ctx.colorMask(false, true, false, true);
    const clear = ctx.getParameter(COLOR_CLEAR_VALUE) as number[];
    const mask = ctx.getParameter(COLOR_WRITEMASK) as boolean[];
    // Assert
    expect(clear).toEqual([0.25, 0.5, 0.75, 1]);
    expect(mask).toEqual([false, true, false, true]);
    clear[0] = 9;
    mask[0] = true;
    expect(ctx.getParameter(COLOR_CLEAR_VALUE)).toEqual([0.25, 0.5, 0.75, 1]);
    expect(ctx.getParameter(COLOR_WRITEMASK)).toEqual([false, true, false, true]);
    // Depth/stencil clear round-trip
    ctx.clearDepth(0.5);
    ctx.clearStencil(3);
    expect(ctx.getParameter(DEPTH_CLEAR_VALUE)).toBe(0.5);
    expect(ctx.getParameter(STENCIL_CLEAR_VALUE)).toBe(3);
    expect(ctx.getParameter(STENCIL_WRITEMASK)).toBe(0xff);
  });

  it("unknown-pname single-code error with state unchanged", () => {
    // Arrange
    const ctx = freshContext();
    expect(ctx.getError()).toBe(NO_ERROR);
    const before = ctx.getParameter(VIEWPORT);
    // Act
    const result = ctx.getParameter(UNKNOWN_PNAME);
    // Assert
    expect(result).toBeNull();
    expect(ctx.getError()).toBe(INVALID_ENUM);
    expect(ctx.getError()).toBe(NO_ERROR);
    expect(ctx.getParameter(VIEWPORT)).toEqual(before);
  });

  it("limit consistency versus gl-constants", () => {
    // Arrange
    const ctx = freshContext();
    // Act
    const t = ctx.getParameter(MAX_TEXTURE_SIZE_PNAME);
    const dims = ctx.getParameter(MAX_VIEWPORT_DIMS_PNAME) as number[];
    const va = ctx.getParameter(MAX_VERTEX_ATTRIBS_PNAME);
    const tu = ctx.getParameter(MAX_TEXTURE_IMAGE_UNITS_PNAME);
    const cube = ctx.getParameter(MAX_CUBE_MAP_TEXTURE_SIZE_PNAME);
    const rb = ctx.getParameter(MAX_RENDERBUFFER_SIZE_PNAME);
    // Assert
    expect(t).toBe(MAX_TEXTURE_SIZE);
    expect(dims).toEqual([...MAX_VIEWPORT_DIMS]);
    expect(va).toBe(MAX_VERTEX_ATTRIBS);
    expect(tu).toBe(MAX_TEXTURE_IMAGE_UNITS);
    expect(cube).toBe(MAX_CUBE_MAP_TEXTURE_SIZE);
    expect(rb).toBe(MAX_RENDERBUFFER_SIZE);
    dims[0] = -1;
    expect(ctx.getParameter(MAX_VIEWPORT_DIMS_PNAME)).toEqual([...MAX_VIEWPORT_DIMS]);
  });

  it("defensive-copy isolation for boxes", () => {
    // Arrange
    const ctx = freshContext();
    // Act
    const vp = ctx.getParameter(VIEWPORT) as number[];
    const sb = ctx.getParameter(SCISSOR_BOX) as number[];
    vp[0] = 999;
    sb[2] = 999;
    const vp2 = ctx.getParameter(VIEWPORT);
    const sb2 = ctx.getParameter(SCISSOR_BOX);
    // Assert
    expect(vp2).toEqual([0, 0, 64, 64]);
    expect(sb2).toEqual([0, 0, 64, 64]);
  });
});
