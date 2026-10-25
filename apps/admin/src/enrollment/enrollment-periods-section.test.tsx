// @vitest-environment jsdom
import type { EnrollmentPeriodResponse, EnrollmentResponse } from "@banijjik/contracts/enrollment";
import type { Money } from "@banijjik/contracts/payment";
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
const refundDialogMock = vi.fn();
vi.mock("../payments/refund-dialog-lazy", () => ({
  RefundDialogLazy: (props: unknown) => {
    refundDialogMock(props);
    return <div data-testid="refund-dialog" />;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const money = (amount: number) => ({ amount, currency: "BDT" as const });
const refundLabel = banglaText("enrollment.detail.refund");
const audit = {
  organizationId: "org-1",
  locationId: "loc-1",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  createdByUserId: null,
  updatedByUserId: null,
};

function periodWith(
  status: EnrollmentPeriodResponse["status"],
  refundRemaining: Money | null = null,
): EnrollmentPeriodResponse {
  return {
    ...audit,
    enrollmentPeriodId: "period-1",
    enrollmentId: "enrollment-1",
    periodNumber: 1,
    periodStartsOn: "2026-10-01",
    periodEndsOn: "2026-10-31",
    fee: money(100000),
    refundRemaining,
    sessionsAllowed: 12,
    sessionsUsed: 2,
    status,
    version: 1,
  };
}

function renderSection(
  period: EnrollmentPeriodResponse,
  dueMinor: Record<string, number> = {},
  canRefund = false,
): void {
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
      periods={[period]}
      locationName="প্রধান শাখা"
      currency="BDT"
      currencySymbol="৳"
      allowedMethods={[PAYMENT_METHOD.CASH]}
      canReceive
      canRefund={canRefund}
      dueMinorByPeriodId={dueMinor}
      locale="bn"
      labels={{
        title: "মেয়াদ",
        fee: "ফি",
        sessions: "সেশন",
        receivePayment: banglaText("enrollment.detail.receivePayment"),
        refund: refundLabel,
        updating: banglaText("enrollment.detail.updating"),
        reloadStatus: banglaText("enrollment.detail.reloadStatus"),
        periodNames: { 1: "মেয়াদ ১" },
        statusNames: { [period.status]: banglaText(`enrollment.periodStatus.${period.status}`) },
        sessionsOf: "{used}/{allowed}",
        sheetLabels: {
          ...payment.receiveSheet,
          methodLabels: payment.method,
          requestTypeLabels: payment.requestType,
        },
        refundDialogLabels: {
          ...payment.refundDialog,
          methodLabels: payment.method,
          requestTypeLabels: payment.requestType,
          cancelLabel: payment.refundDialog.cancel,
          closeLabel: payment.refundDialog.cancel,
          lockedMessage: payment.refundDialog.approvalLocked,
        },
      }}
    />,
  );
}

function expectNoRefundButton(reason: string): void {
  expect(screen.queryByRole("button", { name: refundLabel }), reason).toBeNull();
}

describe("EnrollmentPeriodsSection", () => {
  it("opens the receive-payment sheet for the period with the payer and the remaining due", async () => {
    renderSection(periodWith("PARTIAL"), { "period-1": 40000 });
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
    renderSection(periodWith("PAID"));
    expect(
      screen.queryByRole("button", { name: banglaText("enrollment.detail.receivePayment") }),
    ).toBeNull();
  });

  it("offers a refund for a cancelled period that still has a refund left", () => {
    renderSection(periodWith("PAID", money(50000)), {}, true);
    expect(screen.getByRole("button", { name: refundLabel })).toBeDefined();
  });

  it("offers no refund once the period is refunded back", () => {
    renderSection(periodWith("PAID", money(0)), {}, true);
    expectNoRefundButton("a refunded period has nothing left to give back");
  });

  it("offers no refund while the enrollment runs", () => {
    renderSection(periodWith("PAID", null), {}, true);
    expectNoRefundButton("only a cancelled enrollment answers a refund limit");
  });

  it("offers no refund without the refund permission", () => {
    renderSection(periodWith("PAID", money(50000)), {}, false);
    expectNoRefundButton("the refund button needs the refund permission");
  });

  it("opens the refund dialog with the period as the one allocation and its limit as the maximum", async () => {
    const limit = money(50000);
    renderSection(periodWith("PAID", limit), {}, true);
    await userEvent.setup().click(screen.getByRole("button", { name: refundLabel }));
    expect(refundDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        maxAmount: limit,
        payment: expect.objectContaining({
          locationId: "loc-1",
          contactId: "payer-1",
          amount: limit,
          allocations: [
            { requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT, requestId: "period-1", amount: limit },
          ],
        }),
      }),
    );
  });
});
