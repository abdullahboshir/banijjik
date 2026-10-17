import {
  isModuleKey,
  LIMIT_KEY_VALUES,
  MODULE_CLASS,
  MENU_VISIBILITY,
  OFFERING_KIND,
  SEQUENCE_KEY,
  SURFACE,
  EVENT_TYPE,
  type ModuleManifest,
} from "@banijjik/contracts";
import { TERM_KEY_PATTERN } from "@banijjik/validation";
import { z } from "zod";
import { ManifestError } from "./manifest-error.js";

const moduleKeySchema = z.string().refine(isModuleKey, { message: "not a MODULE_KEY value" });
const offeringKindSchema = z.enum(Object.values(OFFERING_KIND));
const limitKeySchema = z.enum(LIMIT_KEY_VALUES);
const eventTypeSchema = z.enum(Object.values(EVENT_TYPE));
const sequenceKeySchema = z.enum(Object.values(SEQUENCE_KEY));
const surfaceSchema = z.enum(Object.values(SURFACE));
const stringListSchema = z.array(z.string().min(1));
const integerBounds = { min: z.number(), max: z.number() };
const settingValueSpecSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("BOOLEAN") }).strict(),
  z.object({ kind: z.literal("INTEGER"), ...integerBounds }).strict(),
  z.object({ kind: z.literal("MONEY"), ...integerBounds }).strict(),
  z.object({ kind: z.literal("DURATION_MINUTES"), ...integerBounds }).strict(),
  z.object({ kind: z.literal("ENUM"), values: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ kind: z.literal("TEXT"), maxLength: z.number().int().positive() }).strict(),
  z.object({ kind: z.literal("STRUCTURED"), schemaKey: z.string().min(1) }).strict(),
]);
const settingDefinitionSchema = z
  .object({
    settingKey: z.string().min(1),
    value: settingValueSpecSchema,
    systemDefault: z.unknown(),
    allowsLocationOverride: z.boolean(),
    isClientVisible: z.boolean(),
  })
  .strict();

/** A route prefix is a full v1 path: it starts with "/" and has no trailing slash. */
const routePrefixSchema = z
  .string()
  .regex(/^\/[^\s?#]*[^/\s?#]$/, "a full path such as /orgs/:organizationId/roles");
const routeListSchema = z.array(routePrefixSchema).optional();

const permissionSchema = z
  .object({
    permissionKey: z.string().min(1),
    labelKey: z.string().min(1),
    isSensitive: z.boolean(),
    surface: surfaceSchema,
  })
  .strict();

const menuEntrySchema = z
  .object({
    menuKey: z.string().min(1),
    surface: surfaceSchema,
    groupKey: z.string().min(1),
    labelTermKey: z.string().min(1),
    termKey: z.string().regex(TERM_KEY_PATTERN).optional(),
    path: z.string().min(1),
    iconKey: z.string().min(1),
    permissionKey: z.string().min(1),
    order: z.number().int(),
    requiresKind: offeringKindSchema.optional(),
    visibility: z.enum(Object.values(MENU_VISIBILITY)).optional(),
  })
  .strict();

const manifestSchema = z
  .object({
    key: moduleKeySchema,
    path: z.string().regex(/^[a-z]+\/[a-z-]+$/, "<group>/<module>"),
    moduleClass: z.enum(Object.values(MODULE_CLASS)),
    dependsOn: z.array(moduleKeySchema),
    providesKinds: z.array(offeringKindSchema),
    requiresAnyKind: z.array(offeringKindSchema),
    tenantCanDisable: z.boolean(),
    permissions: z.array(permissionSchema),
    routes: z
      .object({
        admin: routeListSchema,
        storefront: routeListSchema,
        platform: routeListSchema,
        webhook: routeListSchema,
      })
      .strict(),
    menu: z.array(menuEntrySchema),
    settings: z.array(settingDefinitionSchema),
    customFieldEntities: stringListSchema,
    botTools: stringListSchema,
    storefrontSections: stringListSchema,
    events: z
      .object({ emits: z.array(eventTypeSchema), consumes: z.array(eventTypeSchema) })
      .strict(),
    limitKeys: z.array(limitKeySchema),
    sequenceKeys: z.array(sequenceKeySchema),
  })
  .strict();

/** Checks the shape of one manifest. Rules between manifests are checked by the registry. */
export function assertManifestShape(candidate: ModuleManifest): void {
  const result = manifestSchema.safeParse(candidate);
  if (result.success) return;
  const issue = result.error.issues[0];
  const where = issue?.path.join(".") ?? "";
  throw new ManifestError(`${String(candidate.key)}: ${where} ${issue?.message ?? "invalid"}`);
}
