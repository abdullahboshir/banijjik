import { CONTACT_NAME_MAX_LENGTH } from "@banijjik/contracts/contact";
import { z } from "zod";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const contactNameSchema = z.string().trim().min(1).max(CONTACT_NAME_MAX_LENGTH);

export const checkoutContactSnapshotSchema = z.strictObject({
  name: contactNameSchema,
  phoneE164: phoneE164Schema,
  customFields: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Intake schema for checkout contact input. Accepts either phone or phoneE164,
 * normalizing to phoneE164. Rejects extra fields strictly.
 */
export const checkoutContactIntakeSchema = z
  .strictObject({
    name: contactNameSchema,
    phone: phoneE164Schema.optional(),
    phoneE164: phoneE164Schema.optional(),
    customFields: z.record(z.string(), z.unknown()).default({}),
  })
  .refine((data) => data.phone !== undefined || data.phoneE164 !== undefined, {
    message: "validation.required",
    path: ["phone"],
  })
  .transform((data) => ({
    name: data.name,
    phoneE164: (data.phoneE164 ?? data.phone) as string,
    customFields: data.customFields,
  }));

export const createProvisionalContactInputSchema = z.strictObject({
  organizationId: uuidV7Schema,
  guestSessionId: uuidV7Schema,
  name: contactNameSchema,
  phoneE164: phoneE164Schema,
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export type CheckoutContactSnapshotInput = z.output<typeof checkoutContactSnapshotSchema>;
export type CheckoutContactIntakeInput = z.output<typeof checkoutContactIntakeSchema>;
export type CreateProvisionalContactPayload = z.output<typeof createProvisionalContactInputSchema>;
