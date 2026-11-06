import {
  DELIVERY_ASSIGNMENT_STATUS,
  MAX_DELIVERY_NOTES_LENGTH,
  MAX_HANDOVER_PAYMENTS,
  MAX_HANDOVER_REASON_LENGTH,
  RIDER_HANDOVER_RECEIVED_VIA,
  type CreateDeliveryAssignmentRequest,
  type RecordRiderCashHandoverRequest,
  type ReverseRiderCashHandoverRequest,
} from "@banijjik/contracts/delivery";
import { z } from "zod";
import { versionSchema } from "../organization/organization-fields.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const deliveryAssignmentIdParamsSchema = z.object({
  deliveryAssignmentId: uuidV7Schema,
});

export const riderCashHandoverIdParamsSchema = z.object({
  riderCashHandoverId: uuidV7Schema,
});

export const createDeliveryAssignmentRequestSchema: z.ZodType<CreateDeliveryAssignmentRequest> =
  z.strictObject({
    orderId: uuidV7Schema,
    riderMemberId: uuidV7Schema,
    notes: z.string().trim().min(1).max(MAX_DELIVERY_NOTES_LENGTH).optional(),
    shipOrder: z.boolean().optional(),
  });

export const deliveryAssignmentListQuerySchema = paginationQuerySchema.extend({
  orderId: uuidV7Schema.optional(),
  riderMemberId: uuidV7Schema.optional(),
  locationId: uuidV7Schema.optional(),
  status: z.enum(DELIVERY_ASSIGNMENT_STATUS).optional(),
});

export const recordRiderCashHandoverRequestSchema: z.ZodType<RecordRiderCashHandoverRequest> =
  z.strictObject({
    riderMemberId: uuidV7Schema,
    paymentIds: z.array(uuidV7Schema).min(1).max(MAX_HANDOVER_PAYMENTS),
    receivedVia: z.enum(RIDER_HANDOVER_RECEIVED_VIA),
    posSessionId: uuidV7Schema.optional(),
    businessDate: isoDateSchema,
  });

export const reverseRiderCashHandoverRequestSchema: z.ZodType<ReverseRiderCashHandoverRequest> =
  z.strictObject({
    version: versionSchema,
    reason: z.string().trim().min(1).max(MAX_HANDOVER_REASON_LENGTH),
    approvalToken: z.string().trim().min(1),
  });

export type DeliveryAssignmentIdParams = z.infer<typeof deliveryAssignmentIdParamsSchema>;
export type RiderCashHandoverIdParams = z.infer<typeof riderCashHandoverIdParamsSchema>;
export type CreateDeliveryAssignmentBody = z.infer<typeof createDeliveryAssignmentRequestSchema>;
export type DeliveryAssignmentListQuery = z.infer<typeof deliveryAssignmentListQuerySchema>;
export type RecordRiderCashHandoverBody = z.infer<typeof recordRiderCashHandoverRequestSchema>;
export type ReverseRiderCashHandoverBody = z.infer<typeof reverseRiderCashHandoverRequestSchema>;
