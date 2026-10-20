import {
  CREDIT_ADJUST_REASON_MAX_LENGTH,
  CREDIT_PACK_NAME_MAX_LENGTH,
} from "@banijjik/contracts/credit";
import { moneySchema } from "../accounting/money.schema.js";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

export const creditPackCreateRequestSchema = z.strictObject({
  name: z.strictObject({
    bn: z.string().trim().min(1).max(CREDIT_PACK_NAME_MAX_LENGTH),
    en: z.string().trim().min(1).max(CREDIT_PACK_NAME_MAX_LENGTH),
  }),
  credits: z.number().int().positive(),
  price: moneySchema,
  validityDays: z.number().int().positive().nullable(),
  sortOrder: z.number().int().nonnegative(),
});

export const creditPackUpdateRequestSchema = z.strictObject({
  name: z.strictObject({
    bn: z.string().trim().min(1).max(CREDIT_PACK_NAME_MAX_LENGTH),
    en: z.string().trim().min(1).max(CREDIT_PACK_NAME_MAX_LENGTH),
  }),
  credits: z.number().int().positive(),
  price: moneySchema,
  validityDays: z.number().int().positive().nullable(),
  sortOrder: z.number().int().nonnegative(),
  version: z.number().int().positive(),
});

export const creditAdjustRequestSchema = z.strictObject({
  credits: z.number().int(),
  reason: z.string().trim().min(1).max(CREDIT_ADJUST_REASON_MAX_LENGTH),
});

export const unlockRequestSchema = z.strictObject({
  idempotencyKey: z.string().trim().min(1).max(200),
});

export const creditAccountIdParamsSchema = z.object({
  customerAccountId: uuidV7Schema,
});

export const creditPacksQuerySchema = paginationQuerySchema;

export const creditEntriesQuerySchema = paginationQuerySchema;

export const unlocksQuerySchema = paginationQuerySchema;
