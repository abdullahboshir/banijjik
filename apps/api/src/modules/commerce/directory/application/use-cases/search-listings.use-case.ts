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
import { asListingFieldRules } from "../index.js";
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

export class SearchListingsUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly viewer: ListingViewer;
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
    return {
      items: await Promise.all(
        page.items.map(async (listing) => {
          const effectiveViewer = await viewerWithUnlockCheck({
            viewer: input.viewer,
            listingId: listing.listingId,
            customerAccountId: input.rawQuery.customerAccountId as string | undefined,
            unlockReader: this.dependencies.unlockReader,
          });
          return toListingListItem({
            listing,
            fields: rules,
            viewer: effectiveViewer,
            photoPolicy,
          });
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
      customerAccountId: input.viewer === LISTING_VIEWER.MEMBER ? input.organizationId : undefined,
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
