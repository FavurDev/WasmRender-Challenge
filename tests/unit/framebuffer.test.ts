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

/** Task 6 readback/presentation red-phase suite (Sprint 4 Task 6). Headless Node, no DOM. */
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  COLOR_BUFFER_BIT as TASK6_COLOR_BIT,
  FRAGMENT_SHADER as TASK6_FS,
  INVALID_ENUM as TASK6_INVALID_ENUM,
  INVALID_VALUE as TASK6_INVALID_VALUE,
  NO_ERROR as TASK6_NO_ERROR,
  RGB as TASK6_RGB,
  RGBA as TASK6_RGBA,
  TRIANGLES as TASK6_TRIANGLES,
  UNSIGNED_BYTE as TASK6_UNSIGNED_BYTE,
  VERTEX_SHADER as TASK6_VS,
} from '../../src/renderer/gl-constants';

interface Task6Facade {
  createShader(type: number): number;
  shaderSource(shader: number, source: string): void;
  compileShader(shader: number): void;
  createProgram(): number;
  attachShader(program: number, shader: number): void;
  linkProgram(program: number): void;
  useProgram(program: number | null): void;
  drawArrays(mode: number, first: number, count: number): void;
  getError(): number;
  readPixels(x: number, y: number, w: number, h: number, format: number, type: number): Uint8Array | null;
  presentToCanvas(target: unknown): void;
}

interface RecordingCtx2D {
  calls: { data: Uint8ClampedArray; width: number; height: number }[];
  putImageData(img: unknown, x: number, y: number): void;
}

const TASK6_W = 8;
const TASK6_H = 8;

const TASK6_VERT = [
  'attribute vec3 position;',
  'void main() {',
  '  gl_Position = vec4(position, 1.0);',
  '}',
].join('\n');

const TASK6_FRAG = [
  'precision mediump float;',
  'void main() {',
  '  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);',
  '}',
].join('\n');

function task6Canvas(rec: RecordingCtx2D): unknown {
  return {
    width: TASK6_W,
    height: TASK6_H,
    getContext: (_kind: string): RecordingCtx2D => rec,
  };
}

function makeRecording(): RecordingCtx2D {
  return {
    calls: [],
    putImageData(img: unknown, _x: number, _y: number): void {
      const rec = img as { data: Uint8ClampedArray; width: number; height: number };
      this.calls.push({ data: new Uint8ClampedArray(rec.data), width: rec.width, height: rec.height });
    },
  };
}

function task6LinkedCtx(rec: RecordingCtx2D): Task6Facade {
  // Arrange helper: fresh context with linked solid-red program selected.
  const ctx = createSoftwareWebGLContext(task6Canvas(rec) as never) as unknown as Task6Facade;
  const vs = ctx.createShader(TASK6_VS);
  ctx.shaderSource(vs, TASK6_VERT);
  ctx.compileShader(vs);
  const fs = ctx.createShader(TASK6_FS);
  ctx.shaderSource(fs, TASK6_FRAG);
  ctx.compileShader(fs);
  const prog = ctx.createProgram();
  ctx.attachShader(prog, vs);
  ctx.attachShader(prog, fs);
  ctx.linkProgram(prog);
  ctx.useProgram(prog);
  // Drain any setup errors so each case starts clean.
  while (ctx.getError() !== TASK6_NO_ERROR) { /* drain */ }
  return ctx;
}

describe('task6 readback and presentation (TDD red phase)', () => {
  it('round-trip returns exact written bytes', () => {
    // Arrange
    const rec = makeRecording();
    const ctx = task6LinkedCtx(rec);
    // Act
    ctx.drawArrays(TASK6_TRIANGLES, 0, 3);
    const px = ctx.readPixels(0, 0, TASK6_W, TASK6_H, TASK6_RGBA, TASK6_UNSIGNED_BYTE);
    // Assert
    expect(px).not.toBeNull();
    expect(px!.length).toBe(TASK6_W * TASK6_H * 4);
    for (let i = 0; i < px!.length; i += 4) {
      expect([px![i], px![i + 1], px![i + 2], px![i + 3]]).toEqual([255, 0, 0, 255]);
    }
  });

  it('out-of-bounds pushes one INVALID_VALUE and returns null', () => {
    // Arrange
    const rec = makeRecording();
    const ctx = task6LinkedCtx(rec);
    const before = ctx.readPixels(0, 0, TASK6_W, TASK6_H, TASK6_RGBA, TASK6_UNSIGNED_BYTE);
    // Act
    const oob = ctx.readPixels(TASK6_W - 2, 0, 4, 4, TASK6_RGBA, TASK6_UNSIGNED_BYTE);
    const first = ctx.getError();
    const second = ctx.getError();
    const after = ctx.readPixels(0, 0, TASK6_W, TASK6_H, TASK6_RGBA, TASK6_UNSIGNED_BYTE);
    // Assert
    expect(oob).toBeNull();
    expect(first).toBe(TASK6_INVALID_VALUE);
    expect(second).toBe(TASK6_NO_ERROR);
    expect(Array.from(after!)).toEqual(Array.from(before!));
    // Act (unsupported format pair rejected before touching the framebuffer)
    const badFormat = ctx.readPixels(0, 0, 2, 2, TASK6_RGB, TASK6_UNSIGNED_BYTE);
    const fmtErr = ctx.getError();
    const fmtDrain = ctx.getError();
    // Assert
    expect(badFormat).toBeNull();
    expect(fmtErr).toBe(TASK6_INVALID_ENUM);
    expect(fmtDrain).toBe(TASK6_NO_ERROR);
  });

  it('presentation agrees byte-for-byte with readPixels', () => {
    // Arrange
    const rec = makeRecording();
    const ctx = task6LinkedCtx(rec);
    // Act (one successful draw presents automatically; no explicit present call)
    ctx.drawArrays(TASK6_TRIANGLES, 0, 3);
    const px = ctx.readPixels(0, 0, TASK6_W, TASK6_H, TASK6_RGBA, TASK6_UNSIGNED_BYTE);
    // Assert
    expect(rec.calls.length).toBe(1);
    expect(rec.calls[0]?.width).toBe(TASK6_W);
    expect(rec.calls[0]?.height).toBe(TASK6_H);
    expect(Array.from(rec.calls[0]?.data ?? [])).toEqual(Array.from(px ?? []));
    void TASK6_COLOR_BIT;
  });
});