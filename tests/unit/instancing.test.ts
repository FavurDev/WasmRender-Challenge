/** Sprint 5 Task 2 instanced draws TDD tests. Headless Node vitest, fresh 64x64 contexts, no GUI. */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/renderer/context';
import {
  ARRAY_BUFFER,
  ELEMENT_ARRAY_BUFFER,
  FLOAT,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  INVALID_VALUE,
  NO_ERROR,
  RGBA,
  STATIC_DRAW,
  TRIANGLES,
  UNSIGNED_BYTE,
  UNSIGNED_SHORT,
  VERTEX_SHADER,
} from '../../src/renderer/gl-constants';

type AnyCtx = {
  createBuffer(): number;
  bindBuffer(t: number, b: number | null): void;
  bufferData(t: number, d: ArrayBufferView | number, u: number): void;
  enableVertexAttribArray(i: number): void;
  vertexAttribPointer(i: number, s: number, t: number, n: boolean, st: number, o: number): void;
  createShader(t: number): number;
  shaderSource(s: number, src: string): void;
  compileShader(s: number): void;
  createProgram(): number;
  attachShader(p: number, s: number): void;
  linkProgram(p: number): void;
  useProgram(p: number | null): void;
  getError(): number;
  clearColor(r: number, g: number, b: number, a: number): void;
  clear(m: number): void;
  readPixels(x: number, y: number, w: number, h: number, f: number, t: number): Uint8Array | null;
  drawArraysInstanced(m: number, f: number, c: number, n: number): void;
  drawElementsInstanced(m: number, c: number, t: number, o: number, n: number): void;
  vertexAttribDivisor(i: number, d: number): void;
};

function fresh(): AnyCtx {
  const canvas = { width: 64, height: 64 };
  const ctx = createSoftwareWebGLContext(canvas as never, {}) as unknown as AnyCtx;
  if (ctx === null) throw new Error('failed to create context');
  return ctx;
}

function drain(ctx: AnyCtx): void {
  while (ctx.getError() !== NO_ERROR) { /* drain */ }
}

function snap(ctx: AnyCtx): Uint8Array {
  const px = ctx.readPixels(0, 0, 64, 64, RGBA, UNSIGNED_BYTE);
  if (px === null) throw new Error('readPixels returned null');
  return px;
}

const VS = 'attribute vec3 p; attribute vec2 off; void main(){ gl_Position = vec4(p.xy + off, 0.0, 1.0); }';
const FS = 'void main(){ gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }';

function setup(ctx: AnyCtx): void {
  // Arrange shared program + buffers
  const pos = new Float32Array([-0.8, -0.8, 0, 0.0, -0.8, 0, -0.4, 0.0, 0]);
  const off = new Float32Array([-0.1, 0, 0.5, 0]);
  const b0 = ctx.createBuffer();
  ctx.bindBuffer(ARRAY_BUFFER, b0);
  ctx.bufferData(ARRAY_BUFFER, pos, STATIC_DRAW);
  ctx.enableVertexAttribArray(0);
  ctx.vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
  const b1 = ctx.createBuffer();
  ctx.bindBuffer(ARRAY_BUFFER, b1);
  ctx.bufferData(ARRAY_BUFFER, off, STATIC_DRAW);
  ctx.enableVertexAttribArray(1);
  ctx.vertexAttribPointer(1, 2, FLOAT, false, 0, 0);
  const vs = ctx.createShader(VERTEX_SHADER);
  ctx.shaderSource(vs, VS);
  ctx.compileShader(vs);
  const fs = ctx.createShader(FRAGMENT_SHADER);
  ctx.shaderSource(fs, FS);
  ctx.compileShader(fs);
  const p = ctx.createProgram();
  ctx.attachShader(p, vs);
  ctx.attachShader(p, fs);
  ctx.linkProgram(p);
  ctx.useProgram(p);
  drain(ctx);
}

describe('instancing (Sprint 5 Task 2 red phase)', () => {
  it('renders two disjoint instances with divisor 1', () => {
    // Arrange
    const ctx = fresh();
    setup(ctx);
    // Act
    ctx.vertexAttribDivisor(1, 1);
    ctx.drawArraysInstanced(TRIANGLES, 0, 3, 2);
    const px = snap(ctx);
    // Assert
    let left = 0;
    let right = 0;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        if (px[i]! > 128) { if (x < 32) left++; else right++; }
      }
    }
    expect(left).toBeGreaterThan(0);
    expect(right).toBeGreaterThan(0);
  });

  it('divisor 1 diverges observably from divisor 0', () => {
    // Arrange
    const a = fresh();
    setup(a);
    const b = fresh();
    setup(b);
    // Act
    a.vertexAttribDivisor(1, 1);
    a.drawArraysInstanced(TRIANGLES, 0, 3, 2);
    const pa = snap(a);
    b.vertexAttribDivisor(1, 0);
    b.drawArraysInstanced(TRIANGLES, 0, 3, 2);
    const pb = snap(b);
    // Assert
    let diff = 0;
    for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) diff++;
    expect(diff).toBeGreaterThan(0);
  });

  it('negative instanceCount pushes single INVALID_VALUE with no pixels; enum checked first', () => {
    // Arrange
    const ctx = fresh();
    setup(ctx);
    const before = snap(ctx);
    // Act: arrays variant
    ctx.drawArraysInstanced(TRIANGLES, 0, 3, -1);
    // Assert
    expect(ctx.getError()).toBe(INVALID_VALUE);
    expect(ctx.getError()).toBe(NO_ERROR);
    const after = snap(ctx);
    expect(Array.from(after)).toEqual(Array.from(before));
    // Act: elements variant
    const idx = new Uint16Array([0, 1, 2]);
    const ib = ctx.createBuffer();
    ctx.bindBuffer(ELEMENT_ARRAY_BUFFER, ib);
    ctx.bufferData(ELEMENT_ARRAY_BUFFER, idx, STATIC_DRAW);
    drain(ctx);
    const before2 = snap(ctx);
    ctx.drawElementsInstanced(TRIANGLES, 3, UNSIGNED_SHORT, 0, -1);
    expect(ctx.getError()).toBe(INVALID_VALUE);
    expect(ctx.getError()).toBe(NO_ERROR);
    const after2 = snap(ctx);
    expect(Array.from(after2)).toEqual(Array.from(before2));
    // Act: enum-order probe
    drain(ctx);
    ctx.drawArraysInstanced(0x9999, 0, 3, -1);
    expect(ctx.getError()).toBe(INVALID_ENUM);
    expect(ctx.getError()).toBe(NO_ERROR);
  });
});
