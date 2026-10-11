"use client";

import { DataList, EmptyState, type DataListColumn, type StatusTone } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { StatusPill } from "../shell/status-pill";

export interface PackageRowView {
  packageId: string;
  name: string;
  moduleCountLabel: string;
  limitsSummary: string;
  statusLabel: string;
  statusTone: StatusTone;
}

export interface PackageTableLabels {
  name: string;
  modules: string;
  limits: string;
  status: string;
  empty: string;
}

function columnsOf(labels: PackageTableLabels): DataListColumn<PackageRowView>[] {
  return [
    { columnKey: "name", header: labels.name, isPrimary: true, cell: (row) => row.name },
    {
      columnKey: "modules",
      header: labels.modules,
      align: "end",
      cell: (row) => row.moduleCountLabel,
    },
    { columnKey: "limits", header: labels.limits, cell: (row) => row.limitsSummary },
    {
      columnKey: "status",
      header: labels.status,
      isPrimary: true,
      cell: (row) => <StatusPill tone={row.statusTone} label={row.statusLabel} />,
    },
  ];
}

/** One group of packages (base or add-on); a row opens the package. */
export function PackageTable({
  rows,
  labels,
}: {
  rows: PackageRowView[];
  labels: PackageTableLabels;
}): ReactElement {
  const router = useRouter();
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.packageId}
      onRowSelect={(row) => router.push(`/packages/${row.packageId}`)}
      emptyState={<EmptyState message={labels.empty} />}
    />
  );
}
