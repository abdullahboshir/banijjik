import { ERROR_CODE, type DatabaseKind } from "@banijjik/contracts";
import type { Schema } from "mongoose";
import { AppError } from "../http/app-error.js";

export interface ModelDefinition {
  readonly modelName: string;
  readonly collectionName: string;
  readonly database: DatabaseKind;
  readonly schema: Schema;
}

export type SchemaPlugin = (schema: Schema) => void;

interface GlobalSchemaPlugin {
  readonly plugin: SchemaPlugin;
  readonly database: DatabaseKind;
}

const definitions = new Map<string, ModelDefinition>();
const globalPlugins: GlobalSchemaPlugin[] = [];

/** Modules register schemas at startup and never compile models themselves (ADR-023). */
export function registerModel(definition: ModelDefinition): void {
  if (definitions.has(definition.modelName)) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.duplicate_model",
      details: { modelName: definition.modelName },
    });
  }
  definitions.set(definition.modelName, definition);
}

/**
 * Plugins added here are applied to every schema of that database before it is compiled. The
 * tenant plugin (card 1.3) attaches here, so no module can forget it. Add plugins at startup,
 * before the first models(ctx).get(): models compiled earlier do not receive them.
 */
export function addGlobalSchemaPlugin(
  plugin: SchemaPlugin,
  options: { database: DatabaseKind },
): void {
  globalPlugins.push({ plugin, database: options.database });
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
  for (const entry of globalPlugins) {
    if (entry.database === definition.database) entry.plugin(schema);
  }
  return schema;
}
