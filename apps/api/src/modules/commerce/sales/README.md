# Sales (orders)

The product sale of `11 §4`: draft, place, confirm, pack, complete and cancel.
Totals come from the pricing quoter; stock effects from the inventory `StockLedger`.

## Layers

- `domain/`: Order aggregate, transitions, payment-status and advance rules, business dates.
- `application/`: use cases, line preparation, discount approval, settings and hourly jobs.
- `infrastructure/`: Mongo persistence and catalog/contact/timezone adapters.
- `presentation/`: controller and tenant routes.

## Rules worth knowing

- Draft, placed and updated orders accept PRODUCT lines only; prices never come from the client.
- Instant admin/POS sales and exchange new orders also accept effective ACTIVE SERVICE lines (card 3.40), including SLOT and WALK_IN_ONLY. A performer is optional and must be assignable at the sale location.
- Walk-in services hold no calendar or resource and never draw stock, even with legacy stock components. Returns refund their value without stock or COGS reversal; SERVICE commission rules accrue and reconcile by returned units.
- One order revenue journal splits goods between REVENUE_SERVICE and REVENUE_PRODUCT; discounts, tax and rounding keep their existing posting rules.
- ORDER number is assigned at place; INVOICE number at completion; drafts have neither.
- Stock reservations are keyed `(ORDER, orderId)` inside the transaction.
- Monthly limits count placed and instant orders; cancellation gives nothing back.
- Payment status uses real allocations and refunds; list pages batch summaries once.
- Place and instant sale initialize summaries; legacy orders get summaries on first payment.
- Edits cannot reduce totals below net paid. Confirm checks advance rules against net paid.
- Contact changes move the summary contact, but positive net payment locks the contact.
- Cancel credits net paid once. Paid orders without a contact must be refunded first.
- Completion touches payment summary (`initializeSummary` then `updateTotal`) to conflict with racing payments (3.24 R3).
- Exports `buildOrderPostingSourceAdapter` to supply snapshots to `accounting.postOrders`.
- INSTANT and PICKUP are served now; shipping methods and statuses wait for Phase 5.
- Hourly `sales.expireDrafts` and `sales.autoCancelPlaced` are idempotent per organization.
- Exchange (3.5b A3, `POST /orders/:orderId/exchange` and `/exchange/preview`): return and new order in one unit of work; the return restocks first and its store credit pays first (`planSalesExchange`).
