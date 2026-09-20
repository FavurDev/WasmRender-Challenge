# GLSL ES Compiler Front-End Pipeline

Phase 1, Sprint 3 — Status: Implemented & Verified.

## 1. Architecture & Pipeline Flow

Source String
-> Tokenizer (`src/glsl/tokenizer.ts`): lexes literals, keywords, operators; tracks line/col; emits `Token[]` or `{ ok: false, log }`.
-> Preprocessor (`src/glsl/preprocessor.ts`): expands macros and conditional directives (`#if`, `#ifdef`, `#version` on line 1); returns preprocessed `Token[]`.
-> Parser (`src/glsl/parser.ts`): recursive-descent AST construction with nesting-depth cap; returns `TranslationUnit`.
-> Checker (`src/glsl/checker.ts`): scoped type-check, function signatures, dialect gating (100 vs 300); returns `CheckedShader`.
-> CheckedShader AST representation (consumed by Sprint 4 linker and interpreter).

## 2. Error Handling & Diagnostic Contract

Diagnostics-as-data: never throws, no console logs in `src/`. Result type is the discriminated union `CompileResult<T> = { ok: true; tokens: T } | { ok: false; log: string }`. Diagnostic format: `ERROR: <shaderId>:<line>: <message>` via `formatDiagnostic`.

## 3. Smoke Verification & Usage

1. `npm run test` (or `npx vitest run`): runs unit and integration tests.
2. `npm run typecheck` (or `npx tsc --noEmit`): typechecks the project under strict mode.
3. `npm run smoke` (or `npx tsx scripts/glsl-smoke.ts`): executes the standalone smoke runner over representative ES 1.00/3.00 vertex/fragment shaders; exits 0 on all-pass, 1 on any failure.
