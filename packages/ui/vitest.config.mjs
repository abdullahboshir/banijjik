import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const slowMachineTestTimeoutMs = 15_000;

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.mjs"],
    testTimeout: slowMachineTestTimeoutMs,
  },
});
