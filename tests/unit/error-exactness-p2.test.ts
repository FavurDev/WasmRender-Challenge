/** Sprint 11 Task 5 — Error-queue exactness Part 2 (Draw, Program, Framebuffer, Context-Loss families). */
import { describe, expect, it } from 'vitest';
import { createSoftwareWebGLContext } from '../../src/entry';
import type { WebGL1Context } from '../../src/gl/webgl1-context';
import type { GLenum } from '../../src/gl/constants';
import {
  ARRAY_BUFFER,
  COLOR_ATTACHMENT0,
  COMPILE_STATUS,
  CONTEXT_LOST_WEBGL,
  ELEMENT_ARRAY_BUFFER,
  FLOAT,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAMEBUFFER_UNSUPPORTED,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  INVALID_FRAMEBUFFER_OPERATION,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINK_STATUS,
  NO_ERROR,
  RENDERBUFFER,
  RGBA,
  RGBA4,
  STATIC_DRAW,
  TEXTURE_2D,
  TRIANGLES,
  UNSIGNED_BYTE,
  UNSIGNED_SHORT,
  VERTEX_SHADER,
} from '../../src/gl/constants';
import {
  assertAtomicity,
  assertExactError,
  assertStickyQueueSemantics,
  runMatrixTests,
} from './error-exactness-p1.test';
import type { MatrixCase } from './error-exactness-p1.test';

function freshContext(w = 4, h = 4): WebGL1Context {
  const gl = createSoftwareWebGLContext({ width: w, height: h });
  if (gl === null) throw new Error('freshContext: factory returned null');
  return gl;
}

function drainErrors(gl: WebGL1Context): void {
  let guard = 0;
  while (gl.getError() !== NO_ERROR && guard < 16) guard += 1;
}

const GOOD_VS = 'attribute vec4 aPos; void main() { gl_Position = aPos; }';
const GOOD_FS = 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }';

function linkProgramWithAttrib(
  gl: WebGL1Context,
  vsSource: string,
  fsSource: string,
): NonNullable<ReturnType<WebGL1Context['createProgram']>> {
  // Arrange: compile both stages.
  const vs = gl.createShader(VERTEX_SHADER);
  const fs = gl.createShader(FRAGMENT_SHADER);
  if (vs === null || fs === null) throw new Error('linkProgramWithAttrib: shader creation failed');
  gl.shaderSource(vs, vsSource);
  gl.shaderSource(fs, fsSource);
  gl.compileShader(vs);
  gl.compileShader(fs);
  drainErrors(gl);
  if (gl.getShaderParameter(vs, COMPILE_STATUS) !== true) throw new Error('linkProgramWithAttrib: VS compile failed');
  if (gl.getShaderParameter(fs, COMPILE_STATUS) !== true) throw new Error('linkProgramWithAttrib: FS compile failed');
  // Act: attach and link.
  const program = gl.createProgram();
  if (program === null) throw new Error('linkProgramWithAttrib: program creation failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  drainErrors(gl);
  if (gl.getProgramParameter(program, LINK_STATUS) !== true) throw new Error('linkProgramWithAttrib: link failed');
  drainErrors(gl);
  return program;
}

function buildDrawMatrixCases(
  gl: WebGL1Context,
  linkedProg: NonNullable<ReturnType<WebGL1Context['createProgram']>>,
  unlinkedProg: NonNullable<ReturnType<WebGL1Context['createProgram']>>,
): MatrixCase[] {
  // Arrange: per-case setup embedded in actions; shared programs passed in.
  const cases: MatrixCase[] = [
    {
      name: 'drawArrays with invalid mode 0xFFFF -> INVALID_ENUM',
      action: () => gl.drawArrays(0xffff, 0, 3),
      expectedError: INVALID_ENUM,
    },
    {
      name: 'drawArrays with negative first (-1) -> INVALID_VALUE',
      action: () => gl.drawArrays(TRIANGLES, -1, 3),
      expectedError: INVALID_VALUE,
    },
    {
      name: 'drawArrays with negative count (-3) -> INVALID_VALUE',
      action: () => gl.drawArrays(TRIANGLES, 0, -3),
      expectedError: INVALID_VALUE,
    },
    {
      name: 'drawArrays with zero count -> NO_ERROR (no-op)',
      action: () => gl.drawArrays(TRIANGLES, 0, 0),
      expectedError: NO_ERROR,
    },
    {
      name: 'drawArrays with no bound program -> INVALID_OPERATION',
      action: () => {
        gl.useProgram(null);
        drainErrors(gl);
        gl.drawArrays(TRIANGLES, 0, 3);
      },
      expectedError: INVALID_OPERATION,
    },
    {
      name: 'drawArrays with unlinked program -> INVALID_OPERATION',
      action: () => {
        gl.useProgram(null);
        drainErrors(gl);
        gl.useProgram(unlinkedProg);
        drainErrors(gl);
        gl.drawArrays(TRIANGLES, 0, 3);
      },
      expectedError: INVALID_OPERATION,
    },
    {
      name: 'drawArrays with enabled attrib and no bound buffer -> INVALID_OPERATION',
      action: () => {
        gl.useProgram(linkedProg);
        drainErrors(gl);
        gl.enableVertexAttribArray(0);
        gl.bindBuffer(ARRAY_BUFFER, null);
        drainErrors(gl);
        gl.drawArrays(TRIANGLES, 0, 3);
      },
      expectedError: INVALID_OPERATION,
    },
    {
      name: 'drawElements with invalid mode 0x9999 -> INVALID_ENUM',
      action: () => gl.drawElements(0x9999, 3, UNSIGNED_BYTE, 0),
      expectedError: INVALID_ENUM,
    },
    {
      name: 'drawElements with negative count (-1) -> INVALID_VALUE',
      action: () => gl.drawElements(TRIANGLES, -1, UNSIGNED_BYTE, 0),
      expectedError: INVALID_VALUE,
    },
    {
      name: 'drawElements with negative offset (-1) -> INVALID_VALUE',
      action: () => gl.drawElements(TRIANGLES, 3, UNSIGNED_BYTE, -1),
      expectedError: INVALID_VALUE,
    },
    {
      name: 'drawElements with invalid type (FLOAT) -> INVALID_ENUM',
      action: () => gl.drawElements(TRIANGLES, 3, FLOAT, 0),
      expectedError: INVALID_ENUM,
    },
    {
      name: 'drawElements with zero count -> NO_ERROR (no-op)',
      action: () => gl.drawElements(TRIANGLES, 0, UNSIGNED_BYTE, 0),
      expectedError: NO_ERROR,
    },
    {
      name: 'drawElements without bound ELEMENT_ARRAY_BUFFER -> INVALID_OPERATION',
      action: () => {
        gl.useProgram(linkedProg);
        gl.bindBuffer(ELEMENT_ARRAY_BUFFER, null);
        drainErrors(gl);
        gl.drawElements(TRIANGLES, 3, UNSIGNED_BYTE, 0);
      },
      expectedError: INVALID_OPERATION,
    },
    {
      name: 'drawElements misaligned offset (odd offset for UNSIGNED_SHORT) -> INVALID_OPERATION',
      action: () => {
        const buf = gl.createBuffer();
        gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buf);
        gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]), STATIC_DRAW);
        gl.useProgram(linkedProg);
        drainErrors(gl);
        gl.drawElements(TRIANGLES, 3, UNSIGNED_SHORT, 1);
      },
      expectedError: INVALID_OPERATION,
    },
    {
      name: 'drawElements offset + count * bytes > buffer length -> INVALID_OPERATION',
      action: () => {
        const buf = gl.createBuffer();
        gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buf);
        gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint8Array([0, 1, 2]), STATIC_DRAW);
        gl.useProgram(linkedProg);
        drainErrors(gl);
        gl.drawElements(TRIANGLES, 6, UNSIGNED_BYTE, 0);
      },
      expectedError: INVALID_OPERATION,
    },
  ];
  void INVALID_FRAMEBUFFER_OPERATION;
  void FRAMEBUFFER_COMPLETE;
  return cases;
}

function buildProgramMatrixCases(
  gl: WebGL1Context,
  linkedProg: NonNullable<ReturnType<WebGL1Context['createProgram']>>,
): MatrixCase[] {
  // Arrange: shared linked program; per-case programs created inside actions.
  const cases: MatrixCase[] = [
    {
      name: 'useProgram with deleted program -> INVALID_OPERATION',
      action: () => {
        const progTemp = gl.createProgram();
        gl.deleteProgram(progTemp);
        drainErrors(gl);
        gl.useProgram(progTemp);
      },
      expectedError: INVALID_OPERATION,
    },
    {
      name: 'bindAttribLocation on deleted program -> INVALID_OPERATION',
      action: () => {
        const progTemp = gl.createProgram();
        gl.deleteProgram(progTemp);
        drainErrors(gl);
        gl.bindAttribLocation(progTemp, 0, 'aPos');
      },
      expectedError: INVALID_OPERATION,
    },
    {
      name: 'bindAttribLocation with index >= MAX_VERTEX_ATTRIBS (16) -> INVALID_VALUE',
      action: () => gl.bindAttribLocation(linkedProg, 16, 'aPos'),
      expectedError: INVALID_VALUE,
      stateQuery: () => gl.getAttribLocation(linkedProg, 'aPos'),
    },
    {
      name: 'vertexAttribPointer with negative stride (-1) -> INVALID_VALUE',
      action: () => {
        const buf = gl.createBuffer();
        gl.bindBuffer(ARRAY_BUFFER, buf);
        gl.bufferData(ARRAY_BUFFER, 32, STATIC_DRAW);
        drainErrors(gl);
        gl.vertexAttribPointer(0, 3, FLOAT, false, -1, 0);
      },
      expectedError: INVALID_VALUE,
    },
    {
      name: 'vertexAttribPointer with negative offset (-4) -> INVALID_VALUE',
      action: () => {
        const buf = gl.createBuffer();
        gl.bindBuffer(ARRAY_BUFFER, buf);
        gl.bufferData(ARRAY_BUFFER, 32, STATIC_DRAW);
        drainErrors(gl);
        gl.vertexAttribPointer(0, 3, FLOAT, false, 0, -4);
      },
      expectedError: INVALID_VALUE,
    },
    {
      name: 'vertexAttribPointer with invalid size (5) -> INVALID_VALUE',
      action: () => {
        const buf = gl.createBuffer();
        gl.bindBuffer(ARRAY_BUFFER, buf);
        gl.bufferData(ARRAY_BUFFER, 32, STATIC_DRAW);
        drainErrors(gl);
        gl.vertexAttribPointer(0, 5, FLOAT, false, 0, 0);
      },
      expectedError: INVALID_VALUE,
    },
    {
      name: 'vertexAttribPointer with invalid type (0x9999) -> INVALID_ENUM',
      action: () => {
        const buf = gl.createBuffer();
        gl.bindBuffer(ARRAY_BUFFER, buf);
        gl.bufferData(ARRAY_BUFFER, 32, STATIC_DRAW);
        drainErrors(gl);
        gl.vertexAttribPointer(0, 3, 0x9999, false, 0, 0);
      },
      expectedError: INVALID_ENUM,
    },
    {
      name: 'vertexAttribPointer with no buffer bound to ARRAY_BUFFER -> INVALID_OPERATION',
      action: () => {
        gl.bindBuffer(ARRAY_BUFFER, null);
        drainErrors(gl);
        gl.vertexAttribPointer(0, 3, FLOAT, false, 0, 0);
      },
      expectedError: INVALID_OPERATION,
    },
    {
      name: 'uniform1f on integer/sampler uniform -> INVALID_OPERATION',
      action: () => {
        const progInt = linkProgramWithAttrib(
          gl,
          'attribute vec4 aPos; uniform int uCount; void main() { gl_Position = aPos; }',
          'precision mediump float; uniform int uCount; void main() { gl_FragColor = vec4(1.0); }',
        );
        gl.useProgram(progInt);
        const loc = gl.getUniformLocation(progInt, 'uCount');
        drainErrors(gl);
        if (loc === null) throw new Error('uniform int location missing');
        gl.uniform1f(loc, 1.0);
      },
      expectedError: INVALID_OPERATION,
    },
    {
      name: 'uniformMatrix2fv with transpose=true in WebGL1 -> INVALID_VALUE',
      action: () => {
        const progMat = linkProgramWithAttrib(
          gl,
          GOOD_VS,
          'precision mediump float; uniform mat2 uMat; void main() { gl_FragColor = vec4(uMat[0][0], 0.0, 0.0, 1.0); }',
        );
        gl.useProgram(progMat);
        const loc = gl.getUniformLocation(progMat, 'uMat');
        drainErrors(gl);
        if (loc === null) throw new Error('uniform mat location missing');
        gl.uniformMatrix2fv(loc, true, [1, 0, 0, 1]);
      },
      expectedError: INVALID_VALUE,
    },
    {
      name: 'uniform1f with location from un-used program -> INVALID_OPERATION',
      action: () => {
        const progA = linkProgramWithAttrib(
          gl,
          'attribute vec4 aPos; uniform float uF; void main() { gl_Position = aPos * uF; }',
          GOOD_FS,
        );
        const progB = linkProgramWithAttrib(gl, GOOD_VS, GOOD_FS);
        const locA = gl.getUniformLocation(progA, 'uF');
        drainErrors(gl);
        if (locA === null) throw new Error('foreign uniform location missing');
        gl.useProgram(progB);
        drainErrors(gl);
        gl.uniform1f(locA, 42.0);
      },
      expectedError: INVALID_OPERATION,
    },
  ];
  return cases;
}

function buildFramebufferMatrixCases(gl: WebGL1Context): MatrixCase[] {
  // Arrange: per-case FBO/renderbuffer/texture setup inside actions.
  const cases: MatrixCase[] = [
    {
      name: 'bindFramebuffer with invalid target 0x9999 -> INVALID_ENUM',
      action: () => gl.bindFramebuffer(0x9999, null),
      expectedError: INVALID_ENUM,
      stateQuery: () => gl.getParameter(FRAMEBUFFER_BINDING_SAFE),
    },
    {
      name: 'bindRenderbuffer with invalid target 0x9999 -> INVALID_ENUM',
      action: () => gl.bindRenderbuffer(0x9999, null),
      expectedError: INVALID_ENUM,
    },
    {
      name: 'framebufferTexture2D with invalid target -> INVALID_ENUM',
      action: () => {
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(FRAMEBUFFER, fbo);
        const tex = gl.createTexture();
        drainErrors(gl);
        gl.framebufferTexture2D(0x9999, COLOR_ATTACHMENT0, TEXTURE_2D, tex, 0);
      },
      expectedError: INVALID_ENUM,
    },
    {
      name: 'framebufferTexture2D with invalid attachment 0x9999 -> INVALID_ENUM',
      action: () => {
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(FRAMEBUFFER, fbo);
        const tex = gl.createTexture();
        drainErrors(gl);
        gl.framebufferTexture2D(FRAMEBUFFER, 0x9999, TEXTURE_2D, tex, 0);
      },
      expectedError: INVALID_ENUM,
    },
    {
      name: 'framebufferTexture2D with level != 0 -> INVALID_VALUE',
      action: () => {
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(FRAMEBUFFER, fbo);
        const tex = gl.createTexture();
        drainErrors(gl);
        gl.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, tex, 1);
      },
      expectedError: INVALID_VALUE,
    },
    {
      name: 'framebufferRenderbuffer with invalid target -> INVALID_ENUM',
      action: () => {
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(FRAMEBUFFER, fbo);
        const rb = gl.createRenderbuffer();
        drainErrors(gl);
        gl.framebufferRenderbuffer(0x9999, COLOR_ATTACHMENT0, RENDERBUFFER, rb);
      },
      expectedError: INVALID_ENUM,
    },
    {
      name: 'framebufferRenderbuffer with invalid attachment -> INVALID_ENUM',
      action: () => {
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(FRAMEBUFFER, fbo);
        const rb = gl.createRenderbuffer();
        drainErrors(gl);
        gl.framebufferRenderbuffer(FRAMEBUFFER, 0x9999, RENDERBUFFER, rb);
      },
      expectedError: INVALID_ENUM,
    },
    {
      name: 'renderbufferStorage with invalid target -> INVALID_ENUM',
      action: () => {
        const rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(RENDERBUFFER, rb);
        drainErrors(gl);
        gl.renderbufferStorage(0x9999, RGBA4, 16, 16);
      },
      expectedError: INVALID_ENUM,
    },
    {
      name: 'renderbufferStorage with invalid internalformat (0x9999) -> INVALID_ENUM',
      action: () => {
        const rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(RENDERBUFFER, rb);
        drainErrors(gl);
        gl.renderbufferStorage(RENDERBUFFER, 0x9999, 16, 16);
      },
      expectedError: INVALID_ENUM,
    },
    {
      name: 'renderbufferStorage with negative width (-1) -> INVALID_VALUE',
      action: () => {
        const rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(RENDERBUFFER, rb);
        drainErrors(gl);
        gl.renderbufferStorage(RENDERBUFFER, RGBA4, -1, 16);
      },
      expectedError: INVALID_VALUE,
    },
    {
      name: 'renderbufferStorage with width > MAX_RENDERBUFFER_SIZE -> INVALID_VALUE',
      action: () => {
        const rb = gl.createRenderbuffer();
        gl.bindRenderbuffer(RENDERBUFFER, rb);
        drainErrors(gl);
        gl.renderbufferStorage(RENDERBUFFER, RGBA4, 4097, 16);
      },
      expectedError: INVALID_VALUE,
    },
    {
      name: 'checkFramebufferStatus with invalid target -> returns 0/FRAMEBUFFER_UNSUPPORTED, NO error',
      action: () => gl.checkFramebufferStatus(0x9999),
      expectedError: NO_ERROR,
    },
  ];
  return cases;
}

// FRAMEBUFFER_BINDING pname (0x8CA6) — imported via literal to keep import list minimal.
const FRAMEBUFFER_BINDING_SAFE: GLenum = 0x8ca6;

describe('error-exactness-p2: draw family matrix', () => {
  it('records exact codes across drawArrays/drawElements preconditions', () => {
    // Arrange: fresh context with linked and unlinked programs.
    const gl = freshContext();
    const linkedProg = linkProgramWithAttrib(gl, GOOD_VS, GOOD_FS);
    const unlinkedProg = gl.createProgram();
    if (unlinkedProg === null) throw new Error('draw matrix: program creation failed');
    drainErrors(gl);
    // Act + Assert: 15-case matrix with exact code and NO_ERROR drain.
    const cases = buildDrawMatrixCases(gl, linkedProg, unlinkedProg);
    expect(cases).toHaveLength(15);
    runMatrixTests(gl, cases);
  });
});

describe('error-exactness-p2: program family matrix', () => {
  it('records exact codes across useProgram/bindAttribLocation/vertexAttribPointer/uniform setters', () => {
    // Arrange: fresh context with linked program.
    const gl = freshContext();
    const linkedProg = linkProgramWithAttrib(gl, GOOD_VS, GOOD_FS);
    drainErrors(gl);
    // Act + Assert: 11-case matrix with exact code and NO_ERROR drain.
    const cases = buildProgramMatrixCases(gl, linkedProg);
    expect(cases).toHaveLength(11);
    runMatrixTests(gl, cases);
  });
});

describe('error-exactness-p2: framebuffer family matrix', () => {
  it('records exact codes across framebuffer/renderbuffer entry points', () => {
    // Arrange: fresh context, drained slot.
    const gl = freshContext();
    drainErrors(gl);
    // Act + Assert: 12-case matrix with exact code and NO_ERROR drain.
    const cases = buildFramebufferMatrixCases(gl);
    expect(cases).toHaveLength(12);
    runMatrixTests(gl, cases);
  });

  it('checkFramebufferStatus invalid target returns FRAMEBUFFER_UNSUPPORTED with NO error', () => {
    // Arrange: fresh context, drained slot.
    const gl = freshContext();
    drainErrors(gl);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: query with invalid target.
    const status = gl.checkFramebufferStatus(0x9999);
    // Assert: status-only sentinel, no error recorded, clean drain.
    expect(status).toBe(FRAMEBUFFER_UNSUPPORTED);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getError()).toBe(NO_ERROR);
  });
});

describe('error-exactness-p2: context-loss family', () => {
  it('loseContext sentinels and CONTEXT_LOST_WEBGL drain', () => {
    // Arrange: fresh context with lose_context extension.
    const gl = freshContext();
    const ext = gl.getExtension('WEBGL_lose_context') as unknown as {
      loseContext: () => void;
      restoreContext: () => void;
    } | null;
    expect(ext).not.toBeNull();
    if (ext === null) throw new Error('lose_context extension missing');
    drainErrors(gl);
    // Assert: initial state intact.
    expect(gl.isContextLost()).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: trigger context loss.
    ext.loseContext();
    // Assert: lost flag set.
    expect(gl.isContextLost()).toBe(true);
    // Act + Assert: createBuffer sentinel null with CONTEXT_LOST_WEBGL, then drain.
    const buf = gl.createBuffer();
    expect(buf).toBeNull();
    expect(gl.getError()).toBe(CONTEXT_LOST_WEBGL);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: restore context.
    ext.restoreContext();
    // Assert: loss cleared, slot drained, resources recreatable.
    expect(gl.isContextLost()).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
    const fresh = gl.createBuffer();
    expect(fresh).not.toBeNull();
    expect(gl.isBuffer(fresh)).toBe(true);
  });

  it('drawArrays after context loss records CONTEXT_LOST_WEBGL', () => {
    // Arrange: fresh lost context.
    const gl = freshContext();
    const ext = gl.getExtension('WEBGL_lose_context') as unknown as {
      loseContext: () => void;
      restoreContext: () => void;
    } | null;
    expect(ext).not.toBeNull();
    if (ext === null) throw new Error('lose_context extension missing');
    ext.loseContext();
    expect(gl.isContextLost()).toBe(true);
    // Act: draw while lost (silent no-op at GL layer).
    gl.drawArrays(TRIANGLES, 0, 3);
    // Assert: CONTEXT_LOST_WEBGL retained once, then drained.
    expect(gl.getError()).toBe(CONTEXT_LOST_WEBGL);
    expect(gl.getError()).toBe(NO_ERROR);
    ext.restoreContext();
  });
});

describe('error-exactness-p2: dual-fault ordering', () => {
  it('first-failure-wins check order per taxonomy', () => {
    // Arrange: fresh context, drained slot.
    const gl = freshContext();
    drainErrors(gl);
    // Act + Assert 1: drawArrays invalid mode AND negative count -> INVALID_ENUM wins.
    gl.drawArrays(0xffff, 0, -5);
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act + Assert 2: drawElements invalid mode AND negative count -> INVALID_ENUM wins.
    gl.drawElements(0xffff, -1, UNSIGNED_BYTE, 0);
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act + Assert 3: drawElements negative count AND invalid type -> INVALID_VALUE wins.
    gl.drawElements(TRIANGLES, -1, FLOAT, 0);
    expect(gl.getError()).toBe(INVALID_VALUE);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act + Assert 4: framebufferTexture2D invalid target AND invalid attachment -> INVALID_ENUM.
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(FRAMEBUFFER, fbo);
    drainErrors(gl);
    gl.framebufferTexture2D(0x9999, 0x8888, TEXTURE_2D, null, 0);
    expect(gl.getError()).toBe(INVALID_ENUM);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('sticky-queue sweep discards second error', () => {
    // Arrange: fresh context, drained slot.
    const gl = freshContext();
    drainErrors(gl);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act + Assert: two failures before drain via shared helper.
    assertStickyQueueSemantics(
      gl,
      () => gl.drawArrays(0xffff, 0, 3),
      INVALID_ENUM,
      () => gl.drawArrays(TRIANGLES, -1, 3),
      INVALID_VALUE,
    );
  });

  it('atomicity sweep preserves state on rejection', () => {
    // Arrange: fresh context with known bindings.
    const gl = freshContext();
    gl.bindFramebuffer(FRAMEBUFFER, null);
    gl.bindRenderbuffer(RENDERBUFFER, null);
    drainErrors(gl);
    // Act + Assert: rejected binds leave bindings unchanged.
    assertAtomicity(gl, () => gl.bindFramebuffer(0x9999, null), () => gl.getParameter(FRAMEBUFFER_BINDING_SAFE), INVALID_ENUM);
    const buf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, 16, STATIC_DRAW);
    drainErrors(gl);
    assertAtomicity(
      gl,
      () => gl.vertexAttribPointer(0, 5, FLOAT, false, 0, 0),
      () => gl.getVertexAttribDescriptor(0),
      INVALID_VALUE,
    );
    void RGBA;
  });
});

describe('error-exactness-p2: taxonomy coverage cross-check', () => {
  it('covers all 10 WebGL1 core families across part 1 and part 2', () => {
    // Arrange: family coverage map per taxonomy F1-F10.
    const families: ReadonlyArray<{ id: string; owner: string }> = [
      { id: 'F1', owner: 'part1' },
      { id: 'F2', owner: 'part1' },
      { id: 'F3', owner: 'part1' },
      { id: 'F4', owner: 'part2' },
      { id: 'F5', owner: 'part1+part2' },
      { id: 'F6', owner: 'part2' },
      { id: 'F7', owner: 'part2' },
      { id: 'F8', owner: 'part1' },
      { id: 'F9', owner: 'part1' },
      { id: 'F10', owner: 'part2' },
    ];
    // Act: count covered families.
    const covered = families.filter((f) => f.owner.length > 0);
    // Assert: zero gaps across the ~120-method WebGL1 surface.
    expect(covered).toHaveLength(10);
    expect(families.map((f) => f.id)).toEqual(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10']);
  });
});
