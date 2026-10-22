import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  PAYMENT_DIRECTION,
  PAYMENT_EVENT_TYPE,
  PAYMENT_METHOD,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
  type PaymentApprovalSnapshot,
  type PaymentResponse,
} from "@banijjik/contracts/payment";
import {
  asId,
  newId,
  type ContactId,
  type LocationId,
  type OrganizationId,
  type PaymentId,
  type StoreCreditEntryId,
  type UserId,
} from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";
import { Payment } from "../../domain/payment.entity.js";
import { StoreCreditEntry } from "../../domain/store-credit-entry.entity.js";
import {
  overpaymentCreditSpentError,
  paymentAllocationsInvalidError,
  paymentApprovalRequiredError,
  paymentOriginalNotFoundError,
  paymentReversalAlreadyReversedError,
  paymentReversalHasRefundError,
  storeCreditConflictError,
} from "../../domain/errors.js";
import { businessDateOf } from "../../domain/timezone.js";
import type {
  ContactStoreCreditPort,
  PaymentRepository,
  PaymentSummaryRepository,
  PaymentUnitOfWork,
  StoreCreditRepository,
  TimezoneReader,
} from "../ports/payment-repositories.js";
import { formatPaymentNumber, toPaymentResponse } from "./payment-view.js";

export interface ReversePaymentInput {
  readonly organizationId: OrganizationId;
  readonly locationId?: LocationId | undefined;
  readonly paymentId: PaymentId;
  readonly approvalToken: string;
  readonly receivedByMemberId: string;
  readonly actorUserId: UserId | null;
  readonly note?: string | null;
}

async function buildReversalPayment(input: {
  readonly input: ReversePaymentInput;
  readonly original: Payment;
  readonly approvalSnapshot: PaymentApprovalSnapshot;
  readonly businessDate: string;
  readonly now: Date;
}): Promise<Payment> {
  const { input: req, original, approvalSnapshot, businessDate, now } = input;
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
    externalReference: null,
    reversesPaymentId: original.paymentId,
    allocations: original.allocations,
    contactId: original.contactId,
    receivedByMemberId: req.receivedByMemberId,
    businessDate,
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
  readonly storeCredit: StoreCreditRepository;
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly unitOfWork: PaymentUnitOfWork;
  readonly approvals: Pick<ApprovalVerifier, "consume">;
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly timeZone: TimezoneReader;
}

function computeReversalStoreCreditDelta(original: Payment): {
  readonly deltaMinor: number;
  readonly direction: (typeof STORE_CREDIT_DIRECTION)[keyof typeof STORE_CREDIT_DIRECTION];
  readonly note: string;
} | null {
  if (original.method === PAYMENT_METHOD.STORE_CREDIT) {
    return {
      deltaMinor: original.amount.amount,
      direction: STORE_CREDIT_DIRECTION.CREDIT,
      note: `Reversal credit of payment ${original.paymentNumber}`,
    };
  }
  const allocatedSum = original.allocations.reduce((sum, a) => sum + a.amount.amount, 0);
  const overpayment = original.amount.amount - allocatedSum;
  if (overpayment <= 0) return null;
  return {
    deltaMinor: -overpayment,
    direction: STORE_CREDIT_DIRECTION.DEBIT,
    note: `Reversal debit of overpayment from payment ${original.paymentNumber}`,
  };
}

async function reverseStoreCreditSideEffects(input: {
  readonly deps: ReversePaymentDependencies;
  readonly req: ReversePaymentInput;
  readonly original: Payment;
  readonly reversalPayment: Payment;
  readonly now: Date;
}): Promise<string | null> {
  const { deps, req, original, reversalPayment, now } = input;
  const spec = original.contactId ? computeReversalStoreCreditDelta(original) : null;
  if (!spec || !original.contactId) return null;
  const contactId = asId<ContactId>(original.contactId);

  const bal = await deps.contactStoreCredit.getBalance(req.organizationId, contactId);
  if (spec.deltaMinor < 0 && (!bal || bal.balanceMinor < Math.abs(spec.deltaMinor))) {
    throw overpaymentCreditSpentError();
  }
  const result = await deps.contactStoreCredit.adjustBalance({
    organizationId: req.organizationId,
    contactId,
    deltaMinor: spec.deltaMinor,
    expectedVersion: bal ? bal.version : 1,
  });
  if (!result.success) throw storeCreditConflictError();

  const entryId = newId<StoreCreditEntryId>();
  await deps.storeCredit.create(
    StoreCreditEntry.create({
      storeCreditEntryId: entryId,
      organizationId: req.organizationId,
      contactId,
      direction: spec.direction,
      kind: STORE_CREDIT_ENTRY_KIND.PAYMENT_REVERSAL,
      amount: { amount: Math.abs(spec.deltaMinor), currency: original.amount.currency },
      paymentId: reversalPayment.paymentId,
      balanceAfterMinor: result.newBalanceMinor,
      note: spec.note,
      expiresAt: null,
      expiresStoreCreditEntryId: null,
      createdAt: now,
      createdByUserId: req.actorUserId,
    }),
  );
  return entryId;
}

async function publishReversalEffects(input: {
  readonly deps: ReversePaymentDependencies;
  readonly organizationId: OrganizationId;
  readonly original: Payment;
  readonly reversalPayment: Payment;
  readonly creditEntryId: string | null;
}): Promise<void> {
  const { deps, organizationId, original, reversalPayment, creditEntryId } = input;
  const orderingKey = `paymentAccount:${organizationId}`;
  await deps.events.publish(
    PAYMENT_EVENT_TYPE.PAYMENT_REVERSED,
    { paymentId: reversalPayment.paymentId },
    { orderingKey },
  );
  if (creditEntryId) {
    await deps.events.publish(
      PAYMENT_EVENT_TYPE.STORE_CREDIT_CHANGED,
      { storeCreditEntryId: creditEntryId },
      { orderingKey },
    );
  }
  await deps.audit.record({
    action: AUDIT_ACTION.PAYMENT_REVERSED,
    entityType: AUDIT_ENTITY_TYPE.payment,
    entityId: reversalPayment.paymentId,
    changes: {
      direction: { to: PAYMENT_DIRECTION.REVERSAL },
      reversesPaymentId: { to: original.paymentId },
    },
  });
}

async function validateReversalEligibility(
  deps: ReversePaymentDependencies,
  input: ReversePaymentInput,
): Promise<Payment> {
  if (!input.approvalToken) throw paymentApprovalRequiredError();
  const original = await deps.payments.findById(input.organizationId, input.paymentId);
  if (!original) throw paymentOriginalNotFoundError();
  if (original.direction !== PAYMENT_DIRECTION.IN) {
    throw paymentAllocationsInvalidError("Only IN payments can be reversed");
  }
  const alreadyReversed = await deps.payments.findReversalOf(input.organizationId, input.paymentId);
  if (alreadyReversed) throw paymentReversalAlreadyReversedError();
  for (const alloc of original.allocations) {
    const summary = await deps.summaries.findByRequest(
      input.organizationId,
      alloc.requestType,
      alloc.requestId,
    );
    if (summary && summary.refunded.amount > 0) throw paymentReversalHasRefundError();
  }
  return original;
}

export class ReversePaymentUseCase {
  constructor(private readonly dependencies: ReversePaymentDependencies) {}

  async execute(input: ReversePaymentInput): Promise<PaymentResponse> {
    const deps = this.dependencies;
    const original = await validateReversalEligibility(deps, input);
    const timeZone = await deps.timeZone.read(input.organizationId);

    return deps.unitOfWork.run(async () => {
      const consumed = await deps.approvals.consume(input.approvalToken, {
        action: APPROVAL_ACTION.PAYMENT_REVERSAL,
        subjectKey: input.paymentId,
        amount: original.amount,
        locationId: original.locationId,
      });
      const approvalSnapshot: PaymentApprovalSnapshot = {
        approvalId: consumed.approvalTokenId,
        approverUserId: consumed.approverMemberId,
        approvedAt: consumed.approvedAt.toISOString(),
      };
      const now = deps.clock.now();
      const businessDate = businessDateOf(now, timeZone);
      const reversalPayment = await buildReversalPayment({
        input,
        original,
        approvalSnapshot,
        businessDate,
        now,
      });
      const creditEntryId = await reverseStoreCreditSideEffects({
        deps,
        req: input,
        original,
        reversalPayment,
        now,
      });
      await deps.payments.create(reversalPayment);
      for (const alloc of original.allocations) {
        await deps.summaries.restoreAllocation({
          organizationId: input.organizationId,
          requestType: alloc.requestType,
          requestId: alloc.requestId,
          amount: alloc.amount.amount,
          now,
        });
      }
      await publishReversalEffects({
        deps,
        organizationId: input.organizationId,
        original,
        reversalPayment,
        creditEntryId,
      });
      return toPaymentResponse(reversalPayment);
    });
  }
}
