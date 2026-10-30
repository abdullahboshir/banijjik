import { OFFERING_KIND } from "@banijjik/contracts";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

export const publicOfferingsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  kind: z.nativeEnum(OFFERING_KIND).optional(),
  categoryId: uuidV7Schema.optional(),
  locationId: uuidV7Schema.optional(),
});

export const publicOfferingDetailQuerySchema = z.object({
  locationId: uuidV7Schema.optional(),
});

export const publicOfferingParamsSchema = z.object({
  offeringSlug: z.string().trim().min(1).max(200),
});

export type PublicOfferingsQueryInput = z.infer<typeof publicOfferingsQuerySchema>;
export type PublicOfferingDetailQueryInput = z.infer<typeof publicOfferingDetailQuerySchema>;
export type PublicOfferingParamsInput = z.infer<typeof publicOfferingParamsSchema>;
