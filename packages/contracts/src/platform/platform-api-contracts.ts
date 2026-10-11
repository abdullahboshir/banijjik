import type { LimitKey, LimitMap } from "../entitlement/limit-key.js";
import type { ModuleOverrideEffect } from "../entitlement/module-override-effect.js";
import type { PackageStatus } from "../entitlement/package-status.js";
import type { SubscriptionStatus } from "../entitlement/subscription-status.js";
import type { PlatformRole } from "../iam/platform-role.js";
import type { ModuleKey } from "../modules/module-key.js";
import type { IndustryTemplateKey } from "../organization/industry-template-key.js";
import type { OrganizationStatus } from "../organization/organization-status.js";
import type { PlatformPermissionKey } from "./platform-permission.js";

/** Answer of `POST /platform/auth/login`: who signed in and what they may do. */
export interface PlatformSessionResponse {
  userId: string;
  platformOperatorId: string;
  name: string;
  platformRoles: PlatformRole[];
  permissions: PlatformPermissionKey[];
}

/** One row of `GET /platform/organizations`. */
export interface PlatformOrganizationSummary {
  organizationId: string;
  slug: string;
  name: string;
  status: OrganizationStatus;
  templateKey: IndustryTemplateKey;
  /** Null when the organization has no open subscription. */
  subscriptionStatus: SubscriptionStatus | null;
  memberCount: number;
  createdAt: string;
}

export interface PlatformSubscriptionResponse {
  platformSubscriptionId: string;
  status: SubscriptionStatus;
  basePackageId: string;
  basePackageKey: string;
  addOnPackageIds: string[];
  addOnPackageKeys: string[];
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  version: number;
}

export interface PlatformModuleOverrideResponse {
  moduleOverrideId: string;
  moduleKey: ModuleKey;
  effect: ModuleOverrideEffect;
  reason: string;
  expiresAt: string | null;
  createdAt: string;
}

/** `GET /platform/organizations/{organizationId}`. The owner identifier is masked. */
export interface PlatformOrganizationDetail extends PlatformOrganizationSummary {
  version: number;
  locationCount: number;
  owner: { displayName: string; maskedIdentifier: string };
  subscription: PlatformSubscriptionResponse | null;
  moduleOverrides: PlatformModuleOverrideResponse[];
}

export interface PlatformReasonRequest {
  reason: string;
}

export interface PlatformPackageResponse {
  packageId: string;
  packageKey: string;
  nameKey: string;
  isAddOn: boolean;
  moduleKeys: ModuleKey[];
  limits: LimitMap;
  limitIncrements: Partial<Record<LimitKey, number>>;
  status: PackageStatus;
  version: number;
  /** Module keys of the package that have no registered manifest yet; the closure rule skips them. */
  unbuiltModuleKeys: ModuleKey[];
}

export interface PlatformPackageCreateRequest {
  packageKey: string;
  isAddOn: boolean;
  moduleKeys: ModuleKey[];
  limits: LimitMap;
  limitIncrements?: Partial<Record<LimitKey, number>>;
}

export interface PlatformPackageUpdateRequest {
  version: number;
  moduleKeys?: ModuleKey[];
  limits?: LimitMap;
  limitIncrements?: Partial<Record<LimitKey, number>>;
}

export interface PlatformModuleOverrideCreateRequest {
  moduleKey: ModuleKey;
  effect: Extract<ModuleOverrideEffect, "PLATFORM_GRANT" | "PLATFORM_REVOKE">;
  reason: string;
  expiresAt?: string;
}

export interface PlatformExtendTrialRequest {
  days: number;
  reason: string;
}

export interface PlatformChangePackageRequest {
  basePackageId: string;
  addOnPackageIds: string[];
}

/** Answer of the suspend and reactivate endpoints. */
export interface PlatformOrganizationStatusResponse {
  organizationId: string;
  status: OrganizationStatus;
  version: number;
}
