import { z } from "zod";
import { ENROLLMENT_STATUS } from "@banijjik/contracts/enrollment";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { paginationQuerySchema } from "../pagination.js";

const businessDate = z.iso.date();
export const enrollmentCreateRequestSchema = z.strictObject({
  locationId: uuidV7Schema,
  contactId: uuidV7Schema,
  billToContactId: uuidV7Schema.optional(),
  offeringId: uuidV7Schema,
  variantId: uuidV7Schema,
  startsOn: businessDate,
  autoRenew: z.boolean().optional(),
  resourceIds: z.array(uuidV7Schema).max(20).default([]),
  customFields: z.record(z.string(), z.unknown()).default({}),
});
export type EnrollmentCreateBody = z.infer<typeof enrollmentCreateRequestSchema>;
export const enrollmentVersionRequestSchema = z.strictObject({
  version: z.number().int().positive(),
});
export const enrollmentIdParamsSchema = z.strictObject({ enrollmentId: uuidV7Schema });
export const enrollmentListQuerySchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema.optional(),
  status: z.enum(ENROLLMENT_STATUS).optional(),
  offeringId: uuidV7Schema.optional(),
  contactId: uuidV7Schema.optional(),
  due: businessDate.optional(),
});
export type EnrollmentListQuery = z.infer<typeof enrollmentListQuerySchema>;
export const checkInCreateRequestSchema = z
  .strictObject({
    locationId: uuidV7Schema,
    contactId: uuidV7Schema,
    enrollmentId: uuidV7Schema.optional(),
    bookingId: uuidV7Schema.optional(),
    approvalToken: z.string().min(1).max(256).optional(),
  })
  .refine((body) => !(body.enrollmentId && body.bookingId));
export type CheckInCreateBody = z.infer<typeof checkInCreateRequestSchema>;
export const checkInListQuerySchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema.optional(),
  checkedInOn: businessDate.optional(),
  contactId: uuidV7Schema.optional(),
});
export type CheckInListQuery = z.infer<typeof checkInListQuerySchema>;
