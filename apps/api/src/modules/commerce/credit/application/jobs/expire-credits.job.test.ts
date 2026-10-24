import { MODULE_KEY } from "@banijjik/contracts";
import { asId, newId, type OrganizationId } from "@banijjik/ids";
import { describe, expect, it, vi } from "vitest";
import { jobRegistry } from "../../../../../kernel/jobs/index.js";
import { registerCreditScheduledJobs } from "../../index.js";
import type { ExpireCreditsUseCase } from "../use-cases/expire-credits.use-case.js";
import { buildExpireCreditsJob } from "./expire-credits.job.js";

describe("credit.expireCredits job", () => {
  it("registers credit.expireCredits for the credit module", () => {
    registerCreditScheduledJobs({
      clock: { now: () => new Date("2026-10-21T08:00:00.000Z") },
      audit: { record: vi.fn(async () => undefined) },
    });

    const job = jobRegistry.find("credit.expireCredits");

    expect(job).toMatchObject({ everyMinutes: 60, moduleKey: MODULE_KEY.CREDIT });
  });

  it("expires credits for the organization it is run for", async () => {
    const execute = vi.fn(async () => ({ expiredEntries: 0, failedEntries: 0 }));
    const job = buildExpireCreditsJob({
      expireCredits: { execute } as unknown as ExpireCreditsUseCase,
    });
    const organizationId = newId();

    await job.run(organizationId, new Date());

    expect(execute).toHaveBeenCalledWith({ organizationId: asId<OrganizationId>(organizationId) });
  });
});
