import { type LocationId, type OrganizationId, type ResourceId } from "@banijjik/ids";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import type { EventSessionResourceHold } from "../domain/event-session.entity.js";
import { bookingRuleError, eventSessionResourceBusyError } from "../domain/errors.js";
import type {
  ResourceRepository,
  ResourceSlotUsagePort,
  ResourceTimeOffRepository,
} from "./ports/booking-repositories.js";

export async function takeSessionResourceHolds(input: {
  slots: Pick<ResourceSlotUsagePort, "takeWholeResource">;
  resources: Pick<ResourceRepository, "findById">;
  timeOff: Pick<ResourceTimeOffRepository, "listOverlapping">;
  organizationId: OrganizationId;
  locationId: LocationId;
  resourceIds: readonly ResourceId[];
  startsAt: Date;
  endsAt: Date;
}): Promise<readonly EventSessionResourceHold[]> {
  const holds: EventSessionResourceHold[] = [];
  for (const resourceId of [...input.resourceIds].sort()) {
    const resource = await input.resources.findById(resourceId);
    if (resource === undefined || resource.locationId !== input.locationId)
      throw bookingRuleError(BOOKING_RULE_KEY.RESOURCE_WRONG_LOCATION);
    const timeOff = await input.timeOff.listOverlapping({
      resourceId,
      from: input.startsAt,
      to: input.endsAt,
    });
    if (timeOff.length > 0) throw eventSessionResourceBusyError(resourceId);
    await input.slots.takeWholeResource({
      organizationId: input.organizationId,
      resourceId,
      units: resource.capacity,
      startsAt: input.startsAt,
      blockedEndsAt: input.endsAt,
    });
    holds.push({ resourceId, units: resource.capacity });
  }
  return holds;
}
export async function releaseSessionResourceHolds(input: {
  slots: Pick<ResourceSlotUsagePort, "releaseWholeResource">;
  organizationId: OrganizationId;
  holds: readonly EventSessionResourceHold[];
  startsAt: Date;
  endsAt: Date;
}): Promise<void> {
  for (const hold of [...input.holds].sort((a, b) => a.resourceId.localeCompare(b.resourceId)))
    await input.slots.releaseWholeResource({
      organizationId: input.organizationId,
      resourceId: hold.resourceId,
      units: hold.units,
      startsAt: input.startsAt,
      blockedEndsAt: input.endsAt,
    });
}
