"use client";

import { DataList, PublicImage, StatusBadge, type DataListColumn } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

export interface OfferingRowView {
  offeringId: string;
  name: string;
  imageUrl: string | null;
  priceText: string;
  optionsText: string;
  /** The offering status, for the badge colour. */
  status: string;
  statusLabel: string;
  /** Only when a branch is chosen: whether the branch sells it. */
  branchText: string | undefined;
}

export interface OfferingListLabels {
  name: string;
  price: string;
  options: string;
  status: string;
  branch: string;
}

export interface OfferingListProps {
  rows: OfferingRowView[];
  labels: OfferingListLabels;
  /** `/acme/catalog`: a row opens `${detailBasePath}/${offeringId}`. */
  detailBasePath: string;
  /** The empty state with its add button, drawn by the server page. */
  empty: ReactNode;
}

const THUMBNAIL_CLASS = "size-11 shrink-0 rounded-sm border border-default object-cover";

function NameCell({ row }: { row: OfferingRowView }): ReactElement {
  return (
    <span className="flex min-w-0 items-center gap-3">
      {row.imageUrl ? (
        <PublicImage src={row.imageUrl} alt="" className={THUMBNAIL_CLASS} />
      ) : (
        <span aria-hidden="true" className={`${THUMBNAIL_CLASS} bg-subtle`} />
      )}
      <span className="min-w-0 break-words">{row.name}</span>
    </span>
  );
}

function columnsOf(
  labels: OfferingListLabels,
  hasBranch: boolean,
): DataListColumn<OfferingRowView>[] {
  const columns: DataListColumn<OfferingRowView>[] = [
    {
      columnKey: "name",
      header: labels.name,
      isPrimary: true,
      cell: (row) => <NameCell row={row} />,
    },
    { columnKey: "price", header: labels.price, isPrimary: true, cell: (row) => row.priceText },
    { columnKey: "options", header: labels.options, cell: (row) => row.optionsText },
  ];
  if (hasBranch) {
    columns.push({ columnKey: "branch", header: labels.branch, cell: (row) => row.branchText });
  }
  columns.push({
    columnKey: "status",
    header: labels.status,
    isPrimary: true,
    cell: (row) => (
      <StatusBadge requestType="OFFERING" status={row.status} label={row.statusLabel} />
    ),
  });
  return columns;
}

/** The catalog list of 13-UX section 4.1: a table from md, cards with the photo below; a row opens the item. */
export function OfferingList({
  rows,
  labels,
  detailBasePath,
  empty,
}: OfferingListProps): ReactElement {
  const router = useRouter();
  const hasBranch = rows.some((row) => row.branchText !== undefined);
  return (
    <DataList
      columns={columnsOf(labels, hasBranch)}
      rows={rows}
      rowKey={(row) => row.offeringId}
      onRowSelect={(row) => router.push(`${detailBasePath}/${row.offeringId}`)}
      emptyState={empty}
    />
  );
}
