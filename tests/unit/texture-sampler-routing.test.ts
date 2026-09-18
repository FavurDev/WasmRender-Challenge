/**
 * @fileoverview TDD red-phase reproduction: textured-quad sampler routing (AC-1).
 * Headless Node vitest, deterministic constants only. No GUI, no Playwright.
 * All 5 cases FAIL until sampler/uniform/varying routing is remediated:
 * quadrants read opaque black [0,0,0,255] instead of palette texels.
 */
import { describe, expect, it } from "vitest";
import { createSoftwareWebGLContext } from "../../src/renderer/context";
import {
  ARRAY_BUFFER,
  CLAMP_TO_EDGE,
  FLOAT,
  FRAGMENT_SHADER,
  LINK_STATUS,
  NEAREST,
  NO_ERROR,
  RGBA,
  STATIC_DRAW,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  TRIANGLES,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
} from "../../src/renderer/gl-constants";

type Gl = NonNullable<ReturnType<typeof createSoftwareWebGLContext>>;

function canvasDouble(w: number, h: number): unknown {
  return {
    width: w,
    height: h,
    getContext: (_kind: string) => ({
      putImageData: (_img: unknown, _x: number, _y: number) => undefined,
    }),
  };
}

const VERT = [
  "attribute vec3 p;",
  "attribute vec2 uv;",
  "varying vec2 vUv;",
  "void main(){ vUv = uv; gl_Position = vec4(p, 1.0); }",
].join("\n");

const FRAG = [
  "uniform sampler2D uTex;",
  "varying vec2 vUv;",
  "void main(){ gl_FragColor = texture2D(uTex, vUv); }",
].join("\n");

/** 2x2 palette: BL red, BR green, TL blue, TR white. */
const PALETTE = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);

/** Arrange helper: fresh 64x64 context with palette texture + sampler quad drawn. */
function drawTexturedQuad(): Gl {
  // Arrange
  const gl = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
  const tex = gl.createTexture();
  gl.bindTexture(TEXTURE_2D, tex);
  gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, RGBA, UNSIGNED_BYTE, PALETTE);
  gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
  gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
  gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, CLAMP_TO_EDGE);
  gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, CLAMP_TO_EDGE);
  const vs = gl.createShader(VERTEX_SHADER);
  gl.shaderSource(vs, VERT);
  gl.compileShader(vs);
  const fs = gl.createShader(FRAGMENT_SHADER);
  gl.shaderSource(fs, FRAG);
  gl.compileShader(fs);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  expect(gl.getProgramParameter(prog, LINK_STATUS)).toBe(true);
  gl.useProgram(prog);
  const b0 = gl.createBuffer();
  gl.bindBuffer(ARRAY_BUFFER, b0);
  gl.bufferData(
    ARRAY_BUFFER,
    new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]),
    STATIC_DRAW,
  );
  const locP = gl.getAttribLocation(prog, "p");
  gl.vertexAttribPointer(locP, 3, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(locP);
  const b1 = gl.createBuffer();
  gl.bindBuffer(ARRAY_BUFFER, b1);
  gl.bufferData(ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), STATIC_DRAW);
  const locUv = gl.getAttribLocation(prog, "uv");
  gl.vertexAttribPointer(locUv, 2, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(locUv);
  gl.uniform1i(gl.getUniformLocation(prog, "uTex"), 0);
  // Act
  (gl as unknown as { drawArrays(m: number, f: number, c: number): void }).drawArrays(TRIANGLES, 0, 6);
  return gl;
}

function px(gl: Gl, x: number, y: number): number[] {
  return Array.from(gl.readPixels(x, y, 1, 1, RGBA, UNSIGNED_BYTE)!);
}

describe("texture sampler routing red phase (AC-1)", () => {
  it("X-1 bottom-left texel reads red", () => {
    // Arrange + Act
    const gl = drawTexturedQuad();
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(px(gl, 16, 16)).toEqual([255, 0, 0, 255]);
  });

  it("X-2 bottom-right texel reads green", () => {
    // Arrange + Act
    const gl = drawTexturedQuad();
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(px(gl, 48, 16)).toEqual([0, 255, 0, 255]);
  });

  it("X-4 top-left texel reads blue", () => {
    // Arrange + Act
    const gl = drawTexturedQuad();
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(px(gl, 16, 48)).toEqual([0, 0, 255, 255]);
  });

  it("X-5 top-right texel reads white", () => {
    // Arrange + Act
    const gl = drawTexturedQuad();
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(px(gl, 48, 48)).toEqual([255, 255, 255, 255]);
  });

  it("C23 conformance quad reads all four palette texels", () => {
    // Arrange + Act
    const gl = drawTexturedQuad();
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(px(gl, 16, 16)).toEqual([255, 0, 0, 255]);
    expect(px(gl, 48, 16)).toEqual([0, 255, 0, 255]);
    expect(px(gl, 16, 48)).toEqual([0, 0, 255, 255]);
    expect(px(gl, 48, 48)).toEqual([255, 255, 255, 255]);
  });
});
