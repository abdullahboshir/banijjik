import {
  CUSTOM_FIELD_TYPE,
  type EffectiveCustomField,
  type LocalizedText,
} from "@banijjik/contracts";
import type { Locale, Translator } from "@banijjik/i18n";
import { formatMoney, formatPhoneForDisplay } from "@banijjik/ui";

/** File, image and reference values have no screen yet, so they are not shown (card 2.7a). */
const PENDING_FIELD_TYPES = new Set<string>([
  CUSTOM_FIELD_TYPE.FILE,
  CUSTOM_FIELD_TYPE.IMAGE,
  CUSTOM_FIELD_TYPE.REFERENCE,
]);

/** One line of the read-only list of extra details. `text` is empty when nothing is saved or the value is hidden. */
export interface DetailRow {
  fieldKey: string;
  label: string;
  text: string | undefined;
  /** True for a sensitive value this person may not read; the row says so instead of "Not set". */
  isHidden: boolean;
}

export interface DetailRowsInput {
  fields: readonly EffectiveCustomField[];
  values: Readonly<Record<string, unknown>>;
  /** Whether the API shows this person sensitive values (ADR-107). */
  canSeeSensitive: boolean;
  locale: Locale;
  timeZone: string;
  currencyCode: string;
  t: Translator["t"];
}

export function labelOf(label: LocalizedText, locale: Locale): string {
  const text = label[locale].trim();
  if (text.length > 0) return text;
  return (locale === "bn" ? label.en : label.bn).trim();
}

function optionLabelOf(field: EffectiveCustomField, value: string, locale: Locale): string {
  return field.optionLabels?.[value]?.[locale] ?? value;
}

function dateTimeText(value: string, input: DetailRowsInput): string {
  return new Intl.DateTimeFormat(input.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: input.timeZone,
  }).format(new Date(value));
}

function numberText(field: EffectiveCustomField, value: number, input: DetailRowsInput): string {
  if (field.fieldType !== CUSTOM_FIELD_TYPE.CURRENCY) return String(value);
  return formatMoney({ amount: value, currency: input.currencyCode }, { locale: input.locale });
}

function stringText(field: EffectiveCustomField, value: string, input: DetailRowsInput): string {
  if (field.fieldType === CUSTOM_FIELD_TYPE.PHONE) return formatPhoneForDisplay(value);
  if (field.fieldType === CUSTOM_FIELD_TYPE.DATETIME) return dateTimeText(value, input);
  if (field.fieldType === CUSTOM_FIELD_TYPE.SELECT)
    return optionLabelOf(field, value, input.locale);
  return value;
}

/** The saved value as a person reads it; a value of an unexpected shape shows as nothing rather than crashing the page. */
function valueText(field: EffectiveCustomField, value: unknown, input: DetailRowsInput): string {
  if (typeof value === "boolean") return input.t(value ? "customFields.yes" : "customFields.no");
  if (Array.isArray(value)) {
    return value.map((item) => optionLabelOf(field, String(item), input.locale)).join(", ");
  }
  if (typeof value === "number") return numberText(field, value, input);
  if (typeof value === "string") return stringText(field, value, input);
  return "";
}

/** Admin-visible fields in order, each with its saved value; sensitive ones are marked hidden for a person who may not read them. */
export function detailRowsOf(input: DetailRowsInput): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const field of input.fields) {
    if (!field.visibility.admin || PENDING_FIELD_TYPES.has(field.fieldType)) continue;
    const label = labelOf(field.label, input.locale);
    if (field.isSensitive && !input.canSeeSensitive) {
      rows.push({ fieldKey: field.fieldKey, label, text: undefined, isHidden: true });
      continue;
    }
    const value = input.values[field.fieldKey];
    const text = value === undefined || value === null ? undefined : valueText(field, value, input);
    rows.push({ fieldKey: field.fieldKey, label, text: text || undefined, isHidden: false });
  }
  return rows;
}
