# Statement of Work — Pure-JS WebGL Software Renderer (terminal-bench/wasm-render)

## Overview

This project delivers a pure TypeScript software renderer that implements the WebGL 1.0 (`WebGLRenderingContext`) and WebGL 2.0 (`WebGL2RenderingContext`) APIs entirely on the CPU with zero runtime dependencies, no browser GPU, and no native modules. The single-file browser bundle `renderer.js` at the workspace root defines `window.__createSoftwareWebGLContext(canvas, attrs)`; the existing harness `src/context-intercept.ts` injects that bundle via Playwright `addInitScript()` and routes every `canvas.getContext('webgl' | 'webgl2' | 'experimental-webgl')` call through it. Target users are the headless-browser conformance harness and downstream WebGL content (including Khronos CTS-style tests) that expect a normal WebGL context. Scope boundary: full state machine, GLSL ES 1.00/3.00 compilation to CPU interpreter closures, bounding-box barycentric triangle rasterization with perspective-correct varyings, framebuffer/depth/stencil/blend/scissor/texture/readback semantics, and deterministic pixel output presented via 2D canvas `putImageData`. Out of scope: GPU acceleration, ANGLE/native bindings, WASM toolchain builds, extensions requiring hardware video codecs, and MSAA resolve. Stresses: (a) API-surface fidelity across WebGL1 plus WebGL2 additions; (b) GLSL version-gated compilation with exact error signalling; (c) deterministic CPU rasterization verified by golden-pixel tests.

## Goals

- **SG1**: Headless pages obtain a working WebGL1/WebGL2 context from `window.__createSoftwareWebGLContext` through the existing intercept with no GPU present.
- **SG2**: Rendered pixels match golden expectations for clear, triangle, depth, blend, and texture cases within stated tolerances.
- **SG3**: Identical inputs produce byte-identical framebuffers across runs, workers, and machines (deterministic software pipeline).
- **SG4**: The shipped `renderer.js` is a single self-contained browser bundle with zero runtime npm dependencies.
- **SG5**: The full `vitest run` suite (unit plus Playwright conformance) passes with zero failures under the pinned toolchain.
- **SG6**: Rasterization throughput meets the stated frame budgets for the reference scenes on commodity CI hardware.

## Requirements

| ID | Requirement | Priority |
|---|---|---|
| SOW-REQ-001 | Renderer exposes `window.__createSoftwareWebGLContext(canvas, attrs)` returning an object implementing the WebGL1 context interface; `canvas.getContext('webgl')`, `'experimental-webgl'`, and `'webgl2'` routed via `buildInterceptScript()` return that object when the factory exists. | Must |
| SOW-REQ-002 | WebGL1 core state machine implemented: buffers, shaders, programs, textures, framebuffers, renderbuffers, attributes, uniforms, `viewport`, `clear`, `clearColor`, `clearDepth`, `enable`/`disable`, `getError`, `getParameter`, `drawArrays`, `drawElements` with `TRIANGLES` primitive. | Must |
| SOW-REQ-003 | WebGL2 additions implemented: `drawArraysInstanced`, `drawElementsInstanced`, `drawBuffers` with 4 color attachments, `vertexAttribDivisor`, `createVertexArray`/`bindVertexArray`, `R32F`/`RGBA32F` texture internal formats backed by `Float32Array`, `DEPTH24_STENCIL8` renderbuffer format. | Must |
| SOW-REQ-004 | GLSL ES 1.00 shaders (`#version 100` optional, `attribute`/`varying`, `gl_FragColor`, implicit int-to-float conversion allowed) compile and link. | Must |
| SOW-REQ-005 | GLSL ES 3.00 shaders (`#version 300 es` mandatory on first line, `in`/`out`, user `out vec4` with `layout(location=0)`, no implicit conversions, `texture()` builtin) compile and link; missing version line falls back to ES 1.00 parsing. | Must |
| SOW-REQ-006 | Failed `compileShader` sets `COMPILE_STATUS=false`, populates `getShaderInfoLog` with `LINE <n>: <message>` text, and failed `linkProgram` sets `LINK_STATUS=false` with `getProgramInfoLog` text; `getError` returns `NO_ERROR` for these (status-flag errors, not error-queue errors). | Must |
| SOW-REQ-007 | CPU rasterizer uses bounding-box plus barycentric edge functions, top-left fill rule, perspective-correct varying interpolation (`a/w` interpolation with `1/w` recovery), and NDC `[-1,1]` to viewport mapping. | Must |
| SOW-REQ-008 | Default framebuffer is a `Uint8ClampedArray` RGBA buffer of `width*height*4` bytes plus `Float32Array` depth (init 1.0) plus `Uint8Array` stencil (init 0); `clear` honors `clearColor` quantized to bytes, `clearDepth`, `clearStencil`, and color/depth/stencil write masks. | Must |
| SOW-REQ-009 | Per-fragment pipeline order is scissor test, stencil test, depth test (all 8 `depthFunc` modes `NEVER/LESS/EQUAL/LEQUAL/GREATER/NOTEQUAL/GEQUAL/ALWAYS`, default `LESS`), then blend (`FUNC_ADD/SUBTRACT/REVERSE_SUBTRACT`, full `blendFunc` factor set, default `ONE,ZERO`), then `depthMask`/`colorMask` writes. | Must |
| SOW-REQ-010 | Texturing supports `TEXTURE_2D` with `NEAREST`/`LINEAR` min/mag filters, `CLAMP_TO_EDGE`/`REPEAT`/`MIRRORED_REPEAT` wrap, `RGBA/UNSIGNED_BYTE` upload from `Uint8Array`, mipmap level 0 minimum, and 2D texture sampling in fragment shaders. | Must |
| SOW-REQ-011 | `readPixels` returns exact bytes for `RGBA/UNSIGNED_BYTE`; `canvas.toDataURL()` and 2D-canvas presentation via `putImageData` reflect the framebuffer after each draw when `preserveDrawingBuffer=true`. | Must |
| SOW-REQ-012 | Invalid-enum/value/operation paths push exactly one code onto the `getError` queue (`INVALID_ENUM=0x0500`, `INVALID_VALUE=0x0501`, `INVALID_OPERATION=0x0502`, `OUT_OF_MEMORY=0x0505`, `CONTEXT_LOST_WEBGL=0x9242`); `getError` drains FIFO and returns `NO_ERROR=0` when empty. | Must |
| SOW-REQ-013 | Bundle constraint: `renderer.js` is produced by esbuild with `bundle:true`, `outfile:renderer.js`, `format:iife`, `platform:browser`, `target:es2022`; zero `require`/`import` of npm packages at runtime; max 800 KB minified. | Must |
| SOW-REQ-014 | Determinism: same canvas size, shader sources, vertex data, and state sequence produce byte-identical `Uint8ClampedArray` output; no `Math.random`, no `Date.now`, no unseeded iteration order in the draw path. | Must |
| SOW-REQ-015 | Test gates: `npm test` (`vitest run tests/**/*.test.ts`) passes 100 percent, `npx tsc --noEmit` passes with zero errors, and the Playwright CTS-subset completes within the 120 s per-test timeout. | Must |
| SOW-REQ-016 | Performance: 64x64 clear plus single-triangle draw completes in under 50 ms, and the 256x256 textured-quad reference scene completes in under 500 ms on GitHub-Actions `ubuntu-latest` 2-vCPU runners. | Should |

## Reference Documents & File Locations

- Khronos WebGL 1.0 specification (https://www.khronos.org/registry/webgl/specs/1.0/) — WebGL1 API surface, error semantics, state defaults.
- Khronos WebGL 2.0 specification (https://www.khronos.org/registry/webgl/specs/2.0/) — WebGL2 additions: VAOs, instancing, drawBuffers, 3D textures subset.
- Khronos GLSL ES 1.00 specification (https://www.khronos.org/registry/OpenGL/specs/es/2.0/GLSL_ES_Specification_1.00.pdf) — ES 1.00 grammar, attribute/varying, builtins.
- Khronos GLSL ES 3.00 specification (https://www.khronos.org/registry/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) — ES 3.00 grammar, in/out, layout qualifiers, type safety.
- Khronos webgl-conformance-tests harness (`sdk/tests/webgl-conformance-tests.html`, `WebGLTestUtils.create3DContext`, `checkCanvas`) — test patterns mirrored by the CTS subset.
- TypeScript 5.8.3 documentation (https://www.typescriptlang.org/docs/) — strict-mode language pinned in `package.json`.
- Vitest 3.1.2 documentation (https://vitest.dev/) — test runner matching `tests/**/*.test.ts` with 120 s timeout per `vitest.config.ts`.
- Playwright 1.52.0 documentation (https://playwright.dev/docs/api/class-page#page-add-init-script) — `addInitScript` injection used by `src/context-intercept.ts`.
- esbuild bundle API documentation (https://esbuild.github.io/api/#bundle) — single-file `iife` browser bundling for `renderer.js`.
- This SOW template: `template://statement-of-work` — structural authority for all 15 required sections.
- Traceability seed: `file://sow.md` (imported harbor task `terminal-bench/wasm-render`, `instruction_sha256 15338702df69cc3ec86de1335bd9a9c95007f7f3ed69cd0fefbd7a907d22f3a5`).

## Working Agreement

The implementation language is TypeScript 5.8.3 under `strict:true`, target ES2022, module ESNext with bundler resolution per `tsconfig.json`; the browser bundle is built with esbuild (`bundle:true`, `outfile:renderer.js`, `format:iife`, `platform:browser`, `target:es2022`) and checked into the workspace root as `renderer.js`. Dependency management uses npm with `package-lock.json`; no Poetry, no `requirements.txt`, no native addons, no GPU libraries, no WASM toolchain. Source follows src-layout: hand-written harness in `src/context-intercept.ts` plus new renderer sources under `src/renderer/`; tests live under `tests/unit/` (Node vitest, no browser) and `tests/conformance/` (Playwright Chromium, headless) with pixel goldens under `tests/golden/` compared via `sharp` 0.33.5. Test isolation is per-file fresh contexts (each test creates its own canvas plus software context; no shared GL state); determinism is mandatory (no randomness, clocks, or async raster work in the draw path). Session lifecycle is per-context (all GL objects die with their context; no globals leak between `__createSoftwareWebGLContext` calls). In scope: WebGL1 core, the WebGL2 subset in SOW-REQ-003, GLSL ES 1.00/3.00 compilation to CPU closures, CPU rasterization, and harness routing. Out of scope: GPU paths, MSAA/multisample resolve, video-codec texture formats, compressed-texture extensions beyond `COMPRESSED_TEXTURE_FORMATS` reporting empty, and concurrent multi-context resource sharing. Non-negotiable conventions: typed-array-only pixel paths (no per-pixel object allocation), explicit numeric defaults matching the WebGL specs (e.g. clear color 0,0,0,0; depth func LESS; blend disabled), and no speculative abstraction beyond the file plan in Project Structure.

## Pre-Implementation Research

- Spike 1 — CPU rasterizer pattern: surveyed JS software rasterizers (TinyRenderer ports, scanline versus bounding-box barycentric). Outcome — verified: bounding-box plus barycentric edge functions with `Float32Array` depth and top-left fill rule is the simplest correct choice; source: ssloy TinyRenderer lessons and KitsuneGames JS rasterization series.
- Spike 2 — GLSL version gating: compared GLSL ES 1.00 (`#version 100` optional, `attribute`/`varying`, permissive conversions) against GLSL ES 3.00 (`#version 300 es` mandatory first line, `in`/`out`, type-safe with no implicit conversions). Outcome — verified: front end must branch on the first-line version directive and maintain two builtin/keyword tables; confirmed via Khronos GLSL ES 1.00 and 3.00 specification PDFs.
- Spike 3 — Harness routing: read `src/context-intercept.ts` (`getRendererPath` defaults `./renderer.js` with `WEBGL_SOFTWARE_RENDERER` override; `buildInterceptScript` prepends renderer source and overrides `getContext` for `webgl`/`webgl2`/`experimental-webgl`). Outcome — verified: renderer needs only to define `window.__createSoftwareWebGLContext`; interception, RENDERER_NOT_FOUND stub, and Playwright injection already exist; confirmed by direct source read.
- Spike 4 — Single-file bundle: reviewed esbuild `bundle:true` with `outfile`, `format:iife`, `platform:browser` semantics and the `metafile` self-containment check. Outcome — verified: a dependency-free TS tree bundles to one IIFE file with no runtime imports; version pin: esbuild via npx (no new dependency; build script uses `npx esbuild`).
- Spike 5 — Typed-array framebuffer: confirmed `ImageData.data` is a `Uint8ClampedArray` in RGBA order consumable by `putImageData`, and `Float32Array` depth plus `Uint8Array` stencil cover the depth/stencil attachments. Outcome — verified: color/depth/stencil triple backed by typed arrays is the correct hot-path representation; source: MDN ImageData documentation.
- Spike 6 — CTS-subset strategy: reviewed `webgl-conformance-tests.html` (`?run=1`, `WebGLTestUtils.create3DContext`, `checkCanvas`) and the Node `gl-conformance` plus `headless-gl` port pattern. Outcome — verified: mirroring a 40-case subset (context creation, clear, triangles, depth, blend, textures, WebGL2-only) under Playwright with golden-pixel comparison is feasible within the 120 s timeout; full CTS import is out of scope.

## Project Structure

```
renderer.js
src/
  context-intercept.ts
  renderer/
    context.ts
    gl-constants.ts
    state.ts
    errors.ts
    shader-compiler/
      tokenizer.ts
      parser.ts
      typechecker.ts
      builtins-100.ts
      builtins-300.ts
      codegen.ts
    program.ts
    rasterizer.ts
    framebuffer.ts
    texture.ts
    buffer.ts
    renderbuffer.ts
    extensions.ts
  build-bundle.ts
tests/
  unit/
    shader-compiler.test.ts
    state-machine.test.ts
    rasterizer.test.ts
    framebuffer.test.ts
    errors.test.ts
  conformance/
    context-routing.test.ts
    clear.test.ts
    triangle.test.ts
    depth.test.ts
    blend.test.ts
    texture.test.ts
    webgl2.test.ts
    cts-subset.test.ts
  golden/
    red-triangle-64.png
    depth-overlap-64.png
    blend-50pct-64.png
    textured-quad-256.png
visual-proof/
  first-triangle.png
  manifest.json
package.json
vitest.config.ts
tsconfig.json
sow.md
```

## Implementation Details

### src/renderer/context.ts — SoftwareWebGLContext class, context factory

Exports `SoftwareWebGLContext` class (constructor `(canvas: HTMLCanvasElement, attrs: WebGLContextAttributes)`) and `createSoftwareWebGLContext(canvas, attrs)` assigned to `window.__createSoftwareWebGLContext` by the bundle footer. Owns `state: GLState`, `framebuffer: Framebuffer`, `programs: Map<number, GLProgram>`, `errorQueue: number[]`. Implements every WebGL1 entry point plus the WebGL2 subset (SOW-REQ-002/003); each method validates enums first (pushing `INVALID_ENUM`), then values, then operation preconditions. Invariants: exactly one context per factory call; `getError` never throws; all GL object handles are monotonically increasing integers starting at 1. Imports `state.ts`, `framebuffer.ts`, `program.ts`, `rasterizer.ts`; imported by the bundle footer only.

### src/renderer/gl-constants.ts — Numeric GL enum table

Exports 120 numeric constants (e.g. `TRIANGLES=0x0004`, `LESS=0x0201`, `RGBA=0x1908`, `UNSIGNED_BYTE=0x1401`, `INVALID_ENUM=0x0500`, `MAX_TEXTURE_SIZE=4096`, `MAX_VIEWPORT_DIMS=[4096,4096]`, `MAX_RENDERBUFFER_SIZE=4096`, `MAX_COLOR_ATTACHMENTS=4`). No logic; single source of truth for every enum comparison. Imported by `context.ts`, `state.ts`, `errors.ts`, and all test files.

### src/renderer/state.ts — GLState capability and binding store

Exports `GLState` class with fields `clearColor:[number,number,number,number]`, `clearDepth:number`, `clearStencil:number`, `depthTest:boolean`, `depthFunc:number`, `depthMask:boolean`, `blendEnabled:boolean`, `blendSrcRGB:number`, `blendDstRGB:number`, `blendEquation:number`, `scissorTest:boolean`, `scissorBox:[number,number,number,number]`, `viewport:[number,number,number,number]`, `activeTexture:number`, `boundArrayBuffer:number`, `boundElementArrayBuffer:number`, `currentProgram:number`. Methods `enable(cap)`, `disable(cap)`, `viewport(x,y,w,h)` with negative-size `INVALID_VALUE` checks. Defaults match specs: clear color `[0,0,0,0]`, depth func `LESS`, blend disabled. Imported by `context.ts` and `rasterizer.ts`.

### src/renderer/errors.ts — Error queue and named error types

Exports `ShaderCompileError(message,line)`, `ProgramLinkError(message)`, `InvalidEnumError`, `InvalidValueError`, `InvalidOperationError`, `OutOfMemoryError`, `RendererNotFoundError` classes plus `pushError(queue,code)` capping the queue at 8 entries and `drainError(queue):number`. Compile/link failures set status flags and info logs (never the error queue); API misuse pushes the codes in SOW-REQ-012. Imported by `context.ts` and `program.ts`; unit-covered in `tests/unit/errors.test.ts`.

### src/renderer/shader-compiler/tokenizer.ts — GLSL lexer

Exports `tokenize(source:string): Token[]` producing `Token{kind,lexeme,line}` for keywords, identifiers, floats, ints, operators, and preprocessor directives (`#version`, `#define`, `#ifdef`, `#endif`). Handles `//` and `/* */` comments; tracks 1-based line numbers for `LINE <n>` diagnostics. Throws `ShaderCompileError` on unterminated comments or bad numeric literals. Used only by `parser.ts`.

### src/renderer/shader-compiler/parser.ts — Recursive-descent grammar

Exports `parse(tokens:Token[], version:100|300): ASTProgram` with functions `parseTranslationUnit`, `parseDeclaration`, `parseFunction`, `parseStatement`, `parseExpression` (precedence-climbing through ternary, logical, bitwise, relational, additive, multiplicative, unary, postfix). Enforces version gating: `attribute`/`varying`/`gl_FragColor` legal only in 100; `in`/`out`/`layout` legal only in 300. Throws `ShaderCompileError` with line numbers on grammar violations.

### src/renderer/shader-compiler/typechecker.ts — Semantic validation

Exports `typecheck(program:ASTProgram, stage:'vertex'|'fragment', version): SymbolTable` enforcing: no implicit conversions in 300 (explicit constructor required), int-to-float allowed in 100 assignments only, `main(): void` present, vertex writes `gl_Position` (100) or matching `out` (300), fragment writes `gl_FragColor` (100) or declared `out vec4` (300), varying/in-out type match across stages at link time. Reports `ShaderCompileError('TYPE_MISMATCH ...')` and `ShaderCompileError('UNDECLARED ...')`.

### src/renderer/shader-compiler/builtins-100.ts and builtins-300.ts — Versioned builtin tables

Each exports `BUILTINS: Map<string, BuiltinSignature>` listing supported functions with argument and return types. The 100 table holds 42 entries (`radians`, `degrees`, `sin`…`texture2D`, `textureCube`, `dFdx` excluded); the 300 table holds 68 entries (`texture`, `textureLod`, `texelFetch`, `dFdx`, `dFdy`, `fwidth`, bit ops, integer overloads). Unknown builtins raise `ShaderCompileError('UNKNOWN_BUILTIN <name>')`.

### src/renderer/shader-compiler/codegen.ts — AST to CPU closures

Exports `compileVertex(ast,symbols): (attribs,uniforms)=>{position:[x,y,z,w],varyings}` and `compileFragment(ast,symbols): (varyings,uniforms,samplers)=>{color:[r,g,b,a]}`. Generated closures operate on plain number arrays (no allocation in inner loops beyond the return tuple). Entry `compileShaderSource(source,stage)` runs tokenize, version detection, parse, typecheck, codegen and returns `{bytecode, version}` or throws `ShaderCompileError`.

### src/renderer/program.ts — Program linking and uniform/attrib locations

Exports `GLProgram` class (`id`, `vertexBytecode`, `fragmentBytecode`, `attribLocations:Map<string,number>`, `uniformLocations:Map<string,WebGLUniformLocation>`, `linked:boolean`, `infoLog:string`) and `linkProgram(v,f): GLProgram` verifying stage version compatibility and varying signature match, else throwing `ProgramLinkError('VARYING_MISMATCH <name>')`. `getAttribLocation` returns 0..7 by declaration order or -1; `getUniformLocation` returns opaque `{id}` objects. Used by `context.ts` draw paths.

### src/renderer/rasterizer.ts — Triangle rasterization and fragment pipeline

Exports `rasterizeTriangle(ctx, v0, v1, v2)` performing clip-space divide, NDC-to-viewport mapping, bounding-box iteration, barycentric edge-function coverage with top-left rule, `1/w`-recovered perspective-correct varying interpolation, fragment-closure invocation, then scissor/stencil/depth/blend/mask application in SOW-REQ-009 order. Degenerate triangles (area 0) are skipped. Draw-call entries `drawArraysImpl`/`drawElementsImpl` handle `TRIANGLES` with `UNSIGNED_SHORT` indices and instanced divisors. Imports `framebuffer.ts`, `state.ts`.

### src/renderer/framebuffer.ts — Color/depth/stencil storage and presentation

Exports `Framebuffer` class (`width`, `height`, `color:Uint8ClampedArray`, `depth:Float32Array`, `stencil:Uint8Array`, `drawBuffers:number[]`) with `resize(w,h)`, `clear(mask)`, `readPixels(x,y,w,h,format,type):Uint8Array`, and `presentToCanvas(canvas)` via 2D context `putImageData`. Enforces `MAX_VIEWPORT_DIMS` 4096 and `MAX_RENDERBUFFER_SIZE` 4096; out-of-range allocation throws `OutOfMemoryError`. Backs the default framebuffer plus up to 4 `drawBuffers` attachments in WebGL2.

### src/renderer/texture.ts and buffer.ts and renderbuffer.ts — GPU object stores

`texture.ts` exports `TextureStore` (`createTexture`, `bindTexture`, `texImage2D` accepting `Uint8Array` RGBA level 0, `texParameteri` for filters/wrap, `sample2D(u,v)` with NEAREST/LINEAR and wrap modes). `buffer.ts` exports `BufferStore` (`createBuffer`, `bindBuffer`, `bufferData` copying `ArrayBufferView`, `getVertexAttrib` stride/offset decoding). `renderbuffer.ts` exports `RenderbufferStore` with `DEPTH_COMPONENT16` and `DEPTH24_STENCIL8` formats. Limits: `MAX_TEXTURE_SIZE` 4096, `MAX_CUBE_MAP_TEXTURE_SIZE` 1024, `MAX_VERTEX_ATTRIBS` 16, `MAX_TEXTURE_IMAGE_UNITS` 16.

### src/renderer/extensions.ts — Extension stubs

Exports `getExtension(name)` returning stub objects for `WEBGL_draw_buffers` (WebGL1 drawBuffers alias), `OES_texture_float` (float texture admission), `WEBGL_lose_context` (`loseContext`/`restoreContext` driving `CONTEXT_LOST_WEBGL`), and `null` for all others. `getSupportedExtensions()` returns exactly those 3 names. Imported by `context.ts`.

### src/build-bundle.ts — esbuild single-file build script

Exports `build()` invoking esbuild with `bundle:true`, `entryPoints:['src/renderer/context.ts']`, `outfile:'renderer.js'`, `format:'iife'`, `platform:'browser'`, `target:'es2022'`, footer appending `window.__createSoftwareWebGLContext=createSoftwareWebGLContext`. Fails the build if output exceeds 800 KB or contains `require(`. Run via `npm run build`.

## Error Handling Strategy

Failure class (a) malformed GLSL input: `ShaderCompileError` with message `LINE <n>: <detail>` (examples: `LINE 3: UNKNOWN_BUILTIN foo`, `LINE 1: LAYOUT_QUALIFIER_REQUIRES_300`); `compileShader` sets `COMPILE_STATUS=false`, `getShaderInfoLog` returns the message, `getError` stays `NO_ERROR`. Failure class (b) link mismatch: `ProgramLinkError('VARYING_MISMATCH <name>' | 'VERSION_MISMATCH' | 'MISSING_MAIN')`; `linkProgram` sets `LINK_STATUS=false`, `getProgramInfoLog` returns text. Failure class (c) invalid enum: any unrecognized enum to `enable`, `blendFunc`, `depthFunc`, `texParameteri` pushes `INVALID_ENUM=0x0500` once and leaves state unchanged. Failure class (d) invalid value: negative `viewport`/`scissor` sizes, null buffer data with non-zero size, `readPixels` out-of-bounds rectangle push `INVALID_VALUE=0x0501`. Failure class (e) invalid operation: draw with no bound program, incomplete framebuffer, `drawBuffers` with out-of-range attachment, sampling an incomplete texture push `INVALID_OPERATION=0x0502`. Failure class (f) resource exhaustion: framebuffer or texture allocation exceeding 4096 limits or `ArrayBuffer` allocation failure throws `OutOfMemoryError` and pushes `OUT_OF_MEMORY=0x0505`. Failure class (g) missing renderer file: harness `assertRendererExists` throws Node `AssertionError('Software renderer not found: <path>...')` and `buildInterceptScript` returns the `RENDERER_NOT_FOUND` stub that sets `document.title='RENDERER_NOT_FOUND'`. Failure class (h) context loss: `WEBGL_lose_context.loseContext()` makes all subsequent calls push `CONTEXT_LOST_WEBGL=0x9242` until `restoreContext()`. Mid-operation failure leaves committed pixels in place (no transactional rollback) but never corrupts buffer lengths; recovery is `getError` drain plus context or per-test fresh-context recreation, requiring no manual cleanup.

## Testing Requirements

Unit sub-suite `tests/unit/shader-compiler.test.ts` (20 cases): asserts `#version 300 es` on line 2 throws `LINE 1: VERSION_MUST_BE_FIRST_LINE`; `attribute` in 300 throws `ATTRIBUTE_RESERVED_IN_300`; implicit `int→vec3` constructor arg in 300 throws `TYPE_MISMATCH`; `texture2D` in 300 throws `UNKNOWN_BUILTIN`; `gl_FragColor` in fragment 100 compiles. Sub-suite `tests/unit/state-machine.test.ts` (14 cases): asserts default clear color `[0,0,0,0]`, default depth func `LESS=0x0201`, `enable(BLEND)` flips state, `viewport(-1,0,10,10)` pushes `INVALID_VALUE`, `enable(0x9999)` pushes `INVALID_ENUM`. Sub-suite `tests/unit/rasterizer.test.ts` (10 cases): asserts 64x64 red-triangle pixel `(32,40)` equals `[255,0,0,255]`, pixel `(4,4)` equals background, degenerate triangle writes zero pixels, `1/w` interpolation of `u` at centroid within 0.01. Sub-suite `tests/unit/framebuffer.test.ts` (8 cases): asserts `clear` fills all bytes, `clearDepth(0.5)` then depth test behavior, `readPixels` round-trips uploaded bytes exactly. Sub-suite `tests/unit/errors.test.ts` (8 cases): asserts FIFO drain order `INVALID_ENUM` then `INVALID_VALUE`, queue cap 8, compile failure leaves `getError()==NO_ERROR`. Conformance sub-suite `tests/conformance/context-routing.test.ts`: asserts `getContext('webgl')`, `'webgl2'`, `'experimental-webgl'` each return the software context and `WEBGL_SOFTWARE_RENDERER` override path loads. Sub-suite `clear.test.ts`/`triangle.test.ts`: asserts clear-color quantization and red-triangle golden match within tolerance 0. Sub-suite `depth.test.ts`: asserts nearer quad occludes farther quad and `depthFunc(EQUAL)` variant. Sub-suite `blend.test.ts`: asserts 50 percent red-over-blue yields `[128,0,128,255]` within tolerance 1. Sub-suite `texture.test.ts`: asserts 2x2 RGBA upload sampled with `NEAREST` returns exact texels. Sub-suite `webgl2.test.ts`: asserts instanced draw of 2 instances, `drawBuffers` dual-target write, VAO bind isolation. Sub-suite `cts-subset.test.ts` (40 cases mirroring Khronos `WebGLTestUtils.checkCanvas` patterns): asserts pass count 40/40. Determinism gate: every golden test runs twice and asserts byte-identical buffers. Coverage target: 90 percent lines for `shader-compiler/`, `rasterizer.ts`, `framebuffer.ts`. All suites run headless (`vitest run`, Playwright Chromium headless); no display server required.

## Implementation Phases

### Phase 1 — Scaffold, bundle, first triangle

Build `gl-constants.ts`, `state.ts`, `errors.ts`, `framebuffer.ts`, minimal `context.ts` (clear, viewport, single hardcoded-color triangle path), `build-bundle.ts`, and `tests/conformance/context-routing.test.ts` plus `clear.test.ts`. Exit criterion: `npm run build` emits `renderer.js` under 800 KB and `vitest run tests/conformance/context-routing.test.ts tests/conformance/clear.test.ts` passes 100 percent.

### Phase 2 — State machine and buffers

Add `buffer.ts`, full enable/disable/clear/depth-mask/color-mask/scissor, `drawArrays`/`drawElements` for `TRIANGLES`, and `tests/unit/state-machine.test.ts` plus `tests/unit/errors.test.ts`. Exit criterion: those two suites pass 22/22 with zero `tsc --noEmit` errors.

### Phase 3 — GLSL ES compiler and programs

Add `shader-compiler/` (tokenizer, parser, typechecker, both builtin tables, codegen) and `program.ts` with compile/link status flags and info logs, plus `tests/unit/shader-compiler.test.ts`. Exit criterion: 20/20 compiler cases pass including version-gating negatives.

### Phase 4 — Rasterizer, textures, readback

Add `rasterizer.ts` (coverage, perspective-correct varyings, fragment pipeline), `texture.ts`, `readPixels`/`presentToCanvas`, goldens `red-triangle-64.png`, `textured-quad-256.png`, and `tests/unit/rasterizer.test.ts` plus `tests/conformance/triangle.test.ts texture.test.ts depth.test.ts blend.test.ts`. Exit criterion: golden-pixel assertions pass with tolerance 0 (exact) except blend tolerance 1.

### Phase 5 — WebGL2, extensions, CTS subset

Add `renderbuffer.ts`, VAOs, instancing, `drawBuffers` 4-target, float formats, `extensions.ts`, and `tests/conformance/webgl2.test.ts` plus `cts-subset.test.ts` (40 cases). Exit criterion: CTS subset passes 40/40 within the 120 s per-test timeout.

### Phase 6 — Hardening, determinism, packaging

Add double-run determinism gates, `visual-proof/first-triangle.png` plus `manifest.json`, perf assertions (64x64 under 50 ms, 256x256 under 500 ms), and full `npm test` plus `npx tsc --noEmit` green runs. Exit criterion: `npm test` passes 100 percent, typecheck zero errors, bundle verified dependency-free via metafile.

## Acceptance Criteria

- [ ] `window.__createSoftwareWebGLContext` factory exists in `renderer.js` and routed `getContext('webgl'|'webgl2'|'experimental-webgl')` calls return a working context (SG1, SOW-REQ-001).
- [ ] WebGL1 core (buffers, shaders, programs, textures, framebuffers, viewport, clear, drawArrays/drawElements TRIANGLES) operates per spec (SG1, SOW-REQ-002).
- [ ] WebGL2 subset (instancing, drawBuffers 4-target, VAOs, float formats, DEPTH24_STENCIL8) operates per spec (SG1, SOW-REQ-003).
- [ ] GLSL ES 1.00 shaders with attribute/varying compile and render (SG1, SOW-REQ-004).
- [ ] GLSL ES 3.00 shaders with `#version 300 es` first line and in/out compile and render; missing version falls back to 1.00 (SG1, SOW-REQ-005).
- [ ] Compile/link failures set status flags and info logs with `LINE <n>` text while `getError` stays `NO_ERROR` (SG5, SOW-REQ-006).
- [ ] Red-triangle golden at 64x64 matches `tests/golden/red-triangle-64.png` with tolerance 0 (SG2, SOW-REQ-007).
- [ ] Clear/depth/stencil masks and clear values behave per SOW-REQ-008 (SG2, SOW-REQ-008).
- [ ] All 8 depth funcs, 3 blend equations, full blend-factor set, and scissor/stencil ordering verified (SG2, SOW-REQ-009).
- [ ] 2x2 RGBA texture upload with NEAREST sampling returns exact texels (SG2, SOW-REQ-010).
- [ ] `readPixels` RGBA/UNSIGNED_BYTE round-trips exactly and `putImageData` presentation matches framebuffer (SG2, SOW-REQ-011).
- [ ] Error queue pushes exact codes FIFO with cap 8 and drains to NO_ERROR (SG5, SOW-REQ-012).
- [ ] `renderer.js` builds via the pinned esbuild flags, is under 800 KB, and contains zero runtime npm imports (SG4, SOW-REQ-013).
- [ ] Double-run determinism gate yields byte-identical framebuffers (SG3, SOW-REQ-014).
- [ ] `npm test` passes 100 percent and `npx tsc --noEmit` reports zero errors (SG5, SOW-REQ-015).
- [ ] Reference perf budgets (64x64 under 50 ms, 256x256 under 500 ms) met on 2-vCPU CI (SG6, SOW-REQ-016).

## Design Decisions

### [SOW-ADR-001] Pure-TypeScript CPU interpreter, no WASM build step

**Status**: Decided
**Decision**: Implement shaders as TypeScript-compiled CPU closures; no Emscripten, wasm-pack, or `.wasm` artifact.
**Rationale**: The instruction allows pure-JS or WASM, but a WASM toolchain adds build fragility and debugging cost while the scenes are small enough for typed-array JS; rejected WASM because determinism and golden tests do not need native speed.

### [SOW-ADR-002] Bounding-box barycentric rasterizer with perspective-correct varyings

**Status**: Decided
**Decision**: Iterate triangle bounding boxes, evaluate edge functions with the top-left rule, and interpolate varyings with `1/w` recovery.
**Rationale**: Scanline rasterizers are faster to write but edge-rule corner cases risk CTS pixel mismatches; rejected scanline because barycentric evaluation directly yields the perspective-correct attributes the depth and texture tests assert.

### [SOW-ADR-003] Version-conditional GLSL front end with dual builtin tables

**Status**: Decided
**Decision**: Detect `#version` on line 1, then parse/typecheck/codegen against separate ES 1.00 and ES 3.00 keyword and builtin tables.
**Rationale**: A unified grammar would silently accept `attribute` in 300 or `texture()` in 100 and fail CTS negatives; rejected unified parsing because the specs differ on qualifiers, builtins, and conversion rules.

### [SOW-ADR-004] Typed-array framebuffer triple with 2D-canvas presentation

**Status**: Decided
**Decision**: Store color in `Uint8ClampedArray`, depth in `Float32Array`, stencil in `Uint8Array`, and present via 2D-context `putImageData`.
**Rationale**: This matches `ImageData.data` layout exactly so `readPixels`, `toDataURL`, and golden comparison share one representation; rejected float-color backing because quantization behavior must match the 8-bit canvas the harness reads.

### [SOW-ADR-005] esbuild IIFE single-file bundle at workspace root

**Status**: Decided
**Decision**: Bundle `src/renderer/` to `renderer.js` with `bundle:true`, `format:iife`, `platform:browser`, `target:es2022`, appending the `window.__createSoftwareWebGLContext` assignment in the footer.
**Rationale**: The harness `readFileSync(getRendererPath())` inlines the file text into `addInitScript`, so exactly one self-contained file is required; rejected multi-file or ESM output because init-script injection cannot resolve relative imports.

### [SOW-ADR-006] Playwright addInitScript routing plus split vitest suites

**Status**: Decided
**Decision**: Keep routing in `src/context-intercept.ts` unchanged and split tests into Node unit suites and Playwright-Chromium conformance suites.
**Rationale**: Rewriting the harness would invalidate the provided contract; rejected Vitest browser-mode-only testing because per-file fresh-context isolation plus real `getContext` interception is what the CTS-subset assertions require.

## Risk Assessment

- Risk 1 — Full WebGL2 surface too large for one run: Likelihood High, Impact High. Mitigation: freeze the WebGL2 subset to SOW-REQ-003 (instancing, 4-target drawBuffers, VAOs, float formats, DEPTH24_STENCIL8) and return `null`/no-op for remaining entry points with documented CTS-subset skips.
- Risk 2 — GLSL 3.00 strictness rejects valid CTS shaders: Likelihood Medium, Impact High. Mitigation: gate implicit-conversion rejection behind version 300 only and run the 20-case compiler suite plus CTS-subset shader cases before Phase 5 exit.
- Risk 3 — CPU rasterization too slow for 256x256 textured scene: Likelihood Medium, Impact Medium. Mitigation: enforce typed-array-only inner loops, bounding-box clamping, and early depth rejection; perf assertions in Phase 6 catch regressions against the 500 ms budget.
- Risk 4 — Pixel mismatch versus GPU reference (edge rules, blend rounding): Likelihood Medium, Impact High. Mitigation: pin top-left fill rule, `floor`-quantized clear colors, and blend tolerance 1 (exact 0 elsewhere); golden PNGs generated from the software renderer itself after manual inspection.
- Risk 5 — Bundle bloat or accidental runtime import breaks offline injection: Likelihood Low, Impact High. Mitigation: 800 KB build cap plus `metafile` check rejecting `require(`/npm imports; `assertRendererExists` fails fast with the file path.
- Risk 6 — Harness path mismatch (`/app/renderer.js` versus `./renderer.js`) breaks evaluation: Likelihood Medium, Impact High. Mitigation: SOW-OQ-001 pins the dual-path rule (workspace `./renderer.js` canonical, `/app/renderer.js` container alias, env override) and `context-routing.test.ts` asserts both resolutions.

## Open Questions & Assumptions

| ID | Question | Status |
|---|---|---|
| SOW-OQ-001 | Renderer file path: /app/renderer.js vs ./renderer.js | ASSUMED |
| SOW-OQ-002 | WebGL2 scope frozen to instancing, drawBuffers, VAOs, float formats | ASSUMED |
| SOW-OQ-003 | Pure-TS interpreter with no WASM artifact satisfies pure-JS/WASM clause | ASSUMED |
| SOW-OQ-004 | CTS verified via 40-case subset, not full Khronos suite import | ASSUMED |
| SOW-OQ-005 | MSAA and compressed textures out of scope | RESOLVED |
| SOW-OQ-006 | Headless Chromium plus Node vitest is the test environment | RESOLVED |

### Resolved

#### [SOW-OQ-001] Renderer file path

**Status**: ASSUMED
**Question**: The instruction names `/app/renderer.js` while the harness defaults to `./renderer.js`.
**Impact**: Build output location and evaluation copy step depend on the resolved path.
**Resolution**: Canonical workspace path is `./renderer.js` (honored by `getRendererPath` and `WEBGL_SOFTWARE_RENDERER` override); `/app/renderer.js` is treated as the container-absolute alias of the same file and the evaluation setup copies or mounts accordingly.
**Acknowledged**: yes

#### [SOW-OQ-002] WebGL2 scope freeze

**Status**: ASSUMED
**Question**: Whether the full WebGL2 API including transform feedback and 3D textures is required.
**Impact**: Phase 5 scope and CTS-subset pass criteria depend on the frozen subset.
**Resolution**: WebGL2 scope is frozen to SOW-REQ-003 (instanced draws, 4-target drawBuffers, VAOs, R32F/RGBA32F textures, DEPTH24_STENCIL8); transform feedback, 3D textures, and multisample renderbuffers are out of scope and return `null` or no-op.
**Acknowledged**: yes

#### [SOW-OQ-003] Pure-TypeScript satisfies instruction

**Status**: ASSUMED
**Question**: Whether a pure-TypeScript CPU implementation without a `.wasm` binary satisfies the pure-JS/WASM clause.
**Impact**: Toolchain choice (esbuild only versus Emscripten/wasm-pack) depends on this reading.
**Resolution**: Pure TypeScript compiled to a single JS bundle satisfies the clause because the instruction permits either pure-JS or WASM and bans outside libraries, not JS itself.
**Acknowledged**: yes

#### [SOW-OQ-004] CTS subset instead of full suite

**Status**: ASSUMED
**Question**: Whether importing the entire Khronos CTS tree is required for acceptance.
**Impact**: Test authoring effort and the 120 s timeout budget depend on suite size.
**Resolution**: A 40-case CTS subset mirroring `WebGLTestUtils.create3DContext` and `checkCanvas` patterns under `tests/conformance/cts-subset.test.ts` is the acceptance gate; full-suite import is out of scope.
**Acknowledged**: yes

#### [SOW-OQ-005] MSAA and compressed textures out of scope

**Status**: RESOLVED
**Question**: Whether multisample resolve and compressed-texture upload are required.
**Impact**: Rasterizer and texture-store scope depend on the answer.
**Resolution**: Both are out of scope: multisample renderbuffers are not allocated and `COMPRESSED_TEXTURE_FORMATS` reports empty; decided in SOW-ADR-002 and SOW-ADR-004.
**Acknowledged**: yes

#### [SOW-OQ-006] Headless test environment

**Status**: RESOLVED
**Question**: What browser and runner environment the renderer is verified in.
**Impact**: Test authoring (Playwright versus Vitest browser mode) depends on the answer.
**Resolution**: Node vitest runs unit suites and headless Chromium via Playwright runs conformance suites per `vitest.config.ts` include `tests/**/*.test.ts` and pinned `playwright 1.52.0`; no display server is required.
**Acknowledged**: yes

## Traceability

task_id: terminal-bench/wasm-render
benchmark_id: terminal-bench
source_version: f3adda34e463b124470973dcf9ad39f929c4cd51ba755ab79b72dbfd53556c0f
instruction_sha256: 15338702df69cc3ec86de1335bd9a9c95007f7f3ed69cd0fefbd7a907d22f3a5
imported_at: 2026-09-16T04:27:54.989393+00:00
