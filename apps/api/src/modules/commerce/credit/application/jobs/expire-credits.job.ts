import { MODULE_KEY } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import type { ExpireCreditsUseCase } from "../use-cases/expire-credits.use-case.js";

export function buildExpireCreditsJob(input: {
  readonly expireCredits: ExpireCreditsUseCase;
}): ScheduledJob {
  return {
    jobKey: "credit.expireCredits",
    everyMinutes: 60,
    moduleKey: MODULE_KEY.CREDIT,
    run: async (organizationId) => {
      await input.expireCredits.execute({ organizationId: asId<OrganizationId>(organizationId) });
    },
  };
}
