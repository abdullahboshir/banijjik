import { MODULE_KEY } from "@banijjik/contracts";
import { DIRECTORY_EVENT_TYPE } from "@banijjik/contracts/directory";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { summarizeApprovedCounts } from "../listing-stats.js";
import type { ListingStatsRepository } from "../ports/listing-stats-repository.js";
import type { DirectoryTemplateReader } from "../ports/directory-context-ports.js";

export interface ListingStatsHandlerDependencies {
  readonly stats: ListingStatsRepository;
  readonly template: DirectoryTemplateReader;
}

/** Recomputes the home counts of one business from its current listings (M.6a decision 4). */
export async function refreshListingStats(
  dependencies: ListingStatsHandlerDependencies,
  organizationId: OrganizationId,
): Promise<boolean> {
  const block = await dependencies.template.directoryBlockOf(organizationId);
  const fieldKey = block?.homeStatsFieldKey ?? null;
  const groups = await dependencies.stats.countApprovedByOption(organizationId, fieldKey);
  return dependencies.stats.saveIfChanged(
    organizationId,
    summarizeApprovedCounts(fieldKey, groups),
  );
}

/**
 * Every listing event that can change an approved count refreshes the row. The recompute reads the
 * current state, so a rerun or a late delivery computes the same row and writes nothing.
 */
export function buildListingStatsHandler(
  dependencies: ListingStatsHandlerDependencies,
): EventHandler<typeof DIRECTORY_EVENT_TYPE.LISTING_APPROVED> {
  return {
    handlerKey: "directory.refreshListingStats",
    moduleKey: MODULE_KEY.DIRECTORY,
    eventType: DIRECTORY_EVENT_TYPE.LISTING_APPROVED,
    alsoHandles: [
      DIRECTORY_EVENT_TYPE.LISTING_HIDDEN,
      DIRECTORY_EVENT_TYPE.LISTING_UNHIDDEN,
      DIRECTORY_EVENT_TYPE.LISTING_ARCHIVED,
      DIRECTORY_EVENT_TYPE.LISTING_UPDATED,
    ],
    ordering: "UNORDERED",
    async handle(envelope) {
      if (envelope.organizationId === null) return;
      await refreshListingStats(dependencies, asId<OrganizationId>(envelope.organizationId));
    },
  };
}
