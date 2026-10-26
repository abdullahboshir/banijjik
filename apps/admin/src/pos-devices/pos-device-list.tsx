"use client";

import { useLazyComponent } from "@banijjik/web-client/client";
import { Button, DataList, EmptyState, type DataListColumn } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import type { PosDeviceRevokeDialogProps } from "./pos-device-revoke-dialog";
import type { PosDeviceRevokeLabels, PosDevicesListLabels } from "./pos-devices-labels";
import type { PosDeviceRowView } from "./pos-devices-view";

export interface PosDeviceListProps {
  organizationId: string;
  rows: PosDeviceRowView[];
  labels: PosDevicesListLabels;
  revokeLabels: PosDeviceRevokeLabels;
  /** False for a person who may read the tills but not manage them. */
  mayRevoke: boolean;
}

async function loadRevokeDialog(): Promise<ComponentType<PosDeviceRevokeDialogProps>> {
  const dialogModule = await import("./pos-device-revoke-dialog");
  return dialogModule.PosDeviceRevokeDialog;
}

function columnsOf(
  labels: PosDevicesListLabels,
  mayRevoke: boolean,
  onRevoke: (row: PosDeviceRowView) => void,
): DataListColumn<PosDeviceRowView>[] {
  return [
    { columnKey: "name", header: labels.name, isPrimary: true, cell: (row) => row.name },
    {
      columnKey: "location",
      header: labels.location,
      isPrimary: true,
      cell: (row) => row.locationName,
    },
    { columnKey: "state", header: labels.state, isPrimary: true, cell: (row) => row.stateText },
    {
      columnKey: "actions",
      header: labels.actions,
      isPrimary: true,
      cell: (row) =>
        mayRevoke && row.canRevoke ? (
          <Button variant="danger" onClick={() => onRevoke(row)}>
            {labels.revoke}
          </Button>
        ) : null,
    },
  ];
}

/** The tills of the page (cards on a phone). Revoke loads its dialog on the first tap. */
export function PosDeviceList(props: PosDeviceListProps): ReactElement {
  const { organizationId, rows, labels, revokeLabels, mayRevoke } = props;
  const [revoking, setRevoking] = useState<PosDeviceRowView | undefined>();
  const RevokeDialog = useLazyComponent(loadRevokeDialog, revoking !== undefined);
  return (
    <>
      <DataList
        columns={columnsOf(labels, mayRevoke, setRevoking)}
        rows={rows}
        rowKey={(row) => row.posDeviceId}
        emptyState={<EmptyState message={labels.empty} />}
      />
      {RevokeDialog && revoking ? (
        <RevokeDialog
          organizationId={organizationId}
          posDeviceId={revoking.posDeviceId}
          version={revoking.version}
          name={revoking.name}
          labels={revokeLabels}
          onClose={() => setRevoking(undefined)}
        />
      ) : null}
    </>
  );
}
