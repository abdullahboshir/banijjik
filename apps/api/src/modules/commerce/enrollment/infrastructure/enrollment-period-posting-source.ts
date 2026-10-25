import { ENROLLMENT_STATUS } from "@banijjik/contracts/enrollment";
import {
  PAYMENT_REQUEST_TYPE,
  type Money,
  type PaymentRequestType,
} from "@banijjik/contracts/payment";
import { asId, type OrganizationId } from "@banijjik/ids";
import { MongoEnrollmentRepository } from "./mongo-enrollment.repository.js";

/** The held BEFORE_REVENUE advance of a request, read by the payment module's advance reader. */
export interface HeldAdvanceReader {
  readHeldAdvance(input: {
    readonly organizationId: OrganizationId;
    readonly requestType: PaymentRequestType;
    readonly requestId: string;
    readonly currency: Money["currency"];
  }): Promise<Money>;
}

/** What accounting needs to post a period; the posting handler reads the same shape. */
export interface EnrollmentPeriodPostingRecord {
  readonly enrollmentPeriodId: string;
  readonly locationId: string | null;
  readonly fee: Money;
  readonly heldAdvance: Money;
  readonly revenueRecognizedOn?: string | undefined;
  readonly cancelledOn?: string | undefined;
}

/**
 * Reads what accounting posts for a period (card 3.31). A period's advance is settled by its own
 * id; the cancel date is the cancelled enrollment's endsOn (set by the cancel transition).
 */
export function buildEnrollmentPeriodPostingSource(advances: HeldAdvanceReader): {
  readRefundClose(enrollmentPeriodId: string): Promise<
    | {
        revenueClosedAs: "REVENUE" | "CANCELLATION_FEE";
        currency: Money["currency"];
        locationId: string | null;
      }
    | undefined
  >;
  readPeriod(input: {
    organizationId: string;
    enrollmentPeriodId: string;
  }): Promise<EnrollmentPeriodPostingRecord | undefined>;
} {
  const repository = new MongoEnrollmentRepository();
  return {
    async readRefundClose(enrollmentPeriodId) {
      const enrollment = await repository.periodForRefund(enrollmentPeriodId);
      if (!enrollment?.revenueClosedAs) return undefined;
      return {
        revenueClosedAs: enrollment.revenueClosedAs,
        currency: enrollment.fee.currency,
        locationId: enrollment.locationId,
      };
    },
    async readPeriod(input: { organizationId: string; enrollmentPeriodId: string }) {
      const organizationId = asId<OrganizationId>(input.organizationId);
      const period = await repository.findPeriod(organizationId, input.enrollmentPeriodId);
      if (period === undefined) return undefined;
      const enrollment = await repository.find(period.enrollmentId);
      if (enrollment === undefined) return undefined;
      const heldAdvance = await advances.readHeldAdvance({
        organizationId,
        requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
        requestId: period.enrollmentPeriodId,
        currency: period.fee.currency,
      });
      return {
        enrollmentPeriodId: period.enrollmentPeriodId,
        locationId: period.locationId,
        fee: period.fee,
        heldAdvance,
        revenueRecognizedOn: period.revenueRecognizedOn,
        cancelledOn:
          enrollment.status === ENROLLMENT_STATUS.CANCELLED ? enrollment.endsOn : undefined,
      };
    },
  };
}
