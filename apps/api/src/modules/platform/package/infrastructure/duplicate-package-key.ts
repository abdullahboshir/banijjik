import { DuplicatePackageKeyError } from "../domain/errors.js";

const DUPLICATE_KEY_CODE = 11000;

/** A driver duplicate-key error on `packageKey` becomes a DuplicatePackageKeyError; anything else is returned unchanged. */
export function toDuplicatePackageKeyError(error: unknown): unknown {
  if (typeof error !== "object" || error === null) return error;
  // Safe: only the two driver fields below are read, and both are type-checked before use.
  const { code, keyPattern } = error as { code?: unknown; keyPattern?: unknown };
  const isDuplicate =
    code === DUPLICATE_KEY_CODE &&
    typeof keyPattern === "object" &&
    keyPattern !== null &&
    "packageKey" in keyPattern;
  return isDuplicate ? new DuplicatePackageKeyError() : error;
}
