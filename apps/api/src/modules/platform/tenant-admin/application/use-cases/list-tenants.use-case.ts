import { SYSTEM_REASON } from "@banijjik/contracts";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import type { TenantDirectoryQuery } from "../ports/tenant-admin-ports.js";
import type { TenantAdminDependencies } from "./tenant-admin-dependencies.js";
import type { TenantSummaryPage } from "./tenant-summary-page.js";

/**
 * One page of organizations with their subscription status and member count. Three queries
 * whatever the page size: the page, one member aggregate and one subscription lookup. Members are
 * tenant data, so the page is read as system access (PLATFORM_ADMIN) and leaves a log line.
 */
export class ListTenantsUseCase {
  constructor(private readonly dependencies: TenantAdminDependencies) {}

  execute(query: TenantDirectoryQuery): Promise<TenantSummaryPage> {
    const { directory, subscriptions } = this.dependencies;
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const page = await directory.list(query);
      const ids = page.items.map((entry) => entry.organizationId);
      const [memberCounts, statuses] = await Promise.all([
        directory.countActiveMembers(ids),
        subscriptions.findStatuses(ids),
      ]);
      const items = page.items.map((organization) => ({
        organization,
        subscriptionStatus: statuses.get(organization.organizationId) ?? null,
        memberCount: memberCounts.get(organization.organizationId) ?? 0,
      }));
      return { items, hasNext: page.hasNext };
    });
  }
}
