import { APPROVAL_ACTION } from "@banijjik/contracts/iam";
import {
  PAYMENT_METHOD,
  PAYMENT_REFUND_MANAGER_WITHOUT_APPROVAL_SETTING_KEY,
  STORE_CREDIT_DIRECTION,
  STORE_CREDIT_ENTRY_KIND,
  type PaymentAllocation,
  type PaymentApprovalSnapshot,
} from "@banijjik/contracts/payment";
import {
  asId,
  newId,
  type ContactId,
  type PaymentId,
  type StoreCreditEntryId,
} from "@banijjik/ids";
import type { ApprovalVerifier } from "../../../../core/iam/index.js";
import type { OrgConfigService } from "../../../../platform/entitlement/index.js";
import { StoreCreditEntry } from "../../domain/store-credit-entry.entity.js";
import { validateRefundAllocations } from "../../domain/payment-rules.js";
import {
  paymentAllocationsInvalidError,
  paymentRequestNotFoundError,
  storeCreditConflictError,
  storeCreditContactRequiredError,
  paymentRefundAboveLimitError,
} from "../../domain/errors.js";
import type {
  ContactStoreCreditPort,
  PaymentSummaryRepository,
  StoreCreditRepository,
} from "../ports/payment-repositories.js";
import type { RequestReaderRegistry } from "../ports/request-reader.js";
import type { RefundPaymentInput } from "./refund-payment.use-case.js";

export async function isApprovalRequired(
  orgConfig: OrgConfigService,
  hasRefundWithoutApprovalPermission: boolean,
  organizationId: import("@banijjik/ids").OrganizationId,
): Promise<boolean> {
  const effective = await orgConfig.forOrganization(organizationId);
  const val = effective.config.settings[PAYMENT_REFUND_MANAGER_WITHOUT_APPROVAL_SETTING_KEY];
  const managerWithoutApproval = typeof val === "boolean" ? val : true;
  return !(hasRefundWithoutApprovalPermission && managerWithoutApproval);
}

async function readCurrentPaidAndAllocations(
  requestReaders: RequestReaderRegistry,
  summaries: PaymentSummaryRepository,
  input: RefundPaymentInput,
): Promise<{
  readonly currentPaid: Map<string, number>;
  readonly allocations: readonly PaymentAllocation[];
}> {
  const currentPaid = new Map<string, number>();
  const allocations: PaymentAllocation[] = [];
  for (const alloc of input.allocations) {
    const reader = requestReaders.get(alloc.requestType);
    if (!reader)
      throw paymentAllocationsInvalidError(`Unregistered request type ${alloc.requestType}`);
    const snapshot = await reader.read(input.organizationId, alloc.requestId);
    if (!snapshot) throw paymentRequestNotFoundError(alloc.requestId);
    if (snapshot.refundLimit && snapshot.refundLimit.currency !== alloc.amount.currency)
      throw paymentAllocationsInvalidError("Currency mismatch with refund limit");
    if (
      snapshot.refundLimit &&
      alloc.amount.currency === snapshot.refundLimit.currency &&
      alloc.amount.amount > snapshot.refundLimit.amount
    ) {
      throw paymentRefundAboveLimitError(alloc.requestId, snapshot.refundLimit);
    }

    const summary = await summaries.findByRequest(
      input.organizationId,
      alloc.requestType,
      alloc.requestId,
    );
    const netPaid = summary ? summary.allocated.amount - summary.refunded.amount : 0;
    currentPaid.set(alloc.requestId, netPaid);
    allocations.push({
      ...alloc,
      revenueState: snapshot.revenueState,
    });
  }
  return { currentPaid, allocations };
}

export async function validateRefundRequests(
  requestReaders: RequestReaderRegistry,
  summaries: PaymentSummaryRepository,
  input: RefundPaymentInput,
): Promise<readonly PaymentAllocation[]> {
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

  const { currentPaid: currentPaidByRequest, allocations } = await readCurrentPaidAndAllocations(
    requestReaders,
    summaries,
    input,
  );
  validateRefundAllocations({
    refundAmount: input.amount,
    allocations,
    currentPaidByRequest,
  });
  return allocations;
}

export async function creditStoreCreditOnRefund(opts: {
  readonly contactStoreCredit: ContactStoreCreditPort;
  readonly storeCredit: StoreCreditRepository;
  readonly input: RefundPaymentInput;
  readonly paymentId: PaymentId;
  readonly expiresAt: Date | null;
  readonly now: Date;
}): Promise<string | null> {
  const { contactStoreCredit, storeCredit, input, paymentId, expiresAt, now } = opts;
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
  if (!result.success) throw storeCreditConflictError();

  const entryId = newId<StoreCreditEntryId>();
  await storeCredit.create(
    StoreCreditEntry.create({
      storeCreditEntryId: entryId,
      organizationId: input.organizationId,
      contactId,
      direction: STORE_CREDIT_DIRECTION.CREDIT,
      kind: STORE_CREDIT_ENTRY_KIND.PAYMENT_REFUND,
      amount: input.amount,
      paymentId,
      balanceAfterMinor: result.newBalanceMinor,
      note: "Refund to store credit",
      expiresAt,
      expiresStoreCreditEntryId: null,
      createdAt: now,
      createdByUserId: input.actorUserId,
    }),
  );
  return entryId;
}

export async function updateRefundSummaries(opts: {
  readonly summaries: PaymentSummaryRepository;
  readonly input: RefundPaymentInput;
  readonly now: Date;
}): Promise<void> {
  const { summaries, input, now } = opts;
  for (const alloc of input.allocations) {
    await summaries.applyRefund({
      organizationId: input.organizationId,
      requestType: alloc.requestType,
      requestId: alloc.requestId,
      amount: alloc.amount.amount,
      now,
    });
  }
}

export async function resolveRefundApproval(
  approvals: Pick<ApprovalVerifier, "consume">,
  needsApproval: boolean,
  input: RefundPaymentInput,
): Promise<PaymentApprovalSnapshot | null> {
  if (input.approvalSnapshot) return input.approvalSnapshot;
  if (!needsApproval || !input.approvalToken) return null;
  const consumed = await approvals.consume(input.approvalToken, {
    action: APPROVAL_ACTION.REFUND,
    subjectKey: input.locationId,
    amount: input.amount,
  });
  return {
    approvalId: consumed.approvalTokenId,
    approverMemberId: consumed.approverMemberId,
    approvedAt: consumed.approvedAt.toISOString(),
  };
}
