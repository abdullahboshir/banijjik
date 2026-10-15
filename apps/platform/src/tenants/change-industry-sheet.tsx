"use client";

import { changeIndustryTemplateRequestSchema } from "@banijjik/validation";
import { FormField, Select } from "@banijjik/ui";
import { useState, type ReactElement } from "react";
import { changeIndustryTemplate } from "../api/platform-api";
import { FormSheet } from "../forms/form-sheet";
import { ReasonField } from "../forms/reason-field";
import { issuesToFieldErrors } from "../forms/schema-errors";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import { labelsTranslator } from "../industry-templates/industry-labels";
import { formatRemovedItem } from "../industry-templates/removed-items";
import type { IndustryTemplateOption, TenantActionContext } from "./tenant-action-labels";

/** Moves the tenant onto another template that is not retired. A refusal lists what would be lost. */
export function ChangeIndustrySheet({
  context,
  onClose,
}: {
  context: TenantActionContext;
  onClose: () => void;
}): ReactElement {
  const { labels, organizationId, industryTemplates } = context;
  const [industryTemplateKey, setKey] = useState(industryTemplates[0]?.industryTemplateKey ?? "");
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | undefined>();
  const submit = useFormSubmit();
  const finish = useFinishAction(onClose);

  async function handleSubmit(): Promise<void> {
    const parsed = changeIndustryTemplateRequestSchema.safeParse({ industryTemplateKey, reason });
    setReasonError(
      parsed.success ? undefined : issuesToFieldErrors(parsed.error.issues, { reason })["reason"],
    );
    if (!parsed.success) return;
    if (await submit.run(() => changeIndustryTemplate(organizationId, parsed.data))) {
      await finish(labels["platform.sheet.changeIndustry.success"]);
    }
  }

  return (
    <FormSheet
      title={labels["platform.sheet.changeIndustry.title"]}
      submitLabel={labels["platform.action.changeIndustry"]}
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() => void handleSubmit()}
      onClose={onClose}
    >
      <IndustryTemplateField
        label={labels["platform.field.industryTemplate"]}
        templates={industryTemplates}
        value={industryTemplateKey}
        onChange={setKey}
      />
      <ReasonField
        fieldId="change-industry-reason"
        label={labels["platform.field.reason"]}
        hint={labels["platform.field.reasonHint"]}
        value={reason}
        errorKey={reasonError}
        onChange={setReason}
      />
      <RemovedItems tokens={submit.failure?.removed ?? []} labels={labels} />
    </FormSheet>
  );
}

function IndustryTemplateField(props: {
  label: string | undefined;
  templates: readonly IndustryTemplateOption[];
  value: string;
  onChange: (value: string) => void;
}): ReactElement | null {
  if (props.label === undefined) return null;
  return (
    <FormField label={props.label} htmlFor="change-industry-template">
      <Select
        id="change-industry-template"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      >
        {props.templates.map((template) => (
          <option key={template.industryTemplateKey} value={template.industryTemplateKey}>
            {template.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

function RemovedItems(props: {
  tokens: readonly string[];
  labels: TenantActionContext["labels"];
}): ReactElement | null {
  if (props.tokens.length === 0) return null;
  const t = labelsTranslator(props.labels);
  return (
    <ul className="flex flex-col gap-1 text-small text-danger">
      {props.tokens.map((token) => (
        <li key={token}>{formatRemovedItem(token, t)}</li>
      ))}
    </ul>
  );
}
