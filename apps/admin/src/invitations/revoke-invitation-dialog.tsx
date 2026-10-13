"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { ERROR_CODE } from "@banijjik/contracts";
import { ConfirmDialog } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { revokeInvitation } from "../lib/api/organization-api";

export interface RevokeInvitationLabels {
  title: string;
  description: string;
  confirm: string;
  cancel: string;
  close: string;
  conflict: string;
}

export interface RevokeInvitationDialogProps {
  organizationId: string;
  invitation: { invitationId: string; version: number };
  labels: RevokeInvitationLabels;
  onClose: () => void;
}

/** Asks before revoking; a refusal replaces the description so the person sees why. */
export function RevokeInvitationDialog(props: RevokeInvitationDialogProps): ReactElement {
  const { organizationId, invitation, labels, onClose } = props;
  const { t } = useTranslator();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | undefined>();

  async function run(): Promise<void> {
    try {
      await revokeInvitation(organizationId, invitation.invitationId, invitation.version);
      onClose();
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const isConflict = error.code === ERROR_CODE.CONFLICT;
      setRefusal(isConflict ? labels.conflict : t(knownMessageKeyOrInternal(error.messageKey)));
    }
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={labels.title}
      description={refusal ?? labels.description}
      confirmLabel={labels.confirm}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      tone="danger"
      onConfirm={() => void run()}
    />
  );
}
