import {
  CONSIGNMENT_STATUS,
  COURIER_SETTLEMENT_RECEIVED_VIA,
  MANUAL_COURIER_KEY,
  type ConsignmentStatus,
  type CourierSettlementReceivedVia,
  type ManualCourierKey,
  type Money,
} from "@banijjik/contracts/courier";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

const moneySchema = new Schema(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

export const CONSIGNMENT_MODEL_NAME = "Consignment";
export const CONSIGNMENT_COLLECTION_NAME = "consignments";

export const COURIER_SETTLEMENT_MODEL_NAME = "CourierSettlement";
export const COURIER_SETTLEMENT_COLLECTION_NAME = "courier_settlements";

export interface ConsignmentDocument {
  consignmentId: string;
  organizationId: string;
  locationId: string;
  orderId: string;
  attemptOrdinal: number;
  courierKey: ManualCourierKey;
  trackingNumber: string;
  status: ConsignmentStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const consignmentSchema = new Schema<ConsignmentDocument>(
  {
    ...domainIdField("consignmentId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true },
    orderId: { type: String, required: true, immutable: true },
    attemptOrdinal: { type: Number, required: true },
    courierKey: { type: String, required: true, enum: Object.values(MANUAL_COURIER_KEY) },
    trackingNumber: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(CONSIGNMENT_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

consignmentSchema.index({ organizationId: 1, consignmentId: 1 }, { unique: true });
consignmentSchema.index(
  { organizationId: 1, courierKey: 1, trackingNumber: 1 },
  { unique: true },
);
consignmentSchema.index({ organizationId: 1, orderId: 1, attemptOrdinal: 1 });
consignmentSchema.index({ organizationId: 1, locationId: 1, createdAt: -1 });

export interface CourierSettlementDocument {
  courierSettlementId: string;
  organizationId: string;
  courierKey: ManualCourierKey;
  paymentIds: readonly string[];
  grossAmount: Money;
  courierCharges: Money;
  netReceived: Money;
  receivedVia: CourierSettlementReceivedVia;
  externalReference: string;
  businessDate: string;
  reversesCourierSettlementId: string | null;
  reversalReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const courierSettlementSchema = new Schema<CourierSettlementDocument>(
  {
    ...domainIdField("courierSettlementId"),
    organizationId: { type: String, required: true, immutable: true },
    courierKey: { type: String, required: true, enum: Object.values(MANUAL_COURIER_KEY) },
    paymentIds: { type: [String], required: true },
    grossAmount: { type: moneySchema, required: true },
    courierCharges: { type: moneySchema, required: true },
    netReceived: { type: moneySchema, required: true },
    receivedVia: {
      type: String,
      required: true,
      enum: Object.values(COURIER_SETTLEMENT_RECEIVED_VIA),
    },
    externalReference: { type: String, required: true },
    businessDate: { type: String, required: true },
    reversesCourierSettlementId: { type: String, default: null },
    reversalReason: { type: String, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

courierSettlementSchema.index({ organizationId: 1, courierSettlementId: 1 }, { unique: true });
courierSettlementSchema.index(
  { organizationId: 1, courierKey: 1, externalReference: 1 },
  { unique: true },
);
courierSettlementSchema.index(
  { organizationId: 1, reversesCourierSettlementId: 1 },
  { unique: true, partialFilterExpression: { reversesCourierSettlementId: { $type: "string" } } },
);
courierSettlementSchema.index({ organizationId: 1, createdAt: -1 });
