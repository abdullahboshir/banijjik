import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The real package only exists inside Next's bundler; this is Next's own empty stand-in.
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "**/*.browser.test.ts"],
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000",
      NEXT_PUBLIC_BRAND_NAME: "Test Brand",
    },
  },
});
