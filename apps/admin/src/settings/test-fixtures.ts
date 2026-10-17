import {
  ACCESS_MODE,
  PERMISSION_KEY,
  type CallerPermissionsResponse,
  type EffectiveCustomField,
  type PermissionDefinitionResponse,
  type PermissionKey,
} from "@banijjik/contracts";
import type { OrgAccess } from "../shell/org-access";

export const ORGANIZATION_ID = "org-1";
export const ORG_SLUG = "acme";

/** Every permission key, as the definitions of an organization with all modules on. */
export function allDefinitions(
  sensitiveKeys: readonly string[] = [],
): PermissionDefinitionResponse[] {
  return Object.values(PERMISSION_KEY).map((permissionKey) => ({
    permissionKey,
    labelKey: `permission.${permissionKey}`,
    isSensitive: sensitiveKeys.includes(permissionKey),
    moduleKey: permissionKey.split(".")[0] ?? "",
  }));
}

export interface AccessOptions {
  /** Keys held at every location. */
  keys?: readonly PermissionKey[];
  /** Keys held at one location only. */
  limitedKeys?: readonly PermissionKey[];
  canWrite?: boolean;
  locationLimit?: number | null;
  sensitiveKeys?: readonly string[];
  /** The effective custom fields of `/me/config`, by entity type. */
  fields?: Record<string, EffectiveCustomField[]>;
  /** The business's terms of `/me/config`, by term key. */
  terms?: Record<string, { bn: string; en: string }>;
}

/** An `OrgAccess` for the server pages of the settings screens, built from the few facts they read. */
export function accessFixture(options: AccessOptions = {}): OrgAccess {
  const permissions: CallerPermissionsResponse = {
    allLocations: options.keys ?? [],
    byLocation: options.limitedKeys ? { "location-1": options.limitedKeys } : {},
  };
  // Safe: the pages under test read only the fields set here; the rest of the access is not touched.
  return {
    organization: { organizationId: ORGANIZATION_ID, slug: ORG_SLUG },
    config: {
      accessMode: ACCESS_MODE.FULL,
      limits: { locations: options.locationLimit ?? null },
      permissions,
      permissionDefinitions: allDefinitions(options.sensitiveKeys),
      fields: options.fields ?? {},
      terms: options.terms ?? {},
    },
    canWrite: options.canWrite ?? true,
    timeZone: "Asia/Dhaka",
  } as unknown as OrgAccess;
}
