import type { Money, PlanDetails } from "../catalog/index.js";
import type { EnrollmentStatus, EnrollmentPeriodStatus, EnrollmentAction } from "./index.js";

export interface EnrollmentFreezeResponse {
  readonly frozenOn: string;
  readonly unfrozenOn?: string;
  readonly daysFrozen: number;
}
export interface EnrollmentAuditResponse {
  readonly organizationId: string;
  readonly locationId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdByUserId: string | null;
  readonly updatedByUserId: string | null;
}
export interface EnrollmentResponse extends EnrollmentAuditResponse {
  readonly enrollmentId: string;
  readonly enrollmentNumber: string;
  readonly contactId: string;
  readonly billToContactId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly startsOn: string;
  readonly endsOn?: string;
  readonly status: EnrollmentStatus;
  readonly autoRenew: boolean;
  readonly currentEnrollmentPeriodId: string;
  readonly securityDepositHeld: Money;
  readonly resourceIds: readonly string[];
  readonly freezes: readonly EnrollmentFreezeResponse[];
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly plan: PlanDetails;
  readonly firstRecurringFee: Money;
  readonly version: number;
  readonly history: readonly {
    readonly action: EnrollmentAction | "create";
    readonly on: string;
    readonly actorUserId: string | null;
  }[];
}
export interface EnrollmentPeriodResponse extends EnrollmentAuditResponse {
  readonly refundRemaining: Money | null;
  readonly enrollmentPeriodId: string;
  readonly enrollmentId: string;
  readonly periodNumber: number;
  readonly periodStartsOn: string;
  readonly periodEndsOn: string;
  readonly originalEndsOn?: string;
  readonly fee: Money;
  readonly sessionsAllowed?: number;
  readonly sessionsUsed: number;
  readonly status: EnrollmentPeriodStatus;
  readonly version: number;
}
export interface EnrollmentDetailResponse extends EnrollmentResponse {
  readonly periods: readonly EnrollmentPeriodResponse[];
}
export interface CheckInResponse extends EnrollmentAuditResponse {
  readonly checkInId: string;
  readonly contactId: string;
  readonly enrollmentId?: string;
  readonly enrollmentPeriodId?: string;
  readonly bookingId?: string;
  readonly checkedInOn: string;
  readonly checkedInAt: string;
  readonly recordedByUserId: string | null;
  readonly method: "STAFF";
}
export interface EnrollmentTransitionResponse {
  readonly enrollment: EnrollmentResponse;
  readonly refundableAmount?: Money;
  readonly refundableByPeriod?: readonly { enrollmentPeriodId: string; amount: Money }[];
}
