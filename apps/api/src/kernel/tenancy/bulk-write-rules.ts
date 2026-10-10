import { isPlainObject, type OperationPolicy, type PlainObject } from "./operation-policy.js";
import { unsafeTenantOperation } from "./tenant-scope.js";

const FILTER_OPERATIONS = ["updateOne", "updateMany", "deleteOne", "deleteMany"] as const;

function unsafeBulkOperation(): Error {
  return unsafeTenantOperation("errors.unsafe_tenant_bulk_write");
}

function filterOf(body: PlainObject): PlainObject {
  return isPlainObject(body["filter"]) ? body["filter"] : {};
}

function applyToOperation(operation: PlainObject, policy: OperationPolicy): void {
  const [name, body] = Object.entries(operation)[0] ?? [];
  if (name === undefined || !isPlainObject(body)) throw unsafeBulkOperation();
  if (name === "insertOne") {
    policy.checkDocument(body["document"]);
    return;
  }
  if (name === "replaceOne") {
    body["filter"] = policy.scopeFilter(filterOf(body));
    body["replacement"] = policy.scopeReplacement(
      isPlainObject(body["replacement"]) ? body["replacement"] : {},
    );
    return;
  }
  if (!FILTER_OPERATIONS.some((known) => known === name)) throw unsafeBulkOperation();
  body["filter"] = policy.scopeFilter(filterOf(body));
  if (name === "updateOne" || name === "updateMany") policy.checkUpdate(body["update"]);
}

/**
 * Applies the policy to every operation of a bulkWrite, in place, before Mongoose casts them.
 * An operation of an unknown shape throws: it is never written unchecked.
 */
export function applyPolicyToBulkOperations(operations: unknown, policy: OperationPolicy): void {
  if (!Array.isArray(operations)) throw unsafeBulkOperation();
  for (const operation of operations) {
    if (!isPlainObject(operation)) throw unsafeBulkOperation();
    applyToOperation(operation, policy);
  }
}
