import type { ModuleManifest } from "@banijjik/contracts";
import { BOOKKEEPING_MANUAL_ENTRY_OWNER_WITHOUT_APPROVAL_SETTING_KEY } from "@banijjik/contracts/accounting";
import { asId, type RoleId } from "@banijjik/ids";
import type { RequestHandler, Router } from "express";
import type { PermissionMiddlewareFactory } from "../kernel/access/index.js";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { getRequestContext } from "../kernel/context/index.js";
import type { Clock } from "../kernel/time/index.js";
import { buildBookkeepingRouter } from "../modules/commerce/bookkeeping/index.js";
import { buildPermissionCatalog, buildRoleGrantReader } from "../modules/core/iam/index.js";
import {
  buildOrganizationCurrencyReader,
  buildLocationLookup,
  buildMemberAccessReader,
} from "../modules/core/organization/index.js";
import { buildSettingsResolver } from "../modules/core/settings/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
export interface BookkeepingTenantRouterInput {
  readonly clock: Clock;
  readonly audit: AuditRecorder;
  readonly permission: PermissionMiddlewareFactory;
  readonly idempotency: RequestHandler;
  readonly orgConfig: OrgConfigService;
  readonly manifests: readonly ModuleManifest[];
}
export function buildBookkeepingTenantRouter(input: BookkeepingTenantRouterInput): Router {
  const settings = buildSettingsResolver(input);
  const members = buildMemberAccessReader();
  const roles = buildRoleGrantReader(buildPermissionCatalog(input.manifests));
  const locations = buildLocationLookup();
  return buildBookkeepingRouter({
    ...input,
    locations,
    currencies: buildOrganizationCurrencyReader(),
    policy: {
      async ownerMaySkip(organizationId) {
        const memberId = getRequestContext().memberId;
        if (memberId === undefined) return false;
        const assignments = await members.findAssignments(memberId);
        const grants = await roles.findGrants(
          assignments
            .filter((row) => row.locationId === "ALL")
            .map((row) => asId<RoleId>(row.roleId)),
        );
        if (![...grants.values()].some((role) => role.isActive && role.isOwnerRole)) return false;
        const resolved = await settings.resolve(organizationId, {
          keys: [BOOKKEEPING_MANUAL_ENTRY_OWNER_WITHOUT_APPROVAL_SETTING_KEY],
        });
        return (
          resolved.get(BOOKKEEPING_MANUAL_ENTRY_OWNER_WITHOUT_APPROVAL_SETTING_KEY)?.value === true
        );
      },
    },
  });
}
