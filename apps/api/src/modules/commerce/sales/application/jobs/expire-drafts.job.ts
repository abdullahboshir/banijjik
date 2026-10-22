import { MODULE_KEY } from "@banijjik/contracts";
import { asId, type OrganizationId } from "@banijjik/ids";
import type { ScheduledJob } from "../../../../../kernel/jobs/index.js";
import type { SalesDependencies } from "../sales-dependencies.js";
import { DeleteDraftUseCase } from "../use-cases/delete-draft.use-case.js";

/** One hourly pass reads at most this many candidates; the rest wait for the next pass. */
const JOB_PAGE_LIMIT = 100;

/** Hourly: DRAFTs older than `sales.draftExpiryHours` are discarded (plan decision 4). */
export function buildExpireDraftsJob(dependencies: SalesDependencies): ScheduledJob {
  const deleteDraft = new DeleteDraftUseCase(dependencies);
  return {
    jobKey: "sales.expireDrafts",
    everyMinutes: 60,
    moduleKey: MODULE_KEY.SALES,
    run: async (organizationId, now) => {
      const branded = asId<OrganizationId>(organizationId);
      const settings = await dependencies.settings.read(branded);
      const cutoff = new Date(now.getTime() - settings.draftExpiryHours * 60 * 60 * 1000);
      const drafts = await dependencies.orders.findDraftsCreatedBefore(cutoff, JOB_PAGE_LIMIT);
      for (const draft of drafts) {
        await deleteDraft.execute({
          orderId: draft.orderId,
          version: draft.version,
          allowedLocationIds: "ALL",
        });
      }
    },
  };
}
