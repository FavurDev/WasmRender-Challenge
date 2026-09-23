# TD-023 G1 Expectation-Pipeline Audit (Sprint 10 Task 1)
Version: 1.0 | Date: 2026-09-23 | Status: Active
Baseline: 2598 discovered / 2598 executed / 16 passed / 2582 failed / 0 crashed; G1=2059 G3=517 G4=6.
Harness under audit: tests/conformance/webgl1-harness.ts reused by tests/conformance/webgl2.test.ts (imports CTSRunner from ./webgl1-harness; no webgl2-harness.ts exists).

## Pipeline stages traced
S1 context creation (CTSHeadlessEnvironment.setup + canvasStub.getContext + WebGLTestUtils.create3DContext).
S2 script extraction/execution (extractScripts + runInContext with timeout).
S3 DOM stub (DOMElementStub + document/location/event stubs).
S4 verdict computation (executeTestPage verdict + drainedErrors).
S5 classification (classifyFailure) + logging (CTSTriageLogger).

## Root causes (expected vs actual)
### R1 Empty-assertion verdict bug — 309 tests
Value: 309 | Type: number | Usage: false-FAIL count removed by verdict fix
Expected: zero assertions -> SKIP/harness-limitation. Actual: webgl1-harness.ts:432 `|| testResults.length===0` forces FAIL, default-classified G1. Evidence: "(no-failed-assertion) drained=[]" e.g. conformance/context/context-attributes-alpha-depth-stencil-antialias.html.
Remediation: verdict SKIP + recordSkip when assertions empty. File: tests/conformance/webgl1-harness.ts:432. Impact: 309 leave G1, +0 passes, -309 false FAILs.

### R2 WebGL2 context creation — 360 tests
Value: 360 | Type: number | Usage: pass-count impact of type-aware getContext fix
Expected: canvas.getContext('webgl2') returns WebGL2Context. Actual: canvasStub.getContext ignores type arg; pages record "Unable to fetch WebGL rendering context for Canvas" + "context does not exist" e.g. conformance/buffers/buffer-bind-test.html (156) plus ~204 canvas/image variants.
Remediation: type-aware getContext stub routing 'webgl2'/'experimental-webgl' to createSoftwareWebGLContext(canvas,attrs,type) from src/entry.ts. Files: tests/conformance/webgl1-harness.ts:269, src/entry.ts. Impact: 360 potential passes.

### R3 deqp functional namespace — 480 tests
Value: 480 | Type: number | Usage: tests unblocked by helper preload
Expected: functional.* helpers defined. Actual: extractScripts loads only page-local scripts; "ReferenceError: functional is not defined" e.g. deqp/functional/gles3/textureshadow/2d_nearest_less_or_equal.html (144+116+90+50+43+38+33+30+29+26+26).
Remediation: preload deqp functional/ helper scripts in manifest order or stub functional namespace before page scripts. File: tests/conformance/webgl1-harness.ts:440-498. Impact: 480 unblocked.

### R4 DOM stub gaps — 199 tests
Value: 199 | Type: number | Usage: tests unblocked by stub additions
Expected: document/doc/getImageData/createTextNode present. Actual: "TypeError: doc" (57+56 bare-doc fragments), "document.createTextNode is not a function" (33+27), "ctx.getImageData is not a function" (26).
Remediation: add document.createTextNode, doc alias, 2D-ctx getImageData stub in setup. File: tests/conformance/webgl1-harness.ts:255-392. Impact: 199 unblocked.

### R5 Classifier default-to-G1 — 800 reclassified
Value: 800 | Type: number | Usage: G1-to-G4 reclassification count
Expected: harness script errors -> harness-limitation/G4. Actual: classifyFailure falls through to spec-defect/G1 for 'Script error'/'ReferenceError'/'TypeError'/'Unable to fetch'. File: tests/conformance/webgl1-harness.ts:48-94.
Remediation: add harness-error rule before default return. Impact: 800 reclassified G1->G4, +0 passes.

### R6 Genuine implementation divergences — 348 tests
Value: 348 | Type: number | Usage: true-G1 per-test wave scope
Expected: compile/link/getParameter/pixel match. Actual: 326 shader "Vertex shader compiled successfully" false + successfullyParsed + link failures; 22 "maxAttributes should be >= 4. Was null". Files: src/glsl/tokenizer.ts, parser.ts, checker.ts, src/gl/webgl2-context.ts getParameter.
Remediation: per-cause fixes in Task 6 wave B / Sprint 11. Impact: 348 true-G1 deferred.

## Ordered fix-priority list for Task 6
P1 R2 (360 passes) -> P2 R3 (480 unblocked) -> P3 R4 (199) -> P4 R1 (309 correctness) -> P5 R5 (800 reclassify) -> P6 R6 (348 deferred).
Closability verdict: Wave A (8h) closes P1-P5 harness-side; residual 348 true implementation defects deferred to Sprint 11; WebGL2 90% gate NOT closable this sprint.
Signature coverage: every top-25 G1 signature maps to R1-R6 above.
