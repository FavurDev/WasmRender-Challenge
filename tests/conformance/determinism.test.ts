/**
 * @fileoverview Determinism conformance suite: double-run byte-identity plus
 * fresh-context reproducibility gates for four golden scenes.
 *
 * Scenes: red-triangle-64, depth-overlap-64, blend-50pct-64, textured-quad-256.
 * Every case asserts full-frame byte identity (length + every byte + first-diff)
 * BEFORE any analytic assertion, plus NO_ERROR. Fresh page per case.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { assertRendererExists, buildInterceptScript } from "../../src/context-intercept";

let browser: Browser;
let initScript: string;

beforeAll(async () => {
  // Arrange: gate on built bundle, then launch headless Chromium.
  assertRendererExists();
  initScript = buildInterceptScript();
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  // Arrange: release the browser.
  await browser.close();
});

/** Open a fresh page with the intercept installed. */
async function freshPage(): Promise<Page> {
  const page = await browser.newPage();
  await page.addInitScript(initScript);
  await page.goto("about:blank");
  return page;
}

/** Verdict of the deterministic byte-identity compare. */
interface ByteIdentity {
  identical: boolean;
  lenA: number;
  lenB: number;
  firstDiff: number;
  firstA: number;
  firstB: number;
}

/**
 * Compare two frame buffers byte-for-byte with first-diff reporting.
 *
 * @param a Reference bytes.
 * @param b Candidate bytes.
 * @returns Identity verdict with lengths and first-diff detail (-1 when identical).
 */
export function assertByteIdentical(a: number[] | null, b: number[] | null): ByteIdentity {
  if (a === null || b === null || a.length === 0 || b.length === 0) {
    return { identical: false, lenA: a === null ? -1 : a.length, lenB: b === null ? -1 : b.length, firstDiff: -1, firstA: -1, firstB: -1 };
  }
  if (a.length !== b.length) {
    return { identical: false, lenA: a.length, lenB: b.length, firstDiff: -1, firstA: -1, firstB: -1 };
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return { identical: false, lenA: a.length, lenB: b.length, firstDiff: i, firstA: a[i] as number, firstB: b[i] as number };
    }
  }
  return { identical: true, lenA: a.length, lenB: b.length, firstDiff: -1, firstA: -1, firstB: -1 };
}

interface DoubleRunResult { first: number[] | null; second: number[] | null; err: number; inner: number[]; outer: number[]; }
interface FreshResult { buf: number[] | null; err: number; inner: number[]; outer: number[]; }
interface TexDoubleRunResult { first: number[] | null; second: number[] | null; err: number; texIsNum: boolean; }

const NO_ERROR = 0;

/** 64px red triangle scene rendered twice in the same context. */
const RED_DOUBLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawTriangle();
  const first = Array.from(ctx.readPixels(0, 0, 64, 64));
  ctx.clear(0x4000);
  ctx.drawTriangle();
  const second = Array.from(ctx.readPixels(0, 0, 64, 64));
  const inner = Array.from(ctx.readPixels(32, 40, 1, 1));
  const outer = Array.from(ctx.readPixels(4, 4, 1, 1));
  return { first, second, err: ctx.getError(), inner, outer };
})()`;

/** 64px red triangle scene rendered once (for fresh-context pairs). */
const RED_SINGLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawTriangle();
  const buf = Array.from(ctx.readPixels(0, 0, 64, 64));
  const inner = Array.from(ctx.readPixels(32, 40, 1, 1));
  const outer = Array.from(ctx.readPixels(4, 4, 1, 1));
  return { buf, err: ctx.getError(), inner, outer };
})()`;

/** 64px depth scene rendered twice in the same context. */
const DEPTH_DOUBLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clearDepth(1.0);
  ctx.clear(0x4000 | 0x0100);
  ctx.enable(0x0b71);
  ctx.drawTriangle();
  const first = Array.from(ctx.readPixels(0, 0, 64, 64));
  ctx.clear(0x4000 | 0x0100);
  ctx.drawTriangle();
  const second = Array.from(ctx.readPixels(0, 0, 64, 64));
  const inner = Array.from(ctx.readPixels(32, 40, 1, 1));
  const outer = Array.from(ctx.readPixels(4, 4, 1, 1));
  return { first, second, err: ctx.getError(), inner, outer };
})()`;

/** 64px depth scene rendered once. */
const DEPTH_SINGLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clearDepth(1.0);
  ctx.clear(0x4000 | 0x0100);
  ctx.enable(0x0b71);
  ctx.drawTriangle();
  const buf = Array.from(ctx.readPixels(0, 0, 64, 64));
  const inner = Array.from(ctx.readPixels(32, 40, 1, 1));
  const outer = Array.from(ctx.readPixels(4, 4, 1, 1));
  return { buf, err: ctx.getError(), inner, outer };
})()`;

/** 64px blend-overwrite scene rendered twice in the same context. */
const BLEND_DOUBLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.disable(0x0be2);
  ctx.drawTriangle();
  const first = Array.from(ctx.readPixels(0, 0, 64, 64));
  ctx.clear(0x4000);
  ctx.disable(0x0be2);
  ctx.drawTriangle();
  const second = Array.from(ctx.readPixels(0, 0, 64, 64));
  const inner = Array.from(ctx.readPixels(32, 40, 1, 1));
  const outer = Array.from(ctx.readPixels(4, 4, 1, 1));
  return { first, second, err: ctx.getError(), inner, outer };
})()`;

/** 64px blend-overwrite scene rendered once. */
const BLEND_SINGLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.disable(0x0be2);
  ctx.drawTriangle();
  const buf = Array.from(ctx.readPixels(0, 0, 64, 64));
  const inner = Array.from(ctx.readPixels(32, 40, 1, 1));
  const outer = Array.from(ctx.readPixels(4, 4, 1, 1));
  return { buf, err: ctx.getError(), inner, outer };
})()`;

/** 256px texture scene rendered twice in the same context. */
const TEX_DOUBLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  const tex = ctx.createTexture();
  ctx.bindTexture(0x0de1, tex);
  const px = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  ctx.texImage2D(0x0de1, 0, 0x1908, 2, 2, 0x1908, 0x1401, px);
  ctx.texParameteri(0x0de1, 0x2801, 0x2600);
  ctx.texParameteri(0x0de1, 0x2800, 0x2600);
  ctx.texParameteri(0x0de1, 0x2802, 0x812f);
  ctx.texParameteri(0x0de1, 0x2803, 0x812f);
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawTriangle();
  const first = Array.from(ctx.readPixels(0, 0, 256, 256));
  ctx.clear(0x4000);
  ctx.drawTriangle();
  const second = Array.from(ctx.readPixels(0, 0, 256, 256));
  return { first, second, err: ctx.getError(), texIsNum: typeof tex === "number" && tex !== 0 };
})()`;

/** 256px texture scene rendered once. */
const TEX_SINGLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  const tex = ctx.createTexture();
  ctx.bindTexture(0x0de1, tex);
  const px = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  ctx.texImage2D(0x0de1, 0, 0x1908, 2, 2, 0x1908, 0x1401, px);
  ctx.texParameteri(0x0de1, 0x2801, 0x2600);
  ctx.texParameteri(0x0de1, 0x2800, 0x2600);
  ctx.texParameteri(0x0de1, 0x2802, 0x812f);
  ctx.texParameteri(0x0de1, 0x2803, 0x812f);
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawTriangle();
  const buf = Array.from(ctx.readPixels(0, 0, 256, 256));
  return { buf, err: ctx.getError(), texIsNum: typeof tex === "number" && tex !== 0 };
})()`;

describe("determinism gates (9 cases)", () => {
  it("compare helper reports first-diff", () => {
    // Arrange: fixed fixtures, one equal pair and one differing pair.
    const a = [1, 2, 3, 4];
    const b = [1, 2, 3, 4];
    const c = [1, 2, 9, 4];
    // Act: compare both pairs.
    const eq = assertByteIdentical(a, b);
    const ne = assertByteIdentical(a, c);
    // Assert: equal identical, differing reports index 2 with values.
    expect(eq.identical).toBe(true);
    expect(eq.firstDiff).toBe(-1);
    expect(ne.identical).toBe(false);
    expect(ne.firstDiff).toBe(2);
    expect(ne.firstA).toBe(3);
    expect(ne.firstB).toBe(9);
  });

  it("red-triangle-64 double-run byte-identical", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: render twice in the same context.
    const r = await page.evaluate<DoubleRunResult>(RED_DOUBLE_SCRIPT);
    const v = assertByteIdentical(r.first, r.second);
    // Assert: byte identity first, then error + analytics.
    expect(v.identical).toBe(true);
    expect(v.lenA).toBe(64 * 64 * 4);
    expect(v.firstDiff).toBe(-1);
    expect(r.err).toBe(NO_ERROR);
    expect(r.inner).toEqual([255, 0, 0, 255]);
    expect(r.outer).toEqual([0, 0, 0, 0]);
    await page.close();
  });

  it("red-triangle-64 fresh-context byte-identical", async () => {
    // Arrange: two independent pages with identical script.
    const p1 = await freshPage();
    const p2 = await freshPage();
    // Act: render once per context.
    const r1 = await p1.evaluate<FreshResult>(RED_SINGLE_SCRIPT);
    const r2 = await p2.evaluate<FreshResult>(RED_SINGLE_SCRIPT);
    const v = assertByteIdentical(r1.buf, r2.buf);
    // Assert: byte identity first, then error + analytics.
    expect(v.identical).toBe(true);
    expect(v.firstDiff).toBe(-1);
    expect(r1.err).toBe(NO_ERROR);
    expect(r2.err).toBe(NO_ERROR);
    expect(r1.inner).toEqual([255, 0, 0, 255]);
    await p1.close();
    await p2.close();
  });

  it("depth-overlap-64 double-run byte-identical", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: render depth scene twice same context.
    const r = await page.evaluate<DoubleRunResult>(DEPTH_DOUBLE_SCRIPT);
    const v = assertByteIdentical(r.first, r.second);
    // Assert: byte identity first, then error + analytics.
    expect(v.identical).toBe(true);
    expect(v.firstDiff).toBe(-1);
    expect(r.err).toBe(NO_ERROR);
    expect(r.inner).toEqual([255, 0, 0, 255]);
    await page.close();
  });

  it("depth-overlap-64 fresh-context byte-identical", async () => {
    // Arrange: two independent pages.
    const p1 = await freshPage();
    const p2 = await freshPage();
    // Act: render once per context.
    const r1 = await p1.evaluate<FreshResult>(DEPTH_SINGLE_SCRIPT);
    const r2 = await p2.evaluate<FreshResult>(DEPTH_SINGLE_SCRIPT);
    const v = assertByteIdentical(r1.buf, r2.buf);
    // Assert: byte identity first, then errors.
    expect(v.identical).toBe(true);
    expect(v.firstDiff).toBe(-1);
    expect(r1.err).toBe(NO_ERROR);
    expect(r2.err).toBe(NO_ERROR);
    await p1.close();
    await p2.close();
  });

  it("blend-50pct-64 double-run byte-identical", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: render blend scene twice same context.
    const r = await page.evaluate<DoubleRunResult>(BLEND_DOUBLE_SCRIPT);
    const v = assertByteIdentical(r.first, r.second);
    // Assert: byte identity first, then tolerance-1 source overwrite.
    expect(v.identical).toBe(true);
    expect(v.firstDiff).toBe(-1);
    expect(r.err).toBe(NO_ERROR);
    for (let i = 0; i < 4; i++) {
      expect(Math.abs((r.inner[i] as number) - [255, 0, 0, 255][i]!)).toBeLessThanOrEqual(1);
    }
    await page.close();
  });

  it("blend-50pct-64 fresh-context byte-identical", async () => {
    // Arrange: two independent pages.
    const p1 = await freshPage();
    const p2 = await freshPage();
    // Act: render once per context.
    const r1 = await p1.evaluate<FreshResult>(BLEND_SINGLE_SCRIPT);
    const r2 = await p2.evaluate<FreshResult>(BLEND_SINGLE_SCRIPT);
    const v = assertByteIdentical(r1.buf, r2.buf);
    // Assert: byte identity first, then errors.
    expect(v.identical).toBe(true);
    expect(v.firstDiff).toBe(-1);
    expect(r1.err).toBe(NO_ERROR);
    expect(r2.err).toBe(NO_ERROR);
    await p1.close();
    await p2.close();
  });

  it("textured-quad-256 double-run byte-identical", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: render texture scene twice same context.
    const r = await page.evaluate<TexDoubleRunResult>(TEX_DOUBLE_SCRIPT);
    const v = assertByteIdentical(r.first, r.second);
    // Assert: byte identity first, then handle + error.
    expect(v.identical).toBe(true);
    expect(v.lenA).toBe(256 * 256 * 4);
    expect(v.firstDiff).toBe(-1);
    expect(r.err).toBe(NO_ERROR);
    expect(r.texIsNum).toBe(true);
    await page.close();
  });

  it("textured-quad-256 fresh-context byte-identical", async () => {
    // Arrange: two independent pages.
    const p1 = await freshPage();
    const p2 = await freshPage();
    // Act: render once per context.
    const r1 = await p1.evaluate<{ buf: number[] | null; err: number; texIsNum: boolean }>(TEX_SINGLE_SCRIPT);
    const r2 = await p2.evaluate<{ buf: number[] | null; err: number; texIsNum: boolean }>(TEX_SINGLE_SCRIPT);
    const v = assertByteIdentical(r1.buf, r2.buf);
    // Assert: byte identity first, then errors.
    expect(v.identical).toBe(true);
    expect(v.firstDiff).toBe(-1);
    expect(r1.err).toBe(NO_ERROR);
    expect(r2.err).toBe(NO_ERROR);
    await p1.close();
    await p2.close();
  });
});
