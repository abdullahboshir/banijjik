import type { BookingPostingSnapshot } from "../../domain/posting-rules.js";

/**
 * Reads booking module data for journal lines. Card 3.6 supplies the adapter; until then booking
 * handlers are not registered (lead clarification).
 */
export interface BookingPostingSource {
  readBooking(bookingId: string): Promise<BookingPostingSnapshot | undefined>;
}
