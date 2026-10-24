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
- Cancel credits net paid once. A paid order without a contact needs a refund or contact first.
- INSTANT and PICKUP are served now; shipping methods and statuses wait for Phase 5.
- Hourly `sales.expireDrafts` and `sales.autoCancelPlaced` are idempotent per organization;
  request-less settings resolution is supported by card 3.19.
