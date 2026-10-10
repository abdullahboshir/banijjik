import {
  ORGANIZATION_SLUG_MAX_LENGTH,
  ORGANIZATION_SLUG_MIN_LENGTH,
  ORGANIZATION_SLUG_PATTERN,
  RESERVED_ORGANIZATION_SLUGS,
} from "@banijjik/contracts";
import { z } from "zod";

/**
 * An organization slug as typed by a person: trimmed and lower-cased first, then checked for
 * length, characters and reserved words. The parsed value is the one that gets stored.
 */
export const organizationSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(ORGANIZATION_SLUG_MIN_LENGTH)
  .max(ORGANIZATION_SLUG_MAX_LENGTH)
  .regex(ORGANIZATION_SLUG_PATTERN)
  .refine((slug) => !RESERVED_ORGANIZATION_SLUGS.includes(slug));
