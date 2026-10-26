import {
  REPORT_COUNTER,
  REPORT_SECTION,
  type ReportCounter,
  type ReportHomeResponse,
  type ReportPeriodValues,
} from "@banijjik/contracts/report";
import { describe, expect, it } from "vitest";
import { buildHomeCards, isHomeWithoutActivity } from "./report-home-cards";

function emptyCounters(
  overrides: Partial<Record<ReportCounter, number>>,
): ReportPeriodValues["counters"] {
  const counters = {} as Record<ReportCounter, number>;
  for (const counter of Object.values(REPORT_COUNTER)) counters[counter] = overrides[counter] ?? 0;
  return counters;
}

function period(
  overrides: Partial<Record<ReportCounter, number>>,
  netAfterReturns = 0,
): ReportPeriodValues {
  return {
    counters: emptyCounters(overrides),
    paidInByMethod: { CASH: netAfterReturns },
    refundedByMethod: {},
    reversedByMethod: {},
    derived: {
      netSalesAfterReturns: netAfterReturns,
      averageOrderValue: 0,
      moneyInNet: netAfterReturns,
    },
  };
}

function homeWith(
  sections: ReportHomeResponse["sections"],
  today: ReportPeriodValues,
): ReportHomeResponse {
  return {
    businessDate: "2026-10-26",
    yesterdayDate: "2026-10-25",
    currency: "BDT",
    sections,
    periods: { today, yesterday: period({}), monthToDate: period({}) },
  };
}

describe("buildHomeCards", () => {
  it("shows a card only for the sections the API returns", () => {
    const cards = buildHomeCards(
      homeWith([REPORT_SECTION.SALES, REPORT_SECTION.MONEY], period({})),
    );
    expect(cards.map((card) => card.section)).toEqual([REPORT_SECTION.SALES, REPORT_SECTION.MONEY]);
  });

  it("shows no card for a section the API leaves out, whatever the figures are", () => {
    const cards = buildHomeCards(
      homeWith([REPORT_SECTION.SALES], period({ bookingsCompleted: 4 })),
    );
    expect(cards.some((card) => card.section === REPORT_SECTION.BOOKINGS)).toBe(false);
  });

  it("gives every row today, yesterday and month-to-date values side by side", () => {
    const home = homeWith([REPORT_SECTION.SALES], period({ ordersCompleted: 3 }));
    const [salesCard] = buildHomeCards(home);
    const ordersRow = salesCard?.rows.find((row) => row.labelKey === "report.home.sales.orders");
    expect(ordersRow).toEqual({
      labelKey: "report.home.sales.orders",
      kind: "count",
      today: 3,
      yesterday: 0,
      monthToDate: 0,
    });
  });

  it("reads the net sales row from the derived value, after returns", () => {
    const today = period({ netSales: 1000, returnsValue: 200 }, 800);
    const [salesCard] = buildHomeCards(homeWith([REPORT_SECTION.SALES], today));
    expect(salesCard?.rows[0]?.today).toBe(800);
  });
});

describe("isHomeWithoutActivity", () => {
  it("is true for a new business with no figures in any period", () => {
    const cards = buildHomeCards(
      homeWith([REPORT_SECTION.SALES, REPORT_SECTION.BOOKINGS], period({})),
    );
    expect(isHomeWithoutActivity(cards)).toBe(true);
  });

  it("is false once any card has a figure in any period", () => {
    const cards = buildHomeCards(homeWith([REPORT_SECTION.SALES], period({ ordersCompleted: 1 })));
    expect(isHomeWithoutActivity(cards)).toBe(false);
  });
});
