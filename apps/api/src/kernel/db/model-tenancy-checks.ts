import { DATABASE_KIND, ERROR_CODE, MODEL_TENANCY } from "@banijjik/contracts";
import type { Schema } from "mongoose";
import { AppError } from "../http/app-error.js";
import type { ModelDefinition } from "./model-registry.js";

export const ORGANIZATION_FIELD = "organizationId";
export const DEFAULT_LOCATION_FIELD = "locationId";

function invalidModel(definition: ModelDefinition, problem: string): AppError {
  return new AppError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.invalid_model_definition",
    details: { modelName: definition.modelName, problem },
  });
}

function hasRequiredImmutableString(schema: Schema, field: string): boolean {
  const path = schema.path(field);
  if (path === undefined || path.instance !== "String") return false;
  const options = path.options as { required?: unknown; immutable?: unknown };
  return Boolean(options.required) && Boolean(options.immutable);
}

function hasRequiredString(schema: Schema, field: string): boolean {
  const path = schema.path(field);
  if (path === undefined || path.instance !== "String") return false;
  return Boolean((path.options as { required?: unknown }).required);
}

function hasIndexLeadingWith(schema: Schema, field: string): boolean {
  return schema.indexes().some(([fields]) => Object.keys(fields)[0] === field);
}

/**
 * Rejects a model whose declared tenancy cannot be enforced by the tenant plugin. Runs when the
 * model is registered, so a wrong definition fails at startup and never in production traffic.
 */
export function assertTenancyDefinition(definition: ModelDefinition): void {
  const { tenancy, schema, database } = definition;
  if (tenancy === MODEL_TENANCY.NONE) {
    if (database === DATABASE_KIND.TENANT) throw invalidModel(definition, "tenant_model_is_none");
    return;
  }
  if (!hasRequiredImmutableString(schema, ORGANIZATION_FIELD)) {
    throw invalidModel(definition, "organization_id_must_be_required_immutable_string");
  }
  if (!hasIndexLeadingWith(schema, ORGANIZATION_FIELD)) {
    throw invalidModel(definition, "index_must_start_with_organization_id");
  }
  if (tenancy !== MODEL_TENANCY.ORGANIZATION_AND_LOCATION) return;
  const locationField = definition.locationField ?? DEFAULT_LOCATION_FIELD;
  if (!hasRequiredString(schema, locationField)) {
    throw invalidModel(definition, "location_field_must_be_required_string");
  }
}
