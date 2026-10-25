"use client";

import type { StorefrontListingField } from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import { Checkbox, FormField, Select, Textarea, TextInput } from "@banijjik/ui";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";
import { fieldKindOf, type FieldKind } from "./field-kind";
import { districtOptions, divisionOptions } from "./geo-bd-options";

export interface FieldInputProps {
  readonly field: StorefrontListingField;
  readonly value: unknown;
  readonly error: string | undefined;
  readonly locale: Locale;
  readonly translator: Translator;
  readonly onChange: (value: unknown) => void;
}

const INPUT_TYPE_BY_KIND: Readonly<Partial<Record<FieldKind, string>>> = {
  number: "number",
  decimal: "text",
  date: "date",
  phone: "tel",
  email: "email",
  url: "url",
};

const INPUT_MODE_BY_KIND: Readonly<Partial<Record<FieldKind, "numeric" | "decimal" | "tel">>> = {
  number: "numeric",
  decimal: "decimal",
  phone: "tel",
};

function textOf(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function optionLabel(field: StorefrontListingField, option: string, locale: Locale): string {
  const label = field.optionLabels?.[option];
  return label === undefined ? option : localizedText(label, locale);
}

/** The one input of a listing field. Labels come from the field definition, never from the industry. */
export function FieldInput(props: FieldInputProps): ReactElement {
  const { field, error, locale } = props;
  const kind = fieldKindOf(field.fieldType);
  const label = localizedText(field.label, locale);
  const id = `field-${field.fieldKey}`;
  if (kind === "boolean") return <BooleanField {...props} id={id} label={label} />;
  if (kind === "geo") return <GeoField {...props} id={id} label={label} />;
  return (
    <FormField label={label} htmlFor={id} required={field.isRequired} error={error}>
      <ControlFor kind={kind} {...props} id={id} />
    </FormField>
  );
}

interface ControlForProps extends FieldInputProps {
  readonly id: string;
  readonly kind: FieldKind;
}

function ControlFor(props: ControlForProps): ReactElement {
  if (props.kind === "select") return <SelectControl {...props} />;
  if (props.kind === "multiSelect") return <MultiSelectControl {...props} />;
  if (props.kind === "longText") return <LongTextControl {...props} />;
  return <TextControl {...props} />;
}

function TextControl({ field, value, id, kind, onChange }: ControlForProps): ReactElement {
  return (
    <TextInput
      id={id}
      name={field.fieldKey}
      type={INPUT_TYPE_BY_KIND[kind] ?? "text"}
      inputMode={INPUT_MODE_BY_KIND[kind]}
      maxLength={field.validation?.maxLength}
      value={textOf(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function LongTextControl({ field, value, id, onChange }: ControlForProps): ReactElement {
  return (
    <Textarea
      id={id}
      name={field.fieldKey}
      maxLength={field.validation?.maxLength}
      value={textOf(value)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function SelectControl({ field, value, id, locale, onChange }: ControlForProps): ReactElement {
  return (
    <Select
      id={id}
      name={field.fieldKey}
      value={textOf(value)}
      onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
    >
      <option value="" />
      {(field.options ?? []).map((option) => (
        <option key={option} value={option}>
          {optionLabel(field, option, locale)}
        </option>
      ))}
    </Select>
  );
}

function MultiSelectControl({ field, value, locale, onChange }: ControlForProps): ReactElement {
  const selected: readonly string[] = Array.isArray(value) ? value.map(String) : [];
  return (
    <fieldset className="flex flex-col gap-2">
      {(field.options ?? []).map((option) => (
        <Checkbox
          key={option}
          name={field.fieldKey}
          value={option}
          checked={selected.includes(option)}
          label={optionLabel(field, option, locale)}
          onChange={(event) => {
            const next = event.target.checked
              ? [...selected, option]
              : selected.filter((item) => item !== option);
            onChange(next);
          }}
        />
      ))}
    </fieldset>
  );
}

function BooleanField({
  field,
  value,
  id,
  error,
  locale,
  onChange,
}: FieldInputProps & { readonly id: string; readonly label: string }): ReactElement {
  const label = localizedText(field.label, locale);
  return (
    <div className="flex flex-col gap-1.5">
      <Checkbox
        id={id}
        name={field.fieldKey}
        checked={value === true}
        label={field.isRequired ? `${label} *` : label}
        onChange={(event) => onChange(event.target.checked)}
      />
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

interface GeoFieldProps extends FieldInputProps {
  readonly id: string;
  readonly label: string;
}

/** Division, then district: the district list is the division's own (BBS registry). */
function GeoField({
  field,
  value,
  id,
  label,
  error,
  locale,
  onChange,
  translator,
}: GeoFieldProps): ReactElement {
  const geo = (typeof value === "object" && value !== null ? value : {}) as {
    divisionKey?: string;
    districtKey?: string;
  };
  const districts = districtOptions(geo.divisionKey);
  return (
    <FormField label={label} htmlFor={`${id}-division`} required={field.isRequired} error={error}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          id={`${id}-division`}
          name={`${field.fieldKey}.divisionKey`}
          value={geo.divisionKey ?? ""}
          onChange={(event) => onChange({ divisionKey: event.target.value })}
        >
          <option value="" />
          {divisionOptions().map((division) => (
            <option key={division.divisionKey} value={division.divisionKey}>
              {localizedText(division.name, locale)}
            </option>
          ))}
        </Select>
        <Select
          id={`${id}-district`}
          name={`${field.fieldKey}.districtKey`}
          aria-label={translator.t("storefront.fields.district")}
          value={geo.districtKey ?? ""}
          disabled={geo.divisionKey === undefined}
          onChange={(event) =>
            onChange({ divisionKey: geo.divisionKey, districtKey: event.target.value })
          }
        >
          <option value="" />
          {districts.map((district) => (
            <option key={district.districtKey} value={district.districtKey}>
              {localizedText(district.name, locale)}
            </option>
          ))}
        </Select>
      </div>
    </FormField>
  );
}
