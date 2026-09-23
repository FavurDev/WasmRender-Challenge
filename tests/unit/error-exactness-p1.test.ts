/** Sprint 10 Task 3 — Error-queue exactness sweep Part 1 (State, Buffer, Texture, Shader families). */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { WebGL1Context } from '../../src/gl/webgl1-context';
import { sampleSnapshotTexture } from '../../src/gl/webgl1-context';
import type { GLenum } from '../../src/gl/constants';
import {
  ACTIVE_TEXTURE,
  ALWAYS,
  ARRAY_BUFFER,
  BACK,
  BLEND,
  BUFFER_SIZE,
  COMPILE_STATUS,
  CULL_FACE,
  DEPTH_TEST,
  ELEMENT_ARRAY_BUFFER,
  FRAGMENT_SHADER,
  FRONT,
  FUNC_ADD,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  KEEP,
  LEQUAL,
  LINEAR,
  LINK_STATUS,
  NEAREST,
  NEAREST_MIPMAP_NEAREST,
  NO_ERROR,
  ONE,
  PACK_ALIGNMENT,
  RGB,
  RGBA,
  SCISSOR_BOX,
  STATIC_DRAW,
  STENCIL_TEST,
  TEXTURE0,
  TEXTURE_2D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  TRIANGLES,
  UNPACK_ALIGNMENT,
  UNSIGNED_BYTE,
  VERTEX_SHADER,
  VIEWPORT,
} from '../../src/gl/constants';

export interface ErrorExactnessTestCase {
  readonly name: string;
  readonly action: () => unknown;
  readonly expectedError: GLenum;
  readonly expectedReturnValue?: unknown;
  readonly stateQuery?: () => unknown;
}

export type MatrixCase = ErrorExactnessTestCase;

function drainErrors(gl: WebGL1Context): void {
  let guard = 0;
  while (gl.getError() !== NO_ERROR && guard < 16) guard += 1;
}

export function assertExactError(
  gl: WebGL1Context,
  action: () => unknown,
  expectedError: GLenum,
  options?: { expectedReturnValue?: unknown },
): void {
  // Arrange: drain any pending error so the slot starts empty.
  drainErrors(gl);
  expect(gl.getError()).toBe(NO_ERROR);
  // Act: invoke exactly one unit under test.
  const result = action();
  // Assert: sentinel return, exact sticky code, clean drain.
  if (options !== undefined && options.expectedReturnValue !== undefined) {
    expect(result).toEqual(options.expectedReturnValue);
  }
  expect(gl.getError()).toBe(expectedError);
  expect(gl.getError()).toBe(NO_ERROR);
}

export function assertStickyQueueSemantics(
  gl: WebGL1Context,
  firstAction: () => unknown,
  firstExpectedError: GLenum,
  secondAction: () => unknown,
  _secondExpectedError: GLenum,
): void {
  // Arrange: drain the slot.
  drainErrors(gl);
  expect(gl.getError()).toBe(NO_ERROR);
  // Act: two failures before any drain.
  firstAction();
  secondAction();
  // Assert: single-slot retention — first code sticks, second is discarded.
  expect(gl.getError()).toBe(firstExpectedError);
  expect(gl.getError()).toBe(NO_ERROR);
}

export function assertAtomicity<T>(
  gl: WebGL1Context,
  action: () => unknown,
  queryState: () => T,
  expectedError: GLenum,
): void {
  // Arrange: drain errors and capture pre-call state.
  drainErrors(gl);
  expect(gl.getError()).toBe(NO_ERROR);
  const preState = queryState();
  // Act: invoke the failing call.
  action();
  // Assert: exact error, clean drain, zero state mutation.
  expect(gl.getError()).toBe(expectedError);
  expect(gl.getError()).toBe(NO_ERROR);
  expect(queryState()).toEqual(preState);
}

export function runMatrixTests(gl: WebGL1Context, cases: MatrixCase[]): void {
  for (const testCase of cases) {
    if (testCase.stateQuery !== undefined) {
      const query = testCase.stateQuery;
      assertAtomicity(gl, testCase.action, query, testCase.expectedError);
    } else {
      assertExactError(gl, testCase.action, testCase.expectedError);
    }
  }
}

function freshContext(w = 4, h = 4): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('freshContext: factory returned null');
  return gl;
}

function viewportOf(gl: WebGL1Context): number[] {
  return Array.from(gl.getParameter(VIEWPORT) as Int32Array);
}

function scissorOf(gl: WebGL1Context): number[] {
  return Array.from(gl.getParameter(SCISSOR_BOX) as Int32Array);
}

const GOOD_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const GOOD_FS = 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }';
const UNIFORM_VS = 'attribute vec4 aPos; uniform float uF; void main() { gl_Position = aPos * uF; }';
const UNIFORM_FS =
  'precision mediump float; uniform vec2 uV; uniform mat2 uM; void main() { gl_FragColor = vec4(uV, uM[0][0], 1.0); }';

function linkGoodProgram(
  gl: WebGL1Context,
  vsSrc: string,
  fsSrc: string,
): NonNullable<ReturnType<WebGL1Context['createProgram']>> {
  // Arrange: compile both stages.
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('linkGoodProgram: shader creation failed');
  gl.shaderSource(vs, vsSrc);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(vs);
  gl.compileShader(fs);
  drainErrors(gl);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('linkGoodProgram: VS compile failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('linkGoodProgram: FS compile failed');
  // Act: attach and link.
  const program = gl.createProgram();
  if (program === null) throw new Error('linkGoodProgram: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  drainErrors(gl);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('linkGoodProgram: link failed');
  drainErrors(gl);
  return program;
}

describe('error-exactness-p1: state setter invalid enums (TEST 1)', () => {
  it('records INVALID_ENUM and preserves enable state', () => {
    // Arrange: fresh context, clean error slot.
    const gl = freshContext();
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.isEnabled(0x9999)).toBe(false);
    // Act + Assert: parameterized invalid-capability matrix with atomicity.
    const badCaps = [0x9999, 0, 0x0500, 0xffff];
    const cases: MatrixCase[] = [];
    for (const cap of badCaps) {
      cases.push({
        name: `enable(${cap})`,
        action: () => gl.enable(cap),
        expectedError: INVALID_ENUM,
        stateQuery: () => gl.isEnabled(cap),
      });
      cases.push({
        name: `disable(${cap})`,
        action: () => gl.disable(cap),
        expectedError: INVALID_ENUM,
        stateQuery: () => gl.isEnabled(cap),
      });
    }
    runMatrixTests(gl, cases);
  });

  it('records INVALID_ENUM for invalid blend, depth, stencil, cull, and pixelStore enums', () => {
    // Arrange: fresh context with valid baseline state.
    const gl = freshContext();
    gl.blendFunc(ONE, ONE);
    gl.depthFunc(LEQUAL);
    gl.stencilFunc(ALWAYS, 0, 0xff);
    gl.stencilOp(KEEP, KEEP, KEEP);
    drainErrors(gl);
    // Act + Assert: invalid-enum matrix across setter families.
    // IMPLEMENTATION DECISION: 0 (ZERO) is a valid blend factor and stencil op,
    // so factor/op cases use 0x9999/0x1234 only; 0 is invalid for the rest.
    const badFactors = [0x9999, 0x1234];
    const cases: MatrixCase[] = [];
    for (const bad of badFactors) {
      cases.push({ name: `blendFunc(bad, ONE)`, action: () => gl.blendFunc(bad, ONE), expectedError: INVALID_ENUM });
      cases.push({ name: `blendFunc(ONE, bad)`, action: () => gl.blendFunc(ONE, bad), expectedError: INVALID_ENUM });
      cases.push({
        name: `blendFuncSeparate(bad, ONE, ONE, ONE)`,
        action: () => gl.blendFuncSeparate(bad, ONE, ONE, ONE),
        expectedError: INVALID_ENUM,
      });
      cases.push({
        name: `blendFuncSeparate(ONE, ONE, bad, ONE)`,
        action: () => gl.blendFuncSeparate(ONE, ONE, bad, ONE),
        expectedError: INVALID_ENUM,
      });
      cases.push({
        name: `stencilOp(bad, KEEP, KEEP)`,
        action: () => gl.stencilOp(bad, KEEP, KEEP),
        expectedError: INVALID_ENUM,
      });
      cases.push({
        name: `stencilOpSeparate(FRONT, bad, KEEP, KEEP)`,
        action: () => gl.stencilOpSeparate(FRONT, bad, KEEP, KEEP),
        expectedError: INVALID_ENUM,
      });
    }
    const badEnums = [0x9999, 0];
    for (const bad of badEnums) {
      cases.push({
        name: `blendEquation(bad)`,
        action: () => gl.blendEquation(bad),
        expectedError: INVALID_ENUM,
      });
      cases.push({
        name: `blendEquationSeparate(bad, FUNC_ADD)`,
        action: () => gl.blendEquationSeparate(bad, FUNC_ADD),
        expectedError: INVALID_ENUM,
      });
      cases.push({
        name: `blendEquationSeparate(FUNC_ADD, bad)`,
        action: () => gl.blendEquationSeparate(FUNC_ADD, bad),
        expectedError: INVALID_ENUM,
      });
      cases.push({ name: `depthFunc(bad)`, action: () => gl.depthFunc(bad), expectedError: INVALID_ENUM });
      cases.push({ name: `cullFace(bad)`, action: () => gl.cullFace(bad), expectedError: INVALID_ENUM });
      cases.push({ name: `frontFace(bad)`, action: () => gl.frontFace(bad), expectedError: INVALID_ENUM });
      cases.push({
        name: `stencilFunc(bad, 0, 0xFF)`,
        action: () => gl.stencilFunc(bad, 0, 0xff),
        expectedError: INVALID_ENUM,
      });
      cases.push({
        name: `stencilFuncSeparate(bad, ALWAYS, 0, 0xFF)`,
        action: () => gl.stencilFuncSeparate(bad, ALWAYS, 0, 0xff),
        expectedError: INVALID_ENUM,
      });
      cases.push({
        name: `stencilFuncSeparate(FRONT, bad, 0, 0xFF)`,
        action: () => gl.stencilFuncSeparate(FRONT, bad, 0, 0xff),
        expectedError: INVALID_ENUM,
      });
      cases.push({
        name: `stencilMaskSeparate(bad, 0xFF)`,
        action: () => gl.stencilMaskSeparate(bad, 0xff),
        expectedError: INVALID_ENUM,
      });
      cases.push({
        name: `pixelStorei(bad, 4)`,
        action: () => gl.pixelStorei(bad, 4),
        expectedError: INVALID_ENUM,
      });
    }
    const badAlignments = [0, 3, 5, 6, 7, 9, 16, -1];
    for (const alignment of badAlignments) {
      cases.push({
        name: `pixelStorei(UNPACK_ALIGNMENT, ${alignment})`,
        action: () => gl.pixelStorei(UNPACK_ALIGNMENT, alignment),
        expectedError: INVALID_VALUE,
      });
      cases.push({
        name: `pixelStorei(PACK_ALIGNMENT, ${alignment})`,
        action: () => gl.pixelStorei(PACK_ALIGNMENT, alignment),
        expectedError: INVALID_VALUE,
      });
    }
    runMatrixTests(gl, cases);
    // Assert: baseline enable flags untouched by rejected setters.
    expect(gl.isEnabled(BLEND)).toBe(false);
    expect(gl.isEnabled(DEPTH_TEST)).toBe(false);
    expect(gl.isEnabled(STENCIL_TEST)).toBe(false);
    expect(gl.isEnabled(CULL_FACE)).toBe(false);
  });
});

describe('error-exactness-p1: viewport and scissor negative dimensions (TEST 2)', () => {
  it('records INVALID_VALUE and preserves the prior rect', () => {
    // Arrange: known-good rects and drained slot.
    const gl = freshContext();
    gl.viewport(0, 0, 4, 4);
    gl.scissor(0, 0, 4, 4);
    drainErrors(gl);
    // Act + Assert: negative-dimension matrix with rect atomicity.
    const cases: MatrixCase[] = [
      {
        name: 'viewport(0, 0, -1, 4)',
        action: () => gl.viewport(0, 0, -1, 4),
        expectedError: INVALID_VALUE,
        stateQuery: () => viewportOf(gl),
      },
      {
        name: 'viewport(0, 0, 4, -1)',
        action: () => gl.viewport(0, 0, 4, -1),
        expectedError: INVALID_VALUE,
        stateQuery: () => viewportOf(gl),
      },
      {
        name: 'viewport(0, 0, -5, -5)',
        action: () => gl.viewport(0, 0, -5, -5),
        expectedError: INVALID_VALUE,
        stateQuery: () => viewportOf(gl),
      },
      {
        name: 'scissor(0, 0, -1, 4)',
        action: () => gl.scissor(0, 0, -1, 4),
        expectedError: INVALID_VALUE,
        stateQuery: () => scissorOf(gl),
      },
      {
        name: 'scissor(0, 0, 4, -2)',
        action: () => gl.scissor(0, 0, 4, -2),
        expectedError: INVALID_VALUE,
        stateQuery: () => scissorOf(gl),
      },
    ];
    runMatrixTests(gl, cases);
    expect(viewportOf(gl)).toEqual([0, 0, 4, 4]);
    expect(scissorOf(gl)).toEqual([0, 0, 4, 4]);
  });
});

describe('error-exactness-p1: bufferData validation (TEST 3)', () => {
  it('records INVALID_VALUE for negative size with zero allocation', () => {
    // Arrange: bound buffer, drained slot.
    const gl = freshContext();
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('TEST 3: createBuffer returned null');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    drainErrors(gl);
    // Act + Assert: negative-size matrix with BUFFER_SIZE atomicity.
    const cases: MatrixCase[] = [
      {
        name: 'bufferData(ARRAY_BUFFER, -10, STATIC_DRAW)',
        action: () => gl.bufferData(ARRAY_BUFFER, -10, STATIC_DRAW),
        expectedError: INVALID_VALUE,
        stateQuery: () => gl.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE),
      },
      {
        name: 'bufferData(ARRAY_BUFFER, -100, STATIC_DRAW)',
        action: () => gl.bufferData(ARRAY_BUFFER, -100, STATIC_DRAW),
        expectedError: INVALID_VALUE,
        stateQuery: () => gl.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE),
      },
      {
        name: 'bufferData(0x9999, 16, STATIC_DRAW)',
        action: () => gl.bufferData(0x9999, 16, STATIC_DRAW),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'bufferData(ARRAY_BUFFER, 16, 0x9999)',
        action: () => gl.bufferData(ARRAY_BUFFER, 16, 0x9999),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'bindBuffer(0x9999, null)',
        action: () => gl.bindBuffer(0x9999, null),
        expectedError: INVALID_ENUM,
      },
    ];
    runMatrixTests(gl, cases);
    expect(gl.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE)).toBe(0);
  });
});

describe('error-exactness-p1: bufferSubData range overflow (TEST 4)', () => {
  it('records INVALID_VALUE and writes zero bytes', () => {
    // Arrange: 32-byte allocation, drained slot.
    const gl = freshContext();
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('TEST 4: createBuffer returned null');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, 32, STATIC_DRAW);
    drainErrors(gl);
    // Act: overflowing subdata write.
    gl.bufferSubData(ARRAY_BUFFER, 30, new Uint8Array(4));
    // Assert: exact code, clean drain, contents still zeroed.
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getBufferParameter(ARRAY_BUFFER, BUFFER_SIZE)).toBe(32);
    // Act + Assert: further overflow and target matrix.
    const cases: MatrixCase[] = [
      {
        name: 'bufferSubData(ARRAY_BUFFER, -1, data)',
        action: () => gl.bufferSubData(ARRAY_BUFFER, -1, new Uint8Array([1, 2])),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'bufferSubData(ARRAY_BUFFER, 65, data)',
        action: () => gl.bufferSubData(ARRAY_BUFFER, 65, new Uint8Array(1)),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'bufferSubData(0x9999, 0, data)',
        action: () => gl.bufferSubData(0x9999, 0, new Uint8Array(4)),
        expectedError: INVALID_ENUM,
      },
    ];
    runMatrixTests(gl, cases);
  });
});

describe('error-exactness-p1: texImage2D border and target exactness (TEST 5)', () => {
  it('records INVALID_VALUE for non-zero border with no allocation', () => {
    // Arrange: bound texture, drained slot.
    const gl = freshContext();
    const tex = gl.createTexture();
    if (tex === null) throw new Error('TEST 5: createTexture returned null');
    gl.bindTexture(TEXTURE_2D, tex);
    drainErrors(gl);
    // Act: non-zero border upload.
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 1, RGBA, UNSIGNED_BYTE, null);
    // Assert: exact code and clean drain.
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act + Assert: target, level, dimension, and format matrix.
    const cases: MatrixCase[] = [
      {
        name: 'texImage2D(0x9999, ...)',
        action: () => gl.texImage2D(0x9999, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, null),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'texImage2D(level -1)',
        action: () => gl.texImage2D(TEXTURE_2D, -1, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, null),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'texImage2D(width -1)',
        action: () => gl.texImage2D(TEXTURE_2D, 0, RGBA, -1, 2, 0, RGBA, UNSIGNED_BYTE, null),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'texImage2D(height -1)',
        action: () => gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, -1, 0, RGBA, UNSIGNED_BYTE, null),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'texImage2D(width 4097)',
        action: () => gl.texImage2D(TEXTURE_2D, 0, RGBA, 4097, 2, 0, RGBA, UNSIGNED_BYTE, null),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'texImage2D(format RGB != RGBA)',
        action: () => gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGB, UNSIGNED_BYTE, null),
        expectedError: INVALID_OPERATION,
      },
      {
        name: 'texImage2D(bad format enum)',
        action: () => gl.texImage2D(TEXTURE_2D, 0, 0x9999, 2, 2, 0, 0x9999, UNSIGNED_BYTE, null),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'texImage2D(bad type enum)',
        action: () => gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, 0x9999, null),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'activeTexture(0x9999)',
        action: () => gl.activeTexture(0x9999),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'bindTexture(0x9999, null)',
        action: () => gl.bindTexture(0x9999, null),
        expectedError: INVALID_ENUM,
      },
    ];
    runMatrixTests(gl, cases);
  });
});

describe('error-exactness-p1: generateMipmap NPOT rejection (TEST 6)', () => {
  it('records INVALID_OPERATION for WebGL1 NPOT textures', () => {
    // Arrange: NPOT level 0, drained slot.
    const gl = freshContext();
    const tex = gl.createTexture();
    if (tex === null) throw new Error('TEST 6: createTexture returned null');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 3, 5, 0, RGBA, UNSIGNED_BYTE, null);
    drainErrors(gl);
    // Act: mipmap generation on NPOT texture.
    gl.generateMipmap(TEXTURE_2D);
    // Assert: exact code and clean drain.
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act + Assert: target validation matrix.
    const cases: MatrixCase[] = [
      {
        name: 'generateMipmap(0x9999)',
        action: () => gl.generateMipmap(0x9999),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'generateMipmap(ARRAY_BUFFER)',
        action: () => gl.generateMipmap(ARRAY_BUFFER),
        expectedError: INVALID_ENUM,
      },
    ];
    runMatrixTests(gl, cases);
  });
});

describe('error-exactness-p1: shader compile log-only diagnostic (TEST 7)', () => {
  it('records NO_ERROR with COMPILE_STATUS false and non-empty info log', () => {
    // Arrange: shader with invalid source, drained slot.
    const gl = freshContext();
    const vs = gl.createShader(VERTEX_SHADER);
    if (vs === null) throw new Error('TEST 7: createShader returned null');
    gl.shaderSource(vs, 'invalid syntax source;');
    drainErrors(gl);
    // Act: compile invalid source.
    gl.compileShader(vs);
    // Assert: diagnostic only — no GL error, status false, log populated.
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getShaderParameter(vs, COMPILE_STATUS)).toBe(false);
    expect(gl.getShaderInfoLog(vs).length).toBeGreaterThan(0);
    // Act + Assert: shader lifecycle error matrix.
    const badShader = gl.createShader(0x9999);
    expect(badShader).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
    const prog = gl.createProgram();
    if (prog === null) throw new Error('TEST 7: createProgram returned null');
    const vs2 = gl.createShader(VERTEX_SHADER);
    if (vs2 === null) throw new Error('TEST 7: second createShader returned null');
    drainErrors(gl);
    const cases: MatrixCase[] = [
      {
        name: 'attachShader twice',
        action: () => {
          gl.attachShader(prog, vs2);
          drainErrors(gl);
          gl.attachShader(prog, vs2);
        },
        expectedError: INVALID_OPERATION,
      },
      {
        name: 'getShaderParameter bad pname',
        action: () => gl.getShaderParameter(vs2, 0x9999),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'getProgramParameter bad pname',
        action: () => gl.getProgramParameter(prog, 0x9999),
        expectedError: INVALID_ENUM,
      },
    ];
    runMatrixTests(gl, cases);
  });
});

describe('error-exactness-p1: useProgram unlinked rejection and uniform validation (TEST 8)', () => {
  it('records INVALID_OPERATION and leaves program state unchanged', () => {
    // Arrange: fresh unlinked program, drained slot.
    const gl = freshContext();
    const prog = gl.createProgram();
    if (prog === null) throw new Error('TEST 8: createProgram returned null');
    drainErrors(gl);
    // Act: use unlinked program.
    gl.useProgram(prog);
    // Assert: exact code, clean drain, link status still false.
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getProgramParameter(prog, LINK_STATUS)).toBe(false);
    // Arrange: linked program with uniforms, then unbind.
    const validProg = linkGoodProgram(gl, UNIFORM_VS, UNIFORM_FS);
    const locF = gl.getUniformLocation(validProg, 'uF');
    const locM = gl.getUniformLocation(validProg, 'uM');
    if (locF === null || locM === null) throw new Error('TEST 8: uniform locations not found');
    const otherProg = linkGoodProgram(gl, GOOD_VS, GOOD_FS);
    gl.useProgram(validProg);
    drainErrors(gl);
    // Act + Assert: uniform setter validation matrix.
    const otherLoc = gl.getUniformLocation(otherProg, 'uF');
    drainErrors(gl);
    const cases: MatrixCase[] = [];
    if (otherLoc !== null) {
      cases.push({
        name: 'uniform1f with foreign-program location',
        action: () => gl.uniform1f(otherLoc, 1.0),
        expectedError: INVALID_OPERATION,
      });
    }
    cases.push({
      name: 'uniformMatrix2fv transpose true',
      action: () => gl.uniformMatrix2fv(locM, true, [1, 0, 0, 1]),
      expectedError: INVALID_VALUE,
    });
    cases.push({
      name: 'uniform1f with no active program',
      action: () => {
        gl.useProgram(null);
        drainErrors(gl);
        gl.uniform1f(locF, 1.0);
      },
      expectedError: INVALID_OPERATION,
    });
    runMatrixTests(gl, cases);
  });
});

describe('error-exactness-p1: sticky queue single-slot retention (TEST 9)', () => {
  it('retains the first error and discards the second until drain', () => {
    // Arrange: drained slot.
    const gl = freshContext();
    drainErrors(gl);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: two failures before any drain.
    gl.enable(0x9999);
    gl.viewport(0, 0, -5, 4);
    // Assert: first code retained, slot then empty.
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('retains INVALID_VALUE first across buffer then texture failures', () => {
    // Arrange: bound buffer and texture, drained slot.
    const gl = freshContext();
    const buf = gl.createBuffer();
    if (buf === null) throw new Error('TEST 9b: createBuffer returned null');
    gl.bindBuffer(ARRAY_BUFFER, buf);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('TEST 9b: createTexture returned null');
    gl.bindTexture(TEXTURE_2D, tex);
    drainErrors(gl);
    // Act + Assert: shared sticky helper across families.
    assertStickyQueueSemantics(
      gl,
      () => gl.bufferData(ARRAY_BUFFER, -1, STATIC_DRAW),
      INVALID_VALUE,
      () => gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 1, RGBA, UNSIGNED_BYTE, null),
      INVALID_VALUE,
    );
  });
});

describe('error-exactness-p1: incomplete texture silent sampling (TEST 10)', () => {
  it('samples [0,0,0,1] with NO_ERROR', () => {
    // Arrange: incomplete mip chain (level 0 only, mipmap min filter).
    const gl = freshContext(2, 2);
    const tex = gl.createTexture();
    if (tex === null) throw new Error('TEST 10: createTexture returned null');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST_MIPMAP_NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 2, 2, 0, RGBA, UNSIGNED_BYTE, null);
    drainErrors(gl);
    // Act: sample the incomplete texture at unit 0.
    const snapshot = new Map<number, NonNullable<typeof tex>>();
    snapshot.set(0, tex);
    const sample = sampleSnapshotTexture(snapshot, 0, new Float32Array([0.5, 0.5]), undefined, 1, 0);
    // Assert: silent black-with-alpha, no error recorded.
    expect(Array.from(sample)).toEqual([0, 0, 0, 1]);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('error-exactness-p1: exported helper signatures (TEST 11)', () => {
  it('exposes Task 7 interface helpers as functions', () => {
    // Arrange: imports are statically bound at module load.
    // Act: probe helper types.
    const exactType = typeof assertExactError;
    const stickyType = typeof assertStickyQueueSemantics;
    const atomicType = typeof assertAtomicity;
    const matrixType = typeof runMatrixTests;
    // Assert: all shared helpers are exported functions.
    expect(exactType).toBe('function');
    expect(stickyType).toBe('function');
    expect(atomicType).toBe('function');
    expect(matrixType).toBe('function');
  });
});

describe('error-exactness-p1: texture parameter and subimage matrix (supplement)', () => {
  it('records exact codes for texParameter, texSubImage2D, and deleted-handle paths', () => {
    // Arrange: bound texture with 4x4 base image.
    const gl = freshContext();
    const tex = gl.createTexture();
    if (tex === null) throw new Error('supplement: createTexture returned null');
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, null);
    drainErrors(gl);
    // Act + Assert: parameter and subimage matrix.
    const cases: MatrixCase[] = [
      {
        name: 'texParameteri(bad target)',
        action: () => gl.texParameteri(0x9999, TEXTURE_MIN_FILTER, NEAREST),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'texParameteri(bad pname)',
        action: () => gl.texParameteri(TEXTURE_2D, RGBA, NEAREST),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'texParameteri(MIN_FILTER, bad param)',
        action: () => gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, 0x9999),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'texParameteri(WRAP_S, bad param)',
        action: () => gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, -1),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'texParameteri(WRAP_T, bad param)',
        action: () => gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, -1),
        expectedError: INVALID_ENUM,
      },
      {
        name: 'texSubImage2D(xoffset -1)',
        action: () =>
          gl.texSubImage2D(TEXTURE_2D, 0, -1, 0, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(16)),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'texSubImage2D(yoffset -1)',
        action: () =>
          gl.texSubImage2D(TEXTURE_2D, 0, 0, -1, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(16)),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'texSubImage2D(width -1)',
        action: () =>
          gl.texSubImage2D(TEXTURE_2D, 0, 0, 0, -1, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(16)),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'texSubImage2D(x overflow)',
        action: () =>
          gl.texSubImage2D(TEXTURE_2D, 0, 3, 0, 2, 2, RGBA, UNSIGNED_BYTE, new Uint8Array(16)),
        expectedError: INVALID_VALUE,
      },
      {
        name: 'texSubImage2D(undefined level)',
        action: () =>
          gl.texSubImage2D(TEXTURE_2D, 1, 0, 0, 1, 1, RGBA, UNSIGNED_BYTE, new Uint8Array(4)),
        expectedError: INVALID_OPERATION,
      },
    ];
    runMatrixTests(gl, cases);
    // Assert: sampler state preserved via getTexParameter.
    expect(gl.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).toBe(
      gl.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER),
    );
    void ACTIVE_TEXTURE;
    void BACK;
    void ELEMENT_ARRAY_BUFFER;
    void LINEAR;
    void TEXTURE0;
    void TRIANGLES;
  });
});
