import {
  PAYMENT_DIRECTION,
  PAYMENT_METHOD,
  PAYMENT_REQUEST_TYPE,
  type PaymentDirection,
  type PaymentMethod,
  type PaymentRequestType,
} from "@banijjik/contracts/payment";
import { Schema } from "mongoose";
import { auditFields, domainIdField, SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

export const PAYMENT_MODEL_NAME = "Payment";
export const PAYMENT_COLLECTION_NAME = "payments";

export interface PaymentAllocationSubdocument {
  requestType: PaymentRequestType;
  requestId: string;
  enrollmentPeriodId: string | null;
  amount: {
    amount: number;
    currency: string;
  };
  revenueState: "BEFORE_REVENUE" | "AFTER_REVENUE" | null;
}

export interface PaymentApprovalSubdocument {
  approvalId: string;
  approverUserId: string;
  approvedAt: string;
}

export interface PaymentDocument {
  paymentId: string;
  organizationId: string;
  locationId: string;
  paymentNumber: string;
  direction: PaymentDirection;
  method: PaymentMethod;
  amount: {
    amount: number;
    currency: string;
  };
  externalReference: string | null;
  reversesPaymentId: string | null;
  allocations: PaymentAllocationSubdocument[];
  contactId: string | null;
  receivedByMemberId: string;
  businessDate: string;
  approval: PaymentApprovalSubdocument | null;
  note: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const allocationSchema = new Schema<PaymentAllocationSubdocument>(
  {
    requestType: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_REQUEST_TYPE),
    },
    requestId: { type: String, required: true },
    enrollmentPeriodId: { type: String, default: null },
    amount: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    revenueState: {
      type: String,
      enum: ["BEFORE_REVENUE", "AFTER_REVENUE"],
      default: null,
    },
  },
  { _id: false },
);

const approvalSchema = new Schema<PaymentApprovalSubdocument>(
  {
    approvalId: { type: String, required: true },
    approverUserId: { type: String, required: true },
    approvedAt: { type: String, required: true },
  },
  { _id: false },
);

export const paymentSchema = new Schema<PaymentDocument>(
  {
    ...domainIdField("paymentId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    paymentNumber: { type: String, required: true, immutable: true },
    direction: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_DIRECTION),
    },
    method: {
      type: String,
      required: true,
      enum: Object.values(PAYMENT_METHOD),
    },
    amount: {
      amount: { type: Number, required: true },
      currency: { type: String, required: true },
    },
    externalReference: { type: String, default: null },
    reversesPaymentId: { type: String, default: null },
    allocations: { type: [allocationSchema], default: [] },
    contactId: { type: String, default: null },
    receivedByMemberId: { type: String, required: true },
    businessDate: { type: String, required: true },
    approval: { type: approvalSchema, default: null },
    note: { type: String, default: null },
    version: { type: Number, required: true, default: 1 },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

paymentSchema.index({ organizationId: 1, paymentId: 1 }, { unique: true });
paymentSchema.index({ organizationId: 1, paymentNumber: 1 });
paymentSchema.index({ organizationId: 1, locationId: 1, createdAt: -1 });
paymentSchema.index({ organizationId: 1, contactId: 1, createdAt: -1 });
paymentSchema.index(
  { organizationId: 1, reversesPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      reversesPaymentId: { $type: "string", $gt: "" },
    },
  },
);
paymentSchema.index(
  { organizationId: 1, method: 1, externalReference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalReference: { $type: "string", $gt: "" },
    },
  },
);
