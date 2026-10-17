"use client";

import { ERROR_CODE } from "@banijjik/contracts";
import { Button, ConfirmDialog, Sheet, SheetContent } from "@banijjik/ui";
import { useTranslator } from "@banijjik/web-client/client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";
import { knownMessageKeyOrInternal } from "../auth/field-errors";
import { ApiError } from "../lib/api/api-error";
import { archiveCustomField, updateFieldPreferences } from "../lib/api/tenant-config-api";
import { SettingsTextField } from "../settings/settings-text-field";
import { SheetFeedback } from "../settings/sheet-feedback";
import { useSheetSubmit, type SheetSendResult } from "../settings/use-sheet-submit";
import { FieldFormSheet } from "./field-form-sheet";
import { buildPreferenceChange } from "./field-form";
import { formOfField } from "./field-state";
import type { FieldLabels } from "./field-labels";
import type { FieldRowView } from "./field-rows";

export type FieldRowAction = "edit" | "customize" | "hide" | "archive";

export interface FieldDialogsProps {
  organizationId: string;
  field: FieldRowView;
  action: FieldRowAction;
  labels: FieldLabels;
  onClose: () => void;
}

const PREFERENCE_NAMES: readonly string[] = ["labelBn", "labelEn", "sortOrder"];

interface CustomizeForm {
  labelBn: string;
  labelEn: string;
  sortOrder: string;
}

function CustomizeFields({
  form,
  errors,
  labels,
  onChange,
}: {
  form: CustomizeForm;
  errors: Partial<Record<string, string>>;
  labels: FieldLabels;
  onChange: (form: CustomizeForm) => void;
}): ReactElement {
  const { formFields } = labels;
  return (
    <>
      <SettingsTextField
        fieldId="field-labelBn"
        label={formFields.labelBn}
        value={form.labelBn}
        errorKey={errors["labelBn"]}
        isRequired
        onChange={(labelBn) => onChange({ ...form, labelBn })}
      />
      <SettingsTextField
        fieldId="field-labelEn"
        label={formFields.labelEn}
        value={form.labelEn}
        errorKey={errors["labelEn"]}
        isRequired
        onChange={(labelEn) => onChange({ ...form, labelEn })}
      />
      <SettingsTextField
        fieldId="field-sortOrder"
        label={formFields.sortOrder}
        value={form.sortOrder}
        errorKey={errors["sortOrder"]}
        inputMode="numeric"
        onChange={(sortOrder) => onChange({ ...form, sortOrder })}
      />
    </>
  );
}

/** Rename and reorder a template field: the business's label and sort order sit over the template's. */
function CustomizeSheet({
  organizationId,
  field,
  labels,
  onClose,
}: FieldDialogsProps): ReactElement {
  const [form, setForm] = useState<CustomizeForm>({
    labelBn: field.labelBn,
    labelEn: field.labelEn,
    sortOrder: String(field.sortOrder),
  });

  async function send(): Promise<SheetSendResult> {
    const change = buildPreferenceChange(form, field);
    if (!change.ok) return change;
    if (change.body !== undefined) {
      await updateFieldPreferences(organizationId, { preferences: [change.body] });
    }
    return { ok: true };
  }

  const state = useSheetSubmit({ fieldNames: PREFERENCE_NAMES, onClose, send });
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void state.submit();
  }
  return (
    <Sheet open onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent title={`${labels.customizeTitle}: ${field.label}`} closeLabel={labels.close}>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <CustomizeFields form={form} errors={state.errors} labels={labels} onChange={setForm} />
          <SheetFeedback state={state} conflict={labels.conflict} reload={labels.reload} />
          <Button type="submit" isLoading={state.isSaving}>
            {labels.save}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Confirms hiding a template field or archiving a business field. A refusal (a required field, a stale
 * version) stays in the dialog, in place of its description.
 */
function ConfirmChange({
  props,
  run,
  title,
  description,
  confirmLabel,
}: {
  props: FieldDialogsProps;
  run: () => Promise<unknown>;
  title: string;
  description: string;
  confirmLabel: string;
}): ReactElement {
  const { labels, onClose } = props;
  const { t } = useTranslator();
  const router = useRouter();
  const [refusal, setRefusal] = useState<string | undefined>();
  const [isConflict, setIsConflict] = useState(false);

  async function confirm(): Promise<void> {
    try {
      await run();
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
      title={title}
      description={refusal ?? description}
      confirmLabel={confirmLabel}
      cancelLabel={labels.cancel}
      closeLabel={labels.close}
      tone="danger"
      onConfirm={() => void confirm()}
    />
  );
}

/** Loaded on the first tap of a row action, so none of this is in the first load of the route. */
export function FieldDialogs(props: FieldDialogsProps): ReactElement {
  const { organizationId, field, labels, action, onClose } = props;
  if (action === "edit") {
    return (
      <FieldFormSheet
        organizationId={organizationId}
        entityType={field.entityType}
        initial={formOfField(field)}
        field={field}
        labels={labels}
        onClose={onClose}
      />
    );
  }
  if (action === "customize") return <CustomizeSheet {...props} />;
  if (action === "hide") {
    return (
      <ConfirmChange
        props={props}
        title={`${labels.hideTitle}: ${field.label}`}
        description={labels.hideDescription}
        confirmLabel={labels.hideTitle}
        run={() =>
          updateFieldPreferences(organizationId, {
            preferences: [
              {
                entityType: field.entityType,
                fieldKey: field.fieldKey,
                isHidden: true,
                ...(field.version > 0 ? { version: field.version } : {}),
              },
            ],
          })
        }
      />
    );
  }
  return (
    <ConfirmChange
      props={props}
      title={`${labels.archiveTitle}: ${field.label}`}
      description={labels.archiveDescription}
      confirmLabel={labels.archiveTitle}
      run={() =>
        archiveCustomField(organizationId, field.customFieldDefinitionId ?? "", {
          version: field.version,
        })
      }
    />
  );
}
