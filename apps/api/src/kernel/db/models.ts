import {
  DATABASE_KIND,
  ERROR_CODE,
  ORGANIZATION_DEPLOYMENT,
  type OrganizationDeployment,
} from "@banijjik/contracts";
import type { Connection, Model } from "mongoose";
import { AppError } from "../http/app-error.js";
import { getDatabaseConnections } from "./database-connections.js";
import {
  buildSchemaForCompile,
  findModelDefinition,
  listModelDefinitions,
  sealModelRegistry,
  type ModelDefinition,
} from "./model-registry.js";

export interface ModelContext {
  readonly organizationId?: string;
  /** Missing means SHARED. */
  readonly deployment?: OrganizationDeployment;
}

export interface ModelAccessor {
  get<Document>(modelName: string): Model<Document>;
}

function resolveConnection(definition: ModelDefinition, context: ModelContext): Connection {
  const connections = getDatabaseConnections();
  if (definition.database === DATABASE_KIND.PLATFORM) return connections.platform;
  // The single switch point for dedicated tenants (Phase 8, ADR-023).
  if (context.deployment === ORGANIZATION_DEPLOYMENT.DEDICATED) {
    throw new AppError({
      code: ERROR_CODE.INTERNAL,
      messageKey: "errors.dedicated_not_supported",
    });
  }
  return connections.tenantShared;
}

function compileOnce<Document>(
  connection: Connection,
  definition: ModelDefinition,
): Model<Document> {
  sealModelRegistry();
  const compiled =
    connection.models[definition.modelName] ??
    connection.model(
      definition.modelName,
      buildSchemaForCompile(definition),
      definition.collectionName,
    );
  // Safe: the registry stores untyped schemas, so the caller names the document type.
  // Going through unknown also keeps tsc from expanding Mongoose's generic Model type.
  return compiled as unknown as Model<Document>;
}

function requireDefinition(modelName: string): ModelDefinition {
  const definition = findModelDefinition(modelName);
  if (definition !== undefined) return definition;
  throw new AppError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.unknown_model",
    details: { modelName },
  });
}

/** The only way business code gets a Mongoose model (ADR-023). Models compile once per connection. */
export function models(context: ModelContext): ModelAccessor {
  return {
    get<Document>(modelName: string): Model<Document> {
      const definition = requireDefinition(modelName);
      return compileOnce<Document>(resolveConnection(definition, context), definition);
    },
  };
}

/**
 * Compiles every registered model and waits for its collection and indexes. Startup calls it
 * once, so the first transaction never races with a background index build.
 */
export async function initializeModels(): Promise<void> {
  const context: ModelContext = {};
  const accessor = models(context);
  await Promise.all(
    listModelDefinitions().map((definition) => accessor.get(definition.modelName).init()),
  );
}
