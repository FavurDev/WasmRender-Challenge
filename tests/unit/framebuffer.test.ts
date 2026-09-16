/** Framebuffer triple red-phase suite (Sprint 1 Task 3). Headless Node, no DOM. */
import { describe, expect, it } from 'vitest';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { COLOR_BUFFER_BIT } from '../../src/renderer/gl-constants';

interface PutImageDataCall {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface StubCanvas2D {
  calls: PutImageDataCall[];
  putImageData(data: Uint8ClampedArray, w: number, h: number): void;
}

function makeStubCanvas(): StubCanvas2D {
  return {
    calls: [],
    putImageData(data: Uint8ClampedArray, w: number, h: number): void {
      this.calls.push({ data, width: w, height: h });
    },
  };
}

function expectOutOfMemoryError(fn: () => void): void {
  // Arrange/Act handled by caller; Assert structural error shape.
  try {
    fn();
  } catch (err: unknown) {
    expect((err as Error).name).toBe('OutOfMemoryError');
    return;
  }
  throw new Error('Expected OutOfMemoryError but no error was thrown');
}

describe('Framebuffer', () => {
  it('init defaults: fresh 4x4 reads color 0, depth 1.0, stencil 0', () => {
    // Arrange
    const fb = new Framebuffer(4, 4);
    // Act
    const color = fb.readPixels(0, 0, 4, 4);
    // Assert
    expect(color.length).toBe(4 * 4 * 4);
    expect(Array.from(color).every((b) => b === 0)).toBe(true);
    expect(Array.from(fb.depth).every((d) => d === 1.0)).toBe(true);
    expect(Array.from(fb.stencil).every((s) => s === 0)).toBe(true);
  });

  it('red-clear byte exactness: 64x64 clearColor(1,0,0,1) fills all [255,0,0,255]', () => {
    // Arrange
    const fb = new Framebuffer(64, 64);
    fb.clearColor(1, 0, 0, 1);
    // Act
    fb.clear(COLOR_BUFFER_BIT);
    const px = fb.readPixels(0, 0, 64, 64);
    // Assert
    expect(px.length).toBe(64 * 64 * 4);
    for (let i = 0; i < px.length; i += 4) {
      expect([px[i], px[i + 1], px[i + 2], px[i + 3]]).toEqual([255, 0, 0, 255]);
    }
  });

  it('quantization 0.5 maps to 128', () => {
    // Arrange
    const fb = new Framebuffer(4, 4);
    fb.clearColor(0.5, 0, 0, 1);
    // Act
    fb.clear(COLOR_BUFFER_BIT);
    const px = fb.readPixels(0, 0, 1, 1);
    // Assert
    expect(px[0]).toBe(128);
  });

  it('resize-retains-prior on OOM: resize(5000,64) raises, width stays 64, red intact', () => {
    // Arrange
    const fb = new Framebuffer(64, 64);
    fb.clearColor(1, 0, 0, 1);
    fb.clear(COLOR_BUFFER_BIT);
    // Act
    expectOutOfMemoryError(() => fb.resize(5000, 64));
    const px = fb.readPixels(0, 0, 64, 64);
    // Assert
    expect(fb.width).toBe(64);
    expect(px[0]).toBe(255);
    expect(px[1]).toBe(0);
    expect(px[2]).toBe(0);
    expect(px[3]).toBe(255);
  });

  it('readPixels untouched zeros: fresh 8x8 2x2 sub-rect returns 16 zero bytes', () => {
    // Arrange
    const fb = new Framebuffer(8, 8);
    // Act
    const px = fb.readPixels(0, 0, 2, 2);
    // Assert
    expect(px.length).toBe(16);
    expect(Array.from(px).every((b) => b === 0)).toBe(true);
  });

  it('masked clear honors write masks: red channel disabled keeps 255 while blue becomes 255', () => {
    // Arrange
    const fb = new Framebuffer(4, 4);
    fb.clearColor(1, 0, 0, 1);
    fb.clear(COLOR_BUFFER_BIT);
    fb.setColorMask(false, true, true, true);
    fb.clearColor(0, 0, 1, 1);
    // Act
    fb.clear(COLOR_BUFFER_BIT);
    const px = fb.readPixels(0, 0, 1, 1);
    // Assert
    expect(px[0]).toBe(255);
    expect(px[2]).toBe(255);
  });

  it('presentToCanvas uses putImageData: stub called once with live extent, no conversion', () => {
    // Arrange
    const fb = new Framebuffer(4, 4);
    const stub = makeStubCanvas();
    // Act
    fb.presentToCanvas(stub as unknown as CanvasRenderingContext2D);
    // Assert
    expect(stub.calls.length).toBe(1);
    expect(stub.calls[0]?.width).toBe(4);
    expect(stub.calls[0]?.height).toBe(4);
  });
});
