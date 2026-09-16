/**
 * @fileoverview Clear conformance suite: quantized bytes, determinism, viewport rejection, purity gates.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { chromium, type Browser } from "playwright";
import { getRendererPath, assertRendererExists, buildInterceptScript } from "../../src/context-intercept";

let browser: Browser;
let initScript: string;

beforeAll(async () => {
  // Arrange: gate on artifact, compose payload, launch headless Chromium.
  assertRendererExists();
  initScript = buildInterceptScript();
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  // Act: tear down browser.
  await browser?.close();
});

describe("clear", () => {
  it("clear red fills every pixel exactly", async () => {
    // Arrange: fresh page with init script, fresh 64x64 canvas + context.
    const page = await browser.newPage();
    await page.addInitScript(initScript);
    await page.goto("about:blank");
    // Act: clearColor(1,0,0,1), clear color buffer, read back all pixels.
    const bytes = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("webgl") as unknown as {
        clearColor(r: number, g: number, b: number, a: number): void;
        clear(mask: number): void;
        readPixels(x: number, y: number, w: number, h: number): Uint8Array | null;
      };
      ctx.clearColor(1, 0, 0, 1);
      ctx.clear(0x00004000);
      const out = ctx.readPixels(0, 0, 64, 64);
      return out === null ? null : Array.from(out);
    });
    // Assert: every group of four bytes equals [255,0,0,255].
    expect(bytes).not.toBeNull();
    expect(bytes!.length).toBe(64 * 64 * 4);
    for (let i = 0; i < bytes!.length; i += 4) {
      expect(bytes![i]).toBe(255);
      expect(bytes![i + 1]).toBe(0);
      expect(bytes![i + 2]).toBe(0);
      expect(bytes![i + 3]).toBe(255);
    }
    await page.close();
  });

  it("quantized clear is byte-identical across two runs", async () => {
    // Arrange: fresh page, same context, back-to-back draws.
    const page = await browser.newPage();
    await page.addInitScript(initScript);
    await page.goto("about:blank");
    // Act: stage 0.5 clear twice, read back each run.
    const result = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("webgl") as unknown as {
        clearColor(r: number, g: number, b: number, a: number): void;
        clear(mask: number): void;
        readPixels(x: number, y: number, w: number, h: number): Uint8Array | null;
      };
      ctx.clearColor(0.5, 0, 0, 1);
      ctx.clear(0x00004000);
      const runOne = ctx.readPixels(0, 0, 64, 64);
      ctx.clearColor(0.5, 0, 0, 1);
      ctx.clear(0x00004000);
      const runTwo = ctx.readPixels(0, 0, 64, 64);
      if (runOne === null || runTwo === null) return { ok: false, len: 0, firstDiff: -1 };
      let firstDiff = -1;
      for (let i = 0; i < runOne.length; i++) {
        if (runOne[i] !== runTwo[i]) {
          firstDiff = i;
          break;
        }
      }
      return { ok: firstDiff === -1, len: runOne.length, firstDiff };
    });
    // Assert: identical and full length.
    expect(result.ok).toBe(true);
    expect(result.len).toBe(64 * 64 * 4);
    await page.close();
  });

  it("negative viewport pushes 0x0501 and preserves prior box", async () => {
    // Arrange: fresh page + context.
    const page = await browser.newPage();
    await page.addInitScript(initScript);
    await page.goto("about:blank");
    // Act: record viewport, call viewport(-1,0,10,10), drain error, re-read.
    const result = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("webgl") as unknown as {
        viewport(x: number, y: number, w: number, h: number): void;
        getParameter(p: number): unknown;
        getError(): number;
      };
      const prior = ctx.getParameter(0x0ba2) as number[];
      ctx.viewport(-1, 0, 10, 10);
      const code = ctx.getError();
      const after = ctx.getParameter(0x0ba2) as number[];
      return { prior, code, after };
    });
    // Assert: exactly one INVALID_VALUE, prior unchanged.
    expect(result.code).toBe(0x0501);
    expect(result.after).toEqual(result.prior);
    await page.close();
  });

  it("bundle size cap holds", async () => {
    // Arrange: resolve renderer path.
    const rendererPath = getRendererPath();
    // Act: stat byte size.
    const byteSize = statSync(rendererPath).size;
    // Assert: strictly below 800KB.
    expect(byteSize).toBeLessThan(800 * 1024);
  });

  it("bundle contains no require token", async () => {
    // Arrange: resolve renderer path.
    const rendererPath = getRendererPath();
    // Act: scan text for require( token.
    const text = readFileSync(rendererPath, "utf-8");
    // Assert: token absent.
    expect(text.includes("require(")).toBe(false);
  });
});
