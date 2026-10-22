import { AUDIT_ACTION, AUDIT_ENTITY_TYPE } from "@banijjik/contracts";
import {
  CREDIT_EVENT_TYPE,
  CREDIT_PACK_STATUS,
  CREDIT_RULE_KEY,
  DEFAULT_PURCHASE_MAX_PENDING,
  DEFAULT_PURCHASE_PENDING_DAYS,
  type CreditPack,
  type CreditPaymentMethodSetting,
  type CreditPurchaseMethod,
  type CreditPurchaseResponse,
} from "@banijjik/contracts/credit";
import { asId, type CustomerAccountId, type OrganizationId } from "@banijjik/ids";
import { getRequestContext } from "../../../../../kernel/context/index.js";
import { CreditPurchase } from "../../domain/credit-purchase.entity.js";
import {
  CreditMaxPendingExceededError,
  CreditPackNotActiveError,
  CreditPackNotFoundError,
  CreditPaymentMethodNotConfiguredError,
  CreditReferenceTakenError,
} from "../../domain/errors.js";
import type { CreditDependencies } from "../ports/credit-dependencies.js";
import { viewCreditPurchase } from "./credit-purchase-view.js";

function parsePositiveNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || value <= 0) return fallback;
  return value;
}

function assertMethodAvailable(value: unknown, targetMethod: string): void {
  const methods = (value ?? []) as readonly CreditPaymentMethodSetting[];
  const exists = methods.some((item) => item.method === targetMethod);
  if (!exists) throw new CreditPaymentMethodNotConfiguredError();
}

export interface SubmitCreditPurchaseInput {
  readonly customerAccountId: CustomerAccountId;
  readonly creditPackId: string;
  readonly method: CreditPurchaseMethod;
  readonly senderPhone: string;
  readonly transactionReference: string;
}

export class SubmitCreditPurchaseUseCase {
  constructor(private readonly deps: CreditDependencies) {}

  async execute(input: SubmitCreditPurchaseInput): Promise<CreditPurchaseResponse> {
    const organizationId = asId<OrganizationId>(String(getRequestContext().organizationId));

    // Replay first: a retry of a lost 201 must write nothing (no sequence number, audit or event).
    const replayed = await this.replayOwnSubmission(input);
    if (replayed !== undefined) return replayed;

    const pack = await this.validatePack(organizationId, input);
    const { pendingDays } = await this.validateLimitsAndMethod(organizationId, input);

    const now = this.deps.clock.now();
    const expiresAt = new Date(now.getTime() + pendingDays * 24 * 60 * 60 * 1000);
    const purchaseNumber = await this.deps.sequences.nextPurchaseNumber();

    const purchase = CreditPurchase.create({
      organizationId,
      purchaseNumber,
      customerAccountId: input.customerAccountId,
      creditPackId: input.creditPackId,
      snapshot: {
        name: pack.name,
        credits: pack.credits,
        price: pack.price,
        validityDays: pack.validityDays,
      },
      method: input.method,
      senderPhoneE164: input.senderPhone,
      transactionReference: input.transactionReference,
      submittedAt: now,
      expiresAt,
    });

    try {
      return await this.savePurchase(purchase);
    } catch (error) {
      if (!(error instanceof CreditReferenceTakenError)) throw error;
      // A parallel identical submit won the unique index: behave like the pre-check would have.
      const replayedAfterRace = await this.replayOwnSubmission(input);
      if (replayedAfterRace !== undefined) return replayedAfterRace;
      throw error;
    }
  }

  /**
   * The same customer account already holds a PENDING or VERIFIED purchase with this method,
   * reference and pack: return it unchanged. Any other holder of the reference stays a 409 that
   * reveals nothing.
   */
  private async replayOwnSubmission(
    input: SubmitCreditPurchaseInput,
  ): Promise<CreditPurchaseResponse | undefined> {
    const existing = await this.deps.purchases.findByReference(
      input.method,
      input.transactionReference,
    );
    if (existing === undefined) return undefined;
    const isOwnSubmission =
      existing.customerAccountId === input.customerAccountId &&
      existing.creditPackId === input.creditPackId;
    if (!isOwnSubmission) throw new CreditReferenceTakenError();
    return viewCreditPurchase(existing);
  }

  private async validatePack(
    organizationId: OrganizationId,
    input: SubmitCreditPurchaseInput,
  ): Promise<CreditPack> {
    const pack = await this.deps.packs.findById(organizationId, input.creditPackId);
    if (!pack) throw new CreditPackNotFoundError();
    if (pack.status !== CREDIT_PACK_STATUS.ACTIVE) throw new CreditPackNotActiveError();
    return pack;
  }

  private async validateLimitsAndMethod(
    organizationId: OrganizationId,
    input: SubmitCreditPurchaseInput,
  ): Promise<{ pendingDays: number }> {
    const settings = await this.deps.resolveSettings(organizationId, [
      CREDIT_RULE_KEY.PAYMENT_METHODS,
      CREDIT_RULE_KEY.PURCHASE_MAX_PENDING,
      CREDIT_RULE_KEY.PURCHASE_PENDING_DAYS,
    ]);

    assertMethodAvailable(settings.get(CREDIT_RULE_KEY.PAYMENT_METHODS)?.value, input.method);

    const maxPending = parsePositiveNumber(
      settings.get(CREDIT_RULE_KEY.PURCHASE_MAX_PENDING)?.value,
      DEFAULT_PURCHASE_MAX_PENDING,
    );
    const pendingCount = await this.deps.purchases.countPendingByAccount(input.customerAccountId);
    if (pendingCount >= maxPending) throw new CreditMaxPendingExceededError();

    const pendingDays = parsePositiveNumber(
      settings.get(CREDIT_RULE_KEY.PURCHASE_PENDING_DAYS)?.value,
      DEFAULT_PURCHASE_PENDING_DAYS,
    );
    return { pendingDays };
  }

  private async savePurchase(purchase: CreditPurchase): Promise<CreditPurchaseResponse> {
    return this.deps.unitOfWork.run(async () => {
      await this.deps.purchases.insert(purchase);

      await this.deps.audit.record({
        action: AUDIT_ACTION.CREDIT_PURCHASE_SUBMITTED,
        entityType: AUDIT_ENTITY_TYPE.creditPurchase,
        entityId: purchase.creditPurchaseId,
        changes: {
          purchaseNumber: { to: purchase.purchaseNumber },
          method: { to: purchase.method },
          transactionReference: { to: purchase.transactionReference },
          credits: { to: purchase.snapshot.credits },
          priceAmount: { to: purchase.snapshot.price.amount },
          currency: { to: purchase.snapshot.price.currency },
        },
      });

      await this.deps.events.publish(
        CREDIT_EVENT_TYPE.PURCHASE_SUBMITTED,
        { creditPurchaseId: purchase.creditPurchaseId },
        { orderingKey: `creditAccount:${purchase.customerAccountId}` },
      );

      return viewCreditPurchase(purchase);
    });
  }
}
