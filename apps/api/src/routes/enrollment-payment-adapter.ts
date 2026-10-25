import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { PAYMENT_REQUEST_TYPE, type Money } from "@banijjik/contracts/payment";
import { asId, type LocationId, type OrganizationId, type PaymentId } from "@banijjik/ids";
import { getRequestContext } from "../kernel/context/index.js";
import {
  MongoPaymentRepository,
  MongoPaymentSummaryRepository,
} from "../modules/commerce/payment/index.js";
import type { EnrollmentPaymentPort } from "../modules/commerce/enrollment/index.js";
import { buildOrganizationCurrencyReader } from "../modules/core/organization/index.js";

function activeOrganizationId(): OrganizationId {
  const { organizationId } = getRequestContext();
  if (!organizationId) throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
  return asId<OrganizationId>(organizationId);
}

/** All repository calls join the caller's active Mongo session (via the payment repositories). */
class EnrollmentPaymentAdapter implements EnrollmentPaymentPort {
  private readonly summaries = new MongoPaymentSummaryRepository();
  private readonly payments = new MongoPaymentRepository();
  private readonly currencies = buildOrganizationCurrencyReader();

  async initializeSummary(
    input: Parameters<EnrollmentPaymentPort["initializeSummary"]>[0],
  ): Promise<void> {
    await this.summaries.ensureSummary({
      organizationId: asId<OrganizationId>(input.organizationId),
      locationId: asId<LocationId>(input.locationId),
      requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
      requestId: input.enrollmentPeriodId,
      contactId: input.contactId,
      total: input.fee,
      now: input.now,
    });
  }

  /** Inside the revenue transaction: creates the summary if missing, then writes the total (ADR-138 R3). */
  async touchForRevenue(
    input: Parameters<EnrollmentPaymentPort["touchForRevenue"]>[0],
  ): Promise<void> {
    const organizationId = asId<OrganizationId>(input.organizationId);
    const requestType = PAYMENT_REQUEST_TYPE.ENROLLMENT;
    await this.summaries.ensureSummary({
      organizationId,
      locationId: asId<LocationId>(input.locationId),
      requestType,
      requestId: input.enrollmentPeriodId,
      contactId: input.contactId,
      total: input.total,
      now: input.now,
    });
    await this.summaries.setTotal({
      organizationId,
      requestType,
      requestId: input.enrollmentPeriodId,
      total: input.total,
      now: input.now,
    });
  }

  async readNetPaid(input: Parameters<EnrollmentPaymentPort["readNetPaid"]>[0]): Promise<Money> {
    const summary = await this.summaries.findByRequest(
      asId<OrganizationId>(input.organizationId),
      PAYMENT_REQUEST_TYPE.ENROLLMENT,
      input.enrollmentPeriodId,
    );
    if (summary) {
      return {
        amount: summary.allocated.amount - summary.refunded.amount,
        currency: summary.total.currency,
      };
    }
    const currency = await this.currencies.read(asId<OrganizationId>(input.organizationId));
    if (!currency) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    return { amount: 0, currency };
  }

  async readRefunded(input: Parameters<EnrollmentPaymentPort["readRefunded"]>[0]): Promise<Money> {
    const summary = await this.summaries.findByRequest(
      asId<OrganizationId>(input.organizationId),
      PAYMENT_REQUEST_TYPE.ENROLLMENT,
      input.enrollmentPeriodId,
    );
    if (summary) return summary.refunded;
    const currency = await this.currencies.read(asId<OrganizationId>(input.organizationId));
    if (!currency) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    return { amount: 0, currency };
  }

  async readRefundedMany(
    organizationId: string,
    enrollmentPeriodIds: readonly string[],
  ): Promise<ReadonlyMap<string, Money>> {
    const summaries = await this.summaries.findByRequests(
      asId<OrganizationId>(organizationId),
      PAYMENT_REQUEST_TYPE.ENROLLMENT,
      enrollmentPeriodIds,
    );
    return new Map(summaries.map((summary) => [summary.requestId, summary.refunded]));
  }

  async capTotalAtNetPaid(
    input: Parameters<EnrollmentPaymentPort["capTotalAtNetPaid"]>[0],
  ): Promise<void> {
    const summary = await this.summaries.findByRequest(
      asId<OrganizationId>(input.organizationId),
      PAYMENT_REQUEST_TYPE.ENROLLMENT,
      input.enrollmentPeriodId,
    );
    if (!summary) return;
    const netPaid = summary.allocated.amount - summary.refunded.amount;
    // A fully paid period is closed at its current total, so a later reversal sees a closed request.
    const closedTotal = Math.min(summary.total.amount, netPaid);
    await this.summaries.closeAtTotal({
      organizationId: asId<OrganizationId>(input.organizationId),
      requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
      requestId: input.enrollmentPeriodId,
      total: { amount: closedTotal, currency: summary.total.currency },
      now: input.now,
    });
  }

  async listPeriodIdsOfPayment(paymentId: string): Promise<readonly string[]> {
    const payment = await this.payments.findById(
      activeOrganizationId(),
      asId<PaymentId>(paymentId),
    );
    if (!payment) return [];
    return payment.allocations
      .filter((allocation) => allocation.requestType === PAYMENT_REQUEST_TYPE.ENROLLMENT)
      .map((allocation) => allocation.requestId);
  }
}

export function buildEnrollmentPaymentAdapter(): EnrollmentPaymentPort {
  return new EnrollmentPaymentAdapter();
}
