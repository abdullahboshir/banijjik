import { defineConfig } from "vitest/config";

/** Real-browser checks (needs a built API and storefront, MongoDB and Chrome); not part of `npm test`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.browser.test.ts"],
    // Every file starts the whole stack on fixed ports, so files run one by one.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      NEXT_PUBLIC_BRAND_NAME: "Test Brand",
    },
  },
});
