import { PLATFORM_ROLE, USER_STATUS } from "@banijjik/contracts";
import { z } from "zod";
import { loginIdentifierSchema } from "../login-identifier.js";
import { versionSchema } from "../organization/organization-fields.js";
import { paginationQuerySchema } from "../pagination.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { reasonSchema } from "./platform-schemas.js";

const MIN_PLATFORM_ROLES = 1;
const MAX_PLATFORM_ROLES = 3;

export const platformOperatorParamsSchema = z.object({ platformOperatorId: uuidV7Schema });

/** `?status=&page=&limit=` of `GET /platform/operators`. */
export const platformOperatorListQuerySchema = paginationQuerySchema.extend({
  status: z.enum([USER_STATUS.ACTIVE, USER_STATUS.DISABLED]).optional(),
});
export type PlatformOperatorListQuery = z.output<typeof platformOperatorListQuerySchema>;

export const platformRolesSchema = z
  .array(z.enum(PLATFORM_ROLE))
  .min(MIN_PLATFORM_ROLES)
  .max(MAX_PLATFORM_ROLES)
  .refine((roles) => new Set(roles).size === roles.length);

export const platformOperatorCreateRequestSchema = z.strictObject({
  identifier: loginIdentifierSchema,
  platformRoles: platformRolesSchema,
  reason: reasonSchema,
});
export type PlatformOperatorCreateBody = z.output<typeof platformOperatorCreateRequestSchema>;

export const platformOperatorUpdateRequestSchema = z.strictObject({
  platformRoles: platformRolesSchema,
  version: versionSchema,
  reason: reasonSchema,
});
export type PlatformOperatorUpdateBody = z.output<typeof platformOperatorUpdateRequestSchema>;

export const platformOperatorStatusRequestSchema = z.strictObject({
  version: versionSchema,
  reason: reasonSchema,
});
export type PlatformOperatorStatusBody = z.output<typeof platformOperatorStatusRequestSchema>;
