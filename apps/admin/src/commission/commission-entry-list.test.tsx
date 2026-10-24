// @vitest-environment jsdom
import type { CommissionEntryResponse } from "@banijjik/contracts/commission";
import { BUNDLED_CATALOGS, SCREEN_CATALOGS } from "@banijjik/i18n";
import { formatMoney } from "@banijjik/ui";
import { I18nProvider } from "@banijjik/web-client/client";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommissionEntryList } from "./commission-entry-list";

const MEMBER_ID = "01900000-0000-7000-8000-000000000001";
const LOCATION_ID = "01900000-0000-7000-8000-000000000002";
const RULE_ID = "01900000-0000-7000-8000-000000000003";
const MONEY = { amount: 12_500, currency: "BDT" as const };

const ENTRIES: CommissionEntryResponse[] = [
  {
    commissionEntryId: "01900000-0000-7000-8000-000000000010",
    memberId: MEMBER_ID,
    memberName: "Rahim",
    locationId: LOCATION_ID,
    sourceType: "BOOKING",
    sourceId: "01900000-0000-7000-8000-000000000020",
    sourceNumber: "BK-0001",
    sequence: 1,
    entryKind: "ACCRUAL",
    amount: MONEY,
    base: { amount: 125_000, currency: "BDT" },
    sourceGrossTotal: { amount: 125_000, currency: "BDT" },
    ruleSnapshot: {
      commissionRuleId: RULE_ID,
      subjectType: "MEMBER",
      targetType: "ALL",
      calculation: "PERCENT",
      percentBasisPoints: 1000,
      fixedAmount: null,
    },
    businessDate: "2026-10-20",
    payoutId: null,
    createdAt: "2026-10-20T10:00:00.000Z",
  },
  {
    commissionEntryId: "01900000-0000-7000-8000-000000000011",
    memberId: MEMBER_ID,
    memberName: "Rahim",
    locationId: LOCATION_ID,
    sourceType: "BOOKING",
    sourceId: "01900000-0000-7000-8000-000000000021",
    sourceNumber: null,
    sequence: 2,
    entryKind: "REFUND_ADJUSTMENT",
    amount: { amount: -5000, currency: "BDT" },
    base: { amount: -50_000, currency: "BDT" },
    sourceGrossTotal: { amount: 75_000, currency: "BDT" },
    ruleSnapshot: {
      commissionRuleId: RULE_ID,
      subjectType: "MEMBER",
      targetType: "ALL",
      calculation: "PERCENT",
      percentBasisPoints: 1000,
      fixedAmount: null,
    },
    businessDate: "2026-10-21",
    payoutId: "01900000-0000-7000-8000-000000000030",
    createdAt: "2026-10-21T10:00:00.000Z",
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

function renderList(entries: readonly CommissionEntryResponse[], showMember: boolean): void {
  render(
    <I18nProvider
      locale="en"
      catalog={{ ...BUNDLED_CATALOGS.en, ...SCREEN_CATALOGS.en }}
      brandName="Example"
    >
      <CommissionEntryList entries={entries} showMember={showMember} />
    </I18nProvider>,
  );
}

describe("CommissionEntryList", () => {
  it("shows each entry's member, amount, source, kind and open or paid state", () => {
    renderList(ENTRIES, true);
    const table = within(screen.getByRole("table"));

    expect(table.getAllByText("Rahim")).toHaveLength(2);
    expect(table.getByText("BK-0001")).toBeTruthy();
    expect(table.getByText(textOf("commission.source.BOOKING"))).toBeTruthy();
    expect(table.getByText(textOf("commission.entries.kind.ACCRUAL"))).toBeTruthy();
    expect(table.getByText(textOf("commission.entries.kind.REFUND_ADJUSTMENT"))).toBeTruthy();
    expect(table.getByText(textOf("commission.entries.status.open"))).toBeTruthy();
    expect(table.getByText(textOf("commission.entries.status.paid"))).toBeTruthy();
    expect(table.getByText(moneyPattern(MONEY.amount))).toBeTruthy();
  });

  it("leaves the member column out of My commission", () => {
    renderList(ENTRIES, false);

    expect(screen.queryByText("Rahim")).toBeNull();
  });

  it("shows the empty state when there is nothing for the filters", () => {
    renderList([], true);

    expect(screen.getByText(textOf("commission.entries.empty"))).toBeTruthy();
  });
});
