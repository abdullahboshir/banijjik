import type { BookingResponse } from "@banijjik/contracts/booking";
import type { BookingListQuery } from "@banijjik/validation/booking";
import type { OrganizationId } from "@banijjik/ids";
import { addMinutes, localDateTimeToUtc } from "../../domain/timezone.js";
import { assertLocationAllowed } from "../booking-slot-selection.js";
import { toBookingResponse } from "../booking-views.js";
import type { BookingRepository } from "../ports/booking-repositories.js";

export class ListBookingsUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly timeZone: { read(organizationId: OrganizationId): Promise<string> };
    },
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly query: BookingListQuery;
  }): Promise<{ items: BookingResponse[]; hasNext: boolean }> {
    if (input.query.locationId !== undefined) {
      assertLocationAllowed(input.query.locationId, input.allowedLocationIds);
    }
    const timeZone = await this.dependencies.timeZone.read(input.organizationId);
    let from = input.query.from;
    let to = input.query.to;
    if (input.query.date !== undefined) {
      const dayStart = localDateTimeToUtc(input.query.date, "00:00", timeZone);
      const dayEnd = addMinutes(dayStart, 24 * 60);
      from = dayStart.toISOString();
      to = new Date(dayEnd.getTime() - 1).toISOString();
    }
    const page = await this.dependencies.bookings.list({
      page: input.query.page,
      limit: input.query.limit,
      ...(input.query.locationId === undefined ? {} : { locationId: input.query.locationId }),
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      ...(input.query.status === undefined ? {} : { status: input.query.status }),
      ...(input.query.resourceId === undefined ? {} : { resourceId: input.query.resourceId }),
      ...(input.query.contactId === undefined ? {} : { contactId: input.query.contactId }),
    });
    return {
      items: page.items.map((b) => toBookingResponse(b)),
      hasNext: page.hasNext,
    };
  }
}
