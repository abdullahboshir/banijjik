import type { PaymentMethod } from "@banijjik/contracts/payment";
import {
  POS_CATALOG_SNAPSHOT_DEFAULT_LIMIT,
  POS_CATALOG_SNAPSHOT_MAX_LIMIT,
  POS_DEVICE_NAME_MAX_LENGTH,
  POS_MAX_SALE_PAYMENTS,
  POS_PAIRING_RULES,
  POS_SALE_PAYMENT_METHODS,
  POS_SESSION_NOTE_MAX_LENGTH,
} from "@banijjik/contracts/pos";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { versionSchema } from "../organization/organization-fields.js";
import { paginationQuerySchema } from "../pagination.js";
import { orderInstantRequestSchema } from "../sales/sales-schemas.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

// Safe: the list is non-empty and holds only payment methods, so the enum keeps the PaymentMethod type.
const paymentMethodValues = POS_SALE_PAYMENT_METHODS as readonly [
  PaymentMethod,
  ...PaymentMethod[],
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

export const posSessionOpenRequestSchema = z.strictObject({ openingFloat: moneySchema });

export const posSessionCloseRequestSchema = z.strictObject({
  countedCash: moneySchema,
  version: versionSchema,
  note: z.string().trim().max(POS_SESSION_NOTE_MAX_LENGTH).nullable().optional(),
});

const posPaymentSchema = z.strictObject({
  method: z.enum(paymentMethodValues),
  amount: moneySchema.refine((money) => money.amount > 0),
  externalReference: z.string().trim().min(1).max(100).optional(),
});

/**
 * `POST /pos/sales`: the instant-sale body of `POST /orders/instant` without a location (the
 * device owns it) plus the tender. Every payment amount is what is applied to the bill; the
 * cash handed over goes in `cashTendered` and the change is worked out by the server.
 */
export const posSaleRequestSchema = orderInstantRequestSchema.omit({ locationId: true }).extend({
  payments: z.array(posPaymentSchema).max(POS_MAX_SALE_PAYMENTS).default([]),
  storeCreditUse: moneySchema.optional(),
  cashTendered: moneySchema.optional(),
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
export type PosSaleBody = z.infer<typeof posSaleRequestSchema>;
export type PosCatalogSnapshotQuery = z.infer<typeof posCatalogSnapshotQuerySchema>;
