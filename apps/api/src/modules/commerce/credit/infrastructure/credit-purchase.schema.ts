import {
  CREDIT_PURCHASE_METHOD,
  CREDIT_PURCHASE_STATUS,
  type CreditPurchaseMethod,
  type CreditPurchaseSnapshot,
  type CreditPurchaseStatus,
} from "@banijjik/contracts/credit";
import { Schema } from "mongoose";
import { domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const CREDIT_PURCHASE_MODEL_NAME = "CreditPurchase";
export const CREDIT_PURCHASE_COLLECTION_NAME = "credit_purchases";

export interface CreditPurchaseDocument {
  creditPurchaseId: string;
  organizationId: string;
  purchaseNumber: string;
  customerAccountId: string;
  creditPackId: string;
  snapshot: CreditPurchaseSnapshot;
  method: CreditPurchaseMethod;
  senderPhoneE164: string;
  transactionReference: string;
  status: CreditPurchaseStatus;
  verifiedByUserId: string | null;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  creditEntryId: string | null;
  submittedAt: Date;
  expiresAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export const creditPurchaseSchema = new Schema<CreditPurchaseDocument>(
  {
    ...domainIdField("creditPurchaseId"),
    organizationId: { type: String, required: true, immutable: true },
    purchaseNumber: { type: String, required: true, immutable: true },
    customerAccountId: { type: String, required: true, immutable: true },
    creditPackId: { type: String, required: true, immutable: true },
    snapshot: {
      name: {
        bn: { type: String, required: true },
        en: { type: String, required: true },
      },
      credits: { type: Number, required: true },
      price: {
        amount: { type: Number, required: true },
        currency: { type: String, required: true },
      },
      validityDays: { type: Number, default: null },
    },
    method: {
      type: String,
      required: true,
      enum: Object.values(CREDIT_PURCHASE_METHOD),
    },
    senderPhoneE164: { type: String, required: true },
    transactionReference: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(CREDIT_PURCHASE_STATUS),
    },
    verifiedByUserId: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    creditEntryId: { type: String, default: null },
    submittedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    version: { type: Number, required: true, default: 1 },
    createdAt: { type: Date, required: true, immutable: true },
    updatedAt: { type: Date, required: true },
  },
  SCHEMA_OPTIONS,
);

// Customer queries: own purchases newest first
creditPurchaseSchema.index({ organizationId: 1, customerAccountId: 1, submittedAt: -1 });

// Reference uniqueness across PENDING and VERIFIED statuses (Decision 2)
creditPurchaseSchema.index(
  { organizationId: 1, method: 1, transactionReference: 1 },
  {
    name: "uniq_credit_purchase_pending_verified_ref",
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [CREDIT_PURCHASE_STATUS.PENDING, CREDIT_PURCHASE_STATUS.VERIFIED],
      },
    },
  },
);

// Staff queue: oldest PENDING first, or filtering by status
creditPurchaseSchema.index({ organizationId: 1, status: 1, submittedAt: 1 });

// Daily expiry job
creditPurchaseSchema.index({ organizationId: 1, status: 1, expiresAt: 1 });
