import { MODEL_TENANCY } from "@banijjik/contracts";
import type {
  MongooseSchema as Schema,
  MongooseSchemaOptions as SchemaOptions,
} from "../db/index.js";
import { DEFAULT_LOCATION_FIELD } from "../db/model-tenancy-checks.js";
import type { ModelDefinition } from "../db/model-registry.js";
import { resolveLocationPolicy } from "./location-policy.js";
import { installPolicyHooks } from "./policy-hooks.js";
import { resolveTenantPolicy } from "./tenant-policy.js";

/** Schema option set by the tenant plugin; the registry meta-test looks for it. */
export const TENANT_PLUGIN_MARKER = "tenantPluginApplied";
/** Schema option set by the location plugin. */
export const LOCATION_PLUGIN_MARKER = "locationPluginApplied";

/** Marks a schema with a custom option; Mongoose keeps any key there, its types list only the known ones. */
function markSchema(schema: Schema, marker: string): void {
  // Safe: Schema.set stores unknown keys in schema.options unchanged.
  schema.set(marker as keyof SchemaOptions, true);
}

/** Whether a compiled schema carries the tenant plugin marker (used by the registry meta-test). */
export function hasTenantPlugin(schema: Schema): boolean {
  // Safe: reads back the option written by markSchema.
  return schema.get(TENANT_PLUGIN_MARKER as keyof SchemaOptions) === true;
}

/** Whether a compiled schema carries the location plugin marker. */
export function hasLocationPlugin(schema: Schema): boolean {
  // Safe: reads back the option written by markSchema.
  return schema.get(LOCATION_PLUGIN_MARKER as keyof SchemaOptions) === true;
}

/** The tenant plugin: filters, stamps and checks by the request's organization. Applies to ORGANIZATION* models. */
export function tenantPlugin(schema: Schema): void {
  markSchema(schema, TENANT_PLUGIN_MARKER);
  installPolicyHooks(schema, resolveTenantPolicy);
}

/** The location plugin: limits rows to the caller's locations. Applies to ORGANIZATION_AND_LOCATION models. */
export function locationPlugin(schema: Schema, locationField: string): void {
  markSchema(schema, LOCATION_PLUGIN_MARKER);
  installPolicyHooks(schema, () => resolveLocationPolicy(locationField));
}

/** Always runs at compile time, keyed on the declared tenancy, so no startup order can skip it. */
export function applyTenancyPlugins(schema: Schema, definition: ModelDefinition): void {
  if (definition.tenancy === MODEL_TENANCY.NONE) return;
  tenantPlugin(schema);
  if (definition.tenancy !== MODEL_TENANCY.ORGANIZATION_AND_LOCATION) return;
  locationPlugin(schema, definition.locationField ?? DEFAULT_LOCATION_FIELD);
}
