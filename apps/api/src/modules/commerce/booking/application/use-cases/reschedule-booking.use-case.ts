import { OFFERING_KIND } from "@banijjik/contracts";
import type { BookingResponse } from "@banijjik/contracts/booking";
import {
  asId,
  type BookingId,
  type OrganizationId,
  type ResourceId,
  type UserId,
} from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { slotBounds } from "../../domain/availability.js";
import { computeRentalTime } from "../../domain/rental-time.js";
import { recordNotFound } from "../../domain/errors.js";
import { assertLocationAllowed } from "../booking-transition-shared.js";
import { toBookingResponse } from "../booking-views.js";
import { persistRescheduleInTxn } from "../reschedule-booking-txn.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceRepository,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type { BookingOfferingReader, OfferingBookingView } from "../ports/booking-context-ports.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";
import { runWithTxnRetry } from "../run-with-txn-retry.js";

async function resolveRescheduleBounds(input: {
  readonly offering: OfferingBookingView;
  readonly requestedStartsAt: Date;
  readonly quantity: number;
  readonly timeZoneReader?: { read(organizationId: OrganizationId): Promise<string> } | undefined;
  readonly organizationId: OrganizationId;
}): Promise<{ startsAt: Date; endsAt: Date; blockedEndsAt: Date }> {
  if (input.offering.kind === OFFERING_KIND.RENTAL) {
    const timeZone = input.timeZoneReader
      ? await input.timeZoneReader.read(input.organizationId)
      : "Asia/Dhaka";
    const rentalTime = computeRentalTime({
      startsAt: input.requestedStartsAt,
      quantity: input.quantity,
      rental: input.offering.rental,
      timeZone,
    });
    return {
      startsAt: rentalTime.startsAt,
      endsAt: rentalTime.endsAt,
      blockedEndsAt: rentalTime.blockedEndsAt,
    };
  }
  const bounds = slotBounds(
    input.requestedStartsAt,
    input.offering.durationMinutes,
    input.offering.service.bufferAfterMinutes,
  );
  return {
    startsAt: input.requestedStartsAt,
    endsAt: bounds.endsAt,
    blockedEndsAt: bounds.blockedEndsAt,
  };
}

export class RescheduleBookingUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly resources: ResourceRepository;
      readonly slots: ResourceSlotUsagePort;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
      readonly offerings: BookingOfferingReader;
      readonly timeZone?: { read(organizationId: OrganizationId): Promise<string> };
    },
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly bookingId: BookingId;
    readonly version: number;
    readonly startsAt: string;
    readonly resourceId?: string;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    const existing = await this.dependencies.bookings.findById(input.bookingId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const requestedStartsAt = new Date(input.startsAt);
    const offering = await this.dependencies.offerings.readOffering({
      organizationId: input.organizationId,
      offeringId: existing.offeringId,
      variantId: existing.variantId,
      locationId: existing.locationId,
    });
    if (offering === undefined) throw recordNotFound();

    const { startsAt, endsAt, blockedEndsAt } = await resolveRescheduleBounds({
      offering,
      requestedStartsAt,
      quantity: existing.quantity,
      timeZoneReader: this.dependencies.timeZone,
      organizationId: input.organizationId,
    });

    const preferredId = input.resourceId ?? existing.resourceIds[0];
    if (preferredId === undefined) throw recordNotFound();
    const resourceId = asId<ResourceId>(preferredId);
    const resource = await this.dependencies.resources.findById(resourceId);
    if (resource === undefined) throw recordNotFound();

    const updated = existing.transition("reschedule", {
      now: this.dependencies.clock.now(),
      actorUserId: input.actorUserId,
      reschedule: {
        startsAt,
        endsAt,
        blockedEndsAt,
        resourceIds: [resource.resourceId],
        providerMemberId: resource.memberId,
      },
    });

    let persisted = updated;
    await runWithTxnRetry(this.dependencies.unitOfWork, async () => {
      persisted = await persistRescheduleInTxn({
        dependencies: this.dependencies,
        organizationId: input.organizationId,
        bookingId: input.bookingId,
        version: input.version,
        existing,
        updated,
        resource: { resourceId: resource.resourceId, capacity: resource.capacity },
        startsAt,
        blockedEndsAt,
      });
    });

    return toBookingResponse(persisted);
  }
}
