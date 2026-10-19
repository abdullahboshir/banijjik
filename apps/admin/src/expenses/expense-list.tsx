"use client";

import { DataList, EmptyState, type DataListColumn } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

export interface ExpenseRowView {
  expenseId: string;
  expenseNumber: string;
  amountText: string;
  categoryName: string;
  businessDate: string;
  paidViaLabel: string;
  statusLabel: string;
}

export interface ExpenseListLabels {
  number: string;
  amount: string;
  category: string;
  date: string;
  paidVia: string;
  status: string;
  empty: string;
}

export interface ExpenseListProps {
  rows: ExpenseRowView[];
  labels: ExpenseListLabels;
  detailBasePath: string;
}

function columnsOf(labels: ExpenseListLabels): DataListColumn<ExpenseRowView>[] {
  return [
    {
      columnKey: "number",
      header: labels.number,
      isPrimary: true,
      cell: (row) => row.expenseNumber,
    },
    {
      columnKey: "amount",
      header: labels.amount,
      isPrimary: true,
      cell: (row) => row.amountText,
    },
    {
      columnKey: "category",
      header: labels.category,
      isPrimary: true,
      cell: (row) => row.categoryName,
    },
    { columnKey: "date", header: labels.date, cell: (row) => row.businessDate },
    { columnKey: "paidVia", header: labels.paidVia, cell: (row) => row.paidViaLabel },
    { columnKey: "status", header: labels.status, cell: (row) => row.statusLabel },
  ];
}

/** Expense list: table from md, stacked rows below; a row opens the detail. */
export function ExpenseList({ rows, labels, detailBasePath }: ExpenseListProps): ReactElement {
  const router = useRouter();
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.expenseId}
      onRowSelect={(row) => router.push(`${detailBasePath}/${row.expenseId}`)}
      emptyState={<EmptyState message={labels.empty} />}
    />
  );
}
