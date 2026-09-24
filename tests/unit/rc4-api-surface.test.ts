/** Sprint 11 Task 1 RC-4 API surface TDD RED-phase tests — TESTS 1-8 per blueprint. */
import { describe, expect, it } from 'vitest';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import {
  COLOR_BUFFER_BIT,
  DEPTH_BUFFER_BIT,
  FRAGMENT_SHADER,
  INVALID_OPERATION,
  LINK_STATUS,
  NO_ERROR,
  STENCIL_BUFFER_BIT,
  STENCIL_CLEAR_VALUE,
  VERTEX_SHADER,
} from '../../src/gl/constants';

describe('RC-4 TEST 1: instanceof semantics against harness-injected globals', () => {
  it('gl1 instanceof WebGLRenderingContext and gl2 instanceof WebGL2RenderingContext', () => {
    // Arrange:
    const gl1 = new WebGL1Context({ width: 64, height: 64 });
    const gl2 = new WebGL2Context({ width: 64, height: 64 });
    const g = globalThis as any;
    const saved1 = g.WebGLRenderingContext;
    const saved2 = g.WebGL2RenderingContext;
    g.WebGLRenderingContext = function WebGLRenderingContext() {};
    g.WebGL2RenderingContext = function WebGL2RenderingContext() {};
    // Act:
    const r1 = gl1 instanceof (g.WebGLRenderingContext ?? WebGL1Context);
    const r2 = gl2 instanceof (g.WebGL2RenderingContext ?? WebGL2Context);
    g.WebGLRenderingContext = saved1;
    g.WebGL2RenderingContext = saved2;
    // Assert:
    expect(r1).toBe(true);
    expect(r2).toBe(true);
  });
});

describe('RC-4 TEST 2: getShaderSource round-trip fidelity', () => {
  it('returns exact source string byte-for-byte with NO_ERROR', () => {
    // Arrange:
    const gl = new WebGL1Context({ width: 64, height: 64 });
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const src = 'precision mediump float;\nvoid main() { gl_Position = vec4(0.0); }';
    // Act:
    gl.shaderSource(vs, src);
    const retrieved = (gl as any).getShaderSource(vs);
    // Assert:
    expect(retrieved).toBe(src);
    expect(gl.getError()).toBe(gl.NO_ERROR);
  });
});

describe('RC-4 TEST 3: getShaderSource on empty shader', () => {
  it('returns empty string with NO_ERROR before shaderSource', () => {
    // Arrange:
    const gl = new WebGL1Context({ width: 64, height: 64 });
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    // Act:
    const retrieved = (gl as any).getShaderSource(fs);
    // Assert:
    expect(retrieved).toBe('');
    expect(gl.getError()).toBe(gl.NO_ERROR);
  });
});

describe('RC-4 TEST 4: getShaderSource on invalid shader', () => {
  it('returns null and records INVALID_OPERATION', () => {
    // Arrange:
    const gl = new WebGL1Context({ width: 64, height: 64 });
    // Act:
    const r1 = (gl as any).getShaderSource(null);
    const e1 = gl.getError();
    const r2 = (gl as any).getShaderSource({ id: 9999 });
    const e2 = gl.getError();
    // Assert:
    expect(r1).toBeNull();
    expect(e1).toBe(INVALID_OPERATION);
    expect(r2).toBeNull();
    expect(e2).toBe(INVALID_OPERATION);
  });
});

describe('RC-4 TEST 5: drawingBuffer dimensions', () => {
  it('drawingBufferWidth/Height reflect 640x480 canvas', () => {
    // Arrange:
    const gl = new WebGL1Context({ width: 640, height: 480 });
    // Act:
    const w = (gl as any).drawingBufferWidth;
    const h = (gl as any).drawingBufferHeight;
    // Assert:
    expect(w).toBe(640);
    expect(h).toBe(480);
  });
});

describe('RC-4 TEST 6: clearStencil presence and execution', () => {
  it('clearStencil(127) observable via STENCIL_CLEAR_VALUE with NO_ERROR', () => {
    // Arrange:
    const gl = new WebGL1Context({ width: 64, height: 64 });
    // Act:
    (gl as any).clearStencil(127);
    const v = gl.getParameter(STENCIL_CLEAR_VALUE);
    // Assert:
    expect(v).toBe(127);
    expect(gl.getError()).toBe(gl.NO_ERROR);
  });
});

describe('RC-4 TEST 7: missing constants presence', () => {
  it('DEPTH/STENCIL/COLOR_BUFFER_BIT mirrors equal spec values', () => {
    // Arrange:
    const gl1 = new WebGL1Context({ width: 64, height: 64 });
    const gl2 = new WebGL2Context({ width: 64, height: 64 });
    // Act:
    const d = (gl1 as any).DEPTH_BUFFER_BIT;
    const s = (gl1 as any).STENCIL_BUFFER_BIT;
    const c = (gl1 as any).COLOR_BUFFER_BIT;
    const d2 = (gl2 as any).DEPTH_BUFFER_BIT;
    // Assert:
    expect(d).toBe(0x00000100);
    expect(s).toBe(0x00000400);
    expect(c).toBe(0x00004000);
    expect(d2).toBe(0x00000100);
  });
});

describe('RC-4 TEST 8: program-null handling', () => {
  it('useProgram(null) unbinds without error; getProgramParameter(null) returns null + INVALID_OPERATION', () => {
    // Arrange:
    const gl = new WebGL1Context({ width: 64, height: 64 });
    // Act:
    gl.useProgram(null);
    const e1 = gl.getError();
    const r = gl.getProgramParameter(null, LINK_STATUS);
    const e2 = gl.getError();
    // Assert:
    expect(e1).toBe(NO_ERROR);
    expect(r).toBeNull();
    expect(e2).toBe(INVALID_OPERATION);
  });
});

void VERTEX_SHADER;
void FRAGMENT_SHADER;
void DEPTH_BUFFER_BIT;
void STENCIL_BUFFER_BIT;
void COLOR_BUFFER_BIT;
void STENCIL_CLEAR_VALUE;
void LINK_STATUS;
void NO_ERROR;
void INVALID_OPERATION;
