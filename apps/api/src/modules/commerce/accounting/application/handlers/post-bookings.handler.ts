import { EVENT_TYPE, MODULE_KEY, type EventEnvelope } from "@banijjik/contracts";
import { asId, type OrganizationId, type UserId } from "@banijjik/ids";
import type { EventHandler } from "../../../../../kernel/events/index.js";
import { postingSourceMissing } from "../../domain/errors.js";
import { draftBookingCompleted, draftCancellationFee } from "../../domain/posting-rules.js";
import type { BookingPostingSource } from "../ports/booking-posting-source.js";
import { postJournalEntry, type PostJournalDependencies } from "../post-journal.js";

export function buildPostBookingsHandler(input: {
  readonly bookings: BookingPostingSource;
  readonly posting: PostJournalDependencies;
}): EventHandler<typeof EVENT_TYPE.BOOKING_COMPLETED> {
  return {
    handlerKey: "accounting.postBookings",
    moduleKey: MODULE_KEY.ACCOUNTING,
    eventType: EVENT_TYPE.BOOKING_COMPLETED,
    alsoHandles: [EVENT_TYPE.BOOKING_CANCELLED],
    ordering: "ORDERED",
    async handle(envelope) {
      await handleBookingEvent(input, envelope as unknown as EventEnvelope<{ bookingId: string }>);
    },
  };
}

async function handleBookingEvent(
  input: {
    readonly bookings: BookingPostingSource;
    readonly posting: PostJournalDependencies;
  },
  envelope: EventEnvelope<{ bookingId: string }>,
): Promise<void> {
  if (envelope.organizationId === null) throw postingSourceMissing("organization");
  const organizationId = asId<OrganizationId>(envelope.organizationId);
  const actorUserId = envelope.actorUserId === null ? null : asId<UserId>(envelope.actorUserId);
  const snapshot = await input.bookings.readBooking(envelope.payload.bookingId);
  if (snapshot === undefined) {
    throw postingSourceMissing(`booking:${envelope.payload.bookingId}`);
  }

  if (envelope.type === EVENT_TYPE.BOOKING_COMPLETED) {
    for (const draft of draftBookingCompleted(snapshot)) {
      await postJournalEntry(input.posting, { organizationId, actorUserId, draft });
    }
    return;
  }

  const fee = draftCancellationFee(snapshot);
  if (fee !== undefined) {
    await postJournalEntry(input.posting, { organizationId, actorUserId, draft: fee });
  }
}
