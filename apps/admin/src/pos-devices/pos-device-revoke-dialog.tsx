"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { ConfirmDialog } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { revokePosDevice } from "./pos-devices-api";
import type { PosDeviceRevokeLabels } from "./pos-devices-labels";

export interface PosDeviceRevokeDialogProps {
  organizationId: string;
  posDeviceId: string;
  /** The version the list was drawn from; a stale one is refused with a 409. */
  version: number;
  name: string;
  labels: PosDeviceRevokeLabels;
  onClose: () => void;
}

/**
 * Confirms the revoke of one till. A till that changed meanwhile (409) shows the conflict text, and
 * closing the dialog reloads the list so the next try uses the current version.
 */
export function PosDeviceRevokeDialog(props: PosDeviceRevokeDialogProps): ReactElement {
  const { organizationId, posDeviceId, version, name, labels, onClose } = props;
  const { t } = useTranslator();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | undefined>();
  const [isConflict, setIsConflict] = useState(false);

  async function run(): Promise<void> {
    try {
      await revokePosDevice(organizationId, posDeviceId, { version });
      onClose();
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      const conflict = error.code === ERROR_CODE.CONFLICT;
      setIsConflict(conflict);
      setRefusal(conflict ? labels.conflict : t(knownMessageKeyOrInternal(error.messageKey)));
    }
  }

  function handleOpenChange(open: boolean): void {
    if (open) return;
    onClose();
    if (isConflict) router.refresh();
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={handleOpenChange}
      title={t("posDevices.revoke.title", { name })}
      description={refusal ?? labels.description}
      confirmLabel={labels.confirm}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      tone="danger"
      onConfirm={() => void run()}
    />
  );
}
