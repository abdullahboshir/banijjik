"use client";

import { ConfirmDialog } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { deleteModuleOverride } from "../api/platform-api";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import { useTranslator } from "../i18n/i18n-provider";
import type { RemoveOverrideLabels } from "./remove-override-labels";

export interface RemoveOverrideDialogProps {
  organizationId: string;
  moduleOverrideId: string;
  labels: RemoveOverrideLabels;
  onClose: () => void;
}

/** Confirmation of removing one module override. A refusal replaces the description. */
export function RemoveOverrideDialog(props: RemoveOverrideDialogProps): ReactElement {
  const { organizationId, moduleOverrideId, labels, onClose } = props;
  const { t } = useTranslator();
  const submit = useFormSubmit();
  const finish = useFinishAction(onClose);
  const [isBusy, setIsBusy] = useState(false);

  async function handleConfirm(): Promise<void> {
    if (isBusy) return;
    setIsBusy(true);
    const isRemoved = await submit.run(() =>
      deleteModuleOverride(organizationId, moduleOverrideId),
    );
    setIsBusy(false);
    if (isRemoved) await finish(labels["platform.override.removed"]);
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title={labels["platform.override.removeTitle"]}
      description={
        submit.failure
          ? t(submit.failure.messageKey, submit.failure.values)
          : labels["platform.override.removeDescription"]
      }
      confirmLabel={labels["platform.override.remove"]}
      cancelLabel={t("common.cancel")}
      closeLabel={t("shell.closeMenu")}
      tone="danger"
      onConfirm={() => void handleConfirm()}
    />
  );
}
