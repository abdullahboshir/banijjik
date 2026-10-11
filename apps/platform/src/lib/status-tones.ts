import {
  ORGANIZATION_STATUS,
  PACKAGE_STATUS,
  SUBSCRIPTION_STATUS,
  type OrganizationStatus,
  type PackageStatus,
  type SubscriptionStatus,
} from "@banijjik/contracts";
import type { StatusTone } from "@banijjik/ui";

const ORGANIZATION_TONES: Record<OrganizationStatus, StatusTone> = {
  [ORGANIZATION_STATUS.ACTIVE]: "success",
  [ORGANIZATION_STATUS.SUSPENDED]: "warning",
  [ORGANIZATION_STATUS.CLOSED]: "neutral",
};
const SUBSCRIPTION_TONES: Record<SubscriptionStatus, StatusTone> = {
  [SUBSCRIPTION_STATUS.TRIALING]: "info",
  [SUBSCRIPTION_STATUS.ACTIVE]: "success",
  [SUBSCRIPTION_STATUS.PAST_DUE]: "warning",
  [SUBSCRIPTION_STATUS.CANCELLED]: "neutral",
};
const PACKAGE_TONES: Record<PackageStatus, StatusTone> = {
  [PACKAGE_STATUS.ACTIVE]: "success",
  [PACKAGE_STATUS.ARCHIVED]: "neutral",
};

export function organizationTone(status: OrganizationStatus): StatusTone {
  return ORGANIZATION_TONES[status];
}

export function subscriptionTone(status: SubscriptionStatus): StatusTone {
  return SUBSCRIPTION_TONES[status];
}

export function packageTone(status: PackageStatus): StatusTone {
  return PACKAGE_TONES[status];
}
