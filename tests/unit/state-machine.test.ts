import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  ARRAY_BUFFER,
  BLEND,
  BLEND_DST_RGB,
  BLEND_EQUATION,
  BLEND_SRC_RGB,
  COLOR_BUFFER_BIT,
  COLOR_CLEAR_VALUE,
  COLOR_WRITEMASK,
  CULL_FACE,
  DEPTH_BUFFER_BIT,
  DEPTH_CLEAR_VALUE,
  DEPTH_FUNC,
  DEPTH_TEST,
  DEPTH_WRITEMASK,
  ELEMENT_ARRAY_BUFFER,
  FLOAT,
  FUNC_ADD,
  INVALID_ENUM,
  INVALID_VALUE,
  LESS,
  MAX_TEXTURE_IMAGE_UNITS,
  MAX_TEXTURE_IMAGE_UNITS_PNAME,
  MAX_TEXTURE_SIZE,
  MAX_TEXTURE_SIZE_PNAME,
  MAX_VERTEX_ATTRIBS,
  MAX_VERTEX_ATTRIBS_PNAME,
  MAX_VIEWPORT_DIMS,
  MAX_VIEWPORT_DIMS_PNAME,
  NO_ERROR,
  ONE,
  SCISSOR_BOX,
  SCISSOR_TEST,
  STATIC_DRAW,
  STENCIL_CLEAR_VALUE,
  STENCIL_WRITEMASK,
  STENCIL_TEST,
  TRIANGLES,
  UNSIGNED_SHORT,
  VIEWPORT,
  ZERO,
} from '../../src/renderer/gl-constants';

function freshCtx() {
  const ctx = createSoftwareWebGLContext({ width: 8, height: 8 });
  if (!ctx) throw new Error('factory returned null');
  return ctx;
}

describe('state-machine SM-1..SM-14', () => {
  it('SM-1 defaults part A via getParameter', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    const cc = ctx.getParameter(COLOR_CLEAR_VALUE) as number[];
    const df = ctx.getParameter(DEPTH_FUNC);
    const dm = ctx.getParameter(DEPTH_WRITEMASK);
    const bl = ctx.getParameter(BLEND);
    const cm = ctx.getParameter(COLOR_WRITEMASK) as boolean[];
    // Assert
    expect(cc).toEqual([0, 0, 0, 0]);
    expect(df).toBe(LESS);
    expect(dm).toBe(true);
    expect(bl).toBe(false);
    expect(cm).toEqual([true, true, true, true]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('SM-2 defaults part B via getParameter', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    const vp = ctx.getParameter(VIEWPORT) as number[];
    const sb = ctx.getParameter(SCISSOR_BOX) as number[];
    const cd = ctx.getParameter(DEPTH_CLEAR_VALUE);
    const cs = ctx.getParameter(STENCIL_CLEAR_VALUE);
    const sm = ctx.getParameter(STENCIL_WRITEMASK);
    const src = ctx.getParameter(BLEND_SRC_RGB);
    const dst = ctx.getParameter(BLEND_DST_RGB);
    const eq = ctx.getParameter(BLEND_EQUATION);
    // Assert
    expect(vp).toEqual([0, 0, 8, 8]);
    expect(sb).toEqual([0, 0, 8, 8]);
    expect(cd).toBe(1);
    expect(cs).toBe(0);
    expect(src).toBe(ONE);
    expect(dst).toBe(ZERO);
    expect(eq).toBe(FUNC_ADD);
    expect(sm).toBe(255);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('SM-3 fixed-limit consistency with gl-constants', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    const tex = ctx.getParameter(MAX_TEXTURE_SIZE_PNAME);
    const dims = ctx.getParameter(MAX_VIEWPORT_DIMS_PNAME) as number[];
    const att = ctx.getParameter(MAX_VERTEX_ATTRIBS_PNAME);
    const units = ctx.getParameter(MAX_TEXTURE_IMAGE_UNITS_PNAME);
    // Assert
    expect(tex).toBe(MAX_TEXTURE_SIZE);
    expect(tex).toBe(4096);
    expect(dims).toEqual([...MAX_VIEWPORT_DIMS]);
    expect(att).toBe(MAX_VERTEX_ATTRIBS);
    expect(att).toBe(16);
    expect(units).toBe(MAX_TEXTURE_IMAGE_UNITS);
    expect(units).toBe(16);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('SM-4 BLEND toggle observable', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    ctx.enable(BLEND);
    const onFlag = ctx.isEnabled(BLEND);
    const onParam = ctx.getParameter(BLEND);
    ctx.disable(BLEND);
    const offFlag = ctx.isEnabled(BLEND);
    const offParam = ctx.getParameter(BLEND);
    // Assert
    expect(onFlag).toBe(true);
    expect(onParam).toBe(true);
    expect(offFlag).toBe(false);
    expect(offParam).toBe(false);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('SM-5 DEPTH_TEST toggle with isolation', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    ctx.enable(DEPTH_TEST);
    const d = ctx.isEnabled(DEPTH_TEST);
    const b = ctx.isEnabled(BLEND);
    const s = ctx.isEnabled(SCISSOR_TEST);
    ctx.disable(DEPTH_TEST);
    const dOff = ctx.isEnabled(DEPTH_TEST);
    // Assert
    expect(d).toBe(true);
    expect(b).toBe(false);
    expect(s).toBe(false);
    expect(dOff).toBe(false);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('SM-6 SCISSOR STENCIL CULL toggles', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    ctx.enable(SCISSOR_TEST);
    const sc = ctx.isEnabled(SCISSOR_TEST);
    ctx.enable(STENCIL_TEST);
    const st = ctx.isEnabled(STENCIL_TEST);
    ctx.enable(CULL_FACE);
    const cu = ctx.isEnabled(CULL_FACE);
    ctx.disable(SCISSOR_TEST);
    ctx.disable(STENCIL_TEST);
    ctx.disable(CULL_FACE);
    // Assert
    expect(sc).toBe(true);
    expect(st).toBe(true);
    expect(cu).toBe(true);
    expect(ctx.isEnabled(SCISSOR_TEST)).toBe(false);
    expect(ctx.isEnabled(STENCIL_TEST)).toBe(false);
    expect(ctx.isEnabled(CULL_FACE)).toBe(false);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('SM-7 unknown-enum enable rejected no side effects', () => {
    // Arrange
    const ctx = freshCtx();
    const before = [ctx.isEnabled(BLEND), ctx.isEnabled(DEPTH_TEST), ctx.isEnabled(SCISSOR_TEST), ctx.isEnabled(STENCIL_TEST), ctx.isEnabled(CULL_FACE)];
    // Act
    ctx.enable(LESS);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
    expect([ctx.isEnabled(BLEND), ctx.isEnabled(DEPTH_TEST), ctx.isEnabled(SCISSOR_TEST), ctx.isEnabled(STENCIL_TEST), ctx.isEnabled(CULL_FACE)]).toEqual(before);
  });

  it('SM-8 unknown-pname getParameter rejected no side effects', () => {
    // Arrange
    const ctx = freshCtx();
    const before = ctx.isEnabled(BLEND);
    // Act
    const result = ctx.getParameter(TRIANGLES);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(result).toBeNull();
    expect(first).toBe(INVALID_ENUM);
    expect(second).toBe(NO_ERROR);
    expect(ctx.isEnabled(BLEND)).toBe(before);
  });

  it('SM-9 negative scissor rejected prior box preserved', () => {
    // Arrange
    const ctx = freshCtx();
    const prior = ctx.getParameter(SCISSOR_BOX);
    // Act
    ctx.scissor(0, 0, -2, 4);
    const after = ctx.getParameter(SCISSOR_BOX);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_VALUE);
    expect(second).toBe(NO_ERROR);
    expect(after).toEqual(prior);
  });

  it('SM-10 negative viewport rejected prior box preserved', () => {
    // Arrange
    const ctx = freshCtx();
    const prior = ctx.getParameter(VIEWPORT);
    // Act
    ctx.viewport(0, 0, -3, 4);
    const after = ctx.getParameter(VIEWPORT);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert
    expect(first).toBe(INVALID_VALUE);
    expect(second).toBe(NO_ERROR);
    expect(after).toEqual(prior);
  });

  it('SM-11 buffer data round-trip via context', () => {
    // Arrange
    const ctx = freshCtx();
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, buf);
    const data = new Float32Array([1, 2, 3, 4, 5, 6]);
    // Act
    ctx.bufferData(ARRAY_BUFFER, data, STATIC_DRAW);
    ctx.vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
    const v0 = ctx.decodeAttribute(0, 0);
    const v1 = ctx.decodeAttribute(0, 1);
    // Assert
    expect(v0).toEqual([1, 2, 3]);
    expect(v1).toEqual([4, 5, 6]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('SM-12 interleaved stride offset lane isolation', () => {
    // Arrange
    const ctx = freshCtx();
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ARRAY_BUFFER, buf);
    const data = new Float32Array([1, 10, 2, 20, 3, 30]);
    // Act
    ctx.bufferData(ARRAY_BUFFER, data, STATIC_DRAW);
    ctx.vertexAttribPointer(0, 1, FLOAT, false, 8, 0);
    ctx.vertexAttribPointer(1, 1, FLOAT, false, 8, 4);
    const a0 = ctx.decodeAttribute(0, 0);
    const a1 = ctx.decodeAttribute(0, 1);
    const a2 = ctx.decodeAttribute(0, 2);
    const b0 = ctx.decodeAttribute(1, 0);
    const b1 = ctx.decodeAttribute(1, 1);
    const b2 = ctx.decodeAttribute(1, 2);
    // Assert
    expect(a0).toEqual([1]);
    expect(a1).toEqual([2]);
    expect(a2).toEqual([3]);
    expect(b0).toEqual([10]);
    expect(b1).toEqual([20]);
    expect(b2).toEqual([30]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('SM-13 color-mask and depth-mask suppression', () => {
    // Arrange
    const ctx = freshCtx();
    ctx.clearColor(0, 0, 0, 0);
    ctx.clear(COLOR_BUFFER_BIT);
    const baseline = ctx.readPixels(0, 0, 8, 8);
    // Act
    ctx.colorMask(true, false, false, true);
    ctx.clearColor(1, 1, 1, 1);
    ctx.clear(COLOR_BUFFER_BIT);
    const masked = ctx.readPixels(0, 0, 8, 8);
    // Assert color lanes
    expect(masked).not.toBeNull();
    expect(baseline).not.toBeNull();
    expect(masked![0]).toBe(255);
    expect(masked![1]).toBe(baseline![1]);
    expect(masked![2]).toBe(baseline![2]);
    expect(masked![3]).toBe(255);
    // Act depth
    ctx.depthMask(false);
    ctx.clearDepth(0);
    ctx.clear(DEPTH_BUFFER_BIT);
    const afterDepth = ctx.readPixels(0, 0, 8, 8);
    expect(afterDepth).toEqual(masked);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('SM-14 scissor-confined clear', () => {
    // Arrange
    const ctx = freshCtx();
    ctx.clearColor(0, 0, 0, 0);
    ctx.clear(COLOR_BUFFER_BIT);
    // Act
    ctx.enable(SCISSOR_TEST);
    ctx.scissor(0, 0, 4, 4);
    ctx.clearColor(1, 0, 0, 1);
    ctx.clear(COLOR_BUFFER_BIT);
    const inside = ctx.readPixels(1, 1, 1, 1);
    const outside = ctx.readPixels(6, 6, 1, 1);
    // Assert
    expect([...inside!]).toEqual([255, 0, 0, 255]);
    expect([...outside!]).toEqual([0, 0, 0, 0]);
    expect(ctx.getError()).toBe(NO_ERROR);
  });
});
