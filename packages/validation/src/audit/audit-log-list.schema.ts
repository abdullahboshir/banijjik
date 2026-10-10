import { AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

/** ISO 8601 date or date-time, as `?from=` and `?to=` carry it. Stored as a Date. */
const isoInstantSchema = z.iso.datetime({ offset: true }).or(z.iso.date());

/** Query of `GET /orgs/{organizationId}/audit-logs`: paging plus the filters of 14-API.md section 5.1. */
export const auditLogListQuerySchema = paginationQuerySchema
  .extend({
    entityType: z.enum(AUDIT_ENTITY_TYPE).optional(),
    entityId: uuidV7Schema.optional(),
    actorUserId: uuidV7Schema.optional(),
    from: isoInstantSchema.pipe(z.coerce.date()).optional(),
    to: isoInstantSchema.pipe(z.coerce.date()).optional(),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to);

export type AuditLogListQuery = z.output<typeof auditLogListQuerySchema>;
