import { CURRENCY_CODE } from "@banijjik/contracts";
import { MAX_STOCK_COMPONENTS, UNIT_KEY } from "@banijjik/contracts/catalog";
import { z } from "zod";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const MAX_SAFE_MINOR_UNITS = Number.MAX_SAFE_INTEGER;
const SKU_MAX_LENGTH = 64;
const BARCODE_MAX_LENGTH = 64;
const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._\-/]*$/;
const BARCODE_PATTERN = /^[A-Za-z0-9]+$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MAX_LENGTH = 80;

/** Money in JSON: an integer of minor units and the currency code. A float such as 12.5 is refused (ADR-013). */
export const moneySchema = z.strictObject({
  amount: z.number().int().min(0).max(MAX_SAFE_MINOR_UNITS),
  currency: z.enum(CURRENCY_CODE),
});

export const slugSchema = z.string().trim().min(1).max(SLUG_MAX_LENGTH).regex(SLUG_PATTERN);

export const skuSchema = z.string().trim().min(1).max(SKU_MAX_LENGTH).regex(SKU_PATTERN);

export const barcodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(BARCODE_MAX_LENGTH)
  .regex(BARCODE_PATTERN);

export const unitKeySchema = z.enum(UNIT_KEY);

/**
 * `{ min, step, max? }`, integers in the sales unit's precision: loose rice in KG is
 * `{ min: 250, step: 250 }` (grams). `min >= step > 0` and `max >= min`.
 */
export const quantityRuleSchema = z
  .strictObject({
    min: z.number().int().positive(),
    step: z.number().int().positive(),
    max: z.number().int().positive().optional(),
  })
  .refine((rule) => rule.min >= rule.step, { path: ["min"] })
  .refine((rule) => rule.max === undefined || rule.max >= rule.min, { path: ["max"] });

export const stockComponentsSchema = z
  .array(
    z.strictObject({
      inventoryItemId: uuidV7Schema,
      quantity: z.number().int().positive(),
    }),
  )
  .max(MAX_STOCK_COMPONENTS);

/** A list of distinct ids, at most `max` long. */
export function idListSchema(max: number): z.ZodType<string[]> {
  return z
    .array(uuidV7Schema)
    .max(max)
    .refine((ids) => new Set(ids).size === ids.length);
}
