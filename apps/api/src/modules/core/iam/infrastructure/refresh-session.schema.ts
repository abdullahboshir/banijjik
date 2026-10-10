import { TOKEN_AUDIENCE, type TokenAudience } from "@banijjik/contracts";
import { Schema } from "mongoose";
import { auditFields, domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const REFRESH_SESSION_MODEL_NAME = "RefreshSession";
export const REFRESH_SESSION_COLLECTION_NAME = "refresh_sessions";

// MongoDB removes a session a day after it expired; until then it still answers "expired" instead of "unknown".
const EXPIRED_SESSION_RETENTION_SECONDS = 24 * 60 * 60;

export interface RefreshSessionDocument {
  refreshSessionId: string;
  userId: string;
  /** Missing on sessions stored before the platform panel: read as ADMIN. */
  audience?: TokenAudience;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  familyExpiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  replacedByRefreshSessionId: string | null;
  userAgent: string | null;
  ipHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const refreshSessionSchema = new Schema<RefreshSessionDocument>(
  {
    ...domainIdField("refreshSessionId"),
    userId: { type: String, required: true },
    audience: { type: String, enum: Object.values(TOKEN_AUDIENCE), default: TOKEN_AUDIENCE.ADMIN },
    familyId: { type: String, required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    familyExpiresAt: { type: Date, required: true },
    rotatedAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    replacedByRefreshSessionId: { type: String, default: null },
    userAgent: { type: String, default: null },
    ipHash: { type: String, default: null },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

refreshSessionSchema.index({ refreshSessionId: 1 }, { unique: true });
refreshSessionSchema.index({ tokenHash: 1 }, { unique: true });
refreshSessionSchema.index({ userId: 1, revokedAt: 1 });
refreshSessionSchema.index({ familyId: 1 });
refreshSessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: EXPIRED_SESSION_RETENTION_SECONDS },
);
