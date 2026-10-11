import { describe, expect, it } from "vitest";
import { MODULE_CLASS } from "./module-class.js";
import { MODULE_CLASS_BY_KEY } from "./module-class-by-key.js";
import { MODULE_KEY_VALUES } from "./module-key.js";

describe("MODULE_CLASS_BY_KEY", () => {
  it("names a class for every module key and for nothing else", () => {
    expect(Object.keys(MODULE_CLASS_BY_KEY).sort()).toEqual([...MODULE_KEY_VALUES].sort());
  });

  it("uses only known classes", () => {
    const known: readonly string[] = Object.values(MODULE_CLASS);
    for (const moduleClass of Object.values(MODULE_CLASS_BY_KEY)) {
      expect(known).toContain(moduleClass);
    }
  });
});
