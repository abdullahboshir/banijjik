import {
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
  type StoreCreditDirection,
  type StoreCreditEntryKind,
} from "@banijjik/contracts/payment";
import { Schema } from "mongoose";
import { domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const STORE_CREDIT_ENTRY_MODEL_NAME = "StoreCreditEntry";
export const STORE_CREDIT_ENTRY_COLLECTION_NAME = "store_credit_entries";

export interface StoreCreditEntryDocument {
  storeCreditEntryId: string;
  organizationId: string;
  contactId: string;
  direction: StoreCreditDirection;
  kind: StoreCreditEntryKind;
  amount: {
    amount: number;
    currency: string;
  };
  paymentId: string | null;
  balanceAfterMinor: number;
  note: string | null;
  expiresAt: Date | null;
  expiresStoreCreditEntryId: string | null;
  createdAt: Date;
  createdByUserId: string | null;
}

export const storeCreditEntrySchema = new Schema<StoreCreditEntryDocument>(
  {
    ...domainIdField("storeCreditEntryId"),
    organizationId: { type: String, required: true, immutable: true },
    contactId: { type: String, required: true, immutable: true },
    direction: {
      type: String,
      required: true,
      enum: Object.values(STORE_CREDIT_DIRECTION),
    },
    kind: {
      type: String,
      required: true,
      enum: Object.values(STORE_CREDIT_ENTRY_KIND),
    },
    amount: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    paymentId: { type: String, default: null },
    balanceAfterMinor: { type: Number, required: true },
    note: { type: String, default: null },
    expiresAt: { type: Date, default: null },
    expiresStoreCreditEntryId: { type: String, default: null },
    createdAt: { type: Date, required: true, immutable: true },
    createdByUserId: { type: String, default: null },
  },
  SCHEMA_OPTIONS,
);

storeCreditEntrySchema.index({ organizationId: 1, storeCreditEntryId: 1 }, { unique: true });
storeCreditEntrySchema.index({ organizationId: 1, contactId: 1, createdAt: -1 });
storeCreditEntrySchema.index({ organizationId: 1, expiresAt: 1 });
storeCreditEntrySchema.index(
  { organizationId: 1, expiresStoreCreditEntryId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      expiresStoreCreditEntryId: { $type: "string", $gt: "" },
    },
  },
);
