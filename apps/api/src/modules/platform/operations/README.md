# platform/operations

The failed-events screens of the platform panel (card 3.8a, ADR-115). It owns no data: the dead letters,
the outbox and the stream positions belong to the event kernel (`kernel/events`), and this module is the
operator's way to act on them.

- `GET /platform/event-dead-letters?status=` and `POST …/{eventDeadLetterId}/replay` or `…/skip`
  (`platform.events.read`, `platform.events.replay`; SUPER_ADMIN). A replay is a request: the worker's
  replayer removes the failed queue job and adds a new one with fresh attempts. A skip needs a reason and,
  for an ORDERED handler, moves the stream position past the event, only when the position is right before it.
- `GET /platform/dead-outbox-events` and `POST …/{eventId}/replay`: an outbox event that could not be
  handed to the queue goes back to PENDING.
- Every action is audited in the platform audit log.

It also owns the platform's host routing record (card 4.2 part A1, ADR-P4-B). `HostClaim` is one global
row per host name because a per-organization unique index cannot keep a host unique across organizations.
`MongoHostClaims` reserves a host for a site domain and generation, disables it on removal (a 24-hour
quarantine before anyone may claim it again) and resolves a request's Host. It stores no tenant content;
the tenant `SiteDomain` belongs to `commerce/website` (part A2). Host names are normalized and checked
against the platform reservations before a claim is written. Callers pass `HostnameReservations`;
A2I wires `baseDomain` from `config.storefront` and `reservedHostnames: []` until C1.
