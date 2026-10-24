// @vitest-environment jsdom
import { ERROR_CODE } from "@banijjik/contracts";
import { COMMISSION_API_MESSAGE_KEYS } from "@banijjik/contracts/commission";
import { BUNDLED_CATALOGS, SCREEN_CATALOGS } from "@banijjik/i18n";
import { formatMoney } from "@banijjik/ui";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api/api-error";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const previewCommissionPayout = vi.fn();
const createCommissionPayout = vi.fn();
vi.mock("./commission-api", () => ({
  previewCommissionPayout: (...args: unknown[]) => previewCommissionPayout(...args),
  createCommissionPayout: (...args: unknown[]) => createCommissionPayout(...args),
}));

const { CommissionPaySheet } = await import("./commission-pay-sheet");

const MEMBER_ID = "01900000-0000-7000-8000-000000000001";
const LOCATION_ID = "01900000-0000-7000-8000-000000000002";
const UP_TO = "2026-10-24";

function textOf(messageKey: string): string {
  const text = SCREEN_CATALOGS.en[messageKey] ?? BUNDLED_CATALOGS.en[messageKey];
  if (text === undefined) throw new Error(`Missing English message ${messageKey}`);
  return text;
}

function labelOf(messageKey: string): RegExp {
  return new RegExp(`^${textOf(messageKey).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "u");
}

function renderSheet(onClose = vi.fn()): () => void {
  render(
    <I18nProvider
      locale="en"
      catalog={{ ...BUNDLED_CATALOGS.en, ...SCREEN_CATALOGS.en }}
      brandName="Example"
    >
      <CommissionPaySheet
        organizationId="org-1"
        currency="BDT"
        members={[{ memberId: MEMBER_ID, name: "Rahim" }]}
        locations={[{ locationId: LOCATION_ID, name: "Main shop" }]}
        defaultMemberId={MEMBER_ID}
        defaultUpTo={UP_TO}
        onClose={onClose}
      />
    </I18nProvider>,
  );
  return onClose;
}

async function previewThenChooseReference(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: textOf("commission.pay.preview") }));
  await userEvent.selectOptions(screen.getByLabelText(labelOf("commission.pay.method")), "BKASH");
  await userEvent.type(screen.getByLabelText(labelOf("commission.pay.reference")), "TXN-1");
}

async function waitForPreviewed(): Promise<void> {
  await waitFor(() => expect(previewCommissionPayout).toHaveBeenCalled());
  const entryCount = textOf("commission.pay.entryCount").replace("{count}", "3");
  await waitFor(() => expect(screen.getByText(new RegExp(entryCount, "u"))).toBeTruthy());
}

beforeEach(() => {
  previewCommissionPayout.mockReset();
  createCommissionPayout.mockReset();
  refresh.mockReset();
});

describe("CommissionPaySheet", () => {
  it("previews, then pays the previewed total with method and reference", async () => {
    previewCommissionPayout.mockResolvedValue({
      entryCount: 3,
      total: { amount: 125_000, currency: "BDT" },
    });
    createCommissionPayout.mockResolvedValue({});
    const onClose = renderSheet();

    await previewThenChooseReference();
    await waitForPreviewed();
    await userEvent.click(screen.getByRole("button", { name: textOf("commission.pay.confirm") }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(previewCommissionPayout).toHaveBeenCalledWith("org-1", {
      memberId: MEMBER_ID,
      location: LOCATION_ID,
      upTo: UP_TO,
    });
    expect(createCommissionPayout.mock.calls[0]?.[1]).toEqual({
      memberId: MEMBER_ID,
      locationId: LOCATION_ID,
      upToBusinessDate: UP_TO,
      expectedTotal: { amount: 125_000, currency: "BDT" },
      method: "BKASH",
      externalReference: "TXN-1",
    });
    expect(typeof createCommissionPayout.mock.calls[0]?.[2]).toBe("string");
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a changed total and pays only after a second confirmation", async () => {
    previewCommissionPayout.mockResolvedValue({
      entryCount: 3,
      total: { amount: 125_000, currency: "BDT" },
    });
    const changed = { amount: 130_000, currency: "BDT" as const };
    createCommissionPayout
      .mockRejectedValueOnce(
        new ApiError({
          status: 409,
          code: ERROR_CODE.CONFLICT,
          messageKey: COMMISSION_API_MESSAGE_KEYS.payoutTotalChanged,
          details: { total: changed },
        }),
      )
      .mockResolvedValueOnce({});
    const onClose = renderSheet();

    await previewThenChooseReference();
    await waitForPreviewed();
    await userEvent.click(screen.getByRole("button", { name: textOf("commission.pay.confirm") }));

    const changedAlert = await screen.findByText(/The total has changed to/u);
    expect(changedAlert.textContent?.replace(/\s/gu, "")).toContain(
      formatMoney(changed, { locale: "en" }).replace(/\s/gu, ""),
    );
    expect(createCommissionPayout).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: textOf("commission.pay.confirm") }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(createCommissionPayout).toHaveBeenCalledTimes(2);
    expect(createCommissionPayout.mock.calls[1]?.[1]).toMatchObject({
      expectedTotal: changed,
    });
  });
});
