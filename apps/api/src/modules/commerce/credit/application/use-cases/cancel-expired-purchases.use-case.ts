import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { CREDIT_EVENT_TYPE } from "@banijjik/contracts/credit";
import type { CreditDependencies } from "../ports/credit-dependencies.js";

export class CancelExpiredPurchasesUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(now: Date): Promise<number> {
    const expired = await this.deps.purchases.listExpiredPending(now);
    let cancelledCount = 0;

    for (const purchase of expired) {
      await this.deps.unitOfWork.run(async () => {
        const current = await this.deps.purchases.findById(purchase.creditPurchaseId);
        if (!current || !current.isPending() || current.expiresAt.getTime() > now.getTime()) {
          return;
        }

        const cancelled = current.cancel(now);
        const updated = await this.deps.purchases.updateVersioned(cancelled);
        if (!updated) {
          return;
        }

        cancelledCount++;

        await this.deps.audit.record({
          action: AUDIT_ACTION.CREDIT_PURCHASE_CANCELLED,
          entityType: AUDIT_ENTITY_TYPE.creditPurchase,
          entityId: cancelled.creditPurchaseId,
          changes: {
            status: { from: current.status, to: cancelled.status },
            reason: { to: "expired" },
          },
        });

        await this.deps.events.publish(
          CREDIT_EVENT_TYPE.PURCHASE_CANCELLED,
          { creditPurchaseId: cancelled.creditPurchaseId },
          { orderingKey: `creditAccount:${cancelled.customerAccountId}` },
        );
      });
    }

    return cancelledCount;
  }
}
