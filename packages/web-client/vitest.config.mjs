import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The real package only exists inside Next's bundler; this is Next's own empty stand-in.
      "server-only": "next/dist/compiled/server-only/empty.js",
    },
  },
  test: { environment: "node" },
});
