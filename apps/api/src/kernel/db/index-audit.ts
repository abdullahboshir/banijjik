import { ERROR_CODE } from "@banijjik/contracts";
import { AppError } from "../http/app-error.js";
import { listModelDefinitions } from "./model-registry.js";
import { models } from "./models.js";

/** MongoDB error code name when the collection does not exist yet (it then has no indexes). */
const NAMESPACE_NOT_FOUND = "NamespaceNotFound";
const ID_INDEX_NAME = "_id_";

export interface DeclaredIndex {
  readonly keys: Readonly<Record<string, unknown>>;
  readonly options: Readonly<Record<string, unknown>>;
}

/** The collection already has an index on these keys, built with other options. It is never dropped here. */
export interface ConflictingIndex extends DeclaredIndex {
  readonly existingName: string;
}

export interface CollectionIndexAudit {
  readonly modelName: string;
  readonly collectionName: string;
  readonly databaseName: string;
  readonly declaredCount: number;
  readonly missing: readonly DeclaredIndex[];
  readonly conflicting: readonly ConflictingIndex[];
}

function unexpectedShape(modelName: string): AppError {
  return new AppError({
    code: ERROR_CODE.INTERNAL,
    messageKey: "errors.index_audit_unexpected_shape",
    details: { modelName },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Mongoose's diffIndexes returns `[keys, options]` pairs when asked for the options too. */
function readDeclaredIndex(entry: unknown, modelName: string): DeclaredIndex {
  if (!Array.isArray(entry)) throw unexpectedShape(modelName);
  const [keys, options]: unknown[] = entry;
  if (!isRecord(keys) || !isRecord(options)) throw unexpectedShape(modelName);
  return { keys, options };
}

function keySignature(keys: Readonly<Record<string, unknown>>): string {
  // Order matters to MongoDB: {a:1,b:1} and {b:1,a:1} are different indexes.
  return JSON.stringify(Object.entries(keys));
}

interface ExistingIndex {
  readonly name: string;
  readonly signature: string;
}

function readExistingIndexes(listed: readonly unknown[]): ExistingIndex[] {
  const existing: ExistingIndex[] = [];
  for (const index of listed) {
    if (!isRecord(index)) continue;
    const { name, key } = index;
    if (typeof name !== "string" || name === ID_INDEX_NAME || !isRecord(key)) continue;
    existing.push({ name, signature: keySignature(key) });
  }
  return existing;
}

function isNamespaceNotFound(error: unknown): boolean {
  return isRecord(error) && error["codeName"] === NAMESPACE_NOT_FOUND;
}

async function listExistingIndexes(modelName: string): Promise<ExistingIndex[]> {
  try {
    return readExistingIndexes(await models({}).get(modelName).listIndexes());
  } catch (error) {
    if (isNamespaceNotFound(error)) return [];
    throw error;
  }
}

/** Compares the indexes the schema declares with the ones on the collection. Read-only. */
export async function auditModelIndexes(modelName: string): Promise<CollectionIndexAudit> {
  const model = models({}).get(modelName);
  const difference = await model.diffIndexes({ indexOptionsToCreate: true });
  const existing = await listExistingIndexes(modelName);
  const missing: DeclaredIndex[] = [];
  const conflicting: ConflictingIndex[] = [];
  for (const entry of difference.toCreate) {
    const declared = readDeclaredIndex(entry, modelName);
    const sameKeys = existing.find((index) => index.signature === keySignature(declared.keys));
    if (sameKeys === undefined) missing.push(declared);
    else conflicting.push({ ...declared, existingName: sameKeys.name });
  }
  return {
    modelName,
    collectionName: model.collection.name,
    databaseName: model.db.name,
    declaredCount: model.schema.indexes().length,
    missing,
    conflicting,
  };
}

export async function auditAllIndexes(): Promise<CollectionIndexAudit[]> {
  const audits: CollectionIndexAudit[] = [];
  // One model at a time: the audit runs once per deploy and must not flood the database.
  for (const definition of listModelDefinitions()) {
    audits.push(await auditModelIndexes(definition.modelName));
  }
  return audits;
}

/** Unique indexes carry correctness (a second request must fail) and TTL indexes carry cleanup. */
function isRequiredIndex(index: DeclaredIndex): boolean {
  return index.options["unique"] === true || index.options["expireAfterSeconds"] !== undefined;
}

/**
 * Collections where a unique or TTL index is missing or built with other options. A conflicting
 * index counts: the declared one is not there, whatever else is.
 */
export function collectionsMissingRequiredIndexes(
  audits: readonly CollectionIndexAudit[],
): string[] {
  const names = new Set<string>();
  for (const audit of audits) {
    if ([...audit.missing, ...audit.conflicting].some(isRequiredIndex)) {
      names.add(audit.collectionName);
    }
  }
  return [...names].sort();
}
