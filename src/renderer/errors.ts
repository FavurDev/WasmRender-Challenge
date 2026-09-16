/**
 * @fileoverview FIFO error-code queue and named diagnostic types.
 */
// CHANGELOG:
// - Sprint 1: Created FIFO error queue (cap 8) and named diagnostic error classes.
import { NO_ERROR } from "./gl-constants";

/** Maximum entries retained in the error queue. */
const MAX_QUEUE_LENGTH = 8;

/**
 * Compile failure diagnostic carrying message text and 1-based line number.
 *
 * @param message Diagnostic detail text.
 * @param line 1-based source line number.
 */
export class ShaderCompileError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(message);
    this.name = "ShaderCompileError";
    this.line = line;
  }
}

/**
 * Link failure diagnostic carrying message text.
 *
 * @param message Diagnostic detail text.
 */
export class ProgramLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProgramLinkError";
  }
}

/**
 * API misuse: unrecognized enum.
 *
 * @param message Optional diagnostic detail text.
 */
export class InvalidEnumError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidEnumError";
  }
}

/**
 * API misuse: out-of-range value.
 *
 * @param message Optional diagnostic detail text.
 */
export class InvalidValueError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidValueError";
  }
}

/**
 * API misuse: illegal operation for current state.
 *
 * @param message Optional diagnostic detail text.
 */
export class InvalidOperationError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidOperationError";
  }
}

/**
 * Allocation failure diagnostic.
 *
 * @param message Optional diagnostic detail text.
 */
export class OutOfMemoryError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "OutOfMemoryError";
  }
}

/**
 * Missing renderer bundle diagnostic.
 *
 * @param message Optional diagnostic detail text.
 */
export class RendererNotFoundError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "RendererNotFoundError";
  }
}

/**
 * Append a code to the FIFO queue, capped at 8, preserving earliest entries.
 *
 * @param queue Mutable error queue owned by the caller.
 * @param code GL error code to append.
 */
export function pushError(queue: number[], code: number): void {
  if (queue.length >= MAX_QUEUE_LENGTH) return;
  queue.push(code);
}

/**
 * Remove and return the head of the FIFO queue, or the empty sentinel.
 *
 * @param queue Mutable error queue owned by the caller.
 * @returns Head code, or NO_ERROR when empty.
 */
export function drainError(queue: number[]): number {
  if (queue.length === 0) return NO_ERROR;
  const head = queue.shift();
  return head === undefined ? NO_ERROR : head;
}
