import {
  ORGANIZATION_STATUS,
  PLATFORM_PERMISSION_KEY,
  SUBSCRIPTION_STATUS,
  type ModuleKey,
  type PlatformOrganizationDetail,
} from "@banijjik/contracts";
import { holdsPermission } from "../auth/permissions";
import type { Labels } from "../lib/labels";

export type TenantActionKind =
  "suspend" | "reactivate" | "extendTrial" | "changePackage" | "grantModule" | "revokeModule";

/** Text of the tenant action buttons and sheets; the tenant name is filled into the titles on the server. */
export const TENANT_ACTION_LABEL_KEYS = [
  "platform.action.suspend",
  "platform.action.reactivate",
  "platform.action.extendTrial",
  "platform.action.changePackage",
  "platform.action.grantModule",
  "platform.action.revokeModule",
  "platform.sheet.suspend.title",
  "platform.sheet.suspend.description",
  "platform.sheet.reactivate.title",
  "platform.sheet.reactivate.description",
  "platform.sheet.suspend.success",
  "platform.sheet.reactivate.success",
  "platform.sheet.extendTrial.title",
  "platform.sheet.extendTrial.success",
  "platform.sheet.changePackage.title",
  "platform.sheet.changePackage.success",
  "platform.sheet.grantModule.title",
  "platform.sheet.grantModule.success",
  "platform.sheet.revokeModule.title",
  "platform.sheet.revokeModule.success",
  "platform.field.reason",
  "platform.field.reasonHint",
  "platform.field.days",
  "platform.field.basePackage",
  "platform.field.addOns",
  "platform.field.module",
  "platform.field.chooseModule",
  "platform.field.expiresAt",
  "platform.field.expiresAtHint",
] as const;

export type TenantActionLabels = Labels<(typeof TENANT_ACTION_LABEL_KEYS)[number]>;

export interface PackageOption {
  packageId: string;
  label: string;
}

export interface ModuleOption {
  moduleKey: ModuleKey;
  label: string;
}

/** Everything the lazily loaded sheets need; plain data, so it can travel from the server page. */
export interface TenantActionContext {
  organizationId: string;
  currentBasePackageId: string | undefined;
  currentAddOnPackageIds: string[];
  basePackages: PackageOption[];
  addOnPackages: PackageOption[];
  modules: ModuleOption[];
  labels: TenantActionLabels;
}

/**
 * The actions this operator may start now: permission first, then the state of the tenant (13-UX section 4.2:
 * actions come from state and permission, and unavailable ones are hidden). The API checks both again.
 */
export function availableTenantActions(
  operator: Parameters<typeof holdsPermission>[0],
  tenant: Pick<PlatformOrganizationDetail, "status" | "subscription">,
): TenantActionKind[] {
  const actions: TenantActionKind[] = [];
  const canSuspend = holdsPermission(operator, PLATFORM_PERMISSION_KEY.TENANT_SUSPEND);
  if (canSuspend && tenant.status === ORGANIZATION_STATUS.ACTIVE) actions.push("suspend");
  if (canSuspend && tenant.status === ORGANIZATION_STATUS.SUSPENDED) actions.push("reactivate");
  if (
    holdsPermission(operator, PLATFORM_PERMISSION_KEY.SUBSCRIPTION_WRITE) &&
    tenant.subscription
  ) {
    if (tenant.subscription.status === SUBSCRIPTION_STATUS.TRIALING) actions.push("extendTrial");
    actions.push("changePackage");
  }
  if (holdsPermission(operator, PLATFORM_PERMISSION_KEY.ENTITLEMENT_WRITE)) {
    actions.push("grantModule", "revokeModule");
  }
  return actions;
}
