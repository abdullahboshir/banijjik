import { PLATFORM_MESSAGE_KEYS } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOGS } from "./bundled-catalogs.js";
import { SUPPORTED_LOCALES } from "./locales.js";

describe("platform API messages", () => {
  it("has a message in both languages for every key the platform endpoints can send", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of PLATFORM_MESSAGE_KEYS) {
        expect(BUNDLED_CATALOGS[locale][key], `${locale} ${key}`).toBeTruthy();
      }
    }
  });
});
