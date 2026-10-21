import type { CreditDependencies } from "../ports/credit-dependencies.js";
import type { MyCreditsResponse, UnlockListItem } from "@banijjik/contracts/credit";
import { LISTING_VIEWER } from "@banijjik/contracts/directory";
import type { CustomerAccountId, ListingId, OrganizationId } from "@banijjik/ids";
import { getRequestContext } from "../../../../../kernel/context/index.js";
import { asListingFieldRules, projectListingFields } from "../../../directory/index.js";
import { CreditAccountNotFoundError } from "../../domain/index.js";

export class GetMyCreditsUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<MyCreditsResponse> {
    // The account is tenant-scoped: another organization's id must read as missing, not as zero.
    if (!(await this.deps.accounts.exists(customerAccountId))) {
      throw new CreditAccountNotFoundError();
    }
    const [balance, entries] = await Promise.all([
      this.deps.credit.getBalance(customerAccountId),
      this.deps.credit.listEntries(customerAccountId, options),
    ]);
    return {
      balance: balance?.balance ?? 0,
      entries,
    };
  }
}

/** Unlocked listings with the UNLOCKED tier fields projected for this account only (ADR-127). */
export class GetMyUnlocksUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(
    customerAccountId: CustomerAccountId,
    options: { limit: number; offset: number },
  ): Promise<readonly UnlockListItem[]> {
    const organizationId = this.organizationId();
    const unlocks = await this.deps.unlocks.listByCustomer(customerAccountId, options);
    const listings = await this.deps.listings.findByIds(
      unlocks.map((unlock) => unlock.listingId as ListingId),
    );
    const byId = new Map(listings.map((listing) => [listing.listingId, listing]));
    const effective = await this.deps.fields.forOrganization(organizationId);
    const rules = asListingFieldRules(effective);

    return unlocks.flatMap((unlock) => {
      const listing = byId.get(unlock.listingId as ListingId);
      if (listing === undefined) return [];
      return [
        {
          listingUnlockId: unlock.listingUnlockId,
          listingId: unlock.listingId,
          listingNumber: listing.listingNumber,
          unlockedAt: unlock.unlockedAt,
          customFields: projectListingFields(
            listing.customFields,
            rules,
            LISTING_VIEWER.UNLOCKED_MEMBER,
          ),
        },
      ];
    });
  }

  private organizationId(): OrganizationId {
    const { organizationId } = getRequestContext();
    if (!organizationId) throw new Error("Organization context required for unlocks");
    return organizationId as OrganizationId;
  }
}
