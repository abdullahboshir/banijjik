"use client";

import { DataList, StatusBadge, type DataListColumn } from "@banijjik/ui";
import type { ReactElement, ReactNode } from "react";

export interface BusinessRow {
  organizationId: string;
  slug: string;
  name: string;
  /** Already translated and joined by the server. */
  roleNames: string;
  isSuspended: boolean;
}

export interface BusinessListLabels {
  nameColumn: string;
  rolesColumn: string;
  statusColumn: string;
  suspended: string;
  empty: ReactNode;
}

/** A full-page link on purpose: entering a business is a full page load (ADR-022). */
function nameCell(row: BusinessRow): ReactElement {
  return (
    <a href={`/${row.slug}`} className="inline-flex min-h-11 items-center text-brand">
      {row.name}
    </a>
  );
}

function buildColumns(
  labels: BusinessListLabels,
  hasSuspended: boolean,
): DataListColumn<BusinessRow>[] {
  const columns: DataListColumn<BusinessRow>[] = [
    { columnKey: "name", header: labels.nameColumn, cell: nameCell, isPrimary: true },
    {
      columnKey: "roles",
      header: labels.rolesColumn,
      cell: (row) => row.roleNames,
      isPrimary: true,
    },
  ];
  if (!hasSuspended) return columns;
  columns.push({
    columnKey: "status",
    header: labels.statusColumn,
    isPrimary: true,
    cell: (row) =>
      row.isSuspended ? (
        // Organization statuses are not in the docs/11 status table yet, so the badge shows the neutral tone.
        <StatusBadge requestType="ENROLLMENT" status="SUSPENDED" label={labels.suspended} />
      ) : null,
  });
  return columns;
}

/** The businesses of the signed-in person: cards on a phone, a table from md up. */
export function BusinessList({
  rows,
  labels,
}: {
  rows: BusinessRow[];
  labels: BusinessListLabels;
}): ReactElement {
  const hasSuspended = rows.some((row) => row.isSuspended);
  return (
    <DataList
      columns={buildColumns(labels, hasSuspended)}
      rows={rows}
      rowKey={(row) => row.organizationId}
      emptyState={labels.empty}
    />
  );
}
