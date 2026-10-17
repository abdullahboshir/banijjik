"use client";

import { Button, DataList, EmptyState, type DataListColumn } from "@banijjik/ui";
import { useLazyComponent } from "@banijjik/web-client/client";
import { useState, type ComponentType, type ReactElement } from "react";
import { SourceBadge } from "../settings/source-badge";
import type { FieldDialogsProps, FieldRowAction } from "./field-dialogs";
import type { FieldLabels, FieldListLabels } from "./field-labels";
import type { FieldRowView } from "./field-rows";

export interface FieldListProps {
  organizationId: string;
  rows: FieldRowView[];
  labels: FieldListLabels;
  formLabels: FieldLabels;
}

interface OpenAction {
  action: FieldRowAction;
  row: FieldRowView;
}

async function loadDialogs(): Promise<ComponentType<FieldDialogsProps>> {
  const dialogsModule = await import("./field-dialogs");
  return dialogsModule.FieldDialogs;
}

function Traits({ row, labels }: { row: FieldRowView; labels: FieldListLabels }): ReactElement {
  return (
    <span className="flex flex-wrap gap-1">
      <SourceBadge
        label={row.scope === "INDUSTRY" ? labels.scopeIndustry : labels.scopeOrganization}
        tone={row.scope === "INDUSTRY" ? "neutral" : "info"}
      />
      {row.isRequired ? <SourceBadge label={labels.required} tone="warning" /> : null}
      {row.isSensitive ? <SourceBadge label={labels.sensitive} tone="warning" /> : null}
      {row.botAsk ? <SourceBadge label={labels.botAsk} /> : null}
    </span>
  );
}

function RowActions({
  row,
  labels,
  onOpen,
}: {
  row: FieldRowView;
  labels: FieldListLabels;
  onOpen: (open: OpenAction) => void;
}): ReactElement | null {
  const buttons: {
    action: FieldRowAction;
    label: string;
    isAllowed: boolean;
    isDanger: boolean;
  }[] = [
    { action: "edit", label: labels.edit, isAllowed: row.canEdit, isDanger: false },
    { action: "customize", label: labels.customize, isAllowed: row.canCustomize, isDanger: false },
    { action: "hide", label: labels.hide, isAllowed: row.canHide, isDanger: true },
    { action: "archive", label: labels.archive, isAllowed: row.canArchive, isDanger: true },
  ];
  const shown = buttons.filter((button) => button.isAllowed);
  if (shown.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-2">
      {shown.map((button) => (
        <Button
          key={button.action}
          variant={button.isDanger ? "danger" : "secondary"}
          onClick={() => onOpen({ action: button.action, row })}
        >
          {button.label}
        </Button>
      ))}
    </span>
  );
}

function columnsOf(
  labels: FieldListLabels,
  onOpen: (open: OpenAction) => void,
): DataListColumn<FieldRowView>[] {
  return [
    { columnKey: "field", header: labels.field, isPrimary: true, cell: (row) => row.label },
    { columnKey: "key", header: labels.key, cell: (row) => row.fieldKey },
    { columnKey: "type", header: labels.type, cell: (row) => row.typeLabel },
    {
      columnKey: "traits",
      header: labels.traits,
      isPrimary: true,
      cell: (row) => <Traits row={row} labels={labels} />,
    },
    {
      columnKey: "actions",
      header: labels.actions,
      isPrimary: true,
      cell: (row) => <RowActions row={row} labels={labels} onOpen={onOpen} />,
    },
  ];
}

/** The fields of one record type (cards on a phone). Every sheet and dialog loads on the first tap. */
export function FieldList(props: FieldListProps): ReactElement {
  const { organizationId, rows, labels, formLabels } = props;
  const [open, setOpen] = useState<OpenAction | undefined>();
  const Dialogs = useLazyComponent(loadDialogs, open !== undefined);
  return (
    <>
      <DataList
        columns={columnsOf(labels, setOpen)}
        rows={rows}
        rowKey={(row) => `${row.entityType}:${row.fieldKey}`}
        emptyState={<EmptyState message={labels.empty} />}
      />
      {Dialogs && open ? (
        <Dialogs
          organizationId={organizationId}
          field={open.row}
          action={open.action}
          labels={formLabels}
          onClose={() => setOpen(undefined)}
        />
      ) : null}
    </>
  );
}
