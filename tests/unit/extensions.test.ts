import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import { ExtensionManager } from '../../src/renderer/extensions';
import { CONTEXT_LOST_WEBGL, NO_ERROR, TRIANGLES } from '../../src/renderer/gl-constants';

function canvasDouble(w: number, h: number) {
  return {
    width: w,
    height: h,
    getContext: (_kind: string) => ({
      putImageData: (_img: unknown, _x: number, _y: number) => undefined,
    }),
  };
}

function freshCtx() {
  return createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
}

function snapshot(ctx: ReturnType<typeof freshCtx>): number[] {
  const px = ctx.readPixels(0, 0, 64, 64)!;
  return Array.from(px);
}

describe('extensions 3-stub contract + lose-restore (red phase)', () => {
  it('T1 exact names in order with fresh-copy immunity', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    const names = ctx.getSupportedExtensions();
    names.push('MUTATED');
    const again = ctx.getSupportedExtensions();
    // Assert
    expect(names.slice(0, 3)).toEqual(['WEBGL_draw_buffers', 'OES_texture_float', 'WEBGL_lose_context']);
    expect(again).toEqual(['WEBGL_draw_buffers', 'OES_texture_float', 'WEBGL_lose_context']);
  });

  it('T2 per-name stub presence with stable identity', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    const a1 = ctx.getExtension('WEBGL_draw_buffers');
    const a2 = ctx.getExtension('WEBGL_draw_buffers');
    const b = ctx.getExtension('OES_texture_float');
    const c = ctx.getExtension('WEBGL_lose_context');
    // Assert
    expect(a1).not.toBeNull();
    expect(b).not.toBeNull();
    expect(c).not.toBeNull();
    expect(a2).toBe(a1);
  });

  it('T3 unknown empty wrong-case names return null with NO_ERROR', () => {
    // Arrange
    const ctx = freshCtx();
    // Act
    const u = ctx.getExtension('EXT_nonexistent');
    const e = ctx.getExtension('');
    const w = ctx.getExtension('webgl_draw_buffers');
    const code = ctx.getError();
    // Assert
    expect(u).toBeNull();
    expect(e).toBeNull();
    expect(w).toBeNull();
    expect(code).toBe(NO_ERROR);
  });

  it('T4 lost drawArrays pushes one CONTEXT_LOST_WEBGL with no pixel change', () => {
    // Arrange
    const ctx = freshCtx();
    ctx.drawTriangle();
    const before = snapshot(ctx);
    ctx.loseContext();
    // Act
    ctx.drawArrays(TRIANGLES, 0, 3);
    const first = ctx.getError();
    const second = ctx.getError();
    const after = snapshot(ctx);
    // Assert
    expect(first).toBe(CONTEXT_LOST_WEBGL);
    expect(second).toBe(NO_ERROR);
    expect(after).toEqual(before);
  });

  it('T5 lost clear and drawElements are no-ops each pushing one code', () => {
    // Arrange
    const ctx = freshCtx();
    ctx.drawTriangle();
    const before = snapshot(ctx);
    ctx.loseContext();
    // Act
    ctx.clear(0x00004000);
    const c1 = ctx.getError();
    ctx.drawElements(TRIANGLES, 3, 0x1403, 0);
    const c2 = ctx.getError();
    const after = snapshot(ctx);
    // Assert
    expect(c1).toBe(CONTEXT_LOST_WEBGL);
    expect(c2).toBe(CONTEXT_LOST_WEBGL);
    expect(after).toEqual(before);
  });

  it('T6 lost readPixels is a no-op pushing one code', () => {
    // Arrange
    const ctx = freshCtx();
    ctx.loseContext();
    // Act
    const px = ctx.readPixels(0, 0, 64, 64);
    const code = ctx.getError();
    // Assert
    expect(code).toBe(CONTEXT_LOST_WEBGL);
    expect(px).not.toBeNull();
  });

  it('T7 restore returns to working order with pixel writes and NO_ERROR', () => {
    // Arrange
    const ctx = freshCtx();
    ctx.loseContext();
    void ctx.getError();
    ctx.restoreContext();
    const cleared = snapshot(ctx);
    // Act
    ctx.drawTriangle();
    const code = ctx.getError();
    const after = snapshot(ctx);
    // Assert
    expect(code).toBe(NO_ERROR);
    expect(after).not.toEqual(cleared);
  });

  it('T8 manager wiring owns loss flag with acyclic leaf imports', () => {
    // Arrange
    const mgr = new ExtensionManager();
    // Act
    const names = mgr.listSupportedNames();
    mgr.markLost();
    const lost = mgr.reportLost();
    mgr.markRestored();
    const working = mgr.reportLost();
    // Assert
    expect(names).toEqual(['WEBGL_draw_buffers', 'OES_texture_float', 'WEBGL_lose_context']);
    expect(lost).toBe(true);
    expect(working).toBe(false);
  });
});
