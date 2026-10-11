"use client";

import {
  MODULE_OVERRIDE_EFFECT,
  type PlatformModuleOverrideCreateRequest,
} from "@banijjik/contracts";
import { FormField, Select } from "@banijjik/ui";
import { platformModuleOverrideCreateRequestSchema } from "@banijjik/validation";
import { useState, type ReactElement } from "react";
import { createModuleOverride } from "../api/platform-api";
import { FormSheet } from "../forms/form-sheet";
import { ReasonField } from "../forms/reason-field";
import { issuesToFieldErrors, type FieldErrors } from "../forms/schema-errors";
import { TextFieldRow } from "../forms/text-field-row";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import { useTranslator } from "../i18n/i18n-provider";
import type { TenantActionContext, TenantActionLabels } from "./tenant-action-labels";

export interface OverrideSheetProps {
  kind: "grantModule" | "revokeModule";
  context: TenantActionContext;
  onClose: () => void;
}

const EFFECT_OF_KIND = {
  grantModule: MODULE_OVERRIDE_EFFECT.PLATFORM_GRANT,
  revokeModule: MODULE_OVERRIDE_EFFECT.PLATFORM_REVOKE,
} as const;

interface OverrideDraft {
  moduleKey: string;
  reason: string;
  expiresAt: string;
}

interface OverrideFieldsProps {
  draft: OverrideDraft;
  errors: FieldErrors;
  labels: TenantActionLabels;
  modules: TenantActionContext["modules"];
  onChange: (draft: OverrideDraft) => void;
}

function OverrideFields({ draft, errors, labels, modules, onChange }: OverrideFieldsProps) {
  const { t } = useTranslator();
  const moduleError = errors["moduleKey"];
  return (
    <>
      <FormField
        label={labels["platform.field.module"]}
        htmlFor="override-module"
        error={moduleError ? t(moduleError) : undefined}
        required
      >
        <Select
          id="override-module"
          name="moduleKey"
          value={draft.moduleKey}
          aria-invalid={moduleError ? true : undefined}
          onChange={(event) => onChange({ ...draft, moduleKey: event.target.value })}
        >
          <option value="" disabled>
            {labels["platform.field.chooseModule"]}
          </option>
          {modules.map((option) => (
            <option key={option.moduleKey} value={option.moduleKey}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>
      <ReasonField
        fieldId="override-reason"
        label={labels["platform.field.reason"]}
        hint={labels["platform.field.reasonHint"]}
        value={draft.reason}
        errorKey={errors["reason"]}
        onChange={(reason) => onChange({ ...draft, reason })}
      />
      <TextFieldRow
        fieldId="override-expires"
        label={labels["platform.field.expiresAt"]}
        hint={labels["platform.field.expiresAtHint"]}
        type="date"
        isRequired={false}
        value={draft.expiresAt}
        errorKey={errors["expiresAt"]}
        onChange={(expiresAt) => onChange({ ...draft, expiresAt })}
      />
    </>
  );
}

/** Grant or revoke one module for this tenant, with a reason and an optional expiry date. */
export function OverrideSheet({ kind, context, onClose }: OverrideSheetProps): ReactElement {
  const { labels, organizationId } = context;
  const [draft, setDraft] = useState<OverrideDraft>({ moduleKey: "", reason: "", expiresAt: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = useFormSubmit();
  const finish = useFinishAction(onClose);

  async function handleSubmit(): Promise<void> {
    const values = {
      moduleKey: draft.moduleKey,
      effect: EFFECT_OF_KIND[kind],
      reason: draft.reason,
      ...(draft.expiresAt === "" ? {} : { expiresAt: draft.expiresAt }),
    };
    const parsed = platformModuleOverrideCreateRequestSchema.safeParse(values);
    setErrors(parsed.success ? {} : issuesToFieldErrors(parsed.error.issues, values));
    if (!parsed.success) return;
    // The request carries the date as the person typed it; the API parses it again.
    const request: PlatformModuleOverrideCreateRequest = {
      moduleKey: parsed.data.moduleKey,
      effect: parsed.data.effect,
      reason: parsed.data.reason,
      ...(draft.expiresAt === "" ? {} : { expiresAt: draft.expiresAt }),
    };
    if (await submit.run(() => createModuleOverride(organizationId, request))) {
      await finish(labels[`platform.sheet.${kind}.success`]);
    }
  }

  return (
    <FormSheet
      title={labels[`platform.sheet.${kind}.title`]}
      submitLabel={labels[`platform.action.${kind}`]}
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() => void handleSubmit()}
      onClose={onClose}
    >
      <OverrideFields
        draft={draft}
        errors={errors}
        labels={labels}
        modules={context.modules}
        onChange={setDraft}
      />
    </FormSheet>
  );
}
