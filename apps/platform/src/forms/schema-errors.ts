import { VALIDATION_FALLBACK_MESSAGE_KEY, VALIDATION_MESSAGE_KEYS } from "@banijjik/contracts";
import type { z } from "zod";

/** Message key per form field; a field without an entry has no error. */
export type FieldErrors = Partial<Record<string, string>>;

const REQUIRED_KEY = "validation.required";
const IDENTIFIER_FIELD = "identifier";
const IDENTIFIER_REQUIRED_KEY = "validation.identifier_required";

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || String(value).trim() === "";
}

function messageKeyForIssue(field: string, issueCode: string, isFieldEmpty: boolean): string {
  if (isFieldEmpty) return field === IDENTIFIER_FIELD ? IDENTIFIER_REQUIRED_KEY : REQUIRED_KEY;
  const messageKey = `validation.${issueCode}`;
  return VALIDATION_MESSAGE_KEYS.includes(messageKey)
    ? messageKey
    : VALIDATION_FALLBACK_MESSAGE_KEY;
}

/**
 * Turns the issues of the shared Zod schemas into one message key per field, the first issue winning.
 * An empty field always reads "required", whatever Zod reported, so the person is told what to do.
 */
export function issuesToFieldErrors(
  issues: readonly z.core.$ZodIssue[],
  values: Readonly<Record<string, unknown>>,
): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of issues) {
    const field = String(issue.path[0] ?? "");
    if (fieldErrors[field] !== undefined) continue;
    fieldErrors[field] = messageKeyForIssue(field, issue.code, isEmpty(values[field]));
  }
  return fieldErrors;
}
