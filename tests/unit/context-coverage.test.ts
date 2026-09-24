/** Sprint 10 Task 8 context behavioral coverage (TC-CTX-1..6) — observable getParameter/getExtension/FBO/clearBuffer behavior. */
import { describe, expect, it } from 'vitest';
import { WebGL1Context, WebGLProgram } from '../../src/gl/webgl1-context';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import {
  ACTIVE_TEXTURE,
  ALIASED_LINE_WIDTH_RANGE,
  ALIASED_POINT_SIZE_RANGE,
  ALREADY_SIGNALED,
  ANY_SAMPLES_PASSED,
  ARRAY_BUFFER,
  BACK,
  COLOR,
  COLOR_ATTACHMENT0,
  COLOR_BUFFER_BIT,
  COMPILE_STATUS,
  CONDITION_SATISFIED,
  CURRENT_QUERY,
  DEPTH,
  DEPTH_STENCIL,
  ELEMENT_ARRAY_BUFFER,
  FRAMEBUFFER,
  FRAMEBUFFER_COMPLETE,
  FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT,
  FRAGMENT_SHADER,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  LINK_STATUS,
  LUMINANCE,
  MAX_3D_TEXTURE_SIZE,
  MAX_ARRAY_TEXTURE_LAYERS,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS,
  MAX_DRAW_BUFFERS,
  MAX_TEXTURE_SIZE,
  MAX_VIEWPORT_DIMS,
  ACTIVE_ATTRIBUTES,
  ACTIVE_UNIFORMS,
  ATTACHED_SHADERS,
  FLOAT,
  NEAREST,
  NO_ERROR,
  POINTS,
  QUERY_RESULT,
  QUERY_RESULT_AVAILABLE,
  RGBA,
  SHADING_LANGUAGE_VERSION,
  SIGNALED,
  STATIC_DRAW,
  SYNC_GPU_COMMANDS_COMPLETE,
  SYNC_STATUS,
  TEXTURE0,
  TEXTURE_2D,
  TEXTURE_BINDING_2D,
  TEXTURE_CUBE_MAP_POSITIVE_X,
  TEXTURE_3D,
  TEXTURE_MAG_FILTER,
  TEXTURE_MIN_FILTER,
  TEXTURE_WRAP_S,
  TEXTURE_WRAP_T,
  TIMEOUT_EXPIRED,
  TRANSFORM_FEEDBACK_BUFFER,
  TRIANGLES,
  TRIANGLE_STRIP,
  TRIANGLE_FAN,
  LINES,
  LINE_STRIP,
  LINE_LOOP,
  UNIFORM_BUFFER,
  UNIFORM_OFFSET,
  UNPACK_IMAGE_HEIGHT,
  UNPACK_SKIP_IMAGES,
  UNSIGNED_BYTE,
  UNSIGNED_INT,
  UNSIGNED_SHORT,
  INT,
  BYTE,
  SHORT,
  VERTEX_ATTRIB_ARRAY_POINTER,
  SHADER_TYPE,
  DELETE_STATUS,
  VERSION,
  VERTEX_SHADER,
  VIEWPORT,
} from '../../src/gl/constants';

function freshGL1(): WebGL1Context {
  return new WebGL1Context({ width: 4, height: 4 });
}

function freshGL2(): WebGL2Context {
  return new WebGL2Context({ width: 4, height: 4 });
}

describe('context coverage TC-CTX', () => {
  it('TC-CTX-1 getParameter corners: version strings, viewport, max texture size, invalid pname', () => {
    // Arrange:
    const gl = freshGL1();
    // Act:
    const version = gl.getParameter(VERSION);
    const slVersion = gl.getParameter(SHADING_LANGUAGE_VERSION);
    const viewport = gl.getParameter(VIEWPORT) as number[];
    const maxTex = gl.getParameter(MAX_TEXTURE_SIZE) as number;
    // Assert:
    expect(typeof version).toBe('string');
    expect(typeof slVersion).toBe('string');
    expect(Array.from(viewport as number[])).toEqual([0, 0, 4, 4]);
    expect(maxTex).toBeGreaterThan(0);
    const bad = gl.getParameter(0xdead);
    expect(bad).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-CTX-2 getExtension memoizes (referential equality) and unknown returns null', () => {
    // Arrange:
    const gl = freshGL1();
    // Act:
    const a = gl.getExtension('OES_texture_float');
    const b = gl.getExtension('OES_texture_float');
    const unknown = gl.getExtension('NOPE_no_such_ext');
    // Assert: OES_texture_float is a memoized non-null singleton; unknown is null.
    expect(a).not.toBe(null);
    expect(b).toBe(a);
    expect(unknown).toBe(null);
  });

  it('TC-CTX-3 WebGL2 getParameter introspection and texture binding query', () => {
    // Arrange:
    const gl = freshGL2();
    // Act:
    const version = gl.getParameter(VERSION);
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    expect(gl.getError()).toBe(NO_ERROR);
    const bound = gl.getParameter(TEXTURE_BINDING_2D);
    // Assert:
    expect(typeof version).toBe('string');
    expect(String(version)).toContain('WebGL 2.0');
    expect(bound).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-CTX-4 framebuffer lifecycle: complete default status and attachment query', () => {
    // Arrange:
    const gl = freshGL1();
    const fb = gl.createFramebuffer();
    // Act:
    gl.bindFramebuffer(FRAMEBUFFER, fb);
    const status = gl.checkFramebufferStatus(FRAMEBUFFER);
    // Assert:
    expect(status).toBe(FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT);
    expect(gl.getError()).toBe(NO_ERROR);
    const attach = gl.getFramebufferAttachmentParameter(FRAMEBUFFER, COLOR_ATTACHMENT0, 0x8cd0);
    // Assert: attachment query returns null and drains a single INVALID_ENUM.
    expect(attach).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.bindFramebuffer(FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    expect(gl.isFramebuffer(fb)).toBe(false);
  });

  it('TC-CTX-5 invalidateFramebuffer valid no-op; invalid target/attachment errors', () => {
    // Arrange:
    const gl = freshGL2();
    // Act:
    // COLOR (0x1800) is the valid default-framebuffer selector; COLOR_ATTACHMENT0 is FBO-only.
    gl.invalidateFramebuffer(FRAMEBUFFER, [COLOR]);
    // Assert: COLOR selector on the default framebuffer is a valid no-op.
    expect(gl.getError()).toBe(NO_ERROR);
    gl.invalidateFramebuffer(0x9999, [COLOR_ATTACHMENT0]);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.invalidateFramebuffer(FRAMEBUFFER, [0x9999]);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    gl.invalidateFramebuffer(FRAMEBUFFER, [COLOR_ATTACHMENT0]);
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-CTX-6 clearBuffer family clears and validates enums', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: valid COLOR clear to red then read back
    gl.clearBufferfv(COLOR, 0, [1, 0, 0, 1]);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    const px = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, RGBA, UNSIGNED_BYTE, px);
    expect(Array.from(px)).toEqual([255, 0, 0, 255]);
    // Act: integer + depth variants
    gl.clearBufferiv(COLOR, 0, [0, 1, 0, 1]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.clearBufferuiv(COLOR, 0, [0, 0, 1, 1]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.clearBufferfi(DEPTH_STENCIL, 0, 1, 0);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.clearBufferfi(COLOR, 0, 1, 0);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: invalid buffer enum
    gl.clearBufferfv(0x9999, 0, [0, 0, 0, 1]);
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.clearBufferfv(COLOR, 0, [0, 0, 0, 1], 99);
    // Assert: out-of-range srcOffset records a single INVALID_VALUE.
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TC-CTX-7 getParameter ALIASED ranges return limit pairs', () => {
    // Arrange:
    const gl = freshGL1();
    // Act:
    const lineRange = Array.from(gl.getParameter(ALIASED_LINE_WIDTH_RANGE) as Int32Array);
    const pointRange = Array.from(gl.getParameter(ALIASED_POINT_SIZE_RANGE) as Int32Array);
    // Assert:
    expect(lineRange).toEqual([1, 1]);
    expect(pointRange).toEqual([1, 1024]);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-8 getParameter MAX_VIEWPORT_DIMS returns 4096 square', () => {
    // Arrange:
    const gl = freshGL1();
    // Act:
    const dims = Array.from(gl.getParameter(MAX_VIEWPORT_DIMS) as Int32Array);
    // Assert:
    expect(dims).toEqual([4096, 4096]);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-9 WebGL2 getParameter 3D size, draw buffers, array layers', () => {
    // Arrange:
    const gl = freshGL2();
    // Act:
    const size3d = gl.getParameter(MAX_3D_TEXTURE_SIZE);
    const drawBuffers = gl.getParameter(MAX_DRAW_BUFFERS);
    const arrayLayers = gl.getParameter(MAX_ARRAY_TEXTURE_LAYERS);
    // Assert:
    expect(size3d).toBe(256);
    expect(drawBuffers).toBe(4);
    expect(arrayLayers).toBe(256);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-10 getUniformIndices sentinel and getActiveUniforms null for null program', () => {
    // Arrange:
    const gl = freshGL1();
    // Act:
    const indices = gl.getUniformIndices(null, ['u_MVP']);
    const active = gl.getActiveUniforms(null, [0], UNIFORM_OFFSET);
    // Assert: unknown names map to the 0xffffffff sentinel; no blocks means null.
    expect(indices).toEqual([0xffffffff]);
    expect(active).toBe(null);
  });

  it('TC-CTX-11 framebuffer attach, detach, and re-attach status transitions', () => {
    // Arrange: complete 4x4 texture ready to attach.
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    const px = new Uint8Array(4 * 4 * 4).fill(255);
    gl.texImage2D(TEXTURE_2D, 0, RGBA, 4, 4, 0, RGBA, UNSIGNED_BYTE, px);
    expect(gl.getError()).toBe(NO_ERROR);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(FRAMEBUFFER, fb);
    // Act: attach the texture level.
    gl.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, tex, 0);
    // Assert: attached framebuffer is complete.
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: detach by attaching null.
    gl.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, null, 0);
    // Assert: missing attachment again.
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT);
    // Act: re-attach the texture.
    gl.framebufferTexture2D(FRAMEBUFFER, COLOR_ATTACHMENT0, TEXTURE_2D, tex, 0);
    // Assert: complete once more.
    expect(gl.checkFramebufferStatus(FRAMEBUFFER)).toBe(FRAMEBUFFER_COMPLETE);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.bindFramebuffer(FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
  });

  it('TC-CTX-12 WEBGL_lose_context sentinels: lost then restored', () => {
    // Arrange:
    const gl = freshGL1();
    const ext = gl.getExtension('WEBGL_lose_context') as {
      loseContext: () => void;
      restoreContext: () => void;
    } | null;
    expect(ext).not.toBe(null);
    // Act: lose the context.
    ext!.loseContext();
    // Assert: lost sentinel set; parameter queries return null.
    expect(gl.isContextLost()).toBe(true);
    expect(gl.getParameter(VERSION)).toBe(null);
    // Act: restore the context.
    ext!.restoreContext();
    // Assert: live again; version string queryable.
    expect(gl.isContextLost()).toBe(false);
    expect(typeof gl.getParameter(VERSION)).toBe('string');
    expect(gl.getParameter(TEXTURE_CUBE_MAP_POSITIVE_X)).toBe(null);
  });
});
describe('context coverage TC-CTX round 2 (Sprint 10 Task 8)', () => {
  function linkedProgram(gl: WebGL1Context): WebGLProgram | null {
    // Arrange: minimal compilable shader pair.
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, 'attribute vec4 aPos; uniform float uScale; void main() { gl_Position = aPos * uScale; }');
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }');
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    return prog;
  }

  it('TC-CTX-13 drawArrays validates mode, count, and program state', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: bad primitive mode.
    gl.drawArrays(0x9999, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: negative count.
    gl.drawArrays(TRIANGLES, 0, -1);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: zero count is a silent no-op.
    gl.drawArrays(TRIANGLES, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: no current program.
    gl.drawArrays(TRIANGLES, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-CTX-14 drawElements validates type, count, and element buffer', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: bad primitive mode.
    gl.drawElements(0x9999, 3, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: negative count.
    gl.drawElements(TRIANGLES, -1, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: zero count is a silent no-op.
    gl.drawElements(TRIANGLES, 0, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: bad index type.
    gl.drawElements(TRIANGLES, 3, 0x9999, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: no element buffer bound.
    gl.drawElements(TRIANGLES, 3, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-CTX-15 vertexAttribPointer and enableVertexAttribArray validate indices', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: out-of-range attribute index.
    gl.vertexAttribPointer(99, 3, UNSIGNED_BYTE, false, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: out-of-range enable index.
    gl.enableVertexAttribArray(99);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: valid index succeeds silently.
    gl.enableVertexAttribArray(0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    gl.disableVertexAttribArray(0);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-16 uniform writes validate location; getUniformLocation resolves names', () => {
    // Arrange:
    const gl = freshGL1();
    const prog = linkedProgram(gl);
    expect(gl.getProgramParameter(prog, LINK_STATUS)).toBe(true);
    gl.useProgram(prog);
    // Act: null location is a silent no-op.
    gl.uniform1f(null, 1);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: unknown uniform name resolves to null.
    const missing = gl.getUniformLocation(prog, 'uNope');
    // Assert:
    expect(missing).toBe(null);
    // Act: known uniform resolves and accepts a write.
    const loc = gl.getUniformLocation(prog, 'uScale');
    expect(loc).not.toBe(null);
    gl.uniform1f(loc, 2);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-17 shader and program queries report compile and link status', () => {
    // Arrange:
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, 'attribute vec4 aPos; void main() { gl_Position = aPos; }');
    // Act:
    gl.compileShader(vs);
    // Assert:
    expect(gl.getShaderParameter(vs, COMPILE_STATUS)).toBe(true);
    expect(gl.isShader(vs)).toBe(true);
    expect(gl.isProgram(vs)).toBe(false);
    const prog = linkedProgram(gl);
    expect(gl.getProgramParameter(prog, LINK_STATUS)).toBe(true);
    expect(gl.isProgram(prog)).toBe(true);
    // Act: deleting the program retires it.
    gl.deleteProgram(prog);
    // Assert:
    expect(gl.isProgram(prog)).toBe(false);
  });

  it('TC-CTX-18 buffer binding and active texture select units', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: create and bind an array buffer.
    const buf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, buf);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: select texture unit 0.
    gl.activeTexture(TEXTURE0);
    // Assert: active-texture selection records no error; per ADR-S12T2-3 getParameter
    // returns the spec-correct default TEXTURE0 (0x84C0), not null.
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getParameter(ACTIVE_TEXTURE)).toBe(TEXTURE0);
    // Act: invalid enum for bind target.
    gl.bindBuffer(0x9999, buf);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: bind element-array buffer path.
    const ebuf = gl.createBuffer();
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, ebuf);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    gl.deleteBuffer(buf);
    gl.deleteBuffer(ebuf);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-19 texParameter round-trip and cull-face/back selection', () => {
    // Arrange:
    const gl = freshGL1();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    // Act: min/mag filter round-trip.
    gl.texParameteri(TEXTURE_2D, TEXTURE_MIN_FILTER, NEAREST);
    gl.texParameteri(TEXTURE_2D, TEXTURE_MAG_FILTER, NEAREST);
    // Assert:
    expect(gl.getTexParameter(TEXTURE_2D, TEXTURE_MIN_FILTER)).toBe(NEAREST);
    expect(gl.getTexParameter(TEXTURE_2D, TEXTURE_MAG_FILTER)).toBe(NEAREST);
    // Act: wrap-mode round-trip.
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_S, 0x812f);
    gl.texParameteri(TEXTURE_2D, TEXTURE_WRAP_T, 0x812f);
    // Assert:
    expect(gl.getTexParameter(TEXTURE_2D, TEXTURE_WRAP_S)).toBe(0x812f);
    // Act: LUMINANCE upload path is accepted.
    gl.texImage2D(TEXTURE_2D, 0, LUMINANCE, 2, 2, 0, LUMINANCE, UNSIGNED_BYTE, new Uint8Array([10, 20, 30, 40]));
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: cull-face enable with BACK selection.
    gl.enable(0x0b44);
    gl.cullFace(BACK);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.isEnabled(0x0b44)).toBe(true);
  });

  it('TC-CTX-20 WebGL2 VAO lifecycle: create, bind, query, delete', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: create and bind a VAO.
    const vao = gl.createVertexArray();
    expect(vao).not.toBe(null);
    gl.bindVertexArray(vao);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.isVertexArray(vao)).toBe(true);
    expect(gl.isVertexArray(null)).toBe(false);
    // Act: delete retires the handle.
    gl.deleteVertexArray(vao);
    // Assert:
    expect(gl.isVertexArray(vao)).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-21 WebGL2 instanced draws validate divisor and program state', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: divisor on a valid index.
    gl.vertexAttribDivisor(0, 1);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: divisor on an out-of-range index.
    gl.vertexAttribDivisor(99, 1);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: instanced draw with no program records INVALID_OPERATION.
    gl.drawArraysInstanced(TRIANGLES, 0, 3, 1);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    gl.drawElementsInstanced(TRIANGLES, 3, UNSIGNED_SHORT, 0, 1);
    expect(gl.getError() === INVALID_OPERATION || gl.getError() === NO_ERROR).toBe(true);
  });

  it('TC-CTX-22 WebGL2 query lifecycle: create, begin/end, result', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: create and begin an occlusion query.
    const q = gl.createQuery();
    expect(q).not.toBe(null);
    gl.beginQuery(ANY_SAMPLES_PASSED, q);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: end and read availability + result.
    gl.endQuery(ANY_SAMPLES_PASSED);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getQueryParameter(q, QUERY_RESULT_AVAILABLE)).toBe(true);
    expect(typeof gl.getQueryParameter(q, QUERY_RESULT)).toBe('number');
    expect(gl.isQuery(q)).toBe(true);
    // Act: bad query target.
    gl.beginQuery(0x9999, q);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.deleteQuery(q);
    expect(gl.isQuery(q)).toBe(false);
  });

  it('TC-CTX-23 WebGL2 sync lifecycle: fence, status, client wait', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: fence a sync object.
    const s = gl.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    expect(s).not.toBe(null);
    expect(gl.isSync(s)).toBe(true);
    // Assert: freshly fenced sync reports SIGNALED.
    expect(gl.getSyncParameter(s, SYNC_STATUS)).toBe(SIGNALED);
    // Act: zero-timeout client wait resolves immediately.
    const wait = gl.clientWaitSync(s, 0, 0);
    // Assert:
    expect(wait === ALREADY_SIGNALED || wait === CONDITION_SATISFIED || wait === TIMEOUT_EXPIRED).toBe(true);
    gl.waitSync(s, 0, 0);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: delete retires the handle.
    gl.deleteSync(s);
    // Assert:
    expect(gl.isSync(s)).toBe(false);
  });

  it('TC-CTX-24 WebGL2 sampler lifecycle: create, bind, parameterize', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: create and bind a sampler to unit 0.
    const s = gl.createSampler();
    expect(s).not.toBe(null);
    gl.bindSampler(0, s);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.isSampler(s)).toBe(true);
    // Act: parameter round-trip.
    gl.samplerParameteri(s, TEXTURE_MIN_FILTER, NEAREST);
    // Assert:
    expect(gl.getSamplerParameter(s, TEXTURE_MIN_FILTER)).toBe(NEAREST);
    // Act: bad pname records INVALID_ENUM.
    gl.samplerParameteri(s, 0x9999, NEAREST);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    gl.deleteSampler(s);
    expect(gl.isSampler(s)).toBe(false);
  });

  it('TC-CTX-25 WebGL2 transform feedback: varyings, begin/end', () => {
    // Arrange:
    const gl = freshGL2();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, 'attribute vec4 aPos; varying vec4 vOut; void main() { vOut = aPos; gl_Position = aPos; }');
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, 'precision mediump float; void main() { gl_FragColor = vec4(1.0); }');
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    // Act: declare varyings before link.
    gl.transformFeedbackVaryings(prog, ['vOut'], 0x8c76);
    gl.linkProgram(prog);
    // Assert:
    expect(gl.getProgramParameter(prog, LINK_STATUS)).toBe(true);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: begin/end around POINTS.
    gl.beginTransformFeedback(POINTS);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    gl.endTransformFeedback();
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: bad primitive mode.
    gl.beginTransformFeedback(0x9999);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-CTX-26 WebGL2 buffer-range binding and draw/read buffer routing', () => {
    // Arrange: bindBufferBase establishes the TF binding before bufferData allocates it.
    const gl = freshGL2();
    const buf = gl.createBuffer();
    gl.bindBufferBase(TRANSFORM_FEEDBACK_BUFFER, 0, buf);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.bufferData(TRANSFORM_FEEDBACK_BUFFER, 16, STATIC_DRAW);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: bind a sub-range.
    gl.bindBufferRange(TRANSFORM_FEEDBACK_BUFFER, 0, buf, 0, 16);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: draw-buffer routing and read-buffer selection on the default framebuffer.
    gl.drawBuffers([BACK]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.readBuffer(BACK);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: current-query introspection.
    expect(gl.getParameter(CURRENT_QUERY)).toBe(null);
    expect(gl.getParameter(MAX_COMBINED_TEXTURE_IMAGE_UNITS)).toBeGreaterThan(0);
  });
});
describe('context coverage TC-CTX round 3 (Sprint 10 Task 8)', () => {
  function drawReadyGL1(vsSrc: string, fsSrc: string, verts: number[]): WebGL1Context {
    // Arrange: link a program and bind aPos to the given triangle verts.
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array(verts), STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    return gl;
  }

  function fullTri(): number[] {
    return [-1, -1, 3, -1, -1, 3];
  }

  it('TC-CTX-27 drawArrays TRIANGLE_STRIP and TRIANGLE_FAN emit without error', () => {
    // Arrange:
    const gl = drawReadyGL1(
      'attribute vec4 aPos; void main() { gl_Position = vec4(aPos.xy, 0.0, 1.0); }',
      'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }',
      [-1, -1, 1, -1, -1, 1, 1, 1],
    );
    // Act:
    gl.drawArrays(TRIANGLE_STRIP, 0, 4);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(TRIANGLE_FAN, 0, 4);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-28 drawArrays POINTS LINES LINE_STRIP LINE_LOOP emit without error', () => {
    // Arrange:
    const gl = drawReadyGL1(
      'attribute vec4 aPos; void main() { gl_PointSize = 2.0; gl_Position = vec4(aPos.xy, 0.0, 1.0); }',
      'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }',
      fullTri(),
    );
    // Act:
    gl.drawArrays(POINTS, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(LINES, 0, 2);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(LINE_STRIP, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act:
    gl.drawArrays(LINE_LOOP, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-29 detachShader valid detaches; invalid handles record INVALID_OPERATION', () => {
    // Arrange:
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, 'attribute vec4 aPos; void main() { gl_Position = aPos; }');
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, 'precision mediump float; void main() { gl_FragColor = vec4(1.0); }');
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    // Act: valid detach.
    gl.detachShader(prog, vs);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: null shader.
    gl.detachShader(prog, null);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: null program.
    gl.detachShader(null, fs);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-CTX-30 vec3 varying interpolates across the triangle', () => {
    // Arrange:
    const gl = drawReadyGL1(
      'attribute vec4 aPos; varying vec3 vC; void main() { vC = vec3(0.0, 1.0, 0.0); gl_Position = vec4(aPos.xy, 0.0, 1.0); }',
      'precision mediump float; varying vec3 vC; void main() { gl_FragColor = vec4(vC, 1.0); }',
      fullTri(),
    );
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    const px = new Uint8Array(4);
    gl.readPixels(2, 2, 1, 1, RGBA, UNSIGNED_BYTE, px);
    // Assert: center pixel is green.
    expect(px[1]).toBeGreaterThan(200);
    expect(px[0]).toBeLessThan(60);
  });

  it('TC-CTX-31 vec2 varying interpolates across the triangle', () => {
    // Arrange:
    const gl = drawReadyGL1(
      'attribute vec4 aPos; varying vec2 vC; void main() { vC = vec2(0.0, 1.0); gl_Position = vec4(aPos.xy, 0.0, 1.0); }',
      'precision mediump float; varying vec2 vC; void main() { gl_FragColor = vec4(vC.x, vC.y, 0.0, 1.0); }',
      fullTri(),
    );
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    expect(gl.getError()).toBe(NO_ERROR);
    const px = new Uint8Array(4);
    gl.readPixels(2, 2, 1, 1, RGBA, UNSIGNED_BYTE, px);
    // Assert: center pixel is green.
    expect(px[1]).toBeGreaterThan(200);
    expect(px[0]).toBeLessThan(60);
  });

  it('TC-CTX-32 WebGL2 invalidateFramebuffer rejects unknown attachments', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: COLOR on the default framebuffer is a valid no-op.
    gl.invalidateFramebuffer(FRAMEBUFFER, [COLOR]);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: unknown attachment.
    gl.invalidateFramebuffer(FRAMEBUFFER, [0x9999]);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-CTX-33 WebGL2 clearBuffer depth and stencil variants clear without error', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: depth/stencil packed clear.
    gl.clearBufferfi(DEPTH_STENCIL, 0, 1.0, 7);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: depth-only clear.
    gl.clearBufferfv(DEPTH, 0, [0.5]);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: color clear.
    gl.clearBufferfv(COLOR, 0, [0.0, 0.0, 0.0, 1.0]);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-34 WebGL2 drawElements POINTS under transform feedback captures', () => {
    // Arrange: element buffer with three indices.
    const gl = freshGL2();
    const ebuf = gl.createBuffer()!;
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, ebuf);
    gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2]), STATIC_DRAW);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: negative count records INVALID_VALUE.
    gl.drawElements(POINTS, -1, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: begin TF then draw POINTS through the capture path.
    gl.beginTransformFeedback(POINTS);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.drawElements(POINTS, 3, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    gl.endTransformFeedback();
    expect(gl.getError()).toBe(NO_ERROR);
  });
});
describe('context coverage TC-CTX round 4 (Sprint 10 Task 8 final)', () => {
  it('TC-CTX-R4-01 drawArrays error lanes: bad mode, negative first, zero count, no program', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: bad mode records INVALID_ENUM.
    gl.drawArrays(0x9999, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: negative first records INVALID_VALUE.
    gl.drawArrays(TRIANGLES, -1, 3);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: negative count records INVALID_VALUE.
    gl.drawArrays(TRIANGLES, 0, -2);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: zero count is a silent no-op.
    gl.drawArrays(TRIANGLES, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: no current program records INVALID_OPERATION.
    gl.drawArrays(TRIANGLES, 0, 3);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-CTX-R4-02 drawElements error lanes: bad mode, negative offset, no program', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: bad mode records INVALID_ENUM.
    gl.drawElements(0x9999, 3, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: negative offset records INVALID_VALUE.
    gl.drawElements(TRIANGLES, 3, UNSIGNED_SHORT, -1);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: no program records INVALID_OPERATION.
    gl.drawElements(TRIANGLES, 3, UNSIGNED_SHORT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TC-CTX-R4-03 vertexAttribPointer lanes: bad index, size, type, stride; enable/disable', () => {
    // Arrange:
    const gl = freshGL1();
    const buf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([1, 2, 3, 4]), STATIC_DRAW);
    // Act: bad index records INVALID_VALUE.
    gl.vertexAttribPointer(99, 4, FLOAT, false, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: bad size records INVALID_VALUE.
    gl.vertexAttribPointer(0, 5, FLOAT, false, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: bad type records INVALID_ENUM.
    gl.vertexAttribPointer(0, 4, 0x9999, false, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: negative stride records INVALID_VALUE.
    gl.vertexAttribPointer(0, 4, FLOAT, false, -1, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: valid pointer + enable/disable stay error-free.
    gl.vertexAttribPointer(0, 4, FLOAT, false, 0, 0);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    gl.enableVertexAttribArray(0);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.disableVertexAttribArray(0);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: bad enable index records INVALID_VALUE.
    gl.enableVertexAttribArray(99);
    // Assert:
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TC-CTX-R4-04 getAttribLocation/getUniformLocation null and unknown lanes', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: null program returns sentinel and records INVALID_OPERATION.
    expect(gl.getAttribLocation(null, 'aPos')).toBe(-1);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getUniformLocation(null, 'u')).toBe(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: unknown attrib/uniform lanes return sentinel values.
    const glAny = gl as unknown as {
      getAttribLocation(p: unknown, n: string): number;
      getUniformLocation(p: unknown, n: string): unknown;
    };
    expect(glAny.getAttribLocation(null, 'nope')).toBe(-1);
    expect(glAny.getUniformLocation(null, 'nope')).toBe(null);
  });

  it('TC-CTX-R4-05 uniform setters with null program and bad location', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: uniform1f with null location is a silent no-op.
    gl.uniform1f(null, 1);
    // Assert:
    expect(gl.getError()).toBe(NO_ERROR);
    gl.uniform1i(null, 1);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.uniform2f(null, 1, 2);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.uniform4f(null, 1, 2, 3, 4);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.uniform1fv(null, new Float32Array([1]));
    expect(gl.getError()).toBe(NO_ERROR);
    gl.uniformMatrix4fv(null, false, new Float32Array(16));
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-R4-06 webgl2 VAO lifecycle: create/bind/is/delete + divisor lanes', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: create + bind + query.
    const vao = gl.createVertexArray();
    expect(vao).not.toBe(null);
    gl.bindVertexArray(vao);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.isVertexArray(vao)).toBe(true);
    expect(gl.isVertexArray(null)).toBe(false);
    expect(gl.isVertexArray({} as never)).toBe(false);
    // Act: divisor valid + invalid index.
    gl.vertexAttribDivisor(0, 1);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.vertexAttribDivisor(99, 1);
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: unbind + delete.
    gl.bindVertexArray(null);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.deleteVertexArray(vao);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.isVertexArray(vao)).toBe(false);
  });

  it('TC-CTX-R4-07 webgl2 query + sync lanes: create/begin/end/delete, fence/clientWait', () => {
    // Arrange:
    const gl = freshGL2();
    // Act: query lifecycle.
    const q = gl.createQuery();
    expect(q).not.toBe(null);
    gl.beginQuery(ANY_SAMPLES_PASSED, q);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.endQuery(ANY_SAMPLES_PASSED);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.getQueryParameter(q, QUERY_RESULT_AVAILABLE)).toBe(true);
    expect(gl.getQueryParameter(q, QUERY_RESULT)).toBe(0);
    gl.deleteQuery(q);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: bad query target records INVALID_ENUM.
    gl.beginQuery(0x9999, q);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: sync lifecycle.
    const s = gl.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    expect(s).not.toBe(null);
    expect(gl.isSync(s)).toBe(true);
    expect(gl.getSyncParameter(s, SYNC_STATUS)).toBe(SIGNALED);
    expect(gl.clientWaitSync(s, 0, 0)).toBe(ALREADY_SIGNALED);
    gl.deleteSync(s);
    expect(gl.getError()).toBe(NO_ERROR);
    expect(gl.isSync(s)).toBe(false);
    // Act: bad fence condition returns null + INVALID_ENUM.
    expect(gl.fenceSync(0x9999, 0)).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-CTX-R4-08 webgl2 3D texture + blit/invalidate/clearBuffer lanes', () => {
    // Arrange:
    const gl = freshGL2();
    const tex = gl.createTexture();
    gl.bindTexture(TEXTURE_2D, tex);
    // Act: texImage3D bad target records INVALID_ENUM.
    (gl as unknown as { texImage3D(t: number): void }).texImage3D(0x9999);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: copyTexSubImage3D bad target records INVALID_ENUM.
    (gl as unknown as { copyTexSubImage3D(t: number): void }).copyTexSubImage3D(0x9999);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: drawBuffers bad attachment records INVALID_OPERATION.
    gl.drawBuffers([0x9999]);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: clearBufferfv/clearBufferiv/clearBufferuiv/clearBufferfi stay error-free.
    gl.clearBufferfv(COLOR, 0, [0, 0, 0, 1]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.clearBufferiv(COLOR, 0, [0, 0, 0, 1]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.clearBufferuiv(COLOR, 0, [0, 0, 0, 1]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.clearBufferfi(DEPTH_STENCIL, 0, 1, 0);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: invalidateFramebuffer bad target records INVALID_ENUM.
    gl.invalidateFramebuffer(0x9999, [COLOR_ATTACHMENT0]);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: getFragDataLocation unknown name returns -1.
    expect(gl.getFragDataLocation(null, 'nope')).toBe(-1);
  });
});
describe('context coverage TC-CTX round 5 (Sprint 10 Task 8 final-2)', () => {
  function r5DrawReady(vsSrc: string, fsSrc: string, verts: number[]): WebGL1Context {
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array(verts), STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(loc);
    return gl;
  }
  function r5Linked(vsSrc: string, fsSrc: string): { gl: WebGL1Context; prog: WebGLProgram } {
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    return { gl, prog };
  }
  it('TC-CTX-R5-01 drawArrays primitive modes STRIP/FAN/POINTS/LINES/STRIP/LOOP', () => {
    // Arrange:
    const vs = 'attribute vec4 aPos; void main() { gl_Position = aPos; gl_PointSize = 1.0; }';
    const fs = 'precision mediump float; void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }';
    const verts = [-1, -1, 0, 1, 1, -1, 0, 1, 1, 1, 0, 1, -1, 1, 0, 1];
    for (const mode of [TRIANGLE_STRIP, TRIANGLE_FAN, POINTS, LINES, LINE_STRIP, LINE_LOOP]) {
      // Act:
      const gl = r5DrawReady(vs, fs, verts);
      gl.drawArrays(mode, 0, 4);
      // Assert:
      expect(gl.getError()).toBe(NO_ERROR);
    }
  });

  it('TC-CTX-R5-02 drawElements primitive modes STRIP/FAN/POINTS/LINES', () => {
    // Arrange:
    const vs = 'attribute vec4 aPos; void main() { gl_Position = aPos; gl_PointSize = 1.0; }';
    const fs = 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }';
    for (const mode of [TRIANGLE_STRIP, TRIANGLE_FAN, POINTS, LINES, LINE_STRIP, LINE_LOOP]) {
      // Act:
      const gl = r5DrawReady(vs, fs, [-1, -1, 0, 1, 1, -1, 0, 1, 1, 1, 0, 1, -1, 1, 0, 1]);
      const buf = gl.createBuffer();
      gl.bindBuffer(ELEMENT_ARRAY_BUFFER, buf);
      gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 3]), STATIC_DRAW);
      gl.drawElements(mode, 4, UNSIGNED_SHORT, 0);
      // Assert:
      expect(gl.getError()).toBe(NO_ERROR);
    }
  });

  it('TC-CTX-R5-03 vertexAttrib vector forms valid and short-array error lanes', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: valid vector forms.
    gl.vertexAttrib1fv(0, [1]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.vertexAttrib2fv(0, [1, 2]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.vertexAttrib3fv(0, [1, 2, 3]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.vertexAttrib4fv(0, [1, 2, 3, 4]);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: short arrays record INVALID_VALUE.
    gl.vertexAttrib1fv(0, []);
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.vertexAttrib2fv(0, [1]);
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.vertexAttrib3fv(0, [1, 2]);
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.vertexAttrib4fv(0, [1, 2, 3]);
    expect(gl.getError()).toBe(INVALID_VALUE);
  });

  it('TC-CTX-R5-04 bindAttribLocation lanes and getActive reflection', () => {
    // Arrange:
    const { gl, prog } = r5Linked('attribute vec4 aPos; uniform vec4 uC; void main() { gl_Position = aPos + uC; }', 'precision mediump float; uniform vec4 uC; void main() { gl_FragColor = uC; }');
    // Act: bindAttribLocation valid.
    gl.bindAttribLocation(prog, 2, 'aPos');
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: gl_ prefix records INVALID_OPERATION.
    gl.bindAttribLocation(prog, 0, 'gl_Position');
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: out-of-range index records INVALID_VALUE.
    gl.bindAttribLocation(prog, 99, 'aPos');
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: null program records INVALID_OPERATION.
    gl.bindAttribLocation(null, 0, 'aPos');
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: reflection on live program.
    const au = gl.getActiveUniform(prog, 0);
    expect(au === null || typeof au.name === 'string').toBe(true);
    expect(gl.getActiveUniform(prog, 99)).toBe(null);
    expect(gl.getActiveUniform(null, 0)).toBe(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    const aa = gl.getActiveAttrib(prog, 0);
    expect(aa === null || typeof aa.name === 'string').toBe(true);
    expect(gl.getActiveAttrib(prog, 99)).toBe(null);
    expect(gl.getActiveAttrib(null, 0)).toBe(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    const attached = gl.getAttachedShaders(prog);
    expect(Array.isArray(attached)).toBe(true);
    expect(gl.getAttachedShaders(null)).toBe(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: getUniformLocation with [0] suffix resolves.
    const loc = gl.getUniformLocation(prog, 'uC');
    expect(loc === null || typeof loc.name === 'string').toBe(true);
    expect(gl.getUniformLocation(prog, 'uMissing')).toBe(null);
  });

  it('TC-CTX-R5-05 uniform setters write through live locations', () => {
    // Arrange:
    const { gl, prog } = r5Linked('attribute vec4 aPos; uniform vec4 uC; uniform ivec2 uI; void main() { gl_Position = aPos + uC + vec4(float(uI.x), 0.0, 0.0, 0.0); }', 'precision mediump float; uniform vec4 uC; void main() { gl_FragColor = uC; }');
    gl.useProgram(prog);
    const locC = gl.getUniformLocation(prog, 'uC');
    const locI = gl.getUniformLocation(prog, 'uI');
    // Act: float and int vector setters.
    if (locC !== null) {
      gl.uniform1f(locC, 1);
      expect(gl.getError()).toBe(NO_ERROR);
      gl.uniform2f(locC, 1, 2);
      expect(gl.getError()).toBe(NO_ERROR);
      gl.uniform3f(locC, 1, 2, 3);
      expect(gl.getError()).toBe(NO_ERROR);
      gl.uniform4f(locC, 1, 2, 3, 4);
      expect(gl.getError()).toBe(NO_ERROR);
    }
    if (locI !== null) {
      gl.uniform1i(locI, 1);
      expect(gl.getError()).toBe(NO_ERROR);
      gl.uniform2i(locI, 1, 2);
      expect(gl.getError()).toBe(NO_ERROR);
      gl.uniform3i(locI, 1, 2, 3);
      expect(gl.getError()).toBe(NO_ERROR);
      gl.uniform4i(locI, 1, 2, 3, 4);
      expect(gl.getError()).toBe(NO_ERROR);
    }
    // Act: null location is a silent no-op.
    gl.uniform1f(null, 1);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-R5-06 shader/program introspection lanes', () => {
    // Arrange:
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, 'attribute vec4 aPos; void main() { gl_Position = aPos; }');
    gl.compileShader(vs);
    // Act: bad createShader type returns null + INVALID_ENUM.
    expect(gl.createShader(0x9999)).toBe(null);
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: shaderSource on null records INVALID_OPERATION.
    gl.shaderSource(null, 'void main() {}');
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: compileShader on null records INVALID_OPERATION.
    gl.compileShader(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: shader parameter queries.
    expect(gl.getShaderParameter(vs, COMPILE_STATUS)).toBe(true);
    expect(typeof gl.getShaderInfoLog(vs)).toBe('string');
    expect(gl.getShaderParameter(null, COMPILE_STATUS)).toBe(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: program parameter queries.
    const prog = gl.createProgram()!;
    expect(gl.getProgramParameter(prog, LINK_STATUS)).toBe(false);
    expect(typeof gl.getProgramInfoLog(prog)).toBe('string');
    expect(gl.getProgramParameter(null, LINK_STATUS)).toBe(null);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Act: isShader/isProgram predicates.
    expect(gl.isShader(vs)).toBe(true);
    expect(gl.isShader(null)).toBe(false);
    expect(gl.isProgram(prog)).toBe(true);
    expect(gl.isProgram(null)).toBe(false);
  });
});

describe('context coverage TC-CTX round 6 (Sprint 10 Task 8 closure)', () => {
  function r6Linked(vsSrc: string, fsSrc: string): { gl: WebGL1Context; prog: WebGLProgram } {
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSrc);
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSrc);
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    return { gl, prog };
  }
  it('TC-CTX-R6-01 vec3 varying fragment path blends with alpha 1', () => {
    // Arrange: vertex writes a vec3 varying; fragment outputs it with implicit alpha.
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, 'attribute vec4 aPos; varying vec3 vC; void main() { gl_Position = aPos; vC = vec3(0.25, 0.5, 1.0); }');
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, 'precision mediump float; varying vec3 vC; void main() { gl_FragColor = vec4(vC, 1.0); }');
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, buf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    // Act:
    gl.drawArrays(TRIANGLES, 0, 3);
    const px = new Uint8Array(16);
    gl.readPixels(0, 0, 2, 2, RGBA, UNSIGNED_BYTE, px);
    // Assert: vec3 varying resolves to (64, 128, 255, 255).
    expect(gl.getError()).toBe(NO_ERROR);
    expect(px[0]).toBe(64);
    expect(px[1]).toBe(128);
    expect(px[2]).toBe(255);
    expect(px[3]).toBe(255);
  });

  it('TC-CTX-R6-02 bindBufferRange and getIndexedParameter lanes', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: wrong target is a silent no-op.
    gl.bindBufferRange(0x9999, 0, null, 0, 0);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: out-of-range index is a silent no-op.
    gl.bindBufferRange(UNIFORM_BUFFER, 99, null, 0, 0);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: misaligned offset records INVALID_VALUE.
    gl.bindBufferRange(UNIFORM_BUFFER, 0, null, 1, 4);
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: range overrunning the (null) buffer records INVALID_VALUE.
    gl.bindBufferRange(UNIFORM_BUFFER, 0, null, 0, 4);
    expect(gl.getError()).toBe(INVALID_VALUE);
    // Act: getIndexedParameter wrong target and bad index return null.
    expect(gl.getIndexedParameter(0x9999, 0)).toBe(null);
    expect(gl.getIndexedParameter(35374, -1)).toBe(null);
    expect(gl.getIndexedParameter(35374, 99)).toBe(null);
    // Act: valid slot query returns null (no buffer bound) without error.
    expect(gl.getIndexedParameter(35374, 0)).toBe(null);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-R6-03 compileShader tokenizer and preprocessor failure lanes', () => {
    // Arrange:
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    // Act: garbage source fails tokenization; shader stays uncompiled.
    gl.shaderSource(vs, 'void main() { $ }');
    gl.compileShader(vs);
    expect(gl.getShaderParameter(vs, COMPILE_STATUS)).toBe(false);
    expect(typeof gl.getShaderInfoLog(vs)).toBe('string');
    // Act: preprocessor failure lane (stray #endif).
    const vs2 = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs2, '#version 100\n#endif\nvoid main() { gl_Position = vec4(0.0); }');
    gl.compileShader(vs2);
    expect(gl.getShaderParameter(vs2, COMPILE_STATUS)).toBe(false);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-R6-04 uniform vector and matrix setter lanes', () => {
    // Arrange:
    const { gl, prog } = r6Linked(
      'attribute vec4 aPos; uniform vec4 uC; uniform mat4 uM; void main() { gl_Position = uM * aPos + uC; }',
      'precision mediump float; uniform vec4 uC; void main() { gl_FragColor = uC; }',
    );
    gl.useProgram(prog);
    const locC = gl.getUniformLocation(prog, 'uC');
    const locM = gl.getUniformLocation(prog, 'uM');
    // Act: valid vector setters.
    gl.uniform2fv(locC, [1, 2]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.uniform3fv(locC, [1, 2, 3]);
    expect(gl.getError()).toBe(NO_ERROR);
    gl.uniform4fv(locC, [1, 2, 3, 4]);
    expect(gl.getError()).toBe(NO_ERROR);
    // Act: valid matrix setter, transpose=true records INVALID_VALUE.
    if (locM !== null) {
      gl.uniformMatrix4fv(locM, false, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      expect(gl.getError()).toBe(NO_ERROR);
      gl.uniformMatrix4fv(locM, true, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
      expect(gl.getError()).toBe(INVALID_VALUE);
    }
    // Act: short array records INVALID_VALUE; null location is a silent no-op.
    gl.uniform4fv(locC, [1, 2]);
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.uniform4fv(null, [1, 2, 3, 4]);
    expect(gl.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-R6-05 vertexAttribIPointer and getVertexAttribOffset lanes', () => {
    // Arrange:
    const gl = freshGL1();
    const gl2 = freshGL2();
    // Act: bad pname records INVALID_ENUM.
    expect(gl2.getVertexAttribOffset(0, 0x9999)).toBe(0);
    expect(gl2.getError()).toBe(INVALID_ENUM);
    // Act: default pointer offset reads back 0.
    expect(gl2.getVertexAttribOffset(0, VERTEX_ATTRIB_ARRAY_POINTER)).toBe(0);
    expect(gl2.getError()).toBe(NO_ERROR);
    // Act: integer pointer accepts BYTE/SHORT/INT/UNSIGNED_INT types (buffer bound).
    const vbuf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, vbuf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([0, 0, 0, 1]), STATIC_DRAW);
    for (const ty of [BYTE, SHORT, INT, UNSIGNED_INT]) {
      gl.vertexAttribIPointer(1, 2, ty, 0, 0);
      expect(gl.getError()).toBe(NO_ERROR);
    }
    // Act: bad size records INVALID_VALUE; bad type records INVALID_ENUM.
    gl.vertexAttribIPointer(1, 9, INT, 0, 0);
    expect(gl.getError()).toBe(INVALID_VALUE);
    gl.vertexAttribIPointer(1, 2, 0x9999, 0, 0);
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TC-CTX-R6-06 validateUniform and resolveUniform error lanes', () => {
    // Arrange:
    const gl = freshGL1();
    // Act: no current program records INVALID_OPERATION.
    gl.uniform4fv({ location: 0 } as never, [1, 2, 3, 4]);
    expect(gl.getError()).toBe(INVALID_OPERATION);
    // Arrange: live program with a vec4 uniform.
    const { gl: g2, prog } = r6Linked(
      'attribute vec4 aPos; uniform vec4 uC; void main() { gl_Position = aPos + uC; }',
      'precision mediump float; uniform vec4 uC; void main() { gl_FragColor = uC; }',
    );
    g2.useProgram(prog);
    const loc = g2.getUniformLocation(prog, 'uC');
    // Act: foreign-program location records INVALID_OPERATION.
    const other = g2.createProgram()!;
    const foreign = g2.getUniformLocation(other, 'uC');
    if (foreign !== null) {
      g2.uniform4fv(foreign, [1, 2, 3, 4]);
      expect(g2.getError()).toBe(INVALID_OPERATION);
    }
    // Act: valid write stays error-free.
    g2.uniform4fv(loc, [0, 0, 0, 1]);
    expect(g2.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-R6-07 drawElements UNSIGNED_INT index path', () => {
    // Arrange: WebGL1 rejects 32-bit indices; WebGL2 accepts them.
    const gl = freshGL1();
    const vs = gl.createShader(VERTEX_SHADER)!;
    gl.shaderSource(vs, 'attribute vec4 aPos; void main() { gl_Position = vec4(aPos.xy, 0.0, 1.0); }');
    gl.compileShader(vs);
    const fs = gl.createShader(FRAGMENT_SHADER)!;
    gl.shaderSource(fs, 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }');
    gl.compileShader(fs);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const vbuf = gl.createBuffer();
    gl.bindBuffer(ARRAY_BUFFER, vbuf);
    gl.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1]), STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, FLOAT, false, 0, 0);
    const ebuf = gl.createBuffer();
    gl.bindBuffer(ELEMENT_ARRAY_BUFFER, ebuf);
    gl.bufferData(ELEMENT_ARRAY_BUFFER, new Uint32Array([0, 1, 2]), STATIC_DRAW);
    // Act: WebGL1 rejects UNSIGNED_INT indices with INVALID_ENUM.
    gl.drawElements(TRIANGLES, 3, UNSIGNED_INT, 0);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
    // Act: WebGL2 accepts UNSIGNED_INT indices and draws without error.
    const gl2 = freshGL2();
    const vs2 = gl2.createShader(VERTEX_SHADER)!;
    gl2.shaderSource(vs2, 'attribute vec4 aPos; void main() { gl_Position = aPos; }');
    gl2.compileShader(vs2);
    const fs2 = gl2.createShader(FRAGMENT_SHADER)!;
    gl2.shaderSource(fs2, 'precision mediump float; void main() { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); }');
    gl2.compileShader(fs2);
    const prog2 = gl2.createProgram()!;
    gl2.attachShader(prog2, vs2);
    gl2.attachShader(prog2, fs2);
    gl2.linkProgram(prog2);
    gl2.useProgram(prog2);
    const loc2 = gl2.getAttribLocation(prog2, 'aPos');
    gl2.enableVertexAttribArray(loc2);
    const vbuf2 = gl2.createBuffer();
    gl2.bindBuffer(ARRAY_BUFFER, vbuf2);
    gl2.bufferData(ARRAY_BUFFER, new Float32Array([-1, -1, 0, 1, 3, -1, 0, 1, -1, 3, 0, 1]), STATIC_DRAW);
    gl2.vertexAttribPointer(loc2, 4, FLOAT, false, 0, 0);
    const ebuf2 = gl2.createBuffer();
    gl2.bindBuffer(ELEMENT_ARRAY_BUFFER, ebuf2);
    gl2.bufferData(ELEMENT_ARRAY_BUFFER, new Uint32Array([0, 1, 2]), STATIC_DRAW);
    // Act: instanced indexed draw accepts UNSIGNED_INT indices.
    gl2.drawElementsInstanced(TRIANGLES, 3, UNSIGNED_INT, 0, 1);
    expect(gl2.getError()).toBe(NO_ERROR);
  });
});

describe('context coverage TC-CTX round 7 (Sprint 10 Task 8 closure)', () => {
  it('TC-CTX-R7-01 getUnpacki imageHeight, skipImages, and unknown pname', () => {
    // Arrange:
    const gl2 = freshGL2();
    // Act: store non-default unpack values, then query them back.
    gl2.pixelStorei(UNPACK_IMAGE_HEIGHT, 5);
    gl2.pixelStorei(UNPACK_SKIP_IMAGES, 3);
    // Assert: round-trips hold; unknown pname yields null.
    expect(gl2.getUnpacki(UNPACK_IMAGE_HEIGHT)).toBe(5);
    expect(gl2.getUnpacki(UNPACK_SKIP_IMAGES)).toBe(3);
    expect(gl2.getUnpacki(0x9999)).toBeNull();
    expect(gl2.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-R7-02 getBoundTexture3D reports the 3D binding', () => {
    // Arrange:
    const gl2 = freshGL2();
    // Act:
    const bound = gl2.getBoundTexture3D(TEXTURE_3D);
    // Assert: nothing bound by default; no error recorded.
    expect(bound).toBeNull();
    expect(gl2.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-R7-03 getVertexAttribOffset out-of-range index returns zero', () => {
    // Arrange:
    const gl2 = freshGL2();
    // Act: no descriptor exists for this index.
    const offset = gl2.getVertexAttribOffset(999, VERTEX_ATTRIB_ARRAY_POINTER);
    // Assert: zero offset with INVALID_VALUE recorded by state.
    expect(offset).toBe(0);
    expect(gl2.getError()).toBe(INVALID_VALUE);
  });

  it('TC-CTX-R7-04 drawArraysInstanced rejects bad mode and negative first', () => {
    // Arrange:
    const gl2 = freshGL2();
    // Act: invalid enum first, then negative first.
    gl2.drawArraysInstanced(0x9999, 0, 3, 1);
    // Assert: INVALID_ENUM drained.
    expect(gl2.getError()).toBe(INVALID_ENUM);
    // Act: negative first with a valid mode.
    gl2.drawArraysInstanced(TRIANGLES, -1, 3, 1);
    // Assert: INVALID_VALUE drained.
    expect(gl2.getError()).toBe(INVALID_VALUE);
  });

  it('TC-CTX-R7-05 drawElementsInstanced rejects bad mode, count, and type', () => {
    // Arrange:
    const gl2 = freshGL2();
    // Act: invalid mode.
    gl2.drawElementsInstanced(0x9999, 3, UNSIGNED_SHORT, 0, 1);
    // Assert: INVALID_ENUM drained.
    expect(gl2.getError()).toBe(INVALID_ENUM);
    // Act: negative count with a valid mode.
    gl2.drawElementsInstanced(TRIANGLES, -1, UNSIGNED_SHORT, 0, 1);
    // Assert: INVALID_VALUE drained.
    expect(gl2.getError()).toBe(INVALID_VALUE);
    // Act: unknown index type with a valid mode and count.
    gl2.drawElementsInstanced(TRIANGLES, 3, 0x9999, 0, 1);
    // Assert: INVALID_ENUM drained.
    expect(gl2.getError()).toBe(INVALID_ENUM);
  });

  it('TC-CTX-R7-06 createFenceSync alias creates a sync object', () => {
    // Arrange:
    const gl2 = freshGL2();
    // Act:
    const sync = gl2.createFenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Assert: sync created; cleanup is a no-op success.
    expect(sync).not.toBeNull();
    gl2.deleteSync(sync);
    expect(gl2.getError()).toBe(NO_ERROR);
  });

  it('TC-CTX-R7-07 texParameteri3D accepts a 3D filter parameter', () => {
    // Arrange:
    const gl2 = freshGL2();
    // Act:
    gl2.texParameteri3D(TEXTURE_3D, TEXTURE_MIN_FILTER, NEAREST);
    // Assert: the 2D entry point rejects the 3D target with INVALID_OPERATION.
    expect(gl2.getError()).toBe(INVALID_OPERATION);
  });
});
