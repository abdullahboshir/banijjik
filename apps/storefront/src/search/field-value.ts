import { CUSTOM_FIELD_TYPE } from "@banijjik/contracts";
import type { StorefrontListingField } from "@banijjik/contracts/directory";
import type { Locale, Translator } from "@banijjik/i18n";
import { localizedText } from "../i18n/localized-text";

const LIST_SEPARATOR = ", ";

function optionText(field: StorefrontListingField, option: string, locale: Locale): string {
  const label = field.optionLabels?.[option];
  return label === undefined ? option : localizedText(label, locale);
}

function listText(field: StorefrontListingField, value: unknown[], locale: Locale): string {
  return value.map((item) => optionText(field, String(item), locale)).join(LIST_SEPARATOR);
}

/** A listing value as the visitor reads it: option labels, yes or no, and the text for anything else. */
export interface FieldValueInput {
  readonly field: StorefrontListingField;
  readonly value: unknown;
  readonly locale: Locale;
  readonly translator: Translator;
}

export function fieldValueText({
  field,
  value,
  locale,
  translator,
}: FieldValueInput): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (field.fieldType === CUSTOM_FIELD_TYPE.BOOLEAN) {
    return translator.t(value === true ? "storefront.value.yes" : "storefront.value.no");
  }
  if (field.fieldType === CUSTOM_FIELD_TYPE.SELECT) return optionText(field, String(value), locale);
  if (Array.isArray(value)) return listText(field, value, locale);
  return String(value);
}
