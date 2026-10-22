import { MODULE_KEY } from "@banijjik/contracts";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import type { CancelExpiredPurchasesUseCase } from "../use-cases/cancel-expired-purchases.use-case.js";

export function buildCancelExpiredPurchasesJob(input: {
  readonly cancelExpiredPurchases: CancelExpiredPurchasesUseCase;
}): ScheduledJob {
  return {
    jobKey: "credit.cancelExpiredPurchases",
    everyMinutes: 60,
    moduleKey: MODULE_KEY.CREDIT,
    run: async (_organizationId, now) => {
      await input.cancelExpiredPurchases.execute(now);
    },
  };
}
