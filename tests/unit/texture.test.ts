/**
 * @fileoverview TDD red-phase suite for TextureStore (Sprint 4 Task 5).
 * All tests FAIL until src/renderer/texture.ts is implemented.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TextureStore } from "../../src/renderer/texture";
import {
  CLAMP_TO_EDGE,
  LINEAR,
  MIRRORED_REPEAT,
  NEAREST,
  REPEAT,
  RGBA,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  UNSIGNED_BYTE,
} from "../../src/renderer/gl-constants";

/** 2x2 RGBA fixture: red TL, green TR, blue BL, white BR (row-major). */
function cornerFixture(): Uint8Array {
  return new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ]);
}

function upload2x2(store: TextureStore): number {
  // Arrange
  const h = store.createTexture();
  store.bindTexture(TEXTURE_2D, h);
  store.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, RGBA, UNSIGNED_BYTE, cornerFixture());
  store.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
  store.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
  store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
  store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, CLAMP_TO_EDGE);
  return h;
}

describe("TextureStore", () => {
  it("NEAREST returns exact uploaded bytes at four texel centers", () => {
    // Arrange
    const store = new TextureStore();
    const h = upload2x2(store);
    // Act
    const tl = store.sample2D(h, 0.25, 0.25);
    const tr = store.sample2D(h, 0.75, 0.25);
    const bl = store.sample2D(h, 0.25, 0.75);
    const br = store.sample2D(h, 0.75, 0.75);
    // Assert
    expect(tl).toEqual([1, 0, 0, 1]);
    expect(tr).toEqual([0, 1, 0, 1]);
    expect(bl).toEqual([0, 0, 1, 1]);
    expect(br).toEqual([1, 1, 1, 1]);
  });

  it("wrap modes diverge at u=1.5", () => {
    // Arrange
    const store = new TextureStore();
    const h = store.createTexture();
    store.bindTexture(TEXTURE_2D, h);
    store.texImage2D(TEXTURE_2D, 0, RGBA, 2, 1, RGBA, UNSIGNED_BYTE,
      new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]));
    store.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    store.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    // Act + Assert per mode
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
    const clamp = store.sample2D(h, 1.5, 0.5);
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, REPEAT);
    const repeat = store.sample2D(h, 1.5, 0.5);
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, MIRRORED_REPEAT);
    const mirror = store.sample2D(h, 1.5, 0.5);
    // Assert
    expect(clamp).toEqual([0, 1, 0, 1]);
    expect(repeat).toEqual([0, 1, 0, 1]);
    expect(mirror).toEqual([1, 0, 0, 1]);
    expect(JSON.stringify(clamp)).not.toBe(JSON.stringify(mirror));
  });

  it("3x2 NPOT with REPEAT is incomplete and samples black", () => {
    // Arrange
    const store = new TextureStore();
    const h = store.createTexture();
    store.bindTexture(TEXTURE_2D, h);
    store.texImage2D(TEXTURE_2D, 0, RGBA, 3, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(3 * 2 * 4).fill(128));
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, REPEAT);
    // Act
    const complete = store.isComplete(h);
    const s = store.sample2D(h, 0.5, 0.5);
    // Assert
    expect(complete).toBe(false);
    expect(s).toEqual([0, 0, 0, 1]);
  });

  it("4x4 POT with REPEAT is complete and samples stored texels", () => {
    // Arrange
    const store = new TextureStore();
    const h = store.createTexture();
    store.bindTexture(TEXTURE_2D, h);
    const px = new Uint8Array(4 * 4 * 4);
    for (let i = 0; i < 16; i++) { px[i * 4] = 200; px[i * 4 + 1] = 10; px[i * 4 + 2] = 20; px[i * 4 + 3] = 255; }
    store.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, RGBA, UNSIGNED_BYTE, px);
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, REPEAT);
    store.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, REPEAT);
    store.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, LINEAR);
    store.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, LINEAR);
    // Act
    const complete = store.isComplete(h);
    const s = store.sample2D(h, 0.5, 0.5);
    // Assert
    expect(complete).toBe(true);
    expect(s).not.toEqual([0, 0, 0, 1]);
  });

  it("fresh texture samples opaque white", () => {
    // Arrange
    const store = new TextureStore();
    const h = store.createTexture();
    // Act
    const s = store.sample2D(h, 0.5, 0.5);
    // Assert
    expect(s).toEqual([1, 1, 1, 1]);
  });

  it("texImage2D stores 2x2 bytes exactly", () => {
    // Arrange
    const store = new TextureStore();
    const h = store.createTexture();
    store.bindTexture(TEXTURE_2D, h);
    const payload = cornerFixture();
    // Act
    store.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, RGBA, UNSIGNED_BYTE, payload);
    // Assert
    expect(Array.from(store.getTexel(h, 0, 0))).toEqual([255, 0, 0, 255]);
    expect(Array.from(store.getTexel(h, 1, 0))).toEqual([0, 255, 0, 255]);
    expect(Array.from(store.getTexel(h, 0, 1))).toEqual([0, 0, 255, 255]);
    expect(Array.from(store.getTexel(h, 1, 1))).toEqual([255, 255, 255, 255]);
  });

  it("LINEAR blends four surrounding texels bilinearly", () => {
    // Arrange
    const store = new TextureStore();
    const h = upload2x2(store);
    store.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, LINEAR);
    // Act
    const s = store.sample2D(h, 0.5, 0.5);
    // Assert
    const expected = [0.5, 0.5, 0.5, 1];
    for (let i = 0; i < 4; i++) expect(Math.abs(s[i] - expected[i])).toBeLessThanOrEqual(1 / 255 + 1e-9);
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
