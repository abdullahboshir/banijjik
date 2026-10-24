import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.browser.test.ts"],
    environment: "node",
    testTimeout: 15_000,
    env: {
      NEXT_PUBLIC_BRAND_NAME: "Test Brand",
      STOREFRONT_API_ORIGIN: "http://localhost:4000",
    },
  },
});
