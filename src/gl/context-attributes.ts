/** Context-attribute resolution — pure function mapping partial inputs to frozen spec defaults. */
export type WebGLPowerPreference = 'default' | 'low-power' | 'high-performance';

export interface WebGLContextAttributes {
  alpha: boolean;
  depth: boolean;
  stencil: boolean;
  antialias: boolean;
  premultipliedAlpha: boolean;
  preserveDrawingBuffer: boolean;
  powerPreference: WebGLPowerPreference;
  failIfMajorPerformanceCaveat: boolean;
}

function resolveBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function resolveContextAttributes(
  attrs?: Partial<WebGLContextAttributes> | null,
): WebGLContextAttributes {
  const candidate: Record<string, unknown> =
    attrs === null || attrs === undefined || typeof attrs !== 'object' ? {} : (attrs as Record<string, unknown>);
  const power = candidate['powerPreference'];
  const resolvedPowerPreference: WebGLPowerPreference =
    power === 'default' || power === 'low-power' || power === 'high-performance' ? power : 'default';
  const result: WebGLContextAttributes = {
    alpha: resolveBoolean(candidate['alpha'], true),
    depth: resolveBoolean(candidate['depth'], true),
    stencil: resolveBoolean(candidate['stencil'], false),
    antialias: resolveBoolean(candidate['antialias'], true),
    premultipliedAlpha: resolveBoolean(candidate['premultipliedAlpha'], true),
    preserveDrawingBuffer: resolveBoolean(candidate['preserveDrawingBuffer'], false),
    powerPreference: resolvedPowerPreference,
    failIfMajorPerformanceCaveat: resolveBoolean(candidate['failIfMajorPerformanceCaveat'], false),
  };
  return Object.freeze(result);
}
