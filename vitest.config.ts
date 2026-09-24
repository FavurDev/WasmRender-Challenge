import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 120_000,
    hookTimeout: 60_000,
    pool: "forks",
    reporters: ["verbose"],
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.d.ts", "src/context-intercept.ts", "tests/**", "scripts/**"],
      all: true,
      clean: true,
      thresholds: { lines: 90, functions: 96, branches: 81, statements: 90 },
    },
  },
});