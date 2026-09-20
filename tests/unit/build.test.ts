// CHANGELOG: Sprint 1 (2026-09-20): Sprint 1 initial build pipeline suite
import { describe, expect, it } from "vitest";
// @ts-ignore - build script is untyped ESM outside tsc include
import {
  assertBundle,
  assertBundleSize,
  assertDeterminism,
  assertNoModuleSyntax,
  assertNoNetwork,
  assertSingleIife,
  // @ts-ignore - untyped ESM build script outside tsc include
} from "../../scripts/build-renderer.mjs";

const VALID = "(()=>{window.__createSoftwareWebGLContext=function(){};})();";

describe("bundle assertions", () => {
  it("accepts a valid IIFE fixture", () => {
    expect(() => assertBundle(VALID)).not.toThrow();
  });

  it("rejects an oversized fixture", () => {
    expect(() => assertBundleSize("x".repeat(2097153))).toThrow(/BUNDLE_TOO_LARGE/);
  });

  it("rejects an import-leaking fixture", () => {
    expect(() => assertNoModuleSyntax('(()=>{import("y")})();')).toThrow(/MODULE_SYNTAX_LEAK/);
    expect(() => assertNoModuleSyntax('import x from "y";')).toThrow(/MODULE_SYNTAX_LEAK/);
    expect(() => assertNoModuleSyntax("(()=>{const x=require('y')})();")).toThrow(
      /MODULE_SYNTAX_LEAK/
    );
  });

  it("rejects a network-leaking fixture", () => {
    expect(() => assertNoNetwork("(()=>{fetch('https://x')})();")).toThrow(/NETWORK_LEAK/);
    expect(() => assertNoNetwork("(()=>{new XMLHttpRequest()})();")).toThrow(/NETWORK_LEAK/);
  });

  it("rejects determinism-token fixtures", () => {
    expect(() => assertDeterminism("(()=>{Math.random()})();")).toThrow(/NONDETERMINISM/);
    expect(() => assertDeterminism("(()=>{Date.now()})();")).toThrow(/NONDETERMINISM/);
    expect(() => assertDeterminism("(()=>{performance.now()})();")).toThrow(/NONDETERMINISM/);
  });

  it("rejects a non-IIFE artifact", () => {
    expect(() => assertSingleIife("const x = 1;")).toThrow(/NOT_SINGLE_IIFE/);
  });
});
