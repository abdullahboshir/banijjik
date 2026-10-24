# accounting (SYSTEM)

Double-entry journal posting from payment, booking and expense events (`11 §10`).

- Seeds system accounts on `organization.organization.created` and via idempotent catch-up.
- ORDERED handlers: `accounting.postPayments`, `accounting.postBookings`, `accounting.postExpenses`, `accounting.postCommission`.
- Payment, booking and commission handlers register only when a posting-source adapter is supplied (commission is an optional module).
- Commission (ADR-135): an accrual is Dr `COMMISSION_EXPENSE` / Cr `COMMISSION_PAYABLE`; a negative adjustment is the mirror; a payout is Dr `COMMISSION_PAYABLE` / Cr the method account. Drafts live in `domain/commission-posting-rules.ts`.
- Read API: accounts, journal, trial balance (`accounting.ledger.read`). No manual writes (3.8b).
