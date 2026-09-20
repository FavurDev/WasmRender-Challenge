// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial sticky error queue
/** ErrorSink — sticky single-slot WebGL error queue. L1: imports L0 constants only, never throws. */
import { CONTEXT_LOST_WEBGL, NO_ERROR } from './constants';
import type { GLenum } from './constants';

export interface IErrorSink {
  recordError(code: GLenum): void;
  getError(): GLenum;
  reset(): void;
  setContextLost(lost: boolean): void;
  isContextLost(): boolean;
}

export class ErrorSink implements IErrorSink {
  private pendingError: GLenum = NO_ERROR;
  private contextLost = false;
  private contextLostReported = false;

  recordError(code: GLenum): void {
    if (code === NO_ERROR) {
      return;
    }
    if (this.contextLost) {
      return;
    }
    if (this.pendingError === NO_ERROR) {
      this.pendingError = code;
    }
  }

  getError(): GLenum {
    if (this.contextLost) {
      if (!this.contextLostReported) {
        this.contextLostReported = true;
        this.pendingError = NO_ERROR;
        return CONTEXT_LOST_WEBGL;
      }
      return NO_ERROR;
    }
    const currentCode = this.pendingError;
    this.pendingError = NO_ERROR;
    return currentCode;
  }

  reset(): void {
    this.pendingError = NO_ERROR;
    this.contextLost = false;
    this.contextLostReported = false;
  }

  setContextLost(lost: boolean): void {
    this.contextLost = lost;
    this.contextLostReported = false;
    if (lost) {
      this.pendingError = NO_ERROR;
    }
  }

  isContextLost(): boolean {
    return this.contextLost;
  }
}
