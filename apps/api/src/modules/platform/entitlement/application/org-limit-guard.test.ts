import { LIMIT_KEY, type LimitMap } from "@banijjik/contracts";
import { describe, expect, it } from "vitest";
import { OrgLimitGuard } from "./org-limit-guard.js";

function guardWith(overrides: Partial<Record<keyof LimitMap, number | null>>): OrgLimitGuard {
  const limits = {
    locations: 2,
    members: null,
    offerings: 0,
    ordersPerMonth: 0,
    aiMessagesPerMonth: 0,
    smsPerMonth: 0,
    channels: 0,
    posDevices: 0,
    ...overrides,
  } satisfies LimitMap;
  return new OrgLimitGuard({ current: async () => ({ config: { limits } }) });
}

describe("OrgLimitGuard", () => {
  it("allows a count below the limit", async () => {
    await expect(guardWith({}).assertBelow(LIMIT_KEY.LOCATIONS, 1)).resolves.toBeUndefined();
  });

  it("refuses a count that has reached the limit with the key and the limit in the details", async () => {
    await expect(guardWith({}).assertBelow(LIMIT_KEY.LOCATIONS, 2)).rejects.toMatchObject({
      code: "LIMIT_REACHED",
      details: { limitKey: "locations", limit: 2 },
    });
  });

  it("never refuses an unlimited key", async () => {
    await expect(guardWith({}).assertBelow(LIMIT_KEY.MEMBERS, 1_000_000)).resolves.toBeUndefined();
  });

  it("refuses everything when the limit is zero", async () => {
    await expect(
      guardWith({ offerings: 0 }).assertBelow(LIMIT_KEY.OFFERINGS, 0),
    ).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });
});
