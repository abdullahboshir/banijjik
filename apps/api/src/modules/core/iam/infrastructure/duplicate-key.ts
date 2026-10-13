import { isDuplicateKeyError } from "../../../../kernel/db/index.js";
import { DuplicateIdentifierError, type IdentifierField } from "../domain/errors.js";

function readDuplicateField(error: unknown): IdentifierField | undefined {
  if (isDuplicateKeyError(error, "email")) return "email";
  if (isDuplicateKeyError(error, "phoneE164")) return "phone";
  return undefined;
}

/** A driver duplicate-key error on the email or phone index becomes a DuplicateIdentifierError; anything else is returned unchanged. */
export function toDuplicateIdentifierError(error: unknown): unknown {
  const field = readDuplicateField(error);
  return field === undefined ? error : new DuplicateIdentifierError(field);
}
