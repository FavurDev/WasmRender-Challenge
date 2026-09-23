/** LOD selection unit tests (Sprint 9 Task 3, TD-017 closure — RED phase). */
import { describe, expect, it } from 'vitest';
import { computeLod, selectMipLevel } from '../../src/glsl/builtins';
import {
  LINEAR,
  LINEAR_MIPMAP_LINEAR,
  LINEAR_MIPMAP_NEAREST,
  NEAREST,
  NEAREST_MIPMAP_LINEAR,
  NEAREST_MIPMAP_NEAREST,
} from '../../src/gl/constants';

describe('selectMipLevel — NEAREST selects base level', () => {
  it('returns level0=0 level1=0 mode=single for clampedLod=4.0', () => {
    // Arrange
    const clampedLod = 4.0;
    const maxLod = 8;
    // Act
    const result = selectMipLevel(clampedLod, maxLod, NEAREST);
    // Assert
    expect(result.level0).toBe(0);
    expect(result.level1).toBe(0);
    expect(result.mode).toBe('single');
  });
});

describe('selectMipLevel — LINEAR selects base level', () => {
  it('returns level0=0 level1=0 mode=single for clampedLod=3.5', () => {
    // Arrange
    const clampedLod = 3.5;
    const maxLod = 8;
    // Act
    const result = selectMipLevel(clampedLod, maxLod, LINEAR);
    // Assert
    expect(result.level0).toBe(0);
    expect(result.level1).toBe(0);
    expect(result.mode).toBe('single');
  });
});

describe('selectMipLevel — NEAREST_MIPMAP_NEAREST rounds to nearest', () => {
  it('rounds 2.49 down to level 2', () => {
    // Arrange
    const clampedLod = 2.49;
    // Act
    const result = selectMipLevel(clampedLod, 8, NEAREST_MIPMAP_NEAREST);
    // Assert
    expect(result.level0).toBe(2);
    expect(result.mode).toBe('single');
  });

  it('rounds 2.51 up to level 3', () => {
    // Arrange
    const clampedLod = 2.51;
    // Act
    const result = selectMipLevel(clampedLod, 8, NEAREST_MIPMAP_NEAREST);
    // Assert
    expect(result.level0).toBe(3);
    expect(result.mode).toBe('single');
  });
});

describe('selectMipLevel — LINEAR_MIPMAP_NEAREST rounds to nearest', () => {
  it('rounds 3.7 up to level 4', () => {
    // Arrange
    const clampedLod = 3.7;
    // Act
    const result = selectMipLevel(clampedLod, 8, LINEAR_MIPMAP_NEAREST);
    // Assert
    expect(result.level0).toBe(4);
    expect(result.mode).toBe('single');
  });
});

describe('selectMipLevel — NEAREST_MIPMAP_LINEAR blends', () => {
  it('selects levels 2/3 with fraction fround(0.25) for lod 2.25', () => {
    // Arrange
    const clampedLod = 2.25;
    // Act
    const result = selectMipLevel(clampedLod, 8, NEAREST_MIPMAP_LINEAR);
    // Assert
    expect(result.level0).toBe(2);
    expect(result.level1).toBe(3);
    expect(result.fraction).toBe(Math.fround(0.25));
    expect(result.mode).toBe('linear_blend');
  });
});

describe('selectMipLevel — LINEAR_MIPMAP_LINEAR trilinear', () => {
  it('selects levels 1/2 with fraction fround(0.625) for lod 1.625', () => {
    // Arrange
    const clampedLod = 1.625;
    // Act
    const result = selectMipLevel(clampedLod, 8, LINEAR_MIPMAP_LINEAR);
    // Assert
    expect(result.level0).toBe(1);
    expect(result.level1).toBe(2);
    expect(result.fraction).toBe(Math.fround(0.625));
    expect(result.mode).toBe('linear_blend');
  });
});

describe('computeLod clamping — magnification and max bounds', () => {
  it('clamps lambda -1.0 (rho 0.5) to 0.0 with fround precision', () => {
    // Arrange
    const dPdx = new Float32Array([0.5 / 64, 0]);
    const dPdy = new Float32Array([0, 0.5 / 64]);
    const maxLod = 6;
    // Act
    const lambda = computeLod(null, null, dPdx, dPdy, 64, 64);
    const clamped = Math.fround(Math.max(0.0, Math.min(maxLod, lambda)));
    // Assert
    expect(lambda).toBe(Math.fround(-1.0));
    expect(clamped).toBe(Math.fround(0.0));
  });

  it('clamps lambda 8.0 (rho 256) to maxLod 6.0 with fround precision', () => {
    // Arrange
    const dPdx = new Float32Array([256 / 64, 0]);
    const dPdy = new Float32Array([0, 256 / 64]);
    const maxLod = 6;
    // Act
    const lambda = computeLod(null, null, dPdx, dPdy, 64, 64);
    const clamped = Math.fround(Math.max(0.0, Math.min(maxLod, lambda)));
    // Assert
    expect(lambda).toBe(Math.fround(8.0));
    expect(clamped).toBe(Math.fround(6.0));
  });
});
