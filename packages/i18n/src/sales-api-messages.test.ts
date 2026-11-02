import { SALES_MESSAGE_KEYS } from "@banijjik/contracts/sales";
import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOGS } from "./bundled-catalogs.js";

describe("sales API translations", () => {
  it("provides every sales rule in Bangla and English", () => {
    for (const locale of ["bn", "en"] as const) {
      for (const key of SALES_MESSAGE_KEYS)
        expect(BUNDLED_CATALOGS[locale][key], `${locale}: ${key}`).toBeTruthy();
    }
  });
});
