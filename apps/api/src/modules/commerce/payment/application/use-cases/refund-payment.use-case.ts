import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  PAYMENT_DIRECTION,
  PAYMENT_EVENT_TYPE,
  type Money,
  type PaymentAllocation,
  type PaymentApprovalSnapshot,
  type PaymentMethod,
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
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";
import { Payment } from "../../domain/payment.entity.js";
import { paymentApprovalRequiredError } from "../../domain/errors.js";
import type {
  ContactStoreCreditPort,
  PaymentRepository,
  PaymentSummaryRepository,
  PaymentUnitOfWork,
  StoreCreditRepository,
} from "../ports/payment-repositories.js";
import type { RequestReaderRegistry } from "../ports/request-reader.js";
import { formatPaymentNumber, toPaymentResponse } from "./payment-view.js";
import {
  creditStoreCreditOnRefund,
  isApprovalRequired,
  resolveRefundApproval,
  updateRefundSummaries,
  validateRefundRequests,
} from "./refund-payment-helpers.js";

export interface RefundPaymentInput {
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference?: string | null;
  readonly allocations: readonly PaymentAllocation[];
  readonly contactId?: string | null;
  readonly receivedByMemberId: string;
  readonly actorUserId: UserId | null;
  readonly isManagerOrOwner: boolean;
  readonly approvalToken?: string | undefined;
  readonly businessDate?: string | undefined;
  readonly note?: string | null;
}

async function buildRefundPayment(opts: {
  readonly input: RefundPaymentInput;
  readonly approvalSnapshot: PaymentApprovalSnapshot | null;
  readonly now: Date;
}): Promise<Payment> {
  const { input, approvalSnapshot, now } = opts;
  const seq = await nextSequenceValue({
    sequenceKey: SEQUENCE_KEY.PAYMENT,
    organizationId: input.organizationId,
  });
  return Payment.create({
    paymentId: newId<PaymentId>(),
    organizationId: input.organizationId,
    locationId: input.locationId,
    paymentNumber: formatPaymentNumber(seq),
    direction: PAYMENT_DIRECTION.REFUND,
    method: input.method,
    amount: input.amount,
    externalReference: input.externalReference?.trim() || null,
    reversesPaymentId: null,
    allocations: input.allocations,
    contactId: input.contactId || null,
    receivedByMemberId: input.receivedByMemberId,
    businessDate: input.businessDate ?? now.toISOString().slice(0, 10),
    approval: approvalSnapshot,
    note: input.note ?? null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUserId: input.actorUserId,
    updatedByUserId: null,
  });
}

async function publishRefundEffects(opts: {
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly input: RefundPaymentInput;
  readonly paymentId: PaymentId;
  readonly creditEntryId: string | null;
}): Promise<void> {
  const { events, audit, input, paymentId, creditEntryId } = opts;
  const orderingKey = `paymentAccount:${input.organizationId}`;
  await events.publish(PAYMENT_EVENT_TYPE.PAYMENT_REFUNDED, { paymentId }, { orderingKey });
  if (creditEntryId) {
    await events.publish(
      PAYMENT_EVENT_TYPE.STORE_CREDIT_CHANGED,
      { storeCreditEntryId: creditEntryId },
      { orderingKey },
    );
  }
  await audit.record({
    action: AUDIT_ACTION.PAYMENT_REFUNDED,
    entityType: AUDIT_ENTITY_TYPE.payment,
    entityId: paymentId,
    changes: {
      direction: { to: PAYMENT_DIRECTION.REFUND },
      amount: { to: input.amount.amount },
    },
  });
}

export interface RefundPaymentDependencies {
  readonly payments: PaymentRepository;
  readonly storeCredit: StoreCreditRepository;
  readonly summaries: PaymentSummaryRepository;
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly requestReaders: RequestReaderRegistry;
  readonly unitOfWork: PaymentUnitOfWork;
  readonly approvals: Pick<ApprovalVerifier, "consume">;
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly orgConfig?: OrgConfigService;
}

export class RefundPaymentUseCase {
  constructor(private readonly dependencies: RefundPaymentDependencies) {}

  async execute(input: RefundPaymentInput): Promise<PaymentResponse> {
    const deps = this.dependencies;
    const needsApproval = await isApprovalRequired(deps.orgConfig, input);
    if (needsApproval && !input.approvalToken) throw paymentApprovalRequiredError();
    await validateRefundRequests(deps.requestReaders, deps.summaries, input);

    return deps.unitOfWork.run(async () => {
      const approvalSnapshot = await resolveRefundApproval(deps.approvals, needsApproval, input);
      const now = deps.clock.now();
      const creditEntryId = await creditStoreCreditOnRefund({
        contactStoreCredit: deps.contactStoreCredit,
        storeCredit: deps.storeCredit,
        input,
        now,
      });
      const payment = await buildRefundPayment({ input, approvalSnapshot, now });
      await deps.payments.create(payment);
      await updateRefundSummaries({
        summaries: deps.summaries,
        requestReaders: deps.requestReaders,
        input,
        now,
      });
      await publishRefundEffects({
        events: deps.events,
        audit: deps.audit,
        input,
        paymentId: payment.paymentId,
        creditEntryId,
      });

      return toPaymentResponse(payment);
    });
  }
}
