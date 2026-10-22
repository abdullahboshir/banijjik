import { defineEnum } from "../define-enum.js";

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
  ENROLLMENT_FROZEN: "enrollment.enrollment.frozen",
  ENROLLMENT_UNFROZEN: "enrollment.enrollment.unfrozen",
  ENROLLMENT_CANCELLED: "enrollment.enrollment.cancelled",
  ENROLLMENT_RENEWED: "enrollment.enrollment.renewed",
  ENROLLMENT_EXPIRED: "enrollment.enrollment.expired",
  ENROLLMENT_COMPLETED: "enrollment.enrollment.completed",
  ENROLLMENT_OVERDUE: "enrollment.enrollment.overdue",
  ENROLLMENT_RENEWAL_DUE: "enrollment.renewal.due",
  ENROLLMENT_CHECK_IN_RECORDED: "enrollment.checkIn.recorded",
} as const;
export interface EnrollmentEventPayload {
  readonly enrollmentId: string;
  readonly enrollmentPeriodId?: string;
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
  NOT_DUE: "enrollment.errors.not_due",
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
