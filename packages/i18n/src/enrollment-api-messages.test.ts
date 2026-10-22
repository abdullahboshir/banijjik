import { describe, expect, it } from "vitest";
import { ENROLLMENT_MESSAGE_KEYS } from "@banijjik/contracts/enrollment";
import { BUNDLED_CATALOGS } from "./bundled-catalogs.js";

describe("enrollment API translations", () => {
  it("provides every enrollment rule in Bangla and English", () => {
    for (const locale of ["bn", "en"] as const) {
      for (const key of ENROLLMENT_MESSAGE_KEYS)
        expect(BUNDLED_CATALOGS[locale][key], `${locale}: ${key}`).toBeTruthy();
    }
  });
});
