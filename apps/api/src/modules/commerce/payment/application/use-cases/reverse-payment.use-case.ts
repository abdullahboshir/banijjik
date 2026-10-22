import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  PAYMENT_DIRECTION,
  PAYMENT_EVENT_TYPE,
  type PaymentAllocation,
  type PaymentApprovalSnapshot,
  type PaymentResponse,
} from "@banijjik/contracts/payment";
import {
  newId,
  type LocationId,
  type OrganizationId,
  type PaymentId,
  type UserId,
} from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";
import { Payment } from "../../domain/payment.entity.js";
import { PaymentSummary } from "../../domain/payment-summary.entity.js";
import { computePaymentStatus } from "../../domain/payment-rules.js";
import {
  paymentAllocationsInvalidError,
  paymentApprovalRequiredError,
  paymentOriginalNotFoundError,
  paymentReversalAlreadyReversedError,
} from "../../domain/errors.js";
import type {
  PaymentRepository,
  PaymentSummaryRepository,
  PaymentUnitOfWork,
} from "../ports/payment-repositories.js";
import { formatPaymentNumber, toPaymentResponse } from "./payment-view.js";

export interface ReversePaymentInput {
  readonly organizationId: OrganizationId;
  readonly locationId?: LocationId | undefined;
  readonly paymentId: PaymentId;
  readonly approvalToken: string;
  readonly receivedByMemberId: string;
  readonly actorUserId: UserId | null;
  readonly businessDate?: string | undefined;
  readonly note?: string | null;
}

async function restorePaymentSummaries(input: {
  readonly summaries: PaymentSummaryRepository;
  readonly organizationId: OrganizationId;
  readonly allocations: readonly PaymentAllocation[];
  readonly now: Date;
}): Promise<void> {
  const { summaries, organizationId, allocations, now } = input;
  for (const alloc of allocations) {
    const existing = await summaries.findByRequest(
      organizationId,
      alloc.requestType,
      alloc.requestId,
    );
    if (!existing) continue;

    const nextAllocated = Math.max(0, existing.allocated.amount - alloc.amount.amount);
    const nextStatus = computePaymentStatus(
      existing.total.amount,
      nextAllocated,
      existing.refunded.amount,
    );

    await summaries.upsert(
      PaymentSummary.create({
        organizationId,
        requestType: alloc.requestType,
        requestId: alloc.requestId,
        contactId: existing.contactId,
        locationId: existing.locationId,
        total: existing.total,
        allocated: { amount: nextAllocated, currency: alloc.amount.currency },
        refunded: existing.refunded,
        paymentStatus: nextStatus,
        updatedAt: now,
      }),
    );
  }
}

async function buildReversalPayment(input: {
  readonly input: ReversePaymentInput;
  readonly original: Payment;
  readonly approvalSnapshot: PaymentApprovalSnapshot;
  readonly now: Date;
}): Promise<Payment> {
  const { input: req, original, approvalSnapshot, now } = input;
  const seq = await nextSequenceValue({
    sequenceKey: SEQUENCE_KEY.PAYMENT,
    organizationId: req.organizationId,
  });
  return Payment.create({
    paymentId: newId<PaymentId>(),
    organizationId: req.organizationId,
    locationId: original.locationId,
    paymentNumber: formatPaymentNumber(seq),
    direction: PAYMENT_DIRECTION.REVERSAL,
    method: original.method,
    amount: original.amount,
    externalReference: original.externalReference,
    reversesPaymentId: original.paymentId,
    allocations: original.allocations,
    contactId: original.contactId,
    receivedByMemberId: req.receivedByMemberId,
    businessDate: req.businessDate ?? now.toISOString().slice(0, 10),
    approval: approvalSnapshot,
    note: req.note ?? `Reversal of ${original.paymentNumber}`,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUserId: req.actorUserId,
    updatedByUserId: null,
  });
}

export interface ReversePaymentDependencies {
  readonly payments: PaymentRepository;
  readonly summaries: PaymentSummaryRepository;
  readonly unitOfWork: PaymentUnitOfWork;
  readonly approvals: Pick<ApprovalVerifier, "consume">;
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export class ReversePaymentUseCase {
  constructor(private readonly dependencies: ReversePaymentDependencies) {}

  async execute(input: ReversePaymentInput): Promise<PaymentResponse> {
    const { payments, summaries, unitOfWork, approvals, events, audit, clock } = this.dependencies;

    if (!input.approvalToken) throw paymentApprovalRequiredError();

    const original = await payments.findById(input.organizationId, input.paymentId);
    if (!original) throw paymentOriginalNotFoundError();
    if (original.direction !== PAYMENT_DIRECTION.IN) {
      throw paymentAllocationsInvalidError("Only IN payments can be reversed");
    }

    const alreadyReversed = await payments.findReversalOf(input.organizationId, input.paymentId);
    if (alreadyReversed) throw paymentReversalAlreadyReversedError();

    return unitOfWork.run(async () => {
      const consumed = await approvals.consume(input.approvalToken, {
        action: APPROVAL_ACTION.PAYMENT_REVERSAL,
        subjectKey: input.paymentId,
        amount: original.amount,
        locationId: original.locationId,
      });

      const approvalSnapshot: PaymentApprovalSnapshot = {
        approvalId: input.approvalToken.slice(0, 16),
        approverUserId: consumed.approverMemberId,
        approvedAt: consumed.approvedAt.toISOString(),
      };

      const now = clock.now();
      const reversalPayment = await buildReversalPayment({
        input,
        original,
        approvalSnapshot,
        now,
      });
      await payments.create(reversalPayment);
      await restorePaymentSummaries({
        summaries,
        organizationId: input.organizationId,
        allocations: original.allocations,
        now,
      });

      await events.publish(
        PAYMENT_EVENT_TYPE.PAYMENT_REVERSED,
        { paymentId: reversalPayment.paymentId },
        { orderingKey: `paymentAccount:${input.organizationId}` },
      );

      await audit.record({
        action: AUDIT_ACTION.PAYMENT_REVERSED,
        entityType: AUDIT_ENTITY_TYPE.payment,
        entityId: reversalPayment.paymentId,
        changes: {
          direction: { to: PAYMENT_DIRECTION.REVERSAL },
          reversesPaymentId: { to: original.paymentId },
        },
      });

      return toPaymentResponse(reversalPayment);
    });
  }
}
