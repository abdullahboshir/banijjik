import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  CREDIT_EVENT_TYPE,
  CREDIT_PURCHASE_STATUS,
  type CreditPurchaseResponse,
} from "@banijjik/contracts/credit";
import type { CreditPurchaseId, UserId } from "@banijjik/ids";
import { CreditPurchaseNotFoundError, CreditPurchaseNotPendingError } from "../../domain/errors.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { assertNotSelfService } from "./assert-not-self-service.js";
import { viewCreditPurchase } from "./credit-purchase-view.js";

export interface RejectCreditPurchaseInput {
  readonly creditPurchaseId: CreditPurchaseId;
  readonly version: number;
  readonly reason: string;
  readonly actorUserId: UserId;
}

export class RejectCreditPurchaseUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(input: RejectCreditPurchaseInput): Promise<CreditPurchaseResponse> {
    const purchase = await this.deps.purchases.findById(input.creditPurchaseId);
    if (!purchase) {
      throw new CreditPurchaseNotFoundError();
    }
    if (purchase.status !== CREDIT_PURCHASE_STATUS.PENDING) {
      throw new CreditPurchaseNotPendingError();
    }

    // Self-service guard
    await assertNotSelfService(this.deps, input.actorUserId, purchase.customerAccountId);

    return this.deps.unitOfWork.run(async () => {
      const current = await this.deps.purchases.findById(input.creditPurchaseId);
      if (!current) {
        throw new CreditPurchaseNotFoundError();
      }
      if (current.status !== CREDIT_PURCHASE_STATUS.PENDING || current.version !== input.version) {
        throw new CreditPurchaseNotPendingError();
      }

      const now = this.deps.clock.now();
      const rejected = current.reject({
        verifiedByUserId: input.actorUserId,
        verifiedAt: now,
        rejectionReason: input.reason,
      });

      const updated = await this.deps.purchases.updateVersioned(rejected);
      if (!updated) {
        throw new CreditPurchaseNotPendingError();
      }

      await this.deps.audit.record({
        action: AUDIT_ACTION.CREDIT_PURCHASE_REJECTED,
        entityType: AUDIT_ENTITY_TYPE.creditPurchase,
        entityId: rejected.creditPurchaseId,
        changes: {
          status: { from: current.status, to: rejected.status },
          rejectionReason: { to: input.reason },
          verifiedByUserId: { to: input.actorUserId },
        },
      });

      await this.deps.events.publish(
        CREDIT_EVENT_TYPE.PURCHASE_REJECTED,
        { creditPurchaseId: rejected.creditPurchaseId },
        { orderingKey: `creditAccount:${rejected.customerAccountId}` },
      );

      return viewCreditPurchase(rejected);
    });
  }
}
