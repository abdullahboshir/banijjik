import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { BOOKING_TERMINATION_MODE, CANCEL_FEE_MODE } from "@banijjik/contracts/booking";
import { type Money, PAYMENT_METHOD, PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { SALES_RULE_KEY } from "@banijjik/contracts/sales";
import { asId, type OrganizationId, type OrderId } from "@banijjik/ids";
import type { AuditRecorder } from "../kernel/audit/index.js";
import { getRequestContext } from "../kernel/context/index.js";
import { kernelEventPublisher } from "../kernel/events/index.js";
import type { Clock } from "../kernel/time/index.js";
import {
  buildRefundPaymentUseCase,
  findStoreCreditEntryIdOfPayment,
  MongoContactStoreCreditAdapter,
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
  MongoStoreCreditRepository,
  settleRequestTermination,
  type RefundPaymentUseCase,
} from "../modules/commerce/payment/index.js";
import type {
  OrderPaymentPort,
  PaymentTotals,
  ReturnSettlementResult,
  SettleReturnInput,
} from "../modules/commerce/sales/index.js";
import type { OrgConfigService } from "../modules/platform/entitlement/index.js";
import {
  buildOrganizationCurrencyReader,
  buildOrganizationTimezoneReader,
} from "../modules/core/organization/index.js";
import { buildApprovalVerifier } from "../modules/core/iam/index.js";
import { buildPaymentRequestReaders } from "./payment-request-readers.js";

function activeOrganizationId(): OrganizationId {
  const { organizationId } = getRequestContext();
  if (!organizationId) throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
  return asId<OrganizationId>(organizationId);
}

function ruleError(ruleKey: string, messageKey: string): DomainRuleError {
  return new DomainRuleError({ code: ERROR_CODE.BUSINESS_RULE, messageKey, details: { ruleKey } });
}

/** All repository calls join the caller's active Mongo session. */
class OrderPaymentAdapter implements OrderPaymentPort {
  constructor(private readonly refunds: RefundPaymentUseCase) {}

  private readonly summaries = new MongoPaymentSummaryRepository();
  private readonly currencies = buildOrganizationCurrencyReader();
  private readonly timezones = buildOrganizationTimezoneReader();

  async initializeSummary(
    input: Parameters<OrderPaymentPort["initializeSummary"]>[0],
  ): Promise<void> {
    await this.summaries.ensureSummary({
      ...input,
      requestType: PAYMENT_REQUEST_TYPE.ORDER,
      requestId: input.orderId,
    });
  }

  async updateContact(input: Parameters<OrderPaymentPort["updateContact"]>[0]): Promise<void> {
    const paid = await this.readNetPaid(input);
    if (paid.amount > 0) {
      throw ruleError(
        SALES_RULE_KEY.ORDER_CONTACT_LOCKED_BY_PAYMENT,
        "errors.order_contact_locked_by_payment",
      );
    }
    await this.summaries.setContact({
      ...input,
      requestType: PAYMENT_REQUEST_TYPE.ORDER,
      requestId: input.orderId,
    });
  }

  async updateTotal(input: Parameters<OrderPaymentPort["updateTotal"]>[0]): Promise<void> {
    const paid = await this.readNetPaid(input);
    if (paid.currency !== input.total.currency || input.total.amount < paid.amount) {
      throw ruleError(SALES_RULE_KEY.ORDER_TOTAL_BELOW_PAID, "errors.order_total_below_paid");
    }
    await this.summaries.setTotal({
      ...input,
      requestType: PAYMENT_REQUEST_TYPE.ORDER,
      requestId: input.orderId,
    });
  }

  async readTotals(orderId: OrderId): Promise<PaymentTotals> {
    const summary = await this.summaries.findByRequest(
      activeOrganizationId(),
      PAYMENT_REQUEST_TYPE.ORDER,
      orderId,
    );
    return {
      paidMinor: summary?.allocated.amount ?? 0,
      refundedMinor: summary?.refunded.amount ?? 0,
    };
  }

  async readTotalsMany(orderIds: readonly OrderId[]): Promise<ReadonlyMap<OrderId, PaymentTotals>> {
    const rows = await this.summaries.findByRequests(
      activeOrganizationId(),
      PAYMENT_REQUEST_TYPE.ORDER,
      orderIds,
    );
    return new Map(
      rows.map((row) => [
        asId<OrderId>(row.requestId),
        { paidMinor: row.allocated.amount, refundedMinor: row.refunded.amount },
      ]),
    );
  }

  async readNetPaid(input: Parameters<OrderPaymentPort["readNetPaid"]>[0]): Promise<Money> {
    const summary = await this.summaries.findByRequest(
      input.organizationId,
      PAYMENT_REQUEST_TYPE.ORDER,
      input.orderId,
    );
    if (summary)
      return {
        amount: summary.allocated.amount - summary.refunded.amount,
        currency: summary.total.currency,
      };
    const currency = await this.currencies.read(input.organizationId);
    if (!currency) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    return { amount: 0, currency };
  }

  async readSettlementBase(
    input: Parameters<OrderPaymentPort["readSettlementBase"]>[0],
  ): Promise<{ readonly totalMinor: number; readonly netPaidMinor: number }> {
    const summary = await this.summaries.findByRequest(
      input.organizationId,
      PAYMENT_REQUEST_TYPE.ORDER,
      input.orderId,
    );
    if (!summary) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    return {
      totalMinor: summary.total.amount,
      netPaidMinor: summary.allocated.amount - summary.refunded.amount,
    };
  }

  /**
   * The total drops first, then the refund goes out (plan 3.5b decision 5). Both writes join the
   * return's transaction, so a failed refund also keeps the total as it was.
   */
  async settleReturn(input: SettleReturnInput): Promise<ReturnSettlementResult> {
    const currency = input.currency;
    await this.summaries.setTotal({
      organizationId: input.organizationId,
      requestType: PAYMENT_REQUEST_TYPE.ORDER,
      requestId: input.orderId,
      total: { amount: input.newTotalMinor, currency },
      now: input.now,
    });
    const refund = input.refund;
    if (refund === null || refund.amountMinor === 0) {
      return { paymentId: null, storeCreditEntryId: null };
    }
    const amount = { amount: refund.amountMinor, currency };
    const payment = await this.refunds.execute({
      organizationId: input.organizationId,
      locationId: input.locationId,
      method: refund.method,
      amount,
      externalReference: refund.externalReference,
      allocations: [{ requestType: PAYMENT_REQUEST_TYPE.ORDER, requestId: input.orderId, amount }],
      contactId: refund.contactId,
      receivedByMemberId: input.receivedByMemberId,
      actorUserId: input.actorUserId,
      hasRefundWithoutApprovalPermission: refund.hasRefundWithoutApprovalPermission,
      ...(refund.approval === null ? {} : { approvalSnapshot: refund.approval }),
      note: refund.note,
    });
    const storeCreditEntryId =
      refund.method === PAYMENT_METHOD.STORE_CREDIT
        ? await findStoreCreditEntryIdOfPayment(input.organizationId, payment.paymentId)
        : null;
    return { paymentId: payment.paymentId, storeCreditEntryId };
  }

  async settleCancellation(
    input: Parameters<OrderPaymentPort["settleCancellation"]>[0],
  ): Promise<void> {
    const paid = await this.readNetPaid(input);
    if (paid.amount <= 0) {
      await this.summaries.closeAtTotal({
        organizationId: input.organizationId,
        requestType: PAYMENT_REQUEST_TYPE.ORDER,
        requestId: input.orderId,
        total: { amount: 0, currency: paid.currency },
        now: input.now,
      });
      return;
    }
    if (input.contactId === null)
      throw ruleError(
        SALES_RULE_KEY.ORDER_CANCEL_NEEDS_CONTACT,
        "errors.order_cancel_needs_contact",
      );
    await settleRequestTermination(
      {
        summaries: this.summaries,
        payments: new MongoPaymentRepository(),
        storeCredits: new MongoStoreCreditRepository(),
        contactStoreCredit: new MongoContactStoreCreditAdapter(),
        events: kernelEventPublisher,
        timeZone: {
          read: async (organizationId) => {
            const timezone = await this.timezones.read(organizationId);
            if (!timezone) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
            return timezone;
          },
        },
      },
      {
        ...input,
        contactId: input.contactId,
        requestId: input.orderId,
        requestType: PAYMENT_REQUEST_TYPE.ORDER,
        startsAt: input.now,
        depositRequired: paid,
        priceTotal: paid,
        mode: BOOKING_TERMINATION_MODE.CANCEL,
        freeCancelHours: 0,
        feeMode: CANCEL_FEE_MODE.NONE,
        feePercent: 0,
      },
    );
  }
}

export interface OrderPaymentAdapterDependencies {
  readonly orgConfig: OrgConfigService;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
}

export function buildOrderPaymentAdapter(
  dependencies: OrderPaymentAdapterDependencies,
): OrderPaymentPort {
  const timezones = buildOrganizationTimezoneReader();
  const refunds = buildRefundPaymentUseCase({
    requestReaders: buildPaymentRequestReaders(),
    approvals: buildApprovalVerifier({ audit: dependencies.audit, clock: dependencies.clock }),
    orgConfig: dependencies.orgConfig,
    audit: dependencies.audit,
    clock: dependencies.clock,
    timeZone: {
      read: async (organizationId: OrganizationId) => {
        const timezone = await timezones.read(organizationId);
        if (!timezone) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
        return timezone;
      },
    },
  });
  return new OrderPaymentAdapter(refunds);
}
