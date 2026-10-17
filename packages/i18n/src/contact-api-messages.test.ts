import { CONTACT_API_MESSAGE_KEYS } from "@banijjik/contracts/contact";
import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOGS } from "./bundled-catalogs.js";
import { SUPPORTED_LOCALES } from "./locales.js";

describe("contact API messages", () => {
  it("has a message in both languages for every key the contact endpoints can send", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of CONTACT_API_MESSAGE_KEYS) {
        expect(BUNDLED_CATALOGS[locale][key], `${locale} ${key}`).toBeTruthy();
      }
    }
  });
});
