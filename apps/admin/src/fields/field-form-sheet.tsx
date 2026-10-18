"use client";

import {
  CONTACT_ROLE,
  type ContactRole,
  type CustomFieldEntityType,
  type CustomFieldType,
} from "@banijjik/contracts";
import { Button, Checkbox, FormField, Sheet, SheetContent, Textarea } from "@banijjik/ui";
import { useState, type FormEvent, type ReactElement } from "react";
import { createCustomField, updateCustomField } from "../lib/api/tenant-config-api";
import { SettingsSelect } from "../settings/settings-select";
import { SettingsTextField } from "../settings/settings-text-field";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit, type SheetSendResult } from "../settings/use-sheet-submit";
import { useTranslator } from "@banijjik/web-client/client";
import { buildFieldCreate, buildFieldUpdate } from "./field-form";
import {
  FIELD_FORM_NAMES,
  FIELD_TYPE_CHOICES,
  needsOptions,
  type FieldFormState,
} from "./field-state";
import type { FieldLabels } from "./field-labels";
import type { FieldRowView } from "./field-rows";

export interface FieldFormSheetProps {
  organizationId: string;
  entityType: CustomFieldEntityType;
  initial: FieldFormState;
  /** The business field being edited; absent when the sheet adds one. */
  field?: FieldRowView;
  labels: FieldLabels;
  onClose: () => void;
}

interface PartProps {
  form: FieldFormState;
  labels: FieldLabels;
  errors: Partial<Record<string, string>>;
  isEdit: boolean;
  onChange: (changes: Partial<FieldFormState>) => void;
}

function IdentityFields({ form, labels, errors, isEdit, onChange }: PartProps): ReactElement {
  const { formFields } = labels;
  const typeOptions = FIELD_TYPE_CHOICES.map((fieldType) => ({
    value: fieldType,
    label: labels.types[fieldType],
  }));
  return (
    <>
      <SettingsTextField
        fieldId="field-fieldKey"
        label={formFields.fieldKey}
        hint={isEdit ? labels.lockedHint : formFields.fieldKeyHint}
        value={form.fieldKey}
        errorKey={errors["fieldKey"]}
        isRequired
        onChange={(value) => onChange({ fieldKey: value })}
        disabled={isEdit}
      />
      <SettingsTextField
        fieldId="field-labelBn"
        label={formFields.labelBn}
        value={form.labelBn}
        errorKey={errors["labelBn"]}
        isRequired
        onChange={(value) => onChange({ labelBn: value })}
      />
      <SettingsTextField
        fieldId="field-labelEn"
        label={formFields.labelEn}
        value={form.labelEn}
        errorKey={errors["labelEn"]}
        isRequired
        onChange={(value) => onChange({ labelEn: value })}
      />
      <SettingsSelect
        fieldId="field-fieldType"
        label={isEdit ? `${formFields.fieldType} · ${labels.lockedHint}` : formFields.fieldType}
        value={form.fieldType}
        options={typeOptions}
        disabled={isEdit}
        // Safe: the options are the field type choices, so the chosen value is one of them.
        onChange={(value) => onChange({ fieldType: value as CustomFieldType })}
      />
    </>
  );
}

function OptionsField({ form, labels, errors, onChange }: PartProps): ReactElement | null {
  const { t } = useTranslator();
  if (!needsOptions(form.fieldType)) return null;
  const errorKey = errors["options"];
  return (
    <FormField
      label={labels.formFields.options}
      htmlFor="field-options"
      hint={labels.formFields.optionsHint}
      error={errorKey === undefined ? undefined : t(errorKey)}
      required
    >
      <Textarea
        id="field-options"
        rows={4}
        value={form.optionsText}
        onChange={(event) => onChange({ optionsText: event.target.value })}
      />
    </FormField>
  );
}

function TraitFields({ form, labels, errors, onChange }: PartProps): ReactElement {
  const { formFields } = labels;
  return (
    <>
      <Checkbox
        label={formFields.isRequired}
        checked={form.isRequired}
        onChange={(event) => onChange({ isRequired: event.target.checked })}
      />
      <Checkbox
        label={formFields.isSensitive}
        checked={form.isSensitive}
        onChange={(event) => onChange({ isSensitive: event.target.checked })}
      />
      <Checkbox
        label={formFields.isSearchable}
        checked={form.isSearchable}
        onChange={(event) => onChange({ isSearchable: event.target.checked })}
      />
      <Checkbox
        label={formFields.botAsk}
        checked={form.botAsk}
        onChange={(event) => onChange({ botAsk: event.target.checked })}
      />
      <SettingsTextField
        fieldId="field-sortOrder"
        label={formFields.sortOrder}
        value={form.sortOrder}
        errorKey={errors["sortOrder"]}
        inputMode="numeric"
        onChange={(value) => onChange({ sortOrder: value })}
      />
    </>
  );
}

/** Which contact roles use the field; nothing chosen means every role (ADR-113). */
function RoleFields({ form, labels, onChange }: PartProps): ReactElement {
  const chosen = form.appliesToContactRoles;
  function toggle(role: ContactRole, isOn: boolean): void {
    onChange({
      appliesToContactRoles: isOn ? [...chosen, role] : chosen.filter((item) => item !== role),
    });
  }
  return (
    <FormField
      label={labels.formFields.appliesToRoles}
      htmlFor="field-roles"
      hint={labels.formFields.allRoles}
    >
      <div id="field-roles" className="flex flex-col gap-2">
        {Object.values(CONTACT_ROLE).map((role) => (
          <Checkbox
            key={role}
            label={labels.roles[role]}
            checked={chosen.includes(role)}
            onChange={(event) => toggle(role, event.target.checked)}
          />
        ))}
      </div>
    </FormField>
  );
}

/**
 * Adds a business field, or edits one. Key and type are locked after create and an option can only be
 * added (ADR-102). Loaded on the first tap of "Add field" or "Edit".
 */
export function FieldFormSheet(props: FieldFormSheetProps): ReactElement {
  const { organizationId, entityType, field, labels } = props;
  const [form, setForm] = useState<FieldFormState>(props.initial);

  async function send(): Promise<SheetSendResult> {
    if (field?.customFieldDefinitionId !== undefined) {
      const update = buildFieldUpdate(form, field);
      if (!update.ok) return update;
      if (update.body !== undefined) {
        await updateCustomField(organizationId, field.customFieldDefinitionId, update.body);
      }
      return { ok: true };
    }
    const create = buildFieldCreate(form, entityType);
    if (!create.ok) return create;
    await createCustomField(organizationId, create.body);
    return { ok: true };
  }

  const state = useSheetSubmit({ fieldNames: FIELD_FORM_NAMES, onClose: props.onClose, send });
  const part: PartProps = {
    form,
    labels,
    errors: state.errors,
    isEdit: field !== undefined,
    onChange: (changes) => setForm({ ...form, ...changes }),
  };
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : props.onClose())}>
      <SheetContent
        title={field === undefined ? labels.createTitle : labels.editTitle}
        closeLabel={labels.close}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <IdentityFields {...part} />
          <OptionsField {...part} />
          {entityType === "contact" ? <RoleFields {...part} /> : null}
          <TraitFields {...part} />
          <SheetFeedback state={state} conflict={labels.conflict} reload={labels.reload} />
          <Button type="submit" isLoading={state.isSaving}>
            {labels.save}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
