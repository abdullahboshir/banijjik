// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import type { CreditPurchaseResponse } from "@banijjik/contracts/credit";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const purchaseWrites = {
  verifyCreditPurchase: vi.fn(),
  rejectCreditPurchase: vi.fn(),
};
vi.mock("./credit-purchase-api", () => ({
  verifyCreditPurchase: (...args: unknown[]) => purchaseWrites.verifyCreditPurchase(...args),
  rejectCreditPurchase: (...args: unknown[]) => purchaseWrites.rejectCreditPurchase(...args),
}));

const approvalWrites = {
  listApprovers: vi.fn(),
  grantApproval: vi.fn(),
};
vi.mock("./credit-api", () => ({
  listApprovers: (...args: unknown[]) => approvalWrites.listApprovers(...args),
  grantApproval: (...args: unknown[]) => approvalWrites.grantApproval(...args),
}));

// The page loads the sheet lazily for the script budget; the unit tests render it directly.
vi.mock("./credit-purchase-detail-sheet-lazy", async () => ({
  CreditPurchaseDetailSheetLazy: (await import("./credit-purchase-detail-sheet"))
    .CreditPurchaseDetailSheet,
}));

const { CreditPurchasesManager } = await import("./credit-purchases-manager");
const { creditPurchaseLabelsOf } = await import("./credit-purchase-labels");

const labels = creditPurchaseLabelsOf(banglaTranslator().t);

function samplePurchase(change: Partial<CreditPurchaseResponse> = {}): CreditPurchaseResponse {
  return {
    creditPurchaseId: "cp-1",
    purchaseNumber: "CP-000001",
    customerAccountId: "acc-1",
    creditPackId: "pack-1",
    snapshot: {
      name: { bn: "১০ ক্রেডিট", en: "10 Credits" },
      credits: 10,
      price: { amount: 500, currency: "BDT" },
      validityDays: 30,
    },
    method: "BKASH",
    senderPhoneE164: "+8801711000000",
    transactionReference: "TRXREF001",
    status: "PENDING",
    verifiedByUserId: null,
    verifiedAt: null,
    rejectionReason: null,
    creditEntryId: null,
    submittedAt: "2026-10-22T10:00:00.000Z",
    expiresAt: "2026-10-29T10:00:00.000Z",
    version: 1,
    createdAt: "2026-10-22T10:00:00.000Z",
    updatedAt: "2026-10-22T10:00:00.000Z",
    ...change,
  };
}

describe("CreditPurchasesManager", () => {
  beforeEach(() => {
    refresh.mockReset();
    purchaseWrites.verifyCreditPurchase.mockReset();
    purchaseWrites.rejectCreditPurchase.mockReset();
    approvalWrites.listApprovers.mockReset();
    approvalWrites.grantApproval.mockReset();
  });

  it("renders purchase list with reference, sender phone, pack and amount", () => {
    const purchase = samplePurchase();
    renderInBangla(
      <CreditPurchasesManager
        organizationId="org-1"
        purchases={[purchase]}
        total={1}
        query={{ status: "PENDING", q: undefined, page: 1 }}
        basePath="/acme/credit/purchases"
        canVerify
        isOwner={false}
        locations={[{ locationId: "loc-1", name: "ঢাকা" }]}
        locale="bn"
        labels={labels}
      />,
    );

    expect(screen.getByText("CP-000001")).toBeDefined();
    expect(screen.getByText("TRXREF001")).toBeDefined();
    expect(screen.getByText("+8801711000000")).toBeDefined();
    expect(screen.getAllByText(labels.status.PENDING).length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when list has no purchases", () => {
    renderInBangla(
      <CreditPurchasesManager
        organizationId="org-1"
        purchases={[]}
        total={0}
        query={{ status: "PENDING", q: undefined, page: 1 }}
        basePath="/acme/credit/purchases"
        canVerify
        isOwner={false}
        locations={[]}
        locale="bn"
        labels={labels}
      />,
    );

    expect(screen.getByText(labels.empty)).toBeDefined();
  });

  it("opens detail sheet and verifies purchase directly when no approval needed", async () => {
    const user = userEvent.setup();
    const purchase = samplePurchase();
    purchaseWrites.verifyCreditPurchase.mockResolvedValueOnce({
      ...purchase,
      status: "VERIFIED",
    });

    renderInBangla(
      <CreditPurchasesManager
        organizationId="org-1"
        purchases={[purchase]}
        total={1}
        query={{ status: "PENDING", q: undefined, page: 1 }}
        basePath="/acme/credit/purchases"
        canVerify
        isOwner
        locations={[]}
        locale="bn"
        labels={labels}
      />,
    );

    await user.click(screen.getByText("CP-000001"));
    expect(screen.getByRole("dialog")).toBeDefined();

    const verifyBtn = screen.getByRole("button", { name: labels.verify });
    await user.click(verifyBtn);

    await waitFor(() => {
      expect(purchaseWrites.verifyCreditPurchase).toHaveBeenCalledWith("org-1", {
        creditPurchaseId: "cp-1",
        version: 1,
      });
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("handles rejection with reason chips and custom input", async () => {
    const user = userEvent.setup();
    const purchase = samplePurchase();
    const reasonChip = labels.reasons[0] ?? "reason";
    purchaseWrites.rejectCreditPurchase.mockResolvedValueOnce({
      ...purchase,
      status: "REJECTED",
      rejectionReason: reasonChip,
    });

    renderInBangla(
      <CreditPurchasesManager
        organizationId="org-1"
        purchases={[purchase]}
        total={1}
        query={{ status: "PENDING", q: undefined, page: 1 }}
        basePath="/acme/credit/purchases"
        canVerify
        isOwner
        locations={[]}
        locale="bn"
        labels={labels}
      />,
    );

    await user.click(screen.getByText("CP-000001"));
    const rejectBtn = screen.getByRole("button", { name: labels.reject });
    await user.click(rejectBtn);

    // Click quick chip
    const chip = screen.getByRole("button", { name: reasonChip });
    await user.click(chip);

    const submitRejectBtn = screen.getByRole("button", { name: labels.rejectSubmit });
    await user.click(submitRejectBtn);

    await waitFor(() => {
      expect(purchaseWrites.rejectCreditPurchase).toHaveBeenCalledWith("org-1", {
        creditPurchaseId: "cp-1",
        version: 1,
        reason: reasonChip,
      });
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("opens approval PIN dialog and retries with token when approval is required", async () => {
    const user = userEvent.setup();
    const purchase = samplePurchase();
    purchaseWrites.verifyCreditPurchase
      .mockRejectedValueOnce(
        new ApiError({
          status: 403,
          code: ERROR_CODE.APPROVAL_REQUIRED,
          messageKey: "errors.approval_required",
        }),
      )
      .mockResolvedValueOnce({
        ...purchase,
        status: "VERIFIED",
      });

    approvalWrites.listApprovers.mockResolvedValueOnce([
      { memberId: "approver-1", name: "ম্যানেজার", roleName: "Manager" },
    ]);
    approvalWrites.grantApproval.mockResolvedValueOnce({
      approvalToken: "tok-123",
      approvedByMemberId: "approver-1",
    });

    renderInBangla(
      <CreditPurchasesManager
        organizationId="org-1"
        purchases={[purchase]}
        total={1}
        query={{ status: "PENDING", q: undefined, page: 1 }}
        basePath="/acme/credit/purchases"
        canVerify
        isOwner={false}
        locations={[{ locationId: "loc-1", name: "ঢাকা" }]}
        locale="bn"
        labels={labels}
      />,
    );

    await user.click(screen.getByText("CP-000001"));
    const verifyBtn = screen.getByRole("button", { name: labels.verify });
    await user.click(verifyBtn);

    // Approval dialog should open
    await waitFor(() => {
      expect(approvalWrites.listApprovers).toHaveBeenCalledWith("org-1", "loc-1");
      expect(screen.getByText(labels.approval.title)).toBeDefined();
    });

    // Enter PIN and submit approval
    const pinInput = screen.getByLabelText(labels.approval.pin);
    await user.type(pinInput, "1234");
    const pinSubmit = screen.getByRole("button", { name: labels.approval.submit });
    await user.click(pinSubmit);

    await waitFor(() => {
      expect(approvalWrites.grantApproval).toHaveBeenCalledWith("org-1", {
        action: APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY,
        subjectKey: "cp-1",
        amount: { amount: 500, currency: "BDT" },
        locationId: "loc-1",
        approverMemberId: "approver-1",
        pin: "1234",
      });
      expect(purchaseWrites.verifyCreditPurchase).toHaveBeenCalledWith("org-1", {
        creditPurchaseId: "cp-1",
        version: 1,
        approvalToken: "tok-123",
      });
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
