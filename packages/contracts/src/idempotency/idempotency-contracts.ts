import { defineEnum } from "../define-enum.js";

/** Request header that routes marked **I** in 14-API.md require (a UUID chosen by the client). */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** Response header set when the stored answer of an earlier request is sent again. */
export const IDEMPOTENCY_REPLAYED_HEADER = "Idempotency-Replayed";

/** Whose key space a key lives in. STOREFRONT is a technical principal key, never a business scope. */
export const IDEMPOTENCY_SCOPE_KIND = defineEnum(["ORGANIZATION", "USER", "STOREFRONT"]);
export type IdempotencyScopeKind =
  (typeof IDEMPOTENCY_SCOPE_KIND)[keyof typeof IDEMPOTENCY_SCOPE_KIND];

export const IDEMPOTENCY_STATUS = defineEnum(["IN_PROGRESS", "COMPLETED"]);
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUS)[keyof typeof IDEMPOTENCY_STATUS];

/** Message keys the idempotency middleware can send to a client. Both catalogs need each. */
export const IDEMPOTENCY_MESSAGE_KEYS: readonly string[] = [
  "errors.idempotency_in_progress",
  "validation.idempotency_key_required",
  "validation.idempotency_key_invalid",
];
