import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { CREDIT_ENTRY_TYPE, CREDIT_SOURCE_TYPE } from "@banijjik/contracts/credit";
import { newId } from "@banijjik/ids";
import { getRequestContext } from "../../../../kernel/context/index.js";

export interface AdjustCreditsInput {
  readonly customerAccountId: string;
  readonly credits: number;
  readonly reason: string;
  readonly actorUserId: string | null;
}

export class AdjustCreditsUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(input: AdjustCreditsInput): Promise<{ balance: number }> {
    return this.deps.unitOfWork.withTransaction(async () => {
      const balance = await this.deps.credit.getBalance(input.customerAccountId);
      if (!balance) {
        await this.deps.credit.insertBalance({
          customerAccountId: input.customerAccountId,
          balance: 0,
          version: 1,
          updatedAt: this.deps.clock.now(),
        });
      }

      const creditEntryId = newId();
      const today = new Date().toISOString().split("T")[0];
      const entry = {
        creditEntryId,
        customerAccountId: input.customerAccountId,
        type: CREDIT_ENTRY_TYPE.ADJUST,
        credits: input.credits,
        expiresOn: null,
        source: { sourceType: CREDIT_SOURCE_TYPE.ADJUSTMENT, sourceId: creditEntryId },
        fromPurchaseEntryId: null,
        reason: input.reason,
        createdByUserId: input.actorUserId,
        occurredAt: this.deps.clock.now(),
        businessDate: today,
        createdAt: this.deps.clock.now(),
      };

      await this.deps.credit.insertEntry(entry);

      const updatedBalance = await this.deps.credit.updateBalance({
        customerAccountId: input.customerAccountId,
        expectedVersion: balance?.version ?? 1,
        delta: input.credits,
      });

      await this.deps.audit.record({
        organizationId: getRequestContext().organizationId,
        action: "CREDIT_ADJUST",
        entityType: "CreditBalance",
        entityId: input.customerAccountId,
        changes: {
          before: { balance: balance?.balance ?? 0 },
          after: { balance: updatedBalance.balance },
        },
        actorUserId: input.actorUserId,
      });

      await this.deps.events.publish(
        "CREDIT_ENTRY_CREATED",
        {
          creditEntryId,
          customerAccountId: input.customerAccountId,
          type: CREDIT_ENTRY_TYPE.ADJUST,
          credits: input.credits,
          source: entry.source,
          occurredAt: entry.occurredAt.toISOString(),
        },
        { orderingKey: `creditAccount:${input.customerAccountId}` },
      );

      return { balance: updatedBalance.balance };
    });
  }
}
