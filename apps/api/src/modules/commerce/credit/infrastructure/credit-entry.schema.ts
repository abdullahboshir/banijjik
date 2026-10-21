import {
  CREDIT_ENTRY_TYPE,
  CREDIT_SOURCE_TYPE,
  type CreditEntryType,
  type CreditSourceType,
} from "@banijjik/contracts/credit";
import { Schema } from "mongoose";
import { domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const CREDIT_ENTRY_MODEL_NAME = "CreditEntry";
export const CREDIT_ENTRY_COLLECTION_NAME = "credit_entries";

export interface CreditEntryDocument {
  creditEntryId: string;
  organizationId: string;
  customerAccountId: string;
  type: CreditEntryType;
  credits: number;
  expiresOn: Date | null;
  source: { sourceType: CreditSourceType; sourceId: string };
  fromPurchaseEntryId: string | null;
  reason: string | null;
  createdByUserId: string | null;
  occurredAt: Date;
  businessDate: string;
  createdAt: Date;
}

export const creditEntrySchema = new Schema<CreditEntryDocument>(
  {
    ...domainIdField("creditEntryId"),
    organizationId: { type: String, required: true, immutable: true },
    customerAccountId: { type: String, required: true, immutable: true },
    type: {
      type: String,
      required: true,
      enum: Object.values(CREDIT_ENTRY_TYPE),
    },
    credits: { type: Number, required: true },
    expiresOn: { type: Date, nullable: true },
    source: {
      sourceType: {
        type: String,
        required: true,
        enum: Object.values(CREDIT_SOURCE_TYPE),
      },
      sourceId: { type: String, required: true },
    },
    fromPurchaseEntryId: { type: String, nullable: true },
    reason: { type: String, nullable: true },
    createdByUserId: { type: String, nullable: true },
    occurredAt: { type: Date, required: true },
    businessDate: { type: String, required: true },
    createdAt: { type: Date, required: true, immutable: true },
  },
  SCHEMA_OPTIONS,
);

creditEntrySchema.index({ organizationId: 1, customerAccountId: 1, occurredAt: -1 });
creditEntrySchema.index({ organizationId: 1, customerAccountId: 1, type: 1, occurredAt: -1 });
creditEntrySchema.index(
  { organizationId: 1, "source.sourceId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: CREDIT_ENTRY_TYPE.EXPIRE,
      "source.sourceType": CREDIT_SOURCE_TYPE.EXPIRY_JOB,
    },
  },
);
creditEntrySchema.index({ organizationId: 1, type: 1, expiresOn: 1 });
