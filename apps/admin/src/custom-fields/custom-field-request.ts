import type { EffectiveCustomField } from "@banijjik/contracts";
import { CUSTOM_FIELD_AUDIENCE, CUSTOM_FIELD_VALUE_MODE } from "@banijjik/validation";
import {
  isPendingField,
  toRequestValues,
  validateCustomFieldValues,
} from "@banijjik/web-client/client";

const REQUIRED_MESSAGE_KEY = "validation.required";
const REQUEST_PATH_PREFIX = "customFields.";

export interface CustomFieldsInput {
  fields: readonly EffectiveCustomField[];
  /** The values as the API returned them, redacted ones absent. */
  stored: Readonly<Record<string, unknown>>;
  /** False for a person the API hides sensitive values from: those fields are left out of the form and the request. */
  canSeeSensitive: boolean;
}

export type CustomFieldsResult =
  | { ok: true; customFields: Record<string, unknown> }
  | { ok: false; errors: Record<string, string> };

/** The fields this person may fill in: visible to the admin, and not a sensitive one they cannot read. */
export function editableFieldsOf(
  fields: readonly EffectiveCustomField[],
  canSeeSensitive: boolean,
): EffectiveCustomField[] {
  return fields.filter(
    (field) => field.visibility.admin && (canSeeSensitive || !field.isSensitive),
  );
}

/** The form's starting values: what is saved, for the fields this person may edit. */
export function initialValuesOf(input: CustomFieldsInput): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of editableFieldsOf(input.fields, input.canSeeSensitive)) {
    const stored = input.stored[field.fieldKey];
    if (stored !== undefined) values[field.fieldKey] = stored;
  }
  return values;
}

function isCleared(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function requiredErrors(
  fields: readonly EffectiveCustomField[],
  values: Readonly<Record<string, unknown>>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!field.isRequired || isPendingField(field)) continue;
    if (isCleared(values[field.fieldKey])) errors[field.fieldKey] = REQUIRED_MESSAGE_KEY;
  }
  return errors;
}

/** An emptied field that was never saved, or a value equal to the saved one, changes nothing: it stays out of the request. */
function onlyChanged(
  request: Readonly<Record<string, unknown>>,
  stored: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const changed: Record<string, unknown> = {};
  for (const [fieldKey, value] of Object.entries(request)) {
    const saved = stored[fieldKey];
    if (value === null && saved === undefined) continue;
    if (sameValue(value, saved)) continue;
    changed[fieldKey] = value;
  }
  return changed;
}

/**
 * Checks the form with the rules the API uses and builds the `customFields` object of the update:
 * only the fields that changed, only the ones this person may see, `null` for an emptied optional
 * field. A hidden (redacted) field never appears, so a placeholder can never be saved as its value.
 */
export function buildCustomFieldsRequest(
  input: CustomFieldsInput & { values: Readonly<Record<string, unknown>> },
): CustomFieldsResult {
  const editable = editableFieldsOf(input.fields, input.canSeeSensitive);
  const request = onlyChanged(
    toRequestValues(input.values, editable, CUSTOM_FIELD_VALUE_MODE.UPDATE),
    input.stored,
  );
  const errors = {
    ...validateCustomFieldValues(editable, request, {
      audience: CUSTOM_FIELD_AUDIENCE.ADMIN,
      mode: CUSTOM_FIELD_VALUE_MODE.UPDATE,
      // The form may send { create } for a contact link; the server turns it into an id (ADR-110).
      acceptsContactLinkCreate: true,
    }),
    ...requiredErrors(editable, input.values),
  };
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, customFields: request };
}

/** The field errors of a refused save: the API names them `customFields.<key>`. */
export function customFieldErrorsOf(
  details: Readonly<Record<string, unknown>> | undefined,
): Record<string, string> {
  const fields: unknown = details?.["fields"];
  const errors: Record<string, string> = {};
  if (!Array.isArray(fields)) return errors;
  for (const field of fields as unknown[]) {
    if (typeof field !== "object" || field === null) continue;
    // The API sends `fields` as untyped JSON; only entries with two strings are used.
    const { path, messageKey } = field as { path?: unknown; messageKey?: unknown };
    if (typeof path !== "string" || typeof messageKey !== "string") continue;
    if (!path.startsWith(REQUEST_PATH_PREFIX)) continue;
    errors[path.slice(REQUEST_PATH_PREFIX.length)] ??= messageKey;
  }
  return errors;
}
