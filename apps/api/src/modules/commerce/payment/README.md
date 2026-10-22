# Payment Module (`commerce/payment`)

Core module for recording, refunding and reversing tenant payments, tracking request dues, and managing store credit (card 3.8).

## Scope

- Records customer payments across cash, mobile money (bKash, Nagad), bank, card, and store credit.
- Enforces bKash/Nagad reference uniqueness per organization and method.
- Append-only payments sequence `PAYMENT`.
- Pluggable request reader registry for allocating payments to bookings (and later orders, enrollments).
- Automatic overpayment to store credit (when contactId provided) or cash change.
- Reversals mirror allocations and require `PAYMENT_REVERSAL` approval token.
- Refunds validate against net paid amounts and require approval (unless manager and setting allows).
- Dues projection `PaymentSummary` tracking total, allocated, refunded and paymentStatus (`UNPAID | PARTIAL | PAID | REFUNDED`).
- Store credit append-only ledger with version-guarded balance check.
- Daily `payment.expireStoreCredit` scheduled job.
- Event stream ordered by `paymentAccount:<organizationId>`.
- Provides `PaymentPostingSource` adapter for accounting journal entries.
