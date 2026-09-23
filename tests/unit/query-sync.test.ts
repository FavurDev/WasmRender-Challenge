/** Sprint 8 Task 3 sync objects + occlusion queries TDD RED-phase tests. */
import { describe, expect, it } from 'vitest';
import { QuerySyncManager } from '../../src/gl/query-sync';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import { WebGL1Context } from '../../src/gl/webgl1-context';
import {
  ALREADY_SIGNALED,
  ANY_SAMPLES_PASSED,
  COLOR_BUFFER_BIT,
  CONDITION_SATISFIED,
  DEPTH_BUFFER_BIT,
  DEPTH_TEST,
  INVALID_ENUM,
  INVALID_OPERATION,
  QUERY_RESULT,
  QUERY_RESULT_AVAILABLE,
  SIGNALED,
  SYNC_CONDITION,
  SYNC_FLAGS,
  SYNC_GPU_COMMANDS_COMPLETE,
  SYNC_STATUS,
  TIMEOUT_EXPIRED,
  TRIANGLES,
} from '../../src/gl/constants';
import type { DirectVertex } from '../../src/gl/webgl1-context';

// Local fallbacks for enums added in Step 3 (not yet in constants.ts).
const OBJECT_TYPE = 0x9112;
const SYNC_FENCE = 0x9116;
const CURRENT_QUERY = 0x8865;
const SYNC_FLUSH_COMMANDS_BIT = 0x00000001;
const ANY_SAMPLES_PASSED_CONSERVATIVE = 0x8d6a;

describe('Group 1: sync lifecycle and return-code matrix', () => {
  it('TEST 1: fenceSync + zero-timeout clientWaitSync returns ALREADY_SIGNALED, never TIMEOUT_EXPIRED', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    // Act:
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    const rc = mgr.clientWaitSync(sync, 0, 0);
    // Assert:
    expect(rc).toBe(ALREADY_SIGNALED);
    expect(rc).not.toBe(TIMEOUT_EXPIRED);
  });

  it('TEST 2: clientWaitSync with SYNC_FLUSH_COMMANDS_BIT returns CONDITION_SATISFIED', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Act:
    const rc = mgr.clientWaitSync(sync, SYNC_FLUSH_COMMANDS_BIT, 0);
    // Assert:
    expect(rc).toBe(CONDITION_SATISFIED);
  });

  it('TEST 3: getSyncParameter returns OBJECT_TYPE/SYNC_STATUS/SYNC_CONDITION/SYNC_FLAGS matrix', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Act:
    const objectType = mgr.getSyncParameter(sync, OBJECT_TYPE);
    const status = mgr.getSyncParameter(sync, SYNC_STATUS);
    const condition = mgr.getSyncParameter(sync, SYNC_CONDITION);
    const flags = mgr.getSyncParameter(sync, SYNC_FLAGS);
    // Assert:
    expect(objectType).toBe(SYNC_FENCE);
    expect(status).toBe(SIGNALED);
    expect(condition).toBe(SYNC_GPU_COMMANDS_COMPLETE);
    expect(flags).toBe(0);
  });

  it('TEST 4: deleteSync invalidates the sync object', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Act:
    mgr.deleteSync(sync);
    // Assert:
    expect(mgr.isSync(sync)).toBe(false);
  });
});

describe('Group 2: occlusion query depth-survivor integration', () => {
  it('TEST 2.1: drawOcclusionScene backdoor is absent from WebGL2Context', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 2, height: 2 });
    // Act:
    const own = (gl as unknown as Record<string, unknown>)['drawOcclusionScene'];
    const proto = (Object.getPrototypeOf(gl) as Record<string, unknown>)['drawOcclusionScene'];
    // Assert:
    expect(own).toBe(undefined);
    expect(proto).toBe(undefined);
  });

  it('TEST 5: full-screen quad under DEPTH_TEST reports exact surviving samples', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 4, height: 2 });
    const q = gl.createQuery();
    const quad: DirectVertex[] = [
      { position: [-1, -1, 0, 1] },
      { position: [3, -1, 0, 1] },
      { position: [-1, 3, 0, 1] },
    ];
    gl.enable(DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    // Act:
    gl.beginQuery(ANY_SAMPLES_PASSED_CONSERVATIVE, q);
    gl.drawArrays(TRIANGLES, 0, 3, quad);
    gl.endQuery(ANY_SAMPLES_PASSED_CONSERVATIVE);
    // Assert:
    expect(gl.getQueryParameter(q, QUERY_RESULT)).toBe(8);
    expect(gl.getQueryParameter(q, QUERY_RESULT_AVAILABLE)).toBe(true);
  });

  it('TEST 6: multi-draw query span accumulates survivors across draws', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 4, height: 2 });
    const q = gl.createQuery();
    const mkQuad = (z: number): DirectVertex[] => [
      { position: [-1, -1, z, 1] },
      { position: [3, -1, z, 1] },
      { position: [-1, 3, z, 1] },
    ];
    gl.enable(DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clearDepth(1);
    gl.clear(COLOR_BUFFER_BIT | DEPTH_BUFFER_BIT);
    // Act: pre-render occluder at depth 0.5 outside the query, then inside
    // the query draw one fully-occluded quad (depth 0.8 -> 0 survivors) and
    // one fully-visible quad (depth 0.2 -> 8 survivors).
    gl.drawArrays(TRIANGLES, 0, 3, mkQuad(0));
    gl.beginQuery(ANY_SAMPLES_PASSED, q);
    gl.drawArrays(TRIANGLES, 0, 3, mkQuad(0.6));
    gl.drawArrays(TRIANGLES, 0, 3, mkQuad(-0.6));
    gl.endQuery(ANY_SAMPLES_PASSED);
    // Assert:
    expect(gl.getQueryParameter(q, QUERY_RESULT)).toBe(8);
  });

  it('TEST 7: WebGL1 context exposes no-op query entry points (regression)', () => {
    // Arrange:
    const gl = new WebGL1Context({ width: 2, height: 2 });
    // Act:
    const q = (gl as unknown as { createQuery?: () => unknown }).createQuery?.();
    // Assert:
    expect(q).toBeUndefined();
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });
});

describe('Group 3: query error paths', () => {
  it('TEST 8: double-begin on the same target raises INVALID_OPERATION', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 2, height: 2 });
    const q = gl.createQuery();
    gl.beginQuery(ANY_SAMPLES_PASSED, q);
    // Act:
    gl.beginQuery(ANY_SAMPLES_PASSED, q);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TEST 9: getQueryParameter on a never-begun query raises INVALID_OPERATION', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 2, height: 2 });
    const q = gl.createQuery();
    // Act:
    gl.getQueryParameter(q, QUERY_RESULT);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
  });

  it('TEST 10: beginQuery with invalid target raises INVALID_ENUM', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 2, height: 2 });
    const q = gl.createQuery();
    // Act:
    gl.beginQuery(0xdead, q);
    // Assert:
    expect(gl.getError()).toBe(INVALID_ENUM);
  });

  it('TEST 11: endQuery without an active query raises INVALID_OPERATION', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 2, height: 2 });
    // Act:
    gl.endQuery(ANY_SAMPLES_PASSED);
    // Assert:
    expect(gl.getError()).toBe(INVALID_OPERATION);
    expect(gl.getParameter(CURRENT_QUERY)).toBe(null);
  });
});
