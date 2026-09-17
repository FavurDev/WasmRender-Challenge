/** Build-time only: esbuild IIFE bundle + SOW-REQ-013 gates. Never imported by runtime code. */
// CHANGELOG:
// - Sprint 1: Created esbuild IIFE bundle script with 800 KB and no-require gates.
// - Sprint 6: Added metafile purity gate (no node_modules inputs) and global-install gate.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, statSync } from "node:fs";

const ENTRY = "src/renderer/context.ts";
const OUT = "renderer.js";
const META = "renderer.meta.json";
const CAP = 819200; // 800 KB
const FOOTER = "window.__createSoftwareWebGLContext=__swgl.createSoftwareWebGLContext;";

execFileSync(
  "npx",
  [
    "--yes",
    "esbuild@0.21.5",
    ENTRY,
    "--bundle",
    "--format=iife",
    "--platform=browser",
    "--target=es2022",
    "--global-name=__swgl",
    `--footer:js=${FOOTER}`,
    `--outfile=${OUT}`,
    `--metafile=${META}`,
    "--log-level=error",
  ],
  { stdio: "inherit", shell: true },
);

function fail(msg: string): never {
  try {
    rmSync(OUT, { force: true });
  } catch {
    // ignore removal errors
  }
  try {
    rmSync(META, { force: true });
  } catch {
    // ignore removal errors
  }
  console.error(msg);
  process.exit(1);
}

// Gate 1: metafile purity — no node_modules inputs.
let metaRaw: string;
try {
  metaRaw = readFileSync(META, "utf8");
} catch {
  fail("build gate: metafile renderer.meta.json missing");
  throw new Error("unreachable");
}
const meta = JSON.parse(metaRaw) as { inputs: Record<string, unknown> };
const inputs = Object.keys(meta.inputs);
const bad = inputs.filter((p) => p.includes("node_modules"));
if (bad.length > 0) fail(`build gate: metafile lists node_modules inputs: ${bad.join(", ")}`);

// Gate 2: size cap.
const size = statSync(OUT).size;
if (size > CAP) fail(`build gate: ${OUT} is ${size} bytes, exceeds ${CAP} bytes (800 KB)`);

// Gate 3: no require( token.
const text = readFileSync(OUT, "utf8");
if (text.includes("require(")) fail("build gate: renderer.js contains require(");

// Gate 4: footer publishes the factory as a callable global when injected.
if (!text.includes(FOOTER)) {
  fail("build gate: renderer.js missing footer installing window.__createSoftwareWebGLContext");
}
if (!text.includes("__swgl")) {
  fail("build gate: renderer.js missing __swgl global");
}

console.log(`build ok: ${OUT} ${size} bytes, ${inputs.length} inputs, no node_modules, no require(, global installed`);
