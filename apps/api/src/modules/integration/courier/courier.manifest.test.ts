import { MODULE_KEY } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { createModuleRegistry } from "../../../kernel/modules/index.js";
import { buildCourierInfo, courierManifest } from "./index.js";

describe("the courier module", () => {
  it("has a manifest that a module registry accepts", () => {
    const registry = createModuleRegistry([courierManifest]);

    expect(registry.find(MODULE_KEY.COURIER)).toBe(courierManifest);
  });

  it("reports its own key and path through all four layers", () => {
    expect(buildCourierInfo()).toEqual({
      moduleKey: MODULE_KEY.COURIER,
      path: "integration/courier",
    });
  });
});
