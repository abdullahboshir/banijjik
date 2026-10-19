# accounting (SYSTEM)

Double-entry journal posting from payment, booking and expense events (`11 §10`).

- Seeds system accounts on `organization.organization.created` and via idempotent catch-up.
- ORDERED handlers: `accounting.postPayments`, `accounting.postBookings`, `accounting.postExpenses`.
- Payment and booking handlers register only when a posting-source adapter is supplied.
- Read API: accounts, journal, trial balance (`accounting.ledger.read`). No manual writes (3.8b).
