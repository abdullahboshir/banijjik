"use client";

import { DataList, EmptyState, type DataListColumn } from "@banijjik/ui";
import type { ReactElement } from "react";

export interface AuditRowView {
  platformAuditLogId: string;
  when: string;
  operator: string;
  action: string;
  target: string;
  organization: string;
  reason: string;
}

export interface AuditListLabels {
  when: string;
  operator: string;
  action: string;
  target: string;
  organization: string;
  reason: string;
  empty: string;
}

function columnsOf(labels: AuditListLabels): DataListColumn<AuditRowView>[] {
  return [
    { columnKey: "when", header: labels.when, isPrimary: true, cell: (row) => row.when },
    { columnKey: "action", header: labels.action, isPrimary: true, cell: (row) => row.action },
    { columnKey: "operator", header: labels.operator, cell: (row) => row.operator },
    { columnKey: "target", header: labels.target, cell: (row) => row.target },
    { columnKey: "organization", header: labels.organization, cell: (row) => row.organization },
    { columnKey: "reason", header: labels.reason, isPrimary: true, cell: (row) => row.reason },
  ];
}

/** The platform audit log as a dense table from md, cards below. */
export function AuditList({
  rows,
  labels,
}: {
  rows: AuditRowView[];
  labels: AuditListLabels;
}): ReactElement {
  return (
    <DataList
      columns={columnsOf(labels)}
      rows={rows}
      rowKey={(row) => row.platformAuditLogId}
      emptyState={<EmptyState message={labels.empty} />}
    />
  );
}
