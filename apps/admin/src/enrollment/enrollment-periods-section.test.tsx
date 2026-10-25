// @vitest-environment jsdom
import type { EnrollmentPeriodResponse, EnrollmentResponse } from "@banijjik/contracts/enrollment";
import { PAYMENT_METHOD, PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { paymentLabelsOf } from "../payments/payment-labels";
import { EnrollmentPeriodsSection } from "./enrollment-periods-section";

const receiveSheetMock = vi.fn();
vi.mock("../payments/receive-payment-sheet-lazy", () => ({
  ReceivePaymentSheetLazy: (props: unknown) => {
    receiveSheetMock(props);
    return <div data-testid="receive-sheet" />;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const money = (amount: number) => ({ amount, currency: "BDT" as const });
const audit = {
  organizationId: "org-1",
  locationId: "loc-1",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  createdByUserId: null,
  updatedByUserId: null,
};

function periodWith(status: EnrollmentPeriodResponse["status"]): EnrollmentPeriodResponse {
  return {
    ...audit,
    enrollmentPeriodId: "period-1",
    enrollmentId: "enrollment-1",
    periodNumber: 1,
    periodStartsOn: "2026-10-01",
    periodEndsOn: "2026-10-31",
    fee: money(100000),
    refundRemaining: null,
    sessionsAllowed: 12,
    sessionsUsed: 2,
    status,
    version: 1,
  };
}

function renderSection(
  status: EnrollmentPeriodResponse["status"],
  dueMinor: Record<string, number>,
) {
  const t = banglaTranslator().t;
  const payment = paymentLabelsOf(t);
  renderInBangla(
    <EnrollmentPeriodsSection
      organizationId="org-1"
      enrollment={
        {
          ...audit,
          enrollmentId: "enrollment-1",
          enrollmentNumber: "EN-1",
          billToContactId: "payer-1",
        } as EnrollmentResponse
      }
      periods={[periodWith(status)]}
      locationName="প্রধান শাখা"
      currency="BDT"
      currencySymbol="৳"
      allowedMethods={[PAYMENT_METHOD.CASH]}
      canReceive
      dueMinorByPeriodId={dueMinor}
      locale="bn"
      labels={{
        title: "মেয়াদ",
        fee: "ফি",
        sessions: "সেশন",
        receivePayment: banglaText("enrollment.detail.receivePayment"),
        updating: banglaText("enrollment.detail.updating"),
        reloadStatus: banglaText("enrollment.detail.reloadStatus"),
        periodNames: { 1: "মেয়াদ ১" },
        statusNames: { [status]: banglaText(`enrollment.periodStatus.${status}`) },
        sessionsOf: "{used}/{allowed}",
        sheetLabels: {
          ...payment.receiveSheet,
          methodLabels: payment.method,
          requestTypeLabels: payment.requestType,
        },
      }}
    />,
  );
}

describe("EnrollmentPeriodsSection", () => {
  it("opens the receive-payment sheet for the period with the payer and the remaining due", async () => {
    renderSection("PARTIAL", { "period-1": 40000 });
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: banglaText("enrollment.detail.receivePayment") }));
    expect(receiveSheetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        initialContactId: "payer-1",
        initialDueMinor: 40000,
        initialAllocations: [
          expect.objectContaining({
            requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
            requestId: "period-1",
            amount: { amount: 40000, currency: "BDT" },
          }),
        ],
      }),
    );
  });

  it("offers no payment button for a paid period", () => {
    renderSection("PAID", {});
    expect(
      screen.queryByRole("button", { name: banglaText("enrollment.detail.receivePayment") }),
    ).toBeNull();
  });
});
