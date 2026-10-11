"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { ConfirmDialog } from "@banijjik/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { useTranslator } from "../lib/i18n/i18n-provider";
import { archiveLocation } from "./location-api";
import type { LocationArchiveLabels } from "./location-labels";

export interface LocationArchiveDialogProps {
  organizationId: string;
  locationId: string;
  version: number;
  labels: LocationArchiveLabels;
  onClose: () => void;
}

/**
 * Confirms the archive. Each refusal (the default location, a location still in use) replaces the
 * description with its own message, taken from the message key the API sent.
 */
export function LocationArchiveDialog(props: LocationArchiveDialogProps): ReactElement {
  const { organizationId, locationId, version, labels, onClose } = props;
  const { t } = useTranslator();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | undefined>();
  const [isConflict, setIsConflict] = useState(false);

  async function run(): Promise<void> {
    try {
      await archiveLocation(organizationId, locationId, version);
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
    // After a conflict the page shows the old version; reloading gives the next attempt the current one.
    if (isConflict) router.refresh();
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={handleOpenChange}
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
