import type { Money, PlanDetails } from "@banijjik/contracts/catalog";
import type {
  EnrollmentStatus,
  EnrollmentPeriodStatus,
  EnrollmentAction,
} from "@banijjik/contracts/enrollment";

export interface EnrollmentFreeze {
  readonly frozenOn: string;
  readonly unfrozenOn?: string;
  readonly daysFrozen: number;
}
export interface EnrollmentAuditFields {
  readonly organizationId: string;
  readonly locationId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: string | null;
  readonly updatedByUserId: string | null;
}
export interface Enrollment extends EnrollmentAuditFields {
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
  readonly reminderSentForEnrollmentPeriodId?: string;
  readonly securityDepositHeld: Money;
  readonly resourceIds: readonly string[];
  readonly freezes: readonly EnrollmentFreeze[];
  readonly customFields: Readonly<Record<string, unknown>>;
  readonly plan: PlanDetails;
  readonly firstRecurringFee: Money;
  readonly version: number;
  readonly history: readonly {
    action: EnrollmentAction | "create";
    on: string;
    actorUserId: string | null;
  }[];
}
export interface EnrollmentPeriod extends EnrollmentAuditFields {
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
