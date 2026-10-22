import {
  PAYMENT_REQUEST_TYPE,
  PAYMENT_STATUS,
  type PaymentRequestType,
  type PaymentStatus,
} from "@banijjik/contracts/payment";
import { Schema } from "mongoose";
import { SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const PAYMENT_SUMMARY_MODEL_NAME = "PaymentSummary";
export const PAYMENT_SUMMARY_COLLECTION_NAME = "payment_summaries";

export interface PaymentSummaryDocument {
  organizationId: string;
  requestType: PaymentRequestType;
  requestId: string;
  contactId: string | null;
  locationId: string;
  total: {
    amount: number;
    currency: string;
  };
  allocated: {
    amount: number;
    currency: string;
  };
  refunded: {
    amount: number;
    currency: string;
  };
  paymentStatus: PaymentStatus;
  updatedAt: Date;
}

export const paymentSummarySchema = new Schema<PaymentSummaryDocument>(
  {
    organizationId: { type: String, required: true, immutable: true },
    requestType: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_REQUEST_TYPE),
    },
    requestId: { type: String, required: true, immutable: true },
    contactId: { type: String, default: null },
    locationId: { type: String, required: true, immutable: true },
    total: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    allocated: {
      amount: { type: Number, required: true, default: 0 },
      currency: { type: String, required: true },
    },
    refunded: {
      amount: { type: Number, required: true, default: 0 },
      currency: { type: String, required: true },
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.UNPAID,
    },
    updatedAt: { type: Date, required: true },
  },
  SCHEMA_OPTIONS,
);

paymentSummarySchema.index({ organizationId: 1, requestType: 1, requestId: 1 }, { unique: true });
paymentSummarySchema.index({ organizationId: 1, contactId: 1 });
paymentSummarySchema.index({ organizationId: 1, locationId: 1 });
