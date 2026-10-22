import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  PAYMENT_DIRECTION,
  PAYMENT_EVENT_TYPE,
  PAYMENT_METHOD,
  type Money,
  type PaymentAllocation,
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
import { Payment } from "../../domain/payment.entity.js";
import { validatePaymentAllocations } from "../../domain/payment-rules.js";
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
  handleOverpayment,
  handleStoreCreditPayment,
  updateSummaries,
  validateAllocationLimits,
  validateMobileMoney,
} from "./receive-payment-helpers.js";

export { formatPaymentNumber, toPaymentResponse };

export interface ReceivePaymentInput {
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly method: PaymentMethod;
  readonly amount: Money;
  readonly externalReference?: string | null;
  readonly allocations: readonly PaymentAllocation[];
  readonly contactId?: string | null;
  readonly receivedByMemberId: string;
  readonly actorUserId: UserId | null;
  readonly businessDate?: string | undefined;
  readonly note?: string | null;
}

function buildReceivedPayment(opts: {
  readonly input: ReceivePaymentInput;
  readonly seq: number;
  readonly now: Date;
}): Payment {
  const { input, seq, now } = opts;
  return Payment.create({
    paymentId: newId<PaymentId>(),
    organizationId: input.organizationId,
    locationId: input.locationId,
    paymentNumber: formatPaymentNumber(seq),
    direction: PAYMENT_DIRECTION.IN,
    method: input.method,
    amount: input.amount,
    externalReference: input.externalReference?.trim() || null,
    reversesPaymentId: null,
    allocations: input.allocations,
    contactId: input.contactId || null,
    receivedByMemberId: input.receivedByMemberId,
    businessDate: input.businessDate ?? now.toISOString().slice(0, 10),
    approval: null,
    note: input.note ?? null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUserId: input.actorUserId,
    updatedByUserId: null,
  });
}

async function publishReceivedEffects(opts: {
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly input: ReceivePaymentInput;
  readonly paymentId: PaymentId;
  readonly creditEntryId: string | null;
}): Promise<void> {
  const { events, audit, input, paymentId, creditEntryId } = opts;
  const orderingKey = `paymentAccount:${input.organizationId}`;
  await events.publish(PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED, { paymentId }, { orderingKey });
  if (creditEntryId) {
    await events.publish(
      PAYMENT_EVENT_TYPE.STORE_CREDIT_CHANGED,
      { storeCreditEntryId: creditEntryId },
      { orderingKey },
    );
  }
  await audit.record({
    action: AUDIT_ACTION.PAYMENT_RECEIVED,
    entityType: AUDIT_ENTITY_TYPE.payment,
    entityId: paymentId,
    changes: { amount: { to: input.amount.amount }, method: { to: input.method } },
  });
}

export interface ReceivePaymentDependencies {
  readonly payments: PaymentRepository;
  readonly storeCredit: StoreCreditRepository;
  readonly summaries: PaymentSummaryRepository;
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly requestReaders: RequestReaderRegistry;
  readonly unitOfWork: PaymentUnitOfWork;
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly orgConfig?: OrgConfigService;
}

export class ReceivePaymentUseCase {
  constructor(private readonly dependencies: ReceivePaymentDependencies) {}

  async execute(input: ReceivePaymentInput): Promise<PaymentResponse> {
    const deps = this.dependencies;
    await validateMobileMoney(deps.payments, input);
    const { overpaymentAmount } = validatePaymentAllocations({
      paymentAmount: input.amount,
      allocations: input.allocations,
      contactId: input.contactId,
      isCash: input.method === PAYMENT_METHOD.CASH,
    });
    await validateAllocationLimits(deps.requestReaders, deps.summaries, input);

    return deps.unitOfWork.run(async () => {
      const now = deps.clock.now();
      await handleStoreCreditPayment(deps.contactStoreCredit, input);
      const creditEntryId = await handleOverpayment({
        contactStoreCredit: deps.contactStoreCredit,
        storeCredit: deps.storeCredit,
        input,
        overpaymentAmount,
        now,
      });

      const seq = await nextSequenceValue({
        sequenceKey: SEQUENCE_KEY.PAYMENT,
        organizationId: input.organizationId,
      });
      const payment = buildReceivedPayment({ input, seq, now });

      await deps.payments.create(payment);
      await updateSummaries({
        summaries: deps.summaries,
        requestReaders: deps.requestReaders,
        input,
        now,
      });
      await publishReceivedEffects({
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
