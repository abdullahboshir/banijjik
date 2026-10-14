import {
  LIMIT_KEY_VALUES,
  MODULE_KEY,
  ORGANIZATION_STATUS,
  PLATFORM_ROLE,
  PLATFORM_ROLE_PERMISSIONS,
  SEED_INDUSTRY_TEMPLATE_KEY,
  SUBSCRIPTION_STATUS,
  type LimitMap,
  type PlatformMeResponse,
  type PlatformOrganizationDetail,
  type PlatformPackageResponse,
  type PlatformRole,
} from "@banijjik/contracts";

const OPERATOR_ID = "01900000-0000-7000-8000-000000000001";
const ORGANIZATION_ID = "01900000-0000-7000-8000-0000000000a1";
const PACKAGE_ID = "01900000-0000-7000-8000-0000000000b1";

/** What `GET /platform/me` answers for an operator holding the given role; permissions are the role's, as sent. */
export function operatorWithRole(role: PlatformRole): PlatformMeResponse {
  return {
    userId: OPERATOR_ID,
    platformOperatorId: OPERATOR_ID,
    name: "Operator",
    platformRoles: [role],
    permissions: [...PLATFORM_ROLE_PERMISSIONS[role]],
  };
}

export const SUPER_ADMIN = operatorWithRole(PLATFORM_ROLE.SUPER_ADMIN);
export const SUPPORT = operatorWithRole(PLATFORM_ROLE.SUPPORT);
export const BILLING = operatorWithRole(PLATFORM_ROLE.BILLING);

export function tenantDetail(
  overrides: Partial<PlatformOrganizationDetail> = {},
): PlatformOrganizationDetail {
  return {
    organizationId: ORGANIZATION_ID,
    slug: "acme",
    name: "Acme",
    status: ORGANIZATION_STATUS.ACTIVE,
    templateKey: SEED_INDUSTRY_TEMPLATE_KEY.RETAIL,
    subscriptionStatus: SUBSCRIPTION_STATUS.TRIALING,
    memberCount: 2,
    createdAt: "2026-10-01T00:00:00.000Z",
    version: 1,
    locationCount: 1,
    owner: { displayName: "Owner", maskedIdentifier: "o***@example.com" },
    subscription: {
      platformSubscriptionId: "01900000-0000-7000-8000-0000000000c1",
      status: SUBSCRIPTION_STATUS.TRIALING,
      basePackageId: PACKAGE_ID,
      basePackageKey: "SHOP",
      addOnPackageIds: [],
      addOnPackageKeys: [],
      trialEndsAt: "2026-11-01T00:00:00.000Z",
      currentPeriodEnd: null,
      version: 1,
    },
    moduleOverrides: [],
    ...overrides,
  };
}

function allLimits(value: number | null): LimitMap {
  // Safe: the object is built from the full list of limit keys, so every key is present.
  return Object.fromEntries(LIMIT_KEY_VALUES.map((limitKey) => [limitKey, value])) as LimitMap;
}

export function packageResponse(
  overrides: Partial<PlatformPackageResponse> = {},
): PlatformPackageResponse {
  return {
    packageId: PACKAGE_ID,
    packageKey: "CUSTOM",
    nameKey: null,
    name: "Custom",
    isAddOn: false,
    moduleKeys: [MODULE_KEY.POS],
    limits: allLimits(5),
    limitIncrements: {},
    status: "ACTIVE",
    version: 1,
    unbuiltModuleKeys: [],
    ...overrides,
  };
}
