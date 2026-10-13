import { PLATFORM_AUDIT_ACTION, SYSTEM_REASON } from "@banijjik/contracts";
import { type UserId } from "@banijjik/ids";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import { SubscriptionSupport } from "./subscription-support.js";
import type { SubscriptionDetail } from "./subscription-detail.js";

export interface ExtendTrialInput {
  readonly actorUserId: UserId;
  readonly organizationId: string;
  readonly days: number;
  readonly reason: string;
}

/** Extends the trial of an organization that is still in its trial. */
export class ExtendTrialUseCase extends SubscriptionSupport {
  execute(input: ExtendTrialInput): Promise<SubscriptionDetail> {
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const before = await this.requireOpen(input.organizationId);
      const extended = before.withTrialExtended(input.days, this.dependencies.clock.now());
      const saved = await this.save({
        updated: extended,
        before,
        actorUserId: input.actorUserId,
        audit: {
          action: PLATFORM_AUDIT_ACTION.SUBSCRIPTION_TRIAL_EXTENDED,
          changes: {
            trialEndsAt: {
              ...(before.trialEndsAt === null ? {} : { from: before.trialEndsAt.toISOString() }),
              ...(extended.trialEndsAt === null ? {} : { to: extended.trialEndsAt.toISOString() }),
            },
          },
          reason: input.reason,
        },
      });
      return this.detailOf(saved);
    });
  }
}
