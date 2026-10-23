import { EVENT_SESSION_STATUS } from "@banijjik/contracts/booking";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

export const eventSessionCreateSchema = z
  .strictObject({
    offeringId: uuidV7Schema,
    variantId: uuidV7Schema,
    locationId: uuidV7Schema,
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    capacity: z.number().int().positive(),
    resourceIds: z.array(uuidV7Schema).default([]),
  })
  .refine((body) => Date.parse(body.startsAt) < Date.parse(body.endsAt), { path: ["endsAt"] });
export const eventSessionUpdateSchema = z.strictObject({
  version: z.number().int().positive(),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().optional(),
  capacity: z.number().int().positive().optional(),
});
export const eventSessionVersionSchema = z.strictObject({ version: z.number().int().positive() });
export const eventSessionParamsSchema = z.object({ eventSessionId: uuidV7Schema });
export const eventSessionListSchema = paginationQuerySchema.extend({
  locationId: uuidV7Schema.optional(),
  offeringId: uuidV7Schema.optional(),
  status: z.enum(EVENT_SESSION_STATUS).optional(),
});
export type EventSessionCreateBody = z.infer<typeof eventSessionCreateSchema>;
export type EventSessionUpdateBody = z.infer<typeof eventSessionUpdateSchema>;
export type EventSessionListQuery = z.infer<typeof eventSessionListSchema>;
