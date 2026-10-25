"use client";

import type { Money } from "@banijjik/contracts/payment";
import type { PosZReport } from "@banijjik/contracts/pos";
import { Button, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { PosLabels, PosZReportLabels } from "./pos-labels";
import { methodLabelOf } from "./pos-tender-editor";
import { printPageRuleOf, RECEIPT_PAPER_WIDTHS_MM, type ReceiptPaperWidthMm } from "./pos-receipt";
import { buildZReportModel, type ZReportGroup, type ZReportModel } from "./z-report-model";

export interface PosZReportViewProps {
  readonly report: PosZReport;
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
  readonly onDone: () => void;
}

function moneyText(money: Money, locale: DisplayLocale): string {
  return formatMoney(money, { locale });
}

/** The stored instant is UTC; the printed Z-report shows it in the till locale. */
function dateTimeText(isoText: string, locale: DisplayLocale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(isoText),
  );
}

function ZLine(props: {
  readonly label: string;
  readonly value: string;
  readonly strong?: boolean;
}): ReactElement {
  const { label, value, strong = false } = props;
  return (
    <p className={`flex justify-between gap-2 ${strong ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </p>
  );
}

/** One group of method rows, such as "received by method"; an empty group prints nothing. */
function ZMethodGroup(props: {
  readonly title: string;
  readonly group: ZReportGroup;
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
}): ReactElement | null {
  const { title, group, labels, locale } = props;
  if (group.rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-1 border-t border-dashed border-current pt-2">
      <h3 className="font-bold">{title}</h3>
      {group.rows.map((row, index) => (
        <ZLine
          key={`${row.method}-${String(index)}`}
          label={`${methodLabelOf(labels.payLabels, row.method)} × ${String(row.count)}`}
          value={moneyText(row.total, locale)}
        />
      ))}
    </section>
  );
}

function ZSalesSection(props: {
  readonly model: ZReportModel;
  readonly z: PosZReportLabels;
  readonly locale: DisplayLocale;
}): ReactElement {
  const { model, z, locale } = props;
  return (
    <section className="flex flex-col gap-1 border-t border-dashed border-current pt-2">
      <ZLine label={z.sales} value={String(model.salesCount)} />
      <ZLine label={z.gross} value={moneyText(model.salesGross, locale)} />
      <ZLine label={z.discount} value={moneyText(model.salesDiscount, locale)} />
      <ZLine label={z.tax} value={moneyText(model.salesTax, locale)} />
      <ZLine label={z.grandTotal} value={moneyText(model.salesGrandTotal, locale)} strong />
    </section>
  );
}

function ZCashSection(props: {
  readonly model: ZReportModel;
  readonly z: PosZReportLabels;
  readonly locale: DisplayLocale;
}): ReactElement {
  const { model, z, locale } = props;
  return (
    <section className="flex flex-col gap-1 border-t border-dashed border-current pt-2">
      <ZLine label={z.openingFloat} value={moneyText(model.openingFloat, locale)} />
      <ZLine label={z.expectedCash} value={moneyText(model.expectedCash, locale)} />
      <ZLine label={z.countedCash} value={moneyText(model.countedCash, locale)} />
      <ZLine label={z.variance} value={moneyText(model.variance, locale)} strong />
    </section>
  );
}

function ZReturnsSection(props: {
  readonly model: ZReportModel;
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
}): ReactElement {
  const { model, labels, locale } = props;
  const z = labels.zReportLabels;
  return (
    <section className="flex flex-col gap-1 border-t border-dashed border-current pt-2">
      <ZLine label={z.returns} value={String(model.returnsCount)} />
      <ZLine label={z.returnsValue} value={moneyText(model.returnsValue, locale)} />
      <ZMethodGroup
        title={z.returnsRefunded}
        group={model.returnsRefundedByMethod}
        labels={labels}
        locale={locale}
      />
    </section>
  );
}

/** Print, paper width and done. The controls hide when printing; the paper stays. */
function ZReportControls(props: {
  readonly labels: PosZReportLabels;
  readonly paperWidth: ReceiptPaperWidthMm;
  readonly onPaperWidth: (width: ReceiptPaperWidthMm) => void;
  readonly onDone: () => void;
}): ReactElement {
  const { labels, paperWidth, onPaperWidth, onDone } = props;
  return (
    <div className="flex w-full max-w-md flex-wrap items-center gap-2 print:hidden">
      <Button className="min-h-14" onClick={() => window.print()}>
        {labels.print}
      </Button>
      {RECEIPT_PAPER_WIDTHS_MM.map((width) => (
        <Button
          key={width}
          variant="secondary"
          className="min-h-14"
          aria-pressed={paperWidth === width}
          onClick={() => onPaperWidth(width)}
        >
          {String(width)}
        </Button>
      ))}
      <Button variant="secondary" className="min-h-14" onClick={onDone}>
        {labels.done}
      </Button>
    </div>
  );
}

/** The printed Z-report, 58 or 80 mm. Every number is the server's frozen report. */
export function PosZReportView(props: PosZReportViewProps): ReactElement {
  const { report, labels, locale, onDone } = props;
  const model = buildZReportModel(report);
  const z = labels.zReportLabels;
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidthMm>(80);
  return (
    <section className="flex flex-col items-center gap-4 p-4">
      <style dangerouslySetInnerHTML={{ __html: printPageRuleOf(paperWidth) }} />
      <ZReportControls
        labels={z}
        paperWidth={paperWidth}
        onPaperWidth={setPaperWidth}
        onDone={onDone}
      />
      <article
        style={{ width: `${String(paperWidth)}mm` }}
        className="flex flex-col gap-2 bg-white p-2 font-mono text-xs text-black"
      >
        <h2 className="text-center text-sm font-bold">{z.title}</h2>
        <p>{`${z.number}: ${model.zReportNumber}`}</p>
        <p>{`${z.opened}: ${dateTimeText(model.openedAt, locale)}`}</p>
        <p>{`${z.closed}: ${dateTimeText(model.closedAt, locale)}`}</p>
        <ZSalesSection model={model} z={z} locale={locale} />
        <ZMethodGroup
          title={z.received}
          group={model.receivedByMethod}
          labels={labels}
          locale={locale}
        />
        <ZMethodGroup
          title={z.collected}
          group={model.collectedByMethod}
          labels={labels}
          locale={locale}
        />
        <ZMethodGroup
          title={z.refunded}
          group={model.refundedByMethod}
          labels={labels}
          locale={locale}
        />
        <ZReturnsSection model={model} labels={labels} locale={locale} />
        <section className="flex flex-col gap-1 border-t border-dashed border-current pt-2">
          <ZLine label={z.storeCreditUsed} value={moneyText(model.storeCreditUsed, locale)} />
          <ZLine label={z.duesCreated} value={moneyText(model.duesCreated, locale)} />
        </section>
        <ZCashSection model={model} z={z} locale={locale} />
      </article>
    </section>
  );
}
