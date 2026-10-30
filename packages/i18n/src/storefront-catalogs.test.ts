import { describe, expect, it } from "vitest";
import { STOREFRONT_CATALOGS } from "./storefront-catalogs.js";

const PLACEHOLDER_PATTERN = /\{[\w.:]+\}/g;

function placeholdersOf(text: string): string[] {
  return (text.match(PLACEHOLDER_PATTERN) ?? []).sort();
}

describe("storefront catalogs", () => {
  it("have exactly the same key set and placeholders in bn and en", () => {
    expect(Object.keys(STOREFRONT_CATALOGS.bn).sort()).toEqual(
      Object.keys(STOREFRONT_CATALOGS.en).sort(),
    );
    for (const [key, text] of Object.entries(STOREFRONT_CATALOGS.bn)) {
      expect(placeholdersOf(text), key).toEqual(placeholdersOf(STOREFRONT_CATALOGS.en[key] ?? ""));
    }
  });

  it("have non-empty text for every key", () => {
    for (const locale of ["bn", "en"] as const) {
      for (const [key, text] of Object.entries(STOREFRONT_CATALOGS[locale])) {
        expect(text.trim(), `${locale} ${key}`).not.toBe("");
      }
    }
  });
});
