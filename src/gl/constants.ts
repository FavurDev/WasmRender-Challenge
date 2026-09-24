// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial GL constants table
// CHANGELOG: Sprint 4 (2026-09-20): 5 new UNSIGNED_INT enums.
// CHANGELOG: Sprint 9 Task 2: shader precision enums LOW/MEDIUM/HIGH_FLOAT/INT + VALID_PRECISION_TYPE_SET (GLSL ES 1.00 Section 4.5).
// CHANGELOG: Sprint 11 (2026-09-23): six named bit-depth constants RED_BITS..STENCIL_BITS (TD-024).
/** GL constants — single definition of every WebGL1/WebGL2 enum. L0: imports nothing, no logic. */
export type GLenum = number;

// Clear bits
export const DEPTH_BUFFER_BIT: GLenum = 0x00000100;
export const STENCIL_BUFFER_BIT: GLenum = 0x00000400;
export const COLOR_BUFFER_BIT: GLenum = 0x00004000;

// Primitive modes
export const POINTS: GLenum = 0x0000;
export const LINES: GLenum = 0x0001;
export const LINE_LOOP: GLenum = 0x0002;
export const LINE_STRIP: GLenum = 0x0003;
export const TRIANGLES: GLenum = 0x0004;
export const TRIANGLE_STRIP: GLenum = 0x0005;
export const TRIANGLE_FAN: GLenum = 0x0006;

// Errors
export const NO_ERROR: GLenum = 0;
export const INVALID_ENUM: GLenum = 0x0500;
export const INVALID_VALUE: GLenum = 0x0501;
export const INVALID_OPERATION: GLenum = 0x0502;
export const OUT_OF_MEMORY: GLenum = 0x0505;
export const INVALID_FRAMEBUFFER_OPERATION: GLenum = 0x0506;

// Pixel bit-depth query pnames (TD-024: named constants for getParameter)
export const RED_BITS: GLenum = 0x0d52;
export const GREEN_BITS: GLenum = 0x0d53;
export const BLUE_BITS: GLenum = 0x0d54;
export const ALPHA_BITS: GLenum = 0x0d55;
export const DEPTH_BITS: GLenum = 0x0d56;
export const STENCIL_BITS: GLenum = 0x0d57;

// Capabilities
export const BLEND: GLenum = 0x0be2;
export const CULL_FACE: GLenum = 0x0b44;
export const DEPTH_TEST: GLenum = 0x0b71;
export const DITHER: GLenum = 0x0bd0;
export const POLYGON_OFFSET_FILL: GLenum = 0x8037;
export const SAMPLE_ALPHA_TO_COVERAGE: GLenum = 0x809e;
export const SAMPLE_COVERAGE: GLenum = 0x80a0;
export const SCISSOR_TEST: GLenum = 0x0c11;
export const STENCIL_TEST: GLenum = 0x0b90;

// Front face / cull
export const CW: GLenum = 0x0900;
export const CCW: GLenum = 0x0901;
export const FRONT: GLenum = 0x0404;
export const BACK: GLenum = 0x0405;
export const FRONT_AND_BACK: GLenum = 0x0408;

// Depth funcs
export const NEVER: GLenum = 0x0200;
export const LESS: GLenum = 0x0201;
export const EQUAL: GLenum = 0x0202;
export const LEQUAL: GLenum = 0x0203;
export const GREATER: GLenum = 0x0204;
export const NOTEQUAL: GLenum = 0x0205;
export const GEQUAL: GLenum = 0x0206;
export const ALWAYS: GLenum = 0x0207;
export const NONE: GLenum = 0;
export const TEXTURE_MIN_LOD: GLenum = 0x813a;
export const TEXTURE_MAX_LOD: GLenum = 0x813b;
export const TEXTURE_COMPARE_MODE: GLenum = 0x884c;
export const TEXTURE_COMPARE_FUNC: GLenum = 0x884d;
export const COMPARE_REF_TO_TEXTURE: GLenum = 0x884e;

// Stencil ops
export const KEEP: GLenum = 0x1e00;
export const REPLACE: GLenum = 0x1e01;
export const INCR: GLenum = 0x1e02;
export const DECR: GLenum = 0x1e03;
export const INVERT: GLenum = 0x150a;
export const INCR_WRAP: GLenum = 0x8507;
export const DECR_WRAP: GLenum = 0x8508;
export const ZERO: GLenum = 0;
export const ONE: GLenum = 1;

// Blend equations
export const FUNC_ADD: GLenum = 0x8006;
export const FUNC_SUBTRACT: GLenum = 0x800a;
export const FUNC_REVERSE_SUBTRACT: GLenum = 0x800b;

// Blend factors
export const SRC_COLOR: GLenum = 0x0300;
export const ONE_MINUS_SRC_COLOR: GLenum = 0x0301;
export const SRC_ALPHA: GLenum = 0x0302;
export const ONE_MINUS_SRC_ALPHA: GLenum = 0x0303;
export const DST_ALPHA: GLenum = 0x0304;
export const ONE_MINUS_DST_ALPHA: GLenum = 0x0305;
export const DST_COLOR: GLenum = 0x0306;
export const ONE_MINUS_DST_COLOR: GLenum = 0x0307;
export const SRC_ALPHA_SATURATE: GLenum = 0x0308;
export const CONSTANT_COLOR: GLenum = 0x8001;
export const ONE_MINUS_CONSTANT_COLOR: GLenum = 0x8002;
export const CONSTANT_ALPHA: GLenum = 0x8003;
export const ONE_MINUS_CONSTANT_ALPHA: GLenum = 0x8004;

// Texture targets / params
export const TEXTURE_2D: GLenum = 0x0de1;
export const TEXTURE_CUBE_MAP: GLenum = 0x8513;
export const TEXTURE_CUBE_MAP_POSITIVE_X: GLenum = 0x8515;
export const TEXTURE_CUBE_MAP_NEGATIVE_X: GLenum = 0x8516;
export const TEXTURE_CUBE_MAP_POSITIVE_Y: GLenum = 0x8517;
export const TEXTURE_CUBE_MAP_NEGATIVE_Y: GLenum = 0x8518;
export const TEXTURE_CUBE_MAP_POSITIVE_Z: GLenum = 0x8519;
export const TEXTURE_CUBE_MAP_NEGATIVE_Z: GLenum = 0x851a;
export const TEXTURE_BINDING_2D: GLenum = 0x8069;
export const TEXTURE_BINDING_CUBE_MAP: GLenum = 0x8514;
export const ACTIVE_TEXTURE: GLenum = 0x84e0;
export const TEXTURE0: GLenum = 0x84c0;
export const TEXTURE1: GLenum = 0x84c1;
export const TEXTURE31: GLenum = 0x84df;
export const TEXTURE_MAG_FILTER: GLenum = 0x2800;
export const TEXTURE_MIN_FILTER: GLenum = 0x2801;
export const TEXTURE_WRAP_S: GLenum = 0x2802;
export const TEXTURE_WRAP_T: GLenum = 0x2803;
export const NEAREST: GLenum = 0x2600;
export const LINEAR: GLenum = 0x2601;
export const NEAREST_MIPMAP_NEAREST: GLenum = 0x2700;
export const LINEAR_MIPMAP_NEAREST: GLenum = 0x2701;
export const NEAREST_MIPMAP_LINEAR: GLenum = 0x2702;
export const LINEAR_MIPMAP_LINEAR: GLenum = 0x2703;
export const CLAMP_TO_EDGE: GLenum = 0x812f;
export const MIRRORED_REPEAT: GLenum = 0x8370;
export const REPEAT: GLenum = 0x2901;
export const COMPRESSED_TEXTURE_FORMATS: GLenum = 0x86a3;

// Formats / types
export const ALPHA: GLenum = 0x1906;
export const RGB: GLenum = 0x1907;
export const RGBA: GLenum = 0x1908;
export const LUMINANCE: GLenum = 0x1909;
export const LUMINANCE_ALPHA: GLenum = 0x190a;
export const UNSIGNED_BYTE: GLenum = 0x1401;
export const FIXED: GLenum = 0x140c;
export const UNSIGNED_SHORT: GLenum = 0x1403;
export const UNSIGNED_INT: GLenum = 0x1405;
export const FLOAT: GLenum = 0x1406;
export const UNSIGNED_SHORT_4_4_4_4: GLenum = 0x8033;
export const UNSIGNED_SHORT_5_5_5_1: GLenum = 0x8034;
export const UNSIGNED_SHORT_5_6_5: GLenum = 0x8363;

// Buffers
export const ARRAY_BUFFER: GLenum = 0x8892;
export const ELEMENT_ARRAY_BUFFER: GLenum = 0x8893;
export const ARRAY_BUFFER_BINDING: GLenum = 0x8894;
export const ELEMENT_ARRAY_BUFFER_BINDING: GLenum = 0x8895;
export const STATIC_DRAW: GLenum = 0x88e4;
export const STREAM_DRAW: GLenum = 0x88e0;
export const DYNAMIC_DRAW: GLenum = 0x88e8;
export const BUFFER_SIZE: GLenum = 0x8764;
export const BUFFER_USAGE: GLenum = 0x8765;

// Shaders / programs
export const VERTEX_SHADER: GLenum = 0x8b31;
export const FRAGMENT_SHADER: GLenum = 0x8b30;
export const COMPILE_STATUS: GLenum = 0x8b81;
export const LINK_STATUS: GLenum = 0x8b82;
export const VALIDATE_STATUS: GLenum = 0x8b83;
export const SHADER_TYPE: GLenum = 0x8b4f;
export const DELETE_STATUS: GLenum = 0x8b80;
export const ATTACHED_SHADERS: GLenum = 0x8b85;
export const ACTIVE_ATTRIBUTES: GLenum = 0x8b89;
export const ACTIVE_UNIFORMS: GLenum = 0x8b86;
export const MAX_VERTEX_ATTRIBS: GLenum = 0x8869;
export const VERTEX_ATTRIB_ARRAY_ENABLED: GLenum = 0x8622;
export const VERTEX_ATTRIB_ARRAY_SIZE: GLenum = 0x8623;
export const VERTEX_ATTRIB_ARRAY_STRIDE: GLenum = 0x8624;
export const VERTEX_ATTRIB_ARRAY_TYPE: GLenum = 0x8625;
export const VERTEX_ATTRIB_ARRAY_NORMALIZED: GLenum = 0x886a;
export const VERTEX_ATTRIB_ARRAY_POINTER: GLenum = 0x8645;
export const VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: GLenum = 0x889f;
export const VERTEX_ATTRIB_ARRAY_DIVISOR: GLenum = 0x88fe;
export const CURRENT_VERTEX_ATTRIB: GLenum = 0x8626;
export const FLOAT_VEC2: GLenum = 0x8b50;
export const FLOAT_VEC3: GLenum = 0x8b51;
export const FLOAT_VEC4: GLenum = 0x8b52;
export const INT_VEC2: GLenum = 0x8b53;
export const INT_VEC3: GLenum = 0x8b54;
export const INT_VEC4: GLenum = 0x8b55;
export const BOOL: GLenum = 0x8b56;
export const BOOL_VEC2: GLenum = 0x8b57;
export const BOOL_VEC3: GLenum = 0x8b58;
export const BOOL_VEC4: GLenum = 0x8b59;
export const FLOAT_MAT2: GLenum = 0x8b5a;
export const FLOAT_MAT3: GLenum = 0x8b5b;
export const FLOAT_MAT4: GLenum = 0x8b5c;
export const SAMPLER_2D: GLenum = 0x8b5e;
export const SAMPLER_CUBE: GLenum = 0x8b60;

// Framebuffer / renderbuffer
export const FRAMEBUFFER: GLenum = 0x8d40;
export const RENDERBUFFER: GLenum = 0x8d41;
export const FRAMEBUFFER_BINDING: GLenum = 0x8ca6;
export const RENDERBUFFER_BINDING: GLenum = 0x8ca7;
export const FRAMEBUFFER_COMPLETE: GLenum = 0x8cd5;
export const FRAMEBUFFER_INCOMPLETE_ATTACHMENT: GLenum = 0x8cd6;
export const FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: GLenum = 0x8cd7;
export const FRAMEBUFFER_INCOMPLETE_DIMENSIONS: GLenum = 0x8cd9;
export const FRAMEBUFFER_UNSUPPORTED: GLenum = 0x8cdd;
export const FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: GLenum = 0x8d56;
export const COLOR_ATTACHMENT0: GLenum = 0x8ce0;
export const COLOR_ATTACHMENT1: GLenum = 0x8ce1;
export const COLOR_ATTACHMENT2: GLenum = 0x8ce2;
export const COLOR_ATTACHMENT3: GLenum = 0x8ce3;
export const MAX_COLOR_ATTACHMENTS: GLenum = 0x8cdf;
export const DRAW_BUFFER1: GLenum = 0x8826;
export const DRAW_BUFFER2: GLenum = 0x8827;
export const DRAW_BUFFER3: GLenum = 0x8828;
export const COLOR: GLenum = 0x1800;
export const DEPTH: GLenum = 0x1801;
export const DEPTH_STENCIL: GLenum = 0x84f9;
export const DEPTH_ATTACHMENT: GLenum = 0x8d00;
export const STENCIL_ATTACHMENT: GLenum = 0x8d20;
export const DEPTH_STENCIL_ATTACHMENT: GLenum = 0x821a;
export const DEPTH_COMPONENT16: GLenum = 0x81a5;
export const STENCIL_INDEX8: GLenum = 0x8d48;
export const RGBA4: GLenum = 0x8056;
export const RGB5_A1: GLenum = 0x8057;
export const RGB565: GLenum = 0x8d62;
export const DEPTH_COMPONENT: GLenum = 0x1902;
export const STENCIL_INDEX: GLenum = 0x1901;
export const RENDERBUFFER_WIDTH: GLenum = 0x8d42;
export const RENDERBUFFER_HEIGHT: GLenum = 0x8d43;
export const RENDERBUFFER_INTERNAL_FORMAT: GLenum = 0x8d44;
export const RENDERBUFFER_RED_SIZE: GLenum = 0x8d50;
export const RENDERBUFFER_GREEN_SIZE: GLenum = 0x8d51;
export const RENDERBUFFER_BLUE_SIZE: GLenum = 0x8d52;
export const RENDERBUFFER_ALPHA_SIZE: GLenum = 0x8d53;
export const RENDERBUFFER_DEPTH_SIZE: GLenum = 0x8d54;
export const RENDERBUFFER_STENCIL_SIZE: GLenum = 0x8d55;

// Hints / pixel store / misc
export const GENERATE_MIPMAP_HINT: GLenum = 0x8192;
export const DONT_CARE: GLenum = 0x1100;
export const FASTEST: GLenum = 0x1101;
export const NICEST: GLenum = 0x1102;
export const PACK_ALIGNMENT: GLenum = 0x0d05;
export const UNPACK_ALIGNMENT: GLenum = 0x0cf5;
export const VIEWPORT: GLenum = 0x0ba2;
export const SCISSOR_BOX: GLenum = 0x0c10;
export const COLOR_CLEAR_VALUE: GLenum = 0x0c22;
export const DEPTH_CLEAR_VALUE: GLenum = 0x0b73;
export const STENCIL_CLEAR_VALUE: GLenum = 0x0b91;
export const BLEND_COLOR: GLenum = 0x8005;
export const BLEND_EQUATION_RGB: GLenum = 0x8009;
export const BLEND_EQUATION_ALPHA: GLenum = 0x883d;
export const BLEND_SRC_RGB: GLenum = 0x80c9;
export const BLEND_DST_RGB: GLenum = 0x80c8;
export const BLEND_SRC_ALPHA: GLenum = 0x80cb;
export const BLEND_DST_ALPHA: GLenum = 0x80ca;
export const DEPTH_FUNC: GLenum = 0x0b74;
export const DEPTH_WRITEMASK: GLenum = 0x0b72;
export const DEPTH_RANGE: GLenum = 0x0b70;
export const STENCIL_FUNC: GLenum = 0x0b92;
export const STENCIL_REF: GLenum = 0x0b97;
export const STENCIL_VALUE_MASK: GLenum = 0x0b93;
export const STENCIL_WRITEMASK: GLenum = 0x0b98;
export const STENCIL_FAIL: GLenum = 0x0b94;
export const STENCIL_PASS_DEPTH_FAIL: GLenum = 0x0b95;
export const STENCIL_PASS_DEPTH_PASS: GLenum = 0x0b96;
export const STENCIL_BACK_FUNC: GLenum = 0x8800;
export const STENCIL_BACK_REF: GLenum = 0x8ca3;
export const STENCIL_BACK_VALUE_MASK: GLenum = 0x8ca4;
export const STENCIL_BACK_WRITEMASK: GLenum = 0x8ca5;
export const STENCIL_BACK_FAIL: GLenum = 0x8801;
export const STENCIL_BACK_PASS_DEPTH_FAIL: GLenum = 0x8802;
export const STENCIL_BACK_PASS_DEPTH_PASS: GLenum = 0x8803;
export const CULL_FACE_MODE: GLenum = 0x0b45;
export const FRONT_FACE: GLenum = 0x0b46;
export const POLYGON_OFFSET_FACTOR: GLenum = 0x8038;
export const POLYGON_OFFSET_UNITS: GLenum = 0x2a00;
export const COLOR_WRITEMASK: GLenum = 0x0c23;
export const LINE_WIDTH: GLenum = 0x0b21;
export const SAMPLE_COVERAGE_VALUE: GLenum = 0x80aa;
export const SAMPLE_COVERAGE_INVERT: GLenum = 0x80ab;
export const VENDOR: GLenum = 0x1f00;
export const RENDERER: GLenum = 0x1f01;
export const VERSION: GLenum = 0x1f02;
export const SHADING_LANGUAGE_VERSION: GLenum = 0x8b8c;
export const EXTENSIONS: GLenum = 0x1f03;
export const MAX_TEXTURE_SIZE: GLenum = 0x0d33;
export const MAX_CUBE_MAP_TEXTURE_SIZE: GLenum = 0x851c;
export const MAX_RENDERBUFFER_SIZE: GLenum = 0x84e8;
export const MAX_VIEWPORT_DIMS: GLenum = 0x0d3a;
export const ALIASED_POINT_SIZE_RANGE: GLenum = 0x846d;
export const ALIASED_LINE_WIDTH_RANGE: GLenum = 0x846e;
export const MAX_TEXTURE_IMAGE_UNITS: GLenum = 0x8872;
export const MAX_COMBINED_TEXTURE_IMAGE_UNITS: GLenum = 0x8b4d;
export const MAX_VERTEX_UNIFORM_VECTORS: GLenum = 0x8dfb;
export const MAX_VARYING_VECTORS: GLenum = 0x8dfc;
export const MAX_FRAGMENT_UNIFORM_VECTORS: GLenum = 0x8dfd;
export const MAX_DRAW_BUFFERS: GLenum = 0x8824;

// WebGL-specific range
export const UNPACK_FLIP_Y_WEBGL: GLenum = 0x9240;
export const UNPACK_PREMULTIPLY_ALPHA_WEBGL: GLenum = 0x9241;
export const CONTEXT_LOST_WEBGL: GLenum = 0x9242;
export const UNPACK_COLORSPACE_CONVERSION_WEBGL: GLenum = 0x9243;
export const BROWSER_DEFAULT_WEBGL: GLenum = 0x9244;

// WebGL2 additions
export const UNIFORM_BUFFER: GLenum = 0x8a11;
export const SYNC_GPU_COMMANDS_COMPLETE: GLenum = 0x9117;
export const TRANSFORM_FEEDBACK: GLenum = 0x8e22;
export const TRANSFORM_FEEDBACK_BUFFER: GLenum = 0x8c8e;
export const TEXTURE_3D: GLenum = 0x806f;
export const TEXTURE_2D_ARRAY: GLenum = 0x8c1a;
export const TEXTURE_BINDING_3D: GLenum = 0x806a;
export const TEXTURE_BINDING_2D_ARRAY: GLenum = 0x8c1d;
export const TEXTURE_WRAP_R: GLenum = 0x8072;
export const SAMPLER_BINDING: GLenum = 0x8919;
export const VERTEX_ARRAY_BINDING: GLenum = 0x85b5;
export const READ_FRAMEBUFFER: GLenum = 0x8ca8;
export const DRAW_FRAMEBUFFER: GLenum = 0x8ca9;
export const READ_BUFFER: GLenum = 0x0c02;
export const DRAW_BUFFER0: GLenum = 0x8825;
export const MAX_VERTEX_OUTPUT_COMPONENTS: GLenum = 0x9122;
export const MAX_FRAGMENT_INPUT_COMPONENTS: GLenum = 0x9125;
export const MAX_3D_TEXTURE_SIZE: GLenum = 0x8073;
export const MAX_ARRAY_TEXTURE_LAYERS: GLenum = 0x88ff;
export const MAX_VERTEX_OUTPUT_VECTORS: GLenum = 0x9122;
export const MAX_FRAGMENT_INPUT_VECTORS: GLenum = 0x9125;
export const INTERLEAVED_ATTRIBS: GLenum = 0x8c8c;
export const SEPARATE_ATTRIBS: GLenum = 0x8c8d;
export const ALREADY_SIGNALED: GLenum = 0x911a;
export const TIMEOUT_EXPIRED: GLenum = 0x911b;
export const CONDITION_SATISFIED: GLenum = 0x911c;
export const WAIT_FAILED: GLenum = 0x911d;
export const SYNC_STATUS: GLenum = 0x9114;
export const SYNC_CONDITION: GLenum = 0x9113;
export const SYNC_FLAGS: GLenum = 0x9115;
export const SIGNALED: GLenum = 0x9119;
export const UNSIGNALED: GLenum = 0x9118;
export const SYNC_FENCE: GLenum = 0x9116;
export const QUERY_RESULT: GLenum = 0x8866;
export const QUERY_RESULT_AVAILABLE: GLenum = 0x8867;
export const ANY_SAMPLES_PASSED: GLenum = 0x8c2f;
export const ANY_SAMPLES_PASSED_CONSERVATIVE: GLenum = 0x8d6a;
export const CURRENT_QUERY: GLenum = 0x8865;
export const OBJECT_TYPE: GLenum = 0x9112;
export const SYNC_FLUSH_COMMANDS_BIT: GLbitfield = 0x00000001;
export const TIME_ELAPSED_EXT: GLenum = 0x88bf;
export type GLbitfield = number;
export const RGBA8: GLenum = 0x8058;
export const RGBA_INTEGER: GLenum = 0x8d99;
export const RED_INTEGER: GLenum = 0x8d94;
export const RG_INTEGER: GLenum = 0x8228;
export const RGB_INTEGER: GLenum = 0x8d98;
export const R8: GLenum = 0x8229;
export const RG8: GLenum = 0x822b;
export const RGB8: GLenum = 0x8051;
export const DEPTH_COMPONENT24: GLenum = 0x81a6;
export const DEPTH24_STENCIL8: GLenum = 0x88f0;
export const INT: GLenum = 0x1404;
export const UNSIGNED_INT_VEC2: GLenum = 0x8dc6;
export const UNSIGNED_INT_VEC3: GLenum = 0x8dc7;
export const UNSIGNED_INT_VEC4: GLenum = 0x8dc8;
export const UNSIGNED_INT_SAMPLER_2D: GLenum = 0x8dd2;
export const UNSIGNED_INT_SAMPLER_CUBE: GLenum = 0x8dd4;
export const BYTE: GLenum = 0x1400;
export const SHORT: GLenum = 0x1402;
export const HALF_FLOAT: GLenum = 0x140b;
export const UNSIGNED_INT_2_10_10_10_REV: GLenum = 0x8368;
export const UNIFORM_BLOCK_BINDING: GLenum = 0x8a3f;
export const UNIFORM_BLOCK_DATA_SIZE: GLenum = 0x8a40;
export const UNIFORM_OFFSET: GLenum = 0x8a3b;
export const UNIFORM_ARRAY_STRIDE: GLenum = 0x8a3c;
export const UNIFORM_MATRIX_STRIDE: GLenum = 0x8a3d;
export const UNIFORM_BLOCK_INDEX: GLenum = 0x8a3a;
export const UNIFORM_BLOCK_ACTIVE_UNIFORMS: GLenum = 0x8a42;
export const UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES: GLenum = 0x8a43;
export const UNIFORM_BLOCK_NAME: GLenum = 0x8a41;
export const UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER: GLenum = 0x8a44;
export const UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER: GLenum = 0x8a46;
export const UNIFORM_BUFFER_BINDING: GLenum = 0x8a28;
export const UNIFORM_BUFFER_START: GLenum = 0x8a29;
export const UNIFORM_BUFFER_SIZE: GLenum = 0x8a2a;
export const COPY_READ_BUFFER: GLenum = 0x8f36;
export const COPY_WRITE_BUFFER: GLenum = 0x8f37;
export const PIXEL_PACK_BUFFER: GLenum = 0x88eb;
export const PIXEL_UNPACK_BUFFER: GLenum = 0x88ec;
export const UNPACK_ROW_LENGTH: GLenum = 0x0cf2;
export const UNPACK_SKIP_ROWS: GLenum = 0x0cf3;
export const UNPACK_SKIP_PIXELS: GLenum = 0x0cf4;
export const UNPACK_IMAGE_HEIGHT: GLenum = 0x806e;
export const UNPACK_SKIP_IMAGES: GLenum = 0x806d;
export const PACK_ROW_LENGTH: GLenum = 0x0d02;
export const PACK_SKIP_ROWS: GLenum = 0x0d03;
export const PACK_SKIP_PIXELS: GLenum = 0x0d04;
export const STATIC_COPY: GLenum = 0x88e6;
export const DYNAMIC_COPY: GLenum = 0x88ea;
export const STREAM_COPY: GLenum = 0x88e2;
export const STATIC_READ: GLenum = 0x88e5;
export const DYNAMIC_READ: GLenum = 0x88e9;
export const STREAM_READ: GLenum = 0x88e1;
export const RASTERIZER_DISCARD: GLenum = 0x8c89;
export const PRIMITIVES_GENERATED: GLenum = 0x8c87;
export const TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN: GLenum = 0x8c88;
export const MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS: GLenum = 0x8c8b;
export const MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS: GLenum = 0x8c8a;
export const MAX_UNIFORM_BUFFER_BINDINGS: GLenum = 0x8a2f;
export const MAX_SAMPLES: GLenum = 0x8d57;
export const MAX_ELEMENTS_VERTICES: GLenum = 0x80e8;
export const MAX_ELEMENTS_INDICES: GLenum = 0x80e9;

// SOW-REQ-016 resource limits (exact specified values)
export const LIMIT_MAX_VERTEX_ATTRIBS: number = 16;
export const LIMIT_MAX_VERTEX_UNIFORM_VECTORS_WEBGL1: number = 128;
export const LIMIT_MAX_VERTEX_UNIFORM_VECTORS_WEBGL2: number = 256;
export const LIMIT_MAX_VARYING_VECTORS_WEBGL1: number = 8;
export const LIMIT_MAX_VERTEX_OUTPUT_VECTORS: number = 16;
export const LIMIT_MAX_FRAGMENT_INPUT_VECTORS: number = 15;
export const LIMIT_MAX_TEXTURE_IMAGE_UNITS_WEBGL1: number = 8;
export const LIMIT_MAX_TEXTURE_IMAGE_UNITS_WEBGL2: number = 16;
export const LIMIT_MAX_COMBINED_TEXTURE_IMAGE_UNITS_WEBGL1: number = 8;
export const LIMIT_MAX_COMBINED_TEXTURE_IMAGE_UNITS_WEBGL2: number = 32;
export const LIMIT_MAX_FRAGMENT_UNIFORM_VECTORS_WEBGL1: number = 16;
export const LIMIT_MAX_FRAGMENT_UNIFORM_VECTORS_WEBGL2: number = 224;
export const LIMIT_MAX_DRAW_BUFFERS_WEBGL1: number = 1;
export const LIMIT_MAX_DRAW_BUFFERS_WEBGL2: number = 4;
export const LIMIT_MAX_TEXTURE_SIZE: number = 4096;
export const LIMIT_MAX_CUBE_MAP_TEXTURE_SIZE: number = 4096;
export const LIMIT_MAX_RENDERBUFFER_SIZE: number = 4096;
export const LIMIT_MAX_3D_TEXTURE_SIZE: number = 256;
export const LIMIT_MAX_ARRAY_TEXTURE_LAYERS: number = 256;
export const LIMIT_MAX_COLOR_ATTACHMENTS_WEBGL2: number = 4;
export const LIMIT_ALIASED_POINT_SIZE_RANGE: readonly [number, number] = [1, 1024];
export const LIMIT_ALIASED_LINE_WIDTH_RANGE: readonly [number, number] = [1, 1];
export const LIMIT_MAX_ANISOTROPY: number = 4;

// VERSION strings
export const VERSION_STRING_WEBGL1: string = "WebGL 1.0 (Software)";
export const VERSION_STRING_WEBGL2: string = "WebGL 2.0 (Software)";

// Frozen validation lookup sets
export const VALID_CAPABILITY_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([BLEND, CULL_FACE, DEPTH_TEST, DITHER, POLYGON_OFFSET_FILL, SAMPLE_ALPHA_TO_COVERAGE, SAMPLE_COVERAGE, SCISSOR_TEST, STENCIL_TEST]),
);
export const VALID_BLEND_FACTOR_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([ZERO, ONE, SRC_COLOR, ONE_MINUS_SRC_COLOR, DST_COLOR, ONE_MINUS_DST_COLOR, SRC_ALPHA, ONE_MINUS_SRC_ALPHA, DST_ALPHA, ONE_MINUS_DST_ALPHA, CONSTANT_COLOR, ONE_MINUS_CONSTANT_COLOR, CONSTANT_ALPHA, ONE_MINUS_CONSTANT_ALPHA, SRC_ALPHA_SATURATE]),
);
export const VALID_DEPTH_FUNC_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([NEVER, LESS, EQUAL, LEQUAL, GREATER, NOTEQUAL, GEQUAL, ALWAYS]),
);
export const VALID_STENCIL_FUNC_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([NEVER, LESS, EQUAL, LEQUAL, GREATER, NOTEQUAL, GEQUAL, ALWAYS]),
);
export const VALID_STENCIL_OP_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([KEEP, ZERO, REPLACE, INCR, INCR_WRAP, DECR, DECR_WRAP, INVERT]),
);
export const VALID_BLEND_EQUATION_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([FUNC_ADD, FUNC_SUBTRACT, FUNC_REVERSE_SUBTRACT]),
);
export const VALID_TEXTURE_TARGET_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([TEXTURE_2D, TEXTURE_CUBE_MAP, TEXTURE_3D, TEXTURE_2D_ARRAY]),
);
export const VALID_TEXTURE_FORMAT_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([ALPHA, RGB, RGBA, LUMINANCE, LUMINANCE_ALPHA, DEPTH_COMPONENT, RGBA_INTEGER]),
);
export const VALID_TEXTURE_TYPE_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([UNSIGNED_BYTE, UNSIGNED_SHORT, UNSIGNED_INT, FLOAT, UNSIGNED_SHORT_4_4_4_4, UNSIGNED_SHORT_5_5_5_1, UNSIGNED_SHORT_5_6_5, HALF_FLOAT]),
);
export const VALID_BUFFER_TARGET_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([ARRAY_BUFFER, ELEMENT_ARRAY_BUFFER, UNIFORM_BUFFER, TRANSFORM_FEEDBACK_BUFFER, COPY_READ_BUFFER, COPY_WRITE_BUFFER, PIXEL_PACK_BUFFER, PIXEL_UNPACK_BUFFER]),
);
export const VALID_BUFFER_USAGE_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([STATIC_DRAW, STREAM_DRAW, DYNAMIC_DRAW, STATIC_COPY, DYNAMIC_COPY, STREAM_COPY, STATIC_READ, DYNAMIC_READ, STREAM_READ]),
);
export const VALID_SHADER_TYPE_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([VERTEX_SHADER, FRAGMENT_SHADER]),
);
export const VALID_PRIMITIVE_MODE_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([POINTS, LINES, LINE_LOOP, LINE_STRIP, TRIANGLES, TRIANGLE_STRIP, TRIANGLE_FAN]),
);
export const VALID_FRAMEBUFFER_STATUS_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([FRAMEBUFFER_COMPLETE, FRAMEBUFFER_INCOMPLETE_ATTACHMENT, FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT, FRAMEBUFFER_INCOMPLETE_DIMENSIONS, FRAMEBUFFER_UNSUPPORTED, FRAMEBUFFER_INCOMPLETE_MULTISAMPLE]),
);
export const VALID_ERROR_CODE_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([NO_ERROR, INVALID_ENUM, INVALID_VALUE, INVALID_OPERATION, OUT_OF_MEMORY, INVALID_FRAMEBUFFER_OPERATION, CONTEXT_LOST_WEBGL]),
);
// Shader precision types (GLSL ES 1.00 Section 4.5)
export const LOW_FLOAT: GLenum = 0x8df0;
export const MEDIUM_FLOAT: GLenum = 0x8df1;
export const HIGH_FLOAT: GLenum = 0x8df2;
export const LOW_INT: GLenum = 0x8df3;
export const MEDIUM_INT: GLenum = 0x8df4;
export const HIGH_INT: GLenum = 0x8df5;
export const VALID_PRECISION_TYPE_SET: ReadonlySet<GLenum> = Object.freeze(
  new Set<GLenum>([LOW_FLOAT, MEDIUM_FLOAT, HIGH_FLOAT, LOW_INT, MEDIUM_INT, HIGH_INT]),
);