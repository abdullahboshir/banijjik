import { STOCK_ADJUSTMENT_REASON, STOCK_RECEIPT_PAID_VIA } from "@banijjik/contracts/inventory";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const moneySchema = z.object({
  amount: z.number().int(),
  currency: z.string().length(3),
});

const receiptLineSchema = z.object({
  inventoryItemId: uuidV7Schema,
  quantity: z.number().int().positive(),
  unitCost: moneySchema,
});

export const stockReceiptRequestSchema = z.object({
  locationId: uuidV7Schema,
  paidVia: z.enum([
    STOCK_RECEIPT_PAID_VIA.CASH,
    STOCK_RECEIPT_PAID_VIA.BKASH,
    STOCK_RECEIPT_PAID_VIA.NAGAD,
    STOCK_RECEIPT_PAID_VIA.BANK,
    STOCK_RECEIPT_PAID_VIA.ON_CREDIT,
  ]),
  supplierNote: z.string().trim().max(500).optional(),
  lines: z.array(receiptLineSchema).min(1).max(100),
});

const adjustmentLineSchema = z.object({
  inventoryItemId: uuidV7Schema,
  quantityDelta: z
    .number()
    .int()
    .refine((value) => value !== 0, { message: "validation.invalid_value" }),
  reason: z.enum([STOCK_ADJUSTMENT_REASON.ADJUSTMENT, STOCK_ADJUSTMENT_REASON.DAMAGE_WRITE_OFF]),
  note: z.string().trim().max(500).optional(),
});

export const stockAdjustmentRequestSchema = z.object({
  locationId: uuidV7Schema,
  approvalToken: z.string().min(1).optional(),
  lines: z.array(adjustmentLineSchema).min(1).max(100),
});

const transferLineSchema = z.object({
  inventoryItemId: uuidV7Schema,
  quantity: z.number().int().positive(),
});

export const stockTransferRequestSchema = z.object({
  fromLocationId: uuidV7Schema,
  toLocationId: uuidV7Schema,
  lines: z.array(transferLineSchema).min(1).max(100),
});

export const stockLevelsQuerySchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema,
  q: z.string().trim().min(1).max(200).optional(),
  lowOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const stockMovementsQuerySchema = paginationQuerySchema.extend({
  inventoryItemId: uuidV7Schema.optional(),
  locationId: uuidV7Schema.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const offeringAvailabilityQuerySchema = z.object({
  locationId: uuidV7Schema,
});

export const inventoryLevelsRebuildRequestSchema = z.object({
  locationId: uuidV7Schema.optional(),
  fix: z.boolean().default(false),
});

export type StockReceiptBody = z.infer<typeof stockReceiptRequestSchema>;
export type StockAdjustmentBody = z.infer<typeof stockAdjustmentRequestSchema>;
export type StockTransferBody = z.infer<typeof stockTransferRequestSchema>;
export type InventoryLevelsRebuildBody = z.infer<typeof inventoryLevelsRebuildRequestSchema>;
export type StockLevelsQuery = z.infer<typeof stockLevelsQuerySchema>;
export type StockMovementsQuery = z.infer<typeof stockMovementsQuerySchema>;
export type OfferingAvailabilityQuery = z.infer<typeof offeringAvailabilityQuerySchema>;
