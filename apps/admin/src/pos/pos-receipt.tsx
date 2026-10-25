"use client";

import type { Money } from "@banijjik/contracts/payment";
import { Button, formatMoney, type DisplayLocale } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import type { PosLabels, PosReceiptLabels } from "./pos-labels";
import type { ReceiptModel } from "./receipt-model";
import { methodLabelOf } from "./pos-tender-editor";

export const RECEIPT_PAPER_WIDTHS_MM = [58, 80] as const;
export type ReceiptPaperWidthMm = (typeof RECEIPT_PAPER_WIDTHS_MM)[number];

/** Only digits reach the stylesheet: the width is one of the two constants above. */
function printPageRuleOf(paperWidthMm: ReceiptPaperWidthMm): string {
  return `@media print { @page { size: ${String(paperWidthMm)}mm auto; margin: 2mm; } }`;
}

export interface PosReceiptProps {
  readonly labels: PosLabels;
  readonly locale: DisplayLocale;
  readonly model: ReceiptModel;
  readonly onNewSale: () => void;
}

function moneyText(money: Money, locale: DisplayLocale): string {
  return formatMoney(money, { locale });
}

function ReceiptLines(props: {
  readonly model: ReceiptModel;
  readonly locale: DisplayLocale;
}): ReactElement {
  const { model, locale } = props;
  return (
    <ul className="flex flex-col gap-1">
      {model.lines.map((line, index) => (
        <li key={`${line.name}-${String(index)}`} className="flex justify-between gap-2">
          <span>{`${line.name} × ${String(line.quantity)}`}</span>
          <span>{moneyText(line.lineNetTotal, locale)}</span>
        </li>
      ))}
    </ul>
  );
}

function ReceiptTotals(props: {
  readonly model: ReceiptModel;
  readonly locale: DisplayLocale;
  readonly receiptLabels: PosReceiptLabels;
  readonly labels: PosLabels;
}): ReactElement {
  const { model, locale, receiptLabels, labels } = props;
  return (
    <div className="flex flex-col gap-1 border-t border-dashed border-current pt-2">
      {model.discountTotal.amount > 0 ? (
        <p className="flex justify-between">
          <span>{receiptLabels.discount}</span>
          <span>{moneyText(model.discountTotal, locale)}</span>
        </p>
      ) : null}
      <p className="flex justify-between font-bold">
        <span>{labels.total}</span>
        <span>{moneyText(model.grandTotal, locale)}</span>
      </p>
      {model.payments.map((payment, index) => (
        <p key={`${payment.method}-${String(index)}`} className="flex justify-between">
          <span>{methodLabelOf(labels.payLabels, payment.method)}</span>
          <span>{moneyText(payment.amount, locale)}</span>
        </p>
      ))}
      {model.changeDue.amount > 0 ? (
        <p className="flex justify-between">
          <span>{receiptLabels.change}</span>
          <span>{moneyText(model.changeDue, locale)}</span>
        </p>
      ) : null}
      {model.dueAmount.amount > 0 ? (
        <p className="flex justify-between">
          <span>{receiptLabels.due}</span>
          <span>{moneyText(model.dueAmount, locale)}</span>
        </p>
      ) : null}
    </div>
  );
}

/** The printed receipt: 58 or 80 mm wide. The controls hide when printing, the paper stays. */
export function PosReceipt(props: PosReceiptProps): ReactElement {
  const { labels, locale, model, onNewSale } = props;
  const receiptLabels = labels.receiptLabels;
  const [paperWidth, setPaperWidth] = useState<ReceiptPaperWidthMm>(80);
  return (
    <section className="flex flex-col items-center gap-4 p-4">
      <style dangerouslySetInnerHTML={{ __html: printPageRuleOf(paperWidth) }} />
      <div className="flex w-full max-w-md flex-wrap items-center gap-2 print:hidden">
        <Button className="min-h-14" onClick={() => window.print()}>
          {receiptLabels.print}
        </Button>
        {RECEIPT_PAPER_WIDTHS_MM.map((width) => (
          <Button
            key={width}
            variant="secondary"
            className="min-h-14"
            aria-pressed={paperWidth === width}
            onClick={() => setPaperWidth(width)}
          >
            {String(width)}
          </Button>
        ))}
        <Button variant="secondary" className="min-h-14" onClick={onNewSale}>
          {receiptLabels.newSale}
        </Button>
      </div>
      <article
        style={{ width: `${String(paperWidth)}mm` }}
        className="flex flex-col gap-2 bg-white p-2 font-mono text-xs text-black"
      >
        <h2 className="text-center text-sm font-bold">{receiptLabels.title}</h2>
        <p>{`${receiptLabels.number}: ${model.documentNumber}`}</p>
        <p>{`${receiptLabels.date}: ${model.businessDate}`}</p>
        <ReceiptLines model={model} locale={locale} />
        <ReceiptTotals
          model={model}
          locale={locale}
          receiptLabels={receiptLabels}
          labels={labels}
        />
        {model.footer ? <p className="pt-2 text-center">{model.footer}</p> : null}
      </article>
    </section>
  );
}
