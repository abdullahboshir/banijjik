import { ENROLLMENT_PERIOD_STATUS, ENROLLMENT_STATUS } from "@banijjik/contracts/enrollment";
import { PAYMENT_REQUEST_TYPE } from "@banijjik/contracts/payment";
import { asId, type LocationId } from "@banijjik/ids";
import { buildEnrollmentPeriodSnapshotReader } from "../modules/commerce/enrollment/index.js";
import type { RequestReader } from "../modules/commerce/payment/index.js";

/**
 * An enrollment period is the payment request (decision 2). Missing, foreign, WAIVED and
 * CANCELLED-enrollment periods read as undefined; EXPIRED and COMPLETED unpaid periods stay
 * payable to collect the debt. Revenue state follows the period: AFTER_REVENUE once its revenue is
 * recognised (card 3.31, ADR-139), so a later payment goes to the receivable, not to advances.
 */
export function buildEnrollmentRequestReader(
  periods = buildEnrollmentPeriodSnapshotReader(),
): RequestReader {
  return {
    read: async (organizationId, requestId) => {
      const snapshot = await periods.read(organizationId, requestId);
      if (snapshot === undefined || snapshot.enrollment.organizationId !== organizationId)
        return undefined;
      const { period, enrollment } = snapshot;
      if (period.status === ENROLLMENT_PERIOD_STATUS.WAIVED) return undefined;
      if (enrollment.status === ENROLLMENT_STATUS.CANCELLED) return undefined;
      return {
        requestId: period.enrollmentPeriodId,
        requestType: PAYMENT_REQUEST_TYPE.ENROLLMENT,
        total: period.fee,
        contactId: enrollment.billToContactId,
        locationId: asId<LocationId>(period.locationId),
        revenueState: period.revenueRecognizedOn === undefined ? "BEFORE_REVENUE" : "AFTER_REVENUE",
      };
    },
  };
}
