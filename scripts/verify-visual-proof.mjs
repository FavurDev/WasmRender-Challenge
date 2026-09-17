// scripts/verify-visual-proof.mjs
// Verifies visual-proof/first-triangle.png + manifest.json evidence (Sprint 6 Task 5).
// Exit 0 only when every check passes; non-zero with per-check messages otherwise.
import { stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PNG_PATH = path.join(ROOT, 'visual-proof', 'first-triangle.png');
const MANIFEST_PATH = path.join(ROOT, 'visual-proof', 'manifest.json');
const BUNDLE_PATH = path.join(ROOT, 'renderer.js');
const EXPECTED_W = 64;
const EXPECTED_H = 64;

const failures = [];
const fail = (msg) => failures.push(msg);

// 1. PNG exists, non-zero bytes, 64x64 via sharp metadata.
try {
  const st = await stat(PNG_PATH);
  if (st.size === 0) fail(`FAIL png: ${PNG_PATH} is empty (0 bytes)`);
  else {
    const meta = await sharp(PNG_PATH).metadata();
    if (meta.width !== EXPECTED_W || meta.height !== EXPECTED_H) {
      fail(`FAIL png: expected ${EXPECTED_W}x${EXPECTED_H}, got ${meta.width}x${meta.height}`);
    }
  }
} catch (err) {
  fail(`FAIL png: missing or unreadable at visual-proof/first-triangle.png (${err.code ?? err.message})`);
}

// 2. Manifest exists with required fields.
let manifest = null;
try {
  const raw = await readFile(MANIFEST_PATH, 'utf8');
  manifest = JSON.parse(raw);
} catch (err) {
  fail(`FAIL manifest: missing or invalid JSON at visual-proof/manifest.json (${err.code ?? err.message})`);
}
if (manifest) {
  const required = ['scene', 'dimensions', 'background', 'provenance', 'pngPath'];
  for (const k of required) if (!(k in manifest)) fail(`FAIL manifest: missing field "${k}"`);
  const dims = manifest.dimensions ?? {};
  if (dims.width !== EXPECTED_W || dims.height !== EXPECTED_H) {
    fail(`FAIL manifest: dimensions must be ${EXPECTED_W}x${EXPECTED_H}, got ${JSON.stringify(manifest.dimensions)}`);
  }
  const prov = manifest.provenance ?? {};
  for (const k of ['bundlePath', 'bundleBytes', 'bundleHash', 'command', 'createdAt']) {
    if (!(k in prov)) fail(`FAIL manifest.provenance: missing field "${k}"`);
  }
  // 3. bundleBytes/hash match current renderer.js.
  try {
    const bundle = await readFile(BUNDLE_PATH);
    const hash = createHash('sha256').update(bundle).digest('hex');
    if (prov.bundleBytes !== undefined && prov.bundleBytes !== bundle.length) {
      fail(`FAIL provenance: bundleBytes ${prov.bundleBytes} != actual ${bundle.length}`);
    }
    if (prov.bundleHash !== undefined && prov.bundleHash !== hash) {
      fail(`FAIL provenance: bundleHash ${prov.bundleHash} != actual ${hash}`);
    }
  } catch (err) {
    fail(`FAIL provenance: cannot read renderer.js (${err.code ?? err.message})`);
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(f);
  console.error(`visual-proof verification FAILED: ${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('visual-proof verification PASSED');
