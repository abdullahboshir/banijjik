import { BOOKING_SOURCE, type BookingResponse } from "@banijjik/contracts/booking";
import type { OrganizationId, ResourceId, UserId } from "@banijjik/ids";
import type { BookingCreateBody } from "@banijjik/validation/booking";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { assertLocationAllowed } from "../booking-slot-selection.js";
import { createBookingWithRetries } from "../create-booking-attempt.js";
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
import type { DepositCheckPort } from "../ports/payment-ports.js";
import type { EventSessionRepository } from "../ports/event-session-repository.js";
import { BOOKING_EVENT_TYPE } from "@banijjik/contracts/booking";

export interface BookingEventPublisher {
  publish(
    type: (typeof BOOKING_EVENT_TYPE)[keyof typeof BOOKING_EVENT_TYPE],
    payload:
      | { readonly bookingId: string }
      | { readonly resourceId: string }
      | { readonly bookingId: string; readonly reminderAt: string }
      | { readonly eventSessionId: string },
    options: { readonly orderingKey: string },
  ): Promise<void>;
}

export interface CreateBookingDependencies {
  readonly bookings: BookingRepository;
  readonly resources: ResourceRepository;
  readonly slots: ResourceSlotUsagePort;
  readonly sessions: EventSessionRepository;
  readonly unitOfWork: BookingUnitOfWork;
  readonly events: BookingEventPublisher;
  readonly audit: AuditRecorder;
  readonly clock: Clock;
  readonly offerings: BookingOfferingReader;
  readonly settings: BookingSettingsReader;
  readonly quoter: PriceQuoterPort;
  readonly contacts: ContactCreator;
  readonly depositCheck: DepositCheckPort;
  readonly timeZone: { read(organizationId: OrganizationId): Promise<string> };
  readonly timeOff: {
    listOverlapping(
      resourceId: ResourceId,
      from: Date,
      to: Date,
    ): Promise<readonly { startsAt: Date; endsAt: Date }[]>;
  };
}

export class CreateBookingUseCase {
  constructor(private readonly dependencies: CreateBookingDependencies) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
    readonly body: BookingCreateBody;
    readonly source?: typeof BOOKING_SOURCE.STAFF;
  }): Promise<BookingResponse> {
    assertLocationAllowed(input.body.locationId, input.allowedLocationIds);
    return createBookingWithRetries({
      dependencies: this.dependencies,
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      allowedLocationIds: input.allowedLocationIds,
      body: input.body,
    });
  }
}
