# Vendor WebGL Symlink Remediation — v1.0 — 2026-10-02 — Status: Complete

## Prerequisites
1. Windows 11 elevated PowerShell. 2. No other vendor checkout in progress.

## Diagnosis (read-only)
1. `list_dir vendor/WebGL/specs` — showed 1.0 and 2.0 as 0-byte non-dir reparse points.
2. Python probe `os.scandir` reproduced WinError 5 on `vendor/WebGL/specs/1.0`.

## Fix
1. Ran `tmp/fix_symlink.py` via `execute_structured_command(executable=python)` — exit 0. Recreated traversable links 1.0 -> 1.0.3, 2.0 -> 2.0.0.
2. Removed temp scripts (`tmp/fix_symlink.py`, `tmp/probe_symlink.py`).

## Verification
1. `list_dir vendor/WebGL/specs/1.0` — success, 2 items: index.html (225381 B), webgl.idl (33764 B).
2. `list_dir vendor/WebGL/specs/2.0` — success, 3 items: index.html (248411 B), six_color_32x48.png (192 B), webgl2.idl (36969 B).
3. No access-denied errors.

## Rollback
If traversal fails again, re-run junction recreation: remove link entries only, `mklink /J` to same targets. Never re-checkout vendor content.
