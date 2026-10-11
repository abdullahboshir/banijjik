"use client";

import { LIMIT_KEY_VALUES, type LimitKey } from "@banijjik/contracts";
import { Checkbox, FormField, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import type { PackageDraft } from "./package-draft";
import type { PackageFormLabels } from "./package-form-labels";

export interface LimitFieldsProps {
  draft: PackageDraft;
  limitLabels: Record<LimitKey, string>;
  labels: PackageFormLabels;
  isReadOnly: boolean;
  /** A message, already translated, shown under the group. */
  error: string | undefined;
  onChange: (draft: PackageDraft) => void;
}

interface LimitRowProps extends LimitFieldsProps {
  limitKey: LimitKey;
}

function IncrementField({
  limitKey,
  draft,
  limitLabels,
  labels,
  isReadOnly,
  onChange,
}: LimitRowProps): ReactElement {
  return (
    <FormField
      label={`${labels["platform.package.increments"]}: ${limitLabels[limitKey]}`}
      htmlFor={`increment-${limitKey}`}
    >
      <TextInput
        id={`increment-${limitKey}`}
        name={`increment-${limitKey}`}
        type="number"
        inputMode="numeric"
        min={0}
        disabled={isReadOnly}
        value={draft.increments[limitKey]}
        onChange={(event) =>
          onChange({
            ...draft,
            increments: { ...draft.increments, [limitKey]: event.target.value },
          })
        }
      />
    </FormField>
  );
}

function LimitRow(props: LimitRowProps): ReactElement {
  const { limitKey, draft, limitLabels, labels, isReadOnly, onChange } = props;
  const limit = draft.limits[limitKey];
  const setLimit = (next: typeof limit): void =>
    onChange({ ...draft, limits: { ...draft.limits, [limitKey]: next } });
  return (
    <div className="flex flex-col">
      <FormField label={limitLabels[limitKey]} htmlFor={`limit-${limitKey}`}>
        <TextInput
          id={`limit-${limitKey}`}
          name={`limit-${limitKey}`}
          type="number"
          inputMode="numeric"
          min={0}
          disabled={isReadOnly || limit.isUnlimited}
          value={limit.isUnlimited ? "" : limit.value}
          onChange={(event) => setLimit({ ...limit, value: event.target.value })}
        />
      </FormField>
      <Checkbox
        label={labels["platform.package.unlimited"]}
        checked={limit.isUnlimited}
        disabled={isReadOnly}
        onChange={(event) => setLimit({ value: "", isUnlimited: event.target.checked })}
      />
      {draft.isAddOn ? <IncrementField {...props} /> : null}
    </div>
  );
}

/** One row per limit: a count or "unlimited". An add-on also has an increment per limit. */
export function LimitFields(props: LimitFieldsProps): ReactElement {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-small font-semibold text-primary">
        {props.labels["platform.package.limits"]}
      </legend>
      <p className="text-small text-secondary">{props.labels["platform.package.limitsHint"]}</p>
      {props.draft.isAddOn ? (
        <p className="text-small text-secondary">
          {props.labels["platform.package.incrementsHint"]}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {LIMIT_KEY_VALUES.map((limitKey) => (
          <LimitRow key={limitKey} {...props} limitKey={limitKey} />
        ))}
      </div>
      {props.error ? (
        <p role="alert" className="text-small text-danger">
          {props.error}
        </p>
      ) : null}
    </fieldset>
  );
}
