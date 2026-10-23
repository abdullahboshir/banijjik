# commerce/booking

Service appointments and rentals: resources, availability, bookings and scheduled hold/no-show/auto-complete jobs (cards 3.6, 3.6b A1).

- **Kinds provided:** `SERVICE`, `RENTAL` (EVENT in card 3.6b A2/A3).
- **Capacity:** 5-minute `resource_slot_usages` counters; conditional `$inc` per bucket inside the booking transaction.
- **Rentals:** Rate units `HOUR`, `DAY` (24h calendar step in org tz), `NIGHT` (snapped to checkInTime/checkOutTime). 31-day duration cap, quantity units validation.
- **API:** `GET /availability`, `GET/POST /bookings`, `POST /bookings/holds`, transitions (`confirm`, `request`, `check-in`, `complete`, `no-show`, `reschedule`, `cancel`), resource CRUD.
- **Deposits:** computed, stored, and enforced at confirmation via `DepositCheckPort` (card 3.8). Rental fixed `depositAmount` support.
- **Jobs:** `booking.expireHolds` (1 min), `booking.markNoShows` (5 min), `booking.autoComplete` (5 min), registered via `registerBookingScheduledJobs`.
- **Accounting posting (card 3.25):** `BookingPostingSource` uses the organization's timezone (`endsAt` for completed bookings; status change timestamp for cancellation-fee and no-show entries); `advancesToSettle` queries `RequestAdvanceReader` in payment for held `BEFORE_REVENUE` funds (never the required deposit).

## Event sessions (3.6b A2)

`GET/POST /event-sessions`, `GET/PATCH /event-sessions/:eventSessionId` and
`POST /event-sessions/:eventSessionId/cancel` manage location-owned, versioned sessions.
Sessions accept active EVENT offerings and active variants available at the location.
A sold seat locks session times; capacity cannot fall below sold seats.
OWNER and MANAGER manage sessions; STAFF and VIEWER can read them.

A2 cancellation marks the session CANCELLED. A3 owns seat reservation/release, booking
cancellation batches and deposit settlement. A3 also merges the narrow
`EventSessionOfferingReader` into the shared kind-keyed reader and removes its duplicate
location helper. No job or booking mutation is introduced here.
