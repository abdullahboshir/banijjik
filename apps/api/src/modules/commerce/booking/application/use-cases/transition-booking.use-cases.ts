import { AUDIT_ACTION } from "@banijjik/contracts";
import {
  BOOKING_EVENT_TYPE,
  BOOKING_FREE_CANCEL_HOURS_DEFAULT,
  BOOKING_NO_SHOW_FEE_DEFAULT,
} from "@banijjik/contracts/booking";
import type { BookingResponse } from "@banijjik/contracts/booking";
import type { BookingId, OrganizationId, UserId } from "@banijjik/ids";
import type { AuditRecorder } from "../../../../../kernel/audit/index.js";
import type { Clock } from "../../../../../kernel/time/index.js";
import { recordNotFound } from "../../domain/errors.js";
import { assertLocationAllowed, bookingOrderingKey } from "../booking-transition-shared.js";
import { toBookingResponse } from "../booking-views.js";
import type { BookingSettingsReader } from "../ports/booking-context-ports.js";
import type {
  BookingRepository,
  BookingUnitOfWork,
  ResourceSlotUsagePort,
} from "../ports/booking-repositories.js";
import type { DepositCheckPort } from "../ports/payment-ports.js";
import type { BookingEventPublisher } from "./create-booking.use-case.js";

export { GetBookingUseCase } from "./get-booking.use-case.js";
export { RescheduleBookingUseCase } from "./reschedule-booking.use-case.js";
export { CancelBookingUseCase } from "./cancel-booking.use-case.js";
export {
  CheckInBookingUseCase,
  CompleteBookingUseCase,
  ConfirmBookingUseCase,
  RequestFromHoldUseCase,
} from "./booking-status-transitions.use-cases.js";

async function settleNoShowDeposit(input: {
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
    mode: "NO_SHOW",
    freeCancelHours: input.settings?.freeCancelHours ?? BOOKING_FREE_CANCEL_HOURS_DEFAULT,
    feeMode: input.settings?.noShowFee ?? BOOKING_NO_SHOW_FEE_DEFAULT,
    feePercent: input.settings?.depositValue ?? 0,
    actorUserId: input.actorUserId,
    now: input.now,
  });
}

export class NoShowBookingUseCase {
  constructor(
    private readonly dependencies: {
      readonly bookings: BookingRepository;
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
    readonly actorUserId: UserId | null;
    readonly allowedLocationIds: readonly string[] | "ALL";
  }): Promise<BookingResponse> {
    const existing = await this.dependencies.bookings.findById(input.bookingId);
    if (existing === undefined) throw recordNotFound();
    assertLocationAllowed(existing.locationId, input.allowedLocationIds);
    const now = this.dependencies.clock.now();
    const settings = await this.dependencies.settings?.read(input.organizationId);
    let persisted = existing.transition("noShow", { now, actorUserId: input.actorUserId });
    await this.dependencies.unitOfWork.run(async () => {
      const resourceId = existing.resourceIds[0];
      if (resourceId !== undefined) {
        await this.dependencies.slots.releaseCapacity({
          organizationId: input.organizationId,
          resourceId,
          startsAt: existing.startsAt,
          blockedEndsAt: existing.blockedEndsAt,
        });
      }
      const settlement = await settleNoShowDeposit({
        depositCheck: this.dependencies.depositCheck,
        organizationId: input.organizationId,
        existing,
        settings,
        actorUserId: input.actorUserId,
        now,
      });
      const marked = existing.transition("noShow", {
        now,
        actorUserId: input.actorUserId,
        cancellationFeeRetained: settlement?.feeRetained ?? null,
      });
      persisted = await this.dependencies.bookings.update(marked, input.version);
      await this.dependencies.events.publish(
        BOOKING_EVENT_TYPE.BOOKING_NO_SHOW_MARKED,
        { bookingId: persisted.bookingId },
        { orderingKey: bookingOrderingKey(persisted.bookingId) },
      );
      await this.dependencies.audit.record({
        action: AUDIT_ACTION.BOOKING_NO_SHOW,
        entityType: "booking",
        entityId: persisted.bookingId,
        changes: {},
      });
    });
    return toBookingResponse(persisted);
  }
}
