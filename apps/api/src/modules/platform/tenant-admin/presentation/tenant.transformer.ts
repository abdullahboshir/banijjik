import type {
  PlatformModuleOverrideResponse,
  PlatformOrganizationDetail,
  PlatformOrganizationSummary,
  PlatformSubscriptionResponse,
} from "@banijjik/contracts";
import type {
  TenantDetail,
  TenantSummary,
} from "../application/use-cases/tenant-admin.use-cases.js";
import type {
  TenantOverrideView,
  TenantSubscriptionView,
} from "../application/ports/tenant-admin-ports.js";

export function toSummaryResponse(summary: TenantSummary): PlatformOrganizationSummary {
  const { organization } = summary;
  return {
    organizationId: organization.organizationId,
    slug: organization.slug,
    name: organization.name,
    status: organization.status,
    templateKey: organization.templateKey,
    subscriptionStatus: summary.subscriptionStatus,
    memberCount: summary.memberCount,
    createdAt: organization.createdAt.toISOString(),
  };
}

function toSubscriptionResponse(view: TenantSubscriptionView): PlatformSubscriptionResponse {
  return {
    platformSubscriptionId: view.platformSubscriptionId,
    status: view.status,
    basePackageId: view.basePackageId,
    basePackageKey: view.basePackageKey,
    addOnPackageIds: [...view.addOnPackageIds],
    addOnPackageKeys: [...view.addOnPackageKeys],
    trialEndsAt: view.trialEndsAt === null ? null : view.trialEndsAt.toISOString(),
    currentPeriodEnd: view.currentPeriodEnd === null ? null : view.currentPeriodEnd.toISOString(),
    version: view.version,
  };
}

function toOverrideResponse(view: TenantOverrideView): PlatformModuleOverrideResponse {
  return {
    moduleOverrideId: view.moduleOverrideId,
    // Safe: the entitlement module stores only catalogue keys and the three override effects.
    moduleKey: view.moduleKey as PlatformModuleOverrideResponse["moduleKey"],
    effect: view.effect as PlatformModuleOverrideResponse["effect"],
    reason: view.reason,
    expiresAt: view.expiresAt === null ? null : view.expiresAt.toISOString(),
    createdAt: view.createdAt.toISOString(),
  };
}

export function toDetailResponse(detail: TenantDetail): PlatformOrganizationDetail {
  return {
    ...toSummaryResponse(detail),
    version: detail.organization.version,
    locationCount: detail.locationCount,
    owner: { displayName: detail.ownerDisplayName, maskedIdentifier: detail.ownerMaskedIdentifier },
    subscription: detail.subscription === null ? null : toSubscriptionResponse(detail.subscription),
    moduleOverrides: detail.moduleOverrides.map(toOverrideResponse),
  };
}
