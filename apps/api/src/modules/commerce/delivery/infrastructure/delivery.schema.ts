import {
  DELIVERY_ASSIGNMENT_STATUS,
  RIDER_HANDOVER_RECEIVED_VIA,
  type DeliveryAssignmentStatus,
  type Money,
  type RiderHandoverReceivedVia,
} from "@banijjik/contracts/delivery";
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

export const DELIVERY_ASSIGNMENT_MODEL_NAME = "DeliveryAssignment";
export const DELIVERY_ASSIGNMENT_COLLECTION_NAME = "delivery_assignments";

export const RIDER_CASH_HANDOVER_MODEL_NAME = "RiderCashHandover";
export const RIDER_CASH_HANDOVER_COLLECTION_NAME = "rider_cash_handovers";

export interface DeliveryAssignmentDocument {
  deliveryAssignmentId: string;
  organizationId: string;
  locationId: string;
  orderId: string;
  riderMemberId: string;
  attemptOrdinal: number;
  status: DeliveryAssignmentStatus;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const deliveryAssignmentSchema = new Schema<DeliveryAssignmentDocument>(
  {
    ...domainIdField("deliveryAssignmentId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true },
    orderId: { type: String, required: true, immutable: true },
    riderMemberId: { type: String, required: true },
    attemptOrdinal: { type: Number, required: true },
    status: {
      type: String,
      required: true,
      enum: Object.values(DELIVERY_ASSIGNMENT_STATUS),
    },
    notes: { type: String, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

deliveryAssignmentSchema.index(
  { organizationId: 1, deliveryAssignmentId: 1 },
  { unique: true },
);
deliveryAssignmentSchema.index(
  { organizationId: 1, orderId: 1, attemptOrdinal: 1 },
  { unique: true },
);
deliveryAssignmentSchema.index({ organizationId: 1, locationId: 1 });
deliveryAssignmentSchema.index({ organizationId: 1, riderMemberId: 1 });
deliveryAssignmentSchema.index({ organizationId: 1, createdAt: -1 });

export interface RiderCashHandoverDocument {
  riderCashHandoverId: string;
  organizationId: string;
  locationId: string;
  riderMemberId: string;
  receivedByMemberId: string;
  paymentIds: readonly string[];
  amount: Money;
  receivedVia: RiderHandoverReceivedVia;
  posSessionId: string | null;
  businessDate: string;
  reversesRiderCashHandoverId: string | null;
  reversalReason: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const riderCashHandoverSchema = new Schema<RiderCashHandoverDocument>(
  {
    ...domainIdField("riderCashHandoverId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true },
    riderMemberId: { type: String, required: true },
    receivedByMemberId: { type: String, required: true },
    paymentIds: { type: [String], required: true },
    amount: { type: moneySchema, required: true },
    receivedVia: {
      type: String,
      required: true,
      enum: Object.values(RIDER_HANDOVER_RECEIVED_VIA),
    },
    posSessionId: { type: String, default: null },
    businessDate: { type: String, required: true },
    reversesRiderCashHandoverId: { type: String, default: null },
    reversalReason: { type: String, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

riderCashHandoverSchema.index(
  { organizationId: 1, riderCashHandoverId: 1 },
  { unique: true },
);
riderCashHandoverSchema.index(
  { organizationId: 1, reversesRiderCashHandoverId: 1 },
  { unique: true, partialFilterExpression: { reversesRiderCashHandoverId: { $type: "string" } } },
);
riderCashHandoverSchema.index({ organizationId: 1, riderMemberId: 1 });
riderCashHandoverSchema.index({ organizationId: 1, createdAt: -1 });
