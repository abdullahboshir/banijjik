import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  PAYMENT_METHOD,
  PAYMENT_REFUND_MANAGER_WITHOUT_APPROVAL_SETTING_KEY,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
  type PaymentApprovalSnapshot,
} from "@banijjik/contracts/payment";
import { asId, newId, type ContactId, type StoreCreditEntryId } from "@banijjik/ids";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import { PaymentSummary } from "../../domain/payment-summary.entity.js";
import { StoreCreditEntry } from "../../domain/store-credit-entry.entity.js";
import { computePaymentStatus, validateRefundAllocations } from "../../domain/payment-rules.js";
import {
  paymentAllocationsInvalidError,
  paymentRequestNotFoundError,
  storeCreditContactRequiredError,
} from "../../domain/errors.js";
import type {
  ContactStoreCreditPort,
  PaymentSummaryRepository,
  StoreCreditRepository,
} from "../ports/payment-repositories.js";
import type { RequestReaderRegistry } from "../ports/request-reader.js";
import type { RefundPaymentInput } from "./refund-payment.use-case.js";

export async function isApprovalRequired(
  orgConfig: OrgConfigService | undefined,
  input: RefundPaymentInput,
): Promise<boolean> {
  let managerWithoutApproval = true;
  if (orgConfig) {
    try {
      const effective = await orgConfig.forOrganization(input.organizationId);
      const val = effective.config.settings[PAYMENT_REFUND_MANAGER_WITHOUT_APPROVAL_SETTING_KEY];
      if (typeof val === "boolean") managerWithoutApproval = val;
    } catch {
      // default true
    }
  }
  return !(input.isManagerOrOwner && managerWithoutApproval);
}

async function readCurrentPaidMap(
  requestReaders: RequestReaderRegistry,
  summaries: PaymentSummaryRepository,
  input: RefundPaymentInput,
): Promise<Map<string, number>> {
  const currentPaid = new Map<string, number>();
  for (const alloc of input.allocations) {
    const reader = requestReaders.get(alloc.requestType);
    if (!reader)
      throw paymentAllocationsInvalidError(`Unregistered request type ${alloc.requestType}`);
    const snapshot = await reader.read(input.organizationId, alloc.requestId);
    if (!snapshot) throw paymentRequestNotFoundError(alloc.requestId);

    const summary = await summaries.findByRequest(
      input.organizationId,
      alloc.requestType,
      alloc.requestId,
    );
    const netPaid = summary ? summary.allocated.amount - summary.refunded.amount : 0;
    currentPaid.set(alloc.requestId, netPaid);
  }
  return currentPaid;
}

export async function validateRefundRequests(
  requestReaders: RequestReaderRegistry,
  summaries: PaymentSummaryRepository,
  input: RefundPaymentInput,
): Promise<void> {
  if (input.allocations.length === 0) {
    throw paymentAllocationsInvalidError("Refund requires at least one allocation");
  }
  if (input.method === PAYMENT_METHOD.STORE_CREDIT && !input.contactId) {
    throw storeCreditContactRequiredError();
  }
  const isMobile = input.method === PAYMENT_METHOD.BKASH || input.method === PAYMENT_METHOD.NAGAD;
  if (isMobile && (!input.externalReference || input.externalReference.trim().length === 0)) {
    throw paymentAllocationsInvalidError("External reference required for mobile money");
  }

  const currentPaidByRequest = await readCurrentPaidMap(requestReaders, summaries, input);
  validateRefundAllocations({
    refundAmount: input.amount,
    allocations: input.allocations,
    currentPaidByRequest,
  });
}

export async function creditStoreCreditOnRefund(opts: {
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly storeCredit: StoreCreditRepository;
  readonly input: RefundPaymentInput;
  readonly now: Date;
}): Promise<string | null> {
  const { contactStoreCredit, storeCredit, input, now } = opts;
  if (input.method !== PAYMENT_METHOD.STORE_CREDIT || !input.contactId) return null;
  const contactId = asId<ContactId>(input.contactId);
  const contactBal = await contactStoreCredit.getBalance(input.organizationId, contactId);
  const version = contactBal ? contactBal.version : 1;
  const result = await contactStoreCredit.adjustBalance({
    organizationId: input.organizationId,
    contactId,
    deltaMinor: input.amount.amount,
    expectedVersion: version,
  });

  const entryId = newId<StoreCreditEntryId>();
  await storeCredit.create(
    StoreCreditEntry.create({
      storeCreditEntryId: entryId,
      organizationId: input.organizationId,
      contactId,
      direction: STORE_CREDIT_DIRECTION.CREDIT,
      kind: STORE_CREDIT_ENTRY_KIND.PAYMENT_OVERPAYMENT,
      amount: input.amount,
      paymentId: null,
      balanceAfterMinor: result.newBalanceMinor,
      note: "Refund to store credit",
      expiresAt: null,
      createdAt: now,
      createdByUserId: input.actorUserId,
    }),
  );
  return entryId;
}

export async function updateRefundSummaries(opts: {
  readonly summaries: PaymentSummaryRepository;
  readonly requestReaders: RequestReaderRegistry;
  readonly input: RefundPaymentInput;
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
    const allocatedAmount = existing ? existing.allocated.amount : 0;
    const nextRefunded = (existing ? existing.refunded.amount : 0) + alloc.amount.amount;
    const nextStatus = computePaymentStatus(snapshot.total.amount, allocatedAmount, nextRefunded);

    await summaries.upsert(
      PaymentSummary.create({
        organizationId: input.organizationId,
        requestType: alloc.requestType,
        requestId: alloc.requestId,
        contactId: input.contactId ?? snapshot.contactId,
        locationId: input.locationId ?? snapshot.locationId,
        total: snapshot.total,
        allocated: { amount: allocatedAmount, currency: alloc.amount.currency },
        refunded: { amount: nextRefunded, currency: alloc.amount.currency },
        paymentStatus: nextStatus,
        updatedAt: now,
      }),
    );
  }
}

export async function resolveRefundApproval(
  approvals: Pick<ApprovalVerifier, "consume">,
  needsApproval: boolean,
  input: RefundPaymentInput,
): Promise<PaymentApprovalSnapshot | null> {
  if (!needsApproval || !input.approvalToken) return null;
  const consumed = await approvals.consume(input.approvalToken, {
    action: APPROVAL_ACTION.REFUND,
    subjectKey: input.locationId,
    amount: input.amount,
  });
  return {
    approvalId: input.approvalToken.slice(0, 16),
    approverUserId: consumed.approverMemberId,
    approvedAt: consumed.approvedAt.toISOString(),
  };
}
