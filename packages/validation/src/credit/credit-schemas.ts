import {
  CREDIT_ADJUST_REASON_MAX_LENGTH,
  CREDIT_PACK_NAME_MAX_LENGTH,
} from "@banijjik/contracts/credit";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const packNameSchema = z.strictObject({
  bn: z.string().trim().min(1).max(CREDIT_PACK_NAME_MAX_LENGTH),
  en: z.string().trim().min(1).max(CREDIT_PACK_NAME_MAX_LENGTH),
});

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
