import { DELIVERY_ZONE_STATUS, type DeliveryZoneStatus } from "@banijjik/contracts/sales";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const DELIVERY_ZONE_MODEL_NAME = "DeliveryZone";
export const DELIVERY_ZONE_COLLECTION_NAME = "delivery_zones";

export interface LocalizedNameDocument {
  bn: string;
  en: string;
}

export interface MoneyDocument {
  amount: number;
  currency: string;
}

export interface DeliveryZoneDocument {
  deliveryZoneId: string;
  organizationId: string;
  zoneKey: string;
  name: LocalizedNameDocument;
  areaCodes: string[];
  fee: MoneyDocument;
  status: DeliveryZoneStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const localizedNameSchema = new Schema<LocalizedNameDocument>(
  { bn: { type: String, required: true }, en: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

const moneySchema = new Schema<MoneyDocument>(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

export const deliveryZoneSchema = new Schema<DeliveryZoneDocument>(
  {
    ...domainIdField("deliveryZoneId"),
    organizationId: { type: String, required: true, immutable: true },
    zoneKey: { type: String, required: true, immutable: true },
    name: { type: localizedNameSchema, required: true },
    areaCodes: { type: [String], required: true },
    fee: { type: moneySchema, required: true },
    status: { type: String, required: true, enum: Object.values(DELIVERY_ZONE_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

deliveryZoneSchema.index({ organizationId: 1, deliveryZoneId: 1 }, { unique: true });
deliveryZoneSchema.index({ organizationId: 1, zoneKey: 1 }, { unique: true });
deliveryZoneSchema.index(
  { organizationId: 1, areaCodes: 1 },
  { unique: true, partialFilterExpression: { status: DELIVERY_ZONE_STATUS.ACTIVE } },
);
deliveryZoneSchema.index({ organizationId: 1, createdAt: -1, deliveryZoneId: 1 });
