import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import type { StorefrontListingField } from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import { Button, Checkbox, FormField, TextInput } from "@banijjik/ui";
import Link from "next/link";
import type { ReactElement } from "react";
import { localizedText } from "../i18n/localized-text";
import type { SearchParams } from "../search/search-query";

export interface SearchFiltersProps {
  readonly fields: readonly StorefrontListingField[];
  readonly params: SearchParams;
  readonly locale: Locale;
  readonly translator: Translator;
}

function valuesOf(params: SearchParams, name: string): readonly string[] {
  const value = params[name];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function scalarOf(params: SearchParams, name: string): string {
  return valuesOf(params, name)[0] ?? "";
}

/** The filter form: a plain GET form, so it works without script and the URL keeps the state. */
export function SearchFilters({
  fields,
  params,
  locale,
  translator,
}: SearchFiltersProps): ReactElement {
  return (
    <form
      method="get"
      action="/search"
      className="flex flex-col gap-4 rounded-md border border-default bg-surface p-4"
    >
      <h2 className="text-title font-semibold text-primary">
        {translator.t("storefront.search.filterTitle")}
      </h2>
      {fields.map((field) => (
        <FilterField
          key={field.fieldKey}
          field={field}
          params={params}
          locale={locale}
          translator={translator}
        />
      ))}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary">
          {translator.t("storefront.search.apply")}
        </Button>
        <Link href="/search" className="inline-flex min-h-11 items-center px-2 text-body underline">
          {translator.t("storefront.search.reset")}
        </Link>
      </div>
    </form>
  );
}

interface FilterFieldProps {
  readonly field: StorefrontListingField;
  readonly params: SearchParams;
  readonly locale: Locale;
  readonly translator: Translator;
}

function FilterField({ field, params, locale, translator }: FilterFieldProps): ReactElement {
  const label = localizedText(field.label, locale);
  if (field.fieldType === CUSTOM_FIELD_TYPE.NUMBER) {
    return (
      <RangeInputs
        name={`f.${field.fieldKey}`}
        label={label}
        params={params}
        translator={translator}
      />
    );
  }
  if (field.fieldType === CUSTOM_FIELD_TYPE.DATE) {
    return (
      <AgeRange
        name={`f.${field.fieldKey}`}
        label={label}
        params={params}
        translator={translator}
      />
    );
  }
  return <OptionChoices field={field} label={label} params={params} locale={locale} />;
}

function OptionChoices({
  field,
  label,
  params,
  locale,
}: Omit<FilterFieldProps, "translator"> & { readonly label: string }): ReactElement {
  const selected = valuesOf(params, `f.${field.fieldKey}`);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-body font-semibold text-primary">{label}</legend>
      {(field.options ?? []).map((option) => {
        const optionLabel = field.optionLabels?.[option];
        return (
          <Checkbox
            key={option}
            name={`f.${field.fieldKey}`}
            value={option}
            defaultChecked={selected.includes(option)}
            label={optionLabel === undefined ? option : localizedText(optionLabel, locale)}
          />
        );
      })}
    </fieldset>
  );
}

function RangeInputs({
  name,
  label,
  params,
  translator,
}: {
  readonly name: string;
  readonly label: string;
  readonly params: SearchParams;
  readonly translator: Translator;
}): ReactElement {
  return (
    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="text-body font-semibold text-primary">{label}</legend>
      <FormField label={translator.t("storefront.search.min")} htmlFor={`${name}.min`}>
        <TextInput
          id={`${name}.min`}
          name={`${name}.min`}
          type="number"
          inputMode="numeric"
          defaultValue={scalarOf(params, `${name}.min`)}
        />
      </FormField>
      <FormField label={translator.t("storefront.search.max")} htmlFor={`${name}.max`}>
        <TextInput
          id={`${name}.max`}
          name={`${name}.max`}
          type="number"
          inputMode="numeric"
          defaultValue={scalarOf(params, `${name}.max`)}
        />
      </FormField>
    </fieldset>
  );
}

function AgeRange({
  name,
  label,
  params,
  translator,
}: {
  readonly name: string;
  readonly label: string;
  readonly params: SearchParams;
  readonly translator: Translator;
}): ReactElement {
  return (
    <fieldset className="grid grid-cols-2 gap-3">
      <legend className="text-body font-semibold text-primary">{label}</legend>
      <FormField label={translator.t("storefront.search.ageMin")} htmlFor={`${name}.ageMin`}>
        <TextInput
          id={`${name}.ageMin`}
          name={`${name}.ageMin`}
          type="number"
          inputMode="numeric"
          defaultValue={scalarOf(params, `${name}.ageMin`)}
        />
      </FormField>
      <FormField label={translator.t("storefront.search.ageMax")} htmlFor={`${name}.ageMax`}>
        <TextInput
          id={`${name}.ageMax`}
          name={`${name}.ageMax`}
          type="number"
          inputMode="numeric"
          defaultValue={scalarOf(params, `${name}.ageMax`)}
        />
      </FormField>
    </fieldset>
  );
}
