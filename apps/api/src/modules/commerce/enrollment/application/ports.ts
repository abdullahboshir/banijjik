import type { Money, PlanDetails } from "@banijjik/contracts/catalog";
import type { EnrollmentAction } from "@banijjik/contracts/enrollment";
import type {
  EnrollmentCreateBody,
  EnrollmentListQuery,
  CheckInListQuery,
} from "@banijjik/validation/enrollment";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";

export interface CheckIn {
  readonly checkInId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly contactId: string;
  readonly enrollmentId?: string;
  readonly bookingId?: string | undefined;
  readonly enrollmentPeriodId?: string;
  readonly checkedInOn: string;
  readonly checkedInAt: Date;
  readonly recordedByUserId: string | null;
  readonly method: "STAFF";
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: string | null;
  readonly updatedByUserId: string | null;
}
export interface EnrollmentRepository {
  insert(enrollment: Enrollment, period: EnrollmentPeriod): Promise<void>;
  find(enrollmentId: string): Promise<Enrollment | undefined>;
  currentPeriod(enrollment: Enrollment): Promise<EnrollmentPeriod>;
  periods(enrollmentId: string): Promise<readonly EnrollmentPeriod[]>;
  save(enrollment: Enrollment, version: number): Promise<Enrollment>;
  savePeriod(period: EnrollmentPeriod, changeEnd: boolean): Promise<void>;
  insertPeriod(period: EnrollmentPeriod): Promise<void>;
  takeSeat(enrollment: Enrollment): Promise<void>;
  releaseSeat(enrollment: Enrollment): Promise<void>;
  list(query: EnrollmentListQuery): Promise<{ items: Enrollment[]; hasNext: boolean }>;
  candidates(afterEnrollmentId?: string): Promise<readonly Enrollment[]>;
  checkIn(checkIn: CheckIn): Promise<void>;
  checkIns(query: CheckInListQuery): Promise<{ items: CheckIn[]; hasNext: boolean }>;
  markReminder(enrollment: Enrollment, on: string): Promise<boolean>;
}
export interface EnrollmentSettings {
  readonly graceDays: number;
  readonly reminderDays: number;
  readonly requirePayment: boolean;
  readonly blockOverdue: boolean;
  readonly lockPrice: boolean;
  readonly refundPolicy: string;
}
export interface EnrollmentContext {
  isLocalMidnight(organizationId: string, now: Date): Promise<boolean>;
  today(organizationId: string, now: Date): Promise<string>;
  settings(organizationId: string): Promise<EnrollmentSettings>;
  plan(
    body: Pick<EnrollmentCreateBody, "offeringId" | "variantId" | "locationId">,
  ): Promise<PlanDetails>;
  fee(
    organizationId: string,
    body: Pick<EnrollmentCreateBody, "offeringId" | "variantId" | "locationId">,
  ): Promise<Money>;
  payer(organizationId: string, contactId: string, explicit?: string): Promise<string>;
  fields(
    organizationId: string,
    values: Readonly<Record<string, unknown>>,
  ): Promise<Readonly<Record<string, unknown>>>;
  activeContact(contactId: string): Promise<boolean>;
  bookingForToday(input: {
    contactId: string;
    locationId: string;
    today: string;
    bookingId?: string;
  }): Promise<string | undefined>;
}
export interface EnrollmentCaller {
  readonly organizationId: string;
  readonly actorUserId: string | null;
  readonly allowedLocationIds: readonly string[] | "ALL";
}
export type TransitionInput = EnrollmentCaller & {
  readonly enrollmentId: string;
  readonly version: number;
  readonly action: EnrollmentAction;
};
