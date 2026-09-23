/** std140 UBO layout engine — pure deterministic OpenGL ES 3.0 rules. */
export interface UboMemberDescriptor {
  name: string;
  typeName: string;
  arraySize?: number;
  structMembers?: UboMemberDescriptor[];
}

export interface UboTypeLayoutInfo {
  baseAlignment: number;
  size: number;
  arrayStride: number;
  matrixStride: number;
}

export interface UboLayoutMember {
  name: string;
  offset: number;
  arrayStride: number;
  matrixStride: number;
}

export interface UboLayoutResult {
  dataSize: number;
  members: UboLayoutMember[];
}

export function roundUp(value: number, alignment: number): number {
  if (alignment <= 0) return value;
  const rem = value % alignment;
  if (rem === 0) return value;
  return value + (alignment - rem);
}

const SCALARS = new Set(['float', 'int', 'uint', 'bool']);
const VEC2S = new Set(['vec2', 'ivec2', 'uvec2', 'bvec2']);
const VEC4S = new Set(['vec3', 'ivec3', 'uvec3', 'bvec3', 'vec4', 'ivec4', 'uvec4', 'bvec4']);

export function getStd140TypeInfo(
  typeName: string,
  arraySize?: number | null,
  structMembers?: UboMemberDescriptor[] | null,
  structRegistry?: Map<string, UboMemberDescriptor[]>,
): UboTypeLayoutInfo {
  const isArray = arraySize !== null && arraySize !== undefined && arraySize > 0;
  const n = isArray ? (arraySize as number) : 1;
  const membersList: UboMemberDescriptor[] | undefined =
    structMembers !== null && structMembers !== undefined
      ? structMembers
      : structRegistry !== undefined
        ? structRegistry.get(typeName)
        : undefined;
  if (membersList !== undefined) {
    let maxAlign = 16;
    let cur = 0;
    for (const m of membersList) {
      const info = getStd140TypeInfo(m.typeName, m.arraySize ?? null, m.structMembers ?? null, structRegistry);
      if (info.baseAlignment > maxAlign) maxAlign = info.baseAlignment;
      cur = roundUp(cur, info.baseAlignment) + info.size;
    }
    const structAlign = roundUp(maxAlign, 16);
    const single = roundUp(cur, structAlign);
    if (isArray) {
      const stride = roundUp(single, 16);
      return { baseAlignment: structAlign, size: stride * n, arrayStride: stride, matrixStride: 0 };
    }
    return { baseAlignment: structAlign, size: single, arrayStride: 0, matrixStride: 0 };
  }
  if (SCALARS.has(typeName)) {
    if (isArray) return { baseAlignment: 16, size: 16 * n, arrayStride: 16, matrixStride: 0 };
    return { baseAlignment: 4, size: 4, arrayStride: 0, matrixStride: 0 };
  }
  if (VEC2S.has(typeName)) {
    if (isArray) return { baseAlignment: 16, size: 16 * n, arrayStride: 16, matrixStride: 0 };
    return { baseAlignment: 8, size: 8, arrayStride: 0, matrixStride: 0 };
  }
  if (VEC4S.has(typeName)) {
    if (isArray) return { baseAlignment: 16, size: 16 * n, arrayStride: 16, matrixStride: 0 };
    return { baseAlignment: 16, size: 16, arrayStride: 0, matrixStride: 0 };
  }
  if (typeName === 'mat2') {
    if (isArray) return { baseAlignment: 16, size: 32 * n, arrayStride: 32, matrixStride: 16 };
    return { baseAlignment: 16, size: 32, arrayStride: 0, matrixStride: 16 };
  }
  if (typeName === 'mat3') {
    if (isArray) return { baseAlignment: 16, size: 48 * n, arrayStride: 48, matrixStride: 16 };
    return { baseAlignment: 16, size: 48, arrayStride: 0, matrixStride: 16 };
  }
  if (typeName === 'mat4') {
    if (isArray) return { baseAlignment: 16, size: 64 * n, arrayStride: 64, matrixStride: 16 };
    return { baseAlignment: 16, size: 64, arrayStride: 0, matrixStride: 16 };
  }
  return { baseAlignment: 16, size: 16 * n, arrayStride: isArray ? 16 : 0, matrixStride: 0 };
}

export function computeStd140Layout(
  members: UboMemberDescriptor[],
  structRegistry?: Map<string, UboMemberDescriptor[]>,
): UboLayoutResult {
  let cur = 0;
  const out: UboLayoutMember[] = [];
  for (const m of members) {
    const info = getStd140TypeInfo(m.typeName, m.arraySize ?? null, m.structMembers ?? null, structRegistry);
    cur = roundUp(cur, info.baseAlignment);
    out.push({ name: m.name, offset: cur, arrayStride: info.arrayStride, matrixStride: info.matrixStride });
    cur += info.size;
  }
  return { dataSize: roundUp(cur, 16), members: out };
}
