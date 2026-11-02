import { SALES_DELIVERY_RULE_KEY } from "@banijjik/contracts/sales/delivery";
import { SALES_MESSAGE_KEYS } from "@banijjik/contracts/sales";
import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOGS } from "./bundled-catalogs.js";

const COD_DELIVERY_RULE_KEYS = [
  "DELIVERY_ZONE_UNAVAILABLE",
  "DELIVERY_ZONE_CURRENCY_MISMATCH",
  "DELIVERY_ADDRESS_REQUIRED",
  "DELIVERY_METHOD_NOT_COMPLETABLE",
  "ADDRESS_NOT_ALLOWED_FOR_METHOD",
  "DISPATCH_METHOD_MISMATCH",
] as const;

describe("sales API translations", () => {
  it("provides every sales rule in Bangla and English", () => {
    for (const locale of ["bn", "en"] as const) {
      for (const key of SALES_MESSAGE_KEYS)
        expect(BUNDLED_CATALOGS[locale][key], `${locale}: ${key}`).toBeTruthy();
    }
  });

  it("keeps the six COD delivery rule keys on the delivery contracts entry", () => {
    expect(Object.values(SALES_DELIVERY_RULE_KEY)).toEqual([...COD_DELIVERY_RULE_KEYS]);
  });
});
