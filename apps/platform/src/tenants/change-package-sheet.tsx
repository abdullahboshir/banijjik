"use client";

import { useTranslator } from "@banijjik/web-client/client";
import { Checkbox, FormField, Select } from "@banijjik/ui";
import { platformChangePackageRequestSchema } from "@banijjik/validation";
import { useState, type ReactElement } from "react";
import { changePackage } from "../api/platform-api";
import { FormSheet } from "../forms/form-sheet";
import { issuesToFieldErrors, type FieldErrors } from "../forms/schema-errors";
import { useFinishAction } from "../forms/use-finish-action";
import { useFormSubmit } from "../forms/use-form-submit";
import type { PackageOption, TenantActionContext } from "./tenant-action-labels";

export interface ChangePackageSheetProps {
  context: TenantActionContext;
  onClose: () => void;
}

function toggled(selected: string[], packageId: string, isChecked: boolean): string[] {
  const others = selected.filter((id) => id !== packageId);
  return isChecked ? [...others, packageId] : others;
}

interface AddOnChoicesProps {
  legend: string;
  options: PackageOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

function AddOnChoices({ legend, options, selected, onChange }: AddOnChoicesProps): ReactElement {
  return (
    <fieldset className="flex flex-col">
      <legend className="text-small font-semibold text-primary">{legend}</legend>
      {options.map((option) => (
        <Checkbox
          key={option.packageId}
          label={option.label}
          checked={selected.includes(option.packageId)}
          onChange={(event) => onChange(toggled(selected, option.packageId, event.target.checked))}
        />
      ))}
    </fieldset>
  );
}

/** Change the base package and the add-ons of the subscription. */
export function ChangePackageSheet({ context, onClose }: ChangePackageSheetProps): ReactElement {
  const { labels, organizationId, basePackages } = context;
  const { t } = useTranslator();
  const [basePackageId, setBasePackageId] = useState(context.currentBasePackageId ?? "");
  const [addOnIds, setAddOnIds] = useState(context.currentAddOnPackageIds);
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = useFormSubmit();
  const finish = useFinishAction(onClose);

  async function handleSubmit(): Promise<void> {
    const values = { basePackageId, addOnPackageIds: addOnIds };
    const parsed = platformChangePackageRequestSchema.safeParse(values);
    setErrors(parsed.success ? {} : issuesToFieldErrors(parsed.error.issues, values));
    if (!parsed.success) return;
    if (await submit.run(() => changePackage(organizationId, parsed.data))) {
      await finish(labels["platform.sheet.changePackage.success"]);
    }
  }

  const baseError = errors["basePackageId"];
  return (
    <FormSheet
      title={labels["platform.sheet.changePackage.title"]}
      submitLabel={labels["platform.action.changePackage"]}
      isSubmitting={submit.isSubmitting}
      failure={submit.failure}
      onSubmit={() => void handleSubmit()}
      onClose={onClose}
    >
      <FormField
        label={labels["platform.field.basePackage"]}
        htmlFor="change-base-package"
        error={baseError ? t(baseError) : undefined}
        required
      >
        <Select
          id="change-base-package"
          name="basePackageId"
          value={basePackageId}
          aria-invalid={baseError ? true : undefined}
          onChange={(event) => setBasePackageId(event.target.value)}
        >
          <option value="" disabled>
            {labels["platform.field.basePackage"]}
          </option>
          {basePackages.map((option) => (
            <option key={option.packageId} value={option.packageId}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>
      <AddOnChoices
        legend={labels["platform.field.addOns"]}
        options={context.addOnPackages}
        selected={addOnIds}
        onChange={setAddOnIds}
      />
    </FormSheet>
  );
}
