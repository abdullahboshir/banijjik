"use client";

import { Button, DataList, EmptyState, StatusBadge, type DataListColumn } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import { useLazyComponent } from "../lib/use-lazy-component";
import type { LocationDialogsProps, LocationRowAction } from "./location-dialogs";
import type { LocationArchiveLabels, LocationFormLabels } from "./location-labels";
import type { LocationFormState } from "./location-state";

export interface LocationRowView {
  locationId: string;
  version: number;
  name: string;
  typeLabel: string;
  phone: string;
  /** The location status, for the badge colour. */
  status: string;
  statusLabel: string;
  isDefault: boolean;
  canEdit: boolean;
  canArchive: boolean;
  form: LocationFormState;
  archiveLabels: LocationArchiveLabels;
}

export interface LocationListLabels {
  name: string;
  type: string;
  phone: string;
  status: string;
  actions: string;
  edit: string;
  archive: string;
  defaultMark: string;
  empty: string;
}

export interface LocationListProps {
  organizationId: string;
  rows: LocationRowView[];
  labels: LocationListLabels;
  formLabels: LocationFormLabels;
}

interface OpenAction {
  action: LocationRowAction;
  row: LocationRowView;
}

async function loadDialogs(): Promise<ComponentType<LocationDialogsProps>> {
  const dialogsModule = await import("./location-dialogs");
  return dialogsModule.LocationDialogs;
}

function RowActions({
  row,
  labels,
  onOpen,
}: {
  row: LocationRowView;
  labels: LocationListLabels;
  onOpen: (open: OpenAction) => void;
}): ReactElement | null {
  if (!row.canEdit && !row.canArchive) return null;
  return (
    <span className="flex flex-wrap gap-2">
      {row.canEdit ? (
        <Button variant="secondary" onClick={() => onOpen({ action: "edit", row })}>
          {labels.edit}
        </Button>
      ) : null}
      {row.canArchive ? (
        <Button variant="danger" onClick={() => onOpen({ action: "archive", row })}>
          {labels.archive}
        </Button>
      ) : null}
    </span>
  );
}

function columnsOf(
  labels: LocationListLabels,
  onOpen: (open: OpenAction) => void,
): DataListColumn<LocationRowView>[] {
  return [
    {
      columnKey: "name",
      header: labels.name,
      isPrimary: true,
      cell: (row) => (row.isDefault ? `${row.name} · ${labels.defaultMark}` : row.name),
    },
    { columnKey: "type", header: labels.type, isPrimary: true, cell: (row) => row.typeLabel },
    { columnKey: "phone", header: labels.phone, cell: (row) => row.phone },
    {
      columnKey: "status",
      header: labels.status,
      isPrimary: true,
      cell: (row) => (
        <StatusBadge requestType="LOCATION" status={row.status} label={row.statusLabel} />
      ),
    },
    {
      columnKey: "actions",
      header: labels.actions,
      isPrimary: true,
      cell: (row) => <RowActions row={row} labels={labels} onOpen={onOpen} />,
    },
  ];
}

/** The locations table (cards on a phone). Edit and archive load their dialogs on the first tap. */
export function LocationList(props: LocationListProps): ReactElement {
  const { organizationId, rows, labels, formLabels } = props;
  const [open, setOpen] = useState<OpenAction | undefined>();
  const Dialogs = useLazyComponent(loadDialogs, open !== undefined);
  return (
    <>
      <DataList
        columns={columnsOf(labels, setOpen)}
        rows={rows}
        rowKey={(row) => row.locationId}
        emptyState={<EmptyState message={labels.empty} />}
      />
      {Dialogs && open ? (
        <Dialogs
          organizationId={organizationId}
          location={open.row}
          action={open.action}
          formLabels={formLabels}
          archiveLabels={open.row.archiveLabels}
          onClose={() => setOpen(undefined)}
        />
      ) : null}
    </>
  );
}
