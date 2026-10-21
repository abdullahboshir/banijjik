import {
  LISTING_VIEWER,
  type ListingListItem,
  type ListingResponse,
  type ListingViewer,
} from "@banijjik/contracts/directory";
import type { OrganizationId } from "@banijjik/ids";
import { listingNotFound } from "../../domain/errors.js";
import type { DirectoryDependencies } from "../directory-dependencies.js";
import { listingFiltersFromQuery } from "../listing-filters.js";
import { asListingFieldRules } from "../ports/directory-context-ports.js";
import { toListingListItem, toListingResponse } from "../listing-view.js";

interface UnlockCheckInput {
  readonly viewer: ListingViewer;
  readonly listingId: string;
  readonly customerAccountId: string | undefined;
  readonly unlockReader: DirectoryDependencies["unlockReader"];
}

async function viewerWithUnlockCheck(input: UnlockCheckInput): Promise<ListingViewer> {
  if (input.viewer !== LISTING_VIEWER.MEMBER || !input.customerAccountId || !input.unlockReader) {
    return input.viewer;
  }
  const hasUnlocked = await input.unlockReader.hasUnlocked(
    input.listingId,
    input.customerAccountId,
  );
  return hasUnlocked ? LISTING_VIEWER.UNLOCKED_MEMBER : LISTING_VIEWER.MEMBER;
}

interface UnlockLookup {
  readonly viewer: ListingViewer;
  readonly customerAccountId: string | undefined;
  readonly unlockReader: DirectoryDependencies["unlockReader"];
}

async function unlockedIdsOf(
  input: UnlockLookup,
  listingIds: readonly string[],
): Promise<ReadonlySet<string>> {
  if (input.viewer !== LISTING_VIEWER.MEMBER || !input.customerAccountId || !input.unlockReader) {
    return new Set();
  }
  return input.unlockReader.unlockedListingIds(input.customerAccountId, listingIds);
}

export class SearchListingsUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly viewer: ListingViewer;
    readonly customerAccountId?: string;
    readonly page: number;
    readonly limit: number;
    readonly listingNumber?: string;
    readonly rawQuery: Record<string, unknown>;
  }): Promise<{
    readonly items: readonly ListingListItem[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
  }> {
    const [effective, photoPolicy] = await Promise.all([
      this.dependencies.fields.forOrganization(input.organizationId),
      this.dependencies.settings.photoPolicy(input.organizationId),
    ]);
    const rules = asListingFieldRules(effective);
    const filters = listingFiltersFromQuery(input.rawQuery, rules, this.dependencies.clock.now());
    const page = await this.dependencies.listings.searchApproved({
      ...(input.listingNumber === undefined ? {} : { listingNumber: input.listingNumber }),
      filters,
      page: input.page,
      limit: input.limit,
    });
    // One unlock query per page; per-row checks would be an N+1 on every customer search.
    const unlockedIds = await unlockedIdsOf(
      {
        viewer: input.viewer,
        customerAccountId: input.customerAccountId,
        unlockReader: this.dependencies.unlockReader,
      },
      page.items.map((listing) => listing.listingId),
    );
    return {
      items: page.items.map((listing) =>
        toListingListItem({
          listing,
          fields: rules,
          viewer: unlockedIds.has(listing.listingId)
            ? LISTING_VIEWER.UNLOCKED_MEMBER
            : input.viewer,
          photoPolicy,
        }),
      ),
      total: page.total,
      page: page.page,
      limit: page.limit,
    };
  }
}

export class GetPublicListingUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingNumber: string;
    readonly viewer: ListingViewer;
    readonly customerAccountId?: string;
  }): Promise<ListingResponse> {
    const listing = await this.dependencies.listings.findByListingNumber(input.listingNumber);
    if (listing === undefined || listing.status !== "APPROVED") throw listingNotFound();
    const [effective, photoPolicy] = await Promise.all([
      this.dependencies.fields.forOrganization(input.organizationId),
      this.dependencies.settings.photoPolicy(input.organizationId),
    ]);
    const effectiveViewer = await viewerWithUnlockCheck({
      viewer: input.viewer,
      listingId: listing.listingId,
      customerAccountId:
        input.viewer === LISTING_VIEWER.MEMBER ? input.customerAccountId : undefined,
      unlockReader: this.dependencies.unlockReader,
    });
    return toListingResponse({
      listing,
      fields: asListingFieldRules(effective),
      viewer: effectiveViewer,
      photoPolicy,
    });
  }
}
