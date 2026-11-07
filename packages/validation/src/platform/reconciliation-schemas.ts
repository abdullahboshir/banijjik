import { RECONCILIATION_SOURCE_TYPE } from "@banijjik/contracts";
import { z } from "zod";
import { uuidV7Schema } from "../uuid-v7.schema.js";

export const platformReconciliationQuerySchema = z.strictObject({
  organizationId: uuidV7Schema.optional(),
  sourceType: z.enum(RECONCILIATION_SOURCE_TYPE).optional(),
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type PlatformReconciliationQuery = z.output<
  typeof platformReconciliationQuerySchema
>;

export const platformReconciliationRunRequestSchema = z.strictObject({
  organizationId: uuidV7Schema.optional(),
  sourceType: z.enum(RECONCILIATION_SOURCE_TYPE).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type PlatformReconciliationRunBody = z.output<
  typeof platformReconciliationRunRequestSchema
>;
