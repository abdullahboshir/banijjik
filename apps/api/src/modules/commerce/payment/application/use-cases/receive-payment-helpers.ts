import {
  PAYMENT_METHOD,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
} from "@banijjik/contracts/payment";
import { asId, newId, type ContactId, type StoreCreditEntryId } from "@banijjik/ids";
import { PaymentSummary } from "../../domain/payment-summary.entity.js";
import { StoreCreditEntry } from "../../domain/store-credit-entry.entity.js";
import { computePaymentStatus } from "../../domain/payment-rules.js";
import {
  paymentAllocationsInvalidError,
  paymentReferenceTakenError,
  paymentRequestNotFoundError,
  storeCreditContactRequiredError,
  storeCreditInsufficientError,
} from "../../domain/errors.js";
import type {
  ContactStoreCreditPort,
  PaymentRepository,
  PaymentSummaryRepository,
  StoreCreditRepository,
} from "../ports/payment-repositories.js";
import type { RequestReaderRegistry } from "../ports/request-reader.js";
import type { ReceivePaymentInput } from "./receive-payment.use-case.js";

export async function validateMobileMoney(
  payments: PaymentRepository,
  input: ReceivePaymentInput,
): Promise<void> {
  const isMobile = input.method === PAYMENT_METHOD.BKASH || input.method === PAYMENT_METHOD.NAGAD;
  if (!isMobile) return;
  if (!input.externalReference || input.externalReference.trim().length === 0) {
    throw paymentAllocationsInvalidError("External reference required for mobile money");
  }
  const existing = await payments.findByReference(
    input.organizationId,
    input.method,
    input.externalReference.trim(),
  );
  if (existing) throw paymentReferenceTakenError(existing.paymentId);
}

export async function validateAllocationLimits(
  requestReaders: RequestReaderRegistry,
  summaries: PaymentSummaryRepository,
  input: ReceivePaymentInput,
): Promise<void> {
  for (const alloc of input.allocations) {
    const reader = requestReaders.get(alloc.requestType);
    if (!reader) {
      throw paymentAllocationsInvalidError(`Unregistered request type ${alloc.requestType}`);
    }
    const snapshot = await reader.read(input.organizationId, alloc.requestId);
    if (!snapshot) throw paymentRequestNotFoundError(alloc.requestId);
    if (snapshot.total.currency !== alloc.amount.currency) {
      throw paymentAllocationsInvalidError("Currency mismatch with request total");
    }
    const summary = await summaries.findByRequest(
      input.organizationId,
      alloc.requestType,
      alloc.requestId,
    );
    const netPaid = summary ? summary.allocated.amount - summary.refunded.amount : 0;
    if (netPaid + alloc.amount.amount > snapshot.total.amount) {
      throw paymentAllocationsInvalidError(
        `Allocation to ${alloc.requestId} exceeds request total`,
      );
    }
  }
}

export async function handleStoreCreditPayment(
  contactStoreCredit: ContactStoreCreditPort,
  input: ReceivePaymentInput,
): Promise<void> {
  if (input.method !== PAYMENT_METHOD.STORE_CREDIT) return;
  if (!input.contactId) throw storeCreditContactRequiredError();

  const contactId = asId<ContactId>(input.contactId);
  const bal = await contactStoreCredit.getBalance(input.organizationId, contactId);
  if (!bal || bal.balanceMinor < input.amount.amount) throw storeCreditInsufficientError();
  const result = await contactStoreCredit.adjustBalance({
    organizationId: input.organizationId,
    contactId,
    deltaMinor: -input.amount.amount,
    expectedVersion: bal.version,
  });
  if (!result.success) throw storeCreditInsufficientError();
}

export async function handleOverpayment(opts: {
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly storeCredit: StoreCreditRepository;
  readonly input: ReceivePaymentInput;
  readonly overpaymentAmount: number;
  readonly now: Date;
}): Promise<string | null> {
  const { contactStoreCredit, storeCredit, input, overpaymentAmount, now } = opts;
  if (overpaymentAmount <= 0 || !input.contactId) return null;
  const contactId = asId<ContactId>(input.contactId);
  const bal = await contactStoreCredit.getBalance(input.organizationId, contactId);
  const result = await contactStoreCredit.adjustBalance({
    organizationId: input.organizationId,
    contactId,
    deltaMinor: overpaymentAmount,
    expectedVersion: bal ? bal.version : 1,
  });

  const entryId = newId<StoreCreditEntryId>();
  await storeCredit.create(
    StoreCreditEntry.create({
      storeCreditEntryId: entryId,
      organizationId: input.organizationId,
      contactId,
      direction: STORE_CREDIT_DIRECTION.CREDIT,
      kind: STORE_CREDIT_ENTRY_KIND.PAYMENT_OVERPAYMENT,
      amount: { amount: overpaymentAmount, currency: input.amount.currency },
      paymentId: null,
      balanceAfterMinor: result.newBalanceMinor,
      note: "Overpayment added to store credit",
      expiresAt: null,
      createdAt: now,
      createdByUserId: input.actorUserId,
    }),
  );
  return entryId;
}

export async function updateSummaries(opts: {
  readonly summaries: PaymentSummaryRepository;
  readonly requestReaders: RequestReaderRegistry;
  readonly input: ReceivePaymentInput;
  readonly now: Date;
}): Promise<void> {
  const { summaries, requestReaders, input, now } = opts;
  for (const alloc of input.allocations) {
    const reader = requestReaders.get(alloc.requestType);
    if (!reader) continue;
    const snapshot = await reader.read(input.organizationId, alloc.requestId);
    if (!snapshot) continue;

    const existing = await summaries.findByRequest(
      input.organizationId,
      alloc.requestType,
      alloc.requestId,
    );
    const prevAllocated = existing ? existing.allocated.amount : 0;
    const prevRefunded = existing ? existing.refunded.amount : 0;
    const nextAllocated = prevAllocated + alloc.amount.amount;
    const nextStatus = computePaymentStatus(snapshot.total.amount, nextAllocated, prevRefunded);

    await summaries.upsert(
      PaymentSummary.create({
        organizationId: input.organizationId,
        requestType: alloc.requestType,
        requestId: alloc.requestId,
        contactId: input.contactId ?? snapshot.contactId,
        locationId: input.locationId ?? snapshot.locationId,
        total: snapshot.total,
        allocated: { amount: nextAllocated, currency: alloc.amount.currency },
        refunded: existing ? existing.refunded : { amount: 0, currency: alloc.amount.currency },
        paymentStatus: nextStatus,
        updatedAt: now,
      }),
    );
  }
}
