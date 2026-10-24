"use client";

import type { OrderListItem } from "@banijjik/contracts/sales";
import {
  DataList,
  EmptyState,
  StatusBadge,
  formatMoney,
  type DataListColumn,
  type DisplayLocale,
} from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import type { OrderLabels } from "./order-labels";

export interface OrdersListProps {
  readonly orgSlug: string;
  readonly items: readonly OrderListItem[];
  readonly locale: DisplayLocale;
  readonly labels: OrderLabels;
}

function dateText(createdAt: string, locale: DisplayLocale): string {
  return new Date(createdAt).toLocaleString(locale === "bn" ? "bn-BD" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function columnsOf(
  labels: OrderLabels,
  actions: { readonly open: string },
  locale: DisplayLocale,
): DataListColumn<OrderListItem>[] {
  return [...identityColumns(labels), ...moneyColumns(labels, locale), openColumn(actions.open)];
}

function identityColumns(labels: OrderLabels): DataListColumn<OrderListItem>[] {
  return [
    {
      columnKey: "number",
      header: labels.list.number,
      isPrimary: true,
      cell: (row) => (
        <span className="font-money">{row.orderNumber ?? labels.list.unnumbered}</span>
      ),
    },
    {
      columnKey: "status",
      header: labels.list.statusFilter,
      isPrimary: true,
      cell: (row) => (
        <StatusBadge requestType="ORDER" status={row.status} label={labels.status[row.status]} />
      ),
    },
    {
      columnKey: "contact",
      header: labels.list.contact,
      cell: (row) => row.contactName ?? labels.detail.noContact,
    },
  ];
}

function moneyColumns(labels: OrderLabels, locale: DisplayLocale): DataListColumn<OrderListItem>[] {
  return [
    {
      columnKey: "date",
      header: labels.list.date,
      cell: (row) => dateText(row.createdAt, locale),
    },
    {
      columnKey: "total",
      header: labels.list.total,
      align: "end",
      isPrimary: true,
      cell: (row) => <span className="font-money">{formatMoney(row.grandTotal, { locale })}</span>,
    },
    {
      columnKey: "payment",
      header: labels.list.payment,
      isPrimary: true,
      cell: (row) => (
        <StatusBadge
          requestType="PAYMENT"
          status={row.paymentStatus}
          label={labels.paymentStatus[row.paymentStatus]}
        />
      ),
    },
  ];
}

function openColumn(openLabel: string): DataListColumn<OrderListItem> {
  return {
    columnKey: "open",
    header: "",
    cell: () => <span className="text-brand">{openLabel}</span>,
  };
}

/** The list is a client component because `DataList` takes cell functions; the rows come from the server. */
export function OrdersList(props: OrdersListProps): ReactElement {
  const router = useRouter();
  const columns = columnsOf(props.labels, { open: props.labels.list.open }, props.locale);
  return (
    <DataList
      columns={columns}
      rows={[...props.items]}
      rowKey={(row) => row.orderId}
      onRowSelect={(row) => {
        router.push(`/${props.orgSlug}/orders/${row.orderId}`);
      }}
      emptyState={<EmptyState kind="none" message={props.labels.list.empty} />}
    />
  );
}
