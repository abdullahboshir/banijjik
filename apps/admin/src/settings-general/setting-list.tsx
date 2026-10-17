"use client";

import { Button, DataList, EmptyState, type DataListColumn } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement } from "react";
import { SourceBadge } from "../settings/source-badge";
import type { SettingEditSheetProps } from "./setting-edit-sheet";
import type { SettingListLabels, SettingSheetLabels } from "./setting-labels";
import type { SettingRowView } from "./setting-rows";

export interface SettingListProps {
  organizationId: string;
  rows: SettingRowView[];
  labels: SettingListLabels;
  sheetLabels: SettingSheetLabels;
}

async function loadSheet(): Promise<ComponentType<SettingEditSheetProps>> {
  const sheetModule = await import("./setting-edit-sheet");
  return sheetModule.SettingEditSheet;
}

function columnsOf(
  labels: SettingListLabels,
  onChange: (row: SettingRowView) => void,
): DataListColumn<SettingRowView>[] {
  return [
    { columnKey: "setting", header: labels.setting, isPrimary: true, cell: (row) => row.label },
    { columnKey: "value", header: labels.value, isPrimary: true, cell: (row) => row.valueText },
    {
      columnKey: "source",
      header: labels.source,
      cell: (row) => (
        <SourceBadge
          label={row.sourceLabel}
          tone={row.source === "ORGANIZATION" || row.source === "LOCATION" ? "info" : "neutral"}
        />
      ),
    },
    {
      columnKey: "actions",
      header: labels.actions,
      isPrimary: true,
      cell: (row) =>
        row.canEdit ? (
          <Button variant="secondary" onClick={() => onChange(row)}>
            {labels.change}
          </Button>
        ) : null,
    },
  ];
}

/** The settings table (cards on a phone). The edit sheet loads on the first tap of "Change". */
export function SettingList(props: SettingListProps): ReactElement {
  const [open, setOpen] = useState<SettingRowView | undefined>();
  const Sheet = useLazyComponent(loadSheet, open !== undefined);
  return (
    <>
      <DataList
        columns={columnsOf(props.labels, setOpen)}
        rows={props.rows}
        rowKey={(row) => row.settingKey}
        emptyState={<EmptyState message={props.labels.empty} />}
      />
      {Sheet && open ? (
        <Sheet
          organizationId={props.organizationId}
          setting={open}
          labels={props.sheetLabels}
          onClose={() => setOpen(undefined)}
        />
      ) : null}
    </>
  );
}
