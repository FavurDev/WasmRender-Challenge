// Build pipeline for the software WebGL renderer (Sprint 1 Task 5).
// Bundles src/entry.ts -> /app/renderer.js as a single IIFE via esbuild.
// While src/entry.ts is absent (Sprint 1), skips loudly with exit 0.
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_BUNDLE_BYTES = 2097152;
export const ENTRY_FILE = fileURLToPath(new URL("../src/entry.ts", import.meta.url));
export const OUT_FILE = "/app/renderer.js";

export function assertBundleSize(text) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > MAX_BUNDLE_BYTES) {
    throw new Error(`BUNDLE_TOO_LARGE: ${bytes} bytes exceeds ${MAX_BUNDLE_BYTES} byte ceiling`);
  }
}

export function assertSingleIife(text) {
  const t = text.trim();
  const ok =
    t.startsWith("(()=>") ||
    t.startsWith("(function") ||
    t.startsWith("var ");
  if (!ok) {
    throw new Error("NOT_SINGLE_IIFE: artifact does not start with an IIFE wrapper");
  }
}

export function assertNoModuleSyntax(text) {
  if (/^\s*import\b/m.test(text) || /\bimport\s*\(/.test(text) || /^\s*export\b/m.test(text)) {
    throw new Error("MODULE_SYNTAX_LEAK: artifact contains import/export syntax");
  }
  if (/\brequire\s*\(/.test(text)) {
    throw new Error("MODULE_SYNTAX_LEAK: artifact contains require() call");
  }
}

export function assertNoNetwork(text) {
  if (/\bfetch\s*\(/.test(text)) {
    throw new Error("NETWORK_LEAK: artifact contains fetch() call");
  }
  if (/XMLHttpRequest/.test(text)) {
    throw new Error("NETWORK_LEAK: artifact contains XMLHttpRequest");
  }
}

export function assertDeterminism(text) {
  if (/Math\.random/.test(text)) {
    throw new Error("NONDETERMINISM: artifact contains Math.random");
  }
  if (/Date\.now\s*\(/.test(text)) {
    throw new Error("NONDETERMINISM: artifact contains Date.now()");
  }
  if (/performance\.now\s*\(/.test(text)) {
    throw new Error("NONDETERMINISM: artifact contains performance.now()");
  }
}

export function assertBundle(text) {
  assertBundleSize(text);
  assertSingleIife(text);
  assertNoModuleSyntax(text);
  assertNoNetwork(text);
  assertDeterminism(text);
}

async function main() {
  if (!existsSync(ENTRY_FILE)) {
    console.log(
      "SKIP: src/entry.ts not found — renderer entry lands in Sprint 2; no artifact emitted."
    );
    return;
  }
  mkdirSync(dirname(OUT_FILE), { recursive: true });
  await build({
    entryPoints: [ENTRY_FILE],
    bundle: true,
    format: "iife",
    target: "es2022",
    outfile: OUT_FILE,
    logLevel: "info",
  });
  const artifact = readFileSync(OUT_FILE, "utf8");
  assertBundle(artifact);
  console.log(`BUILD_OK: ${OUT_FILE} (${Buffer.byteLength(artifact, "utf8")} bytes)`);
}

const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(`BUILD_FAILED: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  });
}
