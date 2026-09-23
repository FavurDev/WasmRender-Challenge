/** Sprint 10 Task 4 coverage wave 1 — query-sync.ts behavioral coverage (7 tests). */
import { describe, expect, it } from 'vitest';
import { QuerySyncManager } from '../../src/gl/query-sync';
import { WebGL2Context } from '../../src/gl/webgl2-context';
import {
  ALREADY_SIGNALED,
  ANY_SAMPLES_PASSED,
  ANY_SAMPLES_PASSED_CONSERVATIVE,
  CONDITION_SATISFIED,
  CURRENT_QUERY,
  INVALID_ENUM,
  INVALID_OPERATION,
  INVALID_VALUE,
  OBJECT_TYPE,
  QUERY_RESULT,
  QUERY_RESULT_AVAILABLE,
  SIGNALED,
  SYNC_CONDITION,
  SYNC_FENCE,
  SYNC_FLAGS,
  SYNC_FLUSH_COMMANDS_BIT,
  SYNC_GPU_COMMANDS_COMPLETE,
  SYNC_STATUS,
  TIME_ELAPSED_EXT,
  WAIT_FAILED,
} from '../../src/gl/constants';

describe('query-sync-coverage: sync lifecycle', () => {
  it('q01 fenceSync creates a live sync object', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    // Act:
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Assert:
    expect(sync).not.toBe(null);
    expect(mgr.isSync(sync)).toBe(true);
  });

  it('q02 clientWaitSync on fresh fence reports already signaled', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Act:
    const status = mgr.clientWaitSync(sync, 0, 0);
    // Assert:
    expect(status).toBe(ALREADY_SIGNALED);
  });

  it('q03 getSyncParameter reports fence type, condition, and signaled status', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Act:
    const type = mgr.getSyncParameter(sync, OBJECT_TYPE);
    const cond = mgr.getSyncParameter(sync, SYNC_CONDITION);
    const status = mgr.getSyncParameter(sync, SYNC_STATUS);
    // Assert:
    expect(type).toBe(SYNC_FENCE);
    expect(cond).toBe(SYNC_GPU_COMMANDS_COMPLETE);
    expect(status).toBe(SIGNALED);
  });

  it('q04 deleteSync invalidates the sync object', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    // Act:
    mgr.deleteSync(sync);
    // Assert:
    expect(mgr.isSync(sync)).toBe(false);
  });

  it('q05 occlusion query begin/end makes result available with count', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const q = mgr.createQuery();
    // Act:
    mgr.beginQuery(ANY_SAMPLES_PASSED, q);
    mgr.incrementSampleCount(3);
    mgr.endQuery(ANY_SAMPLES_PASSED);
    // Assert:
    expect(mgr.getQueryParameter(q, QUERY_RESULT_AVAILABLE)).toBe(true);
    expect(mgr.getQueryParameter(q, QUERY_RESULT)).toBe(3);
  });

  it('q06 facade CURRENT_QUERY tracks active query then clears', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 2, height: 2 });
    const q = gl.createQuery();
    // Act:
    gl.beginQuery(ANY_SAMPLES_PASSED, q);
    const during = gl.getQuery(ANY_SAMPLES_PASSED, CURRENT_QUERY);
    gl.endQuery(ANY_SAMPLES_PASSED);
    const afterActive = gl.getQuery(ANY_SAMPLES_PASSED, CURRENT_QUERY);
    // Assert: getQuery surfaces the active wrapper; the facade intercepts
    // getParameter(CURRENT_QUERY) to null by design (see getParameter override).
    expect(during).toBe(q);
    expect(afterActive).toBe(null);
  });

  it('q07 facade error paths: bad beginQuery target and stray endQuery', () => {
    // Arrange:
    const gl = new WebGL2Context({ width: 2, height: 2 });
    const q = gl.createQuery();
    // Act:
    gl.beginQuery(0x9999, q);
    const badTarget = gl.getError();
    gl.endQuery(ANY_SAMPLES_PASSED);
    const strayEnd = gl.getError();
    // Assert:
    expect(badTarget).toBe(INVALID_ENUM);
    expect(strayEnd).toBe(INVALID_OPERATION);
    expect(CONDITION_SATISFIED).not.toBe(ALREADY_SIGNALED);
  });
});

describe('query-sync-coverage: validation and extended lifecycle', () => {
  it('q08 fenceSync rejects bad condition and nonzero flags', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    // Act:
    const badCond = mgr.fenceSync(0x9999, 0);
    const errCond = mgr.getErrorSink().getError();
    const badFlags = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 1);
    const errFlags = mgr.getErrorSink().getError();
    // Assert:
    expect(badCond).toBe(null);
    expect(errCond).toBe(INVALID_ENUM);
    expect(badFlags).toBe(null);
    expect(errFlags).toBe(INVALID_VALUE);
  });

  it('q09 clientWaitSync validates flags, timeout, deleted and null syncs', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (sync === null) throw new Error('arrange: fenceSync failed');
    // Act: flush-bit path returns CONDITION_SATISFIED, never TIMEOUT_EXPIRED.
    const flushed = mgr.clientWaitSync(sync, SYNC_FLUSH_COMMANDS_BIT, 0);
    const badFlags = mgr.clientWaitSync(sync, 0xffff, 0);
    const errFlags = mgr.getErrorSink().getError();
    const negTimeout = mgr.clientWaitSync(sync, 0, -1);
    const errTimeout = mgr.getErrorSink().getError();
    const nullRes = mgr.clientWaitSync(null, 0, 0);
    const errNull = mgr.getErrorSink().getError();
    mgr.deleteSync(sync);
    const deletedRes = mgr.clientWaitSync(sync, 0, 0);
    const errDeleted = mgr.getErrorSink().getError();
    // Assert:
    expect(flushed).toBe(CONDITION_SATISFIED);
    expect(badFlags).toBe(WAIT_FAILED);
    expect(errFlags).toBe(INVALID_VALUE);
    expect(negTimeout).toBe(WAIT_FAILED);
    expect(errTimeout).toBe(INVALID_VALUE);
    expect(nullRes).toBe(WAIT_FAILED);
    expect(errNull).toBe(INVALID_VALUE);
    expect(deletedRes).toBe(WAIT_FAILED);
    expect(errDeleted).toBe(INVALID_VALUE);
  });

  it('q10 waitSync validates flags and timeout values', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (sync === null) throw new Error('arrange: fenceSync failed');
    // Act:
    mgr.waitSync(sync, 1, 0);
    const errFlags = mgr.getErrorSink().getError();
    mgr.waitSync(sync, 0, 100);
    const errTimeout = mgr.getErrorSink().getError();
    mgr.waitSync(sync, 0, 0);
    const okZero = mgr.getErrorSink().getError();
    mgr.waitSync(sync, 0, -1);
    const okIgnored = mgr.getErrorSink().getError();
    mgr.waitSync(null, 0, 0);
    const errNull = mgr.getErrorSink().getError();
    // Assert:
    expect(errFlags).toBe(INVALID_VALUE);
    expect(errTimeout).toBe(INVALID_VALUE);
    expect(okZero).toBe(0);
    expect(okIgnored).toBe(0);
    expect(errNull).toBe(INVALID_VALUE);
  });

  it('q11 getSyncParameter covers SYNC_FLAGS and invalid pname/sync', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const sync = mgr.fenceSync(SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (sync === null) throw new Error('arrange: fenceSync failed');
    // Act:
    const flags = mgr.getSyncParameter(sync, SYNC_FLAGS);
    const bad = mgr.getSyncParameter(sync, 0xffff);
    const errBad = mgr.getErrorSink().getError();
    const nullRes = mgr.getSyncParameter(null, OBJECT_TYPE);
    const errNull = mgr.getErrorSink().getError();
    // Assert:
    expect(flags).toBe(0);
    expect(bad).toBe(null);
    expect(errBad).toBe(INVALID_ENUM);
    expect(nullRes).toBe(null);
    expect(errNull).toBe(INVALID_VALUE);
  });

  it('q12 isQuery tracks target assignment; deleteQuery clears active state', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const q = mgr.createQuery();
    if (q === null) throw new Error('arrange: createQuery failed');
    // Act:
    const before = mgr.isQuery(q);
    mgr.beginQuery(ANY_SAMPLES_PASSED, q);
    const during = mgr.isQuery(q);
    mgr.deleteQuery(q);
    const afterDelete = mgr.isQuery(q);
    const nullCheck = mgr.isQuery(null);
    // Assert:
    expect(before).toBe(false);
    expect(during).toBe(true);
    expect(afterDelete).toBe(false);
    expect(nullCheck).toBe(false);
  });

  it('q13 beginQuery/endQuery reject nested, mismatched, and inactive lifecycles', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const q1 = mgr.createQuery();
    const q2 = mgr.createQuery();
    if (q1 === null || q2 === null) throw new Error('arrange: createQuery failed');
    // Act:
    mgr.beginQuery(ANY_SAMPLES_PASSED, q1);
    mgr.beginQuery(ANY_SAMPLES_PASSED, q2);
    const nestedErr = mgr.getErrorSink().getError();
    mgr.beginQuery(ANY_SAMPLES_PASSED_CONSERVATIVE, q1);
    const mismatchErr = mgr.getErrorSink().getError();
    mgr.endQuery(ANY_SAMPLES_PASSED);
    mgr.endQuery(ANY_SAMPLES_PASSED);
    const strayErr = mgr.getErrorSink().getError();
    mgr.endQuery(0xffff);
    const badTargetErr = mgr.getErrorSink().getError();
    // Assert:
    expect(nestedErr).toBe(INVALID_OPERATION);
    expect(mismatchErr).toBe(INVALID_OPERATION);
    expect(strayErr).toBe(INVALID_OPERATION);
    expect(badTargetErr).toBe(INVALID_ENUM);
  });

  it('q14 timer query lifecycle returns zeros with available result', () => {
    // Arrange:
    const mgr = new QuerySyncManager();
    const q = mgr.createQuery();
    if (q === null) throw new Error('arrange: createQuery failed');
    // Act:
    mgr.beginQuery(TIME_ELAPSED_EXT, q);
    mgr.endQuery(TIME_ELAPSED_EXT);
    const avail = mgr.getQueryParameter(q, QUERY_RESULT_AVAILABLE);
    const val = mgr.getQueryParameter(q, QUERY_RESULT);
    // Assert:
    expect(avail).toBe(true);
    expect(val).toBe(0);
  });
});
