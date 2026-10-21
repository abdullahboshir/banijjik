import type { BookingCreateBody } from "@banijjik/validation/booking";
import {
  asId,
  type ContactId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import { slotFreeInBuckets } from "../domain/availability.js";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import {
  bookingRuleError,
  locationForbidden,
  recordNotFound,
  slotUnavailableError,
} from "../domain/errors.js";
import type { Resource } from "../domain/resource.entity.js";
import { isWithinSchedule, overlapsTimeOff } from "../domain/schedule.js";
import type { ResourceRepository, ResourceSlotUsagePort } from "./ports/booking-repositories.js";
import type { ContactCreator } from "./ports/booking-context-ports.js";

export function assertLocationAllowed(
  locationId: string,
  allowedLocationIds: readonly string[] | "ALL",
): void {
  if (allowedLocationIds !== "ALL" && !allowedLocationIds.includes(locationId)) {
    throw locationForbidden();
  }
}

export async function resolveBookingContactId(
  contacts: ContactCreator,
  input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly body: BookingCreateBody;
  },
): Promise<ContactId> {
  if (input.body.contactId !== undefined) {
    const contactId = asId<ContactId>(input.body.contactId);
    if (!(await contacts.isActive(contactId))) throw recordNotFound();
    return contactId;
  }
  const create = input.body.contact?.create;
  if (create === undefined) throw recordNotFound();
  return contacts.create({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    allowedLocationIds: input.allowedLocationIds,
    name: create.name,
    phone: create.phone,
  });
}

export async function pickResourceForSlot(input: {
  readonly candidates: readonly Resource[];
  readonly organizationId: OrganizationId;
  readonly startsAt: Date;
  readonly blockedEndsAt: Date;
  readonly slots: ResourceSlotUsagePort;
  readonly preferredId?: ResourceId;
}): Promise<Resource> {
  const ordered = [...input.candidates].sort((left, right) =>
    left.resourceId.localeCompare(right.resourceId),
  );
  const pool =
    input.preferredId === undefined
      ? ordered
      : ordered.filter((resource) => resource.resourceId === input.preferredId);
  for (const resource of pool) {
    const used = await input.slots.readUsedByBucket({
      organizationId: input.organizationId,
      resourceId: resource.resourceId,
      startsAt: input.startsAt,
      blockedEndsAt: input.blockedEndsAt,
    });
    if (
      slotFreeInBuckets({
        capacity: resource.capacity,
        usedByBucket: used,
        startsAt: input.startsAt,
        blockedEndsAt: input.blockedEndsAt,
      })
    ) {
      return resource;
    }
    if (input.preferredId !== undefined) break;
  }
  throw slotUnavailableError();
}

export async function reserveResourceForSlot(input: {
  readonly resources: ResourceRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly organizationId: OrganizationId;
  readonly locationId: LocationId;
  readonly offeringId: OfferingId;
  readonly startsAt: Date;
  readonly blockedEndsAt: Date;
  readonly preferredResourceId?: ResourceId;
  readonly timeZone: string;
  readonly timeOff: {
    listOverlapping(
      resourceId: ResourceId,
      from: Date,
      to: Date,
    ): Promise<readonly { startsAt: Date; endsAt: Date }[]>;
  };
}): Promise<Resource> {
  const candidates = await input.resources.listActiveForOffering({
    locationId: input.locationId,
    offeringId: input.offeringId,
  });
  if (candidates.length === 0) throw bookingRuleError(BOOKING_RULE_KEY.RESOURCE_CANNOT_SERVE);
  const resource = await pickResourceForSlot({
    candidates,
    organizationId: input.organizationId,
    startsAt: input.startsAt,
    blockedEndsAt: input.blockedEndsAt,
    slots: input.slots,
    ...(input.preferredResourceId === undefined ? {} : { preferredId: input.preferredResourceId }),
  });
  const timeOff = await input.timeOff.listOverlapping(
    resource.resourceId,
    input.startsAt,
    input.blockedEndsAt,
  );
  if (overlapsTimeOff(input.startsAt, input.blockedEndsAt, timeOff)) {
    throw slotUnavailableError();
  }
  if (
    !isWithinSchedule({
      startsAt: input.startsAt,
      endsAt: input.blockedEndsAt,
      schedule: resource.weeklySchedule,
      timeZone: input.timeZone,
    })
  ) {
    throw slotUnavailableError();
  }
  return resource;
}
