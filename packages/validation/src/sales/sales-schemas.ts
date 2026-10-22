import { MAX_MODIFIER_OPTIONS_PER_LINE, MANUAL_DISCOUNT_TYPE } from "@banijjik/contracts/pricing";
import {
  MAX_ORDER_CANCEL_REASON_LENGTH,
  MAX_ORDER_LINES,
  MAX_ORDER_NOTE_LENGTH,
  MAX_ORDER_SEARCH_LENGTH,
  ORDER_STATUS,
} from "@banijjik/contracts/sales";
import { z } from "zod";
import {
  customFieldValuesRequestSchema,
  versionSchema,
} from "../organization/organization-fields.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const isoInstantSchema = z.iso.datetime({ offset: true }).or(z.iso.date());

const manualDiscountSchema = z.strictObject({
  type: z.enum(MANUAL_DISCOUNT_TYPE),
  value: z.number().int().min(0).max(MAX_SAFE),
});

export const orderLineInputSchema = z.strictObject({
  offeringId: uuidV7Schema,
  variantId: uuidV7Schema,
  /** Integer in the sales unit's precision (ADR-047). */
  quantity: z.number().int().positive().max(MAX_SAFE),
  modifierOptionIds: z.array(uuidV7Schema).max(MAX_MODIFIER_OPTIONS_PER_LINE).default([]),
  manualDiscount: manualDiscountSchema.optional(),
});

const orderLinesSchema = z.array(orderLineInputSchema).max(MAX_ORDER_LINES);

const noteSchema = z.string().trim().max(MAX_ORDER_NOTE_LENGTH).nullable().optional();

/** `POST /orders`: a DRAFT, always PICKUP until fulfillment methods arrive (decision 4). */
export const orderCreateRequestSchema = z.strictObject({
  locationId: uuidV7Schema,
  contactId: uuidV7Schema.optional(),
  lines: orderLinesSchema.default([]),
  orderDiscount: manualDiscountSchema.optional(),
  note: noteSchema,
  customFields: customFieldValuesRequestSchema.optional(),
});

/**
 * `PATCH /orders/{orderId}`. Lines replace the whole list when sent; custom fields merge by key.
 * A null `orderDiscount` or `note` clears the value.
 */
export const orderUpdateRequestSchema = z.strictObject({
  version: versionSchema,
  contactId: uuidV7Schema.nullable().optional(),
  lines: orderLinesSchema.optional(),
  orderDiscount: manualDiscountSchema.nullable().optional(),
  approvalToken: z.string().min(1).optional(),
  note: noteSchema,
  customFields: customFieldValuesRequestSchema.optional(),
});

/** `POST /orders/instant`: create and complete in one transaction (decision 5). */
export const orderInstantRequestSchema = z.strictObject({
  locationId: uuidV7Schema,
  contactId: uuidV7Schema.optional(),
  lines: orderLinesSchema.min(1),
  orderDiscount: manualDiscountSchema.optional(),
  note: noteSchema,
  customFields: customFieldValuesRequestSchema.optional(),
});

/** `place` may carry the discount approval; every transition body carries the expected version. */
export const orderPlaceRequestSchema = z.strictObject({
  version: versionSchema,
  approvalToken: z.string().min(1).optional(),
});

export const orderTransitionRequestSchema = z.strictObject({
  version: versionSchema,
});

export const orderCancelRequestSchema = z.strictObject({
  version: versionSchema,
  reason: z.string().trim().min(1).max(MAX_ORDER_CANCEL_REASON_LENGTH),
});

export const orderListQuerySchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema.optional(),
  status: z.enum(ORDER_STATUS).optional(),
  contactId: uuidV7Schema.optional(),
  q: z.string().trim().max(MAX_ORDER_SEARCH_LENGTH).optional(),
  from: isoInstantSchema.optional(),
  to: isoInstantSchema.optional(),
});

/** Not strict: the tenant mount also puts `organizationId` on `req.params`. */
export const orderIdParamsSchema = z.object({
  orderId: uuidV7Schema,
});

export type OrderLineInputBody = z.infer<typeof orderLineInputSchema>;
export type OrderCreateBody = z.infer<typeof orderCreateRequestSchema>;
export type OrderUpdateBody = z.infer<typeof orderUpdateRequestSchema>;
export type OrderInstantBody = z.infer<typeof orderInstantRequestSchema>;
export type OrderPlaceBody = z.infer<typeof orderPlaceRequestSchema>;
export type OrderTransitionBody = z.infer<typeof orderTransitionRequestSchema>;
export type OrderCancelBody = z.infer<typeof orderCancelRequestSchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
