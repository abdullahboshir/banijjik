import { ERROR_CODE, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  PAYMENT_DIRECTION,
  PAYMENT_METHOD,
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
import {
  DomainRuleError,
  paymentContactNotFoundError,
  paymentRequestNotFoundError,
} from "../../domain/errors.js";
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
import type {
  RequestPaymentLifecycle,
  RequestPaymentLifecycleRegistry,
} from "../ports/request-payment-lifecycle.js";
import { formatPaymentNumber, toPaymentResponse } from "./payment-view.js";
import {
  enrichAllocationsWithRevenueState,
  handleOverpayment,
  handleStoreCreditPayment,
  publishReceivedEffects,
  resolveStoreCreditExpiresAt,
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
  /** Set by the POS: the open register session this payment is counted in. */
  readonly posSessionId?: string | null;
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
    writeOffs: [],
    contactId: input.contactId || null,
    receivedByMemberId: input.receivedByMemberId,
    businessDate,
    approval: null,
    note: input.note ?? null,
    posSessionId: input.posSessionId ?? null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdByUserId: input.actorUserId,
    updatedByUserId: null,
  });
}

export interface ReceivePaymentDependencies {
  readonly payments: PaymentRepository;
  readonly storeCredit: StoreCreditRepository;
  readonly summaries: PaymentSummaryRepository;
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly requestReaders: RequestReaderRegistry;
  readonly lifecycles?: RequestPaymentLifecycleRegistry | undefined;
  readonly unitOfWork: PaymentUnitOfWork;
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly timeZone: TimezoneReader;
  readonly orgConfig: OrgConfigService;
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

async function invokeBeginReceipt(
  lifecycle: RequestPaymentLifecycle,
  opts: {
    readonly organizationId: OrganizationId;
    readonly alloc: PaymentAllocation;
    readonly now: Date;
  },
): Promise<void> {
  try {
    await lifecycle.beginReceipt({
      organizationId: opts.organizationId,
      requestType: opts.alloc.requestType,
      requestId: opts.alloc.requestId,
      now: opts.now,
    });
  } catch (err: unknown) {
    if (err instanceof DomainRuleError && err.code === ERROR_CODE.NOT_FOUND) {
      throw paymentRequestNotFoundError(opts.alloc.requestId);
    }
    throw err;
  }
}

async function runLifecyclesBegin(
  lifecycles: RequestPaymentLifecycleRegistry | undefined,
  input: ReceivePaymentInput,
  now: Date,
): Promise<void> {
  if (!lifecycles) return;
  for (const alloc of input.allocations) {
    const lifecycle = lifecycles.get(alloc.requestType);
    if (!lifecycle) continue;
    await invokeBeginReceipt(lifecycle, {
      organizationId: input.organizationId,
      alloc,
      now,
    });
  }
}

async function runLifecyclesEnd(
  lifecycles: RequestPaymentLifecycleRegistry | undefined,
  input: ReceivePaymentInput,
  now: Date,
): Promise<void> {
  if (!lifecycles) return;
  for (const alloc of input.allocations) {
    const lifecycle = lifecycles.get(alloc.requestType);
    if (lifecycle) {
      await lifecycle.endReceipt({
        organizationId: input.organizationId,
        requestType: alloc.requestType,
        requestId: alloc.requestId,
        now,
      });
    }
  }
}

export class ReceivePaymentUseCase {
  constructor(private readonly dependencies: ReceivePaymentDependencies) {}

  async execute(input: ReceivePaymentInput): Promise<PaymentResponse> {
    const deps = this.dependencies;
    const { overpaymentAmount, businessDate, expiresAt, allocations, now } =
      await prepareReceiveContext(deps, input);

    return deps.unitOfWork.run(async () => {
      await runLifecyclesBegin(deps.lifecycles, input, now);
      await validateAllocationLimits(deps.requestReaders, deps.summaries, input);

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
      await runLifecyclesEnd(deps.lifecycles, input, now);
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
