/** Build-time only: esbuild IIFE bundle + SOW-REQ-013 gates. Never imported by runtime code. */
// CHANGELOG:
// - Sprint 1: Created esbuild IIFE bundle script with 800 KB and no-require gates.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, statSync } from "node:fs";

const ENTRY = "src/renderer/context.ts";
const OUT = "renderer.js";
const CAP = 819200; // 800 KB

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
    "--footer:js=window.__createSoftwareWebGLContext=__swgl.createSoftwareWebGLContext;",
    `--outfile=${OUT}`,
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
  console.error(msg);
  process.exit(1);
}

const size = statSync(OUT).size;
if (size > CAP) fail(`build gate: ${OUT} is ${size} bytes, exceeds ${CAP} bytes (800 KB)`);
const text = readFileSync(OUT, "utf8");
if (text.includes("require(")) fail("build gate: renderer.js contains require(");
console.log(`build ok: ${OUT} ${size} bytes, no require(`);
