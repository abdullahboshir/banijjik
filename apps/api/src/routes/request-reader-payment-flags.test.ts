import { describe, expect, it } from "vitest";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { buildBookingRequestReader } from "./booking-request-reader.js";
import { buildOrderRequestReader } from "./order-request-reader.js";

describe("booking and order refunds and payments behave as before", () => {
  it("the booking reader explicitly accepts payments without an extra refund limit", async () => {
    const organizationId = asId<OrganizationId>(newId());
    const bookingId = newId();
    const bookings = {
      findById: async () => ({
        bookingId,
        organizationId,
        locationId: newId(),
        contactId: newId(),
        status: "COMPLETED",
        price: { total: { amount: 100, currency: "BDT" } },
      }),
    } as unknown as Parameters<typeof buildBookingRequestReader>[0];
    expect(await buildBookingRequestReader(bookings).read(organizationId, bookingId)).toMatchObject(
      { acceptsPayments: true, refundLimit: null, revenueState: "AFTER_REVENUE" },
    );
  });
  it("the order reader explicitly accepts payments without an extra refund limit", async () => {
    const organizationId = asId<OrganizationId>(newId());
    const orderId = newId();
    const orders = {
      read: async () => ({
        orderId,
        organizationId,
        locationId: newId(),
        contactId: newId(),
        status: "COMPLETED",
        totals: { grandTotal: { amount: 100, currency: "BDT" } },
      }),
    } as unknown as Parameters<typeof buildOrderRequestReader>[0];
    expect(await buildOrderRequestReader(orders).read(organizationId, orderId)).toMatchObject({
      acceptsPayments: true,
      refundLimit: null,
      revenueState: "AFTER_REVENUE",
    });
  });
});
