import { describe, expect, it } from "vitest";
import * as C from "../../src/gl/constants";

describe("constants sampled registry values", () => {
  it("error codes match Khronos registry", () => {
    expect(C.NO_ERROR).toBe(0);
    expect(C.INVALID_ENUM).toBe(0x0500);
    expect(C.INVALID_VALUE).toBe(0x0501);
    expect(C.INVALID_OPERATION).toBe(0x0502);
    expect(C.OUT_OF_MEMORY).toBe(0x0505);
    expect(C.INVALID_FRAMEBUFFER_OPERATION).toBe(0x0506);
  });
  it("WebGL-specific 0x9240 range matches", () => {
    expect(C.UNPACK_FLIP_Y_WEBGL).toBe(0x9240);
    expect(C.UNPACK_PREMULTIPLY_ALPHA_WEBGL).toBe(0x9241);
    expect(C.CONTEXT_LOST_WEBGL).toBe(0x9242);
    expect(C.UNPACK_COLORSPACE_CONVERSION_WEBGL).toBe(0x9243);
    expect(C.BROWSER_DEFAULT_WEBGL).toBe(0x9244);
  });
  it("WebGL2 additions match", () => {
    expect(C.UNIFORM_BUFFER).toBe(0x8a11);
    expect(C.SYNC_GPU_COMMANDS_COMPLETE).toBe(0x9117);
    expect(C.TRANSFORM_FEEDBACK).toBe(0x8e22);
    expect(C.TEXTURE_3D).toBe(0x806f);
    expect(C.SAMPLER_BINDING).toBe(0x8919);
    expect(C.VERTEX_ARRAY_BINDING).toBe(0x85b5);
  });
  it("WebGL1 spot values match", () => {
    expect(C.COLOR_BUFFER_BIT).toBe(0x4000);
    expect(C.DEPTH_BUFFER_BIT).toBe(0x0100);
    expect(C.STENCIL_BUFFER_BIT).toBe(0x0400);
    expect(C.TRIANGLES).toBe(0x0004);
    expect(C.BLEND).toBe(0x0be2);
    expect(C.TEXTURE_2D).toBe(0x0de1);
    expect(C.FRAMEBUFFER_COMPLETE).toBe(0x8cd5);
    expect(C.LINK_STATUS).toBe(0x8b82);
  });
});

describe("16 SOW-REQ-016 limits", () => {
  it("returns exact specified values", () => {
    expect(C.LIMIT_MAX_VERTEX_ATTRIBS).toBe(16);
    expect(C.LIMIT_MAX_VERTEX_UNIFORM_VECTORS_WEBGL1).toBe(128);
    expect(C.LIMIT_MAX_VERTEX_UNIFORM_VECTORS_WEBGL2).toBe(256);
    expect(C.LIMIT_MAX_VARYING_VECTORS_WEBGL1).toBe(8);
    expect(C.LIMIT_MAX_VERTEX_OUTPUT_VECTORS).toBe(16);
    expect(C.LIMIT_MAX_FRAGMENT_INPUT_VECTORS).toBe(15);
    expect(C.LIMIT_MAX_TEXTURE_IMAGE_UNITS_WEBGL1).toBe(8);
    expect(C.LIMIT_MAX_TEXTURE_IMAGE_UNITS_WEBGL2).toBe(16);
    expect(C.LIMIT_MAX_COMBINED_TEXTURE_IMAGE_UNITS_WEBGL1).toBe(8);
    expect(C.LIMIT_MAX_COMBINED_TEXTURE_IMAGE_UNITS_WEBGL2).toBe(32);
    expect(C.LIMIT_MAX_FRAGMENT_UNIFORM_VECTORS_WEBGL1).toBe(16);
    expect(C.LIMIT_MAX_FRAGMENT_UNIFORM_VECTORS_WEBGL2).toBe(224);
    expect(C.LIMIT_MAX_DRAW_BUFFERS_WEBGL1).toBe(1);
    expect(C.LIMIT_MAX_DRAW_BUFFERS_WEBGL2).toBe(4);
    expect(C.LIMIT_MAX_TEXTURE_SIZE).toBe(4096);
    expect(C.LIMIT_MAX_CUBE_MAP_TEXTURE_SIZE).toBe(4096);
    expect(C.LIMIT_MAX_RENDERBUFFER_SIZE).toBe(4096);
    expect(C.LIMIT_MAX_3D_TEXTURE_SIZE).toBe(256);
    expect([...C.LIMIT_ALIASED_POINT_SIZE_RANGE]).toEqual([1, 1024]);
    expect([...C.LIMIT_ALIASED_LINE_WIDTH_RANGE]).toEqual([1, 1]);
    expect(C.VERSION_STRING_WEBGL1).toBe("WebGL 1.0 (Software)");
    expect(C.VERSION_STRING_WEBGL2).toBe("WebGL 2.0 (Software)");
  });
});

describe("no duplicates within validation groups", () => {
  const groups: Array<[string, ReadonlySet<number>]> = [
    ["capability", C.VALID_CAPABILITY_SET],
    ["blend-factor", C.VALID_BLEND_FACTOR_SET],
    ["depth-func", C.VALID_DEPTH_FUNC_SET],
    ["stencil-op", C.VALID_STENCIL_OP_SET],
    ["blend-equation", C.VALID_BLEND_EQUATION_SET],
    ["texture-target", C.VALID_TEXTURE_TARGET_SET],
    ["buffer-target", C.VALID_BUFFER_TARGET_SET],
    ["buffer-usage", C.VALID_BUFFER_USAGE_SET],
    ["primitive-mode", C.VALID_PRIMITIVE_MODE_SET],
    ["framebuffer-status", C.VALID_FRAMEBUFFER_STATUS_SET],
    ["error-code", C.VALID_ERROR_CODE_SET],
  ];
  for (const [name, set] of groups) {
    it(`${name} set has unique values and is frozen`, () => {
      const arr = [...set];
      expect(new Set(arr).size).toBe(arr.length);
      expect(Object.isFrozen(set)).toBe(true);
    });
  }
});
