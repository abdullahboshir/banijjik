"use client";

import { Button, DataList, EmptyState, StatusBadge, type DataListColumn } from "@banijjik/ui";
import { useState, type ComponentType, type ReactElement } from "react";
import { useLazyComponent } from "../lib/use-lazy-component";
import type {
  RevokeInvitationDialogProps,
  RevokeInvitationLabels,
} from "./revoke-invitation-dialog";

export interface InvitationRowView {
  invitationId: string;
  version: number;
  person: string;
  roles: string;
  expires: string;
  status: string;
  statusLabel: string;
  /** Only a pending invitation can be revoked, and only when the business is not read-only. */
  canRevoke: boolean;
}

export interface InvitationListLabels {
  person: string;
  roles: string;
  expires: string;
  status: string;
  empty: string;
  revoke: string;
  revokeDialog: RevokeInvitationLabels;
}

export interface InvitationListProps {
  organizationId: string;
  rows: InvitationRowView[];
  labels: InvitationListLabels;
}

async function loadDialog(): Promise<ComponentType<RevokeInvitationDialogProps>> {
  const dialogModule = await import("./revoke-invitation-dialog");
  return dialogModule.RevokeInvitationDialog;
}

function columnsOf(
  labels: InvitationListLabels,
  onRevoke: (row: InvitationRowView) => void,
): DataListColumn<InvitationRowView>[] {
  return [
    { columnKey: "person", header: labels.person, isPrimary: true, cell: (row) => row.person },
    { columnKey: "roles", header: labels.roles, cell: (row) => row.roles },
    { columnKey: "expires", header: labels.expires, cell: (row) => row.expires },
    {
      columnKey: "status",
      header: labels.status,
      isPrimary: true,
      cell: (row) => (
        <StatusBadge requestType="INVITATION" status={row.status} label={row.statusLabel} />
      ),
    },
    {
      columnKey: "actions",
      header: "",
      isPrimary: true,
      cell: (row) =>
        row.canRevoke ? (
          <Button variant="ghost" onClick={() => onRevoke(row)}>
            {labels.revoke}
          </Button>
        ) : null,
    },
  ];
}

/** Pending, accepted, revoked and expired invitations; a pending one can be revoked after a confirmation. */
export function InvitationList({
  organizationId,
  rows,
  labels,
}: InvitationListProps): ReactElement {
  const [revoking, setRevoking] = useState<InvitationRowView | undefined>();
  const Dialog = useLazyComponent(loadDialog, revoking !== undefined);
  return (
    <>
      <DataList
        columns={columnsOf(labels, setRevoking)}
        rows={rows}
        rowKey={(row) => row.invitationId}
        emptyState={<EmptyState message={labels.empty} />}
      />
      {Dialog && revoking ? (
        <Dialog
          organizationId={organizationId}
          invitation={revoking}
          labels={labels.revokeDialog}
          onClose={() => setRevoking(undefined)}
        />
      ) : null}
    </>
  );
}
