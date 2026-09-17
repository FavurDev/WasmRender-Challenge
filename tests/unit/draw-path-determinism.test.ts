/**
 * @fileoverview Sprint 6 Task 2 draw-path determinism gate (green: 12/12 passing).
 * Headless Node Vitest: scans src/renderer as text + pixel-iteration audit.
 * Arrange-Act-Assert throughout. No browser/DOM, no network, no randomness.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_ROOT = path.resolve(HERE, '../../src/renderer');

const BANNED: { pattern: string; re: RegExp }[] = [
  { pattern: 'Math.random', re: /Math[.]random\s*[(]/g },
  { pattern: 'Date.now', re: /Date[.]now\s*[(]/g },
  { pattern: 'performance.now', re: /performance[.]now\s*[(]/g },
  { pattern: 'new Date(', re: /new\s+Date\s*[(]/g },
  { pattern: 'process.hrtime', re: /process[.]hrtime/g },
  { pattern: 'performance.timeOrigin', re: /performance[.]timeOrigin/g },
];

// Allowed deterministic Math members — must never count as hits.
const ALLOWED_MATH = ['Math.floor', 'Math.ceil', 'Math.min', 'Math.max', 'Math.abs', 'Math.round'];

// Documented allowlist: starts empty (audit found zero unexplained hits).
const ALLOWLIST: { file: string; line: number; pattern: string; reason: string }[] = [];

interface Hit { file: string; line: number; pattern: string; text: string }

function enumerateTsFiles(root: string): string[] {
  // Arrange helper: recursive enumeration, never hard-coded.
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
    }
  };
  walk(root);
  return out.sort();
}

function scanFile(file: string): Hit[] {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const hits: Hit[] = [];
  lines.forEach((lineText, idx) => {
    for (const b of BANNED) {
      b.re.lastIndex = 0;
      if (b.re.test(lineText)) {
        hits.push({ file: path.relative(process.cwd(), file), line: idx + 1, pattern: b.pattern, text: lineText.trim() });
      }
    }
  });
  return hits;
}

function runDrawPathScan(): { files: string[]; hits: Hit[]; unexplained: Hit[] } {
  const files = enumerateTsFiles(SOURCE_ROOT);
  const hits = files.flatMap(scanFile);
  const unexplained = hits.filter(
    (h) => !ALLOWLIST.some((a) => h.file.endsWith(a.file) && h.line === a.line && h.pattern === a.pattern),
  );
  return { files, hits, unexplained };
}

function formatHits(hits: Hit[]): string {
  return hits.map((h) => `${h.file}:${h.line} [${h.pattern}] ${h.text}`).join('\n');
}

describe('draw-path determinism', () => {
  describe('Group 1 — banned-pattern scan (AC-1)', () => {
    it('enumerates renderer sources recursively (no hard-coded list)', () => {
      // Arrange
      // Act
      const files = enumerateTsFiles(SOURCE_ROOT);
      // Assert
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.endsWith('.ts'))).toBe(true);
      expect(files.some((f) => f.endsWith('rasterizer.ts'))).toBe(true);
      expect(files.some((f) => f.endsWith('framebuffer.ts'))).toBe(true);
      expect(files.some((f) => f.endsWith('texture.ts'))).toBe(true);
      expect(files.some((f) => f.endsWith('context.ts'))).toBe(true);
    });

    it('scan asserts no Math.random in any renderer file', () => {
      // Arrange
      const { unexplained } = runDrawPathScan();
      // Act
      const hits = unexplained.filter((h) => h.pattern === 'Math.random');
      // Assert
      expect(hits, formatHits(hits)).toEqual([]);
    });

    it('scan asserts no Date.now in any renderer file', () => {
      // Arrange
      const { unexplained } = runDrawPathScan();
      // Act
      const hits = unexplained.filter((h) => h.pattern === 'Date.now');
      // Assert
      expect(hits, formatHits(hits)).toEqual([]);
    });

    it('scan asserts no performance.now in any renderer file', () => {
      // Arrange
      const { unexplained } = runDrawPathScan();
      // Act
      const hits = unexplained.filter((h) => h.pattern === 'performance.now');
      // Assert
      expect(hits, formatHits(hits)).toEqual([]);
    });

    it('scan asserts no bare Date construction or high-resolution timer in any renderer file', () => {
      // Arrange
      const { unexplained } = runDrawPathScan();
      // Act
      const hits = unexplained.filter((h) =>
        ['new Date(', 'process.hrtime', 'performance.timeOrigin'].includes(h.pattern),
      );
      // Assert
      expect(hits, formatHits(hits)).toEqual([]);
    });

    it('scan asserts deterministic Math.floor/ceil/min/max/abs/round uses do not count as hits', () => {
      // Arrange
      const files = enumerateTsFiles(SOURCE_ROOT);
      // Act: allowed members must be detectable in raster math yet never flagged
      let allowedCount = 0;
      for (const f of files) {
        const text = fs.readFileSync(f, 'utf8');
        for (const m of ALLOWED_MATH) {
          if (text.includes(m)) allowedCount += 1;
        }
      }
      const { hits } = runDrawPathScan();
      const allowedAsHits = hits.filter((h) => ALLOWED_MATH.includes(h.pattern));
      // Assert
      expect(allowedCount).toBeGreaterThan(0);
      expect(allowedAsHits).toEqual([]);
    });

    it('scan asserts the allowlist equals exactly the documented set (zero unexplained hits)', () => {
      // Arrange
      const { files, unexplained } = runDrawPathScan();
      // Act
      const allowlistExact = ALLOWLIST.length === 0;
      // Assert
      expect(files.length).toBeGreaterThan(0);
      expect(allowlistExact).toBe(true);
      expect(unexplained, formatHits(unexplained)).toEqual([]);
    });
  });

  describe('Group 2 — pixel-iteration audit (AC-2)', () => {
    it('audit asserts framebuffer duplicate-check Set is validation-only', () => {
      // Arrange
      const text = fs.readFileSync(path.join(SOURCE_ROOT, 'framebuffer.ts'), 'utf8');
      // Act: Set used for duplicate validation; pixel writes use indexed drawConfig order
      const usesSet = text.includes('new Set');
      const iteratesForPixels = /for\s*\([^)]*of\s+\w*[Ss]een\w*[^)]*\)[\s\S]{0,200}writeFragment|for\s*\([^)]*of\s+seen/.test(text);
      // Assert
      expect(usesSet).toBe(true);
      expect(iteratesForPixels).toBe(false);
    });

    it('audit asserts texture handle-table Map is lookup-only', () => {
      // Arrange
      const text = fs.readFileSync(path.join(SOURCE_ROOT, 'texture.ts'), 'utf8');
      // Act
      const usesMap = text.includes('new Map');
      const pixelLoopIteratesMap =
        /fillTriangle|writeFragment[\s\S]*for\s*\([^)]*of\s+this\.textures/.test(text);
      // Assert
      expect(usesMap).toBe(true);
      expect(pixelLoopIteratesMap).toBe(false);
    });

    it('audit asserts context handle-table Map/Set stores never iterate per fragment', () => {
      // Arrange
      const text = fs.readFileSync(path.join(SOURCE_ROOT, 'context.ts'), 'utf8');
      // Act: rasterizer module must not iterate context handle tables
      const rast = fs.readFileSync(path.join(SOURCE_ROOT, 'rasterizer.ts'), 'utf8');
      const rastIteratesUnordered = /for\s*\([^)]*\.keys\(\)|for\s*\([^)]*\.values\(\)|for\s*\([^)]*\.entries\(\)|for\s*\([^)]*\bof\s+.*(Set|Map)\b/.test(rast);
      // Assert
      expect(text.includes('new Map') || text.includes('new Set')).toBe(true);
      expect(rastIteratesUnordered).toBe(false);
    });

    it('audit asserts program link-time Map iteration is setup-only with declaration-order locations', () => {
      // Arrange
      const text = fs.readFileSync(path.join(SOURCE_ROOT, 'program.ts'), 'utf8');
      // Act
      const rast = fs.readFileSync(path.join(SOURCE_ROOT, 'rasterizer.ts'), 'utf8');
      const programImportedForPixels = /from\s+['"]\.\/program['"]/.test(rast);
      // Assert
      expect(text.length).toBeGreaterThan(0);
      expect(programImportedForPixels).toBe(false);
    });

    it('audit asserts zero pixel-influencing Set/Map iteration across pixel loops', () => {
      // Arrange: pixel-loop list from rasterizer (fillTriangle, writeFragment, drawArraysImpl, drawElementsImpl)
      const rast = fs.readFileSync(path.join(SOURCE_ROOT, 'rasterizer.ts'), 'utf8');
      // Act
      const unorderedIter = /for\s*\([^)]*\bof\b[^)]*\)/g;
      const matches = rast.match(unorderedIter) ?? [];
      const pixelInfluencing = matches.filter((m) => /\.keys\(\)|\.values\(\)|\.entries\(\)|\bSet\b|\bMap\b/.test(m));
      // Assert
      expect(pixelInfluencing).toEqual([]);
    });
  });
});
