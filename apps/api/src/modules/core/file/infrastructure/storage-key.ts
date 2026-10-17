import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../../../../kernel/http/index.js";

/** `org/{organizationId}/{fileId}/{variant}`: lowercase hex ids and a short variant word, nothing else. */
const STORAGE_KEY_PATTERN = /^org\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-z]{3,16}$/;

/**
 * Keys are built from generated ids only, never from user input. Drivers still refuse any key of
 * another shape, so a bug elsewhere cannot turn into a path traversal.
 */
export function assertValidStorageKey(key: string): void {
  if (STORAGE_KEY_PATTERN.test(key)) return;
  throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.invalid_storage_key" });
}
