import { MODULE_KEY } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import type { SalesJobDependencies } from "../sales-dependencies.js";
import { CancelOrderUseCase } from "../use-cases/transition-order.use-cases.js";

/** One hourly pass reads at most this many candidates; the rest wait for the next pass. */
const JOB_PAGE_LIMIT = 100;

/** The stored reason of an automatic cancel; the plan's text, shown in the order history. */
const AUTO_CANCEL_REASON = "Auto-cancelled: not confirmed within the placed-order window";

/**
 * Hourly: PLACED orders older than `sales.placedAutoCancelHours` are cancelled and their stock
 * released (decision 5). `0` means the rule is off, so the job returns without reading.
 */
export function buildAutoCancelPlacedJob(dependencies: SalesJobDependencies): ScheduledJob {
  const cancelOrder = new CancelOrderUseCase(dependencies);
  return {
    jobKey: "sales.autoCancelPlaced",
    everyMinutes: 60,
    moduleKey: MODULE_KEY.SALES,
    run: async (organizationId, now) => {
      const branded = asId<OrganizationId>(organizationId);
      const settings = await dependencies.settings.read(branded);
      if (settings.placedAutoCancelHours <= 0) return;
      const cutoff = new Date(now.getTime() - settings.placedAutoCancelHours * 60 * 60 * 1000);
      const candidates = await dependencies.orders.findPlacedCreatedBefore(cutoff, JOB_PAGE_LIMIT);
      for (const order of candidates) {
        await cancelOrder.execute({
          organizationId: branded,
          actorUserId: null,
          allowedLocationIds: "ALL",
          orderId: order.orderId,
          body: { version: order.version },
          reason: AUTO_CANCEL_REASON,
        });
      }
    },
  };
}
