"use client";

import { platformOperatorStatusRequestSchema } from "@banijjik/validation";
import { useState, type ReactElement } from "react";
import { changeOperatorStatus, type OperatorStatusAction } from "../api/platform-api";
import { FormSheet } from "../forms/form-sheet";
import { ReasonField } from "../forms/reason-field";
import { issuesToFieldErrors } from "../forms/schema-errors";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import type { OperatorLabels } from "./operator-action-rules";

export interface OperatorStatusSheetProps {
  action: OperatorStatusAction;
  platformOperatorId: string;
  version: number;
  labels: OperatorLabels;
  onClose: () => void;
}

/** Disable or enable: a reason, and a note about which sessions end. */
export function OperatorStatusSheet({
  action,
  platformOperatorId,
  version,
  labels,
  onClose,
}: OperatorStatusSheetProps): ReactElement {
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const submit = useFormSubmit();
  const finish = useFinishAction(onClose);
  const sheetKey = action === "disable" ? "disableOperator" : "enableOperator";

  async function handleSubmit(): Promise<void> {
    const parsed = platformOperatorStatusRequestSchema.safeParse({ version, reason });
    setReasonError(
      parsed.success
        ? undefined
        : issuesToFieldErrors(parsed.error.issues, { version, reason })["reason"],
    );
    if (!parsed.success) return;
    const saved = await submit.run(() =>
      changeOperatorStatus(platformOperatorId, action, parsed.data),
    );
    if (saved) await finish(labels[`platform.sheet.${sheetKey}.success`]);
  }

  return (
    <FormSheet
      title={labels[`platform.sheet.${sheetKey}.title`]}
      description={labels[`platform.sheet.${sheetKey}.description`]}
      submitLabel={labels[`platform.action.${sheetKey}`]}
      isDanger={action === "disable"}
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() => void handleSubmit()}
      onClose={onClose}
    >
      <ReasonField
        fieldId="operator-status-reason"
        label={labels["platform.field.reason"]}
        hint={labels["platform.field.reasonHint"]}
        value={reason}
        errorKey={reasonError}
        onChange={setReason}
      />
    </FormSheet>
  );
}
