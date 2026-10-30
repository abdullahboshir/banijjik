import { MANUAL_DISCOUNT_TYPE, APPROVAL_ACTION } from "@banijjik/contracts/pricing";
import type { StockComponent } from "@banijjik/contracts/catalog";
import { OFFERING_KIND, type OfferingKind } from "@banijjik/contracts";
import {
  FULFILLMENT_METHOD,
  ORDER_RETURN_STATUS,
  ORDER_SOURCE,
  ORDER_STATUS,
  type FulfillmentMethod,
  type OrderReturnStatus,
  type OrderSource,
  type OrderStatus,
} from "@banijjik/contracts/sales";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const ORDER_MODEL_NAME = "Order";
export const ORDER_COLLECTION_NAME = "orders";
export const ORDER_COUNTER_MODEL_NAME = "OrderCounter";
export const ORDER_COUNTER_COLLECTION_NAME = "order_counters";

export interface MoneyDocument {
  amount: number;
  currency: string;
}

export interface ManualDiscountDocument {
  type: (typeof MANUAL_DISCOUNT_TYPE)[keyof typeof MANUAL_DISCOUNT_TYPE];
  value: number;
}

export interface ModifierSnapshotDocument {
  modifierGroupId: string;
  modifierOptionId: string;
  nameSnapshot: string;
  priceDelta: MoneyDocument;
}

export interface OrderLineDocument {
  orderLineId: string;
  offeringId: string;
  variantId: string;
  kind: OfferingKind;
  nameSnapshot: string;
  quantity: number;
  unitPrice: MoneyDocument;
  listUnitPrice?: MoneyDocument;
  unitPriceOverride?: MoneyDocument | null;
  lineGross: MoneyDocument;
  lineDiscount: MoneyDocument;
  lineTax: MoneyDocument;
  lineNetTotal: MoneyDocument;
  unitCostSnapshot: MoneyDocument | null;
  modifiers: ModifierSnapshotDocument[];
  returnedQuantity: number;
  promotionIds: string[];
  taxClassKey: string | null;
  /** Internal: what one sales unit draws from stock, frozen at quote time (ADR-125). */
  costComponents: StockComponent[];
  /** Internal: the seller's discount input, never returned by the API. */
  manualDiscount: ManualDiscountDocument | null;
  /** The member who performed the line; null for an order stored before 3.11 Part C. */
  performedByMemberId: string | null;
}

export interface TotalsDocument {
  subtotal: MoneyDocument;
  discountTotal: MoneyDocument;
  taxTotal: MoneyDocument;
  deliveryCharge: MoneyDocument;
  grandTotal: MoneyDocument;
  roundingAdjustment: MoneyDocument;
}

export interface ApprovalDocument {
  approverMemberId: string;
  approvedAt: string;
  action: (typeof APPROVAL_ACTION)[keyof typeof APPROVAL_ACTION];
}

export interface RecipientDocument {
  name: string;
  phoneE164: string;
}

export interface OrderDocument {
  orderId: string;
  organizationId: string;
  orderNumber: string | null;
  invoiceNumber: string | null;
  locationId: string;
  contactId: string | null;
  status: OrderStatus;
  lines: OrderLineDocument[];
  totals: TotalsDocument;
  fulfillment: { method: FulfillmentMethod };
  businessDate: string;
  source: OrderSource;
  approval: ApprovalDocument | null;
  note: string | null;
  orderDiscount: ManualDiscountDocument | null;
  cancelReason: string | null;
  customFields: Record<string, unknown>;
  /** Whether the order holds a stock reservation; the stock port cannot answer this. */
  hasStockLines: boolean;
  /** The POS register that sold this order; null for every other order (plan 3.9 A2-6). */
  posSessionId: string | null;
  /** Linked storefront checkout id when created via customer checkout (card 4.3). */
  checkoutId: string | null;
  /** Verified recipient snapshot when submitted via customer checkout (card 4.3). */
  recipient: RecipientDocument | null;
  returnStatus: OrderReturnStatus;
  completedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export interface OrderCounterDocument {
  orderCounterId: string;
  organizationId: string;
  monthKey: string;
  count: number;
}

const moneySchema = new Schema<MoneyDocument>(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

const manualDiscountSchema = new Schema<ManualDiscountDocument>(
  {
    type: { type: String, required: true, enum: Object.values(MANUAL_DISCOUNT_TYPE) },
    value: { type: Number, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const modifierSnapshotSchema = new Schema<ModifierSnapshotDocument>(
  {
    modifierGroupId: { type: String, required: true },
    modifierOptionId: { type: String, required: true },
    nameSnapshot: { type: String, required: true },
    priceDelta: { type: moneySchema, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const costComponentSchema = new Schema<StockComponent>(
  {
    inventoryItemId: { type: String, required: true },
    quantity: { type: Number, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const orderLineSchema = new Schema<OrderLineDocument>(
  {
    orderLineId: { type: String, required: true },
    offeringId: { type: String, required: true },
    variantId: { type: String, required: true },
    kind: { type: String, required: true, enum: Object.values(OFFERING_KIND) },
    nameSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: moneySchema, required: true },
    listUnitPrice: { type: moneySchema, default: undefined },
    unitPriceOverride: { type: moneySchema, default: null },
    lineGross: { type: moneySchema, required: true },
    lineDiscount: { type: moneySchema, required: true },
    lineTax: { type: moneySchema, required: true },
    lineNetTotal: { type: moneySchema, required: true },
    unitCostSnapshot: { type: moneySchema, default: null },
    modifiers: { type: [modifierSnapshotSchema], default: [] },
    returnedQuantity: { type: Number, required: true, default: 0 },
    promotionIds: { type: [String], default: [] },
    taxClassKey: { type: String, default: null },
    costComponents: { type: [costComponentSchema], default: [] },
    manualDiscount: { type: manualDiscountSchema, default: null },
    performedByMemberId: { type: String, default: null },
  },
  SUB_SCHEMA_OPTIONS,
);

const totalsSchema = new Schema<TotalsDocument>(
  {
    subtotal: { type: moneySchema, required: true },
    discountTotal: { type: moneySchema, required: true },
    taxTotal: { type: moneySchema, required: true },
    deliveryCharge: { type: moneySchema, required: true },
    grandTotal: { type: moneySchema, required: true },
    roundingAdjustment: { type: moneySchema, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const fulfillmentSchema = new Schema<{ method: FulfillmentMethod }>(
  { method: { type: String, required: true, enum: Object.values(FULFILLMENT_METHOD) } },
  SUB_SCHEMA_OPTIONS,
);

const approvalSchema = new Schema<ApprovalDocument>(
  {
    approverMemberId: { type: String, required: true },
    approvedAt: { type: String, required: true },
    action: { type: String, required: true, enum: Object.values(APPROVAL_ACTION) },
  },
  SUB_SCHEMA_OPTIONS,
);

const recipientSchema = new Schema<RecipientDocument>(
  {
    name: { type: String, required: true },
    phoneE164: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

export const orderSchema = new Schema<OrderDocument>(
  {
    ...domainIdField("orderId"),
    organizationId: { type: String, required: true, immutable: true },
    orderNumber: { type: String, default: null },
    invoiceNumber: { type: String, default: null },
    locationId: { type: String, required: true, immutable: true },
    contactId: { type: String, default: null },
    status: { type: String, required: true, enum: Object.values(ORDER_STATUS) },
    lines: { type: [orderLineSchema], default: [] },
    totals: { type: totalsSchema, required: true },
    fulfillment: { type: fulfillmentSchema, required: true },
    businessDate: { type: String, required: true },
    source: { type: String, required: true, enum: Object.values(ORDER_SOURCE) },
    approval: { type: approvalSchema, default: null },
    note: { type: String, default: null },
    orderDiscount: { type: manualDiscountSchema, default: null },
    cancelReason: { type: String, default: null },
    customFields: { type: Schema.Types.Mixed, default: {} },
    hasStockLines: { type: Boolean, required: true, default: false },
    posSessionId: { type: String, default: null },
    checkoutId: { type: String, default: null },
    recipient: { type: recipientSchema, default: null },
    completedAt: { type: Date, default: null },
    returnStatus: {
      type: String,
      required: true,
      default: ORDER_RETURN_STATUS.NONE,
      enum: Object.values(ORDER_RETURN_STATUS),
    },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

orderSchema.index({ organizationId: 1, orderId: 1 }, { unique: true });
orderSchema.index(
  { organizationId: 1, orderNumber: 1 },
  { unique: true, partialFilterExpression: { orderNumber: { $type: "string" } } },
);
orderSchema.index({ organizationId: 1, locationId: 1, status: 1, createdAt: -1 });
orderSchema.index({ organizationId: 1, contactId: 1, createdAt: -1 });
/** The Z-report read of one register's sales (plan 3.9 A2-6): only till orders are indexed. */
orderSchema.index(
  { organizationId: 1, posSessionId: 1 },
  { partialFilterExpression: { posSessionId: { $type: "string" } } },
);
/** The drafts and placed-orders scans of the hourly jobs (plan decisions 4 and 5). */
orderSchema.index({ organizationId: 1, status: 1, createdAt: 1, orderId: 1 });
orderSchema.index(
  { organizationId: 1, checkoutId: 1 },
  { partialFilterExpression: { checkoutId: { $type: "string" } } },
);

export const orderCounterSchema = new Schema<OrderCounterDocument>(
  {
    ...domainIdField("orderCounterId"),
    organizationId: { type: String, required: true, immutable: true },
    monthKey: { type: String, required: true, immutable: true },
    count: { type: Number, required: true, default: 0 },
  },
  SCHEMA_OPTIONS,
);

orderCounterSchema.index({ organizationId: 1, monthKey: 1 }, { unique: true });
