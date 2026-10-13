import type { PlatformSubscriptionResponse } from "@banijjik/contracts";
import type { SubscriptionDetail } from "../application/use-cases/subscription-detail.js";

export function toSubscriptionResponse(detail: SubscriptionDetail): PlatformSubscriptionResponse {
  return {
    platformSubscriptionId: detail.platformSubscriptionId,
    status: detail.status,
    basePackageId: detail.basePackageId,
    basePackageKey: detail.basePackageKey,
    addOnPackageIds: [...detail.addOnPackageIds],
    addOnPackageKeys: [...detail.addOnPackageKeys],
    trialEndsAt: detail.trialEndsAt === null ? null : detail.trialEndsAt.toISOString(),
    currentPeriodEnd:
      detail.currentPeriodEnd === null ? null : detail.currentPeriodEnd.toISOString(),
    version: detail.version,
  };
}
