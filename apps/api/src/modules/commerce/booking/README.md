# commerce/booking

Service appointments, rentals and event seats: resources, availability, bookings, event sessions and the scheduled jobs (cards 3.6, 3.6b A1-A3).

- **Kinds provided:** `SERVICE`, `RENTAL`, `EVENT`.
- **Capacity:** 5-minute `resource_slot_usages` counters; conditional `$inc` per bucket inside the booking transaction.
- **Rentals:** Rate units `HOUR`, `DAY` (24h calendar step in org tz), `NIGHT` (snapped to checkInTime/checkOutTime). 31-day duration cap, quantity units validation.
- **API:** `GET /availability`, `GET/POST /bookings`, `POST /bookings/holds`, transitions (`confirm`, `request`, `check-in`, `complete`, `no-show`, `reschedule`, `cancel`), resource CRUD.
- **Deposits:** computed, stored, and enforced at confirmation via `DepositCheckPort` (card 3.8). Rental fixed `depositAmount` support.
- **Event sessions (A2):** `GET/POST /event-sessions`, `GET/PATCH /event-sessions/:eventSessionId`, `POST …/cancel`. Location-owned and versioned; a sold seat locks the times and capacity cannot fall below seats sold. OWNER and MANAGER manage, STAFF and VIEWER read.
- **Event bookings (A3):** sold by seats, never by slots. The booking names `eventSessionId`, copies the session times and has no provider; its `variantId` is the seat class. The session must match the offering, seat class and location and be SCHEDULED, and sales close `salesCloseMinutesBefore` before the start.
- **Seats:** `reserveSeats` is one conditional `$expr` update inside the booking transaction, so two buyers of the last seat answer `409 SLOT_UNAVAILABLE`; `releaseSeats` refuses a counter it cannot cover. Cancel and expiry give seats back, a no-show keeps the sold seat, a reschedule moves seats between sessions in one transaction.
- **Session cancel and completion:** `booking.cancelEventSession` cancels a cancelled session's bookings with a full refund (`CANCEL_FEE_MODE.NONE`) and stamps `bookingsSettledAt` only when none is left; `booking.autoComplete` completes past sessions and their `CHECKED_IN` event bookings.
- **Jobs:** `booking.expireHolds` (1 min), `booking.markNoShows` (5 min), `booking.autoComplete` (5 min), `booking.cancelEventSession` (1 min), registered via `registerBookingScheduledJobs`.
- **Jobs:** `booking.expireHolds` (1 min), `booking.markNoShows` (5 min), `booking.autoComplete` (5 min), `booking.cancelEventSession` (1 min), registered via `registerBookingScheduledJobs`.
- **Accounting posting (card 3.25):** `BookingPostingSource` uses the organization's timezone (`endsAt` for completed bookings; status change timestamp for cancellation-fee and no-show entries); `advancesToSettle` queries `RequestAdvanceReader` in payment for held `BEFORE_REVENUE` funds (never the required deposit).
- **Gap (A3):** a session does not block its resources' slots, so the same hall can still be rented for those hours.
