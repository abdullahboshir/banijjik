import type {
  MongooseAggregate as Aggregate,
  MongooseQuery as Query,
  MongooseSchema as Schema,
} from "../db/index.js";
import { assertSafeAggregate } from "./aggregate-safety.js";
import { applyPolicyToBulkOperations } from "./bulk-write-rules.js";
import { isPlainObject, type OperationPolicy, type PolicyResolver } from "./operation-policy.js";
import { unsafeTenantOperation } from "./tenant-scope.js";

const READ_AND_DELETE_OPERATIONS = [
  "find",
  "findOne",
  "countDocuments",
  "distinct",
  "findOneAndDelete",
  "deleteOne",
  "deleteMany",
];
const UPDATE_OPERATIONS = ["findOneAndUpdate", "updateOne", "updateMany"];
const REPLACE_OPERATIONS = ["findOneAndReplace", "replaceOne"];

type AnyQuery = Query<unknown, unknown>;

function scopeQuery(query: AnyQuery, policy: OperationPolicy): void {
  query.setQuery(policy.scopeFilter(query.getFilter()));
}

function scopeUpdate(query: AnyQuery, policy: OperationPolicy): void {
  scopeQuery(query, policy);
  policy.checkUpdate(query.getUpdate());
}

function scopeReplacement(query: AnyQuery, policy: OperationPolicy): void {
  scopeQuery(query, policy);
  const replacement = query.getUpdate();
  if (isPlainObject(replacement)) query.setUpdate(policy.scopeReplacement(replacement));
}

interface QueryHook {
  readonly operations: string[];
  readonly apply: (query: AnyQuery, policy: OperationPolicy) => void;
}

function installQueryHook(schema: Schema, resolve: PolicyResolver, hook: QueryHook): void {
  // Safe: Mongoose types the hook's `this` by document type; the policy only uses generic Query methods.
  schema.pre(hook.operations as never, function (this: AnyQuery) {
    const policy = resolve();
    if (policy !== undefined) hook.apply(this, policy);
  });
}

function documentsOf(argument: unknown): readonly unknown[] {
  return Array.isArray(argument) ? argument : [argument];
}

/**
 * Installs the policy on every operation that reads, changes or counts rows. Each hook asks the
 * resolver again, so the answer follows the request that is running now. An operation the policy
 * cannot narrow (estimatedDocumentCount, a join, a pipeline update) throws instead of passing.
 */
export function installPolicyHooks(schema: Schema, resolve: PolicyResolver): void {
  installQueryHook(schema, resolve, { operations: READ_AND_DELETE_OPERATIONS, apply: scopeQuery });
  installQueryHook(schema, resolve, { operations: UPDATE_OPERATIONS, apply: scopeUpdate });
  installQueryHook(schema, resolve, { operations: REPLACE_OPERATIONS, apply: scopeReplacement });
  schema.pre("estimatedDocumentCount", function () {
    if (resolve() !== undefined) throw unsafeTenantOperation("errors.unsafe_tenant_count");
  });
  schema.pre("aggregate", function (this: Aggregate<unknown>) {
    const policy = resolve();
    if (policy === undefined) return;
    assertSafeAggregate(this.pipeline());
    this.pipeline().unshift({ $match: policy.condition });
  });
  // validate runs before Mongoose checks "required", so a missing organizationId is stamped in time.
  // save repeats the check for the (rare) save that skips validation.
  for (const operation of ["validate", "save"] as const) {
    schema.pre(operation, function () {
      resolve()?.checkDocument(this);
    });
  }
  schema.pre("insertMany", function (documents: unknown) {
    const policy = resolve();
    if (policy === undefined) return;
    for (const document of documentsOf(documents)) policy.checkDocument(document);
  });
  schema.pre("bulkWrite", function (operations: unknown) {
    const policy = resolve();
    if (policy !== undefined) applyPolicyToBulkOperations(operations, policy);
  });
}
