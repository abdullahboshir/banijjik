// @vitest-environment jsdom
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { ERROR_CODE } from "@banijjik/contracts";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { banglaTranslator, renderInBangla } from "../auth/test-helpers";
import { storeCreditLabelsOf } from "./store-credit-labels";
import type { StoreCreditProps } from "./store-credit-types";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const api = {
  adjustStoreCredit: vi.fn(),
  grantApproval: vi.fn(),
  listApprovers: vi.fn(),
  listStoreCredit: vi.fn(),
};
vi.mock("./store-credit-api", () => ({
  adjustStoreCredit: (...args: unknown[]) => api.adjustStoreCredit(...args),
  grantApproval: (...args: unknown[]) => api.grantApproval(...args),
  listApprovers: (...args: unknown[]) => api.listApprovers(...args),
  listStoreCredit: (...args: unknown[]) => api.listStoreCredit(...args),
}));
vi.mock("next/dynamic", () => ({ default: () => StoreCreditApproval }));
const { StoreCreditApproval } = await import("./store-credit-approval");
const { StoreCreditSection } = await import("./store-credit-section");
const labels = storeCreditLabelsOf(banglaTranslator().t);
const props: StoreCreditProps = {
  organizationId: "organization-1",
  contactId: "contact-1",
  balanceMinor: 0,
  currency: "BDT",
  entries: [],
  total: 0,
  canAdjust: true,
  locations: [{ locationId: "location-1", name: "ঢাকা" }],
  locale: "bn",
  timeZone: "Asia/Dhaka",
  labels,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listApprovers.mockResolvedValue([
    { memberId: "member-1", displayName: "মালিক", hasPin: true },
  ]);
  api.grantApproval.mockResolvedValue({ approvalToken: "approval-token" });
  api.adjustStoreCredit.mockResolvedValue({ data: { balanceAfterMinor: 1250 } });
});

describe("store-credit adjust with approval", () => {
  it("requires a PIN approval bound to the contact and amount before adjusting store credit", async () => {
    renderInBangla(<StoreCreditSection {...props} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(labels.amount), "১২.৫০");
    await user.type(screen.getByLabelText(labels.reason), "সংশোধন");
    await user.click(screen.getByRole("button", { name: labels.save }));
    const dialog = await screen.findByRole("dialog");
    expect(api.adjustStoreCredit).not.toHaveBeenCalled();
    await user.type(within(dialog).getByLabelText(labels.approval.pin), "1234");
    await user.click(within(dialog).getByRole("button", { name: labels.approval.submit }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(api.grantApproval).toHaveBeenCalledWith("organization-1", {
      action: APPROVAL_ACTION.STORE_CREDIT_ADJUSTMENT,
      subjectKey: "contact-1",
      locationId: "location-1",
      amount: { amount: 1250, currency: "BDT" },
      approverMemberId: "member-1",
      pin: "1234",
    });
    expect(api.adjustStoreCredit).toHaveBeenCalledWith(
      "organization-1",
      {
        contactId: "contact-1",
        direction: "CREDIT",
        amount: { amount: 1250, currency: "BDT" },
        reason: "সংশোধন",
        approvalToken: "approval-token",
      },
      expect.any(String),
    );
    expect(screen.getByRole("status").textContent).toBe(labels.adjusted);
  });

  it("rejects invalid amounts and hides adjustments without write permission", async () => {
    renderInBangla(<StoreCreditSection {...props} />);
    await userEvent.click(screen.getByRole("button", { name: labels.save }));
    expect(screen.getByRole("alert").textContent).toBe(labels.invalid);
    expect(api.listApprovers).not.toHaveBeenCalled();
  });

  it("shows read-only balance and history without an adjustment form", () => {
    renderInBangla(<StoreCreditSection {...props} canAdjust={false} />);
    expect(screen.getByText(labels.empty)).toBeTruthy();
    expect(screen.queryByRole("button", { name: labels.save })).toBeNull();
  });

  it("keeps the idempotency key and approved body when retrying a lost adjustment response", async () => {
    api.adjustStoreCredit.mockRejectedValueOnce(
      new ApiError({ status: 0, code: ERROR_CODE.INTERNAL, messageKey: "errors.internal" }),
    );
    renderInBangla(<StoreCreditSection {...props} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(labels.amount), "12.50");
    await user.type(screen.getByLabelText(labels.reason), "সংশোধন");
    await user.click(screen.getByRole("button", { name: labels.save }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(labels.approval.pin), "1234");
    await user.click(within(dialog).getByRole("button", { name: labels.approval.submit }));
    await waitFor(() => expect(api.adjustStoreCredit).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(
        within(dialog)
          .getByRole("button", { name: labels.approval.submit })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    await user.click(within(dialog).getByRole("button", { name: labels.approval.submit }));
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
    expect(api.grantApproval).toHaveBeenCalledOnce();
    expect(api.adjustStoreCredit.mock.calls[1]).toEqual(api.adjustStoreCredit.mock.calls[0]);
  });

  it("pages store credit history for this contact and displays debit amounts", async () => {
    api.listStoreCredit.mockResolvedValue({
      data: [
        {
          storeCreditEntryId: "entry-2",
          contactId: props.contactId,
          direction: "DEBIT",
          kind: "MANUAL_ADJUSTMENT",
          amount: { amount: 500, currency: "BDT" },
          balanceAfterMinor: 1000,
          note: "সমন্বয়",
          createdAt: "2026-10-22T19:30:00Z",
        },
      ],
      meta: { total: 21 },
    });
    renderInBangla(<StoreCreditSection {...props} canAdjust={false} total={21} />);
    await userEvent.click(screen.getByRole("button", { name: labels.next }));
    await screen.findByText("সমন্বয়");
    expect(api.listStoreCredit).toHaveBeenCalledWith(props.organizationId, props.contactId, 2);
    expect(screen.getByText(/-৳/)).toBeTruthy();
    expect(screen.getByRole("button", { name: labels.previous })).toBeTruthy();
  });
});
