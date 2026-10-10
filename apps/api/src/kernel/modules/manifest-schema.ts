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
import { z } from "zod";
import { ManifestError } from "./manifest-error.js";

const moduleKeySchema = z.string().refine(isModuleKey, { message: "not a MODULE_KEY value" });
const offeringKindSchema = z.enum(Object.values(OFFERING_KIND));
const limitKeySchema = z.enum(LIMIT_KEY_VALUES);
const eventTypeSchema = z.enum(Object.values(EVENT_TYPE));
const sequenceKeySchema = z.enum(Object.values(SEQUENCE_KEY));
const surfaceSchema = z.enum(Object.values(SURFACE));
const stringListSchema = z.array(z.string().min(1));

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
    settingKeys: stringListSchema,
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
