import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import { CREDIT_EVENT_TYPE, type CreditPurchaseResponse } from "@banijjik/contracts/credit";
import type { CreditPurchaseId, CustomerAccountId } from "@banijjik/ids";
import { CreditPurchaseNotFoundError, CreditPurchaseNotPendingError } from "../../domain/errors.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { viewCreditPurchase } from "./credit-purchase-view.js";

export class CancelCreditPurchaseUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(input: {
    readonly creditPurchaseId: CreditPurchaseId;
    readonly customerAccountId: CustomerAccountId;
  }): Promise<CreditPurchaseResponse> {
    const purchase = await this.deps.purchases.findById(input.creditPurchaseId);
    if (!purchase || purchase.customerAccountId !== input.customerAccountId) {
      throw new CreditPurchaseNotFoundError();
    }
    if (!purchase.isPending()) {
      throw new CreditPurchaseNotPendingError();
    }

    return this.deps.unitOfWork.run(async () => {
      const now = this.deps.clock.now();
      const cancelled = purchase.cancel(now);

      await this.deps.purchases.updateVersioned(cancelled, null);

      await this.deps.audit.record({
        action: AUDIT_ACTION.CREDIT_PURCHASE_CANCELLED,
        entityType: AUDIT_ENTITY_TYPE.creditPurchase,
        entityId: cancelled.creditPurchaseId,
        changes: {
          status: { from: purchase.status, to: cancelled.status },
        },
      });

      await this.deps.events.publish(
        CREDIT_EVENT_TYPE.PURCHASE_CANCELLED,
        { creditPurchaseId: cancelled.creditPurchaseId },
        { orderingKey: `creditAccount:${cancelled.customerAccountId}` },
      );

      return viewCreditPurchase(cancelled);
    });
  }
}
