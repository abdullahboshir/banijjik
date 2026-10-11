import {
  LIMIT_KEY,
  MODULE_KEY,
  MODULE_OVERRIDE_EFFECT,
  ORGANIZATION_STATUS,
  PACKAGE_STATUS,
  PLATFORM_AUDIT_TARGET_TYPE,
} from "@banijjik/contracts";
import { z } from "zod";
import { paginationQuerySchema } from "../pagination.js";
import { versionSchema } from "../organization/organization-fields.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";

const REASON_MAX_LENGTH = 500;
const SEARCH_MAX_LENGTH = 80;
const PACKAGE_KEY_MAX_LENGTH = 40;
const MAX_ADD_ONS = 20;
const MIN_TRIAL_EXTENSION_DAYS = 1;
const MAX_TRIAL_EXTENSION_DAYS = 30;
const PACKAGE_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** A reason is mandatory for every operator action that changes a tenant (it goes to the platform audit log). */
const reasonSchema = z.string().trim().min(1).max(REASON_MAX_LENGTH);

export const platformOrganizationParamsSchema = z.object({ organizationId: uuidV7Schema });
export const platformPackageParamsSchema = z.object({ packageId: uuidV7Schema });
export const platformModuleOverrideParamsSchema = z.object({
  organizationId: uuidV7Schema,
  moduleOverrideId: uuidV7Schema,
});

/** Body of the suspend and reactivate endpoints. */
export const platformReasonRequestSchema = z.strictObject({ reason: reasonSchema });
export type PlatformReasonBody = z.output<typeof platformReasonRequestSchema>;

/** `?status=&q=&page=&limit=` of `GET /platform/organizations`; `q` is a name or slug prefix. */
export const platformOrganizationListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ORGANIZATION_STATUS).optional(),
  q: z.string().trim().min(1).max(SEARCH_MAX_LENGTH).optional(),
});
export type PlatformOrganizationListQuery = z.output<typeof platformOrganizationListQuerySchema>;

/** `?status=&page=&limit=` of `GET /platform/packages`. */
export const platformPackageListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PACKAGE_STATUS).optional(),
});
export type PlatformPackageListQuery = z.output<typeof platformPackageListQuerySchema>;

const countOrUnlimitedSchema = z.number().int().min(0).nullable();
const countSchema = z.number().int().min(0);

/** Every limit key must be present: `null` means unlimited, so a missing key would be ambiguous. */
const limitsSchema = z.strictObject({
  [LIMIT_KEY.LOCATIONS]: countOrUnlimitedSchema,
  [LIMIT_KEY.MEMBERS]: countOrUnlimitedSchema,
  [LIMIT_KEY.OFFERINGS]: countOrUnlimitedSchema,
  [LIMIT_KEY.ORDERS_PER_MONTH]: countOrUnlimitedSchema,
  [LIMIT_KEY.AI_MESSAGES_PER_MONTH]: countOrUnlimitedSchema,
  [LIMIT_KEY.SMS_PER_MONTH]: countOrUnlimitedSchema,
  [LIMIT_KEY.CHANNELS]: countOrUnlimitedSchema,
  [LIMIT_KEY.POS_DEVICES]: countOrUnlimitedSchema,
});
const limitIncrementsSchema = z.strictObject({
  [LIMIT_KEY.LOCATIONS]: countSchema.optional(),
  [LIMIT_KEY.MEMBERS]: countSchema.optional(),
  [LIMIT_KEY.OFFERINGS]: countSchema.optional(),
  [LIMIT_KEY.ORDERS_PER_MONTH]: countSchema.optional(),
  [LIMIT_KEY.AI_MESSAGES_PER_MONTH]: countSchema.optional(),
  [LIMIT_KEY.SMS_PER_MONTH]: countSchema.optional(),
  [LIMIT_KEY.CHANNELS]: countSchema.optional(),
  [LIMIT_KEY.POS_DEVICES]: countSchema.optional(),
});
const packageNameSchema = z.string().trim().min(2).max(60);
const moduleKeysSchema = z.array(z.enum(MODULE_KEY));

/** Body of `POST /platform/packages`. */
export const platformPackageCreateRequestSchema = z.strictObject({
  packageKey: z.string().min(2).max(PACKAGE_KEY_MAX_LENGTH).regex(PACKAGE_KEY_PATTERN),
  name: packageNameSchema,
  isAddOn: z.boolean(),
  moduleKeys: moduleKeysSchema,
  limits: limitsSchema,
  limitIncrements: limitIncrementsSchema.optional(),
});
export type PlatformPackageCreateBody = z.output<typeof platformPackageCreateRequestSchema>;

/** Body of `PATCH /platform/packages/{packageId}`; `isAddOn` and `packageKey` cannot change. */
export const platformPackageUpdateRequestSchema = z
  .strictObject({
    version: versionSchema,
    name: packageNameSchema.optional(),
    moduleKeys: moduleKeysSchema.optional(),
    limits: limitsSchema.optional(),
    limitIncrements: limitIncrementsSchema.optional(),
  })
  .refine((body) => Object.keys(body).some((key) => key !== "version"));
export type PlatformPackageUpdateBody = z.output<typeof platformPackageUpdateRequestSchema>;

const isoInstantSchema = z.iso.datetime({ offset: true }).or(z.iso.date());

/** Body of `POST …/module-overrides`; TENANT_DISABLE belongs to the tenant, not to an operator. */
export const platformModuleOverrideCreateRequestSchema = z.strictObject({
  moduleKey: z.enum(MODULE_KEY),
  effect: z.enum([MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT, MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE]),
  reason: reasonSchema,
  expiresAt: isoInstantSchema.pipe(z.coerce.date()).optional(),
});
export type PlatformModuleOverrideCreateBody = z.output<
  typeof platformModuleOverrideCreateRequestSchema
>;

/** Body of `POST …/subscription/extend-trial`. */
export const platformExtendTrialRequestSchema = z.strictObject({
  days: z.number().int().min(MIN_TRIAL_EXTENSION_DAYS).max(MAX_TRIAL_EXTENSION_DAYS),
  reason: reasonSchema,
});
export type PlatformExtendTrialBody = z.output<typeof platformExtendTrialRequestSchema>;

/** Body of `POST …/subscription/change-package`. */
export const platformChangePackageRequestSchema = z.strictObject({
  basePackageId: uuidV7Schema,
  addOnPackageIds: z
    .array(uuidV7Schema)
    .max(MAX_ADD_ONS)
    .refine((ids) => new Set(ids).size === ids.length),
});
export type PlatformChangePackageBody = z.output<typeof platformChangePackageRequestSchema>;

/** Query of `GET /platform/audit-logs`. */
export const platformAuditLogListQuerySchema = paginationQuerySchema
  .extend({
    targetType: z.enum(PLATFORM_AUDIT_TARGET_TYPE).optional(),
    organizationId: uuidV7Schema.optional(),
    actorPlatformOperatorId: uuidV7Schema.optional(),
    from: isoInstantSchema.pipe(z.coerce.date()).optional(),
    to: isoInstantSchema.pipe(z.coerce.date()).optional(),
  })
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to);
export type PlatformAuditLogListQuery = z.output<typeof platformAuditLogListQuerySchema>;
