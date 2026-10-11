"use client";

import { DataList, EmptyState, StatusBadge, type DataListColumn } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

export interface StaffRowView {
  memberId: string;
  name: string;
  roles: string;
  locations: string;
  /** The member status, for the badge colour. */
  status: string;
  statusLabel: string;
}

export interface StaffListLabels {
  name: string;
  roles: string;
  locations: string;
  status: string;
  empty: string;
}

export interface StaffListProps {
  rows: StaffRowView[];
  labels: StaffListLabels;
  /** `/acme/settings/staff`: a row opens `${detailBasePath}/${memberId}`. */
  detailBasePath: string;
  showLocations: boolean;
}

function columnsOf(
  labels: StaffListLabels,
  showLocations: boolean,
): DataListColumn<StaffRowView>[] {
  const columns: DataListColumn<StaffRowView>[] = [
    { columnKey: "name", header: labels.name, isPrimary: true, cell: (row) => row.name },
    { columnKey: "roles", header: labels.roles, isPrimary: true, cell: (row) => row.roles },
  ];
  if (showLocations) {
    columns.push({
      columnKey: "locations",
      header: labels.locations,
      cell: (row) => row.locations,
    });
  }
  columns.push({
    columnKey: "status",
    header: labels.status,
    isPrimary: true,
    cell: (row) => (
      <StatusBadge requestType="ENROLLMENT" status={row.status} label={row.statusLabel} />
    ),
  });
  return columns;
}

/** The staff list of 13-UX section 4.1: a table from md, cards below; a row opens the member. */
export function StaffList({
  rows,
  labels,
  detailBasePath,
  showLocations,
}: StaffListProps): ReactElement {
  const router = useRouter();
  return (
    <DataList
      columns={columnsOf(labels, showLocations)}
      rows={rows}
      rowKey={(row) => row.memberId}
      onRowSelect={(row) => router.push(`${detailBasePath}/${row.memberId}`)}
      emptyState={<EmptyState message={labels.empty} />}
    />
  );
}
