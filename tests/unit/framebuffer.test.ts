/** Sprint 7 Task 1 framebuffer/renderbuffer TDD RED-phase tests — completeness matrix, storage validation, incomplete-draw protection, FBO vs default exact-pixel parity. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { DirectVertex } from '../../src/gl/webgl1-context';
import {
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  DEPTH_ATTACHMENT,
  DEPTH_COMPONENT16,
  DEPTH_STENCIL_ATTACHMENT,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAMEBUFFER_INCOMPLETE_DIMENSIONS,
  FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT,
  FRAMEBUFFER_UNSUPPORTED,
  INVALID_ENUM,
  INVALID_OPERATION,
  NO_ERROR,
  RENDERBUFFER,
  RENDERBUFFER_HEIGHT,
  RENDERBUFFER_INTERNAL_FORMAT,
  RENDERBUFFER_WIDTH,
  RGBA,
  RGBA4,
  TRIANGLES,
  UNSIGNED_BYTE,
} from '../../src/gl/constants';

function fbContext(w: number, h: number) {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('fbContext: factory returned null');
  return gl;
}

type AnyGl = Record<string, (...args: never[]) => unknown> & ReturnType<typeof fbContext>;

function asAny(gl: ReturnType<typeof fbContext>): AnyGl {
  return gl as unknown as AnyGl;
}

function solidTri(color: readonly [number, number, number, number]): DirectVertex[] {
  return [
    { position: [-1, -1, 0, 1], color: color },
    { position: [3, -1, 0, 1], color: color },
    { position: [-1, 3, 0, 1], color: color },
  ];
}

describe('Group 1: framebuffer completeness matrix', () => {
  it('checkFramebufferStatus_missing_attachment_returns_incomplete_missing_attachment', () => {
    // Arrange:
    const gl = fbContext(64, 64);
    const g = asAny(gl);
    const fb = g.createFramebuffer() as unknown;
    gl.bindFramebuffer(FRAMEBUFFER, fb as never);
    // Act:
    const status = gl.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    // Assert:
    expect(status).toBe(FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('checkFramebufferStatus_dimension_mismatch_returns_incomplete_dimensions', () => {
    // Arrange:
    const gl = fbContext(64, 64);
    const g = asAny(gl);
    const fb = g.createFramebuffer() as unknown;
    gl.bindFramebuffer(FRAMEBUFFER, fb as never);
    const rbColor = g.createRenderbuffer() as unknown;
    gl.bindRenderbuffer(RENDERBUFFER, rbColor as never);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 8, 8);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbColor as never);
    const rbDepth = g.createRenderbuffer() as unknown;
    gl.bindRenderbuffer(RENDERBUFFER, rbDepth as never);
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 4, 4);
    gl.framebufferRenderbuffer(FRAMEBUFFER, DEPTH_ATTACHMENT, RENDERBUFFER, rbDepth as never);
    // Act:
    const status = gl.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    // Assert:
    expect(status).toBe(FRAMEBUFFER_INCOMPLETE_DIMENSIONS);
  });

  it('checkFramebufferStatus_complete_returns_framebuffer_complete', () => {
    // Arrange:
    const gl = fbContext(64, 64);
    const g = asAny(gl);
    const fb = g.createFramebuffer() as unknown;
    gl.bindFramebuffer(FRAMEBUFFER, fb as never);
    const rbColor = g.createRenderbuffer() as unknown;
    gl.bindRenderbuffer(RENDERBUFFER, rbColor as never);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 8, 8);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbColor as never);
    // Act:
    const status = gl.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    // Assert:
    expect(status).toBe(FRAMEBUFFER_COMPLETE);
  });

  it('checkFramebufferStatus_unsupported_simultaneous_depth_and_depth_stencil', () => {
    // Arrange:
    const gl = fbContext(64, 64);
    const g = asAny(gl);
    const fb = g.createFramebuffer() as unknown;
    gl.bindFramebuffer(FRAMEBUFFER, fb as never);
    const rb1 = g.createRenderbuffer() as unknown;
    gl.bindRenderbuffer(RENDERBUFFER, rb1 as never);
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 8, 8);
    gl.framebufferRenderbuffer(FRAMEBUFFER, DEPTH_ATTACHMENT, RENDERBUFFER, rb1 as never);
    const rb2 = g.createRenderbuffer() as unknown;
    gl.bindRenderbuffer(RENDERBUFFER, rb2 as never);
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 8, 8);
    gl.framebufferRenderbuffer(FRAMEBUFFER, DEPTH_STENCIL_ATTACHMENT, RENDERBUFFER, rb2 as never);
    // Act:
    const status = gl.checkFramebufferStatus(FRAMEBUFFER) as unknown as number;
    // Assert:
    expect(status).toBe(FRAMEBUFFER_UNSUPPORTED);
  });
});

describe('Group 2: renderbuffer storage validation', () => {
  it('renderbufferStorage_unsupported_internal_format_records_invalid_enum_storage_unchanged', () => {
    // Arrange:
    const gl = fbContext(64, 64);
    const g = asAny(gl);
    const rb = g.createRenderbuffer() as unknown;
    gl.bindRenderbuffer(RENDERBUFFER, rb as never);
    const badFormat = 0x1234;
    // Act:
    gl.renderbufferStorage(RENDERBUFFER, badFormat as never, 16, 16);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getRenderbufferParameter(RENDERBUFFER, RENDERBUFFER_WIDTH)).toBe(0);
    expect(gl.getRenderbufferParameter(RENDERBUFFER, RENDERBUFFER_HEIGHT)).toBe(0);
  });

  it('renderbufferStorage_legal_formats_succeed_and_update_parameters', () => {
    // Arrange:
    const gl = fbContext(64, 64);
    const g = asAny(gl);
    const rb = g.createRenderbuffer() as unknown;
    gl.bindRenderbuffer(RENDERBUFFER, rb as never);
    // Act:
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 32, 16);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getRenderbufferParameter(RENDERBUFFER, RENDERBUFFER_WIDTH)).toBe(32);
    expect(gl.getRenderbufferParameter(RENDERBUFFER, RENDERBUFFER_HEIGHT)).toBe(16);
    expect(gl.getRenderbufferParameter(RENDERBUFFER, RENDERBUFFER_INTERNAL_FORMAT)).toBe(RGBA4);
  });
});

describe('Group 3: incomplete framebuffer draw protection', () => {
  it('drawArrays_with_incomplete_framebuffer_records_invalid_operation_and_writes_no_pixels', () => {
    // Arrange:
    const gl = fbContext(8, 8);
    const g = asAny(gl);
    const fb = g.createFramebuffer() as unknown;
    gl.bindFramebuffer(FRAMEBUFFER, fb as never);
    const rbColor = g.createRenderbuffer() as unknown;
    gl.bindRenderbuffer(RENDERBUFFER, rbColor as never);
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 8, 8);
    gl.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rbColor as never);
    const rbDepth = g.createRenderbuffer() as unknown;
    gl.bindRenderbuffer(RENDERBUFFER, rbDepth as never);
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 4, 4);
    gl.framebufferRenderbuffer(FRAMEBUFFER, DEPTH_ATTACHMENT, RENDERBUFFER, rbDepth as never);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3, solidTri([1, 0, 0, 1]));
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    const out = new Uint8Array(8 * 8 * 4);
    gl.readPixels(0, 0, 8, 8, RGBA, UNSIGNED_BYTE, out);
    expect(Array.from(out).every((v) => v === 0)).toBe(true);
  });
});

describe('Group 4: exact-pixel parity FBO vs default drawing buffer', () => {
  it('render_to_complete_fbo_with_rgba4_renderbuffer_equals_default_drawing_buffer', () => {
    // Arrange:
    const glA = fbContext(8, 8);
    glA.viewport(0, 0, 8, 8);
    glA.clearColor(0.2, 0.4, 0.6, 1.0);
    glA.clear(COLOR_BUFFER_BIT);
    glA.drawArrays(TRIANGLES, 0, 3, solidTri([1, 0, 0, 1]));
    const defaultPixels = new Uint8Array(8 * 8 * 4);
    glA.readPixels(0, 0, 8, 8, RGBA, UNSIGNED_BYTE, defaultPixels);
    const glB = fbContext(8, 8);
    const gB = asAny(glB);
    const fb = gB.createFramebuffer() as unknown;
    glB.bindFramebuffer(FRAMEBUFFER, fb as never);
    const rb = gB.createRenderbuffer() as unknown;
    glB.bindRenderbuffer(RENDERBUFFER, rb as never);
    glB.renderbufferStorage(RENDERBUFFER, RGBA4, 8, 8);
    glB.framebufferRenderbuffer(FRAMEBUFFER, COLOR_ATTACHMENT0, RENDERBUFFER, rb as never);
    glB.viewport(0, 0, 8, 8);
    glB.clearColor(0.2, 0.4, 0.6, 1.0);
    glB.clear(COLOR_BUFFER_BIT);
    glB.drawArrays(TRIANGLES, 0, 3, solidTri([1, 0, 0, 1]));
    const fboPixels = new Uint8Array(8 * 8 * 4);
    glB.readPixels(0, 0, 8, 8, RGBA, UNSIGNED_BYTE, fboPixels);
    // Act:
    let mismatches = 0;
    for (let i = 0; i < 8 * 8 * 4; i += 1) {
      if ((defaultPixels[i] as number) !== (fboPixels[i] as number)) mismatches += 1;
    }
    // Assert:
    expect(mismatches, 'FBO vs default byte mismatches').toBe(0);
    expect(Array.from(fboPixels)).toEqual(Array.from(defaultPixels));
  });
});
