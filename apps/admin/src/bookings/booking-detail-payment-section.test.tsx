// @vitest-environment jsdom
import type { BookingResponse } from "@banijjik/contracts/booking";
import { PAYMENT_METHOD, PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { paymentLabelsOf } from "../payments/payment-labels";
import { BookingDetailPaymentSection } from "./booking-detail-payment-section";

const receiveSheetMock = vi.fn();
vi.mock("../payments/receive-payment-sheet-lazy", () => ({
  ReceivePaymentSheetLazy: (props: unknown) => {
    receiveSheetMock(props);
    return <div data-testid="receive-sheet" />;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("BookingDetailPaymentSection", () => {
  it("prefills remaining due instead of total price when opening receive payment sheet for a partial booking", async () => {
    const user = userEvent.setup();
    const t = banglaTranslator().t;
    const paymentLabels = paymentLabelsOf(t);

    const partialBooking: BookingResponse = {
      bookingId: "0192e2b0-8a71-7000-8000-000000000001",
      locationId: "loc-1",
      contactId: "contact-1",
      offeringId: "offering-1",
      variantId: "variant-1",
      kind: "SERVICE",
      bookingNumber: "BK-2001",
      status: "CONFIRMED",
      paymentStatus: "PARTIAL",
      source: "STAFF",
      quantity: 1,
      resourceIds: [],
      providerMemberId: null,
      note: null,
      holdExpiresAt: null,
      startsAt: "2026-11-01T10:00:00.000Z",
      endsAt: "2026-11-01T11:00:00.000Z",
      price: {
        unitPrice: { amount: 100000, currency: "BDT" },
        total: { amount: 100000, currency: "BDT" },
        tax: { amount: 0, currency: "BDT" },
        currency: "BDT",
      },
      depositRequired: { amount: 20000, currency: "BDT" },
      history: [],
      version: 1,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };

    const remainingDueMinor = 40000;

    renderInBangla(
      <BookingDetailPaymentSection
        organizationId="org-1"
        booking={partialBooking}
        locationName="ধানমন্ডি শাখা"
        remainingDueMinor={remainingDueMinor}
        currency="BDT"
        currencySymbol="৳"
        allowedMethods={[PAYMENT_METHOD.CASH]}
        canReceive={true}
        locale="bn"
        labels={{
          paymentStatus: "পেমেন্ট স্ট্যাটাস",
          receivePayment: "পেমেন্ট গ্রহণ করুন",
          totalPrice: "মোট মূল্য",
          depositRequired: "প্রয়োজনীয় ডিপোজিট",
          statusLabels: paymentLabels.status,
          sheetLabels: {
            ...paymentLabels.receiveSheet,
            methodLabels: paymentLabels.method,
            requestTypeLabels: paymentLabels.requestType,
          },
        }}
      />,
    );

    const receiveBtn = screen.getByRole("button", { name: "পেমেন্ট গ্রহণ করুন" });
    await user.click(receiveBtn);

    expect(receiveSheetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        initialDueMinor: 40000,
        initialAllocations: [
          expect.objectContaining({
            requestType: PAYMENT_REQUEST_TYPE.BOOKING,
            requestId: "0192e2b0-8a71-7000-8000-000000000001",
            requestNumber: "BK-2001",
            amount: { amount: 40000, currency: "BDT" },
          }),
        ],
        locations: [{ locationId: "loc-1", name: "ধানমন্ডি শাখা" }],
      }),
    );
  });
});
