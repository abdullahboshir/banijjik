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
- Place and instant sale initialize summaries; legacy orders get summaries on first payment.
- Edits cannot reduce totals below net paid. Confirm checks advance rules against net paid.
- Contact changes move the summary contact, but positive net payment locks the contact.
- Cancel credits net paid once. Paid orders without a contact must be refunded first.
- Completion touches payment summary (`initializeSummary` then `updateTotal`) to conflict with racing payments (3.24 R3).
- Exports `buildOrderPostingSourceAdapter` to supply snapshots to `accounting.postOrders`.
- INSTANT and PICKUP are served now; shipping methods and statuses wait for Phase 5.
- Hourly `sales.expireDrafts` and `sales.autoCancelPlaced` are idempotent per organization.

## Exchange (3.5b A3)

`POST /orders/:orderId/exchange` takes a return of goods from a completed order and sells a new order in one unit of work. The return credit (always store credit) pays the new order first; `planSalesExchange` in `domain/` holds the money. The return restocks before the new sale reserves, so a same-variant swap works. `POST …/exchange/preview` gives the same numbers without writing. Approvals and the discount approval are the same as a return and an instant sale. See `docs/handoffs/3.5b-api-a3.md`.
