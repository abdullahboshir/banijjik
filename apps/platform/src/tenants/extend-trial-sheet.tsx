"use client";

import { FormField, TextInput } from "@banijjik/ui";
import { platformExtendTrialRequestSchema } from "@banijjik/validation";
import { useState, type ReactElement } from "react";
import { extendTrial } from "../api/platform-api";
import { FormSheet } from "../forms/form-sheet";
import { ReasonField } from "../forms/reason-field";
import { issuesToFieldErrors, type FieldErrors } from "../forms/schema-errors";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import { useTranslator } from "../i18n/i18n-provider";
import type { TenantActionContext } from "./tenant-action-labels";

export interface ExtendTrialSheetProps {
  context: TenantActionContext;
  onClose: () => void;
}

/** Extend the trial by 1 to 30 days, with a reason. */
export function ExtendTrialSheet({ context, onClose }: ExtendTrialSheetProps): ReactElement {
  const { labels, organizationId } = context;
  const { t } = useTranslator();
  const [days, setDays] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = useFormSubmit();
  const finish = useFinishAction(onClose);

  async function handleSubmit(): Promise<void> {
    const values = { days: days.trim() === "" ? undefined : Number(days), reason };
    const parsed = platformExtendTrialRequestSchema.safeParse(values);
    setErrors(parsed.success ? {} : issuesToFieldErrors(parsed.error.issues, values));
    if (!parsed.success) return;
    if (await submit.run(() => extendTrial(organizationId, parsed.data))) {
      await finish(labels["platform.sheet.extendTrial.success"]);
    }
  }

  const daysError = errors["days"];
  return (
    <FormSheet
      title={labels["platform.sheet.extendTrial.title"]}
      submitLabel={labels["platform.action.extendTrial"]}
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() => void handleSubmit()}
      onClose={onClose}
    >
      <FormField
        label={labels["platform.field.days"]}
        htmlFor="extend-days"
        error={daysError ? t(daysError) : undefined}
        required
      >
        <TextInput
          id="extend-days"
          name="days"
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          value={days}
          aria-invalid={daysError ? true : undefined}
          onChange={(event) => setDays(event.target.value)}
        />
      </FormField>
      <ReasonField
        fieldId="extend-reason"
        label={labels["platform.field.reason"]}
        hint={labels["platform.field.reasonHint"]}
        value={reason}
        errorKey={errors["reason"]}
        onChange={setReason}
      />
    </FormSheet>
  );
}
