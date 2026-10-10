import {
  ORGANIZATION_NAME_MAX_LENGTH,
  ORGANIZATION_NAME_MIN_LENGTH,
  PREFERRED_LOCALE,
} from "@banijjik/contracts";
import { z } from "zod";
import { emailSchema } from "../email.js";
import { phoneE164Schema } from "../phone.js";
import { postalAddressSchema, versionSchema } from "./organization-fields.js";

const LEGAL_NAME_MAX_LENGTH = 120;
const LEGAL_TYPE_MAX_LENGTH = 60;
const TRADE_LICENSE_MAX_LENGTH = 60;

const profileFieldsSchema = z.strictObject({
  legalName: z.string().trim().min(1).max(LEGAL_NAME_MAX_LENGTH).optional(),
  legalType: z.string().trim().min(1).max(LEGAL_TYPE_MAX_LENGTH).optional(),
  phoneE164: phoneE164Schema.optional(),
  email: emailSchema.optional(),
  address: postalAddressSchema.optional(),
  tradeLicenseNumber: z.string().trim().min(1).max(TRADE_LICENSE_MAX_LENGTH).optional(),
});

/**
 * Body of `PATCH /orgs/{organizationId}/profile`. Slug, currency, timezone, country and the
 * industry template are not editable here (plan 1.7b decision 3); unknown keys are rejected.
 */
export const profileUpdateRequestSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .min(ORGANIZATION_NAME_MIN_LENGTH)
      .max(ORGANIZATION_NAME_MAX_LENGTH)
      .optional(),
    defaultLocale: z.enum(PREFERRED_LOCALE).optional(),
    profile: profileFieldsSchema.optional(),
    version: versionSchema,
  })
  .refine((body) => Object.keys(body).some((key) => key !== "version"));
export type ProfileUpdateBody = z.output<typeof profileUpdateRequestSchema>;
