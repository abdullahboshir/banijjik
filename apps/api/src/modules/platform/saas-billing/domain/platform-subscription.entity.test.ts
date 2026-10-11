import { SUBSCRIPTION_STATUS, TRIAL_DAYS } from "@banijjik/contracts";
import { newId, type OrganizationId, type PackageId } from "@banijjik/ids";
import { describe, expect, it } from "vitest";
import { PlatformSubscription } from "./platform-subscription.entity.js";

const NOW = new Date("2026-10-11T08:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function trial(): PlatformSubscription {
  return PlatformSubscription.startTrial({
    organizationId: newId<OrganizationId>(),
    basePackageId: newId<PackageId>(),
    now: NOW,
  });
}

describe("PlatformSubscription.withTrialExtended", () => {
  it("adds the days to the current end of the trial", () => {
    const extended = trial().withTrialExtended(7, NOW);

    expect(extended.trialEndsAt?.getTime()).toBe(NOW.getTime() + (TRIAL_DAYS + 7) * DAY_MS);
  });

  it("counts from now when the trial already ended", () => {
    const later = new Date(NOW.getTime() + 40 * DAY_MS);

    expect(trial().withTrialExtended(5, later).trialEndsAt?.getTime()).toBe(
      later.getTime() + 5 * DAY_MS,
    );
  });

  it("refuses a subscription that is not trialing", () => {
    const active = PlatformSubscription.restore({
      ...trial(),
      status: SUBSCRIPTION_STATUS.ACTIVE,
    });

    expect(() => active.withTrialExtended(5, NOW)).toThrowError(
      expect.objectContaining({ details: { ruleKey: "TRIAL_NOT_ACTIVE" } }),
    );
  });
});

describe("PlatformSubscription.withPackages", () => {
  it("replaces the packages and keeps the status and the dates", () => {
    const original = trial();
    const base = newId<PackageId>();
    const addOn = newId<PackageId>();

    const changed = original.withPackages(base, [addOn]);

    expect(changed.basePackageId).toBe(base);
    expect(changed.addOnPackageIds).toEqual([addOn]);
    expect(changed.status).toBe(original.status);
    expect(changed.trialEndsAt).toEqual(original.trialEndsAt);
  });
});
