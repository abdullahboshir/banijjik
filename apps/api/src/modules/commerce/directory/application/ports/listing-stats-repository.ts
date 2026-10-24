import type { OrganizationId } from "@banijjik/ids";
import type { ApprovedCountGroup, ListingStatsSnapshot } from "../listing-stats.js";

/** The stored home counts of a business, as the storefront reads them. */
export type StoredListingStats = ListingStatsSnapshot;

export interface ListingStatsRepository {
  /** One aggregation over the APPROVED listings of the organization, grouped by the statistics field. */
  countApprovedByOption(
    organizationId: OrganizationId,
    fieldKey: string | null,
  ): Promise<ApprovedCountGroup[]>;
  find(organizationId: OrganizationId): Promise<StoredListingStats | undefined>;
  /** Writes only when the snapshot differs from the stored row. Returns whether it wrote. */
  saveIfChanged(organizationId: OrganizationId, snapshot: ListingStatsSnapshot): Promise<boolean>;
}
