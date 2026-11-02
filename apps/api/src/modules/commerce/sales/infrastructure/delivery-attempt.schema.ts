import { FULFILLMENT_METHOD } from "@banijjik/contracts/sales";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const DELIVERY_ATTEMPT_MODEL_NAME = "DeliveryAttempt";
export const DELIVERY_ATTEMPT_COLLECTION_NAME = "delivery_attempts";

const DELIVERY_DISPATCH_METHODS = [
  FULFILLMENT_METHOD.COURIER,
  FULFILLMENT_METHOD.OWN_RIDER,
] as const;

export interface DeliveryAttemptDocument {
  deliveryAttemptId: string;
  organizationId: string;
  orderId: string;
  ordinal: number;
  method: (typeof DELIVERY_DISPATCH_METHODS)[number];
  consignmentId: string | null;
  deliveryAssignmentId: string | null;
  startedAt: Date;
  failedAt: Date | null;
  reasonKey: string | null;
  note: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const deliveryAttemptSchema = new Schema<DeliveryAttemptDocument>(
  {
    ...domainIdField("deliveryAttemptId"),
    organizationId: { type: String, required: true, immutable: true },
    orderId: { type: String, required: true, immutable: true },
    ordinal: { type: Number, required: true, immutable: true },
    method: { type: String, required: true, enum: [...DELIVERY_DISPATCH_METHODS] },
    consignmentId: { type: String, default: null },
    deliveryAssignmentId: { type: String, default: null },
    startedAt: { type: Date, required: true },
    failedAt: { type: Date, default: null },
    reasonKey: { type: String, default: null },
    note: { type: String, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

deliveryAttemptSchema.index({ organizationId: 1, deliveryAttemptId: 1 }, { unique: true });
deliveryAttemptSchema.index({ organizationId: 1, orderId: 1, ordinal: 1 }, { unique: true });
deliveryAttemptSchema.index({ organizationId: 1, orderId: 1, startedAt: -1 });
