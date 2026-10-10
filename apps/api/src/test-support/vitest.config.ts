import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // This file lives in src/ so the TypeScript project (and therefore lint) covers it; root is the package.
    root: fileURLToPath(new URL("../..", import.meta.url)),
    include: ["src/**/*.test.ts"],
    // Starts one in-memory MongoDB replica set for the whole run; tests read its URI with inject().
    globalSetup: ["./src/test-support/replica-set.global-setup.ts"],
    // Read here because configuration files may read the environment (ADR-083); tests get the values through inject().
    provide: {
      redisUrl: process.env["TEST_REDIS_URL"] ?? "",
      isCi: process.env["CI"] === "true",
    },
    testTimeout: 30_000,
    // The first run downloads the MongoDB binary, which can take minutes.
    hookTimeout: 600_000,
  },
});
