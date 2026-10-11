import { describe, expect, it } from "vitest";
import { BUNDLED_CATALOGS } from "./bundled-catalogs.js";
import { PLATFORM_SCREEN_CATALOGS } from "./platform-screen-catalogs.js";
import { SCREEN_CATALOGS } from "./screen-catalogs.js";

const PLACEHOLDER_PATTERN = /\{[\w.:]+\}/g;

function placeholdersOf(text: string): string[] {
  return (text.match(PLACEHOLDER_PATTERN) ?? []).sort();
}

describe("platform screen catalogs", () => {
  it("have exactly the same key set and placeholders in bn and en", () => {
    expect(Object.keys(PLATFORM_SCREEN_CATALOGS.bn).sort()).toEqual(
      Object.keys(PLATFORM_SCREEN_CATALOGS.en).sort(),
    );
    for (const [key, text] of Object.entries(PLATFORM_SCREEN_CATALOGS.bn)) {
      expect(placeholdersOf(text), key).toEqual(
        placeholdersOf(PLATFORM_SCREEN_CATALOGS.en[key] ?? ""),
      );
    }
  });

  it("have a text for every key", () => {
    for (const locale of ["bn", "en"] as const) {
      for (const [key, text] of Object.entries(PLATFORM_SCREEN_CATALOGS[locale])) {
        expect(text.trim(), `${locale} ${key}`).not.toBe("");
      }
    }
  });

  it("share no key with the bundled or the admin screen catalogs", () => {
    const taken = new Set([
      ...Object.keys(BUNDLED_CATALOGS.bn),
      ...Object.keys(SCREEN_CATALOGS.bn),
    ]);
    const shared = Object.keys(PLATFORM_SCREEN_CATALOGS.bn).filter((key) => taken.has(key));
    expect(shared).toEqual([]);
  });

  it("never contain the brand name, which comes from config (ADR-038)", () => {
    expect(JSON.stringify(PLATFORM_SCREEN_CATALOGS)).not.toMatch(/banijjik/i);
  });
});
