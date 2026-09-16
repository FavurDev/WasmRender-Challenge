/** gl-constants TDD red-phase tests (TEST-1..TEST-7). Headless Node vitest, no DOM/canvas. */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as GL from '../../src/renderer/gl-constants';

describe('gl-constants TEST-1: primitive anchor TRIANGLES', () => {
  it('TRIANGLES equals 0x0004', () => {
    // Arrange: module loaded fresh via static import
    // Act: read binding
    const actual = (GL as unknown as Record<string, number>).TRIANGLES;
    // Assert: exact spec value
    expect(actual).toBe(0x0004);
  });
});

describe('gl-constants TEST-2: depth anchor LESS', () => {
  it('LESS equals 0x0201', () => {
    // Arrange
    // Act
    const actual = (GL as unknown as Record<string, number>).LESS;
    // Assert
    expect(actual).toBe(0x0201);
  });
});

describe('gl-constants TEST-3: pixel and error anchors', () => {
  it('RGBA equals 0x1908 and INVALID_ENUM equals 0x0500', () => {
    // Arrange
    // Act
    const rgba = (GL as unknown as Record<string, number>).RGBA;
    const invalidEnum = (GL as unknown as Record<string, number>).INVALID_ENUM;
    // Assert
    expect(rgba).toBe(0x1908);
    expect(invalidEnum).toBe(0x0500);
  });
});

describe('gl-constants TEST-4: limit anchor MAX_TEXTURE_SIZE', () => {
  it('MAX_TEXTURE_SIZE reads 4096', () => {
    // Arrange
    // Act
    const actual = (GL as unknown as Record<string, number>).MAX_TEXTURE_SIZE;
    // Assert
    expect(actual).toBe(4096);
  });
});

describe('gl-constants TEST-5: limit anchor MAX_VIEWPORT_DIMS', () => {
  it('MAX_VIEWPORT_DIMS reads [4096,4096]', () => {
    // Arrange
    // Act
    const actual = (GL as unknown as Record<string, readonly number[]>).MAX_VIEWPORT_DIMS;
    // Assert
    expect(actual.length).toBe(2);
    expect(actual[0]).toBe(4096);
    expect(actual[1]).toBe(4096);
  });
});

describe('gl-constants TEST-6: related caps', () => {
  it('MAX_COLOR_ATTACHMENTS and related caps equal 4, 1024, 16, 16, 4096', () => {
    // Arrange
    const rec = GL as unknown as Record<string, number>;
    // Act
    // Assert
    expect(rec.MAX_COLOR_ATTACHMENTS).toBe(4);
    expect(rec.MAX_CUBE_MAP_TEXTURE_SIZE).toBe(1024);
    expect(rec.MAX_VERTEX_ATTRIBS).toBe(16);
    expect(rec.MAX_TEXTURE_IMAGE_UNITS).toBe(16);
    expect(rec.MAX_RENDERBUFFER_SIZE).toBe(4096);
  });
});

describe('gl-constants TEST-7: leaf invariant zero imports', () => {
  it('gl-constants.ts carries zero import declarations', () => {
    // Arrange: read raw source text
    const here = path.dirname(fileURLToPath(import.meta.url));
    const sourcePath = path.resolve(here, '../../src/renderer/gl-constants.ts');
    const text = fs.readFileSync(sourcePath, 'utf8');
    // Act: scan for module import declarations
    const matches = text.match(/^\s*import\s/mg) ?? [];
    // Assert
    expect(matches.length).toBe(0);
  });
});
