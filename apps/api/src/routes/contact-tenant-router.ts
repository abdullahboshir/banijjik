import { CUSTOM_FIELD_ENTITY_TYPE, PERMISSION_KEY, type ModuleManifest } from "@banijjik/contracts";
import {
  CONTACT_DEDUPE_MODE,
  CONTACT_DEDUPE_SETTING_KEY,
  type ContactDedupeMode,
} from "@banijjik/contracts/contact";
import type { RequestHandler, Router } from "express";
import type {
  OrgConfigReader,
  PermissionGate,
  PermissionMiddlewareFactory,
} from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildContactRouter } from "../modules/commerce/contact/index.js";
import type {
  ContactCustomFieldReader,
  ContactRoleCatalog,
  DedupeModeReader,
  SensitiveValueAccess,
} from "../modules/commerce/contact/index.js";
import { buildEffectiveCustomFieldReader } from "../modules/core/custom-field/index.js";
import { buildLocationLookup } from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import { buildIndustryContactRoleReader } from "../modules/platform/industry/index.js";

export interface ContactRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly permissions: Pick<PermissionGate, "locationsWith">;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigReader;
  readonly manifests: readonly ModuleManifest[];
}

/** Sensitive values are readable and writable only with the permission at every location (ADR-107). */
function sensitiveAccessOf(
  permissions: Pick<PermissionGate, "locationsWith">,
): SensitiveValueAccess {
  return {
    maySeeSensitive: async () =>
      (await permissions.locationsWith(PERMISSION_KEY.CONTACT_CONTACT_READ_SENSITIVE)) === "ALL",
  };
}

function dedupeModesOf(input: ContactRouterInput): DedupeModeReader {
  const resolver = buildSettingsResolver({
    orgConfig: input.orgConfig,
    manifests: input.manifests,
  });
  return {
    read: async (organizationId): Promise<ContactDedupeMode> => {
      const resolved = await resolver.resolve(organizationId, {
        keys: [CONTACT_DEDUPE_SETTING_KEY],
      });
      return resolved.get(CONTACT_DEDUPE_SETTING_KEY)?.value === CONTACT_DEDUPE_MODE.PHONE_OR_EMAIL
        ? CONTACT_DEDUPE_MODE.PHONE_OR_EMAIL
        : CONTACT_DEDUPE_MODE.PHONE;
    },
  };
}

/** Adapts the custom-field engine to the contact port: contact never imports it directly. */
function contactFieldsOf(): ContactCustomFieldReader {
  const reader = buildEffectiveCustomFieldReader();
  return {
    forContacts: (organizationId) =>
      reader.forEntity(organizationId, CUSTOM_FIELD_ENTITY_TYPE.contact),
  };
}

/** Adapts the industry template to the contact port: the roles the template lists (ADR-113). */
function roleCatalogOf(): ContactRoleCatalog {
  const roles = buildIndustryContactRoleReader();
  return { allowedRoles: (organizationId) => roles.forOrganization(organizationId) };
}

/** The contact router, mounted on the tenant pipeline (card 3.1a). */
export function buildContactTenantRouter(input: ContactRouterInput): Router {
  return buildContactRouter({
    clock: input.clock,
    audit: input.audit,
    permission: input.permission,
    idempotency: input.idempotency,
    customFields: contactFieldsOf(),
    sensitiveAccess: sensitiveAccessOf(input.permissions),
    dedupeModes: dedupeModesOf(input),
    roleCatalog: roleCatalogOf(),
    locations: buildLocationLookup(),
  });
}
