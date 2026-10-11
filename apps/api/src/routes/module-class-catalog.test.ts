import { MODULE_CLASS_BY_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { MODULE_MANIFESTS } from "./module-registry.js";

describe("MODULE_CLASS_BY_KEY", () => {
  it("names the same class as every registered manifest", () => {
    for (const manifest of MODULE_MANIFESTS) {
      expect(MODULE_CLASS_BY_KEY[manifest.key], manifest.key).toBe(manifest.moduleClass);
    }
  });
});
