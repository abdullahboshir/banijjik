import {
  CUSTOM_FIELD_TYPE,
  VALIDATION_FALLBACK_MESSAGE_KEY,
  VALIDATION_MESSAGE_KEYS,
  type CustomFieldType,
  type EffectiveCustomField,
  type LocalizedText,
} from "@banijjik/contracts";
import type { Locale, Translator } from "@banijjik/i18n";
import type { CustomFieldDescriptor, CustomFieldInputKind, PendingCustomField } from "@banijjik/ui";
import {
  buildCustomFieldValuesSchema,
  CUSTOM_FIELD_VALUE_MODE,
  type CustomFieldRule,
  type CustomFieldValueMode,
  type CustomFieldValuesOptions,
} from "@banijjik/validation";

const PENDING_FIELD_TYPES = new Set<CustomFieldType>([
  CUSTOM_FIELD_TYPE.FILE,
  CUSTOM_FIELD_TYPE.IMAGE,
  CUSTOM_FIELD_TYPE.REFERENCE,
]);

/** Presentation kinds. NUMBER and CURRENCY keep the contract names and map to integer and money inputs. */
const INPUT_KIND_BY_TYPE: Readonly<Record<CustomFieldType, CustomFieldInputKind | undefined>> = {
  [CUSTOM_FIELD_TYPE.TEXT]: "TEXT",
  [CUSTOM_FIELD_TYPE.LONG_TEXT]: "LONG_TEXT",
  [CUSTOM_FIELD_TYPE.NUMBER]: "INTEGER",
  [CUSTOM_FIELD_TYPE.DECIMAL]: "DECIMAL",
  [CUSTOM_FIELD_TYPE.CURRENCY]: "MONEY",
  [CUSTOM_FIELD_TYPE.BOOLEAN]: "BOOLEAN",
  [CUSTOM_FIELD_TYPE.DATE]: "DATE",
  [CUSTOM_FIELD_TYPE.DATETIME]: "DATETIME",
  [CUSTOM_FIELD_TYPE.SELECT]: "SELECT",
  [CUSTOM_FIELD_TYPE.MULTI_SELECT]: "MULTI_SELECT",
  [CUSTOM_FIELD_TYPE.PHONE]: "PHONE",
  [CUSTOM_FIELD_TYPE.EMAIL]: "EMAIL",
  [CUSTOM_FIELD_TYPE.URL]: "URL",
  [CUSTOM_FIELD_TYPE.FILE]: undefined,
  [CUSTOM_FIELD_TYPE.IMAGE]: undefined,
  [CUSTOM_FIELD_TYPE.REFERENCE]: undefined,
};

export interface CustomFieldFormModel {
  readonly fields: readonly CustomFieldDescriptor[];
  readonly pendingFieldKeys: readonly string[];
  readonly pendingFields: readonly PendingCustomField[];
  readonly chooseLabel: string;
  readonly notEditableText: string;
}

function preferredLabel(label: LocalizedText, locale: Locale): string {
  const text = label[locale].trim();
  if (text.length > 0) return text;
  const other = locale === "bn" ? label.en : label.bn;
  return other.trim();
}

function toDescriptor(
  field: EffectiveCustomField,
  locale: Locale,
): CustomFieldDescriptor | undefined {
  const inputKind = INPUT_KIND_BY_TYPE[field.fieldType];
  if (inputKind === undefined) return undefined;
  const maxLength = field.validation?.maxLength;
  return {
    fieldKey: field.fieldKey,
    inputKind,
    label: preferredLabel(field.label, locale),
    isRequired: field.isRequired,
    ...(maxLength === undefined ? {} : { maxLength }),
    ...(field.options === undefined
      ? {}
      : {
          options: field.options.map((value) => ({
            value,
            label: field.optionLabels?.[value]?.[locale] ?? value,
          })),
        }),
  };
}

function toPending(field: EffectiveCustomField, locale: Locale): PendingCustomField {
  return { fieldKey: field.fieldKey, label: preferredLabel(field.label, locale) };
}

/** Admin-visible fields only. File, image and reference stay pending until their own modules exist. */
export function toFieldDescriptors(
  fields: readonly EffectiveCustomField[],
  locale: Locale,
  t: Translator["t"],
): CustomFieldFormModel {
  const visible = fields.filter((field) => field.visibility.admin);
  const pending = visible.filter((field) => PENDING_FIELD_TYPES.has(field.fieldType));
  const descriptors = visible
    .map((field) => toDescriptor(field, locale))
    .filter((field): field is CustomFieldDescriptor => field !== undefined);
  return {
    fields: descriptors,
    pendingFieldKeys: pending.map((field) => field.fieldKey),
    pendingFields: pending.map((field) => toPending(field, locale)),
    chooseLabel: t("form.field.choose"),
    notEditableText: t("form.field.notEditableHere"),
  };
}

function toRule(field: EffectiveCustomField): CustomFieldRule {
  return {
    fieldKey: field.fieldKey,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    visibility: field.visibility,
    isSensitive: field.isSensitive,
    isSearchable: field.isSearchable,
    ...(field.options === undefined ? {} : { options: field.options }),
    ...(field.validation === undefined ? {} : { validation: field.validation }),
  };
}

/** Same closed set as the API: a Zod code the catalogs do not know becomes validation.custom. */
function messageKeyFor(code: string): string {
  const messageKey = `validation.${code}`;
  if (VALIDATION_MESSAGE_KEYS.includes(messageKey)) return messageKey;
  return VALIDATION_FALLBACK_MESSAGE_KEY;
}

export function validateCustomFieldValues(
  fields: readonly EffectiveCustomField[],
  values: Readonly<Record<string, unknown>>,
  options: CustomFieldValuesOptions,
): Record<string, string> {
  const parsed = buildCustomFieldValuesSchema(fields.map(toRule), options).safeParse(values);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const fieldKey = issue.path[0];
    if (typeof fieldKey !== "string" || errors[fieldKey] !== undefined) continue;
    errors[fieldKey] = messageKeyFor(issue.code);
  }
  return errors;
}

function isCleared(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

function clearedRequestValue(
  field: EffectiveCustomField,
  mode: CustomFieldValueMode,
): null | undefined {
  if (mode === CUSTOM_FIELD_VALUE_MODE.UPDATE && !field.isRequired) return null;
  return undefined;
}

/**
 * An emptied optional field is `null` on update (clears it) and omitted on create.
 * File, image and reference are left out: this card cannot edit them.
 */
export function toRequestValues(
  values: Readonly<Record<string, unknown>>,
  fields: readonly EffectiveCustomField[],
  mode: CustomFieldValueMode,
): Record<string, unknown> {
  const request: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.visibility.admin || PENDING_FIELD_TYPES.has(field.fieldType)) continue;
    const value = values[field.fieldKey];
    if (!isCleared(value)) {
      request[field.fieldKey] = value;
      continue;
    }
    const cleared = clearedRequestValue(field, mode);
    if (cleared !== undefined) request[field.fieldKey] = cleared;
  }
  return request;
}
