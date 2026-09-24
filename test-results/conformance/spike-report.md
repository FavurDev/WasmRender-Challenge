# Sprint 14 Task 2 — Harness Spike Report (NO_LIFT_STOP)

- Date: 2026-09-24
- Authorization: ADR-006 amendment, operator decision `b48cc2da` (single 6h time box)
- Baseline (v5): WebGL1 **13/672 (1.93%)**, WebGL2 **20/2598 (0.77%)**
- Post-spike: WebGL1 **13/672 (1.93%)**, WebGL2 **20/2598 (0.77%)**
- Deltas: WebGL1 **+0.00pp**, WebGL2 **+0.00pp**
- Interim gates: WebGL1 80% → GAP_RECORDED, WebGL2 50% → GAP_RECORDED
- Crashes: 0 on both suites; reconciliation valid on both triage logs
- Verdict: **NO_LIFT_STOP** — CTS-chasing halted per the stop rule

## Spike scope (all reverted)

Script-src external resolution via `resolveXhrFile`, non-JS shader-tag
preservation, XHR `responseType=arraybuffer` + response headers + full
readyState 1→2→3→4 lifecycle, `DOMContentLoaded`/`window.onload` dispatch,
query/fragment stripping.

## Stop-rule enforcement

`tests/conformance/webgl1-harness.ts` reverted to HEAD state (verified:
`git diff --stat` empty). Measurement helpers retained in the test-side
module `tests/conformance/spike-measurement.ts`. Zero files under `src/`
modified. Machine-readable evidence: `spike-report.json`.
