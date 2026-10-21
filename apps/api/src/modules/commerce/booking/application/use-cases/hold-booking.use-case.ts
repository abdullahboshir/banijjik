import { BOOKING_SOURCE, type BookingResponse } from "@banijjik/contracts/booking";
import type { OrganizationId, ResourceId, UserId } from "@banijjik/ids";
import type { BookingHoldBody } from "@banijjik/validation/booking";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { assertLocationAllowed } from "../booking-slot-selection.js";
import { runWithTxnRetry } from "../run-with-txn-retry.js";
import { assembleHoldBooking } from "../hold-booking-assembler.js";
import { persistHoldBooking } from "../hold-booking-persist.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceRepository,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type {
  BookingOfferingReader,
  BookingSettingsReader,
  ContactCreator,
  PriceQuoterPort,
} from "../ports/booking-context-ports.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";

export interface HoldBookingDependencies {
  readonly bookings: BookingRepository;
  readonly resources: ResourceRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly offerings: BookingOfferingReader;
  readonly settings: BookingSettingsReader;
  readonly quoter: PriceQuoterPort;
  readonly contacts: ContactCreator;
  readonly timeZone: { read(organizationId: OrganizationId): Promise<string> };
  readonly timeOff: {
    listOverlapping(
      resourceId: ResourceId,
      from: Date,
      to: Date,
    ): Promise<readonly { startsAt: Date; endsAt: Date }[]>;
  };
}

export class HoldBookingUseCase {
  constructor(private readonly dependencies: HoldBookingDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly body: BookingHoldBody;
    readonly source?: typeof BOOKING_SOURCE.STOREFRONT;
  }): Promise<BookingResponse> {
    assertLocationAllowed(input.body.locationId, input.allowedLocationIds);
    return runWithTxnRetry(this.dependencies.unitOfWork, async () => {
      const assembled = await assembleHoldBooking({
        dependencies: this.dependencies,
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        allowedLocationIds: input.allowedLocationIds,
        body: input.body,
        source: input.source ?? BOOKING_SOURCE.STOREFRONT,
      });
      return persistHoldBooking({
        dependencies: this.dependencies,
        organizationId: input.organizationId,
        booking: assembled.booking,
        resourceId: assembled.resourceId,
        resourceCapacity: assembled.resourceCapacity,
        startsAt: assembled.startsAt,
        blockedEndsAt: assembled.blockedEndsAt,
      });
    });
  }
}
