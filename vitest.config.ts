import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` throws outside Next's server bundle; stub it for tests only.
      "server-only": path.resolve(__dirname, "tests/empty-module.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts"],
    fileParallelism: false,
    exclude: ["e2e/**", "node_modules/**"],
  },
});
