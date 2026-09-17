/**
 * @fileoverview WebGL2 subset conformance suite: 10 analytic Playwright cases (T1-T10).
 *
 * Covers instanced draws + divisor semantics (T1, T2, T9), VAO isolation (T3),
 * drawBuffers attachment routing (T4, T10), float texture uploads (T5),
 * DEPTH24_STENCIL8 renderbuffers (T6), extension list (T7), and lose-restore
 * transitions (T8). Every case drives a real canvas context through the
 * intercept harness against renderer.js (never native GL), with a fresh page
 * per case and analytic pixel/error assertions only. No golden PNGs, no
 * snapshots, no timers, no randomness.
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
interface FrameResult { frame: number[]; err: number; drained: number; }
interface DiffResult { left: number; right: number; err: number; }
interface DivResult { diff: number; err: number; }
interface VaoResult { same: boolean; err: number; }
interface AttachResult { single: number[]; empty: number[]; plane0: number[]; plane1: number[]; err: number; drained: number; }
interface FloatResult { rgbaOk: boolean; rOk: boolean; err: number; drained: number; }
interface DepthResult { stored: number | null; rejectedKept: boolean; err: number; }
interface ExtResult { names: string[]; unknownIsNull: boolean; err: number; }
interface LostResult { codes: number[]; unchanged: boolean; afterRestore: number; drained: number; }
interface NegResult { err: number; drained: number; unchanged: boolean; }
interface DbResult { err: number; drained: number; }

/** GL enum literals mirrored from src/renderer/gl-constants.ts. */
const G = {
  TRIANGLES: 0x0004,
  COLOR_BUFFER_BIT: 0x4000,
  NO_ERROR: 0,
  INVALID_ENUM: 0x0500,
  INVALID_VALUE: 0x0501,
  INVALID_OPERATION: 0x0502,
  CONTEXT_LOST_WEBGL: 0x9242,
  ARRAY_BUFFER: 0x8892,
  STATIC_DRAW: 0x88e4,
  FLOAT: 0x1406,
  UNSIGNED_SHORT: 0x1403,
  TEXTURE_2D: 0x0de1,
  RGBA: 0x1908,
  RED: 0x1903,
  R32F: 0x822e,
  RGBA32F: 0x8814,
  NEAREST: 0x2600,
  TEXTURE_MIN_FILTER: 0x2801,
  TEXTURE_MAG_FILTER: 0x2800,
  RENDERBUFFER: 0x8d41,
  DEPTH24_STENCIL8: 0x88f0,
  COLOR_ATTACHMENT0: 0x8ce0,
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
} as const;

/**
 * Shared in-page program setup: position buffer (slot 0, vec3) + offset
 * buffer (slot 1, vec2) + minimal red program, left bound and in use.
 * Emits no error when the compiler chain accepts the shaders.
 */
const PROG_SETUP = `
  function setupInstanced(ctx) {
    const pos = new Float32Array([-0.8, -0.8, 0, 0.0, -0.8, 0, -0.4, 0.0, 0]);
    const off = new Float32Array([-0.1, 0, 0.5, 0]);
    const b0 = ctx.createBuffer();
    ctx.bindBuffer(0x8892, b0);
    ctx.bufferData(0x8892, pos, 0x88e4);
    ctx.enableVertexAttribArray(0);
    ctx.vertexAttribPointer(0, 3, 0x1406, false, 0, 0);
    const b1 = ctx.createBuffer();
    ctx.bindBuffer(0x8892, b1);
    ctx.bufferData(0x8892, off, 0x88e4);
    ctx.enableVertexAttribArray(1);
    ctx.vertexAttribPointer(1, 2, 0x1406, false, 0, 0);
    const vs = ctx.createShader(0x8b31);
    ctx.shaderSource(vs, 'attribute vec3 p; attribute vec2 off; void main(){ gl_Position = vec4(p.xy + off, 0.0, 1.0); }');
    ctx.compileShader(vs);
    const fs = ctx.createShader(0x8b30);
    ctx.shaderSource(fs, 'void main(){ gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }');
    ctx.compileShader(fs);
    const p = ctx.createProgram();
    ctx.attachShader(p, vs);
    ctx.attachShader(p, fs);
    ctx.linkProgram(p);
    ctx.useProgram(p);
    while (ctx.getError() !== 0) {}
  }
`;

/** T1: 2 instances with divisor 1 paint left and right halves. */
const T1_SCRIPT = `(() => {
  ${PROG_SETUP}
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  setupInstanced(ctx);
  ctx.vertexAttribDivisor(1, 1);
  ctx.drawArraysInstanced(0x0004, 0, 3, 2);
  const px = Array.from(ctx.readPixels(0, 0, 64, 64));
  let left = 0, right = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    if (px[(y * 64 + x) * 4] > 128) { if (x < 32) left++; else right++; }
  }
  return { left, right, err: ctx.getError() };
})()`;

/** T2: divisor-1 frame differs observably from divisor-0 frame. */
const T2_SCRIPT = `(() => {
  ${PROG_SETUP}
  function run(div) {
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("webgl2");
    setupInstanced(ctx);
    ctx.vertexAttribDivisor(1, div);
    ctx.drawArraysInstanced(0x0004, 0, 3, 2);
    return Array.from(ctx.readPixels(0, 0, 64, 64));
  }
  const a = run(1), b = run(0);
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return { diff, err: 0 };
})()`;

/** T3: VAO A renders identically before and after VAO B detour. */
const T3_SCRIPT = `(() => {
  ${PROG_SETUP}
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  setupInstanced(ctx);
  const vaoA = ctx.createVertexArray();
  ctx.bindVertexArray(vaoA);
  ctx.vertexAttribDivisor(1, 1);
  ctx.drawArraysInstanced(0x0004, 0, 3, 2);
  const first = Array.from(ctx.readPixels(0, 0, 64, 64));
  const vaoB = ctx.createVertexArray();
  ctx.bindVertexArray(vaoB);
  ctx.vertexAttribDivisor(1, 0);
  ctx.disableVertexAttribArray(1);
  ctx.bindVertexArray(vaoA);
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawArraysInstanced(0x0004, 0, 3, 2);
  const second = Array.from(ctx.readPixels(0, 0, 64, 64));
  let same = first.length === second.length;
  if (same) for (let i = 0; i < first.length; i++) if (first[i] !== second[i]) { same = false; break; }
  return { same, err: ctx.getError() };
})()`;

/**
 * T4: clear with drawBuffers([A1]) or drawBuffers([]) must leave
 * attachment 0 (the readPixels plane) transparent, plus a dual-output
 * draw must land distinct colors on each plane (plane 1 = complement).
 * Pre-remediation clear always fills attachment 0, so probes read red.
 */
const T4_SCRIPT = `(() => {
  ${PROG_SETUP}
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawBuffers([0x8ce0 + 1]);
  ctx.clearColor(1, 0, 0, 1);
  ctx.clear(0x4000);
  const single = Array.from(ctx.readPixels(32, 32, 1, 1));
  ctx.drawBuffers([]);
  ctx.clear(0x4000);
  const empty = Array.from(ctx.readPixels(32, 32, 1, 1));
  ctx.drawBuffers([0x8ce0, 0x8ce0 + 1]);
  setupInstanced(ctx);
  ctx.vertexAttribDivisor(1, 1);
  ctx.drawArraysInstanced(0x0004, 0, 3, 2);
  const plane0 = Array.from(ctx.readAttachment(16, 16, 1, 1, 0));
  const plane1 = Array.from(ctx.readAttachment(16, 16, 1, 1, 1));
  const err = ctx.getError();
  return { single, empty, plane0, plane1, err, drained: ctx.getError() };
})()`;

/** T5: RGBA32F + R32F float uploads accepted without error. */
const T5_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const t1 = ctx.createTexture();
  ctx.bindTexture(0x0de1, t1);
  ctx.texImage2D(0x0de1, 0, 0x8814, 2, 2, 0x1908, 0x1406, new Float32Array([2.5, -1.0, 0.5, 1.0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0]));
  ctx.texParameteri(0x0de1, 0x2801, 0x2600);
  ctx.texParameteri(0x0de1, 0x2800, 0x2600);
  const rgbaOk = ctx.getError() === 0;
  const t2 = ctx.createTexture();
  ctx.bindTexture(0x0de1, t2);
  ctx.texImage2D(0x0de1, 0, 0x822e, 2, 2, 0x1903, 0x1406, new Float32Array([0.25, 0.5, 0.75, 1.0]));
  ctx.texParameteri(0x0de1, 0x2801, 0x2600);
  ctx.texParameteri(0x0de1, 0x2800, 0x2600);
  const rOk = ctx.getError() === 0;
  return { rgbaOk, rOk, err: ctx.getError(), drained: ctx.getError() };
})()`;

/** T6: DEPTH24_STENCIL8 storage + LESS-conditional depth helpers. */
const T6_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const rb = ctx.createRenderbuffer();
  ctx.bindRenderbuffer(0x8d41, rb);
  ctx.renderbufferStorage(0x8d41, 0x88f0, 64, 64);
  const allocErr = ctx.getError();
  ctx.writeDepthForTest(rb, 10, 10, 0.8);
  ctx.writeDepthForTest(rb, 10, 10, 0.3);
  const stored = ctx.readDepth(rb, 10, 10);
  ctx.writeDepthForTest(rb, 10, 10, 0.9);
  const kept = ctx.readDepth(rb, 10, 10);
  return { stored, rejectedKept: kept === stored, err: allocErr };
})()`;

/** T7: exactly three extension names; unknown name -> null, no error. */
const T7_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const names = ctx.getSupportedExtensions();
  const unknownIsNull = ctx.getExtension("WEBGL_unknown_future_ext") === null;
  return { names, unknownIsNull, err: ctx.getError() };
})()`;

/**
 * T8: after loseContext, all four draws + clear each push exactly one
 * CONTEXT_LOST_WEBGL with bytes unchanged; restoreContext resumes work.
 * Pre-remediation the instanced draws lack the guard and push
 * INVALID_OPERATION (no program bound), so this fails red.
 */
const T8_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  const before = Array.from(ctx.readPixels(0, 0, 64, 64));
  ctx.loseContext();
  ctx.drawArrays(0x0004, 0, 3);
  const c0 = ctx.getError();
  ctx.drawElements(0x0004, 0, 0x1403, 0);
  const c1 = ctx.getError();
  ctx.drawArraysInstanced(0x0004, 0, 3, 2);
  const c2 = ctx.getError();
  ctx.drawElementsInstanced(0x0004, 0, 0x1403, 0, 2);
  const c3 = ctx.getError();
  ctx.clear(0x4000);
  const c4 = ctx.getError();
  const after = Array.from(ctx.readPixels(0, 0, 64, 64));
  let unchanged = before.length === after.length;
  if (unchanged) for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { unchanged = false; break; }
  ctx.restoreContext();
  ctx.drawArrays(0x0004, 0, 3);
  const afterRestore = ctx.getError();
  return { codes: [c0, c1, c2, c3, c4], unchanged, afterRestore, drained: ctx.getError() };
})()`;

/** T9: negative instanceCount pushes one INVALID_VALUE, no pixels. */
const T9_SCRIPT = `(() => {
  ${PROG_SETUP}
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  setupInstanced(ctx);
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  const before = Array.from(ctx.readPixels(0, 0, 64, 64));
  ctx.drawArraysInstanced(0x0004, 0, 3, -1);
  const err = ctx.getError();
  const drained = ctx.getError();
  const after = Array.from(ctx.readPixels(0, 0, 64, 64));
  let unchanged = before.length === after.length;
  if (unchanged) for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { unchanged = false; break; }
  return { err, drained, unchanged };
})()`;

/** T10: out-of-range drawBuffers entry pushes one INVALID_OPERATION. */
const T10_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.drawBuffers([0x8ce0, 0x8ce0 + 1]);
  while (ctx.getError() !== 0) {}
  ctx.drawBuffers([0x8ce0 + 4]);
  const err = ctx.getError();
  return { err, drained: ctx.getError() };
})()`;

describe("webgl2 conformance (10 cases)", () => {
  it("T1 two instances with divisor 1 paint distinct positions", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: draw 2 instances with per-instance offset.
    const r = await page.evaluate<DiffResult>(T1_SCRIPT);
    // Assert: both halves carry instance pixels, no error.
    expect(r.left).toBeGreaterThan(0);
    expect(r.right).toBeGreaterThan(0);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });

  it("T2 divisor 0 diverges observably from divisor 1", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: render the same draw under both divisors.
    const r = await page.evaluate<DivResult>(T2_SCRIPT);
    // Assert: geometries differ.
    expect(r.diff).toBeGreaterThan(0);
    await page.close();
  });

  it("T3 VAO rebinding restores original geometry", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: draw under A, detour through B, redraw under A.
    const r = await page.evaluate<VaoResult>(T3_SCRIPT);
    // Assert: byte-identical frames, no error.
    expect(r.same).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });

  it("T4 clear honors the active draw-buffer configuration", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: clear under single-nonzero and empty configs, then dual-output draw.
    const r = await page.evaluate<AttachResult>(T4_SCRIPT);
    // Assert: attachment 0 untouched in both clear cases, queue clean.
    expect(r.single).toEqual([0, 0, 0, 0]);
    expect(r.empty).toEqual([0, 0, 0, 0]);
    // Assert: dual-output draw lands distinct colors per plane.
    expect(r.plane0).toEqual([255, 0, 0, 255]);
    expect(r.plane1).toEqual([0, 255, 255, 255]);
    expect(r.plane0).not.toEqual(r.plane1);
    expect(r.err).toBe(G.NO_ERROR);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });

  it("T5 float texture uploads stay error-free", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: upload RGBA32F out-of-range floats and R32F texels.
    const r = await page.evaluate<FloatResult>(T5_SCRIPT);
    // Assert: both uploads accepted, queue clean.
    expect(r.rgbaOk).toBe(true);
    expect(r.rOk).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });

  it("T6 DEPTH24_STENCIL8 renderbuffer honors LESS writes", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: allocate storage, write nearer then farther depth.
    const r = await page.evaluate<DepthResult>(T6_SCRIPT);
    // Assert: nearer wins, farther rejected, no error.
    expect(r.err).toBe(G.NO_ERROR);
    expect(r.stored).toBeCloseTo(0.3, 5);
    expect(r.rejectedKept).toBe(true);
    await page.close();
  });

  it("T7 extension list is exactly three names", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: list names, probe an unknown name.
    const r = await page.evaluate<ExtResult>(T7_SCRIPT);
    // Assert: exact list, null without error.
    expect(r.names).toEqual(["WEBGL_draw_buffers", "OES_texture_float", "WEBGL_lose_context"]);
    expect(r.unknownIsNull).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });

  it("T8 lost context makes draws no-op until restore", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: lose, draw/clear five ways, snapshot, restore.
    const r = await page.evaluate<LostResult>(T8_SCRIPT);
    // Assert: five CONTEXT_LOST codes, bytes unchanged, restore resumes.
    expect(r.codes).toEqual([
      G.CONTEXT_LOST_WEBGL,
      G.CONTEXT_LOST_WEBGL,
      G.CONTEXT_LOST_WEBGL,
      G.CONTEXT_LOST_WEBGL,
      G.CONTEXT_LOST_WEBGL,
    ]);
    expect(r.unchanged).toBe(true);
    expect(r.afterRestore).not.toBe(G.CONTEXT_LOST_WEBGL);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });

  it("T9 negative instance count yields one INVALID_VALUE", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: instanced draw with count -1.
    const r = await page.evaluate<NegResult>(T9_SCRIPT);
    // Assert: single code, queue drains, no pixels.
    expect(r.err).toBe(G.INVALID_VALUE);
    expect(r.drained).toBe(G.NO_ERROR);
    expect(r.unchanged).toBe(true);
    await page.close();
  });

  it("T10 out-of-range drawBuffers yields one INVALID_OPERATION", async () => {
    // Arrange: fresh page.
    const page = await freshPage();
    // Act: name attachment beyond the 4-target limit.
    const r = await page.evaluate<DbResult>(T10_SCRIPT);
    // Assert: single code, queue drains.
    expect(r.err).toBe(G.INVALID_OPERATION);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });
});
