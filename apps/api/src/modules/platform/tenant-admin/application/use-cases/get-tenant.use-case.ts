import { DomainRuleError, ERROR_CODE, SYSTEM_REASON } from "@banijjik/contracts";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import { maskIdentifier } from "../../domain/mask-identifier.js";
import type { TenantOverrideView } from "../ports/tenant-admin-ports.js";
import type { TenantAdminDependencies } from "./tenant-admin-dependencies.js";
import type { TenantDetail } from "./tenant-detail.js";

function notFound(): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
}

/** The detail of one organization: subscription, active overrides, locations and the masked owner contact. */
export class GetTenantUseCase {
  constructor(private readonly dependencies: TenantAdminDependencies) {}

  execute(input: { readonly organizationId: string }): Promise<TenantDetail> {
    const { directory, subscriptions, overrides, identifiers } = this.dependencies;
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const organization = await directory.findById(input.organizationId);
      if (organization === undefined) throw notFound();
      const [memberCounts, statuses, locationCount, ownerName, subscription, moduleOverrides] =
        await Promise.all([
          directory.countActiveMembers([organization.organizationId]),
          subscriptions.findStatuses([organization.organizationId]),
          directory.countActiveLocations(organization.organizationId),
          directory.findOwnerDisplayName(organization.organizationId, organization.ownerUserId),
          subscriptions.find({ organizationId: organization.organizationId }),
          overrides.list(organization.organizationId),
        ]);
      const ownerIdentifiers = await identifiers.findIdentifiers(organization.ownerUserId);
      return {
        organization,
        subscriptionStatus: statuses.get(organization.organizationId) ?? null,
        memberCount: memberCounts.get(organization.organizationId) ?? 0,
        locationCount,
        ownerDisplayName: ownerName ?? "",
        ownerMaskedIdentifier: maskIdentifier(ownerIdentifiers ?? {}),
        subscription: subscription ?? null,
        moduleOverrides: activeOnly(moduleOverrides, this.dependencies.clock.now()),
      };
    });
  }
}

/** Expired overrides no longer count; the list endpoint still shows every row. */
function activeOnly(rows: readonly TenantOverrideView[], now: Date): readonly TenantOverrideView[] {
  return rows.filter((row) => row.expiresAt === null || row.expiresAt.getTime() > now.getTime());
}
