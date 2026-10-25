import {
  PAYMENT_REQUEST_TYPE,
  type PaymentMethod,
  type PaymentRequestType,
} from "@banijjik/contracts/payment";
import {
  POS_CATALOG_SNAPSHOT_DEFAULT_LIMIT,
  POS_CATALOG_SNAPSHOT_MAX_LIMIT,
  POS_DEVICE_NAME_MAX_LENGTH,
  POS_HELD_CART_LABEL_MAX_LENGTH,
  POS_MAX_COLLECTION_ALLOCATIONS,
  POS_MAX_SALE_PAYMENTS,
  POS_PAIRING_RULES,
  POS_SALE_PAYMENT_METHODS,
  POS_SESSION_LIST_DEFAULT_LIMIT,
  POS_SESSION_LIST_MAX_LIMIT,
  POS_SESSION_NOTE_MAX_LENGTH,
  POS_SESSION_STATUS,
} from "@banijjik/contracts/pos";
import { MAX_ORDER_LINES } from "@banijjik/contracts/sales";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { versionSchema } from "../organization/organization-fields.js";
import { paginationQuerySchema } from "../pagination.js";
import { salesReturnRequestSchema } from "../sales/sales-return-schemas.js";
import { orderInstantRequestSchema, orderLineInputSchema } from "../sales/sales-schemas.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

// Safe: the list is non-empty and holds only payment methods, so the enum keeps the PaymentMethod type.
const paymentMethodValues = POS_SALE_PAYMENT_METHODS as readonly [
  PaymentMethod,
  ...PaymentMethod[],
];
const requestTypeValues = Object.values(PAYMENT_REQUEST_TYPE) as [
  PaymentRequestType,
  ...PaymentRequestType[],
];
const DIGITS_ONLY = /^[0-9]+$/;
const MAX_CURSOR_LENGTH = 200;

/** `POST /pos/devices`: the location is a form field, checked against the caller's assignments. */
export const posDeviceCreateRequestSchema = z.strictObject({
  locationId: uuidV7Schema,
  name: z.string().trim().min(1).max(POS_DEVICE_NAME_MAX_LENGTH),
});

/** `POST /pos/devices/pair`: eight digits, nothing else. */
export const posDevicePairRequestSchema = z.strictObject({
  pairingCode: z.string().length(POS_PAIRING_RULES.codeLength).regex(DIGITS_ONLY),
});

export const posDeviceRevokeRequestSchema = z.strictObject({ version: versionSchema });

export const posDeviceListQuerySchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema.optional(),
});

/** Not strict: the tenant mount also puts `organizationId` on `req.params`. */
export const posDeviceIdParamsSchema = z.object({ posDeviceId: uuidV7Schema });
export const posSessionIdParamsSchema = z.object({ posSessionId: uuidV7Schema });
export const posHeldCartIdParamsSchema = z.object({ posHeldCartId: uuidV7Schema });

export const posSessionOpenRequestSchema = z.strictObject({ openingFloat: moneySchema });

export const posSessionCloseRequestSchema = z.strictObject({
  countedCash: moneySchema,
  version: versionSchema,
  note: z.string().trim().max(POS_SESSION_NOTE_MAX_LENGTH).nullable().optional(),
});

export const posSessionListQuerySchema = z.strictObject({
  locationId: uuidV7Schema.optional(),
  status: z.enum(POS_SESSION_STATUS).optional(),
  cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(POS_SESSION_LIST_MAX_LIMIT)
    .default(POS_SESSION_LIST_DEFAULT_LIMIT),
});

const posPaymentSchema = z.strictObject({
  method: z.enum(paymentMethodValues),
  amount: moneySchema.refine((money) => money.amount > 0),
  externalReference: z.string().trim().min(1).max(100).optional(),
});

export const posSaleLineInputSchema = orderLineInputSchema.extend({
  unitPriceOverride: moneySchema.optional(),
});

/**
 * `POST /pos/sales`: the instant-sale body of `POST /orders/instant` without a location (the
 * device owns it) plus the tender. Every payment amount is what is applied to the bill; the
 * cash handed over goes in `cashTendered` and the change is worked out by the server.
 */
export const posSaleRequestSchema = orderInstantRequestSchema
  .omit({ locationId: true, lines: true })
  .extend({
    lines: z.array(posSaleLineInputSchema).min(1).max(MAX_ORDER_LINES),
    payments: z.array(posPaymentSchema).max(POS_MAX_SALE_PAYMENTS).default([]),
    storeCreditUse: moneySchema.optional(),
    cashTendered: moneySchema.optional(),
    approvalTokens: z
      .strictObject({
        discount: z.string().min(1).optional(),
        priceOverride: z.string().min(1).optional(),
      })
      .optional(),
  });

const posHeldCartPayloadSchema = orderInstantRequestSchema
  .omit({ locationId: true, approvalToken: true, fulfillmentMethod: true })
  .extend({
    contactId: uuidV7Schema.nullable().optional(),
  });

/** `POST /pos/held-carts`: stores a cart without prices, payments or approval tokens (A2-1). */
export const posHeldCartCreateRequestSchema = z.strictObject({
  label: z.string().trim().min(1).max(POS_HELD_CART_LABEL_MAX_LENGTH),
  cart: posHeldCartPayloadSchema,
});

export const posHeldCartDeleteQuerySchema = z.strictObject({
  version: z.coerce.number().int().min(1).optional(),
});

const posCollectionAllocationSchema = z.strictObject({
  requestType: z.enum(requestTypeValues),
  requestId: uuidV7Schema,
  enrollmentPeriodId: uuidV7Schema.optional().nullable(),
  amount: moneySchema.refine((money) => money.amount > 0),
});

/** `POST /pos/collections`: collect a due at the till in one transaction (A2-3). */
export const posCollectionRequestSchema = z.strictObject({
  allocations: z.array(posCollectionAllocationSchema).min(1).max(POS_MAX_COLLECTION_ALLOCATIONS),
  payments: z.array(posPaymentSchema).min(1).max(POS_MAX_SALE_PAYMENTS),
  cashTendered: moneySchema.optional(),
});

/** `POST /pos/returns`: cash or other return at the till, linked to the open session (A2-4). */
export const posReturnRequestSchema = salesReturnRequestSchema.extend({
  orderId: uuidV7Schema,
});

const sinceSchema = z.iso.datetime({ offset: true });

/** `GET /pos/catalog-snapshot`: an opaque keyset cursor, at most 500 offerings a page. */
export const posCatalogSnapshotQuerySchema = z.strictObject({
  since: sinceSchema.optional(),
  cursor: z.string().min(1).max(MAX_CURSOR_LENGTH).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(POS_CATALOG_SNAPSHOT_MAX_LIMIT)
    .default(POS_CATALOG_SNAPSHOT_DEFAULT_LIMIT),
});

export type PosDeviceCreateBody = z.infer<typeof posDeviceCreateRequestSchema>;
export type PosDevicePairBody = z.infer<typeof posDevicePairRequestSchema>;
export type PosDeviceRevokeBody = z.infer<typeof posDeviceRevokeRequestSchema>;
export type PosDeviceListQuery = z.infer<typeof posDeviceListQuerySchema>;
export type PosSessionOpenBody = z.infer<typeof posSessionOpenRequestSchema>;
export type PosSessionCloseBody = z.infer<typeof posSessionCloseRequestSchema>;
export type PosSessionListQuery = z.infer<typeof posSessionListQuerySchema>;
export type PosSaleBody = z.infer<typeof posSaleRequestSchema>;
export type PosHeldCartCreateBody = z.infer<typeof posHeldCartCreateRequestSchema>;
export type PosHeldCartDeleteQuery = z.infer<typeof posHeldCartDeleteQuerySchema>;
export type PosCollectionBody = z.infer<typeof posCollectionRequestSchema>;
export type PosReturnBody = z.infer<typeof posReturnRequestSchema>;
export type PosCatalogSnapshotQuery = z.infer<typeof posCatalogSnapshotQuerySchema>;
