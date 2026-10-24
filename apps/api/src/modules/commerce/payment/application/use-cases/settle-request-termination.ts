import {
  PAYMENT_DIRECTION,
  PAYMENT_EVENT_TYPE,
  PAYMENT_METHOD,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
  type Money,
  type PaymentRequestType,
} from "@banijjik/contracts/payment";
import {
  BOOKING_TERMINATION_MODE,
  CANCEL_FEE_MODE,
  type BookingTerminationMode,
  type CancelFeeMode,
} from "@banijjik/contracts/booking";
import { SEQUENCE_KEY } from "@banijjik/contracts";
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
import { nextSequenceValue } from "../../../../../kernel/sequence/index.js";
import { recordNotFound, storeCreditConflictError } from "../../domain/errors.js";
import { Payment } from "../../domain/payment.entity.js";
import { StoreCreditEntry } from "../../domain/store-credit-entry.entity.js";
import { businessDateOf } from "../../domain/timezone.js";
import type {
  ContactStoreCreditPort,
  PaymentRepository,
  PaymentSummaryRepository,
  StoreCreditRepository,
  TimezoneReader,
} from "../ports/payment-repositories.js";

export interface SettleRequestTerminationDependencies {
  readonly payments: PaymentRepository;
  readonly storeCredits: StoreCreditRepository;
  readonly summaries: PaymentSummaryRepository;
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly events: {
    publish(eventType: string, payload: unknown, options?: { orderingKey?: string }): Promise<void>;
  };
  readonly timeZone: TimezoneReader;
}

export interface SettleRequestTerminationInput {
  readonly organizationId: OrganizationId;
  readonly requestId: string;
  readonly requestType: PaymentRequestType;
  readonly contactId: ContactId;
  readonly locationId: LocationId;
  readonly startsAt: Date;
  readonly depositRequired: Money;
  readonly priceTotal: Money;
  readonly mode: BookingTerminationMode;
  readonly freeCancelHours: number;
  readonly feeMode: CancelFeeMode;
  readonly feePercent: number;
  readonly actorUserId: UserId | null;
  readonly now: Date;
}

function computeTerminationFeeAmount(
  netPaidAmount: number,
  input: SettleRequestTerminationInput,
): number {
  if (netPaidAmount <= 0) return 0;
  if (input.mode === BOOKING_TERMINATION_MODE.CANCEL) {
    const msUntilStart = input.startsAt.getTime() - input.now.getTime();
    const freeWindowMs = Math.max(0, input.freeCancelHours) * 3_600_000;
    if (msUntilStart >= freeWindowMs) return 0;
  }
  if (input.feeMode === CANCEL_FEE_MODE.NONE) return 0;
  if (input.feeMode === CANCEL_FEE_MODE.PERCENT) {
    const percent = Math.min(100, Math.max(0, input.feePercent));
    if (percent === 0) return 0;
    const cap = Math.floor((input.priceTotal.amount * percent) / 100);
    return Math.min(netPaidAmount, cap);
  }
  const cap = input.depositRequired.amount > 0 ? input.depositRequired.amount : netPaidAmount;
  return Math.min(netPaidAmount, cap);
}

function buildTerminationRefundPayment(opts: {
  readonly input: SettleRequestTerminationInput;
  readonly creditAmount: number;
  readonly seq: number;
  readonly timeZone: string;
}): Payment {
  const { input, creditAmount, seq, timeZone } = opts;
  const { currency } = input.priceTotal;
  const requestLabel = input.requestType.charAt(0) + input.requestType.slice(1).toLowerCase();
  const note =
    input.mode === BOOKING_TERMINATION_MODE.CANCEL
      ? `${requestLabel} cancellation credit`
      : `${requestLabel} no-show credit`;
  return Payment.create({
    paymentId: asId<PaymentId>(newId()),
    organizationId: input.organizationId,
    locationId: input.locationId,
    paymentNumber: `PAY-${String(seq).padStart(5, "0")}`,
    direction: PAYMENT_DIRECTION.REFUND,
    method: PAYMENT_METHOD.STORE_CREDIT,
    amount: { amount: creditAmount, currency },
    contactId: input.contactId,
    allocations: [
      {
        requestType: input.requestType,
        requestId: input.requestId,
        amount: { amount: creditAmount, currency },
        revenueState: "BEFORE_REVENUE",
      },
    ],
    externalReference: null,
    reversesPaymentId: null,
    receivedByMemberId: input.actorUserId ?? "system",
    approval: null,
    businessDate: businessDateOf(input.now, timeZone),
    note,
    version: 1,
    createdAt: input.now,
    updatedAt: input.now,
    createdByUserId: input.actorUserId,
    updatedByUserId: input.actorUserId,
  });
}

async function creditRefundForTermination(
  deps: SettleRequestTerminationDependencies,
  input: SettleRequestTerminationInput,
  creditAmount: number,
): Promise<void> {
  await deps.summaries.applyRefund({
    organizationId: input.organizationId,
    requestType: input.requestType,
    requestId: input.requestId,
    amount: creditAmount,
    now: input.now,
  });
  const seq = await nextSequenceValue({
    organizationId: input.organizationId,
    sequenceKey: SEQUENCE_KEY.PAYMENT,
  });
  const timeZone = await deps.timeZone.read(input.organizationId);
  const payment = buildTerminationRefundPayment({ input, creditAmount, seq, timeZone });
  await deps.payments.create(payment);

  const bal = await deps.contactStoreCredit.getBalance(input.organizationId, input.contactId);
  if (!bal) throw recordNotFound();
  const adjusted = await deps.contactStoreCredit.adjustBalance({
    organizationId: input.organizationId,
    contactId: input.contactId,
    deltaMinor: creditAmount,
    expectedVersion: bal.version,
  });
  if (!adjusted.success) throw storeCreditConflictError();

  const entry = StoreCreditEntry.create({
    storeCreditEntryId: asId<StoreCreditEntryId>(newId()),
    organizationId: input.organizationId,
    contactId: input.contactId,
    kind: STORE_CREDIT_ENTRY_KIND.CANCELLATION,
    direction: STORE_CREDIT_DIRECTION.CREDIT,
    amount: { amount: creditAmount, currency: input.priceTotal.currency },
    balanceAfterMinor: adjusted.newBalanceMinor,
    paymentId: payment.paymentId,
    expiresAt: null,
    expiresStoreCreditEntryId: null,
    note: payment.note,
    createdAt: input.now,
    createdByUserId: input.actorUserId,
  });
  await deps.storeCredits.create(entry);

  const orderingKey = `paymentAccount:${input.organizationId}`;
  await deps.events.publish(
    PAYMENT_EVENT_TYPE.PAYMENT_REFUNDED,
    { paymentId: payment.paymentId },
    { orderingKey },
  );
  await deps.events.publish(
    PAYMENT_EVENT_TYPE.STORE_CREDIT_CHANGED,
    { storeCreditEntryId: entry.storeCreditEntryId },
    { orderingKey },
  );
}

export async function settleRequestTermination(
  deps: SettleRequestTerminationDependencies,
  input: SettleRequestTerminationInput,
): Promise<{ readonly feeRetained: Money | null }> {
  const { currency } = input.priceTotal;
  const summary = await deps.summaries.findByRequest(
    input.organizationId,
    input.requestType,
    input.requestId,
  );
  const netPaidAmount = summary
    ? Math.max(0, summary.allocated.amount - summary.refunded.amount)
    : 0;
  const feeAmount = computeTerminationFeeAmount(netPaidAmount, input);
  const creditAmount = Math.max(0, netPaidAmount - feeAmount);

  if (creditAmount > 0) {
    await creditRefundForTermination(deps, input, creditAmount);
  }
  await deps.summaries.setTotal({
    organizationId: input.organizationId,
    requestType: input.requestType,
    requestId: input.requestId,
    total: { amount: feeAmount, currency },
    now: input.now,
  });
  return {
    feeRetained: feeAmount > 0 ? { amount: feeAmount, currency } : null,
  };
}
