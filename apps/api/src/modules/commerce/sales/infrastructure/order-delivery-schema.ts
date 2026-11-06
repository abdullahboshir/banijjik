import { Schema } from "mongoose";
import { SUB_SCHEMA_OPTIONS } from "../../../../kernel/db/index.js";

interface EmbeddedMoney {
  amount: number;
  currency: string;
}

export interface DeliveryAddressDocument {
  recipientName: string;
  phoneE164: string;
  addressLine: string;
  districtCode: string;
  areaCode: string;
  postalCode: string | null;
}

export interface FirstShipmentLineDocument {
  orderLineId: string;
  quantity: number;
  unitCostSnapshot: EmbeddedMoney | null;
  lineNetTotal: EmbeddedMoney;
}

export interface FirstShipmentDocument {
  shipmentEventId: string;
  deliveryAttemptId: string;
  shippedAt: Date;
  businessDate: string;
  lines: FirstShipmentLineDocument[];
  netRevenue: EmbeddedMoney;
  taxTotal: EmbeddedMoney;
  deliveryIncome: EmbeddedMoney;
  netPaidAtShipment: EmbeddedMoney;
}

export function deliveryEmbedSchemas(moneySchema: Schema): {
  readonly deliveryAddressSubSchema: Schema;
  readonly firstShipmentSchema: Schema;
} {
  const deliveryAddressSubSchema = new Schema<DeliveryAddressDocument>(
    {
      recipientName: { type: String, required: true },
      phoneE164: { type: String, required: true },
      addressLine: { type: String, required: true },
      districtCode: { type: String, required: true },
      areaCode: { type: String, required: true },
      postalCode: { type: String, default: null },
    },
    SUB_SCHEMA_OPTIONS,
  );
  const firstShipmentLineSchema = new Schema<FirstShipmentLineDocument>(
    {
      orderLineId: { type: String, required: true },
      quantity: { type: Number, required: true },
      unitCostSnapshot: { type: moneySchema, default: null },
      lineNetTotal: { type: moneySchema, required: true },
    },
    SUB_SCHEMA_OPTIONS,
  );
  const firstShipmentSchema = new Schema<FirstShipmentDocument>(
    {
      shipmentEventId: { type: String, required: true },
      deliveryAttemptId: { type: String, required: true },
      shippedAt: { type: Date, required: true },
      businessDate: { type: String, required: true },
      lines: { type: [firstShipmentLineSchema], default: [] },
      netRevenue: { type: moneySchema, required: true },
      taxTotal: { type: moneySchema, required: true },
      deliveryIncome: { type: moneySchema, required: true },
      netPaidAtShipment: { type: moneySchema, required: true },
    },
    SUB_SCHEMA_OPTIONS,
  );
  return { deliveryAddressSubSchema, firstShipmentSchema };
}
