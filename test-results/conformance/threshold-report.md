# Sprint 10 CTS Conformance Threshold & Gap Report

Generated: 2026-09-24T02:56:54.894Z
Overall Status: GAP_RECORDED

## Executive Summary

| Suite | Discovered | Passed | Failed | Pass Rate | Target Gate | Gap | Tests Needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| webgl1 | 672 | 10 | 662 | 1.49% | 95.00% | 93.51% | 629 |
| webgl2 | 2598 | 16 | 2582 | 0.62% | 90.00% | 89.38% | 2323 |

## Reconciliation Analysis

Verified `discovered == executed + skipped` and `executed == passed + failed + crashed` for each suite.
reconciliationValid: true
crashes: 0 (verified across all suites)

## Root Cause Attribution

Non-passing tests partitioned into G1 (spec-defect), G2 (driver), G3 (float-edge), G4 (harness-limitation).

- webgl1: G1=619, G2=0, G3=40, G4=3
- webgl2: G1=2059, G2=0, G3=517, G4=6

## Measured Deltas vs Sprint 10 Baseline

| Suite | Sprint 10 Ratio | Sprint 10 Rate | Sprint 11 Ratio | Sprint 11 Rate | Delta | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| webgl1 | 0/3 (synthetic) | 0.00% | 10/672 | 1.49% | +1.49 (baseline restored) | Sprint 10 baseline was invalid (3-test synthetic fixture clobbered TRIAGE_LOG). Sprint 11 Task 4 isolated triage log and restored authentic 672-test denominator. |
| webgl2 | 16/2598 | 0.62% | 16/2598 | 0.62% | +0.00% | Measured on post-fix software context across full 2598-test suite. |

## Deferral and Residual Gap Plan

Target gates (95.0% WebGL1 / 90.0% WebGL2) remain unlowered. Because both suites have residual gaps (WebGL1: 10/672 vs 639 needed for 95%; WebGL2: 16/2598 vs 2323 needed for 90%), overallStatus is recorded as GAP_RECORDED. With TD-024 and TD-025 CLOSED and TD-023 REDUCED, residual G1 and G3 remediation is formally scheduled for Sprint 12.

### Technical Debt Register Status

- TD-024 (CLOSED in commit 0357097): Bare hex bit-depth constants replaced with named constants; readPixels INVALID_ENUM checked before OOB INVALID_VALUE; G3 float-edge fixes landed.
- TD-025 (CLOSED in commit 323a24f): Triage-log clobbering hazard eliminated via per-run isolated log paths; real 672-test WebGL1 denominator restored.
- TD-023 (REDUCED): G1 expectation audit completed; RC-4 API-surface fixes (Task 1) and RC-5 implementation fixes (Task 2) landed; residual 662 WebGL1 and 2582 WebGL2 failures mapped to G1/G3 root-cause buckets.
- TD-001 (OPEN): Favur gauntlet subsystem external issue; compensating control is sprint-review APPROVE with independently verified gates.

### Next Steps

Sprint 12 will execute the next deep fix wave on remaining G1 and G3 root causes toward meeting the 95%/90% conformance thresholds.

