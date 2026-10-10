import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../http/app-error.js";
import {
  isPlainObject,
  readField,
  type OperationPolicy,
  type PlainObject,
} from "./operation-policy.js";
import { resolveAllowedLocations, unsafeTenantOperation } from "./tenant-scope.js";
import { inspectFieldAssignment } from "./update-inspection.js";

function locationForbidden(): AppError {
  return new AppError({ code: ERROR_CODE.LOCATION_FORBIDDEN });
}

function assertAllowed(value: unknown, allowed: readonly string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) throw locationForbidden();
}

function narrowFilter(filter: PlainObject, condition: PlainObject): PlainObject {
  const existing: unknown[] = Array.isArray(filter["$and"]) ? filter["$and"] : [];
  // $and keeps a filter on one location working as an intersection: outside the list, no rows.
  return { ...filter, $and: [...existing, condition] };
}

function checkUpdateOf(update: unknown, field: string, allowed: readonly string[]): void {
  if (update === undefined || update === null) return;
  if (Array.isArray(update)) throw unsafeTenantOperation("errors.unsafe_tenant_update");
  if (!isPlainObject(update)) return;
  const { assigned, otherwiseTouched } = inspectFieldAssignment(update, field);
  if (otherwiseTouched) throw locationForbidden();
  for (const value of assigned) assertAllowed(value, allowed);
}

/**
 * The location restriction of the current request for a model whose location path is `field`.
 * Undefined means no restriction: system access, or a caller assigned to every location.
 */
export function resolveLocationPolicy(field: string): OperationPolicy | undefined {
  const allowed = resolveAllowedLocations();
  if (allowed === undefined) return undefined;
  const condition = { [field]: { $in: [...allowed] } };
  return {
    condition,
    scopeFilter: (filter) => narrowFilter(filter, condition),
    checkDocument: (document) => assertAllowed(readField(document, field), allowed),
    checkUpdate: (update) => checkUpdateOf(update, field, allowed),
    scopeReplacement: (replacement) => {
      assertAllowed(replacement[field], allowed);
      return replacement;
    },
  };
}
