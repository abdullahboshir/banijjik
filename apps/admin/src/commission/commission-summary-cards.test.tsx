// @vitest-environment jsdom
import type { CommissionMemberSummaryResponse } from "@banijjik/contracts/commission";
import { BUNDLED_CATALOGS, SCREEN_CATALOGS } from "@banijjik/i18n";
import { formatMoney } from "@banijjik/ui";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommissionSummaryCards } from "./commission-summary-cards";

const OPEN = { amount: 125_000, currency: "BDT" as const };
const PAID = { amount: 50_000, currency: "BDT" as const };

const ROWS: CommissionMemberSummaryResponse[] = [
  { memberId: "member-1", memberName: "Rahim", open: OPEN, paidTotal: PAID },
  {
    memberId: "member-2",
    memberName: "Karim",
    open: { amount: 0, currency: "BDT" },
    paidTotal: PAID,
  },
];

function textOf(messageKey: string): string {
  const text = SCREEN_CATALOGS.en[messageKey] ?? BUNDLED_CATALOGS.en[messageKey];
  if (text === undefined) throw new Error(`Missing English message ${messageKey}`);
  return text;
}

/** The money text as a pattern: the formatter inserts a thin space after the symbol. */
function moneyPattern(amount: number): RegExp {
  const escaped = formatMoney({ amount, currency: "BDT" }, { locale: "en" })
    .replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
    .replace(/\s/gu, "\\s*");
  return new RegExp(`^${escaped}$`, "u");
}

function renderCards(
  rows: readonly CommissionMemberSummaryResponse[],
  onPay?: (memberId: string) => void,
): void {
  render(
    <I18nProvider
      locale="en"
      catalog={{ ...BUNDLED_CATALOGS.en, ...SCREEN_CATALOGS.en }}
      brandName="Example"
    >
      <CommissionSummaryCards rows={rows} onPay={onPay} />
    </I18nProvider>,
  );
}

describe("CommissionSummaryCards", () => {
  it("shows every member's open and paid totals", () => {
    renderCards(ROWS);

    expect(screen.getByText("Rahim")).toBeTruthy();
    expect(screen.getByText("Karim")).toBeTruthy();
    expect(screen.getAllByText(textOf("commission.summary.open"))).toHaveLength(2);
    expect(screen.getAllByText(textOf("commission.summary.paid"))).toHaveLength(2);
    expect(screen.getAllByText(moneyPattern(PAID.amount))).toHaveLength(2);
    expect(screen.getByText(moneyPattern(OPEN.amount))).toBeTruthy();
  });

  it("offers a payout only where something is open", async () => {
    const onPay = vi.fn();
    renderCards(ROWS, onPay);

    const payButtons = screen.getAllByRole("button", {
      name: textOf("commission.payouts.pay"),
    });
    expect(payButtons).toHaveLength(1);
    await userEvent.click(payButtons[0] as HTMLElement);
    expect(onPay).toHaveBeenCalledWith("member-1");
  });

  it("says so when nothing has accrued", () => {
    renderCards([]);

    expect(screen.getByText(textOf("commission.summary.empty"))).toBeTruthy();
  });
});
