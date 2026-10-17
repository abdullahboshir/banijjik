"use client";

import type { ReactElement } from "react";
import { CustomFieldsEditor } from "./custom-fields-editor";
import type { CustomFieldsFormProps, CustomFieldsFormState } from "./use-custom-fields-form";

export interface CustomFieldsSectionProps {
  idPrefix: string;
  organizationId: string;
  props: CustomFieldsFormProps | undefined;
  form: CustomFieldsFormState;
}

/** The "Additional details" part of a sheet; nothing is drawn when the business has no such fields for this person. */
export function CustomFieldsSection({
  idPrefix,
  organizationId,
  props,
  form,
}: CustomFieldsSectionProps): ReactElement | null {
  if (props === undefined || form.editableFields.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-1 text-title font-semibold text-primary">{props.title}</legend>
      <CustomFieldsEditor
        idPrefix={idPrefix}
        organizationId={organizationId}
        fields={form.editableFields}
        values={form.values}
        errors={form.errors}
        currencyCode={props.currencyCode}
        onChange={form.setValue}
      />
      {form.hasHiddenFields ? (
        <p className="text-small text-secondary">{props.hiddenHint}</p>
      ) : null}
    </fieldset>
  );
}
