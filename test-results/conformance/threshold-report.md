# Sprint 10 CTS Conformance Threshold & Gap Report

## Executive Summary

| Suite | Discovered | Passed | Failed | Pass Rate | Target Gate | Gap |
| --- | --- | --- | --- | --- | --- | --- |
| webgl1 | 3 | 0 | 1 | 0.00% | 95.00% | 95.00% |
| webgl2 | 2598 | 16 | 2582 | 0.62% | 90.00% | 89.38% |

## Reconciliation Analysis

Verified `discovered == executed + skipped` and `executed == passed + failed + crashed` for each suite.
reconciliationValid: true

## Root Cause Attribution

Non-passing tests partitioned into G1 (spec-defect), G2 (driver), G3 (float-edge), G4 (harness-limitation).

- webgl1: G1=0, G2=0, G3=0, G4=2
- webgl2: G1=2059, G2=0, G3=517, G4=6

## Deferral and Residual Gap Plan

Residual gaps are deferred to Sprint 11 without lowering the 95% (WebGL1) / 90% (WebGL2) gates.
Root causes: TD-023 (systematic spec-defect expectation-generation defect, G1-dominant) and TD-024 (float-edge tolerance handling, G3).
Sprint 11 must audit the expectation-generation pipeline (TD-023) first, then address float tolerance (TD-024).
