import { PREFERRED_LOCALE } from "@banijjik/contracts";
import { z } from "zod";
import { emailSchema } from "../email.js";
import { phoneE164Schema } from "../phone.js";
import { PASSWORD_INPUT_MAX_LENGTH } from "./password-input.js";

const NAME_MAX_LENGTH = 100;

/**
 * Body of `POST /auth/register`. That one of email and phone is present, and the password rules,
 * are checked by the iam domain, which owns those messages. The cap on the password only keeps
 * the hashing input bounded.
 */
export const userRegisterRequestSchema = z.strictObject({
  name: z.string().trim().min(1).max(NAME_MAX_LENGTH),
  email: emailSchema.optional(),
  phone: phoneE164Schema.optional(),
  password: z.string().max(PASSWORD_INPUT_MAX_LENGTH),
  preferredLocale: z.enum(PREFERRED_LOCALE).optional(),
});
