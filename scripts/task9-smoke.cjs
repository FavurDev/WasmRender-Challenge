// Sprint 6 Task 9 smoke test (Node, CJS): loads the renderer.js bundle,
// asserts the context factory, VERSION string, and texture API round-trip.
//
// Artifact path resolution (Sprint 7 Task 10, TD-014):
//   RENDERER_ARTIFACT env var overrides; default follows build-renderer.mjs
//   win32 mapping (C:/app/renderer.js on win32, /app/renderer.js elsewhere).
const fs = require("node:fs");
const vm = require("node:vm");

const DEFAULT_BUNDLE = process.platform === "win32" ? "C:/app/renderer.js" : "/app/renderer.js";
const BUNDLE = process.env.RENDERER_ARTIFACT || DEFAULT_BUNDLE;

function fail(msg) {
  console.error(`SMOKE_FAILED: ${msg}`);
  process.exit(1);
}

const src = fs.readFileSync(BUNDLE, "utf8");
vm.runInThisContext(src, { filename: BUNDLE });

const factory = globalThis.__createSoftwareWebGLContext;
if (typeof factory !== "function") fail("factory missing");

const gl = factory({ width: 64, height: 64 });
if (!gl) fail("context creation returned null");

const VERSION = 0x1f02;
const version = gl.getParameter(VERSION);
if (version !== "WebGL 1.0 (Software)") fail(`VERSION mismatch: ${version}`);

for (const m of ["createTexture", "bindTexture", "texImage2D", "generateMipmap"]) {
  if (typeof gl[m] !== "function") fail(`missing ${m}`);
}

const TEXTURE_2D = 0x0de1, RGBA = 0x1908, UNSIGNED_BYTE = 0x1401;
const tex = gl.createTexture();
gl.bindTexture(TEXTURE_2D, tex);
gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE,
  new Uint8Array([255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,255,255]));
gl.generateMipmap(TEXTURE_2D);
if (gl.getError() !== 0) fail("texture round-trip error");

console.log("SMOKE_OK: bundle loads, WebGL 1.0 (Software) context, texture round-trip clean");
