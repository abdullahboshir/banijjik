import { DuplicateFieldError } from "../domain/errors.js";

const DUPLICATE_KEY_CODE = 11000;

function isDuplicateOn(error: unknown, indexField: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  // Safe: only the two driver fields below are read, and both are type-checked before use.
  const { code, keyPattern } = error as { code?: unknown; keyPattern?: unknown };
  if (code !== DUPLICATE_KEY_CODE) return false;
  return typeof keyPattern === "object" && keyPattern !== null && indexField in keyPattern;
}

/** A driver duplicate-key error on `indexField` becomes a DuplicateFieldError; anything else is returned unchanged. */
export function toDuplicateFieldError(error: unknown, indexField: string): unknown {
  return isDuplicateOn(error, indexField) ? new DuplicateFieldError(indexField) : error;
}
