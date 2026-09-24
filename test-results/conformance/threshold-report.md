# Sprint 13 CTS Conformance Threshold & Gap Report (v4)

Supersedes: # Sprint 12 CTS Conformance Threshold & Gap Report (v3)
Supersedes: # Sprint 10 CTS Conformance Threshold & Gap Report

Generated: 2026-09-24T14:28:10.140Z
Overall Status: GAP_RECORDED

## Executive Summary

| Suite | Discovered | Passed | Failed | Pass Rate | Target Gate | Gap | Tests Needed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| webgl1 | 672 | 13 | 659 | 1.93% | 95.00% | 93.07% | 626 |
| webgl2 | 2598 | 20 | 2578 | 0.77% | 90.00% | 89.23% | 2319 |

## Reconciliation Analysis

Verified `discovered == executed + skipped` and `executed == passed + failed + crashed` for each suite.
reconciliationValid: true
crashes: 0 (verified across all suites)

## Root Cause Attribution

Non-passing tests partitioned into G1 (spec-defect), G2 (driver), G3 (float-edge), G4 (harness-limitation).

- webgl1: G1=609, G2=0, G3=40, G4=10
- webgl2: G1=2048, G2=0, G3=517, G4=13

## Measured Deltas vs Sprint 11 Baseline (supersedes Measured Deltas vs Sprint 10 Baseline)
## Measured Deltas vs Sprint 12 Baseline

| Suite | Sprint 11 Ratio | Sprint 11 Rate | Sprint 12 Ratio | Sprint 12 Rate | Delta | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| webgl1 | 10/672 | 1.49% | 13/672 | 1.93% | +0.00% | Measured on post-fix software context across authentic 672-test WebGL1 suite. |
| webgl2 | 16/2598 | 0.62% | 20/2598 | 0.77% | +0.00% | Measured on post-fix software context across full 2598-test WebGL2 suite. |

## Deferral and Residual Gap Plan

Target gates (95.0% WebGL1 / 90.0% WebGL2) remain unlowered. Because both suites have residual gaps (WebGL1: 13/672 passed vs 639 needed for 95%; WebGL2: 20/2598 passed vs 2323 needed for 90%), overallStatus is recorded as GAP_RECORDED. With TD-026, TD-024, and TD-025 CLOSED and TD-023 REDUCED, residual G1/G3 remediation is scheduled for Sprint 13.

### Technical Debt Register Status

- TD-026 (CLOSED in commit 9458db5): FramebufferTexture2D DEPTH_STENCIL_ATTACHMENT allowlist gap closed in WebGL1 fix wave; regression test asserts NO_ERROR.
- TD-024 (CLOSED in commit 0357097): Bare hex bit-depth constants replaced with named constants; readPixels INVALID_ENUM checked before OOB INVALID_VALUE; G3 float-edge fixes landed.
- TD-025 (CLOSED in commit 323a24f): Triage-log clobbering hazard eliminated via per-run isolated log paths; real 672-test WebGL1 denominator restored.
- TD-023 (REDUCED): CTS failure triage re-executed in Sprint 13 Task 4 post-T2/T3; residual failure gap updated with measured Sprint 13 deltas (WebGL1: 659 residual failures, WebGL2: 2578 residual failures) partitioned into G1/G3/G4 root-cause classes.
- TD-001 (OPEN): Favur gauntlet subsystem external issue; compensating control is sprint-review APPROVE with independently verified gates.

### Next Steps

Sprint 14 will execute the next prioritized fix wave on remaining G1 and G3 root causes toward meeting the 95.0% WebGL1 / 90.0% WebGL2 conformance thresholds.

## Gate-Feasibility Assessment

Historical velocity: 3.5 tests/sprint (Sprints 11-12).
Remaining gap: WebGL1 626 tests, WebGL2 2319 tests.
Projected sprints-to-gate: WebGL1 179 sprints; WebGL2 663 sprints.
Cluster costs: inline-script 1468, default-vert XHR 279, length-TypeError 136, state-allowlist 107.
Verdict: UNFEASIBLE_AT_CURRENT_VELOCITY. Achieving the 95% WebGL1 gate requires ~179 sprints; achieving the 90% WebGL2 gate requires ~663 sprints at measured velocity (+3.5 tests/sprint). Even if all unblocked G1 clusters flip completely (~1990 tests), WebGL2 gate remains unmet by >340 tests, and G3 float-edge residual (~557 tests) requires dedicated numerical modeling.
- Option A (Continue Current Trajectory): Continue fix waves at current velocity. Feasibility: Unfeasible within Phase 1 timeline; requires >150 additional sprints.
- Option B (Re-scope Conformance Gates): In accordance with Phase 1 Plan CTS-unreachable contingency, escalate threshold decision to stakeholder. Propose re-scoped achievable gates based on verified software renderer capabilities (e.g., Core WebGL1 80% / WebGL2 50%, or qualifying against M6 visual test pass rates with 3D engines).
- Option C (Specialized Batch Remediations): Target high-leverage architectural clusters exclusively (XHR resolution and script execution engine) and freeze further broad conformance chasing once addressable clusters plateau.

## Operator-Escalation Recommendation

Formally escalate to the project operator with Option B (Re-scope Conformance Gates). ADR-006 established the 95%/90% gates as a judgment call rather than a hard spec constraint. The phase plan explicitly permits reporting achieved rates and escalating threshold decisions. Gates must not be lowered silently.

