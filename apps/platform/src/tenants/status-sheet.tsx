"use client";

import { platformReasonRequestSchema } from "@banijjik/validation";
import { useState, type ReactElement } from "react";
import { changeTenantStatus, type TenantStatusAction } from "../api/platform-api";
import { FormSheet } from "../forms/form-sheet";
import { ReasonField } from "../forms/reason-field";
import { issuesToFieldErrors } from "../forms/schema-errors";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import type { TenantActionContext } from "./tenant-action-labels";

export interface StatusSheetProps {
  action: TenantStatusAction;
  context: TenantActionContext;
  onClose: () => void;
}

/** Suspend or reactivate: a mandatory reason, and a dialog that says what the tenant's staff will see. */
export function StatusSheet({ action, context, onClose }: StatusSheetProps): ReactElement {
  const { labels, organizationId } = context;
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const submit = useFormSubmit();
  const finish = useFinishAction(onClose);

  async function handleSubmit(): Promise<void> {
    const parsed = platformReasonRequestSchema.safeParse({ reason });
    setReasonError(
      parsed.success ? undefined : issuesToFieldErrors(parsed.error.issues, { reason })["reason"],
    );
    if (!parsed.success) return;
    if (await submit.run(() => changeTenantStatus(organizationId, action, parsed.data))) {
      await finish(labels[`platform.sheet.${action}.success`]);
    }
  }

  return (
    <FormSheet
      title={labels[`platform.sheet.${action}.title`]}
      description={labels[`platform.sheet.${action}.description`]}
      submitLabel={labels[`platform.action.${action}`]}
      isDanger={action === "suspend"}
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() => void handleSubmit()}
      onClose={onClose}
    >
      <ReasonField
        fieldId="status-reason"
        label={labels["platform.field.reason"]}
        hint={labels["platform.field.reasonHint"]}
        value={reason}
        errorKey={reasonError}
        onChange={setReason}
      />
    </FormSheet>
  );
}
