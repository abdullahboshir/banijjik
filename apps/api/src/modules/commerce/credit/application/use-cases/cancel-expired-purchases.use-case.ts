import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, ERROR_CODE } from "@banijjik/contracts";
import { CREDIT_EVENT_TYPE } from "@banijjik/contracts/credit";
import type { CreditPurchase } from "../../domain/credit-purchase.entity.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";

/** Matches the kernel's 409 and the domain conflict alike, without importing the transport layer. */
function isConflictError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === ERROR_CODE.CONFLICT
  );
}

/** The job runs outside a request, so it gets only what it needs, not the whole credit wiring. */
export type CancelExpiredPurchasesDependencies = Pick<
  CreditDependencies,
  "purchases" | "unitOfWork" | "audit" | "events"
>;

export class CancelExpiredPurchasesUseCase {
  constructor(private readonly deps: CancelExpiredPurchasesDependencies) {}

  async execute(now: Date): Promise<number> {
    const expired = await this.deps.purchases.listExpiredPending(now);
    let cancelledCount = 0;

    for (const purchase of expired) {
      try {
        const cancelled = await this.deps.unitOfWork.run(() =>
          this.cancelIfStillExpired(purchase, now),
        );
        if (cancelled) cancelledCount++;
      } catch (error) {
        // Staff verified or rejected this purchase between the list and the update: leave it alone.
        if (!isConflictError(error)) throw error;
      }
    }

    return cancelledCount;
  }

  private async cancelIfStillExpired(listed: CreditPurchase, now: Date): Promise<boolean> {
    const current = await this.deps.purchases.findById(listed.creditPurchaseId);
    if (!current || !current.isPending() || current.expiresAt.getTime() > now.getTime()) {
      return false;
    }

    const cancelled = current.cancel(now);
    await this.deps.purchases.updateVersioned(cancelled, null);

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
    return true;
  }
}
