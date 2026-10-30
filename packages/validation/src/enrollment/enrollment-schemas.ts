import { z } from "zod";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const businessDate = z.iso.date();

export const customerEnrollmentRequestSchema = z.strictObject({
  locationId: uuidV7Schema,
  contactId: uuidV7Schema,
  billToContactId: uuidV7Schema.optional(),
  offeringId: uuidV7Schema,
  variantId: uuidV7Schema,
  startsOn: businessDate,
  autoRenew: z.boolean().optional(),
  resourceIds: z.array(uuidV7Schema).max(20).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
  checkoutId: uuidV7Schema.optional(),
});
export type CustomerEnrollmentRequestBody = z.infer<typeof customerEnrollmentRequestSchema>;
