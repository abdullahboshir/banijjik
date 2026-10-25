import { MAX_EXCHANGE_PAYMENTS, SALES_EXCHANGE_PAYMENT_METHODS } from "@banijjik/contracts/sales";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { salesReturnRequestSchema } from "./sales-return-schemas.js";
import { orderInstantRequestSchema } from "./sales-schemas.js";

/**
 * `POST /orders/{orderId}/exchange` (plan 3.5b E2). The return part is the return body without its
 * refund method (the server pays the credit); the new order is the instant-sale body without the
 * location, contact and fulfillment (they come from the original order and the INSTANT method).
 */
const exchangeReturnSchema = salesReturnRequestSchema.omit({
  refundMethod: true,
  refundExternalReference: true,
});

const exchangeOrderSchema = orderInstantRequestSchema.omit({
  locationId: true,
  contactId: true,
  fulfillmentMethod: true,
});

const exchangePaymentSchema = z.strictObject({
  method: z.enum(SALES_EXCHANGE_PAYMENT_METHODS),
  amount: moneySchema.refine((money) => money.amount > 0),
  externalReference: z.string().trim().min(1).max(100).optional(),
});

export const salesExchangeRequestSchema = z.strictObject({
  return: exchangeReturnSchema,
  order: exchangeOrderSchema,
  payments: z.array(exchangePaymentSchema).max(MAX_EXCHANGE_PAYMENTS).default([]),
});

export type SalesExchangeRequestBody = z.infer<typeof salesExchangeRequestSchema>;
export type SalesExchangePaymentBody = z.infer<typeof exchangePaymentSchema>;
