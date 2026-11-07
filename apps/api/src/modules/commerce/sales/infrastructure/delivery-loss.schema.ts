import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const DELIVERY_LOSS_CLOSURE_MODEL_NAME = "DeliveryLossClosure";
export const DELIVERY_LOSS_CLOSURE_COLLECTION_NAME = "delivery_loss_closures";

export const DELIVERY_LOSS_RECOVERY_MODEL_NAME = "DeliveryLossRecovery";
export const DELIVERY_LOSS_RECOVERY_COLLECTION_NAME = "delivery_loss_recoveries";

export interface DeliveryLossClosureLineDocument {
  orderLineId: string;
  offeringId: string;
  variantId: string;
  inventoryItemId: string | null;
  shippedQuantity: number;
  restockQuantity: number;
  damagedQuantity: number;
  lostQuantity: number;
  recoveredQuantity: number;
  lostCostAmount: number;
  costCurrency: string;
}

export interface DeliveryLossClosureDocument {
  deliveryLossClosureId: string;
  organizationId: string;
  orderId: string;
  locationId: string;
  firstShipmentEventId: string | null;
  reasonKey: string;
  evidenceFileIds: string[];
  lines: DeliveryLossClosureLineDocument[];
  totalLostCostAmount: number;
  totalLostCostCurrency: string;
  approvalToken: string;
  approvalApproverMemberId: string;
  approvalAction: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string;
  updatedByUserId: string;
}

const deliveryLossClosureLineSchema = new Schema<DeliveryLossClosureLineDocument>(
  {
    orderLineId: { type: String, required: true },
    offeringId: { type: String, required: true },
    variantId: { type: String, required: true },
    inventoryItemId: { type: String, default: null },
    shippedQuantity: { type: Number, required: true },
    restockQuantity: { type: Number, required: true },
    damagedQuantity: { type: Number, required: true },
    lostQuantity: { type: Number, required: true },
    recoveredQuantity: { type: Number, required: true, default: 0 },
    lostCostAmount: { type: Number, required: true },
    costCurrency: { type: String, required: true },
  },
  { _id: false },
);

export const deliveryLossClosureSchema = new Schema<DeliveryLossClosureDocument>(
  {
    ...domainIdField("deliveryLossClosureId"),
    organizationId: { type: String, required: true, immutable: true },
    orderId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    firstShipmentEventId: { type: String, default: null },
    reasonKey: { type: String, required: true },
    evidenceFileIds: { type: [String], default: [] },
    lines: { type: [deliveryLossClosureLineSchema], required: true },
    totalLostCostAmount: { type: Number, required: true },
    totalLostCostCurrency: { type: String, required: true },
    approvalToken: { type: String, required: true },
    approvalApproverMemberId: { type: String, required: true },
    approvalAction: { type: String, required: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

deliveryLossClosureSchema.index({ organizationId: 1, orderId: 1 }, { unique: true });

export interface DeliveryLossRecoveryLineDocument {
  orderLineId: string;
  offeringId: string;
  variantId: string;
  inventoryItemId: string | null;
  restockQuantity: number;
  damagedQuantity: number;
  recoveredCostAmount: number;
  costCurrency: string;
}

export interface DeliveryLossRecoveryDocument {
  deliveryLossRecoveryId: string;
  organizationId: string;
  deliveryLossClosureId: string;
  orderId: string;
  locationId: string;
  lines: DeliveryLossRecoveryLineDocument[];
  totalRecoveredCostAmount: number;
  totalRecoveredCostCurrency: string;
  approvalToken: string;
  approvalApproverMemberId: string;
  approvalAction: string;
  createdAt: Date;
  createdByUserId: string;
}

const deliveryLossRecoveryLineSchema = new Schema<DeliveryLossRecoveryLineDocument>(
  {
    orderLineId: { type: String, required: true },
    offeringId: { type: String, required: true },
    variantId: { type: String, required: true },
    inventoryItemId: { type: String, default: null },
    restockQuantity: { type: Number, required: true },
    damagedQuantity: { type: Number, required: true },
    recoveredCostAmount: { type: Number, required: true },
    costCurrency: { type: String, required: true },
  },
  { _id: false },
);

export const deliveryLossRecoverySchema = new Schema<DeliveryLossRecoveryDocument>(
  {
    ...domainIdField("deliveryLossRecoveryId"),
    organizationId: { type: String, required: true, immutable: true },
    deliveryLossClosureId: { type: String, required: true, immutable: true },
    orderId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    lines: { type: [deliveryLossRecoveryLineSchema], required: true },
    totalRecoveredCostAmount: { type: Number, required: true },
    totalRecoveredCostCurrency: { type: String, required: true },
    approvalToken: { type: String, required: true },
    approvalApproverMemberId: { type: String, required: true },
    approvalAction: { type: String, required: true },
    createdAt: { type: Date, required: true },
    createdByUserId: { type: String, required: true },
  },
  SCHEMA_OPTIONS,
);

deliveryLossRecoverySchema.index({ organizationId: 1, deliveryLossClosureId: 1, createdAt: 1 });
