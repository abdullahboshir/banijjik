"use client";

import { Button, DataList, EmptyState, type DataListColumn } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement } from "react";
import { SourceBadge } from "../settings/source-badge";
import type { ModuleListLabels, ModuleSheetLabels } from "./module-labels";
import type { ModuleRowView } from "./module-rows";
import type { ModuleSwitchSheetProps } from "./module-switch-sheet";

export interface ModuleListProps {
  organizationId: string;
  rows: ModuleRowView[];
  labels: ModuleListLabels;
  sheetLabels: ModuleSheetLabels;
}

async function loadSheet(): Promise<ComponentType<ModuleSwitchSheetProps>> {
  const sheetModule = await import("./module-switch-sheet");
  return sheetModule.ModuleSwitchSheet;
}

function ActionCell({
  row,
  labels,
  onOpen,
}: {
  row: ModuleRowView;
  labels: ModuleListLabels;
  onOpen: (row: ModuleRowView) => void;
}): ReactElement | null {
  if (row.action === undefined) return null;
  const label = row.action === "disable" ? labels.turnOff : labels.turnOn;
  return (
    <span className="flex flex-col gap-1">
      <Button variant="secondary" disabled={row.isLockedByDependents} onClick={() => onOpen(row)}>
        {label}
      </Button>
      {row.isLockedByDependents ? (
        <span className="text-small text-secondary">
          {labels.neededBy} {row.neededBy.join(", ")}
        </span>
      ) : null}
    </span>
  );
}

function columnsOf(
  labels: ModuleListLabels,
  onOpen: (row: ModuleRowView) => void,
): DataListColumn<ModuleRowView>[] {
  return [
    { columnKey: "module", header: labels.module, isPrimary: true, cell: (row) => row.label },
    { columnKey: "class", header: labels.moduleClass, cell: (row) => row.classLabel },
    {
      columnKey: "status",
      header: labels.status,
      isPrimary: true,
      cell: (row) => (
        <SourceBadge label={row.statusLabel} tone={row.status === "ON" ? "info" : "neutral"} />
      ),
    },
    {
      columnKey: "actions",
      header: labels.actions,
      isPrimary: true,
      cell: (row) => <ActionCell row={row} labels={labels} onOpen={onOpen} />,
    },
  ];
}

/** The module table (cards on a phone). The switch sheet loads on the first tap. */
export function ModuleList(props: ModuleListProps): ReactElement {
  const [open, setOpen] = useState<ModuleRowView | undefined>();
  const Sheet = useLazyComponent(loadSheet, open !== undefined);
  return (
    <>
      <DataList
        columns={columnsOf(props.labels, setOpen)}
        rows={props.rows}
        rowKey={(row) => row.moduleKey}
        emptyState={<EmptyState message={props.labels.empty} />}
      />
      {Sheet && open ? (
        <Sheet
          organizationId={props.organizationId}
          module={open}
          labels={props.sheetLabels}
          onClose={() => setOpen(undefined)}
        />
      ) : null}
    </>
  );
}
