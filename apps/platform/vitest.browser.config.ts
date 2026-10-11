import { defineConfig } from "vitest/config";

/** Real-browser checks (needs a built app and Chrome); not part of `npm test`. See the README. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.browser.test.ts"],
    // Every file starts the whole stack on fixed ports (the build bakes in the API address), so files run one by one.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000",
      NEXT_PUBLIC_BRAND_NAME: "Test Brand",
    },
  },
});
