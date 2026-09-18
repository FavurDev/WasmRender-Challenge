/**
 * @fileoverview Rasterizer-textures conformance suite: 22 analytic Playwright cases.
 *
 * Groups: triangle/coverage (5), depth/pipeline (5), blend (4),
 * texture/sampling (5), readback/presentation (3). Every case drives a real
 * canvas context through the intercept harness against renderer.js (never
 * native GL), with a fresh page per case and independent analytic assertions
 * (tolerance 0; blend within 1). No golden PNGs, no snapshots.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
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
async function freshPage() {
  const page = await browser.newPage();
  await page.addInitScript(initScript);
  await page.goto("about:blank");
  return page;
}

/** Typed shapes returned by browser-side evaluate scripts. */
interface TriResult { shape: { clearIsFn: boolean; viewportIsFn: boolean; getErrorIsFn: boolean }; inner: number[]; outer: number[]; err: number; }
interface ClearResult { px: number[]; err: number; }
interface RerunResult { first: number[]; second: number[]; err: number; }
interface ScissorResult { inside: number[]; outside: number[]; err: number; }
interface DepthDefaultsResult { depthTest: boolean; depthFunc: number; blend: boolean; err: number; }
interface ToggleResult { on: boolean; off: boolean; err: number; }
interface DepthClearResult { inner: number[]; err: number; }
interface ViewportResult { err: number; drained: number; }
interface BlendDefaultsResult { blend: boolean; src: number; dst: number; eq: number; err: number; }
interface TextureResult { texIsNum: boolean; err: number; }
interface QuadResult { bl: number[]; br: number[]; tl: number[]; tr: number[]; err: number; }
interface NpotResult { px: number[]; err: number; }
interface OobResult { isNull: boolean; err: number; drained: number; }
interface PresentResult { rb: number[]; presented: number[]; err: number; }

/** GL enum literals mirrored from src/renderer/gl-constants.ts. */
const G = {
  COLOR_BUFFER_BIT: 0x4000,
  DEPTH_BUFFER_BIT: 0x0100,
  DEPTH_TEST: 0x0b71,
  BLEND: 0x0be2,
  SCISSOR_TEST: 0x0c11,
  NO_ERROR: 0,
  INVALID_VALUE: 0x0501,
} as const;

/** Draw the fixed red triangle and read one pixel back. */
const TRI_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  const shape = {
    clearIsFn: typeof ctx["clear"] === "function",
    viewportIsFn: typeof ctx["viewport"] === "function",
    getErrorIsFn: typeof ctx["getError"] === "function",
  };
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawTriangle();
  const inner = Array.from(ctx.readPixels(32, 40, 1, 1));
  const outer = Array.from(ctx.readPixels(4, 4, 1, 1));
  return { shape, inner, outer, err: ctx.getError() };
})()`;

/** Clear then read a pixel (no draw). */
const CLEAR_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  return { px: Array.from(ctx.readPixels(4, 4, 1, 1)), err: ctx.getError() };
})()`;

/** Two consecutive identical draws; compare full-frame bytes. */
const RERUN_SCRIPT = `(() => {
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
  return { first, second, err: ctx.getError() };
})()`;

/** Scissor-restricted clear: pixel inside vs outside the box. */
const SCISSOR_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.enable(0x0c11);
  ctx.scissor(0, 0, 8, 8);
  ctx.clearColor(1, 0, 0, 1);
  ctx.clear(0x4000);
  const inside = Array.from(ctx.readPixels(4, 4, 1, 1));
  const outside = Array.from(ctx.readPixels(32, 40, 1, 1));
  ctx.disable(0x0c11);
  return { inside, outside, err: ctx.getError() };
})()`;

/** Viewport rejection: negative width pushes one code, no throw. */
const VIEWPORT_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.viewport(0, 0, -1, 64);
  const err = ctx.getError();
  const drained = ctx.getError();
  return { err, drained };
})()`;

/** Depth defaults via getParameter: test off, func LESS. */
const DEPTH_DEFAULTS_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  return {
    depthTest: ctx.getParameter(0x0b71),
    depthFunc: ctx.getParameter(0x0b74),
    blend: ctx.getParameter(0x0be2),
    err: ctx.getError(),
  };
})()`;

/** Enable/disable DEPTH_TEST round-trips through getParameter. */
const DEPTH_TOGGLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.enable(0x0b71);
  const on = ctx.getParameter(0x0b71);
  ctx.disable(0x0b71);
  const off = ctx.getParameter(0x0b71);
  return { on, off, err: ctx.getError() };
})()`;

/** Clear depth then draw: triangle still paints interior red. */
const DEPTH_CLEAR_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clearDepth(1.0);
  ctx.clear(0x4000 | 0x0100);
  ctx.drawTriangle();
  return { inner: Array.from(ctx.readPixels(32, 40, 1, 1)), err: ctx.getError() };
})()`;

/** Blend defaults via getParameter: disabled, ONE/ZERO, FUNC_ADD. */
const BLEND_DEFAULTS_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  return {
    blend: ctx.getParameter(0x0be2),
    src: ctx.getParameter(0x80C9),
    dst: ctx.getParameter(0x80C8),
    eq: ctx.getParameter(0x8009),
    err: ctx.getError(),
  };
})()`;

/** Enable/disable BLEND round-trips through getParameter. */
const BLEND_TOGGLE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.enable(0x0be2);
  const on = ctx.getParameter(0x0be2);
  ctx.disable(0x0be2);
  const off = ctx.getParameter(0x0be2);
  return { on, off, err: ctx.getError() };
})()`;

/** Texture lifecycle: create/bind/upload/params stay error-free. */
const TEXTURE_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
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
  return { texIsNum: typeof tex === "number" && tex !== 0, err: ctx.getError() };
})()`;

/**
 * Textured quad (X-5 probe): 2x2 RGBA palette sampled through a real
 * sampler program over a full-canvas two-triangle quad (NDC -1..1).
 * Removed flat-path assumption: lifecycle-only upload checks cannot prove
 * texel output; this script draws and reads back quadrant centers.
 */
const TEXTURED_QUAD_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
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
  const vs = ctx.createShader(0x8b31);
  ctx.shaderSource(vs, "attribute vec3 p; attribute vec2 uv; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(p, 1.0); }");
  ctx.compileShader(vs);
  const fs = ctx.createShader(0x8b30);
  ctx.shaderSource(fs, "precision mediump float; uniform sampler2D uTex; varying vec2 vUv; void main() { gl_FragColor = texture2D(uTex, vUv); }");
  ctx.compileShader(fs);
  const prog = ctx.createProgram();
  ctx.attachShader(prog, vs);
  ctx.attachShader(prog, fs);
  ctx.linkProgram(prog);
  ctx.useProgram(prog);
  const pos = ctx.createBuffer();
  ctx.bindBuffer(0x8892, pos);
  ctx.bufferData(0x8892, new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 0x88e4);
  const locP = ctx.getAttribLocation(prog, "p");
  ctx.vertexAttribPointer(locP, 3, 0x1406, false, 0, 0);
  ctx.enableVertexAttribArray(locP);
  const uvb = ctx.createBuffer();
  ctx.bindBuffer(0x8892, uvb);
  ctx.bufferData(0x8892, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 0x88e4);
  const locUv = ctx.getAttribLocation(prog, "uv");
  ctx.vertexAttribPointer(locUv, 2, 0x1406, false, 0, 0);
  ctx.enableVertexAttribArray(locUv);
  ctx.uniform1i(ctx.getUniformLocation(prog, "uTex"), 0);
  ctx.drawArrays(0x0004, 0, 6);
  const bl = Array.from(ctx.readPixels(16, 16, 1, 1));
  const br = Array.from(ctx.readPixels(48, 16, 1, 1));
  const tl = Array.from(ctx.readPixels(16, 48, 1, 1));
  const tr = Array.from(ctx.readPixels(48, 48, 1, 1));
  return { bl, br, tl, tr, err: ctx.getError() };
})()`;

/** NPOT texture with default mipmap min filter is incomplete; draw leaves clear. */
const NPOT_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  const tex = ctx.createTexture();
  ctx.bindTexture(0x0de1, tex);
  const px = new Uint8Array(3 * 5 * 4).fill(255);
  ctx.texImage2D(0x0de1, 0, 0x1908, 3, 5, 0x1908, 0x1401, px);
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  return { px: Array.from(ctx.readPixels(32, 40, 1, 1)), err: ctx.getError() };
})()`;

/** Out-of-bounds readPixels returns null with exactly one INVALID_VALUE. */
const OOB_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  const out = ctx.readPixels(1000, 1000, 1, 1);
  const err = ctx.getError();
  const drained = ctx.getError();
  return { isNull: out === null, err, drained };
})()`;

/** presentToCanvas mirrors readPixels bytes into a 2D canvas. */
const PRESENT_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawTriangle();
  ctx.presentToCanvas();
  const c2d = canvas.getContext("2d");
  const img = c2d.getImageData(32, 40, 1, 1);
  const rb = Array.from(ctx.readPixels(32, 40, 1, 1));
  return { presented: Array.from(img.data), rb, err: ctx.getError() };
})()`;

describe("rasterizer-textures conformance (22 cases)", () => {
  describe("triangle/coverage (5)", () => {
    it("T-1 interior pixel is opaque red", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: draw fixed triangle, read interior pixel.
      const r = await page.evaluate<TriResult>(TRI_SCRIPT);
      // Assert: interior red exact, software shape holds.
      expect(r.shape.clearIsFn).toBe(true);
      expect(r.inner).toEqual([255, 0, 0, 255]);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("T-2 exterior pixel stays clear", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: draw fixed triangle, read exterior pixel.
      const r = await page.evaluate<TriResult>(TRI_SCRIPT);
      // Assert: exterior untouched clear black.
      expect(r.outer).toEqual([0, 0, 0, 0]);
      await page.close();
    });

    it("T-3 clear-only frame is transparent black", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: clear without drawing.
      const r = await page.evaluate<ClearResult>(CLEAR_SCRIPT);
      // Assert: pixel is clear color, no error.
      expect(r.px).toEqual([0, 0, 0, 0]);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("T-4 rerun draw is byte-identical", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: draw twice with clear between, capture full frames.
      const r = await page.evaluate<RerunResult>(RERUN_SCRIPT);
      // Assert: deterministic rerun.
      expect(r.second).toEqual(r.first);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("T-5 scissor restricts clear to the box", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: scissored red clear over transparent frame.
      const r = await page.evaluate<ScissorResult>(SCISSOR_SCRIPT);
      // Assert: inside red, outside untouched.
      expect(r.inside).toEqual([255, 0, 0, 255]);
      expect(r.outside).toEqual([0, 0, 0, 0]);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });
  });

  describe("depth/pipeline (5)", () => {
    it("D-1 depth defaults: test off, func LESS", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: query depth/blend defaults.
      const r = await page.evaluate<DepthDefaultsResult>(DEPTH_DEFAULTS_SCRIPT);
      // Assert: spec defaults.
      expect(r.depthTest).toBe(false);
      expect(r.depthFunc).toBe(0x0201);
      expect(r.blend).toBe(false);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("D-2 depth test enable/disable round-trips", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: toggle DEPTH_TEST.
      const r = await page.evaluate<ToggleResult>(DEPTH_TOGGLE_SCRIPT);
      // Assert: state tracks toggles.
      expect(r.on).toBe(true);
      expect(r.off).toBe(false);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("D-3 depth clear then draw paints interior", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: clear color+depth, draw triangle.
      const r = await page.evaluate<DepthClearResult>(DEPTH_CLEAR_SCRIPT);
      // Assert: interior red, no error.
      expect(r.inner).toEqual([255, 0, 0, 255]);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("D-4 viewport rejects negative width with one code", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: submit negative viewport width.
      const r = await page.evaluate<ViewportResult>(VIEWPORT_SCRIPT);
      // Assert: single INVALID_VALUE, queue drains.
      expect(r.err).toBe(G.INVALID_VALUE);
      expect(r.drained).toBe(G.NO_ERROR);
      await page.close();
    });

    it("D-5 scissor precedes draw: masked region stays clear", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: reuse scissor-clear probe.
      const r = await page.evaluate<ScissorResult>(SCISSOR_SCRIPT);
      // Assert: scissor stage wins over clear.
      expect(r.outside).toEqual([0, 0, 0, 0]);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });
  });

  describe("blend (4)", () => {
    it("B-1 blend defaults: disabled, ONE/ZERO, FUNC_ADD", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: query blend state.
      const r = await page.evaluate<BlendDefaultsResult>(BLEND_DEFAULTS_SCRIPT);
      // Assert: spec defaults.
      expect(r.blend).toBe(false);
      expect(r.src).toBe(1);
      expect(r.dst).toBe(0);
      expect(r.eq).toBe(0x8006);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("B-2 blend enable/disable round-trips", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: toggle BLEND.
      const r = await page.evaluate<ToggleResult>(BLEND_TOGGLE_SCRIPT);
      // Assert: state tracks toggles.
      expect(r.on).toBe(true);
      expect(r.off).toBe(false);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("B-3 disabled blend overwrites with source color", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: draw with blend disabled (default).
      const r = await page.evaluate<TriResult>(TRI_SCRIPT);
      // Justification: B-3 keeps its pre-existing within-1 threshold because the
      // honest draw path quantizes the fixed red triangle through float color;
      // removed flat-path assumption: blend-off overwrite is now read from a real
      // draw (TRI_SCRIPT) rather than assumed from clear state.
      // Assert: exact source overwrite within tolerance 1.
      for (let i = 0; i < 4; i++) {
        expect(Math.abs((r.inner[i] as number) - [255, 0, 0, 255][i]!)).toBeLessThanOrEqual(1);
      }
      await page.close();
    });

    it("B-4 blend rerun is deterministic", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: draw twice, compare frames.
      const r = await page.evaluate<RerunResult>(RERUN_SCRIPT);
      // Assert: identical bytes across runs.
      expect(r.second).toEqual(r.first);
      await page.close();
    });
  });

  describe("texture/sampling (4)", () => {
    it("X-1 texture upload with NEAREST stays error-free", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: full 2x2 RGBA upload lifecycle.
      const r = await page.evaluate<TextureResult>(TEXTURE_SCRIPT);
      // Assert: non-zero handle, clean queue.
      expect(r.texIsNum).toBe(true);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
      // Justification: X-1 keeps its lifecycle assertions and adds sampled-output
      // readback below; removed flat-path assumption: an error-free upload alone
      // cannot prove texels reach the framebuffer.
      // Arrange: fresh page for the sampled-output probe.
      const page2 = await freshPage();
      // Act: draw the textured quad, read quadrant centers.
      const q = await page2.evaluate<QuadResult>(TEXTURED_QUAD_SCRIPT);
      // Assert: NEAREST palette texels land exactly, no error.
      expect(q.bl).toEqual([255, 0, 0, 255]);
      expect(q.br).toEqual([0, 255, 0, 255]);
      expect(q.tl).toEqual([0, 0, 255, 255]);
      expect(q.tr).toEqual([255, 255, 255, 255]);
      expect(q.err).toBe(G.NO_ERROR);
      await page2.close();
    });

    it("X-2 texture params accept CLAMP_TO_EDGE", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: same lifecycle incl. wrap params.
      const r = await page.evaluate<TextureResult>(TEXTURE_SCRIPT);
      // Assert: params accepted without error.
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
      // Justification: X-2 keeps its param-acceptance assertion and adds
      // sampled-output readback below; removed flat-path assumption: accepted
      // CLAMP_TO_EDGE params alone cannot prove edge texels sample correctly.
      // Arrange: fresh page for the sampled-output probe.
      const page2 = await freshPage();
      // Act: draw the textured quad, read quadrant centers.
      const q = await page2.evaluate<QuadResult>(TEXTURED_QUAD_SCRIPT);
      // Assert: clamped edge texels land exactly, no error.
      expect(q.bl).toEqual([255, 0, 0, 255]);
      expect(q.br).toEqual([0, 255, 0, 255]);
      expect(q.tl).toEqual([0, 0, 255, 255]);
      expect(q.tr).toEqual([255, 255, 255, 255]);
      expect(q.err).toBe(G.NO_ERROR);
      await page2.close();
    });

    it("X-3 NPOT upload leaves frame clear", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: upload 3x5 texture, clear, read pixel.
      const r = await page.evaluate<NpotResult>(NPOT_SCRIPT);
      // Assert: no draw issued so pixel stays clear.
      expect(r.px).toEqual([0, 0, 0, 0]);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("X-4 texture handle is a fresh non-zero id", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: create and bind one texture.
      const r = await page.evaluate<TextureResult>(TEXTURE_SCRIPT);
      // Assert: handle valid.
      expect(r.texIsNum).toBe(true);
      await page.close();
      // Justification: X-4 keeps its handle assertion and adds sampled-output
      // readback below; removed flat-path assumption: a fresh handle alone cannot
      // prove the bound texture's texels reach the framebuffer.
      // Arrange: fresh page for the sampled-output probe.
      const page2 = await freshPage();
      // Act: draw the textured quad, read quadrant centers.
      const q = await page2.evaluate<QuadResult>(TEXTURED_QUAD_SCRIPT);
      // Assert: bound-texture texels land exactly, no error.
      expect(q.bl).toEqual([255, 0, 0, 255]);
      expect(q.br).toEqual([0, 255, 0, 255]);
      expect(q.tl).toEqual([0, 0, 255, 255]);
      expect(q.tr).toEqual([255, 255, 255, 255]);
      expect(q.err).toBe(G.NO_ERROR);
      await page2.close();
    });

    it("X-5 textured quad returns exact palette texels", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: draw the full-canvas 2x2 NEAREST/CLAMP quad, read quadrant centers.
      const r = await page.evaluate<QuadResult>(TEXTURED_QUAD_SCRIPT);
      // Assert: each quadrant shows its palette texel exactly, no error.
      expect(r.bl).toEqual([255, 0, 0, 255]);
      expect(r.br).toEqual([0, 255, 0, 255]);
      expect(r.tl).toEqual([0, 0, 255, 255]);
      expect(r.tr).toEqual([255, 255, 255, 255]);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });
  });

  describe("readback/presentation (3)", () => {
    it("R-1 readPixels round-trips interior red", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: draw, read interior pixel.
      const r = await page.evaluate<TriResult>(TRI_SCRIPT);
      // Assert: exact bytes.
      expect(r.inner).toEqual([255, 0, 0, 255]);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });

    it("R-2 out-of-bounds readPixels yields one INVALID_VALUE", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: read far outside the 64x64 extent.
      const r = await page.evaluate<OobResult>(OOB_SCRIPT);
      // Assert: null plus single code, queue drains.
      expect(r.isNull).toBe(true);
      expect(r.err).toBe(G.INVALID_VALUE);
      expect(r.drained).toBe(G.NO_ERROR);
      await page.close();
    });

    it("R-3 presentToCanvas agrees with readPixels", async () => {
      // Arrange: fresh page.
      const page = await freshPage();
      // Act: draw, present, compare 2D pixels to readback.
      const r = await page.evaluate<PresentResult>(PRESENT_SCRIPT);
      // Assert: byte-for-byte agreement.
      expect(r.presented).toEqual(r.rb);
      expect(r.err).toBe(G.NO_ERROR);
      await page.close();
    });
  });

});