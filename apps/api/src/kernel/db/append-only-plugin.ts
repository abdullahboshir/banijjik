import { ERROR_CODE, SYSTEM_REASON } from "@banijjik/contracts";
import { getSystemReason } from "../context/index.js";
import { AppError } from "../http/app-error.js";
import { markUnskippable } from "./unskippable-hook.js";
import type {
  MongooseSchema as Schema,
  MongooseSchemaOptions as SchemaOptions,
} from "./mongoose-types.js";

/** Schema option set by the append-only plugin; the registry meta-test looks for it. */
export const APPEND_ONLY_PLUGIN_MARKER = "appendOnlyPluginApplied";

const REFUSED_QUERY_OPERATIONS = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "findOneAndReplace",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
];
const REFUSED_DOCUMENT_OPERATIONS = ["updateOne", "deleteOne"];

/** Whether a compiled schema carries the append-only marker (used by the registry meta-test). */
export function hasAppendOnlyPlugin(schema: Schema): boolean {
  // Safe: reads back the option written by appendOnlyPlugin.
  return schema.get(APPEND_ONLY_PLUGIN_MARKER as keyof SchemaOptions) === true;
}

function appendOnlyViolation(): AppError {
  return new AppError({ code: ERROR_CODE.INTERNAL, messageKey: "errors.append_only_model" });
}

/**
 * Retention and data migrations may have to delete rows one day, so `runAsSystem(MIGRATION)` is
 * the one deliberate way through. Every other bypass reason still hits the guard.
 */
function assertWriteAllowed(): void {
  if (getSystemReason() === SYSTEM_REASON.MIGRATION) return;
  throw appendOnlyViolation();
}

function isInsertOnly(operation: unknown): boolean {
  if (typeof operation !== "object" || operation === null) return false;
  const names = Object.keys(operation);
  return names.length === 1 && names[0] === "insertOne";
}

/**
 * Makes a model append-only (ADR-014, ADR-089): inserts only. Every update, replace and delete
 * query, every bulkWrite operation but insertOne, and the save of an existing document throw.
 * Mistakes are fixed with a new, reversing row, never by changing an old one.
 */
export function appendOnlyPlugin(schema: Schema): void {
  // Safe: Schema.set stores unknown keys in schema.options unchanged.
  schema.set(APPEND_ONLY_PLUGIN_MARKER as keyof SchemaOptions, true);
  // Safe: Mongoose types the hook's operation names as a closed union; these are all valid names.
  // Marked unskippable: `middleware: false` must not lift the guard (finding J2).
  const refuseWrite = markUnskippable(() => assertWriteAllowed());
  schema.pre(REFUSED_QUERY_OPERATIONS as never, refuseWrite);
  schema.pre(REFUSED_DOCUMENT_OPERATIONS as never, { document: true, query: false }, refuseWrite);
  const refuseSaveOfExisting = markUnskippable(function (this: { readonly isNew: boolean }) {
    if (!this.isNew) assertWriteAllowed();
  });
  schema.pre("save", refuseSaveOfExisting);
  const refuseUpdatingBulk = markUnskippable(function (operations: unknown): void {
    if (Array.isArray(operations) && operations.every(isInsertOnly)) return;
    assertWriteAllowed();
  });
  schema.pre("bulkWrite", refuseUpdatingBulk);
}
