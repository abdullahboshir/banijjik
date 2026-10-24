import {
  RETURN_DISPOSITION,
  SALES_RETURN_REASON,
  SALES_RETURN_REFUND_METHOD,
  SALES_RETURN_STATUS,
  type ReturnDisposition,
  type SalesReturnReason,
  type SalesReturnRefundMethod,
  type SalesReturnStatus,
} from "@banijjik/contracts/sales";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";
import type { MoneyDocument } from "./sales.schema.js";

export const SALES_RETURN_MODEL_NAME = "SalesReturn";
export const SALES_RETURN_COLLECTION_NAME = "sales_returns";

export interface SalesReturnLineDocument {
  orderLineId: string;
  offeringId: string;
  variantId: string;
  nameSnapshot: string;
  quantity: number;
  disposition: ReturnDisposition;
  value: MoneyDocument;
  taxPart: MoneyDocument;
}

export interface SalesReturnApprovalDocument {
  action: string;
  approvalId: string;
  approverMemberId: string;
  approvedAt: Date;
}

export interface SalesReturnRefundDocument {
  method: SalesReturnRefundMethod | null;
  amount: MoneyDocument;
  paymentId: string | null;
  storeCreditEntryId: string | null;
}

/** One return row. Append-only: the A2 reversal writes a new row, it never edits this one's money. */
export interface SalesReturnDocument {
  salesReturnId: string;
  organizationId: string;
  salesReturnNumber: string;
  orderId: string;
  locationId: string;
  contactId: string | null;
  lines: SalesReturnLineDocument[];
  deliveryChargeReturned: MoneyDocument;
  roundingReturned: MoneyDocument;
  value: MoneyDocument;
  refund: SalesReturnRefundDocument;
  dueReduced: MoneyDocument;
  reasonKey: SalesReturnReason;
  note: string | null;
  approvals: SalesReturnApprovalDocument[];
  status: SalesReturnStatus;
  reversedBySalesReturnId: string | null;
  exchangeOrderId: string | null;
  businessDate: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const moneySchema = new Schema<MoneyDocument>(
  {
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const lineSchema = new Schema<SalesReturnLineDocument>(
  {
    orderLineId: { type: String, required: true },
    offeringId: { type: String, required: true },
    variantId: { type: String, required: true },
    nameSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true },
    disposition: {
      type: String,
      required: true,
      enum: Object.values(RETURN_DISPOSITION),
    },
    value: { type: moneySchema, required: true },
    taxPart: { type: moneySchema, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const approvalSchema = new Schema<SalesReturnApprovalDocument>(
  {
    action: { type: String, required: true },
    approvalId: { type: String, required: true },
    approverMemberId: { type: String, required: true },
    approvedAt: { type: Date, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const refundSchema = new Schema<SalesReturnRefundDocument>(
  {
    method: { type: String, default: null, enum: Object.values(SALES_RETURN_REFUND_METHOD) },
    amount: { type: moneySchema, required: true },
    paymentId: { type: String, default: null },
    storeCreditEntryId: { type: String, default: null },
  },
  SUB_SCHEMA_OPTIONS,
);

export const salesReturnSchema = new Schema<SalesReturnDocument>(
  {
    ...domainIdField("salesReturnId"),
    organizationId: { type: String, required: true, immutable: true },
    salesReturnNumber: { type: String, required: true, immutable: true },
    orderId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    contactId: { type: String, default: null },
    lines: { type: [lineSchema], required: true },
    deliveryChargeReturned: { type: moneySchema, required: true },
    roundingReturned: { type: moneySchema, required: true },
    value: { type: moneySchema, required: true },
    refund: { type: refundSchema, required: true },
    dueReduced: { type: moneySchema, required: true },
    reasonKey: { type: String, required: true, enum: Object.values(SALES_RETURN_REASON) },
    note: { type: String, default: null },
    approvals: { type: [approvalSchema], default: [] },
    status: { type: String, required: true, enum: Object.values(SALES_RETURN_STATUS) },
    reversedBySalesReturnId: { type: String, default: null },
    exchangeOrderId: { type: String, default: null },
    businessDate: { type: String, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

/** The list page: newest business date first, with the id as the tie-break (plan decision 11). */
salesReturnSchema.index({ organizationId: 1, locationId: 1, businessDate: -1, salesReturnId: -1 });
salesReturnSchema.index({ organizationId: 1, salesReturnId: 1 }, { unique: true });
salesReturnSchema.index({ organizationId: 1, salesReturnNumber: 1 }, { unique: true });
/** The order's returns: the delivery sum and the list filtered by order. */
salesReturnSchema.index({ organizationId: 1, orderId: 1, status: 1 });
