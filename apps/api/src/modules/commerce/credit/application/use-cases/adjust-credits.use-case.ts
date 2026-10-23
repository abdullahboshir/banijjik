import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  CREDIT_ENTRY_TYPE,
  CREDIT_EVENT_TYPE,
  CREDIT_SOURCE_TYPE,
} from "@banijjik/contracts/credit";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import { newId, type CustomerAccountId, type UserId } from "@banijjik/ids";
import { activeOrganizationId } from "./active-organization.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import {
  CreditAccountNotFoundError,
  CreditAdjustmentWouldGoNegativeError,
} from "../../domain/index.js";
import { businessDateOf } from "./business-date.js";

export interface AdjustCreditsInput {
  readonly customerAccountId: CustomerAccountId;
  readonly credits: number;
  readonly reason: string;
  readonly actorUserId: UserId | null;
  readonly isOwner: boolean;
  readonly approvalToken?: string;
}

export interface AdjustCreditsOutput {
  readonly balance: number;
}

export class AdjustCreditsUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(input: AdjustCreditsInput): Promise<AdjustCreditsOutput> {
    if (!(await this.deps.accounts.exists(input.customerAccountId))) {
      throw new CreditAccountNotFoundError();
    }
    if (!input.isOwner && input.approvalToken === undefined) {
      throw new DomainRuleError({
        code: ERROR_CODE.APPROVAL_REQUIRED,
        messageKey: "errors.approval_required",
        details: { action: APPROVAL_ACTION.CREDIT_ADJUSTMENT },
      });
    }

    const timeZone = await this.organizationTimeZone();
    return this.deps.unitOfWork.run(async () => {
      // Consumed in the same transaction as the adjustment: a spent token never outlives a failed write.
      if (!input.isOwner && input.approvalToken !== undefined) {
        await this.deps.approvals.consume(input.approvalToken, {
          action: APPROVAL_ACTION.CREDIT_ADJUSTMENT,
          subjectKey: input.customerAccountId,
        });
      }
      const updatedBalance = await this.deps.credit.applyDelta({
        customerAccountId: input.customerAccountId,
        delta: input.credits,
      });
      if (!updatedBalance) {
        const balance = await this.deps.credit.getBalance(input.customerAccountId);
        throw new CreditAdjustmentWouldGoNegativeError(
          balance?.balance ?? 0,
          Math.abs(input.credits),
        );
      }

      const entry = this.buildEntry(input, timeZone);
      await this.deps.credit.insertEntry(entry);
      await this.recordAudit(input, entry.creditEntryId);
      await this.publish(entry);

      return { balance: updatedBalance.balance };
    });
  }

  /** The entry is dated in the acting organization's day, never UTC (3.25 decision 4). */
  private async organizationTimeZone(): Promise<string> {
    return this.deps.timeZone.read(activeOrganizationId());
  }

  private buildEntry(input: AdjustCreditsInput, timeZone: string) {
    const now = this.deps.clock.now();
    const creditEntryId = newId();
    return {
      creditEntryId,
      customerAccountId: input.customerAccountId,
      type: CREDIT_ENTRY_TYPE.ADJUST,
      credits: input.credits,
      expiresOn: null,
      source: { sourceType: CREDIT_SOURCE_TYPE.ADJUSTMENT, sourceId: creditEntryId },
      fromPurchaseEntryId: null,
      reason: input.reason,
      createdByUserId: input.actorUserId,
      occurredAt: now.toISOString(),
      businessDate: businessDateOf(now, timeZone),
      createdAt: now.toISOString(),
    };
  }

  private async recordAudit(input: AdjustCreditsInput, creditEntryId: string): Promise<void> {
    await this.deps.audit.record({
      action: AUDIT_ACTION.CREDIT_ACCOUNT_ADJUSTED,
      entityType: AUDIT_ENTITY_TYPE.creditAccount,
      entityId: input.customerAccountId,
      changes: {
        credits: { to: input.credits },
        reason: { to: input.reason },
        creditEntryId: { to: creditEntryId },
      },
    });
  }

  private async publish(entry: ReturnType<AdjustCreditsUseCase["buildEntry"]>): Promise<void> {
    await this.deps.events.publish(
      CREDIT_EVENT_TYPE.CREDIT_ENTRY_CREATED,
      {
        creditEntryId: entry.creditEntryId,
        customerAccountId: entry.customerAccountId,
        type: CREDIT_ENTRY_TYPE.ADJUST,
        credits: entry.credits,
        source: entry.source,
        occurredAt: entry.occurredAt,
      },
      { orderingKey: `creditAccount:${entry.customerAccountId}` },
    );
  }
}
