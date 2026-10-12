import {
  auditAllIndexes,
  type CollectionIndexAudit,
  type ConflictingIndex,
} from "./index-audit.js";
import { models } from "./models.js";

export interface CollectionIndexSync {
  readonly modelName: string;
  readonly collectionName: string;
  readonly databaseName: string;
  readonly created: number;
  readonly alreadyThere: number;
  readonly conflicting: readonly ConflictingIndex[];
}

async function createMissing(audit: CollectionIndexAudit): Promise<void> {
  if (audit.missing.length === 0) return;
  const toCreate = audit.missing.map((index) => [index.keys, index.options]);
  // Safe: Mongoose reads `toCreate` from these options (model.js, _ensureIndexes), which is how
  // syncIndexes() creates only the missing ones; its typings list the driver options only.
  const options = { toCreate } as never;
  await models({}).get(audit.modelName).createIndexes(options);
}

/**
 * Creates every declared index that is missing. It never drops anything: an index that exists
 * with other options is reported as conflicting and left for a person to decide (finding J4,
 * ADR-094). Models are handled one at a time so a deploy does not flood the database.
 */
export async function createMissingIndexes(): Promise<CollectionIndexSync[]> {
  const results: CollectionIndexSync[] = [];
  for (const audit of await auditAllIndexes()) {
    await createMissing(audit);
    results.push({
      modelName: audit.modelName,
      collectionName: audit.collectionName,
      databaseName: audit.databaseName,
      created: audit.missing.length,
      alreadyThere: audit.declaredCount - audit.missing.length - audit.conflicting.length,
      conflicting: audit.conflicting,
    });
  }
  return results;
}
