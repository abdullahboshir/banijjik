import type { ResolvedOrgConfigResponse } from "@banijjik/contracts";
import type { SidebarGroup } from "@banijjik/ui";
import { ApiError } from "../lib/api/api-error";
import { serverApiFetch } from "../lib/api/server-api-fetch";

const DIRECTORY_QUEUE_MENU_KEY = "directory.queue";

/** Queue total for the review-menu badge; skips quietly when the entry is absent or refused. */
export async function directoryQueueBadgeCount(
  organizationId: string,
  menu: ResolvedOrgConfigResponse["menu"] | undefined,
): Promise<number | undefined> {
  if (menu === undefined || !menu.some((entry) => entry.menuKey === DIRECTORY_QUEUE_MENU_KEY)) {
    return undefined;
  }
  try {
    const result = await serverApiFetch<{ total: number }>(
      `/orgs/${organizationId}/directory/queue?status=SUBMITTED&page=1&limit=1`,
    );
    return result.data.total;
  } catch (error) {
    if (error instanceof ApiError) return undefined;
    throw error;
  }
}

export function withQueueBadge(
  groups: SidebarGroup[],
  badgeCount: number | undefined,
): SidebarGroup[] {
  if (badgeCount === undefined) return groups;
  return groups.map((group) => ({
    ...group,
    entries: group.entries.map((entry) =>
      entry.menuKey === DIRECTORY_QUEUE_MENU_KEY ? { ...entry, badgeCount } : entry,
    ),
  }));
}
