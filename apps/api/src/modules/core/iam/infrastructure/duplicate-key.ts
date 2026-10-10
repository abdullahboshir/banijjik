import { DuplicateIdentifierError, type IdentifierField } from "../domain/errors.js";

const DUPLICATE_KEY_CODE = 11000;

function readDuplicateField(error: unknown): IdentifierField | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  // Safe: only the two driver fields below are read, and both are type-checked before use.
  const { code, keyPattern } = error as { code?: unknown; keyPattern?: unknown };
  if (code !== DUPLICATE_KEY_CODE || typeof keyPattern !== "object" || keyPattern === null) {
    return undefined;
  }
  if ("email" in keyPattern) return "email";
  if ("phoneE164" in keyPattern) return "phone";
  return undefined;
}

/** A driver duplicate-key error on the email or phone index becomes a DuplicateIdentifierError; anything else is returned unchanged. */
export function toDuplicateIdentifierError(error: unknown): unknown {
  const field = readDuplicateField(error);
  return field === undefined ? error : new DuplicateIdentifierError(field);
}
