/** Sprint 12 Task 4 Unit 2 — ExtensionRegistry coverage (memoized extensions + lose-context). */
import { describe, expect, it } from 'vitest';
import { ExtensionRegistry } from '../../src/gl/extensions';
import { ErrorSink } from '../../src/gl/errors';
import { GLState } from '../../src/gl/state';
import { NO_ERROR } from '../../src/gl/constants';

function makeRegistry() {
  // Arrange helper
  const sink = new ErrorSink();
  const state = new GLState(sink);
  let loseCalls = 0;
  let restoreCalls = 0;
  const reg = new ExtensionRegistry(sink, state, {
    onLoseContext: () => {
      loseCalls += 1;
    },
    onRestoreContext: () => {
      restoreCalls += 1;
    },
  });
  return { sink, state, reg, calls: () => ({ loseCalls, restoreCalls }) };
}

describe('sprint12 extensions coverage', () => {
  it('exposes all seven supported extension names', () => {
    // Arrange
    const { reg } = makeRegistry();
    // Act
    const names = reg.getSupportedExtensions();
    // Assert
    expect([...names].sort()).toEqual(
      [
        'OES_texture_float',
        'OES_texture_half_float',
        'OES_texture_npot',
        'OES_element_index_uint',
        'WEBGL_lose_context',
        'WEBGL_compressed_texture_s3tc',
        'EXT_frag_depth',
      ].sort(),
    );
  });

  it('memoizes extension instances across calls', () => {
    // Arrange
    const { reg } = makeRegistry();
    // Act
    const a = reg.getExtension('OES_texture_float');
    const b = reg.getExtension('OES_texture_float');
    // Assert
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });

  it('returns null for unknown names without recording an error', () => {
    // Arrange
    const { sink, reg } = makeRegistry();
    // Act
    const ext = reg.getExtension('NOPE_not_real');
    // Assert
    expect(ext).toBeNull();
    expect(sink.getError()).toBe(NO_ERROR);
  });

  it('loseContext is idempotent and fires the hook once', () => {
    // Arrange
    const { reg, calls } = makeRegistry();
    const lose = reg.getExtension('WEBGL_lose_context') as { loseContext(): void };
    // Act
    lose.loseContext();
    lose.loseContext();
    // Assert
    expect(calls().loseCalls).toBe(1);
  });

  it('blocks non-lose extensions while context is lost', () => {
    // Arrange
    const { reg } = makeRegistry();
    const lose = reg.getExtension('WEBGL_lose_context') as {
      loseContext(): void;
      restoreContext(): void;
    };
    // Act
    lose.loseContext();
    const blocked = reg.getExtension('OES_texture_float');
    const stillThere = reg.getExtension('WEBGL_lose_context');
    // Assert
    expect(blocked).toBeNull();
    expect(stillThere).not.toBeNull();
    // Cleanup
    lose.restoreContext();
  });

  it('restoreContext resets viewport to defaults and fires the hook', () => {
    // Arrange
    const { state, reg, calls } = makeRegistry();
    const lose = reg.getExtension('WEBGL_lose_context') as {
      loseContext(): void;
      restoreContext(): void;
    };
    state.setViewport(10, 20, 30, 40);
    // Act
    lose.loseContext();
    lose.restoreContext();
    // Assert
    expect(calls().restoreCalls).toBe(1);
    expect(Array.from(state.getViewport())).toEqual([0, 0, 300, 150]);
    expect(reg.getExtension('OES_texture_float')).not.toBeNull();
  });

  it('restoreContext early-returns when context is not lost', () => {
    // Arrange
    const { reg, calls } = makeRegistry();
    const lose = reg.getExtension('WEBGL_lose_context') as { restoreContext(): void };
    // Act
    lose.restoreContext();
    // Assert
    expect(calls().restoreCalls).toBe(0);
  });
});
