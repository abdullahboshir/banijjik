import { EVENT_DEAD_LETTER_STATUS } from "@banijjik/contracts";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { reasonSchema } from "./platform-schemas.js";

/** `?status=&page=&limit=` of `GET /platform/event-dead-letters`. */
export const platformEventDeadLetterListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(EVENT_DEAD_LETTER_STATUS).optional(),
});
export type PlatformEventDeadLetterListQuery = z.output<
  typeof platformEventDeadLetterListQuerySchema
>;

export const platformEventDeadLetterParamsSchema = z.object({ eventDeadLetterId: uuidV7Schema });

/** `?page=&limit=` of `GET /platform/dead-outbox-events`. */
export const platformDeadOutboxListQuerySchema = paginationQuerySchema;

export const platformDeadOutboxParamsSchema = z.object({ eventId: uuidV7Schema });

/** Body of the skip endpoint: a skip means the handler's effect never happened, so the reason is mandatory. */
export const platformEventSkipRequestSchema = z.strictObject({ reason: reasonSchema });
export type PlatformEventSkipBody = z.output<typeof platformEventSkipRequestSchema>;
