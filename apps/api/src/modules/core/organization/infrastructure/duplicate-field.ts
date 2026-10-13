import { isDuplicateKeyError } from "../../../../kernel/db/index.js";
import { DuplicateFieldError } from "../domain/errors.js";

/** A driver duplicate-key error on `indexField` becomes a DuplicateFieldError; anything else is returned unchanged. */
export function toDuplicateFieldError(error: unknown, indexField: string): unknown {
  return isDuplicateKeyError(error, indexField) ? new DuplicateFieldError(indexField) : error;
}
