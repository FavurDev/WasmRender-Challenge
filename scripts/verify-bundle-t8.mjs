import { readFileSync } from 'node:fs';
import { assertBundle } from './build-renderer.mjs';
const text = readFileSync('C:/app/renderer.js', 'utf8');
assertBundle(text);
const webgl2 = text.includes('__WebGL2Context') || text.includes('WebGL2Context');
if (!webgl2) throw new Error('WEBGL2_ENTRY_MISSING');
console.log(`ASSERT_OK: 6/6 size=${Buffer.byteLength(text, 'utf8')} webgl2=${webgl2}`);
