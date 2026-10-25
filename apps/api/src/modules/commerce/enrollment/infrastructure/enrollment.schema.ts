import { Schema } from "mongoose";
import { DATABASE_KIND, MODEL_TENANCY } from "@banijjik/contracts";
import { ENROLLMENT_STATUS, ENROLLMENT_PERIOD_STATUS } from "@banijjik/contracts/enrollment";
import {
  auditFields,
  domainIdField,
  SCHEMA_OPTIONS,
  SUB_SCHEMA_OPTIONS,
  versionField,
  registerModel,
} from "../../../../kernel/db/index.js";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import type { CheckIn } from "../application/ports.js";

const money = new Schema(
  { amount: { type: Number, required: true }, currency: { type: String, required: true } },
  SUB_SCHEMA_OPTIONS,
);
const freeze = new Schema(
  {
    frozenOn: { type: String, required: true },
    unfrozenOn: String,
    daysFrozen: { type: Number, required: true },
  },
  SUB_SCHEMA_OPTIONS,
);
const history = new Schema(
  { action: String, on: String, actorUserId: { type: String, default: null } },
  SUB_SCHEMA_OPTIONS,
);
export const ENROLLMENT_MODEL = "Enrollment";
export const ENROLLMENT_PERIOD_MODEL = "EnrollmentPeriod";
export const ENROLLMENT_SEATS_MODEL = "EnrollmentSeats";
export const CHECK_IN_MODEL = "CheckIn";

const enrollment = new Schema<Enrollment>(
  {
    ...domainIdField("enrollmentId"),
    ...auditFields,
    ...versionField,
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true },
    enrollmentNumber: { type: String, required: true },
    contactId: { type: String, required: true },
    billToContactId: { type: String, required: true },
    offeringId: { type: String, required: true },
    variantId: { type: String, required: true },
    startsOn: { type: String, required: true },
    endsOn: String,
    reminderSentForEnrollmentPeriodId: String,
    status: { type: String, enum: Object.values(ENROLLMENT_STATUS), required: true },
    autoRenew: { type: Boolean, required: true },
    currentEnrollmentPeriodId: { type: String, required: true },
    securityDepositHeld: { type: money, required: true },
    resourceIds: { type: [String], default: [] },
    freezes: { type: [freeze], default: [] },
    customFields: { type: Schema.Types.Mixed, default: {} },
    plan: { type: Schema.Types.Mixed, required: true },
    firstRecurringFee: { type: money, required: true },
    history: { type: [history], default: [] },
  },
  SCHEMA_OPTIONS,
);
enrollment.index({ organizationId: 1, enrollmentId: 1 }, { unique: true });
enrollment.index({ organizationId: 1, status: 1, enrollmentId: 1 });
enrollment.index({ organizationId: 1, locationId: 1, status: 1, enrollmentId: 1 });
enrollment.index({ organizationId: 1, contactId: 1, status: 1 });
enrollment.index({ organizationId: 1, offeringId: 1, enrollmentId: 1 });
enrollment.index({ organizationId: 1, enrollmentNumber: 1 }, { unique: true });

const period = new Schema<EnrollmentPeriod>(
  {
    ...domainIdField("enrollmentPeriodId"),
    ...auditFields,
    ...versionField,
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true },
    enrollmentId: { type: String, required: true },
    periodNumber: { type: Number, required: true },
    periodStartsOn: { type: String, required: true },
    periodEndsOn: { type: String, required: true },
    originalEndsOn: String,
    fee: { type: money, required: true },
    sessionsAllowed: Number,
    sessionsUsed: { type: Number, required: true },
    status: { type: String, enum: Object.values(ENROLLMENT_PERIOD_STATUS), required: true },
    revenueRecognizedOn: String,
    refundableOnCancel: money,
    refundedAtCancel: money,
    revenueClosedAs: { type: String, enum: ["REVENUE", "CANCELLATION_FEE"] },
  },
  SCHEMA_OPTIONS,
);
period.index({ organizationId: 1, enrollmentPeriodId: 1 }, { unique: true });
period.index({ organizationId: 1, enrollmentId: 1, periodNumber: 1 }, { unique: true });
period.index({ organizationId: 1, periodEndsOn: 1, enrollmentId: 1 });

export interface EnrollmentSeats {
  enrollmentSeatsId: string;
  organizationId: string;
  variantId: string;
  count: number;
  version: number;
  createdByUserId: string | null;
  updatedByUserId: string | null;
}
const seats = new Schema<EnrollmentSeats>(
  {
    ...domainIdField("enrollmentSeatsId"),
    ...auditFields,
    ...versionField,
    organizationId: { type: String, required: true, immutable: true },
    variantId: { type: String, required: true },
    count: { type: Number, required: true },
  },
  SCHEMA_OPTIONS,
);
seats.index({ organizationId: 1, variantId: 1 }, { unique: true });
seats.index({ organizationId: 1, enrollmentSeatsId: 1 }, { unique: true });

const checkIn = new Schema<CheckIn>(
  {
    ...domainIdField("checkInId"),
    ...auditFields,
    organizationId: { type: String, required: true, immutable: true },
    locationId: { type: String, required: true },
    contactId: { type: String, required: true },
    enrollmentId: String,
    enrollmentPeriodId: String,
    bookingId: String,
    checkedInOn: { type: String, required: true },
    checkedInAt: { type: Date, required: true },
    recordedByUserId: { type: String, default: null },
    method: { type: String, enum: ["STAFF"], required: true },
  },
  SCHEMA_OPTIONS,
);

checkIn.index({ organizationId: 1, checkInId: 1 }, { unique: true });
checkIn.index({ organizationId: 1, locationId: 1, checkedInOn: 1, checkInId: 1 });

/** All access goes through models(ctx); the registry applies tenant/location plugins. */
export function registerEnrollmentModels(): void {
  const definitions = [
    [ENROLLMENT_MODEL, "enrollments", enrollment, MODEL_TENANCY.ORGANIZATION_AND_LOCATION],
    [
      ENROLLMENT_PERIOD_MODEL,
      "enrollment_periods",
      period,
      MODEL_TENANCY.ORGANIZATION_AND_LOCATION,
    ],
    [ENROLLMENT_SEATS_MODEL, "enrollment_seats", seats, MODEL_TENANCY.ORGANIZATION],
    [CHECK_IN_MODEL, "check_ins", checkIn, MODEL_TENANCY.ORGANIZATION_AND_LOCATION],
  ] as const;
  for (const [modelName, collectionName, schema, tenancy] of definitions) {
    registerModel({
      database: DATABASE_KIND.TENANT,
      modelName,
      collectionName,
      schema,
      tenancy,
      appendOnly: modelName === CHECK_IN_MODEL,
    });
  }
}
