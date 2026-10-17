import { ERROR_CODE } from "./error-code.js";

/**
 * Zod issue codes the API reports to clients. Any other code is reported as `custom`, so the
 * message-key set stays closed and every key has a translation (review finding J2).
 */
const REPORTED_VALIDATION_CODES = [
  "too_small",
  "too_big",
  "invalid_type",
  "invalid_format",
  "invalid_value",
  "unrecognized_keys",
  "not_multiple_of",
  "invalid_union",
  "custom",
] as const;

export const VALIDATION_MESSAGE_KEYS: readonly string[] = [
  ...REPORTED_VALIDATION_CODES.map((code) => `validation.${code}`),
  // Not a Zod code: a custom field value sent for a field the contact's roles do not use (ADR-113).
  "validation.not_applicable",
];

/** Fallback key for a Zod issue code that is not in the list above. */
export const VALIDATION_FALLBACK_MESSAGE_KEY = "validation.custom";

/** Transport errors written outside an AppError (body parser, readiness probe). */
const TRANSPORT_MESSAGE_KEYS = [
  "errors.invalid_json",
  "errors.payload_too_large",
  "errors.invalid_body",
  "errors.not_ready",
] as const;

/** Every error message key the kernel can send to a client: one per error code plus the transport errors. */
export const KERNEL_ERROR_MESSAGE_KEYS: readonly string[] = [
  ...Object.values(ERROR_CODE).map((code) => `errors.${code.toLowerCase()}`),
  ...TRANSPORT_MESSAGE_KEYS,
];
