import { APPROVAL_ACTION, type ApprovalAction } from "@banijjik/contracts/iam";
import { Schema } from "mongoose";
import { auditFields, domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const APPROVAL_TOKEN_MODEL_NAME = "ApprovalToken";
export const APPROVAL_TOKEN_COLLECTION_NAME = "approval_tokens";

export interface ApprovalTokenDocument {
  approvalTokenId: string;
  organizationId: string;
  tokenHash: string;
  action: ApprovalAction;
  subjectKey: string;
  amountMinor?: number;
  currencyCode?: string;
  approverMemberId: string;
  requestedByUserId: string;
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const approvalTokenSchema = new Schema<ApprovalTokenDocument>(
  {
    ...domainIdField("approvalTokenId"),
    organizationId: { type: String, required: true, immutable: true },
    tokenHash: { type: String, required: true },
    action: { type: String, required: true, enum: Object.values(APPROVAL_ACTION) },
    subjectKey: { type: String, required: true },
    amountMinor: { type: Number },
    currencyCode: { type: String },
    approverMemberId: { type: String, required: true },
    requestedByUserId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

approvalTokenSchema.index({ organizationId: 1, tokenHash: 1 }, { unique: true });
// Drop used and expired rows automatically (TTL; Mongo checks about once a minute).
approvalTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
