"use client";

import { platformReasonRequestSchema } from "@banijjik/validation";
import { useState, type ReactElement } from "react";
import { FormSheet } from "../forms/form-sheet";
import { ReasonField } from "../forms/reason-field";
import { issuesToFieldErrors } from "../forms/schema-errors";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import { labelsTranslator, type IndustryLabels } from "./industry-labels";
import { formatRemovedItem } from "./removed-items";

export interface TemplateReasonSheetProps {
  title: string;
  submitLabel: string;
  successMessage: string;
  labels: IndustryLabels;
  save: (reason: string) => Promise<unknown>;
  onClose: () => void;
}

/** The reason for one template write. A non-additive change lists every removed item. */
export function TemplateReasonSheet(props: TemplateReasonSheetProps): ReactElement {
  const t = labelsTranslator(props.labels);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const submit = useFormSubmit();
  const finish = useFinishAction(props.onClose);

  async function handleSubmit(): Promise<void> {
    const parsed = platformReasonRequestSchema.safeParse({ reason });
    setReasonError(
      parsed.success ? undefined : issuesToFieldErrors(parsed.error.issues, { reason })["reason"],
    );
    if (!parsed.success) return;
    if (await submit.run(() => props.save(parsed.data.reason))) {
      await finish(props.successMessage);
    }
  }

  return (
    <FormSheet
      title={props.title}
      submitLabel={props.submitLabel}
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() => void handleSubmit()}
      onClose={props.onClose}
    >
      <ReasonField
        fieldId="template-save-reason"
        label={t("platform.field.reason")}
        hint={t("platform.field.reasonHint")}
        value={reason}
        errorKey={reasonError}
        onChange={setReason}
      />
      {submit.failure && submit.failure.removed.length > 0 ? (
        <ul className="flex flex-col gap-1 text-small text-danger">
          {submit.failure.removed.map((token) => (
            <li key={token}>{formatRemovedItem(token, t)}</li>
          ))}
        </ul>
      ) : null}
    </FormSheet>
  );
}
