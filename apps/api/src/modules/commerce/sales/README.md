# Sales (orders)

The product sale of `11 §4`: draft, place, confirm, pack, complete and cancel.
Totals come from the pricing quoter; stock effects from the inventory `StockLedger`.

## Layers

- `domain/`: Order aggregate, transitions, payment-status and advance rules, business dates.
- `application/`: use cases, line preparation, discount approval, settings and hourly jobs.
- `infrastructure/`: Mongo persistence and catalog/contact/timezone adapters.
- `presentation/`: controller and tenant routes.

## Rules worth knowing

- Lines are PRODUCT offerings only; prices never come from the client.
- ORDER number is assigned at place; INVOICE number at completion; drafts have neither.
- Stock reservations are keyed `(ORDER, orderId)` inside the transaction.
- Monthly limits count placed and instant orders; cancellation gives nothing back.
- Payment status uses real allocations and refunds; list pages batch summaries once.
- Place and instant sale initialize summaries. A legacy order's first payment initializes a
  missing summary with grandTotal (3.23 Amendment 1); no migration is needed.
- Edits cannot reduce totals below net paid. Confirm checks `sales.advance.required` and
  `sales.advance.value` against net paid in its transaction.
- Contact changes move the summary contact in the edit transaction, but a positive net payment
  locks the contact until staff refund (3.23 Amendment 2).
- Cancel credits net paid once. Paid orders without a contact must be refunded first.
- Completion touches the payment summary (`initializeSummary` then `updateTotal`) inside the transaction to force write conflicts against racing `BEFORE_REVENUE` payments (3.24 R3).
- Exports `buildOrderPostingSourceAdapter` to supply `OrderPostingSource` snapshots (totals, stored business date, location, cogs, advances to settle) to `accounting.postOrders`.
- INSTANT and PICKUP are served now; shipping methods and statuses wait for Phase 5.
- Hourly `sales.expireDrafts` and `sales.autoCancelPlaced` are idempotent per organization;
  request-less settings resolution is supported by card 3.19.
