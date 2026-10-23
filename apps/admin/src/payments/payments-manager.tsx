"use client";

import type { CurrencyCode } from "@banijjik/contracts";
import type { PaymentMethod, PaymentResponse } from "@banijjik/contracts/payment";
import { Button, EmptyState, formatMoney, type DisplayLocale } from "@banijjik/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { PaymentCard } from "./payment-card";
import type { PaymentLabels } from "./payment-labels";
import { paymentsApiQuery, type PaymentsQuery } from "./payment-query";
import { PaymentsFilterForm } from "./payments-filter-form";
import { ReceivePaymentSheetLazy } from "./receive-payment-sheet-lazy";

export interface PaymentsManagerProps {
  readonly organizationId: string;
  readonly orgSlug: string;
  readonly payments: readonly PaymentResponse[];
  readonly total: number;
  readonly query: PaymentsQuery;
  readonly basePath: string;
  readonly duesPath: string;
  readonly currency: CurrencyCode;
  readonly currencySymbol: string;
  readonly allowedMethods: readonly PaymentMethod[];
  readonly locations: readonly { readonly locationId: string; readonly name: string }[];
  readonly canReceive: boolean;
  readonly locale: DisplayLocale;
  readonly labels: PaymentLabels;
}

function directionToneClass(direction: string): string {
  if (direction === "IN") return "border-success text-success bg-success/10";
  if (direction === "REFUND") return "border-warning text-warning bg-warning/10";
  return "border-danger text-danger bg-danger/10";
}

interface TableProps {
  readonly payments: readonly PaymentResponse[];
  readonly locationNameMap: ReadonlyMap<string, string>;
  readonly basePath: string;
  readonly locale: DisplayLocale;
  readonly labels: PaymentLabels;
  readonly onRowClick: (paymentId: string) => void;
}

function PaymentsDesktopTable(props: TableProps): ReactElement {
  const { payments, locationNameMap, labels, locale, onRowClick } = props;
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-default bg-surface md:block">
      <table className="w-full text-left text-body">
        <thead className="border-b border-default bg-surface-muted text-secondary">
          <tr>
            <th className="px-4 py-3 font-semibold">{labels.card.number}</th>
            <th className="px-4 py-3 font-semibold">{labels.card.date}</th>
            <th className="px-4 py-3 font-semibold">{labels.filter.direction}</th>
            <th className="px-4 py-3 font-semibold">{labels.filter.method}</th>
            <th className="px-4 py-3 font-semibold">{labels.card.location}</th>
            <th className="px-4 py-3 font-semibold">{labels.card.reference}</th>
            <th className="px-4 py-3 text-right font-semibold">{labels.card.amount}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-default">
          {payments.map((payment) => {
            const formatted = formatMoney(payment.amount, { locale });
            return (
              <tr
                key={payment.paymentId}
                className="cursor-pointer transition-colors hover:bg-subtle"
                onClick={() => onRowClick(payment.paymentId)}
              >
                <td className="px-4 py-3 font-mono font-bold text-primary">
                  {payment.paymentNumber}
                </td>
                <td className="px-4 py-3 text-secondary">{payment.businessDate}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-caption font-semibold ${directionToneClass(payment.direction)}`}
                  >
                    {labels.direction[payment.direction] ?? payment.direction}
                  </span>
                </td>
                <td className="px-4 py-3 text-secondary">
                  {labels.method[payment.method] ?? payment.method}
                </td>
                <td className="px-4 py-3 text-secondary">
                  {locationNameMap.get(payment.locationId) ?? "—"}
                </td>
                <td className="px-4 py-3 font-mono text-secondary">
                  {payment.externalReference ?? "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-primary">{formatted}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  readonly total: number;
  readonly page: number;
  readonly totalPages: number;
  readonly labels: PaymentLabels;
  readonly onPageChange: (newPage: number) => void;
}

function PaymentsPagination(props: PaginationProps): ReactElement {
  const { total, page, totalPages, labels, onPageChange } = props;
  return (
    <div className="flex items-center justify-between border-t border-default pt-4 text-body-sm text-secondary">
      <span>{`${labels.pagination.total} ${total} (${page} / ${totalPages})`}</span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {labels.pagination.previous}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {labels.pagination.next}
        </Button>
      </div>
    </div>
  );
}

interface ContentListProps {
  readonly payments: readonly PaymentResponse[];
  readonly total: number;
  readonly query: PaymentsQuery;
  readonly totalPages: number;
  readonly locationNameMap: ReadonlyMap<string, string>;
  readonly basePath: string;
  readonly locale: DisplayLocale;
  readonly labels: PaymentLabels;
  readonly onRowClick: (id: string) => void;
  readonly onPageChange: (page: number) => void;
}

function PaymentsContentList(props: ContentListProps): ReactElement {
  const {
    payments,
    total,
    query,
    totalPages,
    locationNameMap,
    basePath,
    locale,
    labels,
    onRowClick,
    onPageChange,
  } = props;
  if (payments.length === 0) {
    return <EmptyState kind="noResults" message={labels.empty} />;
  }
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {payments.map((payment) => (
          <PaymentCard
            key={payment.paymentId}
            payment={payment}
            basePath={basePath}
            locationName={locationNameMap.get(payment.locationId)}
            locale={locale}
            labels={labels}
          />
        ))}
      </div>
      <PaymentsDesktopTable
        payments={payments}
        locationNameMap={locationNameMap}
        basePath={basePath}
        locale={locale}
        labels={labels}
        onRowClick={onRowClick}
      />
      {totalPages > 1 ? (
        <PaymentsPagination
          total={total}
          page={query.page}
          totalPages={totalPages}
          labels={labels}
          onPageChange={onPageChange}
        />
      ) : null}
    </>
  );
}

export function PaymentsManager(props: PaymentsManagerProps): ReactElement {
  const router = useRouter();
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(props.total / props.query.limit));
  const locationNameMap = new Map(props.locations.map((l) => [l.locationId, l.name]));

  function handlePageChange(newPage: number): void {
    const updatedQuery = { ...props.query, page: newPage };
    const search = paymentsApiQuery(updatedQuery);
    router.push(search ? `${props.basePath}?${search}` : props.basePath);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={props.duesPath}
          className="inline-flex min-h-11 items-center rounded-md border border-default bg-surface px-4 text-body font-semibold text-primary transition-colors hover:bg-subtle"
        >
          {props.labels.duesLink}
        </Link>
        {props.canReceive ? (
          <Button type="button" onClick={() => setIsReceiveOpen(true)}>
            {props.labels.receive}
          </Button>
        ) : null}
      </div>

      <PaymentsFilterForm
        query={props.query}
        basePath={props.basePath}
        locations={props.locations}
        labels={props.labels}
      />

      <PaymentsContentList
        payments={props.payments}
        total={props.total}
        query={props.query}
        totalPages={totalPages}
        locationNameMap={locationNameMap}
        basePath={props.basePath}
        locale={props.locale}
        labels={props.labels}
        onRowClick={(id) => router.push(`${props.basePath}/${id}`)}
        onPageChange={handlePageChange}
      />

      {isReceiveOpen ? (
        <ReceivePaymentSheetLazy
          open={isReceiveOpen}
          onOpenChange={setIsReceiveOpen}
          organizationId={props.organizationId}
          currency={props.currency}
          currencySymbol={props.currencySymbol}
          allowedMethods={props.allowedMethods}
          locations={props.locations}
          onSuccess={() => {
            setIsReceiveOpen(false);
            router.refresh();
          }}
          labels={{
            ...props.labels.receiveSheet,
            methodLabels: props.labels.method,
          }}
        />
      ) : null}
    </div>
  );
}
