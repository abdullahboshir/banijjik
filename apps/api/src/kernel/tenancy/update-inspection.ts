import { isPlainObject, type PlainObject } from "./operation-policy.js";

const RENAME_OPERATOR = "$rename";

function namesField(key: string, field: string): boolean {
  return key === field || key.startsWith(`${field}.`);
}

function operatorMentionsField(operator: string, operand: unknown, field: string): boolean {
  if (!isPlainObject(operand)) return false;
  const keyMatches = Object.keys(operand).some((key) => namesField(key, field));
  if (keyMatches) return true;
  // $rename names the target as a value: { $rename: { oldName: "organizationId" } }.
  return operator === RENAME_OPERATOR && Object.values(operand).includes(field);
}

/**
 * True when an update document (not a pipeline) names `field` anywhere: as a bare key (Mongoose
 * wraps it in $set), inside any operator, or as a $rename target.
 */
export function updateMentionsField(update: PlainObject, field: string): boolean {
  return Object.entries(update).some(([key, value]) => {
    if (key.startsWith("$")) return operatorMentionsField(key, value, field);
    return namesField(key, field);
  });
}

/**
 * The value an update assigns to `field` through $set, $setOnInsert or a bare key, if it does;
 * `mentioned` is true when any other operator touches the field.
 */
export function inspectFieldAssignment(
  update: PlainObject,
  field: string,
): { readonly assigned: readonly unknown[]; readonly otherwiseTouched: boolean } {
  const assigned: unknown[] = [];
  let otherwiseTouched = false;
  for (const [key, value] of Object.entries(update)) {
    if (!key.startsWith("$")) {
      if (namesField(key, field)) assigned.push(value);
      continue;
    }
    if (!operatorMentionsField(key, value, field)) continue;
    const assignsValue = key === "$set" || key === "$setOnInsert";
    if (assignsValue && isPlainObject(value) && field in value) assigned.push(value[field]);
    else otherwiseTouched = true;
  }
  return { assigned, otherwiseTouched };
}
