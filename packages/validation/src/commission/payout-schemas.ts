import {
  COMMISSION_PAYOUT_METHOD,
  COMMISSION_PAYOUT_REFERENCE_METHODS,
} from "@banijjik/contracts/commission";
import { z } from "zod";
import { moneySchema } from "../catalog/catalog-parts.js";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const isoDateSchema = z.iso.date();

export const commissionPayoutPreviewQuerySchema = z.strictObject({
  memberId: uuidV7Schema,
  location: uuidV7Schema,
  upTo: isoDateSchema,
});
export type CommissionPayoutPreviewQuery = z.infer<typeof commissionPayoutPreviewQuerySchema>;

export const commissionPayoutCreateRequestSchema = z
  .strictObject({
    memberId: uuidV7Schema,
    locationId: uuidV7Schema,
    upToBusinessDate: isoDateSchema,
    expectedTotal: moneySchema,
    method: z.enum(COMMISSION_PAYOUT_METHOD),
    externalReference: z.string().trim().min(1).max(100).optional(),
    note: z.string().trim().min(1).max(1000).optional(),
  })
  .superRefine((value, context) => {
    const needsReference = COMMISSION_PAYOUT_REFERENCE_METHODS.includes(value.method);
    if (needsReference && value.externalReference === undefined) {
      context.addIssue({ code: "custom", path: ["externalReference"], message: "required" });
    }
  });
export type CommissionPayoutCreateBody = z.infer<typeof commissionPayoutCreateRequestSchema>;

/** Not strict: tenant routers merge `organizationId` into params. */
export const commissionPayoutIdParamsSchema = z.object({ commissionPayoutId: uuidV7Schema });

export const commissionPayoutListQuerySchema = z.strictObject({
  memberId: uuidV7Schema.optional(),
  location: uuidV7Schema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type CommissionPayoutListQuery = z.infer<typeof commissionPayoutListQuerySchema>;
