"use client";

import { FormField, Select } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { FieldErrors } from "../forms/schema-errors";
import { TextFieldRow } from "../forms/text-field-row";
import type { PackageDraft } from "./package-draft";
import type { PackageFormLabels } from "./package-form-labels";

export interface PackageIdentityFieldsProps {
  draft: PackageDraft;
  labels: PackageFormLabels;
  errors: FieldErrors;
  /** True when an existing package is open: its key and kind cannot change. */
  isExisting: boolean;
  /** A seed package shows its translated name, read-only. */
  seedName: string | undefined;
  isReadOnly: boolean;
  onChange: (draft: PackageDraft) => void;
}

/** Key, name and kind of a package. The key is typed in capitals, as the API requires. */
export function PackageIdentityFields(props: PackageIdentityFieldsProps): ReactElement {
  const { draft, labels, errors, onChange } = props;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {props.isExisting ? null : (
        <TextFieldRow
          fieldId="package-key"
          label={labels["platform.package.field.packageKey"]}
          hint={labels["platform.package.field.packageKeyHint"]}
          value={draft.packageKey}
          errorKey={errors["packageKey"]}
          onChange={(value) => onChange({ ...draft, packageKey: value.toUpperCase() })}
        />
      )}
      <TextFieldRow
        fieldId="package-name"
        label={labels["platform.package.field.name"]}
        hint={props.seedName ? labels["platform.package.field.nameSeedHint"] : undefined}
        readOnly={props.isReadOnly || props.seedName !== undefined}
        value={props.seedName ?? draft.name}
        errorKey={errors["name"]}
        onChange={(name) => onChange({ ...draft, name })}
      />
      <FormField label={labels["platform.package.field.kind"]} htmlFor="package-kind">
        <Select
          id="package-kind"
          name="isAddOn"
          disabled={props.isExisting}
          value={draft.isAddOn ? "addOn" : "base"}
          onChange={(event) => onChange({ ...draft, isAddOn: event.target.value === "addOn" })}
        >
          <option value="base">{labels["platform.package.kind.base"]}</option>
          <option value="addOn">{labels["platform.package.kind.addOn"]}</option>
        </Select>
      </FormField>
    </div>
  );
}
