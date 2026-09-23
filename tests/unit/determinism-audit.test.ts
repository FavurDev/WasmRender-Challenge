/**
 * Sprint 9 Task 11 FULL AUDIT FINDINGS (2026-09-23, Wave 4 implementation pass).
 * Result: ZERO banned-API findings, ZERO genuine iteration-order hazards across ALL of src/.
 * Method: (a) TC1/TC3 full-tree static scan over every src/** /*.ts except src/context-intercept.ts
 * (comment+string stripped, 10 banned patterns + for-in/Object.keys-iteration patterns); (b) independent
 * per-file read_file regex verification on webgl1-context, webgl2-context, rasterizer, builtins
 * (banned APIs) and interpreter, program, state, checker (iteration hazards) — all zero matches.
 * Per-file classification: entry.ts clean; gl/buffer.ts clean; gl/constants.ts clean;
 * gl/context-attributes.ts clean; gl/errors.ts clean; gl/extensions.ts clean; gl/framebuffer.ts clean;
 * gl/program.ts clean; gl/query-sync.ts clean; gl/sampler.ts clean; gl/sampler-manager.ts clean;
 * gl/state.ts clean; gl/texture.ts clean; gl/ubo-layout.ts clean; gl/vertex-fetch.ts clean;
 * gl/webgl1-context.ts clean (2728 lines scanned); gl/webgl2-context.ts clean;
 * glsl/builtins.ts clean; glsl/checker.ts clean; glsl/interpreter.ts clean; glsl/parser.ts clean;
 * glsl/preprocessor.ts clean; glsl/tokenizer.ts clean; raster/blend.ts clean; raster/clipper.ts clean;
 * raster/depth-stencil.ts clean; raster/interpolate.ts clean; raster/rasterizer.ts clean.
 * Remediation: NONE REQUIRED — no src/ changes per blueprint (no HAZARD_SUSPECT).
 * Sprint 9 Task 11 determinism audit suite (TDD RED phase) — static banned-API scan, iteration-hazard audit, byte-identical render proofs.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ARRAY_BUFFER,
  BLEND,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  DEPTH_BUFFER_BIT,
  DEPTH_TEST,
  FLOAT,
  FRAGMENT_SHADER,
  LEQUAL,
  LINK_STATUS,
  NO_ERROR,
  ONE_MINUS_SRC_ALPHA,
  RGBA,
  SRC_ALPHA,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

// ---------------------------------------------------------------------------
// Scanner helpers (live in the test file per the blueprint).
// ---------------------------------------------------------------------------

export interface BannedApiFinding {
  rule: string;
  line: number;
}

interface BannedPattern {
  rule: string;
  regex: RegExp;
}

const BANNED_PATTERNS: BannedPattern[] = [
  { rule: 'Date.now', regex: /Date\s*\.\s*now\s*\(/ },
  { rule: 'new Date', regex: /\bnew\s+Date\s*\(/ },
  { rule: 'Math.random', regex: /Math\s*\.\s*random\s*\(/ },
  { rule: 'performance.now', regex: /performance\s*\.\s*now\s*\(/ },
  { rule: 'setTimeout', regex: /\bsetTimeout\s*\(/ },
  { rule: 'setInterval', regex: /\bsetInterval\s*\(/ },
  { rule: 'setImmediate', regex: /\bsetImmediate\s*\(/ },
  { rule: 'requestAnimationFrame', regex: /\brequestAnimationFrame\s*\(/ },
  { rule: 'crypto.getRandomValues', regex: /crypto\s*\.\s*getRandomValues\s*\(/ },
  { rule: 'hrtime', regex: /\bhrtime\s*\(/ },
];

function stripComments(source: string): string {
  // Arrange helper: remove /* */ blocks first, then // line comments.
  const noBlock = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlock
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

function stripStrings(source: string): string {
  // Arrange helper: blank out '...', "...", and `...` literals (naive, no escape tracking beyond backslash).
  return source.replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, (m) => ' '.repeat(m.length));
}

export function scanFileForBannedApis(source: string): BannedApiFinding[] {
  // Arrange: strip comments so commented-out tokens are not flagged.
  const clean = stripComments(source);
  // Act: test each line against each banned pattern.
  const findings: BannedApiFinding[] = [];
  const lines = clean.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    for (const pattern of BANNED_PATTERNS) {
      if (pattern.regex.test(line)) findings.push({ rule: pattern.rule, line: i + 1 });
    }
  }
  // Assert (caller-side): findings list returned.
  return findings;
}

export interface HazardFinding {
  kind: string;
  line: number;
}

interface HazardPattern {
  name: string;
  regex: RegExp;
}

const HAZARD_PATTERNS: HazardPattern[] = [
  { name: 'for-in', regex: /\bfor\s*\(\s*(?:const|let|var)?\s*[\w$]+\s+in\b/ },
  { name: 'Object.keys', regex: /\bObject\s*\.\s*keys\s*\(/ },
  { name: 'Object.entries', regex: /\bObject\s*\.\s*entries\s*\(/ },
  { name: 'Object.values', regex: /\bObject\s*\.\s*values\s*\(/ },
];

export function auditIterationHazards(source: string): HazardFinding[] {
  // Arrange: exclude comments and string literals per TC3.
  const clean = stripStrings(stripComments(source));
  // Act: any hazard match without a chained .sort() on the same line is suspect; for-in is always suspect.
  const findings: HazardFinding[] = [];
  const lines = clean.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] as string;
    for (const pattern of HAZARD_PATTERNS) {
      const match = pattern.regex.exec(line);
      if (match === null) continue;
      if (pattern.name !== 'for-in' && line.slice(match.index).includes('.sort(')) continue;
      findings.push({ kind: 'HAZARD_SUSPECT', line: i + 1 });
    }
  }
  return findings;
}

function repoSrcDir(): string {
  // Arrange helper: resolve <repo>/src from this file's URL.
  const here = fileURLToPath(import.meta.url);
  return join(here, '..', '..', '..', 'src');
}

function collectSrcFiles(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSrcFiles(full, out);
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
}

function auditedSrcFiles(): string[] {
  // Arrange helper: all src/**/*.ts except src/context-intercept.ts.
  const out: string[] = [];
  collectSrcFiles(repoSrcDir(), out);
  return out.filter((f) => !f.replace(/\\/g, '/').endsWith('src/context-intercept.ts')).sort();
}

// ---------------------------------------------------------------------------
// Render helpers (m5-dod.test.ts idiom: dodContext + readback + buffer draw).
// ---------------------------------------------------------------------------

function auditContext(w: number, h: number): WebGL1Context {
  // Arrange helper: factory-created software context.
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('auditContext: factory returned null');
  return gl;
}

const AUDIT_VS = 'attribute vec3 aPos; void main() { gl_Position = vec4(aPos, 1.0); }';
const AUDIT_FS = 'precision mediump float; uniform vec4 uColor; void main() { gl_FragColor = uColor; }';

function auditLink(gl: WebGL1Context): NonNullable<ReturnType<WebGL1Context['createProgram']>> {
  // Arrange helper: compile + link the flat-color program.
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('auditLink: shader creation failed');
  gl.shaderSource(vs, AUDIT_VS);
  gl.shaderSource(fs, AUDIT_FS);
  gl.compileShader(vs);
  gl.compileShader(fs);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('auditLink: VS failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('auditLink: FS failed');
  const program = gl.createProgram();
  if (program === null) throw new Error('auditLink: createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('auditLink: link failed');
  return program;
}

function drawTri(
  gl: WebGL1Context,
  program: NonNullable<ReturnType<WebGL1Context['createProgram']>>,
  positions: number[],
  color: [number, number, number, number],
): void {
  // Arrange helper: buffer-backed single-triangle draw with a flat uniform color.
  const buf = gl.createBuffer();
  if (buf === null) throw new Error('drawTri: createBuffer failed');
  gl.bindBuffer(ARRAY_BUFFER, buf);
  gl.bufferData(ARRAY_BUFFER, new Float32Array(positions), STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'aPos');
  if (loc < 0) throw new Error('drawTri: aPos not found');
  gl.vertexAttribPointer(loc, 3, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(loc);
  const uColor = gl.getUniformLocation(program, 'uColor');
  if (uColor === null) throw new Error('drawTri: uColor not found');
  gl.uniform4f(uColor, color[0], color[1], color[2], color[3]);
  gl.drawArrays(TRIANGLES, 0, 3);
}

function renderAuditScene(gl: WebGL1Context, w: number, h: number): void {
  // Arrange helper: clear + two overlapping translucent depth-tested triangles.
  gl.enable(BLEND);
  gl.enable(DEPTH_TEST);
  gl.depthFunc(LEQUAL);
  gl.clearDepth(1.0);
  gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0.2, 0.4, 0.6, 1.0);
  gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
  const program = auditLink(gl);
  gl.useProgram(program);
  drawTri(gl, program, [-1, -1, 0.5, 3, -1, 0.5, -1, 3, 0.5], [1, 0, 0, 0.5]);
  drawTri(gl, program, [-1, 3, 0.2, 3, -1, 0.2, 1, 1, 0.2], [0, 0, 1, 0.5]);
}

function auditReadback(gl: WebGL1Context, w: number, h: number): Uint8Array {
  // Arrange helper: full-buffer readback.
  const out = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, RGBA, UNSIGNED_BYTE, out);
  return out;
}

// ---------------------------------------------------------------------------
// TC1–TC7.
// ---------------------------------------------------------------------------

describe('Sprint 9 Task 11 determinism audit', () => {
  it('TC1: static scan of src/ finds zero banned non-deterministic API usages', () => {
    // Arrange: collect audited sources.
    const files = auditedSrcFiles();
    expect(files.length).toBeGreaterThan(0);
    // Act: scan every file.
    const all: Array<{ file: string; rule: string; line: number }> = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const finding of scanFileForBannedApis(source)) {
        all.push({ file, rule: finding.rule, line: finding.line });
      }
    }
    // Assert: zero findings across production sources.
    expect(all).toEqual([]);
  });

  it('TC2: live-gate negative proof — each banned pattern yields exactly one finding', () => {
    // Arrange: one synthetic snippet per banned rule.
    const cases: Array<{ snippet: string; rule: string }> = [
      { snippet: 'const t = Date.now();', rule: 'Date.now' },
      { snippet: 'const d = new Date();', rule: 'new Date' },
      { snippet: 'const r = Math.random();', rule: 'Math.random' },
      { snippet: 'const p = performance.now();', rule: 'performance.now' },
      { snippet: 'const id = setTimeout(() => {}, 10);', rule: 'setTimeout' },
      { snippet: 'const id2 = setInterval(() => {}, 10);', rule: 'setInterval' },
      { snippet: 'const id3 = setImmediate(() => {});', rule: 'setImmediate' },
      { snippet: 'const id4 = requestAnimationFrame(() => {});', rule: 'requestAnimationFrame' },
      { snippet: 'crypto.getRandomValues(buf);', rule: 'crypto.getRandomValues' },
      { snippet: 'const t = process.hrtime();', rule: 'hrtime' },
    ];
    // Act + Assert: each snippet produces exactly one finding with the right rule on line 1.
    for (const c of cases) {
      const findings = scanFileForBannedApis(c.snippet);
      expect(findings.length).toBe(1);
      expect(findings[0]?.rule).toBe(c.rule);
      expect(findings[0]?.line).toBe(1);
    }
  });

  it('TC3: iteration-order hazard audit over src/ finds zero HAZARD_SUSPECT findings', () => {
    // Arrange: collect audited sources.
    const files = auditedSrcFiles();
    expect(files.length).toBeGreaterThan(0);
    // Act: audit every file.
    const all: Array<{ file: string; line: number }> = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const finding of auditIterationHazards(source)) {
        if (finding.kind === 'HAZARD_SUSPECT') all.push({ file, line: finding.line });
      }
    }
    // Assert: zero suspect findings.
    expect(all).toEqual([]);
  });

  it('TC4: live-gate negative — unsorted Object.keys().forEach is flagged HAZARD_SUSPECT', () => {
    // Arrange: unsorted iteration snippet.
    const snippet = 'Object.keys(table).forEach((k) => { render(table[k]); });';
    // Act:
    const findings = auditIterationHazards(snippet);
    // Assert: exactly one suspect finding on line 1.
    expect(findings.length).toBe(1);
    expect(findings[0]?.kind).toBe('HAZARD_SUSPECT');
    expect(findings[0]?.line).toBe(1);
  });

  it('TC5: two independent contexts render byte-identical 16x16 output', () => {
    // Arrange: two fresh contexts.
    const w = 16;
    const h = 16;
    const glA = auditContext(w, h);
    const glB = auditContext(w, h);
    // Act: identical scene on both.
    renderAuditScene(glA, w, h);
    expect(glA.getError()).toBe(NO_ERROR);
    renderAuditScene(glB, w, h);
    expect(glB.getError()).toBe(NO_ERROR);
    const a = auditReadback(glA, w, h);
    const b = auditReadback(glB, w, h);
    // Assert: byte-identical.
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('TC6: double render on the same context is byte-identical', () => {
    // Arrange: one context.
    const w = 16;
    const h = 16;
    const gl = auditContext(w, h);
    // Act: render twice with identical setup.
    renderAuditScene(gl, w, h);
    expect(gl.getError()).toBe(NO_ERROR);
    const first = auditReadback(gl, w, h);
    renderAuditScene(gl, w, h);
    expect(gl.getError()).toBe(NO_ERROR);
    const second = auditReadback(gl, w, h);
    // Assert: byte-identical.
    expect(Array.from(second)).toEqual(Array.from(first));
  });

  it('TC7: banned tokens inside comments produce zero findings', () => {
    // Arrange: line-comment and block-comment cases.
    const lineComment = '// const t = Date.now(); // Math.random() performance.now()';
    const blockComment = '/* setTimeout(() => {}) setInterval(() => {}) crypto.getRandomValues(buf); */';
    const mixed = 'const x = 1; // new Date() requestAnimationFrame(() => {})';
    // Act:
    const a = scanFileForBannedApis(lineComment);
    const b = scanFileForBannedApis(blockComment);
    const c = scanFileForBannedApis(mixed);
    // Assert: all clean.
    expect(a).toEqual([]);
    expect(b).toEqual([]);
    expect(c).toEqual([]);
  });
});
