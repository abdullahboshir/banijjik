"use client";

import { DataList, EmptyState, StatusBadge, type DataListColumn } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

export interface RoleRowView {
  roleId: string;
  name: string;
  isSystem: boolean;
  membersText: string;
  /** The role status, for the badge colour. */
  status: string;
  statusLabel: string;
}

export interface RoleListLabels {
  name: string;
  members: string;
  status: string;
  system: string;
  empty: string;
}

export interface RoleListProps {
  rows: RoleRowView[];
  labels: RoleListLabels;
  /** `/acme/settings/roles`: a row opens `${detailBasePath}/${roleId}`. */
  detailBasePath: string;
}

function columnsOf(labels: RoleListLabels): DataListColumn<RoleRowView>[] {
  return [
    {
      columnKey: "name",
      header: labels.name,
      isPrimary: true,
      cell: (row) => (row.isSystem ? `${row.name} · ${labels.system}` : row.name),
    },
    {
      columnKey: "members",
      header: labels.members,
      isPrimary: true,
      cell: (row) => row.membersText,
    },
    {
      columnKey: "status",
      header: labels.status,
      isPrimary: true,
      cell: (row) => <StatusBadge requestType="ROLE" status={row.status} label={row.statusLabel} />,
    },
  ];
}

/** The roles table (cards on a phone); a row opens the role. */
export function RoleList({ rows, labels, detailBasePath }: RoleListProps): ReactElement {
  const router = useRouter();
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.roleId}
      onRowSelect={(row) => router.push(`${detailBasePath}/${row.roleId}`)}
      emptyState={<EmptyState message={labels.empty} />}
    />
  );
}
