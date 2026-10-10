import { SlugTakenError } from "../domain/errors.js";

const DUPLICATE_KEY_CODE = 11000;

function isDuplicateSlug(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  // Safe: only the two driver fields below are read, and both are type-checked before use.
  const { code, keyPattern } = error as { code?: unknown; keyPattern?: unknown };
  if (code !== DUPLICATE_KEY_CODE) return false;
  return typeof keyPattern === "object" && keyPattern !== null && "slug" in keyPattern;
}

/** A driver duplicate-key error on the slug index becomes a SlugTakenError; anything else is returned unchanged. */
export function toSlugTakenError(error: unknown): unknown {
  return isDuplicateSlug(error) ? new SlugTakenError() : error;
}
