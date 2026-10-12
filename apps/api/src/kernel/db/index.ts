export { connectDatabases } from "./connect-databases.js";
export { getDatabaseConnections } from "./database-connections.js";
export type { DatabaseConnections } from "./database-connections.js";
export { stripMongoInternals } from "./mapper.js";
export { hasAppendOnlyPlugin } from "./append-only-plugin.js";
export { addGlobalSchemaPlugin, registerModel } from "./model-registry.js";
export type { GlobalPluginFilter, ModelDefinition, SchemaPlugin } from "./model-registry.js";
export { initializeModels, models } from "./models.js";
export type { ModelAccessor, ModelContext } from "./models.js";
export { isDatabaseReady } from "./ready.js";
export {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "./schema-parts.js";
export { getActiveSession, onCommitted, withTransaction } from "./with-transaction.js";
export type { TransactionOptions } from "./with-transaction.js";
export { updateVersioned } from "./versioned-update.js";
export type { VersionedUpdateOptions } from "./versioned-update.js";
export { sessionOption } from "./session-option.js";
export { createCloseDatabasesTask } from "./close-databases-task.js";
export type {
  MongooseAggregate,
  MongooseQuery,
  MongooseSchema,
  MongooseSchemaOptions,
} from "./mongoose-types.js";
export {
  auditAllIndexes,
  auditModelIndexes,
  collectionsMissingRequiredIndexes,
} from "./index-audit.js";
export type { CollectionIndexAudit, ConflictingIndex, DeclaredIndex } from "./index-audit.js";
export { createMissingIndexes } from "./index-sync.js";
export type { CollectionIndexSync } from "./index-sync.js";
