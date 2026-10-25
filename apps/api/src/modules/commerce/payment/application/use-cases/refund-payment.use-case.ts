import { AUDIT_ACTION, AUDIT_ENTITY_TYPE, SEQUENCE_KEY } from "@banijjik/contracts";
import {
  PAYMENT_DIRECTION,
  PAYMENT_EVENT_TYPE,
  PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY,
  type Money,
  type PaymentAllocation,
  type PaymentApprovalSnapshot,
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
import type { ApprovalVerifier } from "../../../../core/iam/index.js";
import { Payment } from "../../domain/payment.entity.js";
import { paymentApprovalRequiredError, paymentContactNotFoundError } from "../../domain/errors.js";
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
  readonly hasRefundWithoutApprovalPermission: boolean;
  readonly approvalToken?: string | undefined;
  /**
   * Internal only (plan 3.5b amendment 1): a REFUND approval the caller already verified and consumed
   * for its own subject (a sales return). Never set from an HTTP body; the validation schema refuses it.
   */
  readonly approvalSnapshot?: PaymentApprovalSnapshot | undefined;
  /** Internal only (card 3.9 A2-4): set by POS returns, never from `POST /refunds`. */
  readonly posSessionId?: string | null;
  readonly note?: string | null;
}

function buildRefundPayment(opts: {
  readonly input: RefundPaymentInput;
  readonly paymentId: PaymentId;
  readonly businessDate: string;
  readonly approvalSnapshot: PaymentApprovalSnapshot | null;
  readonly seq: number;
  readonly now: Date;
}): Payment {
  const { input, paymentId, businessDate, approvalSnapshot, seq, now } = opts;
  return Payment.create({
    paymentId,
    organizationId: input.organizationId,
    locationId: input.locationId,
    paymentNumber: formatPaymentNumber(seq),
    direction: PAYMENT_DIRECTION.REFUND,
    method: input.method,
    amount: input.amount,
    externalReference: input.externalReference?.trim() || null,
    reversesPaymentId: null,
    allocations: input.allocations,
    writeOffs: [],
    contactId: input.contactId || null,
    receivedByMemberId: input.receivedByMemberId,
    businessDate,
    posSessionId: input.posSessionId ?? null,
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
  readonly timeZone: TimezoneReader;
  readonly orgConfig: OrgConfigService;
}

async function resolveRefundExpiryDate(
  orgConfig: OrgConfigService,
  organizationId: OrganizationId,
  now: Date,
): Promise<Date | null> {
  const effective = await orgConfig.forOrganization(organizationId);
  const val = effective.config.settings[PAYMENT_STORE_CREDIT_EXPIRY_DAYS_SETTING_KEY];
  const days = typeof val === "number" && val > 0 ? val : null;
  return days ? new Date(now.getTime() + days * 24 * 60 * 60 * 1000) : null;
}

async function prepareRefundContext(deps: RefundPaymentDependencies, input: RefundPaymentInput) {
  if (input.contactId) {
    const exists = await deps.contactStoreCredit.contactExists(
      input.organizationId,
      asId<ContactId>(input.contactId),
    );
    if (!exists) throw paymentContactNotFoundError(input.contactId);
  }
  const needsApproval = await isApprovalRequired(
    deps.orgConfig,
    input.hasRefundWithoutApprovalPermission,
    input.organizationId,
  );
  if (needsApproval && !input.approvalToken && !input.approvalSnapshot) {
    throw paymentApprovalRequiredError();
  }
  const timeZone = await deps.timeZone.read(input.organizationId);
  const now = deps.clock.now();
  const businessDate = businessDateOf(now, timeZone);
  const expiresAt = await resolveRefundExpiryDate(deps.orgConfig, input.organizationId, now);
  return { needsApproval, now, businessDate, expiresAt };
}

export class RefundPaymentUseCase {
  constructor(private readonly dependencies: RefundPaymentDependencies) {}

  async execute(input: RefundPaymentInput): Promise<PaymentResponse> {
    const deps = this.dependencies;
    const { needsApproval, now, businessDate, expiresAt } = await prepareRefundContext(deps, input);

    return deps.unitOfWork.run(async () => {
      const enrichedAllocations = await validateRefundRequests(
        deps.requestReaders,
        deps.summaries,
        input,
      );
      const enrichedInput: RefundPaymentInput = { ...input, allocations: enrichedAllocations };
      const approvalSnapshot = await resolveRefundApproval(
        deps.approvals,
        needsApproval,
        enrichedInput,
      );
      const paymentId = newId<PaymentId>();
      const creditEntryId = await creditStoreCreditOnRefund({
        contactStoreCredit: deps.contactStoreCredit,
        storeCredit: deps.storeCredit,
        input: enrichedInput,
        paymentId,
        expiresAt,
        now,
      });

      const seq = await nextSequenceValue({
        sequenceKey: SEQUENCE_KEY.PAYMENT,
        organizationId: input.organizationId,
      });
      const payment = buildRefundPayment({
        input: enrichedInput,
        paymentId,
        businessDate,
        approvalSnapshot,
        seq,
        now,
      });

      await deps.payments.create(payment);
      await updateRefundSummaries({ summaries: deps.summaries, input: enrichedInput, now });
      await publishRefundEffects({
        events: deps.events,
        audit: deps.audit,
        input: enrichedInput,
        paymentId,
        creditEntryId,
      });

      return toPaymentResponse(payment);
    });
  }
}
