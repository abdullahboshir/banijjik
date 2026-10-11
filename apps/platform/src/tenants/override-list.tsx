"use client";

import { DataList, EmptyState, type DataListColumn } from "@banijjik/ui";
import type { ReactElement } from "react";
import { RemoveOverrideButton } from "./remove-override-button";
import type { RemoveOverrideLabels } from "./remove-override-labels";

export interface OverrideRowView {
  moduleOverrideId: string;
  moduleLabel: string;
  effectLabel: string;
  reason: string;
  expiryLabel: string;
}

export interface OverrideListLabels {
  module: string;
  effect: string;
  reason: string;
  expires: string;
  actions: string;
  empty: string;
}

export interface OverrideListProps {
  organizationId: string;
  rows: OverrideRowView[];
  labels: OverrideListLabels;
  /** Present only for an operator who may change overrides; then each row gets a remove button. */
  removeLabels: RemoveOverrideLabels | undefined;
}

function columnsOf(props: OverrideListProps): DataListColumn<OverrideRowView>[] {
  const { labels, removeLabels, organizationId } = props;
  const columns: DataListColumn<OverrideRowView>[] = [
    { columnKey: "module", header: labels.module, isPrimary: true, cell: (row) => row.moduleLabel },
    { columnKey: "effect", header: labels.effect, isPrimary: true, cell: (row) => row.effectLabel },
    { columnKey: "reason", header: labels.reason, cell: (row) => row.reason },
    { columnKey: "expires", header: labels.expires, cell: (row) => row.expiryLabel },
  ];
  if (removeLabels) {
    columns.push({
      columnKey: "actions",
      header: labels.actions,
      align: "end",
      cell: (row) => (
        <RemoveOverrideButton
          organizationId={organizationId}
          moduleOverrideId={row.moduleOverrideId}
          labels={removeLabels}
        />
      ),
    });
  }
  return columns;
}

/** The active module overrides of a tenant (13-UX section 4.1: a table from md, cards below). */
export function OverrideList(props: OverrideListProps): ReactElement {
  return (
    <DataList
      columns={columnsOf(props)}
      rows={props.rows}
      rowKey={(row) => row.moduleOverrideId}
      emptyState={<EmptyState message={props.labels.empty} />}
    />
  );
}
