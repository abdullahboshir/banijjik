# commerce/booking

Service appointments: resources, availability, bookings and scheduled hold/no-show jobs (card 3.6).

- **Kinds provided:** `SERVICE` (RENTAL/EVENT in card 3.6b).
- **Capacity:** 5-minute `resource_slot_usages` counters; conditional `$inc` per bucket inside the booking transaction.
- **API:** `GET /availability`, `GET/POST /bookings`, `POST /bookings/holds`, transitions (`confirm`, `request`, `check-in`, `complete`, `no-show`, `reschedule`, `cancel`), resource CRUD.
- **Deposits:** computed and stored; payment enforcement arrives with card 3.8.
- **Jobs:** `booking.expireHolds` (1 min), `booking.markNoShows` (5 min), registered via `registerBookingScheduledJobs`.
