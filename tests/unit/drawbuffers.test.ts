/**
 * @fileoverview TDD red-phase suite for drawBuffers 4-target writes (Sprint 5 Task 4).
 * All tests FAIL until framebuffer multi-attachment extension + context drawBuffers
 * entry point are implemented. Fresh context per test, Node only, AAA, deterministic.
 */
import { describe, expect, it } from "vitest";
import { createSoftwareWebGLContext } from "../../src/renderer/context";
import { Framebuffer } from "../../src/renderer/framebuffer";
import {
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  INVALID_OPERATION,
  MAX_COLOR_ATTACHMENTS,
  NO_ERROR,
} from "../../src/renderer/gl-constants";

type Gl = NonNullable<ReturnType<typeof createSoftwareWebGLContext>>;
type DrawBuffersExt = { drawBuffers(buffers: number[]): void };
type FbExt = {
  attachmentCount(): number;
  attachmentBuffer(index: number): Uint8ClampedArray;
  configureDrawBuffers(list: number[]): void;
  activeDrawBuffers(): number[];
  writeFragmentToAttachments(x: number, y: number, colors: Array<[number, number, number, number]>): void;
  readAttachment(x: number, y: number, w: number, h: number, index: number): Uint8Array;
};

function fresh(w = 4, h = 4): Gl {
  // Arrange helper: isolated context per test.
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error("fresh context allocation failed");
  return gl;
}

function asDraw(gl: Gl): Gl & DrawBuffersExt {
  return gl as unknown as Gl & DrawBuffersExt;
}

function asFb(fb: Framebuffer): Framebuffer & FbExt {
  return fb as unknown as Framebuffer & FbExt;
}

function fbOf(gl: Gl): Framebuffer & FbExt {
  return asFb((gl as unknown as { fb: Framebuffer }).fb ?? new Framebuffer(4, 4));
}

describe("drawBuffers dual-attachment distinct-color (AC-4, AC-2)", () => {
  it("dual-attachment distinct-color readback: att0 red, att1 blue", () => {
    // Arrange
    const gl = fresh();
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0 + 1]);
    const fb = fbOf(gl);
    // Act
    fb.writeFragmentToAttachments(0, 0, [[255, 0, 0, 255], [0, 0, 255, 255]]);
    const a0 = fb.readAttachment(0, 0, 1, 1, 0);
    const a1 = fb.readAttachment(0, 0, 1, 1, 1);
    // Assert
    expect(Array.from(a0)).toEqual([255, 0, 0, 255]);
    expect(Array.from(a1)).toEqual([0, 0, 255, 255]);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe("drawBuffers out-of-range rejection (AC-3, AC-5)", () => {
  it("out-of-range COLOR_ATTACHMENT0+4 pushes exactly one INVALID_OPERATION, config+pixels intact", () => {
    // Arrange
    const gl = fresh();
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0 + 1]);
    const fb = fbOf(gl);
    fb.writeFragmentToAttachments(0, 0, [[255, 0, 0, 255], [0, 0, 255, 255]]);
    const cfgBefore = fb.activeDrawBuffers();
    const pxBefore = Array.from(fb.readAttachment(0, 0, 1, 1, 0));
    // Act
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0 + 4]);
    // Assert
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(fb.activeDrawBuffers()).toEqual(cfgBefore);
    expect(Array.from(fb.readAttachment(0, 0, 1, 1, 0))).toEqual(pxBefore);
  });
});

describe("drawBuffers mask-honoring multi-write (AC-2)", () => {
  it("red-only mask: only red channels change in both attachments", () => {
    // Arrange
    const gl = fresh();
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0 + 1]);
    gl.colorMask(true, false, false, false);
    const fb = fbOf(gl);
    // Act
    fb.writeFragmentToAttachments(1, 1, [[200, 111, 222, 123], [10, 20, 30, 40]]);
    const a0 = fb.readAttachment(1, 1, 1, 1, 0);
    const a1 = fb.readAttachment(1, 1, 1, 1, 1);
    // Assert
    expect([a0[0], a1[0]]).toEqual([200, 10]);
    expect([a0[1], a0[2], a0[3]]).toEqual([0, 0, 0]);
    expect([a1[1], a1[2], a1[3]]).toEqual([0, 0, 0]);
  });
});

describe("drawBuffers attachment-count limit (AC-1)", () => {
  it("attachment-count holds 4 independent targets; 5-entry list rejected with one code", () => {
    // Arrange
    const gl = fresh();
    // Act
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0 + 1, COLOR_ATTACHMENT0 + 2, COLOR_ATTACHMENT0 + 3]);
    const fb = fbOf(gl);
    // Assert
    expect(MAX_COLOR_ATTACHMENTS).toBe(4);
    expect(fb.attachmentCount()).toBe(4);
    expect(fb.attachmentBuffer(0)).not.toBe(fb.attachmentBuffer(1));
    // Act (over-length)
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0 + 1, COLOR_ATTACHMENT0 + 2, COLOR_ATTACHMENT0 + 3, COLOR_ATTACHMENT0]);
    // Assert
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe("drawBuffers intact-config after rejected call (AC-5)", () => {
  it("rejected duplicate call leaves stored config and pixels byte-identical", () => {
    // Arrange
    const gl = fresh();
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0 + 1]);
    const fb = fbOf(gl);
    fb.writeFragmentToAttachments(2, 2, [[1, 2, 3, 4], [5, 6, 7, 8]]);
    const cfgBefore = fb.activeDrawBuffers();
    const snap0 = Array.from(fb.readAttachment(0, 0, 4, 4, 0));
    // Act
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0]);
    // Assert
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(fb.activeDrawBuffers()).toEqual(cfgBefore);
    expect(Array.from(fb.readAttachment(0, 0, 4, 4, 0))).toEqual(snap0);
  });
});

describe("drawBuffers edge cases (blueprint)", () => {
  it("empty list is a valid no-target config with no error", () => {
    // Arrange
    const gl = fresh();
    const fb = fbOf(gl);
    const before = Array.from(fb.attachmentBuffer(0));
    // Act
    asDraw(gl).drawBuffers([]);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(fb.activeDrawBuffers()).toEqual([]);
    expect(Array.from(fb.attachmentBuffer(0))).toEqual(before);
  });

  it("duplicate attachment rejected with exactly one INVALID_OPERATION", () => {
    // Arrange
    const gl = fresh();
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0]);
    const fb = fbOf(gl);
    const cfgBefore = fb.activeDrawBuffers();
    // Act
    asDraw(gl).drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0]);
    // Assert
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(fb.activeDrawBuffers()).toEqual(cfgBefore);
  });

  it("default-target regression: clear then readPixels reads attachment 0", () => {
    // Arrange
    const gl = fresh();
    gl.clearColor(1, 0, 0, 1);
    // Act
    gl.clear(COLOR_BUFFER_BIT);
    const out = gl.readPixels(0, 0, 1, 1);
    // Assert
    expect(Array.from(out as Uint8Array)).toEqual([255, 0, 0, 255]);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
