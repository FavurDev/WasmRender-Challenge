/**
 * @fileoverview ExtensionManager: 3-stub registry plus context-loss flag (acyclic leaf).
 */
// CHANGELOG:
// - Sprint 5: Created ExtensionManager with 3 stubs and loss transitions.
/**
 * Opaque record backing a single supported WebGL extension stub.
 *
 * Carries at minimum the stub name; the lose-context stub additionally
 * exposes lose/restore entry points that flip the manager loss flag.
 */
export type ExtensionStub = Record<string, unknown>;

/**
 * Manager for exactly three WebGL extension stubs plus a loss flag.
 */
export class ExtensionManager {
  private lost = false;
  private readonly drawBuffersStub: ExtensionStub = { name: "WEBGL_draw_buffers" };
  private readonly floatTextureStub: ExtensionStub = { name: "OES_texture_float" };
  private readonly loseContextStub: ExtensionStub;

  constructor() {
    this.loseContextStub = {
      name: "WEBGL_lose_context",
      loseContext: (): void => { this.lost = true; },
      restoreContext: (): void => { this.lost = false; },
      lose: (): void => { this.lost = true; },
      restore: (): void => { this.lost = false; },
    };
  }

  /**
   * Return exactly the three supported names as a fresh copy.
   * @returns Fresh list in fixed order.
   */
  listSupportedNames(): string[] {
    return ["WEBGL_draw_buffers", "OES_texture_float", "WEBGL_lose_context"];
  }

  /**
   * Return the stable stub for a supported name, or null silently.
   * @param name Requested extension name (case-sensitive).
   * @returns Stub record or null with zero error-queue contact.
   */
  lookupStub(name: string): ExtensionStub | null {
    if (name === "WEBGL_draw_buffers") return this.drawBuffersStub;
    if (name === "OES_texture_float") return this.floatTextureStub;
    if (name === "WEBGL_lose_context") return this.loseContextStub;
    return null;
  }

  /**
   * Flip flag to lost-state (idempotent).
   *
   * Pushes no error; the next guarded draw/clear/readPixels reports
   * CONTEXT_LOST_WEBGL exactly once per call.
   */
  markLost(): void { this.lost = true; }

  /**
   * Flip flag to working-state (idempotent).
   *
   * Pushes no error; guarded entry points resume normal validation.
   */
  markRestored(): void { this.lost = false; }

  /**
   * Report current loss flag.
   * @returns True when lost.
   */
  reportLost(): boolean { return this.lost; }
}
