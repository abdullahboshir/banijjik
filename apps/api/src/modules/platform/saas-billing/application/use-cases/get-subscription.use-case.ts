import { SYSTEM_REASON, type SubscriptionStatus } from "@banijjik/contracts";
import { runAsSystem } from "../../../../../kernel/context/index.js";
import { subscriptionNotFound } from "../../domain/errors.js";
import { SubscriptionSupport } from "./subscription-support.js";
import type { SubscriptionDetail } from "./subscription-detail.js";

export class GetSubscriptionUseCase extends SubscriptionSupport {
  async execute(input: { readonly organizationId: string }): Promise<SubscriptionDetail> {
    const found = await this.find(input);
    if (found === undefined) throw subscriptionNotFound();
    return found;
  }

  /** The open subscription of the organization, or undefined; used by the tenant detail. */
  find(input: { readonly organizationId: string }): Promise<SubscriptionDetail | undefined> {
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, async () => {
      const found = await this.dependencies.subscriptions.findOpenByOrganization(
        input.organizationId,
      );
      return found === undefined ? undefined : this.detailOf(found);
    });
  }

  /** The status of the open subscription per organization, for the tenant list (one query). */
  findStatuses(
    organizationIds: readonly string[],
  ): Promise<ReadonlyMap<string, SubscriptionStatus>> {
    return runAsSystem(SYSTEM_REASON.PLATFORM_ADMIN, () =>
      this.dependencies.subscriptions.findOpenStatuses(organizationIds),
    );
  }
}
