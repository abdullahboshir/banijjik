import { DIRECTORY_API_MESSAGE_KEY_LIST } from "@banijjik/contracts/directory";
import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOGS } from "./bundled-catalogs.js";
import { SUPPORTED_LOCALES } from "./locales.js";

describe("directory API messages", () => {
  it("has a message in both languages for every key the directory endpoints can send", () => {
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of DIRECTORY_API_MESSAGE_KEY_LIST) {
        expect(BUNDLED_CATALOGS[locale][key], `${locale} ${key}`).toBeTruthy();
      }
    }
  });
});
