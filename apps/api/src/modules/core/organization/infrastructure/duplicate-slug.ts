import { isDuplicateKeyError } from "../../../../kernel/db/index.js";
import { SlugTakenError } from "../domain/errors.js";

/** A driver duplicate-key error on the slug index becomes a SlugTakenError; anything else is returned unchanged. */
export function toSlugTakenError(error: unknown): unknown {
  return isDuplicateKeyError(error, "slug") ? new SlugTakenError() : error;
}
