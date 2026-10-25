import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import {
  MAX_ORDER_LINES,
  MAX_SALES_RETURN_NOTE_LENGTH,
  SALES_RETURN_REASON,
  RETURN_DISPOSITION,
} from "@banijjik/contracts/sales";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const APPROVAL_TOKEN_MAX_LENGTH = 200;

const approvalTokenSchema = z.string().trim().min(1).max(APPROVAL_TOKEN_MAX_LENGTH);

const salesReturnReverseReasonSchema = z.enum([
  "ENTERED_BY_MISTAKE",
  "CUSTOMER_TOOK_GOODS_BACK",
  "OTHER",
]);

const returnLineSchema = z.strictObject({
  orderLineId: uuidV7Schema,
  /** Integer in the sales unit's precision (ADR-047). The server checks it against what is left. */
  quantity: z.number().int().positive().max(MAX_SAFE),
  disposition: z.enum(RETURN_DISPOSITION),
});

/**
 * `POST /orders/{orderId}/returns` (plan 3.5b decision 11). The client sends quantities and
 * dispositions only; the server computes every amount. Each approval token names its action, so a
 * refund token and a not-received token are never mixed up.
 */
export const salesReturnRequestSchema = z.strictObject({
  lines: z.array(returnLineSchema).min(1).max(MAX_ORDER_LINES),
  returnDeliveryCharge: z.boolean().optional(),
  /** Any payment method: GATEWAY is refused by the use case with PAYMENT_METHOD_NOT_AVAILABLE (decision 5). */
  refundMethod: z.enum(PAYMENT_METHOD).nullable().optional(),
  /** Reference of a mobile-money refund (bKash, Nagad), which the payment module requires. */
  refundExternalReference: z.string().trim().min(1).max(100).optional(),
  reasonKey: z.enum(SALES_RETURN_REASON),
  note: z.string().trim().max(MAX_SALES_RETURN_NOTE_LENGTH).nullable().optional(),
  approvalTokens: z
    .strictObject({
      refund: approvalTokenSchema.optional(),
      returnNotReceived: approvalTokenSchema.optional(),
    })
    .optional(),
});

/** `GET /sales/returns`: the list of returns of one location (plan 3.5b decision 11). */
export const salesReturnListQuerySchema = paginationQuerySchema.extend({
  orderId: uuidV7Schema.optional(),
  locationId: uuidV7Schema.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const salesReturnParamsSchema = z.object({
  salesReturnId: uuidV7Schema,
});

export const salesReturnReverseRequestSchema = z.strictObject({
  version: z.number().int().positive(),
  reasonKey: salesReturnReverseReasonSchema,
  note: z.string().trim().max(MAX_SALES_RETURN_NOTE_LENGTH).nullable().optional(),
  payback: z
    .strictObject({
      method: z.enum(PAYMENT_METHOD),
      externalReference: z.string().trim().min(1).max(100).optional(),
    })
    .optional(),
  approvalToken: approvalTokenSchema,
});

export type SalesReturnRequestBody = z.infer<typeof salesReturnRequestSchema>;
export type SalesReturnListQuery = z.infer<typeof salesReturnListQuerySchema>;
export type SalesReturnParams = z.infer<typeof salesReturnParamsSchema>;
export type SalesReturnReverseRequestBody = z.infer<typeof salesReturnReverseRequestSchema>;
