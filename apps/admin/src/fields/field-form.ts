import {
  VALIDATION_FALLBACK_MESSAGE_KEY,
  VALIDATION_MESSAGE_KEYS,
  type CustomFieldDefinitionCreateRequest,
  type CustomFieldDefinitionUpdateRequest,
  type CustomFieldEntityType,
  type CustomFieldPreferenceChange,
} from "@banijjik/contracts";
import {
  customFieldDefinitionCreateRequestSchema,
  customFieldDefinitionUpdateRequestSchema,
} from "@banijjik/validation";
import type { FieldErrors } from "../auth/field-errors";
import { needsOptions, type FieldFormResult, type FieldFormState } from "./field-state";
import type { FieldRowView } from "./field-rows";

const OPTIONS_LOCKED_KEY = "errors.custom_field_options_locked";

function optionsOf(optionsText: string): string[] {
  return optionsText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function sortOrderOf(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

interface Issue {
  path: readonly PropertyKey[];
  code: string;
}

/** The API names a label by its path (`label.bn`); the form names it by its input. */
function formNameOf(issue: Issue): string {
  const [first = "", second] = issue.path.map(String);
  // The schema's whole-object consistency check (choices needed or not) has no path; this form only trips it on the choices.
  if (first === "") return "options";
  if (first !== "label") return first;
  return second === "en" ? "labelEn" : "labelBn";
}

function isEmptyInput(formName: string, form: FieldFormState): boolean {
  if (formName === "options") return optionsOf(form.optionsText).length === 0;
  const value = (form as unknown as Record<string, unknown>)[formName];
  return typeof value === "string" && value.trim() === "";
}

function messageKeyOf(code: string): string {
  const messageKey = `validation.${code}`;
  return VALIDATION_MESSAGE_KEYS.includes(messageKey)
    ? messageKey
    : VALIDATION_FALLBACK_MESSAGE_KEY;
}

/** One message key per input, the first issue winning; an empty input always reads "required". */
function fieldErrorsOf(issues: readonly Issue[], form: FieldFormState): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const formName = formNameOf(issue);
    if (errors[formName] !== undefined) continue;
    errors[formName] = isEmptyInput(formName, form)
      ? "validation.required"
      : messageKeyOf(issue.code);
  }
  return errors;
}

/** Checks a new field with the schema the API uses and builds the create body. */
export function buildFieldCreate(
  form: FieldFormState,
  entityType: CustomFieldEntityType,
): FieldFormResult<CustomFieldDefinitionCreateRequest> {
  const options = optionsOf(form.optionsText);
  const candidate = {
    entityType,
    fieldKey: form.fieldKey.trim(),
    label: { bn: form.labelBn, en: form.labelEn },
    fieldType: form.fieldType,
    isRequired: form.isRequired,
    ...(needsOptions(form.fieldType) ? { options } : {}),
    visibility: { admin: true, storefront: false, bot: form.botAsk },
    botAsk: form.botAsk,
    isSearchable: form.isSearchable,
    isSensitive: form.isSensitive,
    sortOrder: sortOrderOf(form.sortOrder),
    ...(entityType === "contact" && form.appliesToContactRoles.length > 0
      ? { appliesToContactRoles: form.appliesToContactRoles }
      : {}),
  };
  const parsed = customFieldDefinitionCreateRequestSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues, form) };
  return { ok: true, body: candidate as CustomFieldDefinitionCreateRequest };
}

function addedOptions(row: FieldRowView, form: FieldFormState): string[] | "removed" | undefined {
  if (!needsOptions(row.fieldType)) return undefined;
  const wanted = optionsOf(form.optionsText);
  if (row.options.some((option) => !wanted.includes(option))) return "removed";
  return wanted.length === row.options.length ? undefined : wanted;
}

function optionsPart(options: string[] | undefined): { options?: string[] } {
  return options === undefined ? {} : { options };
}

function rolesChanged(form: FieldFormState, row: FieldRowView): boolean {
  if (row.entityType !== "contact") return false;
  const before = [...row.appliesToContactRoles].sort().join(",");
  return [...form.appliesToContactRoles].sort().join(",") !== before;
}

/** The switches, label and order the person changed, compared with the saved field. */
function changedParts(form: FieldFormState, row: FieldRowView): Record<string, unknown> {
  const parts: Record<string, unknown> = {};
  if (form.labelBn !== row.labelBn || form.labelEn !== row.labelEn) {
    parts["label"] = { bn: form.labelBn, en: form.labelEn };
  }
  const switches = ["isRequired", "isSensitive", "isSearchable", "botAsk"] as const;
  for (const name of switches) {
    if (form[name] !== row[name]) parts[name] = form[name];
  }
  if (sortOrderOf(form.sortOrder) !== row.sortOrder)
    parts["sortOrder"] = sortOrderOf(form.sortOrder);
  if (rolesChanged(form, row)) {
    // An empty choice goes back to every role, which the API reads as null.
    parts["appliesToContactRoles"] =
      form.appliesToContactRoles.length === 0 ? null : form.appliesToContactRoles;
  }
  return parts;
}

/**
 * The update body: only what changed. Key and type are locked, and an option can only be added, so a
 * removed option is refused here before the API refuses it. `body` is `undefined` when nothing changed.
 */
export function buildFieldUpdate(
  form: FieldFormState,
  row: FieldRowView,
): FieldFormResult<CustomFieldDefinitionUpdateRequest | undefined> {
  const options = addedOptions(row, form);
  if (options === "removed") return { ok: false, fieldErrors: { options: OPTIONS_LOCKED_KEY } };
  const candidate = { version: row.version, ...changedParts(form, row), ...optionsPart(options) };
  if (Object.keys(candidate).length === 1) return { ok: true, body: undefined };
  const parsed = customFieldDefinitionUpdateRequestSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsOf(parsed.error.issues, form) };
  return { ok: true, body: candidate as CustomFieldDefinitionUpdateRequest };
}

function preferenceErrors(
  form: Pick<FieldFormState, "labelBn" | "labelEn" | "sortOrder">,
  changed: { labelChanged: boolean; orderChanged: boolean },
): FieldErrors {
  const errors: FieldErrors = {};
  if (changed.labelChanged && form.labelBn.trim() === "") errors["labelBn"] = "validation.required";
  if (changed.labelChanged && form.labelEn.trim() === "") errors["labelEn"] = "validation.required";
  if (changed.orderChanged && !Number.isInteger(sortOrderOf(form.sortOrder))) {
    errors["sortOrder"] = "validation.invalid_type";
  }
  return errors;
}

/** A template field: the label and the order the business wants. `change` is `undefined` when nothing changed. */
export function buildPreferenceChange(
  form: Pick<FieldFormState, "labelBn" | "labelEn" | "sortOrder">,
  row: FieldRowView,
): FieldFormResult<CustomFieldPreferenceChange | undefined> {
  const sortOrder = sortOrderOf(form.sortOrder);
  const labelChanged = form.labelBn !== row.labelBn || form.labelEn !== row.labelEn;
  const orderChanged = sortOrder !== row.sortOrder;
  if (!labelChanged && !orderChanged) return { ok: true, body: undefined };
  const fieldErrors = preferenceErrors(form, { labelChanged, orderChanged });
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    body: {
      entityType: row.entityType,
      fieldKey: row.fieldKey,
      ...(labelChanged ? { label: { bn: form.labelBn.trim(), en: form.labelEn.trim() } } : {}),
      ...(orderChanged ? { sortOrder } : {}),
      ...(row.version > 0 ? { version: row.version } : {}),
    },
  };
}
