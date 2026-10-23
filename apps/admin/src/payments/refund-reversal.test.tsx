// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import {
  PAYMENT_DIRECTION,
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  PAYMENT_RULE_KEYS,
  type PaymentResponse,
} from "@banijjik/contracts/payment";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

afterEach(cleanup);

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const refundPaymentMock = vi.fn();
const reversePaymentMock = vi.fn();
const listApproversMock = vi.fn();
const grantApprovalMock = vi.fn();

vi.mock("./payment-api", () => ({
  refundPayment: (...args: unknown[]) => refundPaymentMock(...args),
  reversePayment: (...args: unknown[]) => reversePaymentMock(...args),
  listApprovers: (...args: unknown[]) => listApproversMock(...args),
  grantApproval: (...args: unknown[]) => grantApprovalMock(...args),
}));

const { RefundDialog } = await import("./refund-dialog");
const { ReversalDialog } = await import("./reversal-dialog");
const { paymentLabelsOf } = await import("./payment-labels");

const labels = paymentLabelsOf(banglaTranslator().t);

const MOCK_PAYMENT: PaymentResponse = {
  paymentId: "0192e2b0-8a71-7000-8000-000000000001",
  paymentNumber: "PAY-1",
  locationId: "0192e2b0-8a71-7000-8000-000000000002",
  direction: PAYMENT_DIRECTION.IN,
  method: PAYMENT_METHOD.CASH,
  amount: { amount: 50000, currency: "BDT" },
  externalReference: null,
  reversesPaymentId: null,
  allocations: [
    {
      requestType: PAYMENT_REQUEST_TYPE.BOOKING,
      requestId: "0192e2b0-8a71-7000-8000-000000000003",
      amount: { amount: 50000, currency: "BDT" },
      revenueState: "BEFORE_REVENUE",
    },
  ],
  contactId: "0192e2b0-8a71-7000-8000-000000000004",
  receivedByMemberId: "mem-1",
  businessDate: "2026-10-23",
  approval: null,
  note: "Test payment",
  version: 1,
  createdAt: "2026-10-23T10:00:00Z",
  updatedAt: "2026-10-23T10:00:00Z",
};

const APPROVER = { memberId: "mgr-1", displayName: "ম্যানেজার সাহেব" };

describe("Refund and Reversal flows", () => {
  beforeEach(() => {
    refresh.mockReset();
    refundPaymentMock.mockReset();
    reversePaymentMock.mockReset();
    listApproversMock.mockReset();
    grantApprovalMock.mockReset();
  });

  it("handles refund with approval dialog retry when approval is required", async () => {
    const user = userEvent.setup();

    // First refund call fails with approval required
    refundPaymentMock.mockRejectedValueOnce(
      new ApiError({
        status: 403,
        code: ERROR_CODE.APPROVAL_REQUIRED,
        messageKey: PAYMENT_RULE_KEYS.PAYMENT_APPROVAL_REQUIRED,
      }),
    );
    listApproversMock.mockResolvedValueOnce([APPROVER]);
    grantApprovalMock.mockResolvedValueOnce({
      approvalToken: "token-123",
      expiresAt: "2026-10-23T11:00:00Z",
    });
    refundPaymentMock.mockResolvedValueOnce({
      ...MOCK_PAYMENT,
      direction: PAYMENT_DIRECTION.REFUND,
    });

    renderInBangla(
      <RefundDialog
        open
        onOpenChange={() => {}}
        organizationId="org-1"
        payment={MOCK_PAYMENT}
        labels={{
          ...labels.refundDialog,
          methodLabels: labels.method,
          requestTypeLabels: labels.requestType,
          cancelLabel: labels.refundDialog.cancel,
          closeLabel: labels.refundDialog.cancel,
          lockedMessage: labels.refundDialog.approvalLocked,
        }}
      />,
    );

    // Click submit
    const submitBtn = screen.getByRole("button", { name: labels.refundDialog.submit });
    await user.click(submitBtn);

    // Approval PIN dialog appears
    await waitFor(() => {
      expect(screen.getByText(labels.refundDialog.approvalTitle)).toBeDefined();
      expect(screen.getByText(APPROVER.displayName)).toBeDefined();
    });

    // Enter PIN via fireEvent
    const pinInput = screen.getByLabelText(labels.refundDialog.pin);
    fireEvent.change(pinInput, { target: { value: "1234" } });

    // Click submit in approval dialog (background sheet is aria-hidden)
    const confirmApprovalBtn = screen.getByRole("button", {
      name: labels.refundDialog.submit,
    });
    fireEvent.click(confirmApprovalBtn);

    await waitFor(() => {
      expect(grantApprovalMock).toHaveBeenCalledWith("org-1", {
        action: "REFUND",
        subjectKey: MOCK_PAYMENT.locationId,
        amount: MOCK_PAYMENT.amount,
        locationId: MOCK_PAYMENT.locationId,
        approverMemberId: APPROVER.memberId,
        pin: "1234",
      });
      expect(refundPaymentMock).toHaveBeenCalledTimes(2);
      expect(refundPaymentMock).toHaveBeenLastCalledWith(
        "org-1",
        expect.objectContaining({
          approvalToken: "token-123",
        }),
      );
    });
  });

  it("handles reversal 409 conflict and presents reload button", async () => {
    const user = userEvent.setup();

    listApproversMock.mockResolvedValueOnce([APPROVER]);
    grantApprovalMock.mockResolvedValueOnce({
      approvalToken: "reversal-token-123",
      expiresAt: "2026-10-23T11:00:00Z",
    });
    reversePaymentMock.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: ERROR_CODE.CONFLICT,
        messageKey: PAYMENT_RULE_KEYS.PAYMENT_REVERSAL_ALREADY_REVERSED,
      }),
    );

    renderInBangla(
      <ReversalDialog
        open
        onOpenChange={() => {}}
        organizationId="org-1"
        payment={MOCK_PAYMENT}
        labels={{
          ...labels.reversalDialog,
          cancelLabel: labels.reversalDialog.cancel,
          closeLabel: labels.reversalDialog.cancel,
          lockedMessage: "PIN locked",
        }}
      />,
    );

    // Click submit to initiate reversal
    const submitBtn = screen.getByRole("button", { name: labels.reversalDialog.submit });
    await user.click(submitBtn);

    // Approval PIN dialog appears
    await waitFor(() => {
      expect(screen.getByText(APPROVER.displayName)).toBeDefined();
    });

    const pinInput = screen.getByLabelText(labels.reversalDialog.pin);
    fireEvent.change(pinInput, { target: { value: "1234" } });

    const confirmApprovalBtn = screen.getByRole("button", {
      name: labels.reversalDialog.submit,
    });
    fireEvent.click(confirmApprovalBtn);

    // 409 Conflict error received: conflict notice and reload button appear
    await waitFor(() => {
      expect(screen.getByText(labels.reversalDialog.conflict)).toBeDefined();
      expect(screen.getByRole("button", { name: labels.reversalDialog.reload })).toBeDefined();
    });

    // Clicking reload refreshes the page
    const reloadBtn = screen.getByRole("button", { name: labels.reversalDialog.reload });
    await user.click(reloadBtn);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows error and no PIN dialog when refund exceeds paid amount", async () => {
    const user = userEvent.setup();

    refundPaymentMock.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: ERROR_CODE.VALIDATION_ERROR,
        messageKey: PAYMENT_RULE_KEYS.PAYMENT_REFUND_EXCEEDS_PAID,
      }),
    );

    renderInBangla(
      <RefundDialog
        open
        onOpenChange={() => {}}
        organizationId="org-1"
        payment={MOCK_PAYMENT}
        labels={{
          ...labels.refundDialog,
          methodLabels: labels.method,
          requestTypeLabels: labels.requestType,
          cancelLabel: labels.refundDialog.cancel,
          closeLabel: labels.refundDialog.cancel,
          lockedMessage: labels.refundDialog.approvalLocked,
        }}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: labels.refundDialog.submit });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(banglaTranslator().t("errors.payment_refund_exceeds_paid")),
      ).toBeDefined();
    });

    expect(screen.queryByText(labels.refundDialog.approvalTitle)).toBeNull();
    expect(listApproversMock).not.toHaveBeenCalled();
  });

  it("translates raw message keys to user language on error", async () => {
    const user = userEvent.setup();

    refundPaymentMock.mockRejectedValueOnce(
      new ApiError({
        status: 400,
        code: ERROR_CODE.VALIDATION_ERROR,
        messageKey: "errors.payment_original_not_found",
      }),
    );

    renderInBangla(
      <RefundDialog
        open
        onOpenChange={() => {}}
        organizationId="org-1"
        payment={MOCK_PAYMENT}
        labels={{
          ...labels.refundDialog,
          methodLabels: labels.method,
          requestTypeLabels: labels.requestType,
          cancelLabel: labels.refundDialog.cancel,
          closeLabel: labels.refundDialog.cancel,
          lockedMessage: labels.refundDialog.approvalLocked,
        }}
      />,
    );

    const submitBtn = screen.getByRole("button", { name: labels.refundDialog.submit });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByText("errors.payment_original_not_found")).toBeNull();
      expect(
        screen.getByText(banglaTranslator().t("errors.payment_original_not_found")),
      ).toBeDefined();
    });
  });
});
