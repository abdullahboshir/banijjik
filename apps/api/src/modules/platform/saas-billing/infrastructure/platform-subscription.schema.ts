import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from "@banijjik/contracts";
import { Schema } from "mongoose";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  versionField,
} from "../../../../kernel/db/index.js";

export const PLATFORM_SUBSCRIPTION_MODEL_NAME = "PlatformSubscription";
export const PLATFORM_SUBSCRIPTION_COLLECTION_NAME = "platform_subscriptions";

export interface PlatformSubscriptionDocument {
  platformSubscriptionId: string;
  organizationId: string;
  basePackageId: string;
  addOnPackageIds: string[];
  status: SubscriptionStatus;
  trialEndsAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}

export const OPEN_SUBSCRIPTION_STATUSES = [
  SUBSCRIPTION_STATUS.TRIALING,
  SUBSCRIPTION_STATUS.ACTIVE,
  SUBSCRIPTION_STATUS.PAST_DUE,
];

export const platformSubscriptionSchema = new Schema<PlatformSubscriptionDocument>(
  {
    ...domainIdField("platformSubscriptionId"),
    organizationId: { type: String, required: true, immutable: true },
    basePackageId: { type: String, required: true },
    addOnPackageIds: { type: [String], default: [] },
    status: { type: String, required: true, enum: Object.values(SUBSCRIPTION_STATUS) },
    trialEndsAt: { type: Date, default: null },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    ...versionField,
    ...auditFields,
  },
  SCHEMA_OPTIONS,
);

platformSubscriptionSchema.index(
  { organizationId: 1, platformSubscriptionId: 1 },
  { unique: true },
);
// Exactly one open subscription per organization (09 section 4.6): a cancelled one frees the slot.
platformSubscriptionSchema.index(
  { organizationId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: OPEN_SUBSCRIPTION_STATUSES } },
  },
);
