import { EVENT_TYPE } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { systemClock } from "../../../../kernel/time/index.js";
import { buildPostBookingsHandler } from "./handlers/post-bookings.handler.js";
import { buildPostPaymentsHandler } from "./handlers/post-payments.handler.js";
import type { BookingPostingSource } from "./ports/booking-posting-source.js";
import type { PaymentPostingSource } from "./ports/payment-posting-source.js";
import type { PostJournalDependencies } from "./post-journal.js";

const posting = {
  accounts: {},
  journals: {},
  events: { publish: async () => undefined },
  audit: { record: async () => undefined },
  clock: systemClock,
} as unknown as PostJournalDependencies;

const payments: PaymentPostingSource = {
  readPayment: async () => undefined,
  readStoreCreditEntry: async () => undefined,
};
const bookings: BookingPostingSource = { readBooking: async () => undefined };

describe("accounting ORDERED posting handlers", () => {
  it("postPayments alsoHandles refund, reverse and store-credit on one stream", () => {
    const handler = buildPostPaymentsHandler({ payments, posting });
    expect(handler.handlerKey).toBe("accounting.postPayments");
    expect(handler.eventType).toBe(EVENT_TYPE.PAYMENT_RECEIVED);
    expect(handler.ordering).toBe("ORDERED");
    expect(handler.alsoHandles).toEqual([
      EVENT_TYPE.PAYMENT_REFUNDED,
      EVENT_TYPE.PAYMENT_REVERSED,
      EVENT_TYPE.STORE_CREDIT_CHANGED,
    ]);
  });

  it("postBookings alsoHandles cancellation and no-show", () => {
    const handler = buildPostBookingsHandler({ bookings, posting });
    expect(handler.handlerKey).toBe("accounting.postBookings");
    expect(handler.alsoHandles).toEqual([
      EVENT_TYPE.BOOKING_CANCELLED,
      EVENT_TYPE.BOOKING_NO_SHOW_MARKED,
    ]);
  });
});
