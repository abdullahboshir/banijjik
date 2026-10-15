import { ORGANIZATION_STATUS, SUBSCRIPTION_STATUS } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { BILLING, SUPER_ADMIN, SUPPORT, tenantDetail } from "../test-support/fixtures";
import { availableTenantActions } from "./tenant-action-labels";

describe("availableTenantActions", () => {
  it("gives a super admin every action on an active trialing tenant, except reactivate", () => {
    expect(availableTenantActions(SUPER_ADMIN, tenantDetail())).toEqual([
      "suspend",
      "extendTrial",
      "changePackage",
      "grantModule",
      "revokeModule",
      "changeIndustry",
    ]);
  });

  it("offers reactivate, not suspend, for a suspended tenant", () => {
    const suspended = tenantDetail({ status: ORGANIZATION_STATUS.SUSPENDED });
    const actions = availableTenantActions(SUPER_ADMIN, suspended);
    expect(actions).toContain("reactivate");
    expect(actions).not.toContain("suspend");
  });

  it("gives support only suspend: it cannot change subscriptions or modules", () => {
    expect(availableTenantActions(SUPPORT, tenantDetail())).toEqual(["suspend"]);
  });

  it("gives billing the subscription and module actions but not suspend", () => {
    expect(availableTenantActions(BILLING, tenantDetail())).toEqual([
      "extendTrial",
      "changePackage",
      "grantModule",
      "revokeModule",
    ]);
  });

  it("offers extend trial only while the subscription is a trial", () => {
    const trialing = tenantDetail();
    const subscription = trialing.subscription && {
      ...trialing.subscription,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    };
    const actions = availableTenantActions(BILLING, {
      ...trialing,
      subscription: subscription ?? null,
    });
    expect(actions).not.toContain("extendTrial");
    expect(actions).toContain("changePackage");
  });

  it("offers no subscription action for a tenant without a subscription", () => {
    const actions = availableTenantActions(BILLING, tenantDetail({ subscription: null }));
    expect(actions).toEqual(["grantModule", "revokeModule"]);
  });
});
