import type { QueryFilter } from "mongoose";
import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { ENROLLMENT_TERMINAL_STATUSES } from "@banijjik/contracts/enrollment";
import { newId } from "@banijjik/ids";
import type { EnrollmentListQuery, CheckInListQuery } from "@banijjik/validation/enrollment";
import {
  getActiveSession,
  models,
  sessionOption,
  stripMongoInternals,
  updateVersioned,
  isDuplicateKeyError,
} from "../../../../kernel/db/index.js";
import type { Enrollment, EnrollmentPeriod } from "../domain/enrollment.entity.js";
import type { EnrollmentRepository, CheckIn } from "../application/ports.js";
import {
  ENROLLMENT_MODEL,
  ENROLLMENT_PERIOD_MODEL,
  ENROLLMENT_SEATS_MODEL,
  CHECK_IN_MODEL,
  type EnrollmentSeats,
} from "./enrollment.schema.js";

const projection = { _id: 0, __v: 0 };
const options = () => sessionOption(getActiveSession());
const enrollments = () => models({}).get<Enrollment>(ENROLLMENT_MODEL);
const periods = () => models({}).get<EnrollmentPeriod>(ENROLLMENT_PERIOD_MODEL);
const seats = () => models({}).get<EnrollmentSeats>(ENROLLMENT_SEATS_MODEL);
const checkIns = () => models({}).get<CheckIn>(CHECK_IN_MODEL);

export class MongoEnrollmentRepository implements EnrollmentRepository {
  async insert(enrollment: Enrollment, period: EnrollmentPeriod): Promise<void> {
    await enrollments().create([enrollment], options());
    await this.insertPeriod(period);
  }
  async find(enrollmentId: string): Promise<Enrollment | undefined> {
    const row = await enrollments()
      .findOne({ enrollmentId }, projection, options())
      .lean<Enrollment>();
    return row ?? undefined;
  }
  async currentPeriod(enrollment: Enrollment): Promise<EnrollmentPeriod> {
    const row = await periods()
      .findOne({ enrollmentPeriodId: enrollment.currentEnrollmentPeriodId }, projection, options())
      .lean<EnrollmentPeriod>();
    if (row === null) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
    return row;
  }
  async periods(enrollmentId: string): Promise<readonly EnrollmentPeriod[]> {
    return periods()
      .find({ enrollmentId }, projection, options())
      .sort({ periodNumber: 1 })
      .lean<EnrollmentPeriod[]>();
  }
  async periodPage(
    enrollmentId: string,
    query: { page: number; limit: number },
  ): Promise<{ items: EnrollmentPeriod[]; hasNext: boolean }> {
    const rows = await periods()
      .find({ enrollmentId }, projection, options())
      .sort({ periodNumber: 1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit + 1)
      .lean<EnrollmentPeriod[]>();
    return { items: rows.slice(0, query.limit), hasNext: rows.length > query.limit };
  }
  async save(enrollment: Enrollment, version: number): Promise<Enrollment> {
    const {
      enrollmentId,
      organizationId,
      createdAt,
      createdByUserId,
      version: ignoredVersion,
      ...changes
    } = enrollment;
    void organizationId;
    void createdAt;
    void createdByUserId;
    void ignoredVersion;
    return updateVersioned({
      model: enrollments(),
      filter: { enrollmentId },
      expectedVersion: version,
      update: { $set: changes },
    });
  }
  async savePeriod(period: EnrollmentPeriod, changeEnd: boolean): Promise<void> {
    await updateVersioned({
      model: periods(),
      filter: { enrollmentPeriodId: period.enrollmentPeriodId },
      expectedVersion: period.version,
      update: {
        $set: {
          sessionsUsed: period.sessionsUsed,
          status: period.status,
          updatedByUserId: period.updatedByUserId,
          ...(period.originalEndsOn === undefined ? {} : { originalEndsOn: period.originalEndsOn }),
          ...(changeEnd ? { periodEndsOn: period.periodEndsOn } : {}),
        },
      },
    });
  }
  async insertPeriod(period: EnrollmentPeriod): Promise<void> {
    await periods().create([period], options());
  }
  async takeSeat(enrollment: Enrollment): Promise<void> {
    try {
      const capacity = enrollment.plan.capacity;
      const row = await seats()
        .findOneAndUpdate(
          {
            organizationId: enrollment.organizationId,
            variantId: enrollment.variantId,
            ...(capacity === undefined ? {} : { count: { $lt: capacity } }),
          },
          {
            $inc: { count: 1, version: 1 },
            $set: { updatedByUserId: enrollment.updatedByUserId },
            $setOnInsert: {
              enrollmentSeatsId: newId(),
              createdByUserId: enrollment.createdByUserId,
            },
          },
          { upsert: true, returnDocument: "after", ...options() },
        )
        .lean();
      if (row === null || (capacity !== undefined && row.count > capacity))
        throw new DomainRuleError({ code: ERROR_CODE.CAPACITY_FULL });
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new DomainRuleError({ code: ERROR_CODE.CAPACITY_FULL });
      throw error;
    }
  }
  async releaseSeat(enrollment: Enrollment): Promise<void> {
    await seats().updateOne(
      { variantId: enrollment.variantId, count: { $gt: 0 } },
      { $inc: { count: -1, version: 1 }, $set: { updatedByUserId: enrollment.updatedByUserId } },
      options(),
    );
  }
  async list(query: EnrollmentListQuery): Promise<{ items: Enrollment[]; hasNext: boolean }> {
    const { page, limit, overdue } = query;
    const filter: QueryFilter<Enrollment> = {};
    if (query.locationId !== undefined) filter.locationId = query.locationId;
    if (query.status !== undefined) filter.status = query.status;
    if (query.offeringId !== undefined) filter.offeringId = query.offeringId;
    if (query.contactId !== undefined) filter.contactId = query.contactId;
    if (overdue !== undefined) filter.$and = [{ status: overdue ? "OVERDUE" : { $ne: "OVERDUE" } }];
    const rows = await enrollments()
      .find(filter, projection, options())
      .sort({ enrollmentId: 1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<Enrollment[]>();
    return { items: rows.slice(0, limit).map(stripMongoInternals), hasNext: rows.length > limit };
  }
  async candidates(afterEnrollmentId?: string): Promise<readonly Enrollment[]> {
    return enrollments()
      .find(
        {
          status: { $nin: ENROLLMENT_TERMINAL_STATUSES },
          ...(afterEnrollmentId === undefined ? {} : { enrollmentId: { $gt: afterEnrollmentId } }),
        },
        projection,
        options(),
      )
      .sort({ enrollmentId: 1 })
      .limit(100)
      .lean<Enrollment[]>();
  }
  async checkIn(checkIn: CheckIn): Promise<void> {
    await checkIns().create([checkIn], options());
  }
  async checkIns(query: CheckInListQuery): Promise<{ items: CheckIn[]; hasNext: boolean }> {
    const { page, limit } = query;
    const filter: QueryFilter<CheckIn> = {};
    if (query.locationId !== undefined) filter.locationId = query.locationId;
    if (query.checkedInOn !== undefined) filter.checkedInOn = query.checkedInOn;
    if (query.contactId !== undefined) filter.contactId = query.contactId;
    const rows = await checkIns()
      .find(filter, projection, options())
      .sort({ checkInId: -1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean<CheckIn[]>();
    return { items: rows.slice(0, limit), hasNext: rows.length > limit };
  }
  async markReminder(enrollment: Enrollment, on: string): Promise<boolean> {
    const result = await enrollments().updateOne(
      {
        enrollmentId: enrollment.enrollmentId,
        currentEnrollmentPeriodId: enrollment.currentEnrollmentPeriodId,
        lastReminderOn: { $ne: on },
      },
      { $set: { lastReminderOn: on, updatedByUserId: null }, $inc: { version: 1 } },
      options(),
    );
    return result.modifiedCount === 1;
  }
}
