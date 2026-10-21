import type { ListingUnlockCountResponse } from "@banijjik/contracts/credit";
import type { ListingId, OrganizationId } from "@banijjik/ids";
import { listingNotFound } from "../../domain/errors.js";
import type { DirectoryDependencies } from "../directory-dependencies.js";

/** Staff-facing count only; the credit module answers through the unlock-counter port (M.4 decision 6). */
export class CountListingUnlocksUseCase {
  constructor(private readonly dependencies: DirectoryDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly listingId: ListingId;
  }): Promise<ListingUnlockCountResponse> {
    const counter = this.dependencies.unlockCounter;
    if (counter === null) throw listingNotFound();
    const listing = await this.dependencies.listings.findById(input.listingId);
    if (listing === undefined) throw listingNotFound();
    const unlockCount = await counter.countByListing(input.listingId);
    if (unlockCount === null) throw listingNotFound();
    return { listingId: input.listingId, unlockCount };
  }
}
