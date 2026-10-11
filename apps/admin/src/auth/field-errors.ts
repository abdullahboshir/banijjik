import { VALIDATION_FALLBACK_MESSAGE_KEY, VALIDATION_MESSAGE_KEYS } from "@banijjik/contracts";
import type { z } from "zod";

/** Message key per form field; a field without an entry has no error. */
export type FieldErrors = Partial<Record<string, string>>;

export const IDENTIFIER_FIELD = "identifier";
const REQUIRED_KEY = "validation.required";
const IDENTIFIER_REQUIRED_KEY = "validation.identifier_required";
/** The API names the identifier by what it turned out to be; the form has one field for both. */
const IDENTIFIER_API_PATHS: readonly string[] = ["email", "phone"];

let hasMessage: (messageKey: string) => boolean = () => true;

/**
 * The provider registers the check of the active catalog. Every locale has the same keys (tested in
 * packages/i18n), so one check serves any render; before registration every key counts as known.
 */
export function registerMessageCheck(check: (messageKey: string) => boolean): void {
  hasMessage = check;
}

export function isKnownMessageKey(messageKey: string): boolean {
  return hasMessage(messageKey);
}

/** An unknown key from the server would show as raw text; the generic error is the safe fallback. */
export function knownMessageKeyOrInternal(messageKey: string): string {
  return isKnownMessageKey(messageKey) ? messageKey : "errors.internal";
}

/** The form field an API or schema path belongs to (`email` and `phone` are the identifier field). */
export function toFormField(path: string): string {
  const firstSegment = path.split(".")[0] ?? "";
  return IDENTIFIER_API_PATHS.includes(firstSegment) ? IDENTIFIER_FIELD : firstSegment;
}

function messageKeyForCode(code: string): string {
  const messageKey = `validation.${code}`;
  return VALIDATION_MESSAGE_KEYS.includes(messageKey)
    ? messageKey
    : VALIDATION_FALLBACK_MESSAGE_KEY;
}

function messageKeyForIssue(field: string, issueCode: string, isEmpty: boolean): string {
  if (!isEmpty) return messageKeyForCode(issueCode);
  return field === IDENTIFIER_FIELD ? IDENTIFIER_REQUIRED_KEY : REQUIRED_KEY;
}

/**
 * Turns the issues of the shared Zod schemas into one message key per field, the first issue winning.
 * An empty field always reads "required", whatever Zod reported, so the person is told what to do.
 */
export function issuesToFieldErrors(
  issues: readonly z.core.$ZodIssue[],
  values: Readonly<Record<string, string>>,
): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of issues) {
    const field = toFormField(issue.path.map(String).join("."));
    if (fieldErrors[field] !== undefined) continue;
    const isEmpty = (values[field] ?? "").trim() === "";
    fieldErrors[field] = messageKeyForIssue(field, issue.code, isEmpty);
  }
  return fieldErrors;
}
