import type { CurrencyCode } from "@banijjik/contracts";
import {
  POS_DEVICE_STATUS,
  POS_SESSION_STATUS,
  type PosDeviceStatus,
  type PosHeldCartPayload,
  type PosSessionStatus,
  type PosZReport,
} from "@banijjik/contracts/pos";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const POS_DEVICE_MODEL_NAME = "PosDevice";
export const POS_DEVICE_COLLECTION_NAME = "pos_devices";
export const POS_SESSION_MODEL_NAME = "PosSession";
export const POS_SESSION_COLLECTION_NAME = "pos_sessions";
export const POS_HELD_CART_MODEL_NAME = "PosHeldCart";
export const POS_HELD_CART_COLLECTION_NAME = "pos_held_carts";

export interface MoneyDocument {
  amount: number;
  currency: CurrencyCode;
}

export interface PosDeviceDocument {
  posDeviceId: string;
  organizationId: string;
  locationId: string;
  name: string;
  status: PosDeviceStatus;
  secretHash: string | null;
  pairingCodeHash: string | null;
  pairingExpiresAt: Date | null;
  pairedAt: Date | null;
  lastSeenAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export interface PosSessionDocument {
  posSessionId: string;
  organizationId: string;
  posDeviceId: string;
  locationId: string;
  openedByMemberId: string;
  openingFloat: MoneyDocument;
  status: PosSessionStatus;
  openedAt: Date;
  lastSaleAt: Date | null;
  closedAt: Date | null;
  closedByMemberId: string | null;
  expectedCash: MoneyDocument | null;
  countedCash: MoneyDocument | null;
  variance: MoneyDocument | null;
  closeNote: string | null;
  zReportNumber: string | null;
  /** The frozen report, written once at close and never read field by field. */
  zReport: PosZReport | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

const moneySchema = new Schema<MoneyDocument>(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

export const posDeviceSchema = new Schema<PosDeviceDocument>(
  {
    ...domainIdField("posDeviceId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    name: { type: String, required: true },
    status: { type: String, required: true, enum: Object.values(POS_DEVICE_STATUS) },
    secretHash: { type: String, default: null },
    pairingCodeHash: { type: String, default: null },
    pairingExpiresAt: { type: Date, default: null },
    pairedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

posDeviceSchema.index({ organizationId: 1, posDeviceId: 1 }, { unique: true });
posDeviceSchema.index({ organizationId: 1, locationId: 1, createdAt: -1, posDeviceId: -1 });
posDeviceSchema.index({ organizationId: 1, status: 1 });
// The cookie secret finds its device in one indexed read; two devices never share one.
posDeviceSchema.index(
  { organizationId: 1, secretHash: 1 },
  { unique: true, partialFilterExpression: { secretHash: { $type: "string" } } },
);
// Only a waiting code is indexed; using or clearing it frees the slot.
posDeviceSchema.index(
  { organizationId: 1, pairingCodeHash: 1 },
  { unique: true, partialFilterExpression: { pairingCodeHash: { $type: "string" } } },
);

export const posSessionSchema = new Schema<PosSessionDocument>(
  {
    ...domainIdField("posSessionId"),
    organizationId: { type: String, required: true, immutable: true },
    posDeviceId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    openedByMemberId: { type: String, required: true, immutable: true },
    openingFloat: { type: moneySchema, required: true, immutable: true },
    status: { type: String, required: true, enum: Object.values(POS_SESSION_STATUS) },
    openedAt: { type: Date, required: true, immutable: true },
    lastSaleAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    closedByMemberId: { type: String, default: null },
    expectedCash: { type: moneySchema, default: null },
    countedCash: { type: moneySchema, default: null },
    variance: { type: moneySchema, default: null },
    closeNote: { type: String, default: null },
    zReportNumber: { type: String, default: null },
    zReport: { type: Schema.Types.Mixed, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

posSessionSchema.index({ organizationId: 1, posSessionId: 1 }, { unique: true });
// One OPEN session per device (plan 3.9 decision 3): a second open loses on this index.
posSessionSchema.index(
  { organizationId: 1, posDeviceId: 1 },
  { unique: true, partialFilterExpression: { status: POS_SESSION_STATUS.OPEN } },
);
// A Z-report number is never used twice, even if a bug skipped the sequence.
posSessionSchema.index(
  { organizationId: 1, zReportNumber: 1 },
  { unique: true, partialFilterExpression: { zReportNumber: { $type: "string" } } },
);
posSessionSchema.index({ organizationId: 1, locationId: 1, openedAt: -1, posSessionId: -1 });

export interface PosHeldCartDocument {
  posHeldCartId: string;
  organizationId: string;
  locationId: string;
  posDeviceId: string;
  heldByMemberId: string;
  label: string;
  cart: PosHeldCartPayload;
  expiresAt: Date;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const posHeldCartSchema = new Schema<PosHeldCartDocument>(
  {
    ...domainIdField("posHeldCartId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    posDeviceId: { type: String, required: true, immutable: true },
    heldByMemberId: { type: String, required: true, immutable: true },
    label: { type: String, required: true },
    cart: { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true, immutable: true },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

posHeldCartSchema.index({ organizationId: 1, posHeldCartId: 1 }, { unique: true });
posHeldCartSchema.index({ organizationId: 1, posDeviceId: 1, createdAt: -1, posHeldCartId: -1 });
posHeldCartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
