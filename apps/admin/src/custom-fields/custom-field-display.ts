import {
  CUSTOM_FIELD_TYPE,
  type EffectiveCustomField,
  type LocalizedText,
} from "@banijjik/contracts";
import type { Locale, Translator } from "@banijjik/i18n";
import { formatMoney, formatPhoneForDisplay } from "@banijjik/ui";

/** A reference is shown only when it links a contact (card 3.1b); any other has no screen yet (card 2.7a). */
function isPendingReference(field: EffectiveCustomField): boolean {
  return (
    field.fieldType === CUSTOM_FIELD_TYPE.REFERENCE &&
    !(field.referenceEntity === "contact" && field.link !== undefined)
  );
}

const UPLOADED_FIELD_TYPES = new Set<string>([CUSTOM_FIELD_TYPE.FILE, CUSTOM_FIELD_TYPE.IMAGE]);

/** One line of the read-only list of extra details. `text` is empty when nothing is saved or the value is hidden. */
export interface DetailRow {
  fieldKey: string;
  label: string;
  text: string | undefined;
  /** True for a sensitive value this person may not read; the row says so instead of "Not set". */
  isHidden: boolean;
  /** Where the value leads, for a linked contact. */
  href?: string;
}

/** A linked contact's name and the page that shows it, by contact id. */
export type LinkedContacts = Readonly<Record<string, { name: string; href: string }>>;

export interface DetailRowsInput {
  fields: readonly EffectiveCustomField[];
  values: Readonly<Record<string, unknown>>;
  /** Whether the API shows this person sensitive values (ADR-107). */
  canSeeSensitive: boolean;
  locale: Locale;
  timeZone: string;
  currencyCode: string;
  t: Translator["t"];
  /** The contacts the values link to; a link whose contact is unknown shows as not set. */
  linkedContacts?: LinkedContacts;
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
  // The stored value is a file id: the list says that something is uploaded, not the id.
  if (UPLOADED_FIELD_TYPES.has(field.fieldType)) return input.t("customFields.fileUploaded");
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

function linkedRowOf(
  field: EffectiveCustomField,
  value: unknown,
  input: DetailRowsInput,
): { text: string | undefined; href?: string } | undefined {
  if (field.fieldType !== CUSTOM_FIELD_TYPE.REFERENCE) return undefined;
  const linked = typeof value === "string" ? input.linkedContacts?.[value] : undefined;
  return linked === undefined ? { text: undefined } : { text: linked.name, href: linked.href };
}

/** Admin-visible fields in order, each with its saved value; sensitive ones are marked hidden for a person who may not read them. */
export function detailRowsOf(input: DetailRowsInput): DetailRow[] {
  const rows: DetailRow[] = [];
  for (const field of input.fields) {
    if (!field.visibility.admin || isPendingReference(field)) continue;
    const label = labelOf(field.label, input.locale);
    if (field.isSensitive && !input.canSeeSensitive) {
      rows.push({ fieldKey: field.fieldKey, label, text: undefined, isHidden: true });
      continue;
    }
    const value = input.values[field.fieldKey];
    const linked = linkedRowOf(field, value, input);
    if (linked !== undefined) {
      rows.push({ fieldKey: field.fieldKey, label, isHidden: false, ...linked });
      continue;
    }
    const text = value === undefined || value === null ? undefined : valueText(field, value, input);
    rows.push({ fieldKey: field.fieldKey, label, text: text || undefined, isHidden: false });
  }
  return rows;
}
