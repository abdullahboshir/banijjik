"use client";

import { DataList, type DataListColumn } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

export interface StockRowView {
  inventoryItemId: string;
  name: string;
  onHandText: string;
  availableText: string;
  valueText: string;
  lowStock: boolean;
  lowLabel: string;
}

export interface StockListLabels {
  name: string;
  onHand: string;
  available: string;
  value: string;
}

export interface StockListProps {
  rows: StockRowView[];
  labels: StockListLabels;
  detailBasePath: string;
  empty: ReactNode;
}

function NameCell({ row }: { row: StockRowView }): ReactElement {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="break-words font-semibold text-primary">{row.name}</span>
      {row.lowStock ? (
        <span className="inline-flex items-center rounded-full border border-warning px-2 py-0.5 text-caption font-semibold text-warning">
          {row.lowLabel}
        </span>
      ) : null}
    </span>
  );
}

function columnsOf(labels: StockListLabels): DataListColumn<StockRowView>[] {
  return [
    {
      columnKey: "name",
      header: labels.name,
      isPrimary: true,
      cell: (row) => <NameCell row={row} />,
    },
    { columnKey: "onHand", header: labels.onHand, isPrimary: true, cell: (row) => row.onHandText },
    {
      columnKey: "available",
      header: labels.available,
      isPrimary: true,
      cell: (row) => row.availableText,
    },
    { columnKey: "value", header: labels.value, isPrimary: true, cell: (row) => row.valueText },
  ];
}

/** Stock at one branch: cards on phones, table from md (13-UX section 4.1). */
export function StockList({ rows, labels, detailBasePath, empty }: StockListProps): ReactElement {
  const router = useRouter();
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.inventoryItemId}
      onRowSelect={(row) => router.push(`${detailBasePath}/${row.inventoryItemId}`)}
      emptyState={empty}
    />
  );
}
