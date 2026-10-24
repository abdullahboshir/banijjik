import { defineEnum } from "../define-enum.js";

/**
 * A template key is data, not a closed enum (ADR-034, ADR-097). Two to forty characters:
 * an uppercase letter, then uppercase letters, digits or underscores. Whether the key exists
 * is checked against the database by the use case that needs it.
 */
export const INDUSTRY_TEMPLATE_KEY_PATTERN = /^[A-Z][A-Z0-9_]{1,39}$/;

export type IndustryTemplateKey = string & { readonly __brand: "IndustryTemplateKey" };

export function isIndustryTemplateKey(value: string): value is IndustryTemplateKey {
  return INDUSTRY_TEMPLATE_KEY_PATTERN.test(value);
}

const SEED_INDUSTRY_TEMPLATE_NAMES = defineEnum([
  "FCOMMERCE",
  "RETAIL",
  "SALON",
  "CLINIC",
  "GYM",
  "COACHING",
  "RESTAURANT",
  "HOSTEL",
  "MATRIMONY_ISLAMIC",
  "MATRIMONY",
]);

type SeedIndustryTemplateName = keyof typeof SEED_INDUSTRY_TEMPLATE_NAMES;

/**
 * The seed templates of 12-INDUSTRY-TEMPLATES and doc 16 §4. For seed data and tests only.
 * Production code must not branch on a key (ADR-097). The brand is type-only: every name
 * already matches {@link INDUSTRY_TEMPLATE_KEY_PATTERN}.
 */
export const SEED_INDUSTRY_TEMPLATE_KEY = SEED_INDUSTRY_TEMPLATE_NAMES as {
  readonly [Key in SeedIndustryTemplateName]: IndustryTemplateKey;
};
