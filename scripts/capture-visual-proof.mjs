// scripts/capture-visual-proof.mjs
// Run-once headless capture: renders the reference red triangle through the
// built bundle (renderer.js -> window.__createSoftwareWebGLContext) and writes
// visual-proof/first-triangle.png (exact 64x64, no resize/filter) plus
// visual-proof/manifest.json provenance. Tooling only, not shipped.
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BUNDLE_PATH = path.join(ROOT, 'renderer.js');
const OUT_DIR = path.join(ROOT, 'visual-proof');
const PNG_PATH = path.join(OUT_DIR, 'first-triangle.png');
const MANIFEST_PATH = path.join(OUT_DIR, 'manifest.json');
const W = 64;
const H = 64;
const COLOR_BUFFER_BIT = 0x00004000;

// Precondition: bundle must exist; abort loudly otherwise.
try {
  await stat(BUNDLE_PATH);
} catch {
  console.error(`missing-bundle: renderer.js not found at ${BUNDLE_PATH}. Build the renderer first.`);
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.addScriptTag({ path: BUNDLE_PATH });
  const raw = await page.evaluate(({ w, h, clearBit }) => {
    const factory = window.__createSoftwareWebGLContext;
    if (typeof factory !== 'function') {
      throw new Error('factory-missing: window.__createSoftwareWebGLContext is not a function after bundle injection');
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const gl = factory(canvas, {});
    if (!gl) throw new Error('factory-missing: __createSoftwareWebGLContext returned null');
    gl.clearColor(0, 0, 0, 1);
    gl.clear(clearBit);
    gl.drawTriangle();
    if (typeof gl.presentToCanvas === 'function') {
      try { gl.presentToCanvas(); } catch { /* documented no-op */ }
    }
    const px = gl.readPixels(0, 0, w, h);
    if (!px || px.length !== w * h * 4) throw new Error('capture-failure: readPixels returned unexpected bytes');
    return Array.from(px);
  }, { w: W, h: H, clearBit: COLOR_BUFFER_BIT });

  const rgba = Buffer.from(raw);
  const pngBytes = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  if (pngBytes.length === 0) {
    console.error('capture-failure: zero-byte PNG, manifest not written');
    process.exit(1);
  }
  await writeFile(PNG_PATH, pngBytes);

  // Manifest authoring: measure bundle bytes at manifest time.
  const bundle = await readFile(BUNDLE_PATH);
  const bundleHash = createHash('sha256').update(bundle).digest('hex');
  const manifest = {
    scene: 'red-triangle-64',
    dimensions: { width: W, height: H },
    background: 'dark opaque background (clear color black, alpha 1)',
    provenance: {
      bundlePath: 'renderer.js',
      bundleBytes: bundle.length,
      bundleHash,
      command: 'node scripts/capture-visual-proof.mjs',
      createdAt: new Date().toISOString(),
    },
    pngPath: 'visual-proof/first-triangle.png',
  };
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

  // Re-read and field-compare.
  const reread = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  if (JSON.stringify(reread) !== JSON.stringify(manifest)) {
    console.error('manifest-mismatch: re-read manifest differs from written record');
    process.exit(1);
  }
  if (reread.pngPath !== 'visual-proof/first-triangle.png' || reread.dimensions.width !== W || reread.dimensions.height !== H) {
    console.error('inconsistency: manifest pngPath/dimensions do not match captured PNG');
    process.exit(1);
  }
  console.log(`captured ${PNG_PATH} (${pngBytes.length} bytes) + ${MANIFEST_PATH}`);
} finally {
  await browser.close();
}
