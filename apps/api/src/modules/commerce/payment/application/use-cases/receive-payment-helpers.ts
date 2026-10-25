import {
  PAYMENT_METHOD,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
} from "@banijjik/contracts/payment";
import {
  asId,
  newId,
  type ContactId,
  type PaymentId,
  type StoreCreditEntryId,
} from "@banijjik/ids";
import { StoreCreditEntry } from "../../domain/store-credit-entry.entity.js";
import {
  paymentAllocationsInvalidError,
  paymentReferenceTakenError,
  paymentRequestNotFoundError,
  storeCreditConflictError,
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
    if (!snapshot.acceptsPayments) throw paymentRequestNotFoundError(alloc.requestId);
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

export async function handleStoreCreditPayment(opts: {
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly storeCredit: StoreCreditRepository;
  readonly input: ReceivePaymentInput;
  readonly paymentId: PaymentId;
  readonly now: Date;
}): Promise<string | null> {
  const { contactStoreCredit, storeCredit, input, paymentId, now } = opts;
  if (input.method !== PAYMENT_METHOD.STORE_CREDIT) return null;
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

  const entryId = newId<StoreCreditEntryId>();
  await storeCredit.create(
    StoreCreditEntry.create({
      storeCreditEntryId: entryId,
      organizationId: input.organizationId,
      contactId,
      direction: STORE_CREDIT_DIRECTION.DEBIT,
      kind: STORE_CREDIT_ENTRY_KIND.PAYMENT_USE,
      amount: input.amount,
      paymentId,
      balanceAfterMinor: result.newBalanceMinor,
      note: "Store credit payment",
      expiresAt: null,
      expiresStoreCreditEntryId: null,
      createdAt: now,
      createdByUserId: input.actorUserId,
    }),
  );
  return entryId;
}

export async function handleOverpayment(opts: {
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly storeCredit: StoreCreditRepository;
  readonly input: ReceivePaymentInput;
  readonly paymentId: PaymentId;
  readonly overpaymentAmount: number;
  readonly expiresAt: Date | null;
  readonly now: Date;
}): Promise<string | null> {
  const { contactStoreCredit, storeCredit, input, paymentId, overpaymentAmount, expiresAt, now } =
    opts;
  if (overpaymentAmount <= 0 || !input.contactId) return null;
  const contactId = asId<ContactId>(input.contactId);
  const bal = await contactStoreCredit.getBalance(input.organizationId, contactId);
  const result = await contactStoreCredit.adjustBalance({
    organizationId: input.organizationId,
    contactId,
    deltaMinor: overpaymentAmount,
    expectedVersion: bal ? bal.version : 1,
  });
  if (!result.success) throw storeCreditConflictError();

  const entryId = newId<StoreCreditEntryId>();
  await storeCredit.create(
    StoreCreditEntry.create({
      storeCreditEntryId: entryId,
      organizationId: input.organizationId,
      contactId,
      direction: STORE_CREDIT_DIRECTION.CREDIT,
      kind: STORE_CREDIT_ENTRY_KIND.PAYMENT_OVERPAYMENT,
      amount: { amount: overpaymentAmount, currency: input.amount.currency },
      paymentId,
      balanceAfterMinor: result.newBalanceMinor,
      note: "Overpayment added to store credit",
      expiresAt,
      expiresStoreCreditEntryId: null,
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
    const snapshot = reader ? await reader.read(input.organizationId, alloc.requestId) : undefined;
    await summaries.applyAllocation({
      organizationId: input.organizationId,
      locationId: input.locationId,
      requestType: alloc.requestType,
      requestId: alloc.requestId,
      contactId: input.contactId ?? snapshot?.contactId ?? null,
      total: snapshot ? snapshot.total : alloc.amount,
      amount: alloc.amount.amount,
      currency: alloc.amount.currency,
      now,
    });
  }
}
