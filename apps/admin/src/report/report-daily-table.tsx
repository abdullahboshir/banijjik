import type { Translator } from "@banijjik/i18n";
import type { ReactElement } from "react";
import { figureText } from "./report-format";
import type { HomeRowKind } from "./report-home-cards";
import type { ReportDayFigures, ReportFigures } from "./report-figures";

type Locale = Translator["locale"];
type Translate = Translator["t"];

/** The figure columns after the date, in the order of the CSV too. */
const FIGURE_COLUMNS: readonly {
  readonly key: keyof ReportFigures;
  readonly labelKey: string;
  readonly kind: HomeRowKind;
}[] = [
  { key: "orders", labelKey: "report.page.column.orders", kind: "count" },
  { key: "netAfterReturns", labelKey: "report.page.column.netAfterReturns", kind: "money" },
  { key: "bookingsCompleted", labelKey: "report.page.column.bookings", kind: "count" },
  { key: "moneyIn", labelKey: "report.page.column.moneyIn", kind: "money" },
  { key: "refunds", labelKey: "report.page.column.refunds", kind: "money" },
  { key: "expenses", labelKey: "report.page.column.expenses", kind: "money" },
  { key: "netMoney", labelKey: "report.page.column.net", kind: "money" },
];

interface TableContext {
  currency: string;
  locale: Locale;
  t: Translate;
}

function figureCellText(
  column: (typeof FIGURE_COLUMNS)[number],
  figures: ReportFigures,
  context: TableContext,
): string {
  return figureText(column.kind, figures[column.key], {
    currency: context.currency,
    locale: context.locale,
  });
}

function DayTableRow(props: { figures: ReportDayFigures; context: TableContext }): ReactElement {
  const { figures, context } = props;
  return (
    <tr className="border-t border-default">
      <th scope="row" className="px-3 py-2 text-left font-medium text-primary">
        {figures.businessDate}
      </th>
      {FIGURE_COLUMNS.map((column) => (
        <td key={column.key} className="px-3 py-2 text-right tabular-nums">
          {figureCellText(column, figures, context)}
        </td>
      ))}
    </tr>
  );
}

function TableHead({ t }: { t: Translate }): ReactElement {
  return (
    <thead className="bg-subtle text-small text-secondary">
      <tr>
        <th scope="col" className="px-3 py-2 text-left font-medium">
          {t("report.page.column.date")}
        </th>
        {FIGURE_COLUMNS.map((column) => (
          <th key={column.key} scope="col" className="px-3 py-2 text-right font-medium">
            {t(column.labelKey)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function DayCard(props: { figures: ReportDayFigures; context: TableContext }): ReactElement {
  const { figures, context } = props;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-default bg-surface p-4">
      <h3 className="text-body font-semibold text-primary">{figures.businessDate}</h3>
      <FigureList figures={figures} context={context} />
    </li>
  );
}

function FigureList(props: { figures: ReportFigures; context: TableContext }): ReactElement {
  const { figures, context } = props;
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-small">
      {FIGURE_COLUMNS.map((column) => (
        <div key={column.key} className="flex flex-col">
          <dt className="text-secondary">{context.t(column.labelKey)}</dt>
          <dd className="font-medium tabular-nums text-primary">
            {figureCellText(column, figures, context)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The days of the range: a table from md, one card per day below md (no sideways scroll on a phone).
 * The totals close both views, so the sum is read the same way on any width.
 */
export function ReportDailyTable(props: {
  days: readonly ReportDayFigures[];
  totals: ReportFigures;
  currency: string;
  locale: Locale;
  t: Translate;
  emptyText: string;
}): ReactElement {
  const { days, totals, currency, locale, t, emptyText } = props;
  const context: TableContext = { currency, locale, t };
  if (days.length === 0) return <p className="text-body text-secondary">{emptyText}</p>;
  return (
    <div className="flex flex-col gap-4">
      <div className="hidden overflow-hidden rounded-lg border border-default md:block">
        <table className="w-full border-collapse text-body">
          <TableHead t={t} />
          <tbody>
            {days.map((figures) => (
              <DayTableRow key={figures.businessDate} figures={figures} context={context} />
            ))}
          </tbody>
          <tfoot className="border-t-2 border-default bg-subtle font-semibold">
            <tr>
              <th scope="row" className="px-3 py-2 text-left">
                {t("report.page.totals")}
              </th>
              {FIGURE_COLUMNS.map((column) => (
                <td key={column.key} className="px-3 py-2 text-right tabular-nums">
                  {figureCellText(column, totals, context)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {days.map((figures) => (
          <DayCard key={figures.businessDate} figures={figures} context={context} />
        ))}
        <li className="flex flex-col gap-2 rounded-lg border-2 border-default bg-subtle p-4">
          <h3 className="text-body font-semibold text-primary">{t("report.page.totals")}</h3>
          <FigureList figures={totals} context={context} />
        </li>
      </ul>
    </div>
  );
}
