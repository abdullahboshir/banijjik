import {
  BOOKING_KIND,
  BOOKING_SOURCE,
  BOOKING_STATUS,
  RESOURCE_STATUS,
  type BookingKind,
  type BookingSource,
  type BookingStatus,
  type ResourceStatus,
} from "@banijjik/contracts/booking";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const RESOURCE_MODEL_NAME = "Resource";
export const RESOURCE_COLLECTION_NAME = "resources";
export const RESOURCE_TIME_OFF_MODEL_NAME = "ResourceTimeOff";
export const RESOURCE_TIME_OFF_COLLECTION_NAME = "resource_time_offs";
export const BOOKING_MODEL_NAME = "Booking";
export const BOOKING_COLLECTION_NAME = "bookings";
export const RESOURCE_SLOT_USAGE_MODEL_NAME = "ResourceSlotUsage";
export const RESOURCE_SLOT_USAGE_COLLECTION_NAME = "resource_slot_usages";

const scheduleRangeSchema = new Schema(
  {
    weekday: { type: Number, required: true },
    opensAt: { type: String, required: true },
    closesAt: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const moneySchema = new Schema(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);

const priceSnapshotSchema = new Schema(
  {
    unitPrice: { type: moneySchema, required: true },
    total: { type: moneySchema, required: true },
    tax: { type: moneySchema, required: true },
    currency: { type: String, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);

const historySchema = new Schema(
  {
    at: { type: String, required: true },
    action: { type: String, required: true },
    fromStartsAt: { type: String },
    fromEndsAt: { type: String },
    toStartsAt: { type: String },
    toEndsAt: { type: String },
    actorUserId: { type: String },
    note: { type: String },
  },
  SUB_SCHEMA_OPTIONS,
);

export interface ResourceDocument {
  resourceId: string;
  organizationId: string;
  locationId: string;
  resourceTypeKey: string;
  name: string;
  memberId: string | null;
  capacity: number;
  weeklySchedule: { weekday: number; opensAt: string; closesAt: string }[];
  offeringIds: string[];
  status: ResourceStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export interface ResourceTimeOffDocument {
  resourceTimeOffId: string;
  organizationId: string;
  locationId: string;
  resourceId: string;
  startsAt: Date;
  endsAt: Date;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export interface BookingDocument {
  bookingId: string;
  organizationId: string;
  bookingNumber: string | null;
  locationId: string;
  contactId: string;
  offeringId: string;
  variantId: string;
  kind: BookingKind;
  depositRequired: { amount: number; currency: string };
  startsAt: Date;
  endsAt: Date;
  blockedEndsAt: Date;
  resourceIds: string[];
  providerMemberId: string | null;
  quantity: number;
  price: {
    unitPrice: { amount: number; currency: string };
    total: { amount: number; currency: string };
    tax: { amount: number; currency: string };
    currency: string;
  };
  status: BookingStatus;
  source: BookingSource;
  note: string | null;
  holdExpiresAt: Date | null;
  cancellationFeeRetained?: { amount: number; currency: string } | null;
  history: {
    at: string;
    action: string;
    fromStartsAt?: string;
    fromEndsAt?: string;
    toStartsAt?: string;
    toEndsAt?: string;
    actorUserId?: string;
    note?: string;
  }[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export interface ResourceSlotUsageDocument {
  resourceSlotUsageId: string;
  organizationId: string;
  resourceId: string;
  bucketStart: Date;
  used: number;
}

export const resourceSchema = new Schema<ResourceDocument>(
  {
    ...domainIdField("resourceId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    resourceTypeKey: { type: String, required: true },
    name: { type: String, required: true },
    memberId: { type: String, default: null },
    capacity: { type: Number, required: true },
    weeklySchedule: { type: [scheduleRangeSchema], default: [] },
    offeringIds: { type: [String], default: [] },
    status: { type: String, required: true, enum: Object.values(RESOURCE_STATUS) },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

resourceSchema.index({ organizationId: 1, locationId: 1, resourceTypeKey: 1, status: 1 });
resourceSchema.index({ organizationId: 1, memberId: 1 });

export const resourceTimeOffSchema = new Schema<ResourceTimeOffDocument>(
  {
    ...domainIdField("resourceTimeOffId"),
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true, immutable: true },
    resourceId: { type: String, required: true, immutable: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    reason: { type: String, default: null },
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

resourceTimeOffSchema.index({ organizationId: 1, resourceId: 1, startsAt: 1 });

export const bookingSchema = new Schema<BookingDocument>(
  {
    ...domainIdField("bookingId"),
    organizationId: { type: String, required: true, immutable: true },
    bookingNumber: { type: String, default: null },
    locationId: { type: String, required: true, immutable: true },
    contactId: { type: String, required: true },
    offeringId: { type: String, required: true },
    variantId: { type: String, required: true },
    kind: { type: String, required: true, enum: Object.values(BOOKING_KIND) },
    depositRequired: { type: moneySchema, required: true },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    blockedEndsAt: { type: Date, required: true },
    resourceIds: { type: [String], required: true },
    providerMemberId: { type: String, default: null },
    quantity: { type: Number, required: true },
    price: { type: priceSnapshotSchema, required: true },
    status: { type: String, required: true, enum: Object.values(BOOKING_STATUS) },
    source: { type: String, required: true, enum: Object.values(BOOKING_SOURCE) },
    note: { type: String, default: null },
    holdExpiresAt: { type: Date, default: null },
    cancellationFeeRetained: { type: moneySchema, default: null },
    history: { type: [historySchema], default: [] },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

bookingSchema.index({ organizationId: 1, bookingId: 1 }, { unique: true });
bookingSchema.index(
  { organizationId: 1, bookingNumber: 1 },
  { unique: true, partialFilterExpression: { bookingNumber: { $type: "string" } } },
);
bookingSchema.index({ organizationId: 1, locationId: 1, startsAt: 1 });
bookingSchema.index({ organizationId: 1, contactId: 1, createdAt: -1 });
bookingSchema.index({ organizationId: 1, status: 1, holdExpiresAt: 1, bookingId: 1 });
bookingSchema.index({ organizationId: 1, status: 1, startsAt: 1, bookingId: 1 });
bookingSchema.index({ organizationId: 1, resourceIds: 1, startsAt: 1 });

export const resourceSlotUsageSchema = new Schema<ResourceSlotUsageDocument>(
  {
    ...domainIdField("resourceSlotUsageId"),
    organizationId: { type: String, required: true, immutable: true },
    resourceId: { type: String, required: true, immutable: true },
    bucketStart: { type: Date, required: true, immutable: true },
    used: { type: Number, required: true, default: 0 },
  },
  SCHEMA_OPTIONS,
);

resourceSlotUsageSchema.index(
  { organizationId: 1, resourceId: 1, bucketStart: 1 },
  { unique: true },
);
