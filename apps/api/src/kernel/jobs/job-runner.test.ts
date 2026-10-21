import { MODULE_KEY } from "@banijjik/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runScheduledJob } from "./job-runner.js";
const state = vi.hoisted(() => ({ errors: vi.fn(), runInOrganization: vi.fn() }));
vi.mock("./organization-targets.js", () => ({
  listActiveOrganizationIds: async () => ["first", "second", "third"],
}));
vi.mock("../logger/index.js", () => ({ getLogger: () => ({ error: state.errors }) }));
vi.mock("../context/index.js", () => ({
  runAsSystem: async (_reason: unknown, work: () => Promise<unknown>) => work(),
  runWithRequestContext: async (_context: unknown, work: () => Promise<unknown>) => work(),
}));
vi.mock("../tenancy/index.js", () => ({
  runInOrganizationContext: async (organizationId: string, work: () => Promise<unknown>) => {
    state.runInOrganization(organizationId);
    return work();
  },
}));
beforeEach(() => vi.clearAllMocks());
describe("scheduled job organization isolation", () => {
  it("skips disabled modules and continues after a different organization fails", async () => {
    const run = vi.fn(async (organizationId: string) => {
      if (organizationId === "first") throw new Error("organization failure");
    });
    const isEffective = vi.fn(async (organizationId: string) => organizationId !== "second");
    const now = new Date("2026-10-21T00:00:00Z");
    await runScheduledJob(
      { jobKey: "booking.expireHolds", everyMinutes: 1, moduleKey: MODULE_KEY.BOOKING, run },
      { effectiveness: { isEffective }, clock: { now: () => now } },
    );
    expect(run.mock.calls).toEqual([
      ["first", now],
      ["third", now],
    ]);
    expect(state.runInOrganization.mock.calls).toEqual([["first"], ["third"]]);
    expect(state.errors).toHaveBeenCalledTimes(1);
    expect(isEffective).toHaveBeenCalledTimes(3);
  });
});
