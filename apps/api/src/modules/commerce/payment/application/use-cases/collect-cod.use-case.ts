import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  COLLECTION_CLAIM_STATE,
  PAYMENT_DIRECTION,
  PAYMENT_EVENT_TYPE,
  PAYMENT_REQUEST_TYPE,
  type Money,
} from "@banijjik/contracts/payment";
import {
  asId,
  newId,
  type CollectionClaimId,
  type ContactId,
  type LocationId,
  type OrderId,
  type OrganizationId,
  type PaymentId,
  type UserId,
} from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import { CollectionClaim } from "../../domain/collection-claim.entity.js";
import { Payment } from "../../domain/payment.entity.js";
import { businessDateOf } from "../../domain/timezone.js";
import type { CollectionClaimRepository } from "../ports/collection-claim.repository.js";
import type {
  PaymentRepository,
  PaymentSummaryRepository,
  TimezoneReader,
} from "../ports/payment-repositories.js";
import { formatPaymentNumber } from "./payment-view.js";

export interface CollectCodInput {
  readonly organizationId: OrganizationId;
  readonly orderId: OrderId;
  readonly locationId: LocationId;
  readonly contactId: ContactId | null;
  readonly expectedOrderVersion: number;
  readonly deliveryCompletionId: string;
  readonly carrier:
    | { readonly method: "COD_COURIER"; readonly consignmentId: string }
    | { readonly method: "RIDER_CASH"; readonly deliveryAssignmentId: string };
  readonly actorUserId: UserId;
  readonly now: Date;
}

export interface CollectCodResult {
  readonly paymentId: PaymentId | null;
}

export interface CollectCodDependencies {
  readonly payments: PaymentRepository;
  readonly summaries: PaymentSummaryRepository;
  readonly collectionClaims: CollectionClaimRepository;
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly timeZone: TimezoneReader;
}

function carrierReferenceOf(input: CollectCodInput): string {
  return input.carrier.method === "COD_COURIER"
    ? input.carrier.consignmentId
    : input.carrier.deliveryAssignmentId;
}

export class CollectCodUseCase {
  constructor(private readonly dependencies: CollectCodDependencies) {}

  async execute(input: CollectCodInput): Promise<CollectCodResult> {
    const existing = await this.findActiveClaim(input);
    if (existing) return { paymentId: existing.paymentId };

    const summary = await this.dependencies.summaries.findByRequest(
      input.organizationId,
      PAYMENT_REQUEST_TYPE.ORDER,
      input.orderId,
    );
    if (!summary) return { paymentId: null };

    const netPaidMinor = summary.allocated.amount - summary.refunded.amount;
    const remainingDueMinor = summary.total.amount - netPaidMinor;
    if (remainingDueMinor <= 0) return { paymentId: null };

    const paymentId = asId<PaymentId>(newId());
    await this.persistPaymentAndAllocation({
      input,
      summary,
      paymentId,
      amountMinor: remainingDueMinor,
    });
    await this.persistClaimAndAudit(input, paymentId, remainingDueMinor);
    return { paymentId };
  }

  private async findActiveClaim(input: CollectCodInput) {
    const existingClaims = await this.dependencies.collectionClaims.findByOrderId(
      input.organizationId,
      input.orderId,
    );
    return existingClaims.find(
      (c) =>
        c.carrier.method === input.carrier.method && c.state !== COLLECTION_CLAIM_STATE.REVERSED,
    );
  }

  private async persistPaymentAndAllocation(args: {
    readonly input: CollectCodInput;
    readonly summary: { total: Money };
    readonly paymentId: PaymentId;
    readonly amountMinor: number;
  }): Promise<void> {
    const { input, summary, paymentId, amountMinor } = args;
    const carrierRef = carrierReferenceOf(input);
    const seq = await nextSequenceValue({
      sequenceKey: SEQUENCE_KEY.PAYMENT,
      organizationId: input.organizationId,
    });
    const tz = await this.dependencies.timeZone.read(input.organizationId);
    const businessDate = businessDateOf(input.now, tz);
    const amount: Money = { amount: amountMinor, currency: summary.total.currency };

    const payment = Payment.create({
      paymentId,
      organizationId: input.organizationId,
      locationId: input.locationId,
      paymentNumber: formatPaymentNumber(seq),
      direction: PAYMENT_DIRECTION.IN,
      method: input.carrier.method,
      amount,
      externalReference: carrierRef,
      reversesPaymentId: null,
      allocations: [
        {
          requestType: PAYMENT_REQUEST_TYPE.ORDER,
          requestId: input.orderId,
          enrollmentPeriodId: null,
          amount,
          revenueState: "AFTER_REVENUE",
        },
      ],
      writeOffs: [],
      contactId: input.contactId,
      receivedByMemberId: "system",
      businessDate,
      approval: null,
      note: `COD collection for order ${input.orderId}`,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: null,
    });

    await this.dependencies.payments.create(payment);
    await this.dependencies.summaries.applyAllocation({
      organizationId: input.organizationId,
      locationId: input.locationId,
      requestType: PAYMENT_REQUEST_TYPE.ORDER,
      requestId: input.orderId,
      contactId: input.contactId,
      total: summary.total,
      amount: amountMinor,
      currency: summary.total.currency,
      now: input.now,
    });
  }

  private async persistClaimAndAudit(
    input: CollectCodInput,
    paymentId: PaymentId,
    amountMinor: number,
  ): Promise<void> {
    const carrierRef = carrierReferenceOf(input);
    const collectionClaim = CollectionClaim.create({
      collectionClaimId: asId<CollectionClaimId>(newId()),
      organizationId: input.organizationId,
      paymentId,
      orderId: input.orderId,
      carrier: {
        method: input.carrier.method,
        carrierReference: carrierRef,
      },
      state: COLLECTION_CLAIM_STATE.OPEN,
      generation: 1,
      claimedByReference: null,
      version: 1,
      createdAt: input.now,
      updatedAt: input.now,
      createdByUserId: input.actorUserId,
      updatedByUserId: null,
    });
    await this.dependencies.collectionClaims.save(collectionClaim);

    const orderingKey = `paymentAccount:${input.organizationId}`;
    await this.dependencies.events.publish(
      PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED,
      { paymentId },
      { orderingKey },
    );
    await this.dependencies.audit.record({
      action: AUDIT_ACTION.PAYMENT_RECEIVED,
      entityType: AUDIT_ENTITY_TYPE.payment,
      entityId: paymentId,
      changes: {
        amount: { to: amountMinor },
        method: { to: input.carrier.method },
        orderId: { to: input.orderId },
      },
    });
  }
}
