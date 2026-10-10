import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  test: {
    root: repositoryRoot,
    include: ["tools/lint-tests/*.test.ts", "scripts/**/*.test.mjs"],
    // Type-aware linting of the whole fixture tree is slow on a cold cache.
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
