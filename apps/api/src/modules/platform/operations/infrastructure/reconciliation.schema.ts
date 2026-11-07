import { Schema, type Document } from "mongoose";

export const RECONCILIATION_CURSOR_MODEL_NAME = "ReconciliationCursor";

export interface ReconciliationCursorDocument extends Document {
  reconciliationCursorId: string;
  organizationId: string;
  sourceType: string;
  lastScannedCreatedAt: Date;
  lastScannedId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const reconciliationCursorSchema = new Schema<ReconciliationCursorDocument>(
  {
    reconciliationCursorId: { type: String, required: true, unique: true },
    organizationId: { type: String, required: true, index: true },
    sourceType: { type: String, required: true },
    lastScannedCreatedAt: { type: Date, required: true },
    lastScannedId: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
  },
  {
    timestamps: true,
    collection: "reconciliation_cursors",
  },
);

reconciliationCursorSchema.index(
  { organizationId: 1, sourceType: 1 },
  { unique: true, name: "reconciliation_cursor_unique" },
);
