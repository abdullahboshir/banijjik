import type { ResourceStatus } from "@banijjik/contracts/booking";
import type {
  BookingId,
  EventSessionId,
  LocationId,
  OfferingId,
  OrganizationId,
  ResourceId,
} from "@banijjik/ids";
import type { Booking } from "../../domain/booking.entity.js";
import type { Resource } from "../../domain/resource.entity.js";

export interface ResourceListFilter {
  readonly page: number;
  readonly limit: number;
  readonly locationId?: string;
  readonly status?: ResourceStatus;
  readonly resourceTypeKey?: string;
}

export interface BookingListFilter {
  readonly page: number;
  readonly limit: number;
  readonly locationId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly status?: string;
  readonly resourceId?: string;
  readonly contactId?: string;
}

export interface ResourceTimeOffRecord {
  readonly resourceTimeOffId: string;
  readonly organizationId: string;
  readonly locationId: string;
  readonly resourceId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly reason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdByUserId: string | null;
  readonly updatedByUserId: string | null;
}

export interface ResourceRepository {
  insert(resource: Resource): Promise<void>;
  findById(resourceId: ResourceId): Promise<Resource | undefined>;
  list(
    filter: ResourceListFilter,
  ): Promise<{ readonly items: Resource[]; readonly hasNext: boolean }>;
  update(resource: Resource, expectedVersion: number): Promise<Resource>;
  listActiveForOffering(input: {
    readonly locationId: LocationId;
    readonly offeringId: OfferingId;
    readonly resourceTypeKeys?: readonly string[] | undefined;
  }): Promise<readonly Resource[]>;
}

export interface ResourceTimeOffRepository {
  insert(record: ResourceTimeOffRecord): Promise<void>;
  listForResource(resourceId: ResourceId): Promise<readonly ResourceTimeOffRecord[]>;
  listOverlapping(input: {
    readonly resourceId: ResourceId;
    readonly from: Date;
    readonly to: Date;
  }): Promise<readonly ResourceTimeOffRecord[]>;
}

export interface BookingRepository {
  insert(booking: Booking): Promise<void>;
  findById(bookingId: BookingId): Promise<Booking | undefined>;
  update(booking: Booking, expectedVersion: number): Promise<Booking>;
  list(
    filter: BookingListFilter,
  ): Promise<{ readonly items: Booking[]; readonly hasNext: boolean }>;
  listHeldExpired(now: Date): Promise<readonly Booking[]>;
  listNoShowCandidates(input: {
    readonly now: Date;
    readonly graceMinutes: number;
  }): Promise<readonly Booking[]>;
  listAutoCompleteCandidates(input: {
    readonly now: Date;
    readonly graceMinutes: number;
  }): Promise<readonly Booking[]>;
  /** The bookings of one event session that still hold a seat or owe a deposit. */
  listOpenForEventSession(eventSessionId: EventSessionId): Promise<readonly Booking[]>;
}

export interface ResourceSlotUsagePort {
  takeWholeResource(input: {
    organizationId: OrganizationId;
    resourceId: ResourceId;
    units: number;
    startsAt: Date;
    blockedEndsAt: Date;
  }): Promise<void>;
  releaseWholeResource(input: {
    organizationId: OrganizationId;
    resourceId: ResourceId;
    units: number;
    startsAt: Date;
    blockedEndsAt: Date;
  }): Promise<void>;
  takeCapacity(input: {
    readonly organizationId: OrganizationId;
    readonly resourceId: ResourceId;
    readonly capacity: number;
    readonly startsAt: Date;
    readonly blockedEndsAt: Date;
  }): Promise<void>;
  releaseCapacity(input: {
    readonly organizationId: OrganizationId;
    readonly resourceId: ResourceId;
    readonly startsAt: Date;
    readonly blockedEndsAt: Date;
  }): Promise<void>;
  readUsedByBucket(input: {
    readonly organizationId: OrganizationId;
    readonly resourceId: ResourceId;
    readonly startsAt: Date;
    readonly blockedEndsAt: Date;
  }): Promise<Map<number, number>>;
}

export interface BookingUnitOfWork {
  run<Result>(work: () => Promise<Result>): Promise<Result>;
}
