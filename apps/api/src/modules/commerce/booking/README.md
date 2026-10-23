# commerce/booking

Service appointments and rentals: resources, availability, bookings and scheduled hold/no-show/auto-complete jobs (cards 3.6, 3.6b A1).

- **Kinds provided:** `SERVICE`, `RENTAL` (EVENT in card 3.6b A2/A3).
- **Capacity:** 5-minute `resource_slot_usages` counters; conditional `$inc` per bucket inside the booking transaction.
- **Rentals:** Rate units `HOUR`, `DAY` (24h calendar step in org tz), `NIGHT` (snapped to checkInTime/checkOutTime). 31-day duration cap, quantity units validation.
- **API:** `GET /availability`, `GET/POST /bookings`, `POST /bookings/holds`, transitions (`confirm`, `request`, `check-in`, `complete`, `no-show`, `reschedule`, `cancel`), resource CRUD.
- **Deposits:** computed, stored, and enforced at confirmation via `DepositCheckPort` (card 3.8). Rental fixed `depositAmount` support.
- **Jobs:** `booking.expireHolds` (1 min), `booking.markNoShows` (5 min), `booking.autoComplete` (5 min), registered via `registerBookingScheduledJobs`.
