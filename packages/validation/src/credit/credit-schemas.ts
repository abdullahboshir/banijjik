import {
  CREDIT_ADJUST_REASON_MAX_LENGTH,
  CREDIT_PACK_NAME_MAX_LENGTH,
  CREDIT_PURCHASE_METHOD,
  CREDIT_PURCHASE_STATUS,
} from "@banijjik/contracts/credit";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { paginationQuerySchema } from "../pagination.js";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const packNameSchema = z.strictObject({
  bn: z.string().trim().min(1).max(CREDIT_PACK_NAME_MAX_LENGTH),
  en: z.string().trim().min(1).max(CREDIT_PACK_NAME_MAX_LENGTH),
});

export const creditPaymentMethodSettingItemSchema = z.strictObject({
  method: z.enum([CREDIT_PURCHASE_METHOD.BKASH, CREDIT_PURCHASE_METHOD.NAGAD]),
  accountNumber: z.string().trim().min(5).max(30),
  accountType: z.string().trim().min(1).max(30),
  instructions: z.strictObject({
    bn: z.string().trim().min(1).max(500),
    en: z.string().trim().min(1).max(500),
  }),
});

export const creditPaymentMethodsSettingSchema = z.array(creditPaymentMethodSettingItemSchema);

export const transactionReferenceSchema = z
  .string()
  .trim()
  .transform((val) => val.toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{6,30}$/));

export const creditPurchaseSubmitRequestSchema = z.strictObject({
  creditPackId: uuidV7Schema,
  method: z.enum([CREDIT_PURCHASE_METHOD.BKASH, CREDIT_PURCHASE_METHOD.NAGAD]),
  senderPhone: phoneE164Schema,
  transactionReference: transactionReferenceSchema,
});

export const creditPurchaseVerifyRequestSchema = z.strictObject({
  version: z.number().int().positive(),
  approvalToken: z.string().trim().min(1).max(200).optional(),
});

export const creditPurchaseRejectRequestSchema = z.strictObject({
  version: z.number().int().positive(),
  reason: z.string().trim().min(1).max(200),
});

export const creditPurchaseIdParamsSchema = z.object({
  creditPurchaseId: uuidV7Schema,
});

export const creditPurchasesStaffQuerySchema = paginationQuerySchema.extend({
  status: z
    .enum([
      CREDIT_PURCHASE_STATUS.PENDING,
      CREDIT_PURCHASE_STATUS.VERIFIED,
      CREDIT_PURCHASE_STATUS.REJECTED,
      CREDIT_PURCHASE_STATUS.CANCELLED,
    ])
    .optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const myCreditPurchasesQuerySchema = paginationQuerySchema;

export const creditPackCreateRequestSchema = z.strictObject({
  name: packNameSchema,
  credits: z.number().int().positive(),
  price: moneySchema,
  validityDays: z.number().int().positive().nullable(),
  sortOrder: z.number().int().nonnegative(),
});

export const creditPackUpdateRequestSchema = z.strictObject({
  name: packNameSchema,
  credits: z.number().int().positive(),
  price: moneySchema,
  validityDays: z.number().int().positive().nullable(),
  sortOrder: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});

export const creditPackArchiveRequestSchema = z.strictObject({
  version: z.number().int().positive(),
});

export const creditAdjustRequestSchema = z.strictObject({
  credits: z.union([z.number().int().positive(), z.number().int().negative()]),
  reason: z.string().trim().min(1).max(CREDIT_ADJUST_REASON_MAX_LENGTH),
  approvalToken: z.string().trim().min(1).max(200).optional(),
});

export const unlockListingParamsSchema = z.object({
  listingNumber: z.string().trim().min(1).max(40),
});

export const creditAccountIdParamsSchema = z.object({
  customerAccountId: uuidV7Schema,
});

export const creditPackIdParamsSchema = z.object({
  creditPackId: uuidV7Schema,
});

export const creditPacksQuerySchema = paginationQuerySchema;

export const creditEntriesQuerySchema = paginationQuerySchema;

export const unlocksQuerySchema = paginationQuerySchema;
