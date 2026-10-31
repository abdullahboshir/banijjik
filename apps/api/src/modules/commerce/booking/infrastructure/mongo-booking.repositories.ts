import { BOOKING_KIND, BOOKING_STATUS } from "@banijjik/contracts/booking";
import {
  type BookingId,
  type EventSessionId,
  type LocationId,
  type OfferingId,
  type ResourceId,
} from "@banijjik/ids";
import type { Model, QueryFilter } from "mongoose";
import {
  getActiveSession,
  models,
  sessionOption,
  updateVersioned,
} from "../../../../kernel/db/index.js";
import { Booking } from "../domain/booking.entity.js";
import { Resource } from "../domain/resource.entity.js";
import type {
  BookingListFilter,
  BookingRepository,
  ResourceListFilter,
  ResourceRepository,
} from "../application/ports/booking-repositories.js";
import {
  BOOKING_MODEL_NAME,
  RESOURCE_MODEL_NAME,
  type BookingDocument,
  type ResourceDocument,
} from "./booking.schema.js";
import { bookingDocument, toBooking, toResource } from "./mongo-booking.mapper.js";

const SCHEDULED_BOOKING_BATCH_LIMIT = 100;

/** Bookings that still occupy a seat, so a cancelled session must settle them first. */
const OPEN_BOOKING_STATUSES = [
  BOOKING_STATUS.HELD,
  BOOKING_STATUS.REQUESTED,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
];

function resourceModel(): Model<ResourceDocument> {
  return models({}).get<ResourceDocument>(RESOURCE_MODEL_NAME);
}

function bookingModel(): Model<BookingDocument> {
  return models({}).get<BookingDocument>(BOOKING_MODEL_NAME);
}

export class MongoResourceRepository implements ResourceRepository {
  async insert(resource: Resource): Promise<void> {
    const props = resource.toProps();
    const document: ResourceDocument = {
      resourceId: props.resourceId,
      organizationId: props.organizationId,
      locationId: props.locationId,
      resourceTypeKey: props.resourceTypeKey,
      name: props.name,
      memberId: props.memberId,
      capacity: props.capacity,
      weeklySchedule: [...props.weeklySchedule],
      offeringIds: [...props.offeringIds],
      status: props.status,
      version: props.version,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt,
      createdByUserId: props.createdByUserId,
      updatedByUserId: props.updatedByUserId,
    };
    await resourceModel().create([document], sessionOption(getActiveSession()));
  }

  async findById(resourceId: ResourceId): Promise<Resource | undefined> {
    const row = await resourceModel().findOne({ resourceId }).lean<ResourceDocument>();
    return row === null ? undefined : toResource(row);
  }

  async list(
    filter: ResourceListFilter,
  ): Promise<{ readonly items: Resource[]; readonly hasNext: boolean }> {
    const query: QueryFilter<ResourceDocument> = {};
    if (filter.locationId !== undefined) query.locationId = filter.locationId;
    if (filter.status !== undefined) query.status = filter.status;
    if (filter.resourceTypeKey !== undefined) query.resourceTypeKey = filter.resourceTypeKey;
    const limit = filter.limit + 1;
    const rows = await resourceModel()
      .find(query)
      .sort({ name: 1, resourceId: 1 })
      .limit(limit)
      .skip((filter.page - 1) * filter.limit)
      .lean<ResourceDocument[]>();
    const hasNext = rows.length > filter.limit;
    const items = rows.slice(0, filter.limit).map(toResource);
    return { items, hasNext };
  }

  async update(resource: Resource, expectedVersion: number): Promise<Resource> {
    const props = resource.toProps();
    const updated = await updateVersioned({
      model: resourceModel(),
      filter: { resourceId: props.resourceId },
      expectedVersion,
      update: {
        $set: {
          name: props.name,
          memberId: props.memberId,
          capacity: props.capacity,
          weeklySchedule: props.weeklySchedule,
          offeringIds: props.offeringIds,
          status: props.status,
          updatedAt: props.updatedAt,
          updatedByUserId: props.updatedByUserId,
        },
      },
    });
    return toResource(updated);
  }

  async listActiveForOffering(input: {
    readonly locationId: LocationId;
    readonly offeringId: OfferingId;
    readonly resourceTypeKeys?: readonly string[];
  }): Promise<readonly Resource[]> {
    const filter: Record<string, unknown> = {
      locationId: input.locationId,
      status: "ACTIVE",
    };
    if (input.resourceTypeKeys !== undefined && input.resourceTypeKeys.length > 0) {
      filter.$or = [
        { offeringIds: input.offeringId },
        { resourceTypeKey: { $in: input.resourceTypeKeys } },
      ];
    } else {
      filter.offeringIds = input.offeringId;
    }
    const rows = await resourceModel()
      .find(filter)
      .sort({ resourceId: 1 })
      .lean<ResourceDocument[]>();
    return rows.map(toResource);
  }
}

export class MongoBookingRepository implements BookingRepository {
  async insert(booking: Booking): Promise<void> {
    await bookingModel().create([bookingDocument(booking)], sessionOption(getActiveSession()));
  }

  async findById(bookingId: BookingId): Promise<Booking | undefined> {
    const row = await bookingModel()
      .findOne({ bookingId }, null, sessionOption(getActiveSession()))
      .lean<BookingDocument>();
    return row === null ? undefined : toBooking(row);
  }

  async findByIds(bookingIds: readonly BookingId[]): Promise<readonly Booking[]> {
    if (bookingIds.length === 0) return [];
    const rows = await bookingModel()
      .find({ bookingId: { $in: [...bookingIds] } }, null, sessionOption(getActiveSession()))
      .lean<BookingDocument[]>();
    return rows.map(toBooking);
  }

  async update(booking: Booking, expectedVersion: number): Promise<Booking> {
    const props = booking.toProps();
    const updated = await updateVersioned({
      model: bookingModel(),
      filter: { bookingId: props.bookingId },
      expectedVersion,
      update: {
        $set: {
          bookingNumber: props.bookingNumber,
          status: props.status,
          startsAt: props.startsAt,
          endsAt: props.endsAt,
          blockedEndsAt: props.blockedEndsAt,
          resourceIds: props.resourceIds,
          providerMemberId: props.providerMemberId,
          holdExpiresAt: props.holdExpiresAt,
          eventSessionId: props.eventSessionId ?? null,
          cancellationFeeRetained: props.cancellationFeeRetained ?? null,
          history: props.history,
          note: props.note,
          checkoutId: props.checkoutId ?? null,
          paymentFenceVersion: props.paymentFenceVersion ?? 0,
          updatedAt: props.updatedAt,
          updatedByUserId: props.updatedByUserId,
        },
      },
    });
    return toBooking(updated);
  }

  async list(
    filter: BookingListFilter,
  ): Promise<{ readonly items: Booking[]; readonly hasNext: boolean }> {
    const query: QueryFilter<BookingDocument> = {};
    if (filter.locationId !== undefined) query.locationId = filter.locationId;
    if (filter.status !== undefined) {
      query.status = filter.status as BookingDocument["status"];
    }
    if (filter.contactId !== undefined) query.contactId = filter.contactId;
    if (filter.resourceId !== undefined) query.resourceIds = filter.resourceId;
    if (filter.from !== undefined || filter.to !== undefined) {
      query.startsAt = {};
      if (filter.from !== undefined) query.startsAt.$gte = new Date(filter.from);
      if (filter.to !== undefined) query.startsAt.$lte = new Date(filter.to);
    }
    const limit = filter.limit + 1;
    const rows = await bookingModel()
      .find(query)
      .sort({ startsAt: 1, bookingId: 1 })
      .limit(limit)
      .skip((filter.page - 1) * filter.limit)
      .lean<BookingDocument[]>();
    const hasNext = rows.length > filter.limit;
    return { items: rows.slice(0, filter.limit).map(toBooking), hasNext };
  }

  async listHeldExpired(now: Date): Promise<readonly Booking[]> {
    const rows = await bookingModel()
      .find({ status: "HELD", holdExpiresAt: { $lte: now } })
      .sort({ holdExpiresAt: 1, bookingId: 1 })
      .limit(SCHEDULED_BOOKING_BATCH_LIMIT)
      .lean<BookingDocument[]>();
    return rows.map(toBooking);
  }

  async listNoShowCandidates(input: {
    readonly now: Date;
    readonly graceMinutes: number;
  }): Promise<readonly Booking[]> {
    const cutoff = new Date(input.now.getTime() - input.graceMinutes * 60_000);
    const rows = await bookingModel()
      .find({
        status: "CONFIRMED",
        startsAt: { $lte: cutoff },
      })
      .sort({ startsAt: 1, bookingId: 1 })
      .limit(SCHEDULED_BOOKING_BATCH_LIMIT)
      .lean<BookingDocument[]>();
    return rows.map(toBooking);
  }

  async listAutoCompleteCandidates(input: {
    readonly now: Date;
    readonly graceMinutes: number;
  }): Promise<readonly Booking[]> {
    const cutoff = new Date(input.now.getTime() - input.graceMinutes * 60_000);
    const rows = await bookingModel()
      .find({
        $or: [
          { kind: BOOKING_KIND.RENTAL, status: "CHECKED_IN", endsAt: { $lte: cutoff } },
          // An event ends when its session time passes, so a checked-in event needs no grace.
          { kind: BOOKING_KIND.EVENT, status: "CHECKED_IN", endsAt: { $lte: input.now } },
        ],
      })
      .sort({ endsAt: 1, bookingId: 1 })
      .limit(SCHEDULED_BOOKING_BATCH_LIMIT)
      .lean<BookingDocument[]>();
    return rows.map(toBooking);
  }

  async listOpenForEventSession(eventSessionId: EventSessionId): Promise<readonly Booking[]> {
    const rows = await bookingModel()
      .find({ eventSessionId, status: { $in: OPEN_BOOKING_STATUSES } })
      .sort({ startsAt: 1, bookingId: 1 })
      .limit(SCHEDULED_BOOKING_BATCH_LIMIT)
      .lean<BookingDocument[]>();
    return rows.map(toBooking);
  }
}
