// @vitest-environment jsdom
import { PAYMENT_METHOD } from "@banijjik/contracts/payment";
import { SALES_RETURN_STATUS, type SalesReturnResponse } from "@banijjik/contracts/sales";
import { cleanup, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { orderLabelsOf } from "./order-labels";
import { returnLabelsOf } from "./return-labels";

const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push }) }));

const reverseReturnMock = vi.fn();
vi.mock("./return-api", () => ({
  reverseReturn: (...args: unknown[]) => reverseReturnMock(...args),
  newSubmitKey: () => "submit-key-1",
}));

vi.mock("./lazy-order-approval-dialog", () => ({
  LazyOrderApprovalDialog: () => null,
}));

vi.mock("./order-toast", () => ({ showSuccessToast: vi.fn() }));

import { ReturnReverseSheet } from "./return-reverse-sheet";

const RETURN_ID = "01900000-0000-7000-8000-000000000040";
const ORDER_ID = "01900000-0000-7000-8000-000000000010";
const TIMESTAMP = "2026-10-24T00:00:00.000Z";

const labels = returnLabelsOf(banglaTranslator().t);
const approvalLabels = orderLabelsOf(banglaTranslator().t).approval;

function returnWithRefund(refundMinor: number): SalesReturnResponse {
  const money = (amount: number) => ({ amount, currency: "BDT" as const });
  return {
    salesReturnId: RETURN_ID,
    salesReturnNumber: "RET-000001",
    orderId: ORDER_ID,
    locationId: "location-1",
    contactId: "contact-1",
    lines: [],
    deliveryChargeReturned: money(0),
    roundingReturned: money(0),
    value: money(1000),
    refund: {
      method: refundMinor > 0 ? PAYMENT_METHOD.CASH : null,
      amount: money(refundMinor),
      paymentId: null,
      storeCreditEntryId: null,
    },
    dueReduced: money(0),
    reasonKey: "DEFECTIVE",
    note: null,
    approvals: [],
    status: SALES_RETURN_STATUS.ACTIVE,
    reversal: null,
    exchangeOrderId: null,
    businessDate: "2026-10-24",
    version: 1,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

function renderReverse(salesReturn: SalesReturnResponse): void {
  renderInBangla(
    <ReturnReverseSheet
      open
      onOpenChange={() => undefined}
      orgSlug="acme"
      organizationId="org-1"
      salesReturn={salesReturn}
      allowedMethods={[PAYMENT_METHOD.CASH, PAYMENT_METHOD.BKASH]}
      methodLabels={{ CASH: "নগদ", BKASH: "বিকাশ" }}
      labels={labels}
      approvalLabels={approvalLabels}
    />,
  );
}

describe("reverse sheet", () => {
  afterEach(() => {
    cleanup();
    reverseReturnMock.mockReset();
  });

  it("shows the payback choice only when the return refunded money", () => {
    renderReverse(returnWithRefund(0));
    expect(screen.queryByLabelText(labels.reverse.payback)).toBeNull();
    cleanup();
    renderReverse(returnWithRefund(1000));
    expect(screen.getByLabelText(labels.reverse.payback)).toBeTruthy();
  });

  it("asks for the transaction reference only for a bKash payback", async () => {
    renderReverse(returnWithRefund(1000));
    await userEvent.click(screen.getByLabelText(labels.reverse.payback));
    await userEvent.selectOptions(
      screen.getByLabelText(new RegExp(labels.reverse.paybackMethod)),
      PAYMENT_METHOD.BKASH,
    );
    expect(screen.getByLabelText(new RegExp(labels.reverse.paybackReference))).toBeTruthy();
  });

  it("keeps the reverse button closed until a reason is chosen", () => {
    renderReverse(returnWithRefund(0));
    expect(screen.getByRole("button", { name: labels.reverse.submit })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
