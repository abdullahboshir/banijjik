import { isPlainObject } from "./operation-policy.js";
import { unsafeTenantOperation } from "./tenant-scope.js";

/**
 * Stages that read other collections, write, or must come first. A $match in front of the
 * pipeline cannot protect them, so they are refused until a card designs the join (ADR-087).
 */
const UNSAFE_STAGES: ReadonlySet<string> = new Set([
  "$lookup",
  "$graphLookup",
  "$unionWith",
  "$out",
  "$merge",
  "$geoNear",
  "$collStats",
  "$indexStats",
  "$documents",
  "$changeStream",
  "$search",
  "$searchMeta",
  "$vectorSearch",
]);

function containsUnsafeStage(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsUnsafeStage);
  if (!isPlainObject(value)) return false;
  // Nested pipelines ($facet) are scanned too: a $lookup inside one would escape the first $match.
  return Object.entries(value).some(
    ([key, inner]) => UNSAFE_STAGES.has(key) || containsUnsafeStage(inner),
  );
}

export function assertSafeAggregate(pipeline: readonly unknown[]): void {
  if (containsUnsafeStage(pipeline)) throw unsafeTenantOperation("errors.unsafe_tenant_aggregate");
}
