import { MODULE_KEY } from "@banijjik/contracts";
import {
  DIRECTORY_EVENT_TYPE,
  LISTING_STATUS,
  type ListingEventPayload,
} from "@banijjik/contracts/directory";
import { asId, type ListingId, type OrganizationId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import type { CustomerSmsNotifier } from "../../../contact/index.js";
import type { DirectorySettingsReader } from "../ports/directory-context-ports.js";
import type { ListingRepository } from "../ports/listing-repository.js";
import type { ReviewResultMessageComposer } from "../ports/review-result-message-composer.js";

export interface NotifyReviewResultDependencies {
  readonly listings: Pick<ListingRepository, "findById">;
  readonly settings: Pick<DirectorySettingsReader, "notifyReviewBySms">;
  readonly notifier: CustomerSmsNotifier;
  readonly composer: ReviewResultMessageComposer;
}

/**
 * Tells the owner's phone that staff approved or rejected the listing (M.8b). The dedupe key holds
 * the event id, so a redelivered event asks for the same send and the contact module skips it. The
 * handler never sees the phone; the contact module resolves it and owns the once-only record.
 */
export function buildNotifyReviewResultHandler(
  dependencies: NotifyReviewResultDependencies,
): EventHandler<typeof DIRECTORY_EVENT_TYPE.LISTING_APPROVED> {
  const { listings, settings, notifier, composer } = dependencies;
  return {
    handlerKey: "directory.notifyReviewResult",
    moduleKey: MODULE_KEY.DIRECTORY,
    eventType: DIRECTORY_EVENT_TYPE.LISTING_APPROVED,
    alsoHandles: [DIRECTORY_EVENT_TYPE.LISTING_REJECTED],
    ordering: "UNORDERED",
    async handle(envelope) {
      if (envelope.organizationId === null) return;
      const organizationId = asId<OrganizationId>(envelope.organizationId);
      if (!(await settings.notifyReviewBySms(organizationId))) return;
      const payload = envelope.payload as ListingEventPayload;
      const outcome =
        envelope.type === DIRECTORY_EVENT_TYPE.LISTING_REJECTED
          ? LISTING_STATUS.REJECTED
          : LISTING_STATUS.APPROVED;
      const reasonKeys =
        outcome === LISTING_STATUS.REJECTED
          ? await rejectionReasons(listings, payload.listingId)
          : [];
      const text = await composer.compose({
        organizationId,
        outcome,
        listingNumber: payload.listingNumber,
        reasonKeys,
      });
      await notifier.sendToCustomer({
        customerAccountId: payload.ownerCustomerAccountId,
        text,
        dedupeKey: `listing-review:${payload.listingId}:${envelope.eventId}`,
      });
    },
  };
}

async function rejectionReasons(
  listings: Pick<ListingRepository, "findById">,
  listingId: string,
): Promise<readonly string[]> {
  const listing = await listings.findById(asId<ListingId>(listingId));
  return listing?.rejection?.reasonKeys ?? [];
}
