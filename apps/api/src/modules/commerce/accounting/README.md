# accounting (SYSTEM)

Double-entry journal posting from payment, booking, expense, order and stock events (`11 §10`, ADR-138).

- Seeds system accounts on `organization.organization.created` and via idempotent catch-up; ensures `ACCOUNTS_PAYABLE` on first use for older organizations.
- ORDERED handlers: `accounting.postPayments`, `accounting.postBookings`, `accounting.postExpenses`, `accounting.postCommission`, `accounting.postOrders` (`streamPrefixes: ["order:"]`).
- UNORDERED handler: `accounting.postStock`.
- Payment, booking, commission, order and stock handlers register only when their posting-source adapter is supplied.
- Order posting (ADR-138): revenue recognized on `sales.order.completed`, advances held settled from `RequestAdvanceReader`, and COGS posted from SALE movements.
- Stock posting (ADR-138): receipts funded via CASH, BKASH, NAGAD, BANK, or `ACCOUNTS_PAYABLE` (on credit); opening stock against `OPENING_BALANCE`; adjustments and damage write-offs to `OTHER_INCOME` or `DAMAGE_LOSS`.
- Commission (ADR-135): an accrual is Dr `COMMISSION_EXPENSE` / Cr `COMMISSION_PAYABLE`; a negative adjustment is the mirror; a payout is Dr `COMMISSION_PAYABLE` / Cr the method account. Drafts live in `domain/commission-posting-rules.ts`.
- Read API: accounts, journal, trial balance (`accounting.ledger.read`). No manual writes (3.8b).
