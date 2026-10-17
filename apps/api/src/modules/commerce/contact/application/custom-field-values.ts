import {
  REDACTED_AUDIT_VALUE,
  VALIDATION_FALLBACK_MESSAGE_KEY,
  VALIDATION_MESSAGE_KEYS,
  type AuditChanges,
  type ContactRole,
  type AuditValue,
  type EffectiveCustomField,
} from "@banijjik/contracts";
import {
  buildCustomFieldValuesSchema,
  fieldAppliesToContactRoles,
  CUSTOM_FIELD_AUDIENCE,
  CUSTOM_FIELD_VALUE_MODE,
  redactSensitive,
  toSearchEntries,
} from "@banijjik/validation";
import { diffAuditFields, type AuditFields } from "../../../../kernel/audit/index.js";
import type { StoredCustomFields } from "../domain/custom-field-values.js";
import {
  customFieldSensitiveForbidden,
  invalidFields,
  type DomainRuleError,
} from "../domain/errors.js";

const REQUEST_PATH_PREFIX = "customFields";

export interface MergedCustomFields extends StoredCustomFields {
  /** One `customFields.<key>` entry per changed key; sensitive values are replaced (ADR-107). */
  readonly auditChanges: AuditChanges;
}

function toMessageKey(code: string): string {
  const messageKey = `validation.${code}`;
  return VALIDATION_MESSAGE_KEYS.includes(messageKey)
    ? messageKey
    : VALIDATION_FALLBACK_MESSAGE_KEY;
}

/** A custom issue may carry its own key (`validation.not_applicable`); any other issue is named by its Zod code. */
function messageKeyOf(issue: { readonly code: string; readonly message?: string }): string {
  if (issue.message !== undefined && VALIDATION_MESSAGE_KEYS.includes(issue.message)) {
    return issue.message;
  }
  return toMessageKey(issue.code);
}

/** The same shape as a schema failure (14-API.md section 3), with the path `customFields.<key>`. */
function validationFailure(
  issues: readonly {
    readonly path: readonly PropertyKey[];
    readonly code: string;
    readonly message?: string;
  }[],
): DomainRuleError {
  return invalidFields(
    issues.map((issue) => ({
      path: [REQUEST_PATH_PREFIX, ...issue.path.map(String)].join("."),
      messageKey: messageKeyOf(issue),
    })),
  );
}

function isAuditValue(value: unknown): value is AuditValue {
  if (value === null) return true;
  if (Array.isArray(value)) return value.every((item) => typeof item === "string");
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function auditFieldsOf(values: Readonly<Record<string, unknown>>): AuditFields {
  const fields: Record<string, AuditValue | undefined> = {};
  for (const [fieldKey, value] of Object.entries(values)) {
    fields[`${REQUEST_PATH_PREFIX}.${fieldKey}`] = isAuditValue(value) ? value : undefined;
  }
  return fields;
}

/** The diff of the real values, then every sensitive entry loses both sides: the change stays visible, the data does not. */
function auditChangesOf(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
  fields: readonly EffectiveCustomField[],
): AuditChanges {
  const sensitive = new Set(
    fields.filter((field) => field.isSensitive).map((field) => field.fieldKey),
  );
  const changes = diffAuditFields(auditFieldsOf(before), auditFieldsOf(after));
  const safe: Record<string, { from?: AuditValue; to?: AuditValue }> = {};
  for (const [path, change] of Object.entries(changes)) {
    const fieldKey = path.slice(REQUEST_PATH_PREFIX.length + 1);
    safe[path] = sensitive.has(fieldKey)
      ? { from: REDACTED_AUDIT_VALUE, to: REDACTED_AUDIT_VALUE }
      : change;
  }
  return safe;
}

function mergedValues(
  stored: Readonly<Record<string, unknown>>,
  parsed: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...stored };
  for (const [fieldKey, value] of Object.entries(parsed)) {
    if (value === null) delete merged[fieldKey];
    else if (value !== undefined) merged[fieldKey] = value;
  }
  return merged;
}

/** Setting or clearing (`null`) a sensitive value needs the same permission as reading it (ADR-107). */
function assertSensitiveKeysAllowed(
  requested: Readonly<Record<string, unknown>>,
  fields: readonly EffectiveCustomField[],
): void {
  const sensitive = new Set(fields.filter((field) => field.isSensitive).map((f) => f.fieldKey));
  const refused = Object.keys(requested).filter((fieldKey) => sensitive.has(fieldKey));
  if (refused.length > 0) throw customFieldSensitiveForbidden(refused);
}

export type CustomFieldValueMode = "CREATE" | "UPDATE";

/**
 * Validates the requested values with the same builder the admin form uses (card 2.3) and merges
 * them over the stored ones: an absent key keeps its value, `null` removes it (a required field
 * cannot be nulled). A failure is a 400 at `customFields.<key>`. By now every contact-link
 * `{ create }` has been replaced by a `contactId`.
 */
export function mergeCustomFieldValues(input: {
  readonly stored: Readonly<Record<string, unknown>>;
  readonly requested: Readonly<Record<string, unknown>>;
  readonly fields: readonly EffectiveCustomField[];
  readonly mode: CustomFieldValueMode;
  /** The roles of the contact after this write: a field limited to other roles is not required and not accepted. */
  readonly contactRoles: readonly ContactRole[];
  /** False when the caller may not read sensitive values: any sensitive key in the request is then a 403. */
  readonly canWriteSensitive: boolean;
}): MergedCustomFields {
  const { stored, requested, fields } = input;
  if (!input.canWriteSensitive) assertSensitiveKeysAllowed(requested, fields);
  const schema = buildCustomFieldValuesSchema(fields, {
    audience: CUSTOM_FIELD_AUDIENCE.ADMIN,
    mode: input.mode === "CREATE" ? CUSTOM_FIELD_VALUE_MODE.CREATE : CUSTOM_FIELD_VALUE_MODE.UPDATE,
    contactRoles: input.contactRoles,
  });
  const parsed = schema.safeParse(requested);
  if (!parsed.success) throw validationFailure(parsed.error.issues);
  // Safe: the values schema returns an object whose keys are the visible field keys.
  const values = mergedValues(stored, parsed.data as Record<string, unknown>);
  return {
    values,
    search: toSearchEntries(values, fields),
    auditChanges: auditChangesOf(stored, values, fields),
  };
}

/** Only the fields the admin may see; an archived or hidden field's value stays stored but unreturned. */
export function readableCustomFields(input: {
  readonly stored: Readonly<Record<string, unknown>>;
  readonly fields: readonly EffectiveCustomField[];
  readonly contactRoles: readonly ContactRole[];
  readonly canReadSensitive: boolean;
}): Record<string, unknown> {
  // A field the contact's roles do not use is treated like a hidden one: stored, not returned (ADR-113).
  const visibleFields = input.fields.filter(
    (field) => field.visibility.admin && fieldAppliesToContactRoles(field, input.contactRoles),
  );
  const visibleKeys = new Set(visibleFields.map((field) => field.fieldKey));
  const current = Object.fromEntries(
    Object.entries(input.stored).filter(([fieldKey]) => visibleKeys.has(fieldKey)),
  );
  return redactSensitive(current, visibleFields, input.canReadSensitive);
}
