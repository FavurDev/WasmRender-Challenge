// CHANGELOG: Sprint 2 (2026-09-20): Sprint 2 T4 software WebGL context factory entry dispatch
/** Entry point — software WebGL context factory (composition-root dispatcher). */
import { WebGL1Context } from './gl/webgl1-context';
import type { WebGLContextAttributes } from './gl/context-attributes';

export type CanvasStub = { width?: number; height?: number } | null | undefined;

/**
 * Create a software WebGL rendering context for the given canvas stub.
 *
 * Args:
 *   canvas: Canvas dimensions stub (missing dims handled by facade default 300x150).
 *   attrs: Partial context attributes resolved by the facade.
 *   type: Context type string; omitted/null means 'webgl'.
 *
 * Returns:
 *   A WebGL1Context for 'webgl'/'experimental-webgl', else null (never throws).
 */
export function createSoftwareWebGLContext(
  canvas?: CanvasStub,
  attrs?: Partial<WebGLContextAttributes> | null,
  type?: string | null,
): WebGL1Context | null {
  let normalizedType = 'webgl';
  if (type !== undefined && type !== null) {
    normalizedType = String(type).trim();
  }
  if (normalizedType === 'webgl' || normalizedType === 'experimental-webgl') {
    return new WebGL1Context(canvas, attrs);
  }
  return null;
}

export { WebGL1Context };

declare global {
  interface Window {
    __createSoftwareWebGLContext?: typeof createSoftwareWebGLContext;
  }
}

const globalScope = globalThis as unknown as {
  window?: { __createSoftwareWebGLContext?: typeof createSoftwareWebGLContext };
  __createSoftwareWebGLContext?: typeof createSoftwareWebGLContext;
};
globalScope.__createSoftwareWebGLContext = createSoftwareWebGLContext;
if (typeof window !== 'undefined' && window !== null) {
  (window as unknown as { __createSoftwareWebGLContext?: typeof createSoftwareWebGLContext }).__createSoftwareWebGLContext =
    createSoftwareWebGLContext;
}