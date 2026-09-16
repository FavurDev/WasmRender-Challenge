/**
 * @fileoverview Frozen ES 3.00 builtin signature table (68 entries).
 * Dependency-graph leaf: zero imports, pure const exports only.
 */
// CHANGELOG:
// - Sprint 3: Created frozen ES 3.00 builtin signature table, 68 entries (Task 3).
/**
 * One overload descriptor: ordered parameter type names plus return type name.
 */
export interface BuiltinOverload {
  paramTypes: readonly string[];
  returnType: string;
}
/**
 * One builtin signature row: builtin name plus its non-empty overload list.
 */
export interface BuiltinSignature {
  name: string;
  overloads: readonly BuiltinOverload[];
}
const _T300: Record<string, readonly BuiltinOverload[]> = {
  radians: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  degrees: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  sin: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  cos: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  tan: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  asin: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  acos: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  atan: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }]),
  pow: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
  exp: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  log: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  exp2: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  log2: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  sqrt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  inversesqrt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  abs: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint"]), returnType: "uint" }]),
  sign: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["int"]), returnType: "int" }]),
  floor: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  ceil: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  fract: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  mod: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }]),
  min: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["int", "int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint", "uint"]), returnType: "uint" }]),
  max: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["int", "int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint", "uint"]), returnType: "uint" }]),
  clamp: Object.freeze([{ paramTypes: Object.freeze(["float", "float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
  mix: Object.freeze([{ paramTypes: Object.freeze(["float", "float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
  step: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }]),
  smoothstep: Object.freeze([{ paramTypes: Object.freeze(["float", "float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
  length: Object.freeze([{ paramTypes: Object.freeze(["vec2"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "float" }]),
  distance: Object.freeze([{ paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "float" }]),
  dot: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "float" }, { paramTypes: Object.freeze(["vec4", "vec4"]), returnType: "float" }]),
  cross: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
  normalize: Object.freeze([{ paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  faceforward: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3", "vec3"]), returnType: "vec3" }]),
  reflect: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
  refract: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3", "float"]), returnType: "vec3" }]),
  matrixCompMult: Object.freeze([{ paramTypes: Object.freeze(["mat2", "mat2"]), returnType: "mat2" }, { paramTypes: Object.freeze(["mat4", "mat4"]), returnType: "mat4" }]),
  outerProduct: Object.freeze([{ paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "mat3" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "mat2" }]),
  transpose: Object.freeze([{ paramTypes: Object.freeze(["mat2"]), returnType: "mat2" }, { paramTypes: Object.freeze(["mat3"]), returnType: "mat3" }, { paramTypes: Object.freeze(["mat4"]), returnType: "mat4" }]),
  determinant: Object.freeze([{ paramTypes: Object.freeze(["mat2"]), returnType: "float" }, { paramTypes: Object.freeze(["mat3"]), returnType: "float" }]),
  inverse: Object.freeze([{ paramTypes: Object.freeze(["mat2"]), returnType: "mat2" }, { paramTypes: Object.freeze(["mat3"]), returnType: "mat3" }]),
  round: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  roundEven: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  trunc: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  modf: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
  frexp: Object.freeze([{ paramTypes: Object.freeze(["float", "int"]), returnType: "float" }]),
  ldexp: Object.freeze([{ paramTypes: Object.freeze(["float", "int"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "ivec3"]), returnType: "vec3" }]),
  floatBitsToInt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "int" }, { paramTypes: Object.freeze(["vec2"]), returnType: "ivec2" }]),
  floatBitsToUint: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "uint" }, { paramTypes: Object.freeze(["vec2"]), returnType: "uvec2" }]),
  intBitsToFloat: Object.freeze([{ paramTypes: Object.freeze(["int"]), returnType: "float" }, { paramTypes: Object.freeze(["ivec2"]), returnType: "vec2" }]),
  uintBitsToFloat: Object.freeze([{ paramTypes: Object.freeze(["uint"]), returnType: "float" }, { paramTypes: Object.freeze(["uvec2"]), returnType: "vec2" }]),
  bitfieldExtract: Object.freeze([{ paramTypes: Object.freeze(["int", "int", "int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint", "int", "int"]), returnType: "uint" }]),
  bitfieldInsert: Object.freeze([{ paramTypes: Object.freeze(["int", "int", "int", "int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint", "uint", "int", "int"]), returnType: "uint" }]),
  findLSB: Object.freeze([{ paramTypes: Object.freeze(["int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint"]), returnType: "int" }]),
  findMSB: Object.freeze([{ paramTypes: Object.freeze(["int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint"]), returnType: "int" }]),
  bitfieldReverse: Object.freeze([{ paramTypes: Object.freeze(["int"]), returnType: "int" }, { paramTypes: Object.freeze(["uint"]), returnType: "uint" }]),
  interpolateAtCentroid: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  interpolateAtSample: Object.freeze([{ paramTypes: Object.freeze(["float", "int"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "int"]), returnType: "vec3" }]),
  interpolateAtOffset: Object.freeze([{ paramTypes: Object.freeze(["float", "vec2"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec2"]), returnType: "vec3" }]),
  texture: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler2D", "vec2", "float"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler3D", "vec3"]), returnType: "vec4" }]),
  textureProj: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec3"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler2D", "vec4"]), returnType: "vec4" }]),
  textureLod: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2", "float"]), returnType: "vec4" }]),
  textureGrad: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2", "vec2", "vec2"]), returnType: "vec4" }]),
  texelFetch: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "ivec2", "int"]), returnType: "vec4" }, { paramTypes: Object.freeze(["isampler2D", "ivec2", "int"]), returnType: "ivec4" }]),
  textureSize: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "int"]), returnType: "ivec2" }, { paramTypes: Object.freeze(["sampler3D", "int"]), returnType: "ivec3" }]),
  textureQueryLod: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2"]), returnType: "vec2" }]),
  dFdx: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  dFdy: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  fwidth: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
};
/**
 * Frozen ES 3.00 builtin lookup: 68 keys, modern texture plus derivative families.
 */
export const BUILTINS_300: Readonly<Record<string, readonly BuiltinOverload[]>> = Object.freeze(_T300);