import { defineEnum } from "../define-enum.js";
import type { CurrencyCode } from "../organization/currency-code.js";
import type { OfferingKind } from "../modules/offering-kind.js";

/** Money in JSON: integer minor units plus currency (ADR-013). */
export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

/** ISO weekday: 1 = Monday … 7 = Sunday (local to the organization timezone). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}

export const RESOURCE_STATUS = defineEnum(["ACTIVE", "INACTIVE"]);
export type ResourceStatus = (typeof RESOURCE_STATUS)[keyof typeof RESOURCE_STATUS];

export const BOOKING_STATUS = defineEnum([
  "HELD",
  "REQUESTED",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "EXPIRED",
]);
export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** Statuses that hold capacity (11 §5.1). */
export const BOOKING_CAPACITY_STATUSES: readonly BookingStatus[] = [
  BOOKING_STATUS.HELD,
  BOOKING_STATUS.REQUESTED,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
];

export const BOOKING_SOURCE = defineEnum(["STAFF", "STOREFRONT", "BOT", "API"]);
export type BookingSource = (typeof BOOKING_SOURCE)[keyof typeof BOOKING_SOURCE];

export const BOOKING_KIND = defineEnum(["SERVICE", "RENTAL", "EVENT"]);
export type BookingKind = (typeof BOOKING_KIND)[keyof typeof BOOKING_KIND];

export const DEPOSIT_REQUIRED = defineEnum(["NONE", "FIXED", "PERCENT", "FULL"]);
export type DepositRequired = (typeof DEPOSIT_REQUIRED)[keyof typeof DEPOSIT_REQUIRED];

export const CANCEL_FEE_MODE = defineEnum(["NONE", "DEPOSIT", "PERCENT"]);
export type CancelFeeMode = (typeof CANCEL_FEE_MODE)[keyof typeof CANCEL_FEE_MODE];

/** Fixed bucket size for capacity counters (ADR-122). Independent of slotStepMinutes. */
export const BOOKING_BUCKET_MINUTES = 5;

export const BOOKING_SLOT_STEP_MINUTES_SETTING_KEY = "booking.slotStepMinutes";
export const BOOKING_MIN_NOTICE_MINUTES_SETTING_KEY = "booking.minNoticeMinutes";
export const BOOKING_REMINDER_LEAD_MINUTES_SETTING_KEY = "booking.reminderLeadMinutes";
export const BOOKING_REQUIRE_APPROVAL_SETTING_KEY = "booking.requireApproval";
export const BOOKING_HOLD_MINUTES_SETTING_KEY = "booking.holdMinutes";
export const BOOKING_NO_SHOW_AFTER_MINUTES_SETTING_KEY = "booking.noShowAfterMinutes";
export const BOOKING_DEPOSIT_REQUIRED_SETTING_KEY = "booking.deposit.required";
export const BOOKING_DEPOSIT_VALUE_SETTING_KEY = "booking.deposit.value";
export const BOOKING_FREE_CANCEL_HOURS_SETTING_KEY = "booking.freeCancelHours";
export const BOOKING_LATE_CANCEL_FEE_SETTING_KEY = "booking.lateCancelFee";
export const BOOKING_NO_SHOW_FEE_SETTING_KEY = "booking.noShowFee";
export const BOOKING_FEE_PERCENT_SETTING_KEY = "booking.feePercent";

export const BOOKING_SLOT_STEP_MINUTES_DEFAULT = 15;
export const BOOKING_MIN_NOTICE_MINUTES_DEFAULT = 60;
export const BOOKING_REMINDER_LEAD_MINUTES_DEFAULT = 60;
export const BOOKING_REQUIRE_APPROVAL_DEFAULT = false;
export const BOOKING_HOLD_MINUTES_DEFAULT = 10;
export const BOOKING_NO_SHOW_AFTER_MINUTES_DEFAULT = 30;
export const BOOKING_DEPOSIT_REQUIRED_DEFAULT = DEPOSIT_REQUIRED.NONE;
export const BOOKING_DEPOSIT_VALUE_DEFAULT = 0;
export const BOOKING_FREE_CANCEL_HOURS_DEFAULT = 24;
export const BOOKING_LATE_CANCEL_FEE_DEFAULT = CANCEL_FEE_MODE.NONE;
export const BOOKING_NO_SHOW_FEE_DEFAULT = CANCEL_FEE_MODE.NONE;
export const BOOKING_FEE_PERCENT_DEFAULT = 50;

export const MAX_RESOURCE_NAME_LENGTH = 120;
export const MAX_BOOKING_NOTE_LENGTH = 500;
export const MAX_TIME_OFF_REASON_LENGTH = 200;
export const MAX_CANCEL_REASON_LENGTH = 200;
export const MAX_SCHEDULE_RANGES_PER_DAY = 8;
export const MAX_OFFERINGS_PER_RESOURCE = 100;
export const MAX_HISTORY_ENTRIES = 50;

/** Local wall-clock time `HH:mm` (24h) in the organization timezone. */
export const LOCAL_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ScheduleRange {
  readonly weekday: Weekday;
  readonly opensAt: string;
  readonly closesAt: string;
}

export interface BookingPriceSnapshot {
  readonly unitPrice: Money;
  readonly total: Money;
  readonly tax: Money;
  readonly currency: CurrencyCode;
}

export interface BookingHistoryEntry {
  readonly at: string;
  readonly action: string;
  readonly fromStartsAt?: string;
  readonly fromEndsAt?: string;
  readonly toStartsAt?: string;
  readonly toEndsAt?: string;
  readonly actorUserId?: string;
  readonly note?: string;
}

export interface ResourceResponse {
  readonly resourceId: string;
  readonly locationId: string;
  readonly resourceTypeKey: string;
  readonly name: string;
  readonly memberId: string | null;
  readonly capacity: number;
  readonly weeklySchedule: readonly ScheduleRange[];
  readonly offeringIds: readonly string[];
  readonly status: ResourceStatus;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ResourceTimeOffResponse {
  readonly resourceTimeOffId: string;
  readonly resourceId: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reason: string | null;
  readonly createdAt: string;
}

export interface AvailabilitySlot {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly resourceIds: readonly string[];
}

export interface BookingResponse {
  readonly bookingId: string;
  readonly bookingNumber: string | null;
  readonly locationId: string;
  readonly contactId: string;
  readonly offeringId: string;
  readonly variantId: string;
  readonly kind: BookingKind;
  readonly depositRequired: Money;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly resourceIds: readonly string[];
  readonly providerMemberId: string | null;
  readonly quantity: number;
  readonly price: BookingPriceSnapshot;
  readonly status: BookingStatus;
  readonly source: BookingSource;
  readonly note: string | null;
  readonly holdExpiresAt: string | null;
  readonly history: readonly BookingHistoryEntry[];
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly contactName?: string;
  readonly offeringName?: string;
  readonly resourceNames?: readonly string[];
  readonly paymentStatus?: string;
  readonly cancellationFeeRetained?: Money | null;
}

/** Narrow kind check: card 3.6 only creates SERVICE bookings. */
export function isServiceBookingKind(kind: OfferingKind | BookingKind): boolean {
  return kind === "SERVICE";
}
