import type { OrderResponse } from "@banijjik/contracts/sales";
import type { Locale } from "@banijjik/i18n";
import { MoneyText, PageSection, formatNumber } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { OrderLabels } from "./order-labels";

function dateTimeText(value: string, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function SummarySection(props: {
  readonly order: OrderResponse;
  readonly locationName: string;
  readonly locale: Locale;
  readonly timeZone: string;
  readonly labels: OrderLabels;
}): ReactElement {
  const { order } = props;
  const rows: readonly { readonly label: string; readonly value: string }[] = [
    {
      label: props.labels.detail.invoice,
      value: order.invoiceNumber ?? props.labels.detail.noInvoice,
    },
    { label: props.labels.detail.location, value: props.locationName },
    {
      label: props.labels.detail.contact,
      value: order.contactName ?? props.labels.detail.noContact,
    },
    {
      label: props.labels.detail.fulfillment,
      value: props.labels.fulfillment[order.fulfillment.method],
    },
    { label: props.labels.detail.source, value: props.labels.source[order.source] },
    {
      label: props.labels.detail.created,
      value: dateTimeText(order.createdAt, props.locale, props.timeZone),
    },
    {
      label: props.labels.detail.updated,
      value: dateTimeText(order.updatedAt, props.locale, props.timeZone),
    },
  ];
  return (
    <PageSection title={props.labels.detail.summary}>
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1">
            <dt className="text-caption text-secondary">{row.label}</dt>
            <dd className="min-w-0 break-words text-body text-primary">{row.value}</dd>
          </div>
        ))}
        {order.note === null ? null : (
          <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
            <dt className="text-caption text-secondary">{props.labels.detail.note}</dt>
            <dd className="min-w-0 whitespace-pre-wrap break-words text-body text-primary">
              {order.note}
            </dd>
          </div>
        )}
      </dl>
    </PageSection>
  );
}

/** The member who performed the line, by name; a member no longer at this location shows the neutral label. */
function LinePerformer(props: {
  readonly performedByMemberId: string | null;
  readonly performerNames: Readonly<Record<string, string>>;
  readonly labels: OrderLabels;
}): ReactElement | null {
  const { performedByMemberId, labels } = props;
  if (performedByMemberId === null) return null;
  return (
    <span className="min-w-0 break-words text-small text-secondary">
      {labels.line.performer}:{" "}
      {props.performerNames[performedByMemberId] ?? labels.line.performerUnknown}
    </span>
  );
}

/** One line of the order: name and modifiers, quantity, unit price and the line total. */
function OrderLineRow(props: {
  readonly line: OrderResponse["lines"][number];
  readonly labels: OrderLabels;
  readonly locale: Locale;
  readonly performerNames: Readonly<Record<string, string>>;
}): ReactElement {
  const { line, labels } = props;
  return (
    <li className="flex flex-col gap-2 rounded-md border border-default p-3 md:grid md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] md:items-center">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="min-w-0 break-words text-body font-semibold text-primary">
          {line.nameSnapshot}
        </span>
        {line.modifiers.length === 0 ? null : (
          <span className="min-w-0 break-words text-small text-secondary">
            {labels.detail.modifiers}:{" "}
            {line.modifiers.map((modifier) => modifier.nameSnapshot).join(", ")}
          </span>
        )}
        <LinePerformer
          performedByMemberId={line.performedByMemberId}
          performerNames={props.performerNames}
          labels={labels}
        />
      </div>
      <div className="flex items-baseline justify-between gap-2 md:flex-col md:items-start">
        <span className="text-caption text-secondary">{labels.detail.quantity}</span>
        <span className="font-money text-body text-primary">
          {formatNumber(line.quantity, { locale: props.locale })}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 md:flex-col md:items-start">
        <span className="text-caption text-secondary">{labels.detail.unitPrice}</span>
        <span className="font-money text-body text-primary">
          <MoneyText money={line.unitPrice} locale={props.locale} />
        </span>
      </div>
      <div className="flex flex-col items-start gap-1">
        <span className="text-caption text-secondary">{labels.detail.lineTotal}</span>
        <span className="font-money text-body font-semibold text-primary">
          <MoneyText money={line.lineNetTotal} locale={props.locale} />
        </span>
        {line.lineDiscount.amount > 0 ? (
          <span className="font-money text-small text-success">
            {labels.detail.lineDiscount}: -
            <MoneyText money={line.lineDiscount} locale={props.locale} />
          </span>
        ) : null}
      </div>
    </li>
  );
}

export function LinesSection(props: {
  readonly order: OrderResponse;
  readonly labels: OrderLabels;
  readonly locale: Locale;
  /** Names of the performers of the order's location; empty when the commission module is off. */
  readonly performerNames: Readonly<Record<string, string>>;
}): ReactElement {
  const { labels, order } = props;
  return (
    <PageSection title={labels.detail.lines}>
      {order.lines.length === 0 ? (
        <p className="text-body text-secondary">{labels.detail.emptyLines}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {order.lines.map((line) => (
            <OrderLineRow
              key={line.orderLineId}
              line={line}
              labels={labels}
              locale={props.locale}
              performerNames={props.performerNames}
            />
          ))}
        </ul>
      )}
    </PageSection>
  );
}

export function TotalsSection(props: {
  readonly order: OrderResponse;
  readonly labels: OrderLabels;
  readonly locale: Locale;
}): ReactElement {
  const { totals } = props.order;
  const rows = [
    { key: "subtotal", label: props.labels.detail.subtotal, money: totals.subtotal, show: true },
    {
      key: "discount",
      label: props.labels.detail.discount,
      money: totals.discountTotal,
      show: totals.discountTotal.amount > 0,
    },
    { key: "tax", label: props.labels.detail.tax, money: totals.taxTotal, show: true },
    {
      key: "delivery",
      label: props.labels.detail.delivery,
      money: totals.deliveryCharge,
      show: totals.deliveryCharge.amount > 0,
    },
    {
      key: "rounding",
      label: props.labels.detail.rounding,
      money: totals.roundingAdjustment,
      show: totals.roundingAdjustment.amount !== 0,
    },
  ];
  return (
    <PageSection title={props.labels.detail.totals}>
      <dl className="flex flex-col gap-2 rounded-md border border-default bg-surface p-4">
        {rows
          .filter((row) => row.show)
          .map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3">
              <dt className="text-body text-secondary">{row.label}</dt>
              <dd className="font-money text-body text-primary">
                <MoneyText money={row.money} locale={props.locale} />
              </dd>
            </div>
          ))}
        <div className="flex items-center justify-between gap-3 border-t border-default pt-2">
          <dt className="text-body font-semibold text-primary">{props.labels.detail.total}</dt>
          <dd className="font-money text-title font-semibold text-primary">
            <MoneyText money={totals.grandTotal} locale={props.locale} />
          </dd>
        </div>
      </dl>
    </PageSection>
  );
}
