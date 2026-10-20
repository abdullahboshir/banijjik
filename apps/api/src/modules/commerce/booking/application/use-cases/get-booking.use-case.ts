import type { BookingResponse } from "@banijjik/contracts/booking";
import type { BookingId } from "@banijjik/ids";
import { recordNotFound } from "../../domain/errors.js";
import { toBookingResponse } from "../booking-views.js";
import type { BookingRepository } from "../ports/booking-repositories.js";

export class GetBookingUseCase {
  constructor(private readonly bookings: BookingRepository) {}

  async execute(bookingId: BookingId): Promise<BookingResponse> {
    const booking = await this.bookings.findById(bookingId);
    if (booking === undefined) throw recordNotFound();
    return toBookingResponse(booking);
  }
}
