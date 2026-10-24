# commerce/booking

Service appointments, rentals and event seats: resources, availability, bookings, event
sessions and scheduled hold/no-show/auto-complete/session-cancel jobs (cards 3.6, 3.6b A1-A3).

- **Kinds provided:** `SERVICE`, `RENTAL`, `EVENT`.
- **Capacity:** 5-minute `resource_slot_usages` counters; conditional `$inc` per bucket inside the booking transaction.
- **Rentals:** Rate units `HOUR`, `DAY` (24h calendar step in org tz), `NIGHT` (snapped to checkInTime/checkOutTime). 31-day duration cap, quantity units validation.
- **API:** `GET /availability`, `GET/POST /bookings`, `POST /bookings/holds`, transitions (`confirm`, `request`, `check-in`, `complete`, `no-show`, `reschedule`, `cancel`), resource CRUD.
- **Deposits:** computed, stored, and enforced at confirmation via `DepositCheckPort` (card 3.8). Rental fixed `depositAmount` support.
- **Jobs:** `booking.expireHolds` (1 min), `booking.markNoShows` (5 min), `booking.autoComplete` (5 min), `booking.cancelEventSession` (1 min), registered via `registerBookingScheduledJobs`.
- **Accounting posting (card 3.25):** `BookingPostingSource` uses the organization's timezone (`endsAt` for completed bookings; status change timestamp for cancellation-fee and no-show entries); `advancesToSettle` queries `RequestAdvanceReader` in payment for held `BEFORE_REVENUE` funds (never the required deposit).

## Event sessions (3.6b A2)

`GET/POST /event-sessions`, `GET/PATCH /event-sessions/:eventSessionId` and
`POST /event-sessions/:eventSessionId/cancel` manage location-owned, versioned sessions.
Sessions accept active EVENT offerings and active variants available at the location.
A sold seat locks session times; capacity cannot fall below sold seats.
OWNER and MANAGER manage sessions; STAFF and VIEWER can read them.
Cancelling a session only marks it CANCELLED; the `booking.cancelEventSession` job settles
its bookings afterwards.

## Event bookings (3.6b A3)

An EVENT booking is sold by seats, not by `resource_slot_usages` rows. It names an
`eventSessionId` and copies the session's `startsAt`/`endsAt`; resources and
`providerMemberId` play no part. A `variantId` means a seat class, and the session must
belong to that offering, seat class and location, and still be SCHEDULED
(`BOOKING_EVENT_SESSION_NOT_OPEN`). Sales close
`kindDetails.salesCloseMinutesBefore` minutes before the start
(`BOOKING_EVENT_SALES_CLOSED`).

- **Capacity:** `reserveSeats` bumps the session's `seatsSold` inside the booking
  transaction with one conditional `$expr` update, so two buyers of the last seat answer
  `409 SLOT_UNAVAILABLE`. A reschedule moves the seats between sessions in one transaction.
- **Release:** expiry, hold cancel and rental-style cancel release; a no-show keeps the
  seat (nobody came, the seat was still sold). `releaseSeats` refuses a counter it cannot
  cover, and the versioned status write makes release happen once.
- **Session cancel:** `booking.cancelEventSession` (1 min) walks unsettled CANCELLED
  sessions, cancels each booking with a full refund (`CANCEL_FEE_MODE.NONE`), and stamps
  `bookingsSettledAt` only when the session has no open booking left. Batches are capped,
  so a large session settles over several runs.
- **Completion:** `booking.autoComplete` completes a past SCHEDULED session and its
  CHECKED_IN event bookings.
