/**
 * @fileoverview TDD red-phase reproduction: dual-attachment distinct outputs (AC-6).
 * Headless Node vitest, deterministic constants only. No GUI, no Playwright.
 * Both cases FAIL until per-plane fragment routing is remediated:
 * plane 1 repeats the base red [255,0,0,255] instead of the complement cyan.
 */
import { describe, expect, it } from "vitest";
import { createSoftwareWebGLContext } from "../../src/renderer/context";
import {
  ARRAY_BUFFER,
  COLOR_ATTACHMENT0,
  FLOAT,
  FRAGMENT_SHADER,
  LINK_STATUS,
  NO_ERROR,
  STATIC_DRAW,
  TRIANGLES,
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

const VERT = ["attribute vec3 p;", "void main(){ gl_Position = vec4(p, 1.0); }"].join("\n");

const FRAG = ["void main(){ gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }"].join("\n");

/** Arrange helper: red fullscreen-triangle program drawn under a dual config. */
function drawRedDual(useInstanced: boolean): Gl {
  // Arrange
  const gl = createSoftwareWebGLContext(canvasDouble(64, 64) as never)!;
  gl.drawBuffers([COLOR_ATTACHMENT0, COLOR_ATTACHMENT0 + 1]);
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
    new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]),
    STATIC_DRAW,
  );
  const locP = gl.getAttribLocation(prog, "p");
  gl.vertexAttribPointer(locP, 3, FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(locP);
  // Act
  const raw = gl as unknown as {
    drawArrays(m: number, f: number, c: number): void;
    drawArraysInstanced(m: number, f: number, c: number, n: number): void;
  };
  if (useInstanced) raw.drawArraysInstanced(TRIANGLES, 0, 3, 1);
  else raw.drawArrays(TRIANGLES, 0, 3);
  return gl;
}

describe("dual-attachment distinct outputs red phase (AC-6)", () => {
  it("T4 unit path: plane0 red, plane1 complement cyan", () => {
    // Arrange + Act
    const gl = drawRedDual(false);
    const plane0 = Array.from(gl.readAttachment(16, 16, 1, 1, 0)!);
    const plane1 = Array.from(gl.readAttachment(16, 16, 1, 1, 1)!);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(plane0).toEqual([255, 0, 0, 255]);
    expect(plane1).toEqual([0, 255, 255, 255]);
    expect(plane0).not.toEqual(plane1);
  });

  it("C32 conformance path: plane0 red, plane1 complement cyan", () => {
    // Arrange + Act
    const gl = drawRedDual(true);
    const plane0 = Array.from(gl.readAttachment(16, 16, 1, 1, 0)!);
    const plane1 = Array.from(gl.readAttachment(16, 16, 1, 1, 1)!);
    // Assert
    expect(gl.getError()).toBe(NO_ERROR);
    expect(plane0).toEqual([255, 0, 0, 255]);
    expect(plane1).toEqual([0, 255, 255, 255]);
    expect(plane0).not.toEqual(plane1);
  });
});
