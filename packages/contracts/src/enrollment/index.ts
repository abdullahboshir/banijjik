import { defineEnum } from "../define-enum.js";
import type { Money } from "../catalog/catalog-contracts.js";

export const ENROLLMENT_STATUS = defineEnum([
  "PENDING",
  "ACTIVE",
  "FROZEN",
  "OVERDUE",
  "EXPIRED",
  "COMPLETED",
  "CANCELLED",
]);
export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[keyof typeof ENROLLMENT_STATUS];
export const ENROLLMENT_PERIOD_STATUS = defineEnum(["OPEN", "PAID", "PARTIAL", "WAIVED"]);
export const ENROLLMENT_REVENUE_CLOSE = defineEnum(["REVENUE", "CANCELLATION_FEE"]);
export type EnrollmentRevenueClose =
  (typeof ENROLLMENT_REVENUE_CLOSE)[keyof typeof ENROLLMENT_REVENUE_CLOSE];
export type EnrollmentPeriodStatus =
  (typeof ENROLLMENT_PERIOD_STATUS)[keyof typeof ENROLLMENT_PERIOD_STATUS];
export const ENROLLMENT_ACTION = defineEnum([
  "activate",
  "freeze",
  "unfreeze",
  "cancel",
  "renew",
  "expire",
  "complete",
  "markOverdue",
]);
export type EnrollmentAction = (typeof ENROLLMENT_ACTION)[keyof typeof ENROLLMENT_ACTION];
export const ENROLLMENT_REFUND_POLICY = defineEnum(["NONE", "UNUSED_PERIODS", "PRORATED"]);
export type EnrollmentRefundPolicy =
  (typeof ENROLLMENT_REFUND_POLICY)[keyof typeof ENROLLMENT_REFUND_POLICY];
export const CHECK_IN_METHOD = { STAFF: "STAFF" } as const;
export const ENROLLMENT_EVENT_TYPE = {
  ENROLLMENT_CREATED: "enrollment.enrollment.created",
  ENROLLMENT_ACTIVATED: "enrollment.enrollment.activated",
  ENROLLMENT_FROZEN: "enrollment.enrollment.freezeStarted",
  ENROLLMENT_UNFROZEN: "enrollment.enrollment.freezeEnded",
  ENROLLMENT_CANCELLED: "enrollment.enrollment.cancelled",
  ENROLLMENT_RENEWED: "enrollment.enrollment.renewed",
  ENROLLMENT_EXPIRED: "enrollment.enrollment.expired",
  ENROLLMENT_COMPLETED: "enrollment.enrollment.completed",
  ENROLLMENT_OVERDUE: "enrollment.enrollment.overdueMarked",
  ENROLLMENT_RENEWAL_DUE: "enrollment.enrollment.renewalDueReached",
  ENROLLMENT_CHECK_IN_RECORDED: "enrollment.checkIn.recorded",
  PERIOD_REVENUE_RECOGNIZED: "enrollment.period.revenueRecognized",
  PERIOD_REVENUE_CLOSED: "enrollment.period.revenueClosed",
} as const;
export interface EnrollmentEventPayload {
  readonly enrollmentId: string;
  readonly enrollmentPeriodId?: string;
}
/** A period's whole fee became revenue, once, on its start or activation (card 3.31). */
export interface PeriodRevenueRecognizedPayload {
  readonly enrollmentId: string;
  readonly enrollmentPeriodId: string;
}
/**
 * A cancelled period closed at what the business kept. `recognizedBeforeCancel` says which
 * journal applies, so the handler never compares amounts (the kept amount can equal the fee).
 */
export interface PeriodRevenueClosedPayload {
  readonly enrollmentId: string;
  readonly enrollmentPeriodId: string;
  readonly keptAmount: Money;
  readonly recognizedAmount: Money;
  readonly recognizedBeforeCancel: boolean;
}
export interface CheckInEventPayload {
  readonly checkInId: string;
  readonly enrollmentId?: string;
  readonly bookingId?: string;
}
export const ENROLLMENT_SETTING = {
  GRACE_DAYS: "enrollment.graceDays",
  REMINDER_DAYS: "enrollment.renewalReminderDays",
  REQUIRE_PAYMENT: "enrollment.requirePaymentToActivate",
  BLOCK_OVERDUE: "enrollment.blockCheckInWhenOverdue",
  LOCK_PRICE: "enrollment.lockPriceOnRenewal",
  REFUND_POLICY: "enrollment.refundPolicy",
} as const;
export const ENROLLMENT_RULE_KEY = {
  TRANSITION: "enrollment.errors.transition",
  START_DATE: "enrollment.errors.start_date",
  FREEZE_LIMIT: "enrollment.errors.freeze_limit",
  SESSION_LIMIT: "enrollment.errors.session_limit",
  CONTACT: "enrollment.errors.contact",
  PLAN: "enrollment.errors.plan",
  PAYMENT_REQUIRED: "enrollment.errors.payment_required",
  ALREADY_RENEWED: "enrollment.errors.already_renewed",
  ADVANCE_PERIOD: "enrollment.errors.advance_period",
  NOT_DUE: "enrollment.errors.not_due",
  CURRENCY_MISMATCH: "enrollment.errors.currency_mismatch",
} as const;
export const ENROLLMENT_MESSAGE_KEYS = Object.values(ENROLLMENT_RULE_KEY);
export const ENROLLMENT_JOB = {
  RENEW: "enrollment.renew",
  OVERDUE: "enrollment.markOverdue",
  REMIND: "enrollment.remind",
} as const;
export const ENROLLMENT_TERMINAL_STATUSES: readonly EnrollmentStatus[] = [
  ENROLLMENT_STATUS.CANCELLED,
  ENROLLMENT_STATUS.COMPLETED,
  ENROLLMENT_STATUS.EXPIRED,
];

export type {
  EnrollmentResponse,
  EnrollmentPeriodResponse,
  EnrollmentDetailResponse,
  EnrollmentFreezeResponse,
  CheckInResponse,
  EnrollmentTransitionResponse,
} from "./enrollment-responses.js";
export { ENROLLMENT_CREATION_MODE, type EnrollmentCreationMode } from "./enrollment-contracts.js";
