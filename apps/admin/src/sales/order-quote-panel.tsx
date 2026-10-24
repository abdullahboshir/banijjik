"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { ManualDiscount, QuoteResponse } from "@banijjik/contracts/pricing";
import type { OrderLineInputBody } from "@banijjik/validation/sales";
import { formatMoney, type DisplayLocale } from "@banijjik/ui";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { quoteOrder } from "./order-api";
import type { OrderQuoteLabels } from "./order-labels";
import { quoteLinesOf } from "./order-lines";

const QUOTE_DELAY_MS = 300;

export interface OrderQuotePanelProps {
  readonly organizationId: string;
  readonly locationId: string;
  readonly lines: readonly OrderLineInputBody[];
  readonly orderDiscount: ManualDiscount | undefined;
  readonly currency: CurrencyCode;
  readonly locale: DisplayLocale;
  readonly labels: OrderQuoteLabels;
  /** The latest quote, or undefined while empty or failed; the caller reads the approval amount here. */
  readonly onQuote: (quote: QuoteResponse | undefined) => void;
}

interface QuoteState {
  readonly quote: QuoteResponse | undefined;
  readonly isCalculating: boolean;
  readonly hasError: boolean;
}

function useOrderQuote(props: OrderQuotePanelProps): QuoteState {
  const [state, setState] = useState<QuoteState>({
    quote: undefined,
    isCalculating: false,
    hasError: false,
  });
  const onQuoteRef = useRef(props.onQuote);
  onQuoteRef.current = props.onQuote;
  const linesKey = JSON.stringify(props.lines);
  const discountKey = JSON.stringify(props.orderDiscount ?? null);

  useEffect(() => {
    const lines = JSON.parse(linesKey) as OrderLineInputBody[];
    const orderDiscount = JSON.parse(discountKey) as ManualDiscount | null;
    if (lines.length === 0) {
      setState({ quote: undefined, isCalculating: false, hasError: false });
      onQuoteRef.current(undefined);
      return undefined;
    }
    let isCurrent = true;
    setState((previous) => ({ ...previous, isCalculating: true, hasError: false }));
    const timer = window.setTimeout(() => {
      async function run(): Promise<void> {
        try {
          const quote = await quoteOrder(props.organizationId, {
            locationId: props.locationId,
            lines: quoteLinesOf(lines),
            ...(orderDiscount === null ? {} : { orderDiscount }),
          });
          if (!isCurrent) return;
          setState({ quote, isCalculating: false, hasError: false });
          onQuoteRef.current(quote);
        } catch {
          if (!isCurrent) return;
          setState({ quote: undefined, isCalculating: false, hasError: true });
          onQuoteRef.current(undefined);
        }
      }
      void run();
    }, QUOTE_DELAY_MS);
    return () => {
      isCurrent = false;
      window.clearTimeout(timer);
    };
  }, [linesKey, discountKey, props.locationId, props.organizationId]);

  return state;
}

function QuoteRow(props: {
  readonly label: string;
  readonly amount: { amount: number; currency: CurrencyCode };
  readonly locale: DisplayLocale;
  readonly strong?: boolean;
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={props.strong ? "text-body font-semibold" : "text-body text-secondary"}>
        {props.label}
      </span>
      <span className={props.strong ? "font-money font-semibold" : "font-money"}>
        {formatMoney(props.amount, { locale: props.locale })}
      </span>
    </div>
  );
}

/** The live totals of the quoter: the screen never adds money itself (ADR-013, ADR-131). */
export function OrderQuotePanel(props: OrderQuotePanelProps): ReactElement {
  const state = useOrderQuote(props);
  const { labels } = props;

  if (state.hasError) {
    return (
      <section className="rounded-lg border border-danger/40 bg-surface p-4" aria-live="polite">
        <p className="text-body text-danger">{labels.failed}</p>
      </section>
    );
  }
  if (props.lines.length === 0) return <></>;
  if (state.quote === undefined) {
    return (
      <section className="rounded-lg border border-default bg-surface p-4" aria-live="polite">
        <p className="text-body text-secondary">{labels.calculating}</p>
      </section>
    );
  }

  const { totals } = state.quote;
  return (
    <section
      className="flex flex-col gap-3 rounded-lg border border-default bg-surface p-4"
      aria-live="polite"
    >
      <h2 className="text-title font-semibold text-primary">{labels.title}</h2>
      <QuoteRow label={labels.subtotal} amount={totals.subtotal} locale={props.locale} />
      {totals.discountTotal.amount > 0 ? (
        <QuoteRow label={labels.discount} amount={totals.discountTotal} locale={props.locale} />
      ) : null}
      <QuoteRow label={labels.tax} amount={totals.taxTotal} locale={props.locale} />
      {totals.roundingAdjustment.amount !== 0 ? (
        <QuoteRow
          label={labels.rounding}
          amount={totals.roundingAdjustment}
          locale={props.locale}
        />
      ) : null}
      <div className="border-t border-default pt-3">
        <QuoteRow label={labels.total} amount={totals.grandTotal} locale={props.locale} strong />
      </div>
      {state.quote.approvalsRequired.length > 0 ? (
        <p className="text-small text-warning">{labels.approvalRequired}</p>
      ) : null}
      {state.isCalculating ? (
        <p className="text-small text-secondary" aria-live="polite">
          {labels.calculating}
        </p>
      ) : null}
    </section>
  );
}
