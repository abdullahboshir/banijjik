import { ERROR_CODE, type DatabaseKind, type ModelTenancy } from "@banijjik/contracts";
import type { Schema } from "mongoose";
import { AppError } from "../http/app-error.js";
import { applyTenancyPlugins } from "../tenancy/apply-tenancy-plugins.js";
import { assertTenancyDefinition } from "./model-tenancy-checks.js";

export interface ModelDefinition {
  readonly modelName: string;
  readonly collectionName: string;
  readonly database: DatabaseKind;
  readonly schema: Schema;
  /** Required, no default: see MODEL_TENANCY (ADR-087). */
  readonly tenancy: ModelTenancy;
  /** The location path of an ORGANIZATION_AND_LOCATION model. Defaults to "locationId". */
  readonly locationField?: string;
}

export type SchemaPlugin = (schema: Schema, definition: ModelDefinition) => void;

export interface GlobalPluginFilter {
  /** Omitted means every database. */
  readonly database?: DatabaseKind;
  /** Omitted means every tenancy. */
  readonly tenancy?: readonly ModelTenancy[];
}

interface GlobalSchemaPlugin {
  readonly plugin: SchemaPlugin;
  readonly filter: GlobalPluginFilter;
}

const definitions = new Map<string, ModelDefinition>();
const globalPlugins: GlobalSchemaPlugin[] = [];
let isSealed = false;

/**
 * Called by the first model compile. A model compiled before a global plugin was added would
 * silently run without it, so late changes throw instead (finding J5c).
 */
export function sealModelRegistry(): void {
  isSealed = true;
}

function assertNotSealed(): void {
  if (!isSealed) return;
  throw new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.model_registry_sealed" });
}

/** Modules register schemas at startup and never compile models themselves (ADR-023). */
export function registerModel(definition: ModelDefinition): void {
  if (definitions.has(definition.modelName)) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.duplicate_model",
      details: { modelName: definition.modelName },
    });
  }
  assertNotSealed();
  assertTenancyDefinition(definition);
  definitions.set(definition.modelName, definition);
}

/**
 * Plugins added here are applied to every schema that matches the filter before it is compiled.
 * The tenant and location plugins do not go through here: buildSchemaForCompile always applies
 * them by tenancy, so no startup order can leave a model unfiltered. Add plugins at startup,
 * before the first models(ctx).get(): after it the registry is sealed and this throws.
 */
export function addGlobalSchemaPlugin(plugin: SchemaPlugin, filter: GlobalPluginFilter): void {
  assertNotSealed();
  globalPlugins.push({ plugin, filter });
}

function matchesFilter(filter: GlobalPluginFilter, definition: ModelDefinition): boolean {
  if (filter.database !== undefined && filter.database !== definition.database) return false;
  return filter.tenancy === undefined || filter.tenancy.includes(definition.tenancy);
}

export function findModelDefinition(modelName: string): ModelDefinition | undefined {
  return definitions.get(modelName);
}

export function listModelDefinitions(): readonly ModelDefinition[] {
  return [...definitions.values()];
}

/** A clone, so the registered schema stays untouched and plugins are never applied twice to one object. */
export function buildSchemaForCompile(definition: ModelDefinition): Schema {
  const schema = definition.schema.clone();
  applyTenancyPlugins(schema, definition);
  for (const entry of globalPlugins) {
    if (matchesFilter(entry.filter, definition)) entry.plugin(schema, definition);
  }
  return schema;
}
