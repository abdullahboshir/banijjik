import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import type { OrganizationId, ResourceId } from "@banijjik/ids";
import { filterByTimeOff, generateSlotStarts, slotFreeInBuckets } from "../domain/availability.js";
import type { Resource } from "../domain/resource.entity.js";
import type { ResourceSlotUsagePort } from "./ports/booking-repositories.js";

async function freeSlotsForGenerated(input: {
  organizationId: OrganizationId;
  resource: Resource;
  generated: ReturnType<typeof generateSlotStarts>;
  slots: ResourceSlotUsagePort;
}): Promise<{ startsAt: string; endsAt: Date; resourceId: string }[]> {
  const rows: { startsAt: string; endsAt: Date; resourceId: string }[] = [];
  for (const slot of input.generated) {
    const used = await input.slots.readUsedByBucket({
      organizationId: input.organizationId,
      resourceId: input.resource.resourceId,
      startsAt: slot.startsAt,
      blockedEndsAt: slot.blockedEndsAt,
    });
    if (
      !slotFreeInBuckets({
        capacity: input.resource.capacity,
        usedByBucket: used,
        startsAt: slot.startsAt,
        blockedEndsAt: slot.blockedEndsAt,
      })
    ) {
      continue;
    }
    rows.push({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt,
      resourceId: input.resource.resourceId,
    });
  }
  return rows;
}

export async function availabilitySlotsForResource(input: {
  organizationId: OrganizationId;
  resource: Resource;
  businessDate: string;
  timeZone: string;
  slotStepMinutes: number;
  durationMinutes: number;
  bufferAfterMinutes: number;
  now: Date;
  minNoticeMinutes: number;
  maxAdvanceDays: number | undefined;
  slots: ResourceSlotUsagePort;
  timeOff: {
    listOverlapping(
      resourceId: ResourceId,
      from: Date,
      to: Date,
    ): Promise<readonly { startsAt: Date; endsAt: Date }[]>;
  };
}): Promise<{ startsAt: string; endsAt: Date; resourceId: string }[]> {
  const generated = generateSlotStarts({
    businessDate: input.businessDate,
    timeZone: input.timeZone,
    schedule: input.resource.weeklySchedule,
    slotStepMinutes: input.slotStepMinutes,
    durationMinutes: input.durationMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes,
    now: input.now,
    minNoticeMinutes: input.minNoticeMinutes,
    maxAdvanceDays: input.maxAdvanceDays ?? 365,
  });
  const dayStart = generated[0]?.startsAt ?? input.now;
  const dayEnd =
    generated.length > 0 ? (generated[generated.length - 1]?.blockedEndsAt ?? dayStart) : dayStart;
  const timeOffRows = await input.timeOff.listOverlapping(
    input.resource.resourceId,
    dayStart,
    dayEnd,
  );
  const freeOfTimeOff = filterByTimeOff(generated, timeOffRows);
  return freeSlotsForGenerated({
    organizationId: input.organizationId,
    resource: input.resource,
    generated: freeOfTimeOff,
    slots: input.slots,
  });
}

export function mergeAvailabilitySlotRows(
  rows: readonly { startsAt: string; endsAt: Date; resourceId: string }[],
): AvailabilitySlot[] {
  const slotMap = new Map<string, { endsAt: Date; resourceIds: string[] }>();
  for (const row of rows) {
    const existing = slotMap.get(row.startsAt);
    if (existing === undefined) {
      slotMap.set(row.startsAt, { endsAt: row.endsAt, resourceIds: [row.resourceId] });
    } else {
      existing.resourceIds.push(row.resourceId);
    }
  }
  return [...slotMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([startsAt, value]) => ({
      startsAt,
      endsAt: value.endsAt.toISOString(),
      resourceIds: [...value.resourceIds].sort(),
    }));
}
