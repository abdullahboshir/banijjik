import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "**/*.browser.test.ts"],
    environment: "node",
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000",
      NEXT_PUBLIC_BRAND_NAME: "Test Brand",
    },
  },
});
