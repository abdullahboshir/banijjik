import { CUSTOM_FIELD_TYPE, type CustomFieldType } from "@banijjik/contracts";
import { z, type ZodType } from "zod";
import { emailSchema } from "../email.js";
import { phoneE164Schema } from "../phone.js";
import { uuidV7Schema } from "../uuid-v7.schema.js";
import { contactLinkCreateSchema } from "./contact-link-input.js";
import {
  CUSTOM_FIELD_DECIMAL_PATTERN,
  CUSTOM_FIELD_LONG_TEXT_MAX_LENGTH,
  CUSTOM_FIELD_MULTI_SELECT_MAX,
  CUSTOM_FIELD_SAFE_INTEGER_MAX,
  CUSTOM_FIELD_SAFE_INTEGER_MIN,
  CUSTOM_FIELD_TEXT_MAX_LENGTH,
  CUSTOM_FIELD_URL_MAX_LENGTH,
  isRealCalendarDay,
  isRealDateTime,
} from "./custom-field-limits.js";
import type { CustomFieldRule } from "./custom-field-rule.js";

const HTTP_PREFIX = "http://";
const HTTPS_PREFIX = "https://";

function textLimit(field: CustomFieldRule, fallback: number): number {
  const requested = field.validation?.maxLength;
  if (requested === undefined) return fallback;
  return Math.min(requested, fallback);
}

function textValue(field: CustomFieldRule): ZodType {
  return z.string().trim().min(1).max(textLimit(field, CUSTOM_FIELD_TEXT_MAX_LENGTH));
}

function longTextValue(field: CustomFieldRule): ZodType {
  return z.string().trim().min(1).max(textLimit(field, CUSTOM_FIELD_LONG_TEXT_MAX_LENGTH));
}

function integerValue(field: CustomFieldRule): ZodType {
  const min = field.validation?.min ?? CUSTOM_FIELD_SAFE_INTEGER_MIN;
  const max = field.validation?.max ?? CUSTOM_FIELD_SAFE_INTEGER_MAX;
  return z.number().int().min(min).max(max);
}

function decimalValue(): ZodType {
  return z.string().regex(CUSTOM_FIELD_DECIMAL_PATTERN);
}

function dateValue(): ZodType {
  return z.string().refine(isRealCalendarDay);
}

function dateTimeValue(): ZodType {
  return z
    .string()
    .refine(isRealDateTime)
    .transform((value) => new Date(value).toISOString());
}

function selectValue(field: CustomFieldRule): ZodType {
  const options = field.options ?? [];
  return z.string().refine((value) => options.includes(value));
}

function multiSelectValue(field: CustomFieldRule): ZodType {
  const options = new Set(field.options ?? []);
  return z
    .array(z.string())
    .max(CUSTOM_FIELD_MULTI_SELECT_MAX)
    .refine((values) => new Set(values).size === values.length)
    .refine((values) => values.every((value) => options.has(value)));
}

function isHttpUrl(value: string): boolean {
  if (!value.startsWith(HTTP_PREFIX) && !value.startsWith(HTTPS_PREFIX)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

function urlValue(): ZodType {
  return z.string().max(CUSTOM_FIELD_URL_MAX_LENGTH).refine(isHttpUrl);
}

/** Only a contact-link field takes `{ create }`; every other reference stays a plain id (ADR-073). */
function referenceValue(field: CustomFieldRule, acceptsCreate: boolean): ZodType {
  if (field.link === undefined || !acceptsCreate) return uuidV7Schema;
  return z.union([uuidV7Schema, contactLinkCreateSchema]);
}

function valueOfType(field: CustomFieldRule, acceptsCreate: boolean): ZodType {
  const parsers: Record<CustomFieldType, () => ZodType> = {
    [CUSTOM_FIELD_TYPE.TEXT]: () => textValue(field),
    [CUSTOM_FIELD_TYPE.LONG_TEXT]: () => longTextValue(field),
    [CUSTOM_FIELD_TYPE.NUMBER]: () => integerValue(field),
    [CUSTOM_FIELD_TYPE.DECIMAL]: () => decimalValue(),
    [CUSTOM_FIELD_TYPE.CURRENCY]: () => integerValue(field),
    [CUSTOM_FIELD_TYPE.BOOLEAN]: () => z.boolean(),
    [CUSTOM_FIELD_TYPE.DATE]: () => dateValue(),
    [CUSTOM_FIELD_TYPE.DATETIME]: () => dateTimeValue(),
    [CUSTOM_FIELD_TYPE.SELECT]: () => selectValue(field),
    [CUSTOM_FIELD_TYPE.MULTI_SELECT]: () => multiSelectValue(field),
    [CUSTOM_FIELD_TYPE.PHONE]: () => phoneE164Schema,
    [CUSTOM_FIELD_TYPE.EMAIL]: () => emailSchema,
    [CUSTOM_FIELD_TYPE.URL]: () => urlValue(),
    [CUSTOM_FIELD_TYPE.FILE]: () => uuidV7Schema,
    [CUSTOM_FIELD_TYPE.IMAGE]: () => uuidV7Schema,
    [CUSTOM_FIELD_TYPE.REFERENCE]: () => referenceValue(field, acceptsCreate),
  };
  return parsers[field.fieldType]();
}

/** On UPDATE an absent key leaves the stored value. `null` clears an optional field and is refused for a required one. */
export function fieldValueSchema(
  field: CustomFieldRule,
  mode: "CREATE" | "UPDATE",
  acceptsContactLinkCreate = false,
): ZodType {
  const parsed = valueOfType(field, acceptsContactLinkCreate);
  if (mode === "UPDATE") {
    return field.isRequired ? parsed.optional() : parsed.nullable().optional();
  }
  return field.isRequired ? parsed : parsed.nullable().optional();
}
