import { CREDIT_PACK_STATUS, type CreditPackStatus } from "@banijjik/contracts/credit";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const CREDIT_PACK_MODEL_NAME = "CreditPack";
export const CREDIT_PACK_COLLECTION_NAME = "credit_packs";

export interface CreditPackDocument {
  creditPackId: string;
  organizationId: string;
  name: { bn: string; en: string };
  credits: number;
  price: { amount: number; currency: string };
  validityDays: number | null;
  status: CreditPackStatus;
  sortOrder: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const creditPackSchema = new Schema<CreditPackDocument>(
  {
    ...domainIdField("creditPackId"),
    organizationId: { type: String, required: true, immutable: true },
    name: {
      bn: { type: String, required: true },
      en: { type: String, required: true },
    },
    credits: { type: Number, required: true, min: 1 },
    price: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    validityDays: { type: Number, nullable: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: Object.values(CREDIT_PACK_STATUS),
      default: CREDIT_PACK_STATUS.ACTIVE,
    },
    sortOrder: { type: Number, required: true, min: 0 },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

creditPackSchema.index({ organizationId: 1, sortOrder: 1 });
creditPackSchema.index({ organizationId: 1, status: 1 });
