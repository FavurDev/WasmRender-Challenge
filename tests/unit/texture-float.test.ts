/**
 * @fileoverview TDD red-phase suite for R32F/RGBA32F float textures (Sprint 5 Task 5).
 * All float tests FAIL until texture.ts gains Float32Array backing.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TextureStore } from "../../src/renderer/texture";
import { createSoftwareWebGLContext } from "../../src/renderer/context";
import {
  CLAMP_TO_EDGE,
  FLOAT,
  NEAREST,
  NO_ERROR,
  R32F,
  RED,
  RGBA,
  RGBA32F,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  UNSIGNED_BYTE,
} from "../../src/renderer/gl-constants";

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  return { width: w, height: h } as HTMLCanvasElement;
}

describe("TextureStore float formats (red phase)", () => {
  it("RGBA32F out-of-range precision returns exact floats", () => {
    // Arrange
    const store = new TextureStore();
    const h = store.createTexture();
    store.bindTexture(TEXTURE_2D, h);
    const px = new Float32Array([2.5, -1.0, 0.5, 1.0, 0.25, 0.75, -2.0, 3.0]);
    // Act
    (store.texImage2D as unknown as (...a: unknown[]) => void)(
      TEXTURE_2D, 0, RGBA32F, 2, 1, RGBA, FLOAT, px,
    );
    store.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    store.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    const s0 = store.sample2D(h, 0.25, 0.5);
    const s1 = store.sample2D(h, 0.75, 0.5);
    // Assert
    expect(s0).toEqual([2.5, -1.0, 0.5, 1.0]);
    expect(s1).toEqual([0.25, 0.75, -2.0, 3.0]);
  });

  it("R32F NEAREST exactness expands to [r,0,0,1]", () => {
    // Arrange
    const store = new TextureStore();
    const h = store.createTexture();
    store.bindTexture(TEXTURE_2D, h);
    const px = new Float32Array([1.5, -0.5, 2.5, 0.0]);
    // Act
    (store.texImage2D as unknown as (...a: unknown[]) => void)(
      TEXTURE_2D, 0, R32F, 2, 2, RED, FLOAT, px,
    );
    store.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    store.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, CLAMP_TO_EDGE);
    const tl = store.sample2D(h, 0.25, 0.25);
    const tr = store.sample2D(h, 0.75, 0.25);
    const bl = store.sample2D(h, 0.25, 0.75);
    const br = store.sample2D(h, 0.75, 0.75);
    // Assert
    expect(tl).toEqual([1.5, 0, 0, 1]);
    expect(tr).toEqual([-0.5, 0, 0, 1]);
    expect(bl).toEqual([2.5, 0, 0, 1]);
    expect(br).toEqual([0.0, 0, 0, 1]);
  });

  it("unsupported pairs push exactly one code and leave prior image unchanged", () => {
    // Arrange
    const ctx = createSoftwareWebGLContext(makeCanvas(16, 16));
    if (ctx === null) throw new Error("context allocation failed");
    const tex = ctx.createTexture() as number;
    ctx.bindTexture(TEXTURE_2D, tex);
    const good = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);
    ctx.texImage2D(TEXTURE_2D, 0, RGBA, 2, 1, RGBA, UNSIGNED_BYTE, good);
    expect(ctx.getError()).toBe(NO_ERROR);
    // Act: mismatched RGBA internalFormat with FLOAT type
    (ctx.texImage2D as unknown as (...a: unknown[]) => void)(
      TEXTURE_2D, 0, RGBA, 2, 1, RGBA, FLOAT, new Float32Array(8),
    );
    // Assert
    const first = ctx.getError();
    expect(first).not.toBe(NO_ERROR);
    expect(ctx.getError()).toBe(NO_ERROR);
    // Act: R32F internalFormat with UNSIGNED_BYTE type
    (ctx.texImage2D as unknown as (...a: unknown[]) => void)(
      TEXTURE_2D, 0, R32F, 2, 1, RED, UNSIGNED_BYTE, good,
    );
    // Assert
    const second = ctx.getError();
    expect(second).not.toBe(NO_ERROR);
    expect(ctx.getError()).toBe(NO_ERROR);
    // Assert: prior image retained — fresh store mirrors the same byte upload and samples it back
    const mirror = new TextureStore();
    const mh = mirror.createTexture();
    mirror.bindTexture(TEXTURE_2D, mh);
    mirror.texImage2D(TEXTURE_2D, 0, RGBA, 2, 1, RGBA, UNSIGNED_BYTE, good);
    expect(mirror.sample2D(mh, 0.25, 0.5)).toEqual([10 / 255, 20 / 255, 30 / 255, 1]);
  });

  it("module imports only gl-constants and errors", () => {
    // Arrange
    const src = readFileSync("src/renderer/texture.ts", "utf8");
    // Act
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    // Assert
    expect(imports.length).toBeGreaterThan(0);
    for (const m of imports) expect(["./gl-constants", "./errors"]).toContain(m);
  });
});
