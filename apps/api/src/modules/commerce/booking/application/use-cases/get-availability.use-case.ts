import type { AvailabilitySlot } from "@banijjik/contracts/booking";
import { BOOKING_RULE_KEY } from "@banijjik/contracts/booking";
import type { AvailabilityQuery } from "@banijjik/validation/booking";
import {
  asId,
  type LocationId,
  type OfferingId,
  type OrganizationId,
  type ResourceId,
} from "@banijjik/ids";
import { bookingRuleError } from "../../domain/errors.js";
import {
  availabilitySlotsForResource,
  mergeAvailabilitySlotRows,
} from "../get-availability-slots.js";
import { assertLocationAllowed } from "../booking-slot-selection.js";
import type { ResourceRepository, ResourceSlotUsagePort } from "../ports/booking-repositories.js";
import type {
  BookingOfferingReader,
  BookingSettingsReader,
} from "../ports/booking-context-ports.js";

export class GetAvailabilityUseCase {
  constructor(
    private readonly dependencies: {
      readonly resources: ResourceRepository;
      readonly slots: ResourceSlotUsagePort;
      readonly offerings: BookingOfferingReader;
      readonly settings: BookingSettingsReader;
      readonly timeZone: { read(organizationId: OrganizationId): Promise<string> };
      readonly timeOff: {
        listOverlapping(
          resourceId: ResourceId,
          from: Date,
          to: Date,
        ): Promise<readonly { startsAt: Date; endsAt: Date }[]>;
      };
      readonly clock: { now(): Date };
    },
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly query: AvailabilityQuery;
  }): Promise<readonly AvailabilitySlot[]> {
    assertLocationAllowed(input.query.locationId, input.allowedLocationIds);
    const locationId = asId<LocationId>(input.query.locationId);
    const offeringId = asId<OfferingId>(input.query.offeringId);
    const offering = await this.dependencies.offerings.readServiceOffering({
      organizationId: input.organizationId,
      offeringId,
      variantId: input.query.variantId,
      locationId,
    });
    if (offering === undefined || !offering.isActive) {
      throw bookingRuleError(BOOKING_RULE_KEY.OFFERING_NOT_BOOKABLE);
    }
    const timeZone = await this.dependencies.timeZone.read(input.organizationId);
    const settings = await this.dependencies.settings.read(input.organizationId);
    const now = this.dependencies.clock.now();
    let candidates = await this.dependencies.resources.listActiveForOffering({
      locationId,
      offeringId,
    });
    if (input.query.resourceId !== undefined) {
      const preferred = asId<ResourceId>(input.query.resourceId);
      candidates = candidates.filter((resource) => resource.resourceId === preferred);
    }
    if (candidates.length === 0) {
      throw bookingRuleError(BOOKING_RULE_KEY.RESOURCE_CANNOT_SERVE);
    }

    const mergedRows = [];
    for (const resource of candidates) {
      const rows = await availabilitySlotsForResource({
        organizationId: input.organizationId,
        resource,
        businessDate: input.query.date,
        timeZone,
        slotStepMinutes: settings.slotStepMinutes,
        durationMinutes: offering.durationMinutes,
        bufferAfterMinutes: offering.service.bufferAfterMinutes,
        now,
        minNoticeMinutes: settings.minNoticeMinutes,
        maxAdvanceDays: offering.service.maxAdvanceDays ?? 365,
        slots: this.dependencies.slots,
        timeOff: this.dependencies.timeOff,
      });
      mergedRows.push(...rows);
    }
    return mergeAvailabilitySlotRows(mergedRows);
  }
}
