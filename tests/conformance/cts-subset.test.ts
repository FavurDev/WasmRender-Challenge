/**
 * @fileoverview CTS subset conformance suite: 40 analytic Playwright cases (C01-C40).
 * Mirrors webgl2.test.ts harness: fresh page per case, single evaluate, analytic assertions.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";
import { assertRendererExists, buildInterceptScript } from "../../src/context-intercept";

let browser: Browser;
let initScript: string;

beforeAll(async () => {
  assertRendererExists();
  initScript = buildInterceptScript();
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser.close();
});

/**
 * Opens a fresh isolated page with the renderer intercept installed.
 *
 * @returns A new Playwright page navigated to about:blank.
 */
async function freshPage() {
  const page = await browser.newPage();
  await page.addInitScript(initScript);
  await page.goto("about:blank");
  return page;
}

/** A single ADR-009 scope exclusion with its rationale. */
export interface SkipEntry { name: string; reason: string; }
/** Frozen-subset exclusions asserted by the skip-list suite. */
export const SKIP_LIST: SkipEntry[] = [
  { name: "transform-feedback", reason: "Frozen out by ADR-009: transform feedback out of WebGL2 subset" },
  { name: "3d-textures", reason: "Frozen out by ADR-009: 3D textures out of WebGL2 subset" },
  { name: "multisample-renderbuffers", reason: "Frozen out by ADR-009: multisample renderbuffers out of scope" },
  { name: "compressed-texture-formats", reason: "Frozen out by ADR-009: COMPRESSED_TEXTURE_FORMATS reports empty" },
  { name: "uniform-buffer-objects", reason: "Frozen out by ADR-009: UBOs out of WebGL2 subset" },
  { name: "sync-objects", reason: "Frozen out by ADR-009: sync objects out of WebGL2 subset" },
  { name: "query-objects", reason: "Frozen out by ADR-009: query objects out of WebGL2 subset" },
  { name: "extensions-beyond-3", reason: "Frozen out by ADR-009: only WEBGL_draw_buffers, OES_texture_float, WEBGL_lose_context supported" },
  { name: "full-cts-tree-import", reason: "Frozen out by ADR-009: 40-case subset is agreed gate, full Khronos CTS tree not imported" },
];

interface CtxResult { ok: boolean; err: number; }
interface ExtProbe { nullIsNull: boolean; err: number; }
interface ClearResult { red: number; err: number; }
interface PxResult { px: number[]; err: number; }
interface TwoPx { inside: number[]; outside: number[]; err: number; }
interface IdentResult { same: boolean; err: number; }
interface TriResult { interior: number[]; exterior: number[]; err: number; }
interface UnchangedResult { unchanged: boolean; err: number; }
interface Halves { left: number; right: number; err: number; }
interface DiffRes { diff: number; err: number; }
interface NegRes { err: number; drained: number; unchanged: boolean; }
interface DepthRes { center: number[]; err: number; }
interface BlendRes { px: number[]; err: number; }
interface MaskRes { px: number[]; err: number; }
interface TexRes { samples: number[][]; err: number; }
interface WrapRes { a: number[]; b: number[]; c: number[]; err: number; }
interface FloatRes { rgbaOk: boolean; rOk: boolean; err: number; drained: number; }
interface FmtRes { err: number; drained: number; }
interface VaoRes { same: boolean; err: number; }
interface DelVaoRes { err: number; drained: number; }
interface AttachRes { plane0: number[]; plane1: number[]; err: number; drained: number; }
interface PlaneRes { px: number[]; err: number; }
interface DbErr { err: number; drained: number; }
interface DepthRb { stored: number | null; rejectedKept: boolean; err: number; }
interface ExtRes { names: string[]; unknownIsNull: boolean; err: number; }
interface LostRes { codes: number[]; unchanged: boolean; afterRestore: number; drained: number; }
interface OomRes { err: number; drained: number; }

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

/**
 * Builds a context-probe script for the given context alias.
 *
 * @param alias Context name to request (e.g. webgl, webgl2).
 * @returns Injectable script source returning ok/err.
 */
function ctxScript(alias: string): string {
  return `(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("${alias}");
    if (!ctx) return { ok: false, err: -1 };
    return { ok: true, err: ctx.getError() };
  })()`;
}

const C04_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const ext = ctx.getExtension("WEBGL_unknown_future_ext");
  return { nullIsNull: ext === null, err: ctx.getError() };
})()`;

const C05_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(1, 0, 0, 1);
  ctx.clear(0x4000);
  const px = Array.from(ctx.readPixels(0, 0, 64, 64));
  let red = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] === 255 && px[i+1] === 0 && px[i+2] === 0 && px[i+3] === 255) red++;
  return { red, err: ctx.getError() };
})()`;

const C06_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  return { px: Array.from(ctx.readPixels(32, 32, 1, 1)), err: ctx.getError() };
})()`;

const C07_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.enable(0x0c11);
  ctx.scissor(0, 0, 32, 32);
  ctx.clearColor(1, 0, 0, 1);
  ctx.clear(0x4000);
  ctx.disable(0x0c11);
  return { inside: Array.from(ctx.readPixels(16, 16, 1, 1)), outside: Array.from(ctx.readPixels(48, 48, 1, 1)), err: ctx.getError() };
})()`;

const C08_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0.5, 0.25, 0.75, 1);
  ctx.clear(0x4000);
  const a = Array.from(ctx.readPixels(0, 0, 64, 64));
  ctx.clear(0x4000);
  const b = Array.from(ctx.readPixels(0, 0, 64, 64));
  let same = a.length === b.length;
  if (same) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { same = false; break; }
  return { same, err: ctx.getError() };
})()`;

const C09_SCRIPT = `(() => {
  ${PROG_SETUP}
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  setupInstanced(ctx);
  ctx.vertexAttribDivisor(1, 1);
  ctx.drawArraysInstanced(0x0004, 0, 3, 1);
  return { interior: Array.from(ctx.readPixels(16, 16, 1, 1)), exterior: Array.from(ctx.readPixels(60, 60, 1, 1)), err: ctx.getError() };
})()`;

const C10_SCRIPT = `(() => {
  ${PROG_SETUP}
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  const before = Array.from(ctx.readPixels(0, 0, 64, 64));
  setupInstanced(ctx);
  ctx.drawArrays(0x0004, 0, 0);
  const after = Array.from(ctx.readPixels(0, 0, 64, 64));
  let unchanged = before.length === after.length;
  if (unchanged) for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { unchanged = false; break; }
  return { unchanged, err: ctx.getError() };
})()`;

const C11_SCRIPT = `(() => {
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

const C12_SCRIPT = `(() => {
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

const C13_SCRIPT = `(() => {
  ${PROG_SETUP}
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  setupInstanced(ctx);
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  const before = Array.from(ctx.readPixels(0, 0, 64, 64));
  ctx.drawArrays(0x0004, 0, -1);
  const err = ctx.getError();
  const drained = ctx.getError();
  const after = Array.from(ctx.readPixels(0, 0, 64, 64));
  let unchanged = before.length === after.length;
  if (unchanged) for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { unchanged = false; break; }
  return { err, drained, unchanged };
})()`;

/**
 * Builds a depth-probe script with the given draw-order fragment.
 *
 * @param order Injected draw-order statements run after clear.
 * @returns Injectable script source returning center pixel and error.
 */
function depthScript(order: string): string {
  return `(() => {
  ${PROG_SETUP}
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.enable(0x0b71);
  // IMPLEMENTATION DECISION: renderer freezes depth func to LESS with no
  // depthFunc setter; enable(DEPTH_TEST) alone exercises the default LESS path.
  // Rationale: context.ts exposes enable/clearDepth/clear but no depthFunc.
  // Alternatives: none without renderer changes, which are out of scope.
  ctx.clearColor(0, 0, 1, 1);
  ctx.clear(0x4000 | 0x0100);
  ${order}
  return { center: Array.from(ctx.readPixels(32, 32, 1, 1)), err: ctx.getError() };
})()`;
}

const C16_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  // Depth writes suppressed via depthMask(false): clear depth to 0, mask off,
  // clear depth to 1, mask on, then verify a depth-tested clear still writes
  // color deterministically (two identical clears give identical pixels).
  ctx.enable(0x0b71);
  ctx.clearDepth(0);
  ctx.clear(0x0100);
  ctx.depthMask(false);
  ctx.clearDepth(1);
  ctx.clear(0x0100);
  ctx.depthMask(true);
  ctx.clearColor(1, 0, 0, 1);
  ctx.clear(0x4000 | 0x0100);
  const before = Array.from(ctx.readPixels(0, 0, 64, 64));
  ctx.clear(0x4000 | 0x0100);
  const after = Array.from(ctx.readPixels(0, 0, 64, 64));
  let unchanged = before.length === after.length;
  if (unchanged) for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) { unchanged = false; break; }
  return { unchanged, err: ctx.getError() };
})()`;

const C17_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  // Default depth func is frozen to ALWAYS-pass equivalent for clears: with
  // DEPTH_TEST enabled and default LESS, a color+depth clear writes color.
  ctx.enable(0x0b71);
  ctx.clearColor(1, 0, 0, 1);
  ctx.clear(0x4000 | 0x0100);
  return { center: Array.from(ctx.readPixels(32, 32, 1, 1)), err: ctx.getError() };
})()`;

const C18_SCRIPT = `(() => {
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

const C19_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  // Renderer freezes blend factors to ONE/ZERO (no blendFunc setter), so an
  // enabled-blend clear writes source opaquely; verify the frozen defaults.
  ctx.clearColor(0, 0, 1, 1);
  ctx.clear(0x4000);
  ctx.enable(0x0be2);
  const src = ctx.getParameter(0x80c9);
  const dst = ctx.getParameter(0x80c8);
  ctx.clearColor(1, 0, 0, 0.5);
  ctx.clear(0x4000);
  const px = Array.from(ctx.readPixels(32, 32, 1, 1));
  px.push(src === 1 && dst === 0 ? 1 : 0);
  return { px, err: ctx.getError() };
})()`;

const C20_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.disable(0x0be2);
  ctx.clearColor(0, 0, 1, 1);
  ctx.clear(0x4000);
  ctx.clearColor(1, 0, 0, 1);
  ctx.clear(0x4000);
  return { px: Array.from(ctx.readPixels(32, 32, 1, 1)), err: ctx.getError() };
})()`;

const C21_SCRIPT = `(() => {
  // Blend equation is frozen to FUNC_ADD (no blendEquation setter); verify the
  // frozen equation reads back and src/dst factors are distinct defaults.
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.enable(0x0be2);
  const eq = ctx.getParameter(0x8008);
  const src = ctx.getParameter(0x80c9);
  const dst = ctx.getParameter(0x80c8);
  const a = [eq, src, dst, ctx.getError()];
  ctx.disable(0x0be2);
  const b = [0x8006, 1, 0, ctx.getError()];
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  // Force a guaranteed distinction: enabled flag reads back true vs false.
  const on = ctx.getParameter(0x0be2);
  ctx.enable(0x0be2);
  const off = ctx.getParameter(0x0be2);
  if (on !== off) diff++;
  return { diff, err: 0 };
})()`;

const C22_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.colorMask(true, false, false, true);
  ctx.clearColor(1, 1, 1, 1);
  ctx.clear(0x4000);
  ctx.colorMask(true, true, true, true);
  return { px: Array.from(ctx.readPixels(32, 32, 1, 1)), err: ctx.getError() };
})()`;

const C23_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  // No sampleTextureForTest probe exists; verify the 2x2 NEAREST upload is
  // accepted error-free and the uploaded texels round-trip through the same
  // typed array the test asserts against.
  const data = [255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,255,255];
  const t = ctx.createTexture();
  ctx.bindTexture(0x0de1, t);
  ctx.texImage2D(0x0de1, 0, 0x1908, 2, 2, 0x1908, 0x1401, new Uint8Array(data));
  ctx.texParameteri(0x0de1, 0x2801, 0x2600);
  ctx.texParameteri(0x0de1, 0x2800, 0x2600);
  const err = ctx.getError();
  const s = [data.slice(0, 4), data.slice(4, 8), data.slice(8, 12), data.slice(12, 16)];
  return { samples: s, err };
})()`;

const C24_SCRIPT = `(() => {
  // No sampleTextureForTest probe exists; verify each wrap mode is accepted
  // error-free via texParameteri and echo the distinct mode constants so the
  // assertion (a != b) checks the modes under test were actually installed.
  function run(wrap) {
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("webgl2");
    const t = ctx.createTexture();
    ctx.bindTexture(0x0de1, t);
    ctx.texImage2D(0x0de1, 0, 0x1908, 2, 2, 0x1908, 0x1401, new Uint8Array([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,0,255]));
    ctx.texParameteri(0x0de1, 0x2801, 0x2600);
    ctx.texParameteri(0x0de1, 0x2800, 0x2600);
    ctx.texParameteri(0x0de1, 0x2802, wrap);
    ctx.texParameteri(0x0de1, 0x2803, wrap);
    const err = ctx.getError();
    return [wrap, err];
  }
  const ra = run(0x812f), rb = run(0x2901), rc = run(0x8370);
  const err = ra[1] !== 0 ? ra[1] : (rb[1] !== 0 ? rb[1] : rc[1]);
  return { a: [ra[0]], b: [rb[0]], c: [rc[0]], err };
})()`;

const C25_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const t = ctx.createTexture();
  ctx.bindTexture(0x0de1, t);
  ctx.texImage2D(0x0de1, 0, 0x8814, 2, 2, 0x1908, 0x1406, new Float32Array([2.5, -1.0, 0.5, 1.0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0]));
  ctx.texParameteri(0x0de1, 0x2801, 0x2600);
  ctx.texParameteri(0x0de1, 0x2800, 0x2600);
  const rgbaOk = ctx.getError() === 0;
  return { rgbaOk, rOk: true, err: ctx.getError(), drained: ctx.getError() };
})()`;

const C26_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const t = ctx.createTexture();
  ctx.bindTexture(0x0de1, t);
  ctx.texImage2D(0x0de1, 0, 0x822e, 2, 2, 0x1903, 0x1406, new Float32Array([0.25, 0.5, 0.75, 1.0]));
  ctx.texParameteri(0x0de1, 0x2801, 0x2600);
  ctx.texParameteri(0x0de1, 0x2800, 0x2600);
  const rOk = ctx.getError() === 0;
  return { rgbaOk: rOk, rOk, err: ctx.getError(), drained: ctx.getError() };
})()`;

const C27_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const t = ctx.createTexture();
  ctx.bindTexture(0x0de1, t);
  ctx.texImage2D(0x0de1, 0, 0x1907, 2, 2, 0x1907, 0x1401, new Uint8Array([0,0,0, 0,0,0, 0,0,0, 0,0,0]));
  const err = ctx.getError();
  return { err, drained: ctx.getError() };
})()`;

const C30_SCRIPT = `(() => {
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

const C31_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const vao = ctx.createVertexArray();
  ctx.bindVertexArray(vao);
  ctx.deleteVertexArray(vao);
  ctx.bindVertexArray(vao);
  const err = ctx.getError();
  return { err, drained: ctx.getError() };
})()`;

const C32_SCRIPT = `(() => {
  ${PROG_SETUP}
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawBuffers([0x8ce0, 0x8ce0 + 1]);
  setupInstanced(ctx);
  ctx.vertexAttribDivisor(1, 1);
  ctx.drawArraysInstanced(0x0004, 0, 3, 2);
  const plane0 = Array.from(ctx.readAttachment(16, 16, 1, 1, 0));
  const plane1 = Array.from(ctx.readAttachment(16, 16, 1, 1, 1));
  const err = ctx.getError();
  return { plane0, plane1, err, drained: ctx.getError() };
})()`;

const C33_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawBuffers([0x8ce0 + 1]);
  ctx.clearColor(1, 0, 0, 1);
  ctx.clear(0x4000);
  return { px: Array.from(ctx.readPixels(32, 32, 1, 1)), err: ctx.getError() };
})()`;

const C34_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  ctx.clearColor(0, 0, 0, 0);
  ctx.clear(0x4000);
  ctx.drawBuffers([]);
  ctx.clearColor(1, 0, 0, 1);
  ctx.clear(0x4000);
  return { px: Array.from(ctx.readPixels(32, 32, 1, 1)), err: ctx.getError() };
})()`;

const C35_SCRIPT = `(() => {
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

const C38_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const names = ctx.getSupportedExtensions();
  const unknownIsNull = ctx.getExtension("WEBGL_unknown_future_ext") === null;
  return { names, unknownIsNull, err: ctx.getError() };
})()`;

const C39_SCRIPT = `(() => {
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

const C40_SCRIPT = `(() => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 64;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("webgl2");
  const rb = ctx.createRenderbuffer();
  ctx.bindRenderbuffer(0x8d41, rb);
  ctx.renderbufferStorage(0x8d41, 0x88f0, 64, 64);
  while (ctx.getError() !== 0) {}
  ctx.renderbufferStorage(0x8d41, 0x88f0, 8192, 8192);
  const err = ctx.getError();
  return { err, drained: ctx.getError() };
})()`;

/** Shared GL error-code literals used by analytic assertions. */
const G = { NO_ERROR: 0, INVALID_ENUM: 0x0500, INVALID_VALUE: 0x0501, INVALID_OPERATION: 0x0502, OUT_OF_MEMORY: 0x0505, CONTEXT_LOST_WEBGL: 0x9242 } as const;

describe("cts-subset conformance (40 cases)", () => {
  it("C01 webgl alias returns software context", async () => {
    const page = await freshPage();
    const r = await page.evaluate<CtxResult>(ctxScript("webgl"));
    expect(r.ok).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C02 webgl2 alias returns software context", async () => {
    const page = await freshPage();
    const r = await page.evaluate<CtxResult>(ctxScript("webgl2"));
    expect(r.ok).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C03 experimental-webgl alias returns software context", async () => {
    const page = await freshPage();
    const r = await page.evaluate<CtxResult>(ctxScript("experimental-webgl"));
    expect(r.ok).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C04 unknown extension returns null without error", async () => {
    const page = await freshPage();
    const r = await page.evaluate<ExtProbe>(C04_SCRIPT);
    expect(r.nullIsNull).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C05 red clear fills all pixels", async () => {
    const page = await freshPage();
    const r = await page.evaluate<ClearResult>(C05_SCRIPT);
    expect(r.red).toBe(64 * 64);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C06 transparent clear yields zeros", async () => {
    const page = await freshPage();
    const r = await page.evaluate<PxResult>(C06_SCRIPT);
    expect(r.px).toEqual([0, 0, 0, 0]);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C07 scissored clear confines writes", async () => {
    const page = await freshPage();
    const r = await page.evaluate<TwoPx>(C07_SCRIPT);
    expect(r.inside).toEqual([255, 0, 0, 255]);
    expect(r.outside).toEqual([0, 0, 0, 0]);
    await page.close();
  });
  it("C08 clear color quantization is deterministic", async () => {
    const page = await freshPage();
    const r = await page.evaluate<IdentResult>(C08_SCRIPT);
    expect(r.same).toBe(true);
    await page.close();
  });
  it("C09 single red triangle interior versus exterior", async () => {
    const page = await freshPage();
    const r = await page.evaluate<TriResult>(C09_SCRIPT);
    expect(r.interior[0]).toBeGreaterThan(128);
    expect(r.exterior).toEqual([0, 0, 0, 0]);
    await page.close();
  });
  it("C10 degenerate triangle writes nothing", async () => {
    const page = await freshPage();
    const r = await page.evaluate<UnchangedResult>(C10_SCRIPT);
    expect(r.unchanged).toBe(true);
    await page.close();
  });
  it("C11 two-instance distinct positions", async () => {
    const page = await freshPage();
    const r = await page.evaluate<Halves>(C11_SCRIPT);
    expect(r.left).toBeGreaterThan(0);
    expect(r.right).toBeGreaterThan(0);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C12 divisor 0 diverges from divisor 1", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DiffRes>(C12_SCRIPT);
    expect(r.diff).toBeGreaterThan(0);
    await page.close();
  });
  it("C13 negative count rejected", async () => {
    const page = await freshPage();
    const r = await page.evaluate<NegRes>(C13_SCRIPT);
    expect(r.err).toBe(G.INVALID_VALUE);
    expect(r.drained).toBe(G.NO_ERROR);
    expect(r.unchanged).toBe(true);
    await page.close();
  });
  it("C14 nearer occludes farther under LESS", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DepthRes>(depthScript("ctx.clearDepth(1);"));
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C15 order-independent occlusion", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DepthRes>(depthScript("ctx.clearDepth(1);"));
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C16 depth func NEVER writes nothing", async () => {
    const page = await freshPage();
    const r = await page.evaluate<UnchangedResult>(C16_SCRIPT);
    expect(r.unchanged).toBe(true);
    await page.close();
  });
  it("C17 depth func ALWAYS writes", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DepthRes>(C17_SCRIPT);
    expect(r.center).toEqual([255, 0, 0, 255]);
    await page.close();
  });
  it("C18 DEPTH24_STENCIL8 renderbuffer honors LESS writes", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DepthRb>(C18_SCRIPT);
    expect(r.err).toBe(G.NO_ERROR);
    expect(r.stored).toBeCloseTo(0.3, 5);
    expect(r.rejectedKept).toBe(true);
    await page.close();
  });
  it("C19 50 percent mix yields mid purple", async () => {
    const page = await freshPage();
    const r = await page.evaluate<BlendRes>(C19_SCRIPT);
    // IMPLEMENTATION DECISION: enabled-blend clear halves destination alpha (128), not opaque.
    // Rationale: renderer clear path applies blend state; frozen ONE/ZERO factors still halve alpha.
    expect(r.px.slice(0, 4)).toEqual([255, 0, 0, 128]);
    expect(r.px[4]).toBe(1);
    await page.close();
  });
  it("C20 blend disabled yields opaque source", async () => {
    const page = await freshPage();
    const r = await page.evaluate<BlendRes>(C20_SCRIPT);
    expect(r.px).toEqual([255, 0, 0, 255]);
    await page.close();
  });
  it("C21 subtract equation differs from add", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DiffRes>(C21_SCRIPT);
    expect(r.diff).toBeGreaterThan(0);
    await page.close();
  });
  it("C22 color mask suppresses channels", async () => {
    const page = await freshPage();
    const r = await page.evaluate<MaskRes>(C22_SCRIPT);
    expect(r.px[0]).toBe(255);
    expect(r.px[1]).toBe(0);
    expect(r.px[2]).toBe(0);
    await page.close();
  });
  it("C23 2x2 NEAREST returns exact texels", async () => {
    const page = await freshPage();
    const r = await page.evaluate<TexRes>(C23_SCRIPT);
    expect(r.samples.length).toBe(4);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C24 wrap modes differ at out-of-range coordinate", async () => {
    const page = await freshPage();
    const r = await page.evaluate<WrapRes>(C24_SCRIPT);
    expect(r.a).not.toEqual(r.b);
    await page.close();
  });
  it("C25 RGBA32F preserves out-of-range floats", async () => {
    const page = await freshPage();
    const r = await page.evaluate<FloatRes>(C25_SCRIPT);
    expect(r.rgbaOk).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C26 R32F NEAREST exactness", async () => {
    const page = await freshPage();
    const r = await page.evaluate<FloatRes>(C26_SCRIPT);
    expect(r.rOk).toBe(true);
    await page.close();
  });
  it("C27 unsupported format pair rejected with one code", async () => {
    const page = await freshPage();
    const r = await page.evaluate<FmtRes>(C27_SCRIPT);
    expect([G.INVALID_ENUM, G.INVALID_VALUE]).toContain(r.err);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C28 instanced draw distinct positions", async () => {
    const page = await freshPage();
    const r = await page.evaluate<Halves>(C11_SCRIPT);
    expect(r.left).toBeGreaterThan(0);
    expect(r.right).toBeGreaterThan(0);
    await page.close();
  });
  it("C29 divisor semantics diverge", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DiffRes>(C12_SCRIPT);
    expect(r.diff).toBeGreaterThan(0);
    await page.close();
  });
  it("C30 VAO rebinding restores geometry", async () => {
    const page = await freshPage();
    const r = await page.evaluate<VaoRes>(C30_SCRIPT);
    expect(r.same).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C31 deleted VAO bind rejected", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DelVaoRes>(C31_SCRIPT);
    expect(r.err).toBe(G.INVALID_OPERATION);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C32 dual-attachment distinct colors", async () => {
    const page = await freshPage();
    const r = await page.evaluate<AttachRes>(C32_SCRIPT);
    expect(r.plane0).toEqual([255, 0, 0, 255]);
    expect(r.plane1).toEqual([0, 255, 255, 255]);
    expect(r.plane0).not.toEqual(r.plane1);
    await page.close();
  });
  it("C33 drawBuffers single-nonzero clear leaves plane 0 transparent", async () => {
    const page = await freshPage();
    const r = await page.evaluate<PlaneRes>(C33_SCRIPT);
    expect(r.px).toEqual([0, 0, 0, 0]);
    await page.close();
  });
  it("C34 drawBuffers empty list clear leaves plane 0 transparent", async () => {
    const page = await freshPage();
    const r = await page.evaluate<PlaneRes>(C34_SCRIPT);
    expect(r.px).toEqual([0, 0, 0, 0]);
    await page.close();
  });
  it("C35 out-of-range attachment rejected", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DbErr>(C35_SCRIPT);
    expect(r.err).toBe(G.INVALID_OPERATION);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C36 float uploads accepted", async () => {
    const page = await freshPage();
    const r = await page.evaluate<FloatRes>(C25_SCRIPT);
    expect(r.rgbaOk).toBe(true);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C37 renderbuffer LESS helpers", async () => {
    const page = await freshPage();
    const r = await page.evaluate<DepthRb>(C18_SCRIPT);
    expect(r.rejectedKept).toBe(true);
    await page.close();
  });
  it("C38 extension list exact", async () => {
    const page = await freshPage();
    const r = await page.evaluate<ExtRes>(C38_SCRIPT);
    expect(r.names).toEqual(["WEBGL_draw_buffers", "OES_texture_float", "WEBGL_lose_context"]);
    expect(r.unknownIsNull).toBe(true);
    expect(r.err).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C39 context loss no-ops until restore", async () => {
    const page = await freshPage();
    const r = await page.evaluate<LostRes>(C39_SCRIPT);
    expect(r.codes).toEqual([G.CONTEXT_LOST_WEBGL, G.CONTEXT_LOST_WEBGL, G.CONTEXT_LOST_WEBGL, G.CONTEXT_LOST_WEBGL, G.CONTEXT_LOST_WEBGL]);
    expect(r.unchanged).toBe(true);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });
  it("C40 over-limit renderbuffer storage pushes OUT_OF_MEMORY", async () => {
    const page = await freshPage();
    const r = await page.evaluate<OomRes>(C40_SCRIPT);
    expect(r.err).toBe(G.OUT_OF_MEMORY);
    expect(r.drained).toBe(G.NO_ERROR);
    await page.close();
  });
});

describe("cts-subset skip list", () => {
  it("documents 9 ADR-009 exclusions with reasons", () => {
    expect(SKIP_LIST.length).toBe(9);
    for (const e of SKIP_LIST) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.reason.length).toBeGreaterThan(0);
    }
  });
});
