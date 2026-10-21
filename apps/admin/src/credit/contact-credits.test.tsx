// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import type { CreditAccountResponse, CreditEntry } from "@banijjik/contracts/credit";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaText, banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const writes = {
  adjustCredits: vi.fn(),
  grantApproval: vi.fn(),
  listApprovers: vi.fn(),
};
vi.mock("./credit-api", () => ({
  adjustCredits: (...args: unknown[]) => writes.adjustCredits(...args),
  grantApproval: (...args: unknown[]) => writes.grantApproval(...args),
  listApprovers: (...args: unknown[]) => writes.listApprovers(...args),
}));

const { ContactCreditsSection } = await import("./contact-credits-section");
const { contactCreditsLabelsOf } = await import("./credit-labels");

const labels = contactCreditsLabelsOf(banglaTranslator().t);

function entry(change: Partial<CreditEntry>): CreditEntry {
  return {
    creditEntryId: "entry-1",
    customerAccountId: "account-1",
    type: "PURCHASE",
    credits: 5,
    expiresOn: null,
    source: { sourceType: "PAYMENT", sourceId: "payment-1" },
    fromPurchaseEntryId: null,
    reason: null,
    createdByUserId: null,
    occurredAt: "2026-10-15T08:00:00.000Z",
    businessDate: "2026-10-15",
    createdAt: "2026-10-15T08:00:00.000Z",
    ...change,
  };
}

const ACCOUNT: CreditAccountResponse = {
  customerAccountId: "account-1",
  balance: 7,
  entries: [
    entry({ creditEntryId: "entry-1", expiresOn: "2026-12-31T00:00:00.000Z" }),
    entry({
      creditEntryId: "entry-2",
      type: "SPEND",
      credits: -1,
      source: { sourceType: "UNLOCK", sourceId: "unlock-1" },
      reason: "BAN-1 আনলক",
      occurredAt: "2026-10-16T08:00:00.000Z",
      businessDate: "2026-10-16",
    }),
  ],
};

const LOCATIONS = [{ locationId: "loc-1", name: "ঢাকা" }];

function renderSection(change: Partial<Parameters<typeof ContactCreditsSection>[0]> = {}) {
  renderInBangla(
    <ContactCreditsSection
      organizationId="org-1"
      customerAccountId="account-1"
      account={ACCOUNT}
      canAdjust
      isOwner
      locations={[]}
      locale="bn"
      timeZone="Asia/Dhaka"
      labels={labels}
      {...change}
    />,
  );
}

function dateTextOf(iso: string): string {
  return new Intl.DateTimeFormat("bn", { dateStyle: "medium", timeZone: "Asia/Dhaka" }).format(
    new Date(iso),
  );
}

beforeEach(() => {
  refresh.mockReset();
  for (const write of Object.values(writes)) write.mockReset();
  writes.listApprovers.mockResolvedValue([
    { memberId: "member-1", displayName: "ম্যানেজার", hasPin: true },
  ]);
});

describe("the contact credits section", () => {
  it("shows the balance and the ledger with signed amounts and dates", () => {
    renderSection();

    expect(screen.getByText("7 ক্রেডিট")).toBeTruthy();
    expect(screen.getByText(labels.entry.PURCHASE)).toBeTruthy();
    expect(screen.getByText(labels.entry.SPEND)).toBeTruthy();
    expect(screen.getByText("+5")).toBeTruthy();
    expect(screen.getByText("−1")).toBeTruthy();
    expect(screen.getByText("BAN-1 আনলক")).toBeTruthy();
    // The purchase row shows its occurred date together with the expiry date in one line.
    expect(screen.getByText(new RegExp(dateTextOf("2026-10-15T08:00:00.000Z")))).toBeTruthy();
    expect(screen.getByText(dateTextOf("2026-10-16T08:00:00.000Z"))).toBeTruthy();
    expect(screen.getByText(new RegExp(labels.expiresOn.replace("{date}", ".+")))).toBeTruthy();
  });

  it("says when there is no history yet", () => {
    renderSection({ account: { ...ACCOUNT, entries: [] } });

    expect(screen.getByText(labels.empty)).toBeTruthy();
  });

  it("hides the adjustment form from a person who may not adjust", () => {
    renderSection({ canAdjust: false });

    expect(screen.queryByLabelText(labels.adjustCredits)).toBeNull();
    expect(screen.queryByRole("button", { name: labels.adjustSubmit })).toBeNull();
  });

  it("shows what is missing instead of sending an unreadable adjustment", async () => {
    renderSection();

    await userEvent.type(screen.getByLabelText(labels.adjustCredits), "5");
    await userEvent.click(screen.getByRole("button", { name: labels.adjustSubmit }));

    expect(await screen.findByText(labels.invalid)).toBeTruthy();
    expect(writes.adjustCredits).not.toHaveBeenCalled();
  });
});

describe("an owner's adjustment", () => {
  it("sends the change without an approval token and reloads", async () => {
    writes.adjustCredits.mockResolvedValue({ balance: 12 });
    renderSection();

    await userEvent.type(screen.getByLabelText(labels.adjustCredits), "5");
    await userEvent.type(screen.getByLabelText(labels.adjustReason), "ফেরত");
    await userEvent.click(screen.getByRole("button", { name: labels.adjustSubmit }));

    await waitFor(() =>
      expect(writes.adjustCredits).toHaveBeenCalledWith("org-1", "account-1", {
        credits: 5,
        reason: "ফেরত",
      }),
    );
    expect(await screen.findByText(labels.adjusted)).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
    expect(writes.grantApproval).not.toHaveBeenCalled();
  });

  it("shows the API's refusal in the form", async () => {
    writes.adjustCredits.mockRejectedValue(
      new ApiError({
        status: 422,
        code: ERROR_CODE.CREDITS_INSUFFICIENT,
        messageKey: "errors.credit_credits_insufficient",
      }),
    );
    renderSection();

    await userEvent.type(screen.getByLabelText(labels.adjustCredits), "-20");
    await userEvent.type(screen.getByLabelText(labels.adjustReason), "ফেরত");
    await userEvent.click(screen.getByRole("button", { name: labels.adjustSubmit }));

    expect(await screen.findByText(banglaText("errors.credit_credits_insufficient"))).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("a manager's adjustment", () => {
  function renderManagerAdjustment(
    change: Partial<Parameters<typeof ContactCreditsSection>[0]> = {},
  ) {
    renderSection({ isOwner: false, locations: LOCATIONS, ...change });
  }

  it("asks a manager of the chosen location for a PIN, then sends the token with the change", async () => {
    writes.adjustCredits
      .mockRejectedValueOnce(
        new ApiError({
          status: 403,
          code: ERROR_CODE.APPROVAL_REQUIRED,
          messageKey: "errors.approval_required",
        }),
      )
      .mockResolvedValueOnce({ balance: 12 });
    writes.grantApproval.mockResolvedValue({
      approvalToken: "approval-1",
      expiresAt: "2026-10-21T09:00:00.000Z",
    });
    renderManagerAdjustment();

    expect(screen.getByLabelText(labels.location)).toBeTruthy();
    await userEvent.type(screen.getByLabelText(labels.adjustCredits), "5");
    await userEvent.type(screen.getByLabelText(labels.adjustReason), "ফেরত");
    await userEvent.click(screen.getByRole("button", { name: labels.adjustSubmit }));

    expect(await screen.findByText(labels.approval.title)).toBeTruthy();
    expect(writes.listApprovers).toHaveBeenCalledWith("org-1", "loc-1");
    await userEvent.type(screen.getByLabelText(labels.approval.pin), "1234");
    await userEvent.click(screen.getByRole("button", { name: labels.approval.submit }));

    await waitFor(() =>
      expect(writes.grantApproval).toHaveBeenCalledWith("org-1", {
        action: APPROVAL_ACTION.CREDIT_ADJUSTMENT,
        subjectKey: "account-1",
        locationId: "loc-1",
        approverMemberId: "member-1",
        pin: "1234",
      }),
    );
    await waitFor(() =>
      expect(writes.adjustCredits).toHaveBeenLastCalledWith("org-1", "account-1", {
        credits: 5,
        reason: "ফেরত",
        approvalToken: "approval-1",
      }),
    );
    expect(await screen.findByText(labels.adjusted)).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });

  it("says when no manager of the location can approve", async () => {
    writes.adjustCredits.mockRejectedValue(
      new ApiError({
        status: 403,
        code: ERROR_CODE.APPROVAL_REQUIRED,
        messageKey: "errors.approval_required",
      }),
    );
    writes.listApprovers.mockResolvedValue([]);
    renderManagerAdjustment();

    await userEvent.type(screen.getByLabelText(labels.adjustCredits), "5");
    await userEvent.type(screen.getByLabelText(labels.adjustReason), "ফেরত");
    await userEvent.click(screen.getByRole("button", { name: labels.adjustSubmit }));

    expect(await screen.findByText(labels.noApprovers)).toBeTruthy();
    expect(screen.queryByText(labels.approval.title)).toBeNull();
    expect(writes.grantApproval).not.toHaveBeenCalled();
  });

  it("says why the PIN was refused, without closing the form", async () => {
    writes.adjustCredits.mockRejectedValue(
      new ApiError({
        status: 403,
        code: ERROR_CODE.APPROVAL_REQUIRED,
        messageKey: "errors.approval_required",
      }),
    );
    writes.grantApproval.mockRejectedValue(
      new ApiError({
        status: 423,
        code: ERROR_CODE.APPROVAL_PIN_LOCKED,
        messageKey: "errors.approval_pin_locked",
      }),
    );
    renderManagerAdjustment();

    await userEvent.type(screen.getByLabelText(labels.adjustCredits), "5");
    await userEvent.type(screen.getByLabelText(labels.adjustReason), "ফেরত");
    await userEvent.click(screen.getByRole("button", { name: labels.adjustSubmit }));
    await screen.findByText(labels.approval.title);
    await userEvent.type(screen.getByLabelText(labels.approval.pin), "1234");
    await userEvent.click(screen.getByRole("button", { name: labels.approval.submit }));

    expect(await screen.findByText(labels.approval.locked)).toBeTruthy();
    expect(writes.adjustCredits).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("explains that only an owner may adjust when the business has no active location", () => {
    renderManagerAdjustment({ locations: [] });

    expect(screen.getByText(labels.noLocations)).toBeTruthy();
    expect(screen.queryByLabelText(labels.adjustCredits)).toBeNull();
  });
});
