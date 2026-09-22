# WebGL1 CTS Triage Categorization — Sprint 7 Task 6

Source: `test-results/conformance/webgl1-triage.json` (fresh full CTS run after HIGH-1/HIGH-2 review fixes).

## Totals

- discovered: 672, executed: 672, passed: 10, failed: 662, skipped: 0, crashed: 0
- Denominator reconciles: discovered == executed + skipped ✓, executed == passed + failed ✓
- Assertion audit: 2969 assertions, all `success` values boolean ✓, zero `notifyFinished` script-error signatures ✓

## Buckets

- **PASS (10):** tests passing against the software renderer as-is.
- **HARNESS_GAP (0 residual):** the four blueprint gaps are fixed —
  `window.addEventListener`/`removeEventListener`, GLSL script filtering (`type` and legacy
  `language` attributes), `description` element stub, `window.location` stub —
  plus `canvas.addEventListener` no-ops on `DOMElementStub` found during verification,
  plus the review-round fixes: `webglTestHarness.reportResults` 3-arg `(pathname, success, msg)`
  contract (path ignored, success coerced to boolean) and `webglTestHarness.notifyFinished`
  no-op stub. No failure message in the log matches `addEventListener|pathname|appendChild|mediump|
  Unexpected identifier|vec4|notifyFinished` anymore (verified via log scan).
- **SPEC_CONFORMANCE (662, Sprint 8 backlog):** genuine WebGL/GLSL behavior failures, NOT fixed
  per Sprint 7 scope. Dominant signatures: `successfullyParsed should be true` (GLSL compiler
  semantics), `Unable to fetch WebGL rendering context for Canvas` (context-creation paths),
  `FRAMEBUFFER_COMPLETE` / `numValidFormats` (framebuffer completeness queries), texture
  border/format queries, and `unable to create shader` diagnostics. Feed to Sprint 8.
  (Pass count moved 143 → 10 vs the pre-review run because pre-fix string-typed `success`
  values were truthy and inflated verdicts; post-fix boolean successes give true verdicts.)
- **EXPECTED_DIVERGENCES:** software-renderer-vs-GPU differences (precision, shader compile
  strictness) logged as FAIL records; no pass-rate gate enforced in Sprint 7.

## Note on crashed counter

The 12-test suite's TEST 8 intentionally records one synthetic CRASH to verify containment;
the shipped triage log is regenerated from a clean full-suite run (TEST 1 filter) so it
reports crashed: 0 per the Sprint 7 zero-crash gate.
