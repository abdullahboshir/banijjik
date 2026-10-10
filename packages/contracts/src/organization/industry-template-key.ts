import { defineEnum } from "../define-enum.js";

/**
 * The seed industry templates of 12-INDUSTRY-TEMPLATES. Whether one is PUBLISHED or DRAFT
 * (ADR-075) is registry data owned by platform/industry, not part of this list.
 */
export const INDUSTRY_TEMPLATE_KEY = defineEnum([
  "FCOMMERCE",
  "RETAIL",
  "SALON",
  "CLINIC",
  "GYM",
  "COACHING",
  "RESTAURANT",
  "HOSTEL",
]);

export type IndustryTemplateKey =
  (typeof INDUSTRY_TEMPLATE_KEY)[keyof typeof INDUSTRY_TEMPLATE_KEY];
