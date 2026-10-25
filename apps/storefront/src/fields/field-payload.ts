import type { StorefrontListingField } from "@banijjik/contracts/directory";
import { fieldKindOf } from "./field-kind";

const NUMERIC_KINDS: ReadonlySet<string> = new Set(["number", "decimal"]);

/**
 * The value as the API expects it. A blank answer is left out, so the API's required check sees it
 * as missing. Numbers are sent as numbers; a text that is not a number is sent as typed and the API
 * refuses it with the field's path.
 */
export function payloadValueOf(field: StorefrontListingField, value: unknown): unknown {
  if (isBlank(value)) return undefined;
  const kind = fieldKindOf(field.fieldType);
  if (NUMERIC_KINDS.has(kind) && typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  return value;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/** The customFields object of a save: every form value, blanks left out. */
export function customFieldsPayload(
  fields: readonly StorefrontListingField[],
  values: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    const payloadValue = payloadValueOf(field, values[field.fieldKey]);
    if (payloadValue !== undefined) payload[field.fieldKey] = payloadValue;
  }
  return payload;
}
