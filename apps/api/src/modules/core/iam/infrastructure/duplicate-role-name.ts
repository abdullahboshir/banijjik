import { DuplicateRoleNameError } from "../domain/errors.js";

const DUPLICATE_KEY_CODE = 11000;

function isNameClash(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  // Safe: only the two driver fields below are read, and both are type-checked before use.
  const { code, keyPattern } = error as { code?: unknown; keyPattern?: unknown };
  if (code !== DUPLICATE_KEY_CODE) return false;
  return typeof keyPattern === "object" && keyPattern !== null && "name" in keyPattern;
}

/** A driver duplicate-key error on the role name index becomes DuplicateRoleNameError; anything else is returned unchanged. */
export function toDuplicateRoleNameError(error: unknown): unknown {
  return isNameClash(error) ? new DuplicateRoleNameError() : error;
}
