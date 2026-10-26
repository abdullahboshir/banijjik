import {
  REPORT_SECTION,
  type ReportCounter,
  type ReportHomeResponse,
  type ReportPeriodValues,
  type ReportSection,
} from "@banijjik/contracts/report";
import { sumMethodTotals } from "./report-figures";

export type HomeRowKind = "money" | "count";

/** One line of a home card: its label key and how to read it from a period. */
interface HomeRowDefinition {
  readonly labelKey: string;
  readonly kind: HomeRowKind;
  readonly read: (values: ReportPeriodValues) => number;
}

export interface HomeCardRow {
  readonly labelKey: string;
  readonly kind: HomeRowKind;
  readonly today: number;
  readonly yesterday: number;
  readonly monthToDate: number;
}

export interface HomeCard {
  readonly section: ReportSection;
  readonly titleKey: string;
  readonly rows: readonly HomeCardRow[];
}

function counterReader(counter: ReportCounter): (values: ReportPeriodValues) => number {
  return (values: ReportPeriodValues): number => values.counters[counter];
}

const ROWS_BY_SECTION: Readonly<Record<ReportSection, readonly HomeRowDefinition[]>> = {
  [REPORT_SECTION.SALES]: [
    {
      labelKey: "report.home.sales.netAfterReturns",
      kind: "money",
      read: (values) => values.derived.netSalesAfterReturns,
    },
    { labelKey: "report.home.sales.orders", kind: "count", read: counterReader("ordersCompleted") },
    {
      labelKey: "report.home.sales.averageOrder",
      kind: "money",
      read: (values) => values.derived.averageOrderValue,
    },
  ],
  [REPORT_SECTION.BOOKINGS]: [
    {
      labelKey: "report.home.bookings.completed",
      kind: "count",
      read: counterReader("bookingsCompleted"),
    },
    {
      labelKey: "report.home.bookings.noShows",
      kind: "count",
      read: counterReader("bookingsNoShow"),
    },
    {
      labelKey: "report.home.bookings.cancelled",
      kind: "count",
      read: counterReader("bookingsCancelled"),
    },
  ],
  [REPORT_SECTION.ENROLLMENTS]: [
    {
      labelKey: "report.home.enrollments.created",
      kind: "count",
      read: counterReader("enrollmentsCreated"),
    },
    {
      labelKey: "report.home.enrollments.activated",
      kind: "count",
      read: counterReader("enrollmentsActivated"),
    },
    {
      labelKey: "report.home.enrollments.cancelled",
      kind: "count",
      read: counterReader("enrollmentsCancelled"),
    },
    {
      labelKey: "report.home.enrollments.checkIns",
      kind: "count",
      read: counterReader("checkIns"),
    },
  ],
  [REPORT_SECTION.MONEY]: [
    {
      labelKey: "report.home.money.in",
      kind: "money",
      read: (values) => sumMethodTotals(values.paidInByMethod),
    },
    {
      labelKey: "report.home.money.refunds",
      kind: "money",
      read: (values) => sumMethodTotals(values.refundedByMethod),
    },
    {
      labelKey: "report.home.money.reversals",
      kind: "money",
      read: (values) => sumMethodTotals(values.reversedByMethod),
    },
    { labelKey: "report.home.money.expenses", kind: "money", read: counterReader("expensesTotal") },
    {
      labelKey: "report.home.money.net",
      kind: "money",
      read: (values) => values.derived.moneyInNet,
    },
  ],
};

const TITLE_KEY_BY_SECTION: Readonly<Record<ReportSection, string>> = {
  [REPORT_SECTION.SALES]: "report.home.sales.title",
  [REPORT_SECTION.BOOKINGS]: "report.home.bookings.title",
  [REPORT_SECTION.ENROLLMENTS]: "report.home.enrollments.title",
  [REPORT_SECTION.MONEY]: "report.home.money.title",
};

function cardRowOf(definition: HomeRowDefinition, home: ReportHomeResponse): HomeCardRow {
  return {
    labelKey: definition.labelKey,
    kind: definition.kind,
    today: definition.read(home.periods.today),
    yesterday: definition.read(home.periods.yesterday),
    monthToDate: definition.read(home.periods.monthToDate),
  };
}

/**
 * One card per section the API returns, in the API's order. The screen never decides by industry or
 * module: a section the API leaves out has no card (plan 3.10 decision 8).
 */
export function buildHomeCards(home: ReportHomeResponse): readonly HomeCard[] {
  return home.sections.map((section) => ({
    section,
    titleKey: TITLE_KEY_BY_SECTION[section],
    rows: ROWS_BY_SECTION[section].map((definition) => cardRowOf(definition, home)),
  }));
}

/** True when no card of the home has any figure yet: a new business sees the empty note, not zeros. */
export function isHomeWithoutActivity(cards: readonly HomeCard[]): boolean {
  return cards.every((card) =>
    card.rows.every((row) => row.today === 0 && row.yesterday === 0 && row.monthToDate === 0),
  );
}
