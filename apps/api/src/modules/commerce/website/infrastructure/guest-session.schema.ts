import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { Schema, type Document } from "mongoose";
import { registerModel } from "../../../../kernel/db/index.js";

export const GUEST_SESSION_MODEL_NAME = "GuestSession";
export const GUEST_SESSION_COLLECTION_NAME = "guest_sessions";

export interface GuestSessionDocument extends Document {
  readonly guestSessionId: string;
  readonly organizationId: string;
  readonly secretHash: string;
  readonly expiresAt: Date;
  readonly provisionalContactId: string | null;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const guestSessionSchema = new Schema<GuestSessionDocument>(
  {
    guestSessionId: { type: String, required: true, immutable: true },
    organizationId: { type: String, required: true, immutable: true },
    secretHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    provisionalContactId: { type: String, default: null },
    version: { type: Number, default: 1 },
  },
  {
    collection: GUEST_SESSION_COLLECTION_NAME,
    timestamps: true,
  },
);

guestSessionSchema.index({ organizationId: 1, guestSessionId: 1 }, { unique: true });
guestSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

registerModel({
  database: DATABASE_KIND.TENANT,
  modelName: GUEST_SESSION_MODEL_NAME,
  collectionName: GUEST_SESSION_COLLECTION_NAME,
  schema: guestSessionSchema,
  tenancy: MODEL_TENANCY.ORGANIZATION,
});
