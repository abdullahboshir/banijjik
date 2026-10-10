import type { SubscriptionView } from "../application/subscription-view.js";
import type { PlatformSubscription } from "../domain/platform-subscription.entity.js";
import type { PlatformSubscriptionDocument } from "./platform-subscription.schema.js";

export function toSubscriptionDocument(
  subscription: PlatformSubscription,
): PlatformSubscriptionDocument {
  return {
    platformSubscriptionId: subscription.platformSubscriptionId,
    organizationId: subscription.organizationId,
    basePackageId: subscription.basePackageId,
    addOnPackageIds: [...subscription.addOnPackageIds],
    status: subscription.status,
    trialEndsAt: subscription.trialEndsAt,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    version: subscription.version,
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
    createdByUserId: null,
    updatedByUserId: null,
  };
}

export function toSubscriptionView(document: PlatformSubscriptionDocument): SubscriptionView {
  return {
    platformSubscriptionId: document.platformSubscriptionId,
    basePackageId: document.basePackageId,
    addOnPackageIds: [...document.addOnPackageIds],
    status: document.status,
    trialEndsAt: document.trialEndsAt,
    currentPeriodEnd: document.currentPeriodEnd,
  };
}
