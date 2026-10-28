import { defineEnum } from "../define-enum.js";
import { SITE_PAGE_KEY, type SitePageKey } from "./site-page-key.js";

/**
 * Serializable section keys (card 4.1). Catalog, booking and enrollment keys are known here so
 * snapshots type-check; those modules register availability in their manifests (decision 11).
 */
export const SECTION_KEY = defineEnum([
  "header",
  "footer",
  "hero",
  "rich-text",
  "faq",
  "testimonials",
  "contact",
  "offering-grid",
  "category-strip",
  "schedule",
  "plans",
  "directory-search",
  "directory-list",
]);

export type SectionKey = (typeof SECTION_KEY)[keyof typeof SECTION_KEY];

/** Variants registered at launch. The schema validates the pair, not a global variant string. */
export const SECTION_VARIANTS = {
  header: defineEnum(["SIMPLE", "CENTERED"]),
  footer: defineEnum(["SIMPLE", "COLUMNS"]),
  hero: defineEnum(["SPLIT", "CENTERED"]),
  "rich-text": defineEnum(["STANDARD", "NARROW"]),
  faq: defineEnum(["STACKED", "ACCORDION"]),
  testimonials: defineEnum(["CARDS", "QUOTES"]),
  contact: defineEnum(["CARD", "SPLIT"]),
  "offering-grid": defineEnum(["GRID", "LIST", "COMPACT", "CAROUSEL"]),
  "category-strip": defineEnum(["CHIPS", "CARDS"]),
  schedule: defineEnum(["LIST", "CALENDAR"]),
  plans: defineEnum(["CARDS", "COMPARISON"]),
  "directory-search": defineEnum(["INLINE", "PANEL"]),
  "directory-list": defineEnum(["GRID", "LIST"]),
} as const;

export type SectionVariantKey<Key extends SectionKey = SectionKey> =
  (typeof SECTION_VARIANTS)[Key][keyof (typeof SECTION_VARIANTS)[Key]];

/** Static sections carry tenant-authored copy only; they must store `binding: null`. */
export const STATIC_SECTION_KEYS = [
  SECTION_KEY.header,
  SECTION_KEY.footer,
  SECTION_KEY.hero,
  SECTION_KEY["rich-text"],
  SECTION_KEY.faq,
  SECTION_KEY.testimonials,
  SECTION_KEY.contact,
] as const;

export type StaticSectionKey = (typeof STATIC_SECTION_KEYS)[number];

export const DYNAMIC_SECTION_KEYS = [
  SECTION_KEY["offering-grid"],
  SECTION_KEY["category-strip"],
  SECTION_KEY.schedule,
  SECTION_KEY.plans,
  SECTION_KEY["directory-search"],
  SECTION_KEY["directory-list"],
] as const;

export type DynamicSectionKey = (typeof DYNAMIC_SECTION_KEYS)[number];

const STATIC_SECTION_KEY_SET = new Set<string>(STATIC_SECTION_KEYS);

export function isStaticSectionKey(sectionKey: string): sectionKey is StaticSectionKey {
  return STATIC_SECTION_KEY_SET.has(sectionKey);
}

export function isSectionKey(value: string): value is SectionKey {
  return (Object.values(SECTION_KEY) as readonly string[]).includes(value);
}

export function variantsOf(sectionKey: SectionKey): readonly string[] {
  return Object.values(SECTION_VARIANTS[sectionKey]);
}

export function isRegisteredSectionVariant(sectionKey: SectionKey, variantKey: string): boolean {
  return variantsOf(sectionKey).includes(variantKey);
}

/** Content fields a CONTENT_ONLY lock may allow. Missing keys deny the edit (decision 4). */
export const SECTION_CONTENT_KEYS = {
  header: ["links"],
  footer: ["links"],
  hero: ["heading", "body", "imageFileId", "actionLabel", "actionPath"],
  "rich-text": ["body"],
  faq: ["entries"],
  testimonials: ["entries"],
  contact: ["heading", "phone", "email", "address"],
  "offering-grid": ["heading"],
  "category-strip": ["heading"],
  schedule: ["heading"],
  plans: ["heading"],
  "directory-search": ["heading"],
  "directory-list": ["heading"],
} as const satisfies Record<SectionKey, readonly string[]>;

export const STATIC_CONTENT_REGION_PREFIX = "static.";

export function staticContentRegionKey(pageKey: SitePageKey): string {
  return `${STATIC_CONTENT_REGION_PREFIX}${pageKey}`;
}

export const STATIC_CONTENT_REGION_KEYS = Object.values(SITE_PAGE_KEY).map(staticContentRegionKey);

export const REQUIRED_CHROME_REGION_KEYS = ["header", "footer"] as const;
