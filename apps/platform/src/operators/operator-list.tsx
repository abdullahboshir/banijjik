"use client";

import type { PlatformRole } from "@banijjik/contracts";
import { DataList, EmptyState, type DataListColumn, type StatusTone } from "@banijjik/ui";
import type { ReactElement } from "react";
import { StatusPill } from "../shell/status-pill";
import { OperatorRowActions } from "./operator-actions";
import type { OperatorActionKind, OperatorLabels } from "./operator-action-rules";

export interface OperatorRowView {
  platformOperatorId: string;
  name: string;
  identifierHint: string;
  rolesLabel: string;
  statusLabel: string;
  statusTone: StatusTone;
  isSelf: boolean;
  status: "ACTIVE" | "DISABLED";
  version: number;
  platformRoles: readonly PlatformRole[];
  actions: OperatorActionKind[];
}

function columnsOf(labels: OperatorLabels): DataListColumn<OperatorRowView>[] {
  return [
    {
      columnKey: "name",
      header: labels["platform.operators.column.name"],
      isPrimary: true,
      cell: (row) => (
        <span className="inline-flex flex-wrap items-center gap-2">
          {row.name}
          {row.isSelf ? <StatusPill tone="info" label={labels["platform.operators.you"]} /> : null}
        </span>
      ),
    },
    {
      columnKey: "identifier",
      header: labels["platform.operators.column.identifier"],
      isPrimary: true,
      cell: (row) => row.identifierHint,
    },
    {
      columnKey: "roles",
      header: labels["platform.operators.column.roles"],
      isPrimary: true,
      cell: (row) => row.rolesLabel,
    },
    {
      columnKey: "status",
      header: labels["platform.operators.column.status"],
      isPrimary: true,
      cell: (row) => <StatusPill tone={row.statusTone} label={row.statusLabel} />,
    },
    {
      columnKey: "actions",
      header: labels["platform.operators.column.actions"],
      isPrimary: true,
      cell: (row) => <OperatorRowActions row={row} labels={labels} />,
    },
  ];
}

/** Operators as cards below md and a table from md up. A row does not open another page. */
export function OperatorList({
  rows,
  labels,
}: {
  rows: OperatorRowView[];
  labels: OperatorLabels;
}): ReactElement {
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.platformOperatorId}
      emptyState={<EmptyState message={labels["platform.operators.empty"]} />}
    />
  );
}
