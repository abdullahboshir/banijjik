import { PERMISSION_KEY, type LocationResponse } from "@banijjik/contracts";
import type { Translator } from "@banijjik/i18n";
import { EmptyState, PageLayout } from "@banijjik/ui";
import type { ReactElement } from "react";
import { getTranslator } from "../lib/i18n/get-translator";
import { requireOrgAccess, type OrgAccess } from "../shell/org-access";
import { holdsPermission } from "../shell/permissions";
import { ReportBarChart, type ReportBar } from "./report-bar-chart";
import { ReportCsvButton } from "./report-csv-button";
import { ReportDailyFilter } from "./report-daily-filter";
import { ReportDailyTable } from "./report-daily-table";
import {
  dayFiguresOf,
  figuresOf,
  netAfterReturnsBars,
  type ReportDayFigures,
  type ReportFigures,
} from "./report-figures";
import { moneyText } from "./report-format";
import { businessTodayIn } from "./report-dates";
import { showsLocationFilter } from "./report-locations";
import { parseReportRangeQuery, type ReportRangeQuery } from "./report-query";
import { loadDailyReport, loadReportLocations } from "./report-server-data";

type RawParams = Record<string, string | string[] | undefined>;
type Translate = Translator["t"];

/** The CSV columns after the date, in the order of the table. Money is in minor units (see the handoff). */
const CSV_COLUMN_KEYS = [
  "report.page.column.orders",
  "report.page.column.netAfterReturns",
  "report.page.column.bookings",
  "report.page.column.moneyIn",
  "report.page.column.refunds",
  "report.page.column.expenses",
  "report.page.column.net",
] as const;

function csvRowsOf(days: readonly ReportDayFigures[]): (string | number)[][] {
  return days.map((day) => [
    day.businessDate,
    day.orders,
    day.netAfterReturns,
    day.bookingsCompleted,
    day.moneyIn,
    day.refunds,
    day.expenses,
    day.netMoney,
  ]);
}

function csvHeaderOf(t: Translate): string[] {
  return [t("report.page.column.date"), ...CSV_COLUMN_KEYS.map((key) => t(key))];
}

function chartBarsOf(
  days: readonly ReportDayFigures[],
  currency: string,
  locale: Translator["locale"],
): ReportBar[] {
  return netAfterReturnsBars(days).map((bar) => ({
    ...bar,
    valueText: moneyText(bar.value, currency, locale),
  }));
}

function ReportChart(props: {
  days: readonly ReportDayFigures[];
  currency: string;
  locale: Translator["locale"];
  t: Translate;
}): ReactElement | null {
  const { days, currency, locale, t } = props;
  if (days.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-default bg-surface p-4">
      <h2 className="text-subtitle font-semibold text-primary">{t("report.page.chart")}</h2>
      <ReportBarChart bars={chartBarsOf(days, currency, locale)} title={t("report.page.chart")} />
    </section>
  );
}

interface ReportPageData {
  readonly days: ReportDayFigures[];
  readonly totals: ReportFigures;
  readonly currency: string;
  readonly locations: readonly LocationResponse[];
}

async function loadPageData(access: OrgAccess, query: ReportRangeQuery): Promise<ReportPageData> {
  const [report, locations] = await Promise.all([
    loadDailyReport(access, query),
    loadReportLocations(access),
  ]);
  return {
    days: report.items.map(dayFiguresOf),
    totals: figuresOf(report.totals),
    currency: report.currency,
    locations,
  };
}

/** `/{orgSlug}/reports`: the days of a range (default the last 7 days), totals, one bar chart and a CSV. */
export async function ReportDailyPage(props: {
  orgSlug: string;
  searchParams: RawParams;
}): Promise<ReactElement> {
  const [translator, access] = await Promise.all([
    getTranslator(),
    requireOrgAccess(props.orgSlug),
  ]);
  const { t, locale } = translator;
  if (!holdsPermission(access.config.permissions, PERMISSION_KEY.REPORT_DAILY_READ)) {
    return <EmptyState kind="noPermission" message={t("state.permissionDenied")} />;
  }
  const query = parseReportRangeQuery(props.searchParams, businessTodayIn(access.timeZone));
  const { days, totals, currency, locations } = await loadPageData(access, query);
  const showsLocation = showsLocationFilter(
    access.config.permissions,
    PERMISSION_KEY.REPORT_DAILY_READ,
    locations,
  );
  return (
    <PageLayout
      title={t("report.page.title")}
      subtitle={t("report.page.subtitle")}
      filters={
        <ReportDailyFilter
          query={query}
          locations={locations}
          showsLocation={showsLocation}
          t={t}
        />
      }
      actions={
        days.length > 0 ? (
          <ReportCsvButton
            label={t("report.page.csv")}
            fileName={`report-${query.from}-${query.to}.csv`}
            header={csvHeaderOf(t)}
            rows={csvRowsOf(days)}
          />
        ) : null
      }
    >
      <ReportDailyTable
        days={days}
        totals={totals}
        currency={currency}
        locale={locale}
        t={t}
        emptyText={t("report.page.empty")}
      />
      <ReportChart days={days} currency={currency} locale={locale} t={t} />
    </PageLayout>
  );
}
