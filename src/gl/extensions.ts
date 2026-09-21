// CHANGELOG: Sprint 7 Task 5: ExtensionRegistry with seven memoized extensions + WEBGL_lose_context semantics
/** Extensions registry — memoized WebGL 1.0 exposure-level extensions. L5: imports L0-L4 only. */
import type { GLState } from './state';
import type { IErrorSink } from './errors';

export interface IExtensionRegistry {
  getExtension(name: string): object | null;
  getSupportedExtensions(): readonly string[];
}

export interface IWebGLLoseContext {
  loseContext(): void;
  restoreContext(): void;
}

export interface ExtensionRegistryHooks {
  onLoseContext: () => void;
  onRestoreContext: () => void;
}

const SUPPORTED_NAMES: readonly string[] = [
  'OES_texture_float',
  'OES_texture_half_float',
  'OES_texture_npot',
  'OES_element_index_uint',
  'WEBGL_lose_context',
  'WEBGL_compressed_texture_s3tc',
  'EXT_frag_depth',
];

const LOSE_CONTEXT_NAME = 'WEBGL_lose_context';

export class ExtensionRegistry implements IExtensionRegistry {
  private readonly instances = new Map<string, object>();

  public constructor(
    private readonly errorSink: IErrorSink,
    private readonly glState: GLState,
    private readonly hooks: ExtensionRegistryHooks,
  ) {
    this.instances.set('OES_texture_float', {});
    this.instances.set('OES_texture_half_float', {});
    this.instances.set('OES_texture_npot', {});
    this.instances.set('OES_element_index_uint', {});
    this.instances.set('WEBGL_compressed_texture_s3tc', {});
    this.instances.set('EXT_frag_depth', {});
    const loseContext = {
      loseContext: (): void => {
        if (this.errorSink.isContextLost()) return;
        this.errorSink.setContextLost(true);
        this.hooks.onLoseContext();
      },
      restoreContext: (): void => {
        if (!this.errorSink.isContextLost()) return;
        this.errorSink.setContextLost(false);
        this.glState.resetToDefaults();
        this.hooks.onRestoreContext();
      },
    };
    this.instances.set(LOSE_CONTEXT_NAME, loseContext);
  }

  public getExtension(name: string): object | null {
    if (this.errorSink.isContextLost() && name !== LOSE_CONTEXT_NAME) return null;
    const found = this.instances.get(name);
    if (found !== undefined) return found;
    return null;
  }

  public getSupportedExtensions(): readonly string[] {
    return [...SUPPORTED_NAMES];
  }
}
