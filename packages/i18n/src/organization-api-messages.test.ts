import { ORGANIZATION_API_MESSAGE_KEYS } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOGS } from "./bundled-catalogs.js";
import { SUPPORTED_LOCALES } from "./locales.js";

describe("organization tenant API messages", () => {
  it("has a message in both languages for every key the organization endpoints can send", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of ORGANIZATION_API_MESSAGE_KEYS) {
        expect(BUNDLED_CATALOGS[locale][key], `${locale} ${key}`).toBeTruthy();
      }
    }
  });
});
