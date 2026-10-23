import { DomainRuleError, ERROR_CODE } from "@banijjik/contracts";
import { BOOKING_STATUS } from "@banijjik/contracts/booking";
import { asId, type BookingId } from "@banijjik/ids";
import { getRequestContext } from "../../../kernel/context/index.js";
import { buildOrganizationTimezoneReader } from "../../core/organization/index.js";
import { MongoBookingRepository } from "./infrastructure/mongo-booking.repositories.js";
import { businessDateOf, localDateTimeToUtc } from "./domain/timezone.js";

interface CheckInBookingQuery {
  readonly contactId: string;
  readonly locationId: string;
  readonly businessDate: string;
  readonly bookingId?: string;
}
interface ConfirmedBookingReader {
  findForCheckIn(input: CheckInBookingQuery): Promise<string | undefined>;
}
export function buildConfirmedBookingReader(): ConfirmedBookingReader {
  const bookings = new MongoBookingRepository();
  const timezones = buildOrganizationTimezoneReader();
  return {
    async findForCheckIn(input) {
      const organizationId = getRequestContext().organizationId;
      if (organizationId === undefined) throw new DomainRuleError({ code: ERROR_CODE.INTERNAL });
      const zone = await timezones.read(organizationId);
      if (zone === undefined) throw new DomainRuleError({ code: ERROR_CODE.NOT_FOUND });
      if (input.bookingId !== undefined) {
        const booking = await bookings.findById(asId<BookingId>(input.bookingId));
        if (
          booking === undefined ||
          booking.status !== BOOKING_STATUS.CONFIRMED ||
          booking.contactId !== input.contactId ||
          booking.locationId !== input.locationId
        )
          return undefined;
        return businessDateOf(booking.startsAt, zone) === input.businessDate
          ? booking.bookingId
          : undefined;
      }
      const tomorrow = new Date(input.businessDate);
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const rows = await bookings.list({
        page: 1,
        limit: 1,
        locationId: input.locationId,
        contactId: input.contactId,
        status: BOOKING_STATUS.CONFIRMED,
        from: localDateTimeToUtc(input.businessDate, "00:00", zone).toISOString(),
        to: new Date(
          localDateTimeToUtc(tomorrow.toISOString().slice(0, 10), "00:00", zone).getTime() - 1,
        ).toISOString(),
      });
      return rows.items[0]?.bookingId;
    },
  };
}
