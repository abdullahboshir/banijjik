import { PREFERRED_LOCALE } from "@banijjik/contracts";
import { z } from "zod";

const NAME_MAX_LENGTH = 100;

/** Body of `PATCH /me`. `version` is required: a stale one is a 409 (14-API.md section 2). */
export const meUpdateRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH).optional(),
  preferredLocale: z.enum(PREFERRED_LOCALE).optional(),
  version: z.number().int().min(1),
});
