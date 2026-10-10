import type { SchemaDefinition, SchemaOptions } from "mongoose";

/**
 * Options for every top-level schema. versionKey is off because our explicit `version`
 * field replaces Mongoose's `__v` (ADR-036); strict "throw" turns a typo into an error instead
 * of silently dropping the field.
 */
export const SCHEMA_OPTIONS = {
  versionKey: false,
  id: false,
  strict: "throw",
  timestamps: true,
} as const satisfies SchemaOptions;

/** Embedded sub-documents carry no `_id`; one that needs identity gets its own UUID v7 field. */
export const SUB_SCHEMA_OPTIONS = {
  _id: false,
  versionKey: false,
  id: false,
  strict: "throw",
} as const satisfies SchemaOptions;

/** `createdAt` and `updatedAt` come from `timestamps: true`; null means "written by the system". */
export const auditFields = {
  createdByUserId: { type: String, default: null },
  updatedByUserId: { type: String, default: null },
} as const satisfies SchemaDefinition;

/** Optimistic concurrency token (05-CONVENTIONS "Common fields"). */
export const versionField = {
  version: { type: Number, required: true, default: 1 },
} as const satisfies SchemaDefinition;

/** The entity's own UUID v7, e.g. domainIdField("orderId"). The caller declares the unique index. */
export function domainIdField(name: string): SchemaDefinition {
  return { [name]: { type: String, required: true, immutable: true } };
}
