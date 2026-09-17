/**
 * @fileoverview TDD red-phase suite for RenderbufferStore (Sprint 5 Task 1).
 * All tests FAIL until src/renderer/renderbuffer.ts is implemented and wired
 * into src/renderer/context.ts. Tests go through context entry points only,
 * with a fresh context per test (no shared GL state, no DOM, no mocks).
 */
import { describe, expect, it } from "vitest";
import { createSoftwareWebGLContext } from "../../src/renderer/context";
import {
  DEPTH24_STENCIL8,
  DEPTH_COMPONENT16,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  NO_ERROR,
  OUT_OF_MEMORY,
  RENDERBUFFER,
  RGBA4,
} from "../../src/renderer/gl-constants";

function fresh(): NonNullable<ReturnType<typeof createSoftwareWebGLContext>> {
  // Arrange: isolated context per test.
  const gl = createSoftwareWebGLContext({ width: 8, height: 8 });
  if (gl === null) throw new Error("fresh context allocation failed");
  return gl;
}

describe("renderbuffer lifecycle (AC-3)", () => {
  it("issues monotonic handles 1,2,3", () => {
    // Arrange
    const gl = fresh();
    // Act
    const a = gl.createRenderbuffer();
    const b = gl.createRenderbuffer();
    const c = gl.createRenderbuffer();
    // Assert
    expect(a).toBe(1);
    expect(b).toBe(2);
    expect(c).toBe(3);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it("never reuses handles: delete 2 then next is 4", () => {
    // Arrange
    const gl = fresh();
    const a = gl.createRenderbuffer();
    const b = gl.createRenderbuffer();
    // Act
    gl.deleteRenderbuffer(b);
    const d = gl.createRenderbuffer();
    // Assert
    expect(a).toBe(1);
    expect(d).toBe(4);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it("bind of deleted handle pushes exactly one INVALID_OPERATION", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.deleteRenderbuffer(h);
    // Act
    gl.bindRenderbuffer(RENDERBUFFER, h);
    // Assert
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it("delete of unknown handle and 0 is a silent no-op", () => {
    // Arrange
    const gl = fresh();
    // Act
    gl.deleteRenderbuffer(999);
    gl.deleteRenderbuffer(0);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe("renderbuffer allocation formats (AC-4)", () => {
  it("DEPTH_COMPONENT16 4x4 allocates with readDepth 1.0", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.bindRenderbuffer(RENDERBUFFER, h);
    // Act
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 4, 4);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.readDepth(h, 0, 0)).toBe(1.0);
  });

  it("DEPTH24_STENCIL8 4x4 allocates with readDepth 1.0", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.bindRenderbuffer(RENDERBUFFER, h);
    // Act
    gl.renderbufferStorage(RENDERBUFFER, DEPTH24_STENCIL8, 4, 4);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.readDepth(h, 0, 0)).toBe(1.0);
  });

  it("unsupported format pushes exactly one INVALID_ENUM", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.bindRenderbuffer(RENDERBUFFER, h);
    // Act
    gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4, 4);
    // Assert
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe("depth occlusion (AC-1)", () => {
  it("nearer occludes farther: far-then-near write order", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.bindRenderbuffer(RENDERBUFFER, h);
    gl.renderbufferStorage(RENDERBUFFER, DEPTH24_STENCIL8, 8, 8);
    // Act
    gl.writeDepthForTest(h, 2, 2, 0.8);
    gl.writeDepthForTest(h, 2, 2, 0.2);
    // Assert
    expect(gl.readDepth(h, 2, 2)).toBeCloseTo(0.2, 5);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it("nearer occludes farther: near-then-far write order", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.bindRenderbuffer(RENDERBUFFER, h);
    gl.renderbufferStorage(RENDERBUFFER, DEPTH24_STENCIL8, 8, 8);
    // Act
    gl.writeDepthForTest(h, 3, 3, 0.2);
    gl.writeDepthForTest(h, 3, 3, 0.8);
    // Assert
    expect(gl.readDepth(h, 3, 3)).toBeCloseTo(0.2, 5);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe("over-limit OUT_OF_MEMORY (AC-2)", () => {
  it("5000x4 pushes exactly one OUT_OF_MEMORY and prior 4x4 backing intact", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.bindRenderbuffer(RENDERBUFFER, h);
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 4, 4);
    // Act
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 5000, 4);
    // Assert
    expect(gl.getError()).toBe(OUT_OF_MEMORY);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.readDepth(h, 0, 0)).toBe(1.0);
  });

  it("4x5000 pushes exactly one OUT_OF_MEMORY and prior 4x4 backing intact", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.bindRenderbuffer(RENDERBUFFER, h);
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 4, 4);
    // Act
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 4, 5000);
    // Assert
    expect(gl.getError()).toBe(OUT_OF_MEMORY);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.readDepth(h, 0, 0)).toBe(1.0);
  });

  it("4096x4096 is accepted with NO_ERROR", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.bindRenderbuffer(RENDERBUFFER, h);
    // Act
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 4096, 4096);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe("renderbufferStorage validation order (AC-5)", () => {
  it("bad target pushes exactly one INVALID_ENUM", () => {
    // Arrange
    const gl = fresh();
    // Act
    gl.renderbufferStorage(0x9999, DEPTH_COMPONENT16, 4, 4);
    // Assert
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it("bad dims push exactly one INVALID_VALUE", () => {
    // Arrange
    const gl = fresh();
    const h = gl.createRenderbuffer();
    gl.bindRenderbuffer(RENDERBUFFER, h);
    // Act
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 0, 4);
    // Assert
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it("nothing bound pushes exactly one INVALID_OPERATION", () => {
    // Arrange
    const gl = fresh();
    // Act
    gl.renderbufferStorage(RENDERBUFFER, DEPTH_COMPONENT16, 4, 4);
    // Assert
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
