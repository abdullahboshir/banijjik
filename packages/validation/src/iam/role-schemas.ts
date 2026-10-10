import { PERMISSION_KEY, ROLE_NAME_MAX_LENGTH, ROLE_NAME_MIN_LENGTH } from "@banijjik/contracts";
import { z } from "zod";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const MAX_PERMISSIONS_PER_ROLE = Object.keys(PERMISSION_KEY).length;

const roleNameSchema = z.string().trim().min(ROLE_NAME_MIN_LENGTH).max(ROLE_NAME_MAX_LENGTH);

/** Unknown keys are rejected here; repeated keys are collapsed. */
const permissionKeysSchema = z
  .array(z.enum(PERMISSION_KEY))
  .max(MAX_PERMISSIONS_PER_ROLE)
  .transform((keys) => [...new Set(keys)]);

const versionSchema = z.number().int().min(1);

/** Body of `POST /orgs/{organizationId}/roles`. */
export const roleCreateRequestSchema = z.strictObject({
  name: roleNameSchema,
  permissionKeys: permissionKeysSchema,
});
export type RoleCreateBody = z.output<typeof roleCreateRequestSchema>;

/** Body of `PATCH /orgs/{organizationId}/roles/{roleId}`; at least one of name and permissionKeys. */
export const roleUpdateRequestSchema = z
  .strictObject({
    name: roleNameSchema.optional(),
    permissionKeys: permissionKeysSchema.optional(),
    version: versionSchema,
  })
  .refine((body) => body.name !== undefined || body.permissionKeys !== undefined);
export type RoleUpdateBody = z.output<typeof roleUpdateRequestSchema>;

/** Body of `POST /orgs/{organizationId}/roles/{roleId}/archive`. */
export const roleArchiveRequestSchema = z.strictObject({ version: versionSchema });
export type RoleArchiveBody = z.output<typeof roleArchiveRequestSchema>;

/** The path parameter of the role endpoints. */
export const roleIdParamsSchema = z.object({ roleId: uuidV7Schema });
