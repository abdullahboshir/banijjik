import { ERROR_CODE } from "@banijjik/contracts";
import type { TranslationValues } from "@banijjik/i18n";
import { ApiError } from "../lib/api/api-error";
import {
  IDENTIFIER_FIELD,
  knownMessageKeyOrInternal,
  toFormField,
  type FieldErrors,
} from "./field-errors";

const SECONDS_PER_MINUTE = 60;

export interface FormMessage {
  messageKey: string;
  values?: TranslationValues;
}

export interface MappedApiError {
  fieldErrors: FieldErrors;
  formMessage?: FormMessage;
}

interface ReceivedField {
  path: string;
  messageKey: string;
}

function readFields(details: ApiError["details"]): ReceivedField[] {
  const fields: unknown = details?.["fields"];
  if (!Array.isArray(fields)) return [];
  return fields.flatMap((field: unknown): ReceivedField[] => {
    if (typeof field !== "object" || field === null) return [];
    const { path, messageKey } = field as Partial<ReceivedField>;
    return typeof path === "string" && typeof messageKey === "string" ? [{ path, messageKey }] : [];
  });
}

function mapValidationFields(error: ApiError, fieldNames: readonly string[]): MappedApiError {
  const fieldErrors: FieldErrors = {};
  let hasUnplacedField = false;
  for (const { path, messageKey } of readFields(error.details)) {
    const field = toFormField(path);
    if (!fieldNames.includes(field)) {
      hasUnplacedField = true;
      continue;
    }
    fieldErrors[field] ??= knownMessageKeyOrInternal(messageKey);
  }
  const hasPlacedField = Object.keys(fieldErrors).length > 0;
  if (hasPlacedField && !hasUnplacedField) return { fieldErrors };
  return { fieldErrors, formMessage: { messageKey: knownMessageKeyOrInternal(error.messageKey) } };
}

function mapRateLimit(error: ApiError): MappedApiError {
  if (error.retryAfterSeconds === undefined) {
    return { fieldErrors: {}, formMessage: { messageKey: "errors.rate_limited" } };
  }
  const minutes = Math.ceil(error.retryAfterSeconds / SECONDS_PER_MINUTE);
  return { fieldErrors: {}, formMessage: { messageKey: "auth.rateLimited", values: { minutes } } };
}

/**
 * Places an API failure on the form: field errors by path, a duplicate on the identifier, a rate limit
 * with its wait, and everything else as one message under the form (plan 1.7a decision 5).
 */
export function mapApiError(error: ApiError, fieldNames: readonly string[]): MappedApiError {
  if (error.code === ERROR_CODE.VALIDATION_ERROR) return mapValidationFields(error, fieldNames);
  if (error.code === ERROR_CODE.DUPLICATE) {
    return { fieldErrors: { [IDENTIFIER_FIELD]: "errors.duplicate" } };
  }
  if (error.code === ERROR_CODE.RATE_LIMITED) return mapRateLimit(error);
  return {
    fieldErrors: {},
    formMessage: { messageKey: knownMessageKeyOrInternal(error.messageKey) },
  };
}
