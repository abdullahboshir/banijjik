import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import {
  CREDIT_ENTRY_TYPE,
  CREDIT_EVENT_TYPE,
  CREDIT_PURCHASE_STATUS,
  CREDIT_RULE_KEY,
  CREDIT_SOURCE_TYPE,
  DEFAULT_PURCHASE_APPROVAL_ABOVE,
  type CreditPurchaseResponse,
} from "@banijjik/contracts/credit";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  asId,
  newId,
  type CreditPurchaseId,
  type OrganizationId,
  type UserId,
} from "@banijjik/ids";
import { getRequestContext } from "../../../../../kernel/context/index.js";
import type { CreditPurchase } from "../../domain/credit-purchase.entity.js";
import {
  CreditPurchaseNotFoundError,
  CreditPurchaseNotPendingError,
  CreditPurchaseVersionConflictError,
} from "../../domain/errors.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { assertNotSelfService } from "./assert-not-self-service.js";
import { businessDateOf } from "./business-date.js";
import { viewCreditPurchase } from "./credit-purchase-view.js";

export interface VerifyCreditPurchaseInput {
  readonly creditPurchaseId: CreditPurchaseId;
  readonly version: number;
  readonly actorUserId: UserId;
  readonly isOwner: boolean;
  readonly approvalToken?: string;
}

export class VerifyCreditPurchaseUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(input: VerifyCreditPurchaseInput): Promise<CreditPurchaseResponse> {
    const organizationId = asId<OrganizationId>(String(getRequestContext().organizationId));
    const purchase = await this.deps.purchases.findById(input.creditPurchaseId);
    if (!purchase) throw new CreditPurchaseNotFoundError();

    if (purchase.status === CREDIT_PURCHASE_STATUS.VERIFIED) {
      return viewCreditPurchase(purchase);
    }
    if (purchase.status !== CREDIT_PURCHASE_STATUS.PENDING) {
      throw new CreditPurchaseNotPendingError();
    }

    await assertNotSelfService(this.deps, input.actorUserId, purchase.customerAccountId);
    const requiresApproval = await this.checkApproval(organizationId, purchase, input);

    return this.deps.unitOfWork.run(async () => {
      const current = await this.deps.purchases.findById(input.creditPurchaseId);
      if (!current) throw new CreditPurchaseNotFoundError();
      if (current.status === CREDIT_PURCHASE_STATUS.VERIFIED) return viewCreditPurchase(current);
      if (current.status !== CREDIT_PURCHASE_STATUS.PENDING)
        throw new CreditPurchaseNotPendingError();
      // A stale version on a still-PENDING purchase is the standard 409, not "not pending".
      if (current.version !== input.version) {
        throw new CreditPurchaseVersionConflictError(current.version);
      }

      if (requiresApproval && input.approvalToken) {
        await this.deps.approvals.consume(input.approvalToken, {
          action: APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY,
          subjectKey: current.creditPurchaseId,
          amount: current.snapshot.price,
        });
      }

      return this.grantAndVerify(current, input);
    });
  }

  private async checkApproval(
    organizationId: OrganizationId,
    purchase: CreditPurchase,
    input: VerifyCreditPurchaseInput,
  ): Promise<boolean> {
    const settings = await this.deps.resolveSettings(organizationId, [
      CREDIT_RULE_KEY.PURCHASE_APPROVAL_ABOVE,
    ]);
    const settingVal = settings.get(CREDIT_RULE_KEY.PURCHASE_APPROVAL_ABOVE)?.value;
    const threshold = this.resolveApprovalThreshold(settingVal);
    const requires = threshold > 0 && purchase.snapshot.price.amount > threshold && !input.isOwner;

    if (requires && !input.approvalToken) {
      throw new DomainRuleError({
        code: ERROR_CODE.APPROVAL_REQUIRED,
        messageKey: "errors.approval_required",
        details: { action: APPROVAL_ACTION.CREDIT_PURCHASE_VERIFY },
      });
    }
    return requires;
  }

  private async grantAndVerify(
    current: CreditPurchase,
    input: VerifyCreditPurchaseInput,
  ): Promise<CreditPurchaseResponse> {
    const now = this.deps.clock.now();
    const creditEntryId = newId();
    const expiresOn = current.snapshot.validityDays
      ? new Date(now.getTime() + current.snapshot.validityDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const creditEntry = {
      creditEntryId,
      customerAccountId: current.customerAccountId,
      type: CREDIT_ENTRY_TYPE.PURCHASE,
      credits: current.snapshot.credits,
      expiresOn,
      source: { sourceType: CREDIT_SOURCE_TYPE.PURCHASE, sourceId: current.creditPurchaseId },
      fromPurchaseEntryId: null,
      reason: `Credit pack purchase ${current.purchaseNumber}`,
      createdByUserId: input.actorUserId,
      occurredAt: now.toISOString(),
      businessDate: businessDateOf(now),
      createdAt: now.toISOString(),
    };

    await this.deps.credit.applyDelta({
      customerAccountId: current.customerAccountId,
      delta: current.snapshot.credits,
    });
    await this.deps.credit.insertEntry(creditEntry);

    const verified = current.verify({
      verifiedByUserId: input.actorUserId,
      verifiedAt: now,
      creditEntryId,
    });
    await this.deps.purchases.updateVersioned(verified, input.actorUserId);

    await this.recordAuditAndEvents({
      verified,
      prevStatus: current.status,
      creditEntry,
      actorUserId: input.actorUserId,
    });
    return viewCreditPurchase(verified);
  }

  private async recordAuditAndEvents(params: {
    verified: CreditPurchase;
    prevStatus: string;
    creditEntry: {
      creditEntryId: string;
      customerAccountId: string;
      credits: number;
      source: { sourceType: string; sourceId: string };
      occurredAt: string;
    };
    actorUserId: string;
  }): Promise<void> {
    const { verified, prevStatus, creditEntry, actorUserId } = params;
    await this.deps.audit.record({
      action: AUDIT_ACTION.CREDIT_PURCHASE_VERIFIED,
      entityType: AUDIT_ENTITY_TYPE.creditPurchase,
      entityId: verified.creditPurchaseId,
      changes: {
        status: { from: prevStatus, to: verified.status },
        creditEntryId: { to: verified.creditEntryId },
        verifiedByUserId: { to: actorUserId },
      },
    });

    await this.deps.events.publish(
      CREDIT_EVENT_TYPE.PURCHASE_VERIFIED,
      { creditPurchaseId: verified.creditPurchaseId },
      { orderingKey: `creditAccount:${verified.customerAccountId}` },
    );

    await this.deps.events.publish(
      CREDIT_EVENT_TYPE.CREDIT_ENTRY_CREATED,
      {
        creditEntryId: creditEntry.creditEntryId,
        customerAccountId: creditEntry.customerAccountId,
        type: CREDIT_ENTRY_TYPE.PURCHASE,
        credits: creditEntry.credits,
        source: creditEntry.source,
        occurredAt: creditEntry.occurredAt,
      },
      { orderingKey: `creditAccount:${verified.customerAccountId}` },
    );
  }

  private resolveApprovalThreshold(setting: unknown): number {
    if (typeof setting === "number") return setting;
    if (typeof setting === "object" && setting !== null && "amount" in setting) {
      const amt = (setting as { amount: unknown }).amount;
      return typeof amt === "number" ? amt : DEFAULT_PURCHASE_APPROVAL_ABOVE;
    }
    return DEFAULT_PURCHASE_APPROVAL_ABOVE;
  }
}
