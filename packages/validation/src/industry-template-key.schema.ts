import { INDUSTRY_TEMPLATE_KEY_PATTERN, type IndustryTemplateKey } from "@banijjik/contracts";
import { z } from "zod";

/**
 * Format only (ADR-097). A key that matches and is not in the database is a business rule,
 * not a validation error.
 */
export const industryTemplateKeySchema = z
  .string()
  .regex(INDUSTRY_TEMPLATE_KEY_PATTERN)
  // Safe: the regex is the brand's format, and the brand exists only at type level (ADR-097).
  .transform((value): IndustryTemplateKey => value as IndustryTemplateKey);
