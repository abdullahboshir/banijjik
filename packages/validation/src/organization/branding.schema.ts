import { BRANDING_RULES } from "@banijjik/contracts";
import { z } from "zod";

const hexColorSchema = z
  .string()
  .regex(BRANDING_RULES.colorPattern)
  .transform((color) => color.toLowerCase());

/**
 * The `branding` object of `PATCH /profile`: a value sets the key, `null` clears it, an absent key
 * leaves it. The format is checked here; the contrast rules and the logo file are checked by the use
 * case, because only a use case can answer with the field-specific message key (ADR-114).
 */
export const brandingUpdateSchema = z.strictObject({
  logoFileId: z.string().min(1).nullable().optional(),
  primaryColor: hexColorSchema.nullable().optional(),
  accentColor: hexColorSchema.nullable().optional(),
  tagline: z.string().trim().min(1).max(BRANDING_RULES.taglineMaxLength).nullable().optional(),
});
