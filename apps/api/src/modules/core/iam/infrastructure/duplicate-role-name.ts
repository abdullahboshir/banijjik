import { isDuplicateKeyError } from "../../../../kernel/db/index.js";
import { DuplicateRoleNameError } from "../domain/errors.js";

/** A driver duplicate-key error on the role name index becomes DuplicateRoleNameError; anything else is returned unchanged. */
export function toDuplicateRoleNameError(error: unknown): unknown {
  return isDuplicateKeyError(error, "name") ? new DuplicateRoleNameError() : error;
}
