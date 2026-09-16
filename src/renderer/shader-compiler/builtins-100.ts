/**
 * @fileoverview Frozen ES 1.00 builtin signature table (42 entries).
 * Dependency-graph leaf: zero imports, pure const exports only.
 */
// CHANGELOG:
// - Sprint 3: Created frozen ES 1.00 builtin signature table, 42 entries (Task 3).
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
const _T: Record<string, readonly BuiltinOverload[]> = {
  radians: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
  degrees: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
  sin: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
  cos: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
  tan: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  asin: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  acos: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  atan: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }]),
  pow: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3", "vec3"]), returnType: "vec3" }]),
  exp: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  log: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  exp2: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  log2: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  sqrt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
  inversesqrt: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  abs: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["int"]), returnType: "int" }]),
  sign: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2"]), returnType: "vec2" }]),
  floor: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }, { paramTypes: Object.freeze(["vec4"]), returnType: "vec4" }]),
  ceil: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  fract: Object.freeze([{ paramTypes: Object.freeze(["float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec3"]), returnType: "vec3" }]),
  mod: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["vec2", "float"]), returnType: "vec2" }]),
  min: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["int", "int"]), returnType: "int" }]),
  max: Object.freeze([{ paramTypes: Object.freeze(["float", "float"]), returnType: "float" }, { paramTypes: Object.freeze(["vec2", "vec2"]), returnType: "vec2" }, { paramTypes: Object.freeze(["int", "int"]), returnType: "int" }]),
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
  texture2D: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec2"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler2D", "vec2", "float"]), returnType: "vec4" }]),
  texture2DProj: Object.freeze([{ paramTypes: Object.freeze(["sampler2D", "vec3"]), returnType: "vec4" }, { paramTypes: Object.freeze(["sampler2D", "vec4"]), returnType: "vec4" }]),
  textureCube: Object.freeze([{ paramTypes: Object.freeze(["samplerCube", "vec3"]), returnType: "vec4" }, { paramTypes: Object.freeze(["samplerCube", "vec3", "float"]), returnType: "vec4" }]),
  all: Object.freeze([{ paramTypes: Object.freeze(["bvec2"]), returnType: "bool" }, { paramTypes: Object.freeze(["bvec3"]), returnType: "bool" }]),
  any: Object.freeze([{ paramTypes: Object.freeze(["bvec2"]), returnType: "bool" }, { paramTypes: Object.freeze(["bvec3"]), returnType: "bool" }]),
  not: Object.freeze([{ paramTypes: Object.freeze(["bool"]), returnType: "bool" }, { paramTypes: Object.freeze(["bvec2"]), returnType: "bvec2" }]),
};
/**
 * Frozen ES 1.00 builtin lookup: 42 keys, legacy texture family only.
 */
export const BUILTINS_100: Readonly<Record<string, readonly BuiltinOverload[]>> = Object.freeze(_T);