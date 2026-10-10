import { ORGANIZATION_FIELD } from "../db/model-tenancy-checks.js";
import {
  isPlainObject,
  readField,
  writeField,
  type OperationPolicy,
  type PlainObject,
} from "./operation-policy.js";
import {
  crossOrganizationAccess,
  resolveTenantScope,
  unsafeTenantOperation,
} from "./tenant-scope.js";
import { updateMentionsField } from "./update-inspection.js";

function scopeFilterTo(organizationId: string, filter: PlainObject): PlainObject {
  const named = filter[ORGANIZATION_FIELD];
  // A mismatch is a bug signal (or an attack), so it is never overwritten silently.
  if (named !== undefined && named !== organizationId) throw crossOrganizationAccess();
  return { ...filter, [ORGANIZATION_FIELD]: organizationId };
}

function checkDocumentOf(organizationId: string, document: unknown): void {
  const named = readField(document, ORGANIZATION_FIELD);
  if (named === undefined || named === null) {
    writeField(document, ORGANIZATION_FIELD, organizationId);
    return;
  }
  if (named !== organizationId) throw crossOrganizationAccess();
}

function checkUpdateOf(update: unknown): void {
  if (update === undefined || update === null) return;
  // A pipeline update can compute any field, and cannot be inspected reliably.
  if (Array.isArray(update)) throw unsafeTenantOperation("errors.unsafe_tenant_update");
  if (isPlainObject(update) && updateMentionsField(update, ORGANIZATION_FIELD)) {
    throw crossOrganizationAccess();
  }
}

/** The organization restriction of the current request, or undefined under runAsSystem. */
export function resolveTenantPolicy(): OperationPolicy | undefined {
  const scope = resolveTenantScope();
  if (scope.kind === "SYSTEM") return undefined;
  const { organizationId } = scope;
  return {
    condition: { [ORGANIZATION_FIELD]: organizationId },
    scopeFilter: (filter) => scopeFilterTo(organizationId, filter),
    checkDocument: (document) => checkDocumentOf(organizationId, document),
    checkUpdate: checkUpdateOf,
    scopeReplacement: (replacement) => {
      const named = replacement[ORGANIZATION_FIELD];
      if (named !== undefined && named !== organizationId) throw crossOrganizationAccess();
      return { ...replacement, [ORGANIZATION_FIELD]: organizationId };
    },
  };
}
