import { INVENTORY_ITEM_STATUS } from "@banijjik/contracts/inventory";
import { UNIT_KEY } from "@banijjik/contracts/catalog";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const unitKeySchema = z.enum(Object.values(UNIT_KEY) as [string, ...string[]]);

export const inventoryItemIdParamsSchema = z.object({
  inventoryItemId: uuidV7Schema,
});

export const inventoryItemListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(Object.values(INVENTORY_ITEM_STATUS) as [string, ...string[]]).optional(),
});

export const inventoryItemCreateRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(64).optional(),
  baseUnitKey: unitKeySchema,
  lowStockThreshold: z.number().int().nonnegative().optional(),
});

export const inventoryItemUpdateRequestSchema = z.object({
  version: z.number().int().nonnegative(),
  name: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().min(1).max(64).nullable().optional(),
  lowStockThreshold: z.number().int().nonnegative().nullable().optional(),
});

export type InventoryItemCreateBody = z.infer<typeof inventoryItemCreateRequestSchema>;
export type InventoryItemUpdateBody = z.infer<typeof inventoryItemUpdateRequestSchema>;
