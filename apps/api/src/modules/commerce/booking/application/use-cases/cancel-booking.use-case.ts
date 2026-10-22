import { AUDIT_ACTION } from "@banijjik/contracts";
import {
  BOOKING_EVENT_TYPE,
  BOOKING_FREE_CANCEL_HOURS_DEFAULT,
  BOOKING_LATE_CANCEL_FEE_DEFAULT,
  BOOKING_STATUS,
} from "@banijjik/contracts/booking";
import type { BookingResponse } from "@banijjik/contracts/booking";
import type { BookingId, OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { recordNotFound } from "../../domain/errors.js";
import { assertLocationAllowed } from "../booking-transition-shared.js";
import { toBookingResponse } from "../booking-views.js";
import type { BookingSettingsReader } from "../ports/booking-context-ports.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceRepository,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type { DepositCheckPort } from "../ports/payment-ports.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";

const CAPACITY_HOLDING_STATUSES = new Set<string>([
  BOOKING_STATUS.HELD,
  BOOKING_STATUS.REQUESTED,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.CHECKED_IN,
]);

async function releaseCancelCapacity(
  slots: ResourceSlotUsagePort,
  organizationId: OrganizationId,
  existing: import("../../domain/booking.entity.js").Booking,
): Promise<void> {
  if (!CAPACITY_HOLDING_STATUSES.has(existing.status)) return;
  const resourceId = existing.resourceIds[0];
  if (resourceId === undefined) return;
  await slots.releaseCapacity({
    organizationId,
    resourceId,
    startsAt: existing.startsAt,
    blockedEndsAt: existing.blockedEndsAt,
  });
}

async function settleCancelDeposit(input: {
  readonly depositCheck: DepositCheckPort | undefined;
  readonly organizationId: OrganizationId;
  readonly existing: import("../../domain/booking.entity.js").Booking;
  readonly settings: Awaited<ReturnType<BookingSettingsReader["read"]>> | undefined;
  readonly actorUserId: UserId | null;
  readonly now: Date;
}) {
  return input.depositCheck?.settleBookingTermination?.({
    organizationId: input.organizationId,
    requestId: input.existing.bookingId,
    contactId: input.existing.contactId,
    locationId: input.existing.locationId,
    startsAt: input.existing.startsAt,
    depositRequired: input.existing.depositRequired,
    priceTotal: input.existing.price.total,
    mode: "CANCEL",
    freeCancelHours: input.settings?.freeCancelHours ?? BOOKING_FREE_CANCEL_HOURS_DEFAULT,
    feeMode: input.settings?.lateCancelFee ?? BOOKING_LATE_CANCEL_FEE_DEFAULT,
    feePercent: input.settings?.depositValue ?? 0,
    actorUserId: input.actorUserId,
    now: input.now,
  });
}

export class CancelBookingUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
      readonly resources: ResourceRepository;
      readonly slots: ResourceSlotUsagePort;
      readonly unitOfWork: BookingUnitOfWork;
      readonly events: BookingEventPublisher;
      readonly audit: AuditRecorder;
      readonly clock: Clock;
      readonly settings?: BookingSettingsReader;
      readonly depositCheck?: DepositCheckPort;
    },
  ) {}

  async execute(input: {
    readonly organizationId: OrganizationId;
    readonly bookingId: BookingId;
    readonly version: number;
    readonly reason: string;
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    const existing = await this.dependencies.bookings.findById(input.bookingId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const now = this.dependencies.clock.now();
    const settings = await this.dependencies.settings?.read(input.organizationId);
    let persisted = existing.transition("cancel", {
      now,
      actorUserId: input.actorUserId,
      note: input.reason,
    });
    await this.dependencies.unitOfWork.run(async () => {
      await releaseCancelCapacity(this.dependencies.slots, input.organizationId, existing);
      const settlement = await settleCancelDeposit({
        depositCheck: this.dependencies.depositCheck,
        organizationId: input.organizationId,
        existing,
        settings,
        actorUserId: input.actorUserId,
        now,
      });
      const cancelled = existing.transition("cancel", {
        now,
        actorUserId: input.actorUserId,
        note: input.reason,
        cancellationFeeRetained: settlement?.feeRetained ?? null,
      });
      persisted = await this.dependencies.bookings.update(cancelled, input.version);
      await this.dependencies.events.publish(
        BOOKING_EVENT_TYPE.BOOKING_CANCELLED,
        { bookingId: persisted.bookingId },
        { orderingKey: `booking:${persisted.bookingId}` },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.BOOKING_CANCELLED,
        entityType: "booking",
        entityId: persisted.bookingId,
        changes: { reason: { to: input.reason } },
      });
    });
    return toBookingResponse(persisted);
  }
}
