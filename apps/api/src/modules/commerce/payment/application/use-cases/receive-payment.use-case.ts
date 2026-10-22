import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  PAYMENT_DIRECTION,
  PAYMENT_EVENT_TYPE,
  PAYMENT_METHOD,
  PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY,
  type Money,
  type PaymentAllocation,
  type PaymentMethod,
  type PaymentResponse,
} from "@banijjik/contracts/payment";
import {
  asId,
  newId,
  type ContactId,
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
import { paymentContactNotFoundError } from "../../domain/errors.js";
import { validatePaymentAllocations } from "../../domain/payment-rules.js";
import { businessDateOf } from "../../domain/timezone.js";
import type {
  ContactStoreCreditPort,
  PaymentRepository,
  PaymentSummaryRepository,
  PaymentUnitOfWork,
  StoreCreditRepository,
  TimezoneReader,
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
  readonly note?: string | null;
}

function buildReceivedPayment(opts: {
  readonly input: ReceivePaymentInput;
  readonly paymentId: PaymentId;
  readonly allocations: readonly PaymentAllocation[];
  readonly businessDate: string;
  readonly seq: number;
  readonly now: Date;
}): Payment {
  const { input, paymentId, allocations, businessDate, seq, now } = opts;
  return Payment.create({
    paymentId,
    organizationId: input.organizationId,
    locationId: input.locationId,
    paymentNumber: formatPaymentNumber(seq),
    direction: PAYMENT_DIRECTION.IN,
    method: input.method,
    amount: input.amount,
    externalReference: input.externalReference?.trim() || null,
    reversesPaymentId: null,
    allocations,
    contactId: input.contactId || null,
    receivedByMemberId: input.receivedByMemberId,
    businessDate,
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
  readonly debitEntryId: string | null;
  readonly creditEntryId: string | null;
}): Promise<void> {
  const { events, audit, input, paymentId, debitEntryId, creditEntryId } = opts;
  const orderingKey = `paymentAccount:${input.organizationId}`;
  await events.publish(PAYMENT_EVENT_TYPE.PAYMENT_RECEIVED, { paymentId }, { orderingKey });
  if (debitEntryId) {
    await events.publish(
      PAYMENT_EVENT_TYPE.STORE_CREDIT_CHANGED,
      { storeCreditEntryId: debitEntryId },
      { orderingKey },
    );
  }
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
  readonly timeZone: TimezoneReader;
  readonly orgConfig: OrgConfigService;
}

async function resolveStoreCreditExpiresAt(
  orgConfig: OrgConfigService,
  organizationId: OrganizationId,
  now: Date,
): Promise<Date | null> {
  const effective = await orgConfig.forOrganization(organizationId);
  const val = effective.config.settings[PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY];
  const expiryDays = typeof val === "number" && val > 0 ? val : null;
  return expiryDays ? new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000) : null;
}

async function enrichAllocationsWithRevenueState(
  requestReaders: RequestReaderRegistry,
  organizationId: OrganizationId,
  rawAllocations: readonly PaymentAllocation[],
): Promise<readonly PaymentAllocation[]> {
  const allocations: PaymentAllocation[] = [];
  for (const alloc of rawAllocations) {
    const reader = requestReaders.get(alloc.requestType);
    const snapshot = reader ? await reader.read(organizationId, alloc.requestId) : undefined;
    allocations.push({
      ...alloc,
      revenueState: snapshot?.revenueState ?? "BEFORE_REVENUE",
    });
  }
  return allocations;
}

async function prepareReceiveContext(
  deps: ReceivePaymentDependencies,
  input: ReceivePaymentInput,
): Promise<{
  readonly overpaymentAmount: number;
  readonly businessDate: string;
  readonly expiresAt: Date | null;
  readonly allocations: readonly PaymentAllocation[];
  readonly now: Date;
}> {
  if (input.contactId) {
    const exists = await deps.contactStoreCredit.contactExists(
      input.organizationId,
      asId<ContactId>(input.contactId),
    );
    if (!exists) throw paymentContactNotFoundError(input.contactId);
  }

  await validateMobileMoney(deps.payments, input);
  const { overpaymentAmount } = validatePaymentAllocations({
    paymentAmount: input.amount,
    allocations: input.allocations,
    contactId: input.contactId,
    isCash: input.method === PAYMENT_METHOD.CASH,
  });
  await validateAllocationLimits(deps.requestReaders, deps.summaries, input);

  const timeZone = await deps.timeZone.read(input.organizationId);
  const now = deps.clock.now();
  const businessDate = businessDateOf(now, timeZone);
  const expiresAt = await resolveStoreCreditExpiresAt(deps.orgConfig, input.organizationId, now);
  const allocations = await enrichAllocationsWithRevenueState(
    deps.requestReaders,
    input.organizationId,
    input.allocations,
  );

  return { overpaymentAmount, businessDate, expiresAt, allocations, now };
}

export class ReceivePaymentUseCase {
  constructor(private readonly dependencies: ReceivePaymentDependencies) {}

  async execute(input: ReceivePaymentInput): Promise<PaymentResponse> {
    const deps = this.dependencies;
    const { overpaymentAmount, businessDate, expiresAt, allocations, now } =
      await prepareReceiveContext(deps, input);

    return deps.unitOfWork.run(async () => {
      const paymentId = newId<PaymentId>();
      const debitEntryId = await handleStoreCreditPayment({
        contactStoreCredit: deps.contactStoreCredit,
        storeCredit: deps.storeCredit,
        input,
        paymentId,
        now,
      });

      const creditEntryId = await handleOverpayment({
        contactStoreCredit: deps.contactStoreCredit,
        storeCredit: deps.storeCredit,
        input,
        paymentId,
        overpaymentAmount,
        expiresAt,
        now,
      });

      const seq = await nextSequenceValue({
        sequenceKey: SEQUENCE_KEY.PAYMENT,
        organizationId: input.organizationId,
      });
      const payment = buildReceivedPayment({
        input,
        paymentId,
        allocations,
        businessDate,
        seq,
        now,
      });

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
        paymentId,
        debitEntryId,
        creditEntryId,
      });

      return toPaymentResponse(payment);
    });
  }
}
