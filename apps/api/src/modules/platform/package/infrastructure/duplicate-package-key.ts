import { isDuplicateKeyError } from "../../../../kernel/db/index.js";
import { DuplicatePackageKeyError } from "../domain/errors.js";

/** A driver duplicate-key error on `packageKey` becomes a DuplicatePackageKeyError; anything else is returned unchanged. */
export function toDuplicatePackageKeyError(error: unknown): unknown {
  return isDuplicateKeyError(error, "packageKey") ? new DuplicatePackageKeyError() : error;
}
