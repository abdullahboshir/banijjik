import { Schema } from "mongoose";
import { SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

// customerAccountId is the primary key, not a domainIdField (no audit fields)

export const CREDIT_BALANCE_MODEL_NAME = "CreditBalance";
export const CREDIT_BALANCE_COLLECTION_NAME = "credit_balances";

export interface CreditBalanceDocument {
  customerAccountId: string;
  organizationId: string;
  balance: number;
  version: number;
  updatedAt: Date;
}

export const creditBalanceSchema = new Schema<CreditBalanceDocument>(
  {
    customerAccountId: { type: String, required: true, immutable: true },
    organizationId: { type: String, required: true, immutable: true },
    balance: { type: Number, required: true, default: 0, min: 0 },
    version: { type: Number, required: true, default: 1 },
    updatedAt: { type: Date, required: true },
  },
  SCHEMA_OPTIONS,
);

creditBalanceSchema.index({ organizationId: 1, customerAccountId: 1 }, { unique: true });
