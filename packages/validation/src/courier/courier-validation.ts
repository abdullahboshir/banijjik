import {
  COURIER_SETTLEMENT_RECEIVED_VIA,
  MANUAL_COURIER_KEY,
  MAX_EXTERNAL_REFERENCE_LENGTH,
  MAX_SETTLEMENT_PAYMENTS,
  MAX_SETTLEMENT_REASON_LENGTH,
  MAX_TRACKING_NUMBER_LENGTH,
  type CreateConsignmentRequest,
  type RecordCourierSettlementRequest,
  type ReverseCourierSettlementRequest,
} from "@banijjik/contracts/courier";
import { z } from "zod";
import { versionSchema } from "../organization/organization-fields.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const consignmentIdParamsSchema = z.object({
  consignmentId: uuidV7Schema,
});

export const courierSettlementIdParamsSchema = z.object({
  courierSettlementId: uuidV7Schema,
});

export const createConsignmentRequestSchema: z.ZodType<CreateConsignmentRequest> = z.strictObject({
  orderId: uuidV7Schema,
  courierKey: z.enum(MANUAL_COURIER_KEY),
  trackingNumber: z.string().trim().min(1).max(MAX_TRACKING_NUMBER_LENGTH),
  shipOrder: z.boolean().optional(),
});

export const consignmentListQuerySchema = paginationQuerySchema.extend({
  orderId: uuidV7Schema.optional(),
  courierKey: z.enum(MANUAL_COURIER_KEY).optional(),
  locationId: uuidV7Schema.optional(),
});

export const recordCourierSettlementRequestSchema: z.ZodType<RecordCourierSettlementRequest> =
  z.strictObject({
    courierKey: z.enum(MANUAL_COURIER_KEY),
    paymentIds: z.array(uuidV7Schema).min(1).max(MAX_SETTLEMENT_PAYMENTS),
    courierChargesMinor: z.number().int().min(0),
    receivedVia: z.enum(COURIER_SETTLEMENT_RECEIVED_VIA),
    externalReference: z.string().trim().min(1).max(MAX_EXTERNAL_REFERENCE_LENGTH),
    businessDate: isoDateSchema,
  });

export const reverseCourierSettlementRequestSchema: z.ZodType<ReverseCourierSettlementRequest> =
  z.strictObject({
    version: versionSchema,
    reason: z.string().trim().min(1).max(MAX_SETTLEMENT_REASON_LENGTH),
    approvalToken: z.string().trim().min(1),
  });

export type ConsignmentIdParams = z.infer<typeof consignmentIdParamsSchema>;
export type CourierSettlementIdParams = z.infer<typeof courierSettlementIdParamsSchema>;
export type CreateConsignmentBody = z.infer<typeof createConsignmentRequestSchema>;
export type ConsignmentListQuery = z.infer<typeof consignmentListQuerySchema>;
export type RecordCourierSettlementBody = z.infer<typeof recordCourierSettlementRequestSchema>;
export type ReverseCourierSettlementBody = z.infer<typeof reverseCourierSettlementRequestSchema>;
