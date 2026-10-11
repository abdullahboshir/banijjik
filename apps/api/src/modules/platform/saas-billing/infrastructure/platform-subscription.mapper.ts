import {
  asId,
  type OrganizationId,
  type PackageId,
  type PlatformSubscriptionId,
} from "@banijjik/ids";
import { stripMongoInternals } from "../../../../kernel/db/index.js";
import type { SubscriptionView } from "../application/subscription-view.js";
import { PlatformSubscription } from "../domain/platform-subscription.entity.js";
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

/** Rebuilds the entity the platform use cases change. */
export function toSubscription(document: PlatformSubscriptionDocument): PlatformSubscription {
  const stored = stripMongoInternals(document);
  return PlatformSubscription.restore({
    platformSubscriptionId: asId<PlatformSubscriptionId>(stored.platformSubscriptionId),
    organizationId: asId<OrganizationId>(stored.organizationId),
    basePackageId: asId<PackageId>(stored.basePackageId),
    addOnPackageIds: stored.addOnPackageIds.map((packageId) => asId<PackageId>(packageId)),
    status: stored.status,
    trialEndsAt: stored.trialEndsAt,
    currentPeriodStart: stored.currentPeriodStart,
    currentPeriodEnd: stored.currentPeriodEnd,
    version: stored.version,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  });
}
