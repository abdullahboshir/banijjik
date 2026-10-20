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
import type { BookingOfferingReader } from "../ports/booking-context-ports.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";
import { runWithTxnRetry } from "../run-with-txn-retry.js";

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
    const startsAt = new Date(input.startsAt);
    const offering = await this.dependencies.offerings.readServiceOffering({
      organizationId: input.organizationId,
      offeringId: existing.offeringId,
      variantId: existing.variantId,
      locationId: existing.locationId,
    });
    if (offering === undefined) throw recordNotFound();
    const { endsAt, blockedEndsAt } = slotBounds(
      startsAt,
      offering.durationMinutes,
      offering.service.bufferAfterMinutes,
    );
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
        resource,
        startsAt,
        blockedEndsAt,
      });
    });

    return toBookingResponse(persisted);
  }
}
