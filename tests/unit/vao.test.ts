/** VAO lifecycle TDD red-phase tests (Sprint 5 Task 3). Headless Node vitest, fresh contexts, no DOM. */
import { describe, expect, it } from 'vitest';
import { GLState } from '../../src/renderer/state';
import { Framebuffer } from '../../src/renderer/framebuffer';
import { SoftwareWebGLContext } from '../../src/renderer/context';
import {
  ARRAY_BUFFER,
  COLOR_BUFFER_BIT,
  FLOAT,
  INVALID_OPERATION,
  NO_ERROR,
  STATIC_DRAW,
  TRIANGLES,
} from '../../src/renderer/gl-constants';

type VaoCtx = SoftwareWebGLContext & {
  createVertexArray(): number;
  bindVertexArray(array: number | null): void;
  deleteVertexArray(array: number | null): void;
  vertexAttribDivisor(index: number, divisor: number): void;
};

function freshCtx(w = 64, h = 64): VaoCtx {
  const state = new GLState(w, h);
  const fb = new Framebuffer(w, h);
  const canvas = { width: w, height: h, getContext: (_k: string) => ({ putImageData: () => undefined }) };
  return new SoftwareWebGLContext(state, fb, canvas as never) as VaoCtx;
}

function drain(ctx: SoftwareWebGLContext): void {
  while (ctx.getError() !== NO_ERROR) { /* drain */ }
}

const GEOM_A = new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0, 0.5, 0]);
const GEOM_B = new Float32Array([-0.9, -0.9, 0, 0.9, -0.9, 0, 0, 0.9, 0]);
const OFFSETS = new Float32Array([-0.1, 0, 0.5, 0]);

const VS = 'attribute vec3 p; void main(){ gl_Position = vec4(p, 1.0); }';
const FS = 'void main(){ gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }';

function useTriangleProgram(ctx: VaoCtx): void {
  const vs = ctx.createShader(0x8b31);
  ctx.shaderSource(vs, VS);
  ctx.compileShader(vs);
  const fs = ctx.createShader(0x8b30);
  ctx.shaderSource(fs, FS);
  ctx.compileShader(fs);
  const p = ctx.createProgram();
  ctx.attachShader(p, vs);
  ctx.attachShader(p, fs);
  ctx.linkProgram(p);
  ctx.useProgram(p);
}

function configGeom(ctx: VaoCtx, data: Float32Array): void {
  const buf = ctx.createBuffer();
  ctx.bindBuffer(ARRAY_BUFFER, buf);
  ctx.bufferData(ARRAY_BUFFER, data, STATIC_DRAW);
  ctx.vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
  ctx.enableVertexAttribArray(0);
}

function clearAndDraw(ctx: VaoCtx): void {
  ctx.clearColor(0, 0, 0, 1);
  ctx.clear(COLOR_BUFFER_BIT);
  ctx.drawArrays(TRIANGLES, 0, 3);
}

function configSlot1(ctx: VaoCtx, data: Float32Array): void {
  const buf = ctx.createBuffer();
  ctx.bindBuffer(ARRAY_BUFFER, buf);
  ctx.bufferData(ARRAY_BUFFER, data, STATIC_DRAW);
  ctx.vertexAttribPointer(1, 2, FLOAT, false, 0, 0);
  ctx.enableVertexAttribArray(1);
}

function clearAndDrawInstanced(ctx: VaoCtx, instances: number): void {
  ctx.clearColor(0, 0, 0, 1);
  ctx.clear(COLOR_BUFFER_BIT);
  (ctx as unknown as { drawArraysInstanced(m: number, f: number, c: number, n: number): void }).drawArraysInstanced(TRIANGLES, 0, 3, instances);
}

function snapshot(ctx: SoftwareWebGLContext, w = 64, h = 64): Uint8Array {
  const px = ctx.readPixels(0, 0, w, h);
  if (!px) throw new Error('readPixels returned null');
  return px;
}

describe('vao lifecycle red phase', () => {
  it('vao bind-isolation render restores A geometry after B configured', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    useTriangleProgram(ctx);
    drain(ctx);
    const a = ctx.createVertexArray();
    const b = ctx.createVertexArray();
    // Act
    ctx.bindVertexArray(a);
    configGeom(ctx, GEOM_A);
    clearAndDraw(ctx);
    const pixelsAOriginal = snapshot(ctx);
    ctx.bindVertexArray(b);
    configGeom(ctx, GEOM_B);
    clearAndDraw(ctx);
    const pixelsB = snapshot(ctx);
    ctx.bindVertexArray(a);
    clearAndDraw(ctx);
    const pixelsARestored = snapshot(ctx);
    // Assert
    expect(Array.from(pixelsARestored)).toEqual(Array.from(pixelsAOriginal));
    expect(Array.from(pixelsB)).not.toEqual(Array.from(pixelsAOriginal));
  });

  it('deleted and never-created bind each push one INVALID_OPERATION with binding unchanged', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    const live = ctx.createVertexArray();
    ctx.bindVertexArray(live);
    configGeom(ctx, GEOM_A);
    ctx.deleteVertexArray(live);
    // Act — deleted handle
    ctx.bindVertexArray(live);
    const first = ctx.getError();
    const second = ctx.getError();
    // Assert — binding unchanged: attribute config still lands in pre-call VAO snapshot
    expect(first).toBe(INVALID_OPERATION);
    expect(second).toBe(NO_ERROR);
    ctx.vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
    const decoded = ctx.decodeAttribute(0, 0);
    expect(decoded).toEqual([GEOM_A[0], GEOM_A[1], GEOM_A[2]]);
    // Act — never-created handle
    ctx.bindVertexArray(9999);
    const third = ctx.getError();
    const fourth = ctx.getError();
    // Assert
    expect(third).toBe(INVALID_OPERATION);
    expect(fourth).toBe(NO_ERROR);
    ctx.vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
    const decoded2 = ctx.decodeAttribute(0, 0);
    expect(decoded2).toEqual([GEOM_A[0], GEOM_A[1], GEOM_A[2]]);
  });

  it('handles are monotonic 1,2,3 then delete 2 create gives 4', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    // Act
    const h1 = ctx.createVertexArray();
    const h2 = ctx.createVertexArray();
    const h3 = ctx.createVertexArray();
    ctx.deleteVertexArray(h2);
    const h4 = ctx.createVertexArray();
    // Assert
    expect([h1, h2, h3]).toEqual([1, 2, 3]);
    expect(h4).toBe(4);
    expect(new Set([h1, h3, h4]).size).toBe(3);
    ctx.bindVertexArray(h2);
    expect(ctx.getError()).toBe(INVALID_OPERATION);
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('default VAO null and 0 share isolated state', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    // Act
    ctx.bindVertexArray(null);
    configGeom(ctx, GEOM_A);
    ctx.bindVertexArray(0);
    const decodedDefault = ctx.decodeAttribute(0, 0);
    const a = ctx.createVertexArray();
    ctx.bindVertexArray(a);
    configGeom(ctx, GEOM_B);
    ctx.bindVertexArray(null);
    const decodedAfter = ctx.decodeAttribute(0, 0);
    const err = ctx.getError();
    // Assert
    expect(decodedDefault).toEqual([GEOM_A[0], GEOM_A[1], GEOM_A[2]]);
    expect(decodedAfter).toEqual([GEOM_A[0], GEOM_A[1], GEOM_A[2]]);
    expect(err).toBe(NO_ERROR);
  });

  it('divisor isolation restores on rebind plus create after rebind captures live A state', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    useTriangleProgram(ctx);
    drain(ctx);
    const a = ctx.createVertexArray();
    const b = ctx.createVertexArray();
    ctx.bindVertexArray(a);
    configGeom(ctx, GEOM_A);
    configSlot1(ctx, OFFSETS);
    ctx.vertexAttribDivisor(1, 0);
    ctx.bindVertexArray(b);
    configGeom(ctx, GEOM_B);
    configSlot1(ctx, OFFSETS);
    ctx.vertexAttribDivisor(1, 1);
    // Act — rebind A and draw 2 instances; divisor 0 must be restored
    ctx.bindVertexArray(a);
    clearAndDrawInstanced(ctx, 2);
    const pixelsARestored = snapshot(ctx);
    const c = ctx.createVertexArray();
    ctx.bindVertexArray(c);
    const decoded = ctx.decodeAttribute(0, 0);
    // Assert — create captured live A state, not a stale mirror
    expect(decoded).toEqual([GEOM_A[0], GEOM_A[1], GEOM_A[2]]);
    // Assert — divisor-0 instanced pixels match a fresh divisor-0 reference
    const ref = freshCtx();
    useTriangleProgram(ref);
    configGeom(ref as VaoCtx, GEOM_A);
    configSlot1(ref as VaoCtx, OFFSETS);
    (ref as unknown as { vertexAttribDivisor(i: number, d: number): void }).vertexAttribDivisor(1, 0);
    clearAndDrawInstanced(ref as VaoCtx, 2);
    const pixelsRef0 = snapshot(ref);
    expect(Array.from(pixelsARestored)).toEqual(Array.from(pixelsRef0));
    // Assert — divisor 1 diverges observably from restored divisor 0
    ctx.bindVertexArray(b);
    clearAndDrawInstanced(ctx, 2);
    const pixelsB = snapshot(ctx);
    expect(Array.from(pixelsB)).not.toEqual(Array.from(pixelsARestored));
    expect(ctx.getError()).toBe(NO_ERROR);
  });

  it('delete of bound VAO unbinds to default with NO_ERROR', () => {
    // Arrange
    const ctx = freshCtx();
    drain(ctx);
    const a = ctx.createVertexArray();
    ctx.bindVertexArray(a);
    configGeom(ctx, GEOM_A);
    // Act
    ctx.deleteVertexArray(a);
    const err = ctx.getError();
    configGeom(ctx, GEOM_B);
    ctx.bindVertexArray(null);
    const decoded = ctx.decodeAttribute(0, 0);
    // Assert
    expect(err).toBe(NO_ERROR);
    expect(decoded).toEqual([GEOM_B[0], GEOM_B[1], GEOM_B[2]]);
  });
});
