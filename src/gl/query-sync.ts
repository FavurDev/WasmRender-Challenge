/** QuerySyncManager — L2 sync + occlusion query state machines. Imports L0 constants and L1 errors only. */
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
} from './constants';
import type { GLbitfield, GLenum } from './constants';
import { ErrorSink } from './errors';
import type { IErrorSink } from './errors';

export interface SyncObject {
  readonly id: number;
  alive: boolean;
  readonly condition: GLenum;
  readonly flags: GLbitfield;
  status: GLenum;
}

export interface QueryObject {
  readonly id: number;
  alive: boolean;
  target: GLenum | 0;
  active: boolean;
  result: number;
  resultAvailable: boolean;
}

export class WebGLSync {
  public constructor(public readonly handle: SyncObject) {}
}

export class WebGLQuery {
  public constructor(public readonly handle: QueryObject) {}
}

function isValidQueryTarget(target: GLenum): boolean {
  return target === ANY_SAMPLES_PASSED || target === ANY_SAMPLES_PASSED_CONSERVATIVE || target === TIME_ELAPSED_EXT;
}

export class QuerySyncManager {
  private readonly errorSink: IErrorSink;
  private nextId = 1;
  private readonly syncs = new Map<number, SyncObject>();
  private readonly queries = new Map<number, QueryObject>();
  private readonly activeQueries = new Map<GLenum, QueryObject>();
  private readonly queryWrappers = new Map<number, WebGLQuery>();

  public constructor(errorSink?: IErrorSink | null) {
    this.errorSink = errorSink ?? new ErrorSink();
  }

  public getErrorSink(): IErrorSink {
    return this.errorSink;
  }

  public fenceSync(condition: GLenum, flags: GLbitfield): WebGLSync | null {
    return this.createFenceSync(condition, flags);
  }

  public createFenceSync(condition: GLenum, flags: GLbitfield): WebGLSync | null {
    if (condition !== SYNC_GPU_COMMANDS_COMPLETE) {
      this.errorSink.recordError(INVALID_ENUM);
      return null;
    }
    if (flags !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return null;
    }
    const handle: SyncObject = { id: this.nextId++, alive: true, condition, flags, status: SIGNALED };
    this.syncs.set(handle.id, handle);
    return new WebGLSync(handle);
  }

  public deleteSync(sync: WebGLSync | null): void {
    if (sync === null || sync === undefined || sync.handle === undefined) return;
    const handle = sync.handle;
    if (handle.alive) {
      handle.alive = false;
      this.syncs.delete(handle.id);
    }
  }

  public isSync(sync: WebGLSync | null): boolean {
    if (sync === null || sync === undefined || sync.handle === undefined) return false;
    const handle = sync.handle;
    return handle.alive === true && this.syncs.has(handle.id);
  }

  public clientWaitSync(sync: WebGLSync | null, flags: GLbitfield, timeout: number): GLenum {
    if (sync === null || sync === undefined || sync.handle === undefined) {
      this.errorSink.recordError(INVALID_VALUE);
      return WAIT_FAILED;
    }
    const handle = sync.handle;
    if (handle.alive === false || !this.syncs.has(handle.id)) {
      this.errorSink.recordError(INVALID_VALUE);
      return WAIT_FAILED;
    }
    if ((flags & ~SYNC_FLUSH_COMMANDS_BIT) !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return WAIT_FAILED;
    }
    if (timeout < 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return WAIT_FAILED;
    }
    if ((flags & SYNC_FLUSH_COMMANDS_BIT) !== 0) return CONDITION_SATISFIED;
    return ALREADY_SIGNALED;
  }

  public waitSync(sync: WebGLSync | null, flags: GLbitfield, timeout: number): void {
    if (sync === null || sync === undefined || sync.handle === undefined) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    const handle = sync.handle;
    if (handle.alive === false || !this.syncs.has(handle.id)) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (flags !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
    if (timeout !== -1 && timeout !== 0) {
      this.errorSink.recordError(INVALID_VALUE);
      return;
    }
  }

  public getSyncParameter(sync: WebGLSync | null, pname: GLenum): unknown {
    if (sync === null || sync === undefined || sync.handle === undefined) {
      this.errorSink.recordError(INVALID_VALUE);
      return null;
    }
    const handle = sync.handle;
    if (handle.alive === false || !this.syncs.has(handle.id)) {
      this.errorSink.recordError(INVALID_VALUE);
      return null;
    }
    if (pname === OBJECT_TYPE) return SYNC_FENCE;
    if (pname === SYNC_STATUS) return SIGNALED;
    if (pname === SYNC_CONDITION) return handle.condition;
    if (pname === SYNC_FLAGS) return handle.flags;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  public createQuery(): WebGLQuery | null {
    const handle: QueryObject = { id: this.nextId++, alive: true, target: 0, active: false, result: 0, resultAvailable: false };
    this.queries.set(handle.id, handle);
    const wrapper = new WebGLQuery(handle);
    this.queryWrappers.set(handle.id, wrapper);
    return wrapper;
  }

  public deleteQuery(query: WebGLQuery | null): void {
    if (query === null || query === undefined || query.handle === undefined) return;
    const handle = query.handle;
    if (handle.alive) {
      handle.alive = false;
      if (handle.active) {
        handle.active = false;
        if (this.activeQueries.get(handle.target as GLenum) === handle) this.activeQueries.delete(handle.target as GLenum);
      }
      this.queries.delete(handle.id);
    }
  }

  public isQuery(query: WebGLQuery | null): boolean {
    if (query === null || query === undefined || query.handle === undefined) return false;
    const handle = query.handle;
    return handle.alive === true && this.queries.has(handle.id) && handle.target !== 0;
  }

  public beginQuery(target: GLenum, query: WebGLQuery | null): void {
    if (!isValidQueryTarget(target)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    if (query === null || query === undefined || query.handle === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    const handle = query.handle;
    if (handle.alive === false || !this.queries.has(handle.id)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (handle.active === true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (handle.target !== 0 && handle.target !== target) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    if (this.activeQueries.has(target)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    handle.target = target;
    handle.active = true;
    handle.result = 0;
    handle.resultAvailable = false;
    this.activeQueries.set(target, handle);
    this.queryWrappers.set(handle.id, query);
  }

  public endQuery(target: GLenum): void {
    if (!isValidQueryTarget(target)) {
      this.errorSink.recordError(INVALID_ENUM);
      return;
    }
    const handle = this.activeQueries.get(target);
    if (handle === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return;
    }
    handle.active = false;
    handle.resultAvailable = true;
    this.activeQueries.delete(target);
  }

  public getQuery(target: GLenum, pname: GLenum): unknown {
    if (!isValidQueryTarget(target)) {
      this.errorSink.recordError(INVALID_ENUM);
      return null;
    }
    if (pname === CURRENT_QUERY) {
      const active = this.activeQueries.get(target);
      if (active === undefined || active === null) return null;
      const existing = this.queryWrappers.get(active.id);
      if (existing !== undefined) return existing;
      const wrapper = new WebGLQuery(active);
      this.queryWrappers.set(active.id, wrapper);
      return wrapper;
    }
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  public getQueryParameter(query: WebGLQuery | null, pname: GLenum): unknown {
    if (query === null || query === undefined || query.handle === undefined) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    const handle = query.handle;
    if (handle.alive === false || !this.queries.has(handle.id)) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    if (handle.active === true) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    if (handle.target === 0) {
      this.errorSink.recordError(INVALID_OPERATION);
      return null;
    }
    if (pname === QUERY_RESULT) return handle.result;
    if (pname === QUERY_RESULT_AVAILABLE) return handle.resultAvailable;
    this.errorSink.recordError(INVALID_ENUM);
    return null;
  }

  public getActiveQuery(target: GLenum): QueryObject | null {
    return this.activeQueries.get(target) ?? null;
  }

  public incrementSampleCount(count = 1): void {
    const a = this.activeQueries.get(ANY_SAMPLES_PASSED);
    if (a !== undefined && a.active === true) a.result += count;
    const b = this.activeQueries.get(ANY_SAMPLES_PASSED_CONSERVATIVE);
    if (b !== undefined && b.active === true) b.result += count;
  }

  public hasActiveOcclusionQuery(): boolean {
    return this.activeQueries.has(ANY_SAMPLES_PASSED) || this.activeQueries.has(ANY_SAMPLES_PASSED_CONSERVATIVE);
  }
}
