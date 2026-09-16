/**
 * @fileoverview Context-routing conformance suite: alias routing, override, stub, global-install.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

describe("context-routing", () => {
  it("aliases route to software context for webgl, webgl2, experimental-webgl", async () => {
    // Arrange: fresh page per alias with init script installed.
    for (const alias of ["webgl", "webgl2", "experimental-webgl"] as const) {
      const page = await browser.newPage();
      await page.addInitScript(initScript);
      await page.goto("about:blank");
      // Act: request context for alias, report shape flags.
      const report = await page.evaluate((kind: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext(kind) as unknown as Record<string, unknown> | null;
        const w = window as unknown as Record<string, unknown>;
        return {
          nonNull: typeof ctx === "object" && ctx !== null,
          clearIsFn: ctx !== null && typeof ctx["clear"] === "function",
          viewportIsFn: ctx !== null && typeof ctx["viewport"] === "function",
          getErrorIsFn: ctx !== null && typeof ctx["getError"] === "function",
          isNative:
            typeof (w["WebGLRenderingContext"] as unknown) === "function" &&
            ctx instanceof (w["WebGLRenderingContext"] as new (...a: never[]) => unknown),
        };
      }, alias);
      // Assert: software shape, not native.
      expect(report.nonNull).toBe(true);
      expect(report.clearIsFn).toBe(true);
      expect(report.viewportIsFn).toBe(true);
      expect(report.getErrorIsFn).toBe(true);
      expect(report.isNative).toBe(false);
      await page.close();
    }
  });

  it("renderer path override resolves and still routes", async () => {
    // Arrange: point env at explicit bundle path.
    const prior = process.env["WEBGL_SOFTWARE_RENDERER"];
    process.env["WEBGL_SOFTWARE_RENDERER"] = "./renderer.js";
    try {
      // Act: resolve path and route on fresh page.
      const resolved = getRendererPath();
      expect(resolved).toBe("./renderer.js");
      const script = buildInterceptScript();
      const page = await browser.newPage();
      await page.addInitScript(script);
      await page.goto("about:blank");
      const ok = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        document.body.appendChild(canvas);
        const ctx = canvas.getContext("webgl") as unknown as Record<string, unknown> | null;
        return (
          ctx !== null &&
          typeof ctx["clear"] === "function" &&
          typeof ctx["viewport"] === "function" &&
          typeof ctx["getError"] === "function"
        );
      });
      // Assert: still software.
      expect(ok).toBe(true);
      await page.close();
    } finally {
      if (prior === undefined) delete process.env["WEBGL_SOFTWARE_RENDERER"];
      else process.env["WEBGL_SOFTWARE_RENDERER"] = prior;
    }
  });

  it("missing renderer sets document.title and getContext throws", async () => {
    // Arrange: point renderer path at nonexistent file.
    const prior = process.env["WEBGL_SOFTWARE_RENDERER"];
    process.env["WEBGL_SOFTWARE_RENDERER"] = "./does-not-exist-renderer.js";
    const stubPage = await browser.newPage();
    try {
      const stubScript = buildInterceptScript();
      await stubPage.addInitScript(stubScript);
      await stubPage.goto("about:blank");
      // Act: request webgl context, capture throw; read title.
      const result = await stubPage.evaluate(() => {
        const canvas = document.createElement("canvas");
        document.body.appendChild(canvas);
        let thrown = false;
        try {
          canvas.getContext("webgl");
        } catch {
          thrown = true;
        }
        return { thrown, title: document.title };
      });
      // Assert: loud failure.
      expect(result.title).toBe("RENDERER_NOT_FOUND");
      expect(result.thrown).toBe(true);
    } finally {
      if (prior === undefined) delete process.env["WEBGL_SOFTWARE_RENDERER"];
      else process.env["WEBGL_SOFTWARE_RENDERER"] = prior;
      await stubPage.close();
    }
  });

  it("injected bundle installs global AND getContext returns shaped object", async () => {
    // Arrange: fresh page with init script.
    const page = await browser.newPage();
    await page.addInitScript(initScript);
    await page.goto("about:blank");
    // Act: check global kind and shape flags.
    const globalKind = await page.evaluate(
      () => typeof (window as unknown as Record<string, unknown>)["__createSoftwareWebGLContext"],
    );
    const shape = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext("webgl") as unknown as Record<string, unknown> | null;
      return {
        clearIsFn: ctx !== null && typeof ctx["clear"] === "function",
        viewportIsFn: ctx !== null && typeof ctx["viewport"] === "function",
        getErrorIsFn: ctx !== null && typeof ctx["getError"] === "function",
      };
    });
    // Assert: ADR-005 recurrence fails loudly.
    expect(globalKind).toBe("function");
    expect(shape.clearIsFn).toBe(true);
    expect(shape.viewportIsFn).toBe(true);
    expect(shape.getErrorIsFn).toBe(true);
    await page.close();
  });
});
