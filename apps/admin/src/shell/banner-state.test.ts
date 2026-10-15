import {
  ACCESS_MODE,
  SUBSCRIPTION_STATUS,
  type ResolvedOrgConfigResponse,
} from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { bannerStatesOf } from "./banner-state";

const NOW = new Date("2026-10-10T10:00:00Z");

function config(overrides: Partial<ResolvedOrgConfigResponse>): ResolvedOrgConfigResponse {
  return {
    organizationId: "o",
    configVersion: 1,
    registryHash: "h",
    accessMode: ACCESS_MODE.FULL,
    isPastDue: false,
    subscription: null,
    modules: [],
    kinds: [],
    limits: {} as ResolvedOrgConfigResponse["limits"],
    menu: [],
    terms: {},
    settings: {},
    fields: {},
    permissions: { allLocations: [], byLocation: {} },
    permissionDefinitions: [],
    ...overrides,
  };
}

function trial(trialEndsAt: string): Partial<ResolvedOrgConfigResponse> {
  return {
    subscription: { status: SUBSCRIPTION_STATUS.TRIALING, trialEndsAt, isPastDue: false },
  };
}

describe("bannerStatesOf", () => {
  it("shows the trial banner with the days left inside the last 7 days", () => {
    expect(bannerStatesOf(config(trial("2026-10-13T10:00:00Z")), NOW, "Asia/Dhaka")).toEqual([
      { kind: "trial", daysLeft: 3 },
    ]);
  });

  it("shows nothing earlier than 7 days before the trial ends", () => {
    expect(bannerStatesOf(config(trial("2026-10-20T10:00:00Z")), NOW, "Asia/Dhaka")).toEqual([]);
  });

  it("counts days in the business's time zone, not in UTC", () => {
    // 19:00 UTC on the 10th is already the 11th in Dhaka, so the trial ends "today" there.
    const states = bannerStatesOf(config(trial("2026-10-10T19:00:00Z")), NOW, "Asia/Dhaka");
    expect(states).toEqual([{ kind: "trial", daysLeft: 1 }]);
  });

  it("warns while past due inside the grace period", () => {
    expect(bannerStatesOf(config({ isPastDue: true }), NOW, "UTC")).toEqual([{ kind: "pastDue" }]);
  });

  it("shows the persistent read-only banner and nothing else", () => {
    const states = bannerStatesOf(
      config({ accessMode: ACCESS_MODE.READ_ONLY, isPastDue: true }),
      NOW,
      "UTC",
    );
    expect(states).toEqual([{ kind: "readOnly" }]);
  });
});
