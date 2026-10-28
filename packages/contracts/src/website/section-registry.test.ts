import { describe, expect, it } from "vitest";
import { SITE_PAGE_KEY } from "./site-page-key.js";
import {
  DYNAMIC_SECTION_KEYS,
  SECTION_KEY,
  STATIC_CONTENT_REGION_KEYS,
  STATIC_SECTION_KEYS,
  isRegisteredSectionVariant,
  isSectionKey,
  isStaticSectionKey,
  staticContentRegionKey,
  variantsOf,
} from "./section-registry.js";

const REGISTERED_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  header: ["SIMPLE", "CENTERED"],
  footer: ["SIMPLE", "COLUMNS"],
  hero: ["SPLIT", "CENTERED"],
  "rich-text": ["STANDARD", "NARROW"],
  faq: ["STACKED", "ACCORDION"],
  testimonials: ["CARDS", "QUOTES"],
  contact: ["CARD", "SPLIT"],
  "offering-grid": ["GRID", "LIST", "COMPACT", "CAROUSEL"],
  "category-strip": ["CHIPS", "CARDS"],
  schedule: ["LIST", "CALENDAR"],
  plans: ["CARDS", "COMPARISON"],
  "directory-search": ["INLINE", "PANEL"],
  "directory-list": ["GRID", "LIST"],
};

describe("section registry", () => {
  it("registers every launch section and variant pair", () => {
    expect(Object.keys(REGISTERED_VARIANTS).sort()).toEqual(Object.values(SECTION_KEY).sort());
    for (const [sectionKey, expectedVariants] of Object.entries(REGISTERED_VARIANTS)) {
      if (!isSectionKey(sectionKey)) continue;
      expect([...variantsOf(sectionKey)].sort()).toEqual([...expectedVariants].sort());
      for (const variantKey of expectedVariants) {
        expect(isRegisteredSectionVariant(sectionKey, variantKey)).toBe(true);
      }
      expect(isRegisteredSectionVariant(sectionKey, "UNKNOWN")).toBe(false);
    }
  });

  it("treats chrome and copy sections as static and live-data sections as dynamic", () => {
    for (const sectionKey of STATIC_SECTION_KEYS) expect(isStaticSectionKey(sectionKey)).toBe(true);
    for (const sectionKey of DYNAMIC_SECTION_KEYS) {
      expect(isStaticSectionKey(sectionKey)).toBe(false);
    }
    expect([...STATIC_SECTION_KEYS, ...DYNAMIC_SECTION_KEYS].sort()).toEqual(
      Object.values(SECTION_KEY).sort(),
    );
  });

  it("rejects unknown section keys", () => {
    expect(isSectionKey("header")).toBe(true);
    expect(isSectionKey("ratings")).toBe(false);
  });

  it("names a static-content region for every reserved page key", () => {
    expect(STATIC_CONTENT_REGION_KEYS).toEqual(
      Object.values(SITE_PAGE_KEY).map((pageKey) => staticContentRegionKey(pageKey)),
    );
    expect(STATIC_CONTENT_REGION_KEYS).toContain("static.ABOUT");
  });
});
