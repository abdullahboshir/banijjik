export type PlainObject = Record<string, unknown>;

/**
 * One restriction (an organization, a set of locations) applied to every kind of database
 * operation. The hook installer calls these four methods, so the tenant and the location plugin
 * cannot differ in which operations they cover.
 */
export interface OperationPolicy {
  /** The same restriction as a filter, for the first stage of an aggregation. */
  readonly condition: PlainObject;
  /** Returns the filter narrowed to the policy. Throws when the filter contradicts it. */
  scopeFilter(filter: PlainObject): PlainObject;
  /** Checks a document about to be written, and stamps a missing value where the policy can. */
  checkDocument(document: unknown): void;
  /** Throws when an update operator would change the guarded field. */
  checkUpdate(update: unknown): void;
  /** Returns the replacement document with the policy applied. */
  scopeReplacement(replacement: PlainObject): PlainObject;
}

/** Undefined means the operation runs unrestricted (system access, or a caller with every location). */
export type PolicyResolver = () => OperationPolicy | undefined;

export function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface DocumentLike {
  get(path: string): unknown;
  set(path: string, value: unknown): unknown;
}

function isDocumentLike(value: unknown): value is DocumentLike {
  if (!isPlainObject(value)) return false;
  return typeof value["get"] === "function" && typeof value["set"] === "function";
}

/** Reads a field from a Mongoose document or a plain object (bulk and insertMany pass plain ones). */
export function readField(target: unknown, field: string): unknown {
  if (isDocumentLike(target)) return target.get(field);
  return isPlainObject(target) ? target[field] : undefined;
}

export function writeField(target: unknown, field: string, value: unknown): void {
  if (isDocumentLike(target)) {
    target.set(field, value);
    return;
  }
  if (isPlainObject(target)) target[field] = value;
}
