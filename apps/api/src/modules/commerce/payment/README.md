# Payment Module (`commerce/payment`)

Core module for recording, refunding and reversing tenant payments, tracking request dues, and managing store credit (card 3.8).

## Scope

- Records customer payments across cash, mobile money (bKash, Nagad), bank, card, and store credit.
- Enforces bKash/Nagad reference uniqueness per organization and method.
- Append-only payments sequence `PAYMENT`.
- Pluggable request reader registry for allocating payments to bookings and orders (enrollments follow).
- Automatic overpayment to store credit (when contactId provided) or cash change.
- Reversals mirror allocations and require `PAYMENT_REVERSAL` approval token.
- Refunds validate against net paid amounts and require approval (unless manager and setting allows).
- Dues projection `PaymentSummary` tracking total, allocated, refunded and paymentStatus (`UNPAID | PARTIAL | PAID | REFUNDED`).
- Store credit append-only ledger with version-guarded balance check.
- Daily `payment.expireStoreCredit` scheduled job.
- Event stream ordered by `paymentAccount:<organizationId>`.
- Provides `PaymentPostingSource` adapter for accounting journal entries.
- Provides `RequestAdvanceReader` (`buildRequestAdvanceReader`) to calculate net `BEFORE_REVENUE` funds currently held on requests (IN minus refunds and reversals, clamped ≥ 0) backed by the `{ organizationId: 1, "allocations.requestType": 1, "allocations.requestId": 1 }` multikey index (card 3.25).
- The shared routes factory registers both BOOKING and ORDER readers for HTTP and posting.
  ORDER reads use grandTotal and refuse drafts/cancelled orders; COMPLETED is AFTER_REVENUE.
- Request-neutral termination settlement credits net paid on cancellation; booking retains its
  existing deposit-policy wrapper. Orders cancel with no retained fee.
- Order summaries initialize at place/instant sale, or lazily on the first legacy-order payment.
  Page reads use one organization/request-type/request-ID-indexed batch query.
- Unpaid order contact edits move the summary contact transactionally; net paid locks the contact.
