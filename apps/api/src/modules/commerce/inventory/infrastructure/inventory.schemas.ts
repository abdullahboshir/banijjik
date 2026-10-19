import {
  INVENTORY_ITEM_STATUS,
  STOCK_MOVEMENT_REASON,
  STOCK_SOURCE_TYPE,
  STOCK_STATE,
  type InventoryItemStatus,
  type StockMovementReason,
  type StockSourceType,
  type StockState,
} from "@banijjik/contracts/inventory";
import { UNIT_KEY, type UnitKey } from "@banijjik/contracts/catalog";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const INVENTORY_ITEM_MODEL_NAME = "InventoryItem";
export const INVENTORY_ITEM_COLLECTION_NAME = "inventory_items";

export interface InventoryItemDocument {
  inventoryItemId: string;
  organizationId: string;
  name: string;
  nameSearch: string;
  sku?: string;
  baseUnitKey: UnitKey;
  lowStockThreshold?: number;
  status: InventoryItemStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const inventoryItemSchema = new Schema<InventoryItemDocument>(
  {
    ...domainIdField("inventoryItemId"),
    organizationId: { type: String, required: true, immutable: true },
    name: { type: String, required: true },
    nameSearch: { type: String, required: true },
    sku: { type: String },
    baseUnitKey: { type: String, required: true, enum: Object.values(UNIT_KEY) },
    lowStockThreshold: { type: Number },
    status: {
      type: String,
      required: true,
      enum: Object.values(INVENTORY_ITEM_STATUS),
    },
    ...versionField,
    ...auditFields,
  },
  { ...SCHEMA_OPTIONS, collection: INVENTORY_ITEM_COLLECTION_NAME },
);

inventoryItemSchema.index({ organizationId: 1, inventoryItemId: 1 }, { unique: true });
inventoryItemSchema.index(
  { organizationId: 1, sku: 1 },
  { unique: true, partialFilterExpression: { sku: { $type: "string" } } },
);
inventoryItemSchema.index({ organizationId: 1, nameSearch: 1, status: 1 });

export const STOCK_MOVEMENT_MODEL_NAME = "StockMovement";
export const STOCK_MOVEMENT_COLLECTION_NAME = "stock_movements";

export interface StockMovementDocument {
  stockMovementId: string;
  organizationId: string;
  locationId: string;
  inventoryItemId: string;
  quantityDelta: number;
  stockState: StockState;
  reason: StockMovementReason;
  sourceType: string;
  sourceId: string;
  reversesStockMovementId?: string;
  unitCostAmount?: number;
  unitCostCurrency?: string;
  unitCostMicros?: number;
  offeringId?: string;
  variantId?: string;
  note?: string;
  occurredAt: Date;
  businessDate: string;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const stockMovementSchema = new Schema<StockMovementDocument>(
  {
    ...domainIdField("stockMovementId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    inventoryItemId: { type: String, required: true, immutable: true },
    quantityDelta: { type: Number, required: true },
    stockState: { type: String, required: true, enum: Object.values(STOCK_STATE) },
    reason: { type: String, required: true, enum: Object.values(STOCK_MOVEMENT_REASON) },
    sourceType: { type: String, required: true },
    sourceId: { type: String, required: true },
    reversesStockMovementId: { type: String },
    unitCostAmount: { type: Number },
    unitCostCurrency: { type: String },
    unitCostMicros: { type: Number },
    offeringId: { type: String },
    variantId: { type: String },
    note: { type: String },
    occurredAt: { type: Date, required: true },
    businessDate: { type: String, required: true },
    createdByUserId: { type: String, default: null },
    updatedByUserId: { type: String, default: null },
  },
  { ...SCHEMA_OPTIONS, collection: STOCK_MOVEMENT_COLLECTION_NAME, timestamps: true },
);

stockMovementSchema.index({ organizationId: 1, stockMovementId: 1 }, { unique: true });
stockMovementSchema.index({
  organizationId: 1,
  locationId: 1,
  inventoryItemId: 1,
  occurredAt: -1,
});

export const INVENTORY_LEVEL_MODEL_NAME = "InventoryLevel";
export const INVENTORY_LEVEL_COLLECTION_NAME = "inventory_levels";

export interface InventoryLevelDocument {
  inventoryLevelId: string;
  organizationId: string;
  locationId: string;
  inventoryItemId: string;
  onHand: number;
  reserved: number;
  damaged: number;
  averageUnitCostMicros: number;
  averageUnitCostCurrency: string;
  lowStockActive: boolean;
  version: number;
  updatedAt: Date;
}

export const inventoryLevelSchema = new Schema<InventoryLevelDocument>(
  {
    ...domainIdField("inventoryLevelId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    inventoryItemId: { type: String, required: true, immutable: true },
    onHand: { type: Number, required: true, default: 0 },
    reserved: { type: Number, required: true, default: 0 },
    damaged: { type: Number, required: true, default: 0 },
    averageUnitCostMicros: { type: Number, required: true, default: 0 },
    averageUnitCostCurrency: { type: String, required: true },
    lowStockActive: { type: Boolean, required: true, default: false },
    ...versionField,
    updatedAt: { type: Date, required: true },
  },
  { ...SCHEMA_OPTIONS, collection: INVENTORY_LEVEL_COLLECTION_NAME },
);

inventoryLevelSchema.index(
  { organizationId: 1, locationId: 1, inventoryItemId: 1 },
  { unique: true },
);

export const STOCK_RESERVATION_MODEL_NAME = "StockReservation";
export const STOCK_RESERVATION_COLLECTION_NAME = "stock_reservations";

export interface StockReservationLineDocument {
  inventoryItemId: string;
  quantity: number;
}

export interface StockReservationDocument {
  stockReservationId: string;
  organizationId: string;
  locationId: string;
  sourceType: StockSourceType;
  sourceId: string;
  lines: StockReservationLineDocument[];
  createdAt: Date;
}

const reservationLineSchema = new Schema<StockReservationLineDocument>(
  {
    inventoryItemId: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  { _id: false },
);

export const stockReservationSchema = new Schema<StockReservationDocument>(
  {
    ...domainIdField("stockReservationId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    sourceType: { type: String, required: true, enum: Object.values(STOCK_SOURCE_TYPE) },
    sourceId: { type: String, required: true },
    lines: { type: [reservationLineSchema], required: true },
    createdAt: { type: Date, required: true },
  },
  { ...SCHEMA_OPTIONS, collection: STOCK_RESERVATION_COLLECTION_NAME },
);

stockReservationSchema.index({ organizationId: 1, sourceType: 1, sourceId: 1 }, { unique: true });
