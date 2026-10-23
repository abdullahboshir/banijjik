import { MODULE_KEY } from "@banijjik/contracts";
import { CONTACT_EVENT_TYPE } from "@banijjik/contracts/contact";
import { DIRECTORY_EVENT_TYPE, LISTING_STATUS } from "@banijjik/contracts/directory";
import { asId, type CustomerAccountId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { AUDIT_ACTION, recordListingChange } from "../listing-records.js";
import type { DirectoryDependencies } from "../directory-dependencies.js";

/** The handler writes a listing, so it needs the listing write ports, not the whole module. */
type HideOnAccountBlockedDependencies = Pick<
  DirectoryDependencies,
  "listings" | "unitOfWork" | "events" | "audit" | "clock"
>;

/**
 * A banned customer's listing comes down with the ban (M.7 decision 7). The block itself never
 * touches the listing, so this handler is the only path from a ban to a hidden listing. The actor
 * is the system, not a staff user. Any other status writes nothing: SUBMITTED and DRAFT are not
 * public, and an already HIDDEN listing makes a rerun a no-op. Unblocking does not unhide.
 */
export function buildHideOnAccountBlockedHandler(
  dependencies: HideOnAccountBlockedDependencies,
): EventHandler<typeof CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_BLOCKED> {
  const { listings, unitOfWork, clock } = dependencies;
  return {
    handlerKey: "directory.hideOnAccountBlocked",
    moduleKey: MODULE_KEY.DIRECTORY,
    eventType: CONTACT_EVENT_TYPE.CUSTOMER_ACCOUNT_BLOCKED,
    ordering: "UNORDERED",
    async handle(envelope) {
      await unitOfWork.run(async () => {
        const listing = await listings.findActiveByOwner(
          asId<CustomerAccountId>(envelope.payload.customerAccountId),
        );
        if (listing?.status !== LISTING_STATUS.APPROVED) return;
        const hidden = await listings.save(listing.hide(clock.now(), null), listing.version, null);
        await recordListingChange(dependencies, {
          action: AUDIT_ACTION.LISTING_CONCEALED,
          before: listing,
          after: hidden,
          eventType: DIRECTORY_EVENT_TYPE.LISTING_HIDDEN,
        });
      });
    },
  };
}
