# Sales (orders)

The product sale of `11 §4`: draft, place, confirm, pack, complete and cancel. Totals come only
from the pricing quoter; stock effects only from the inventory `StockLedger`.

## Layers

- `domain/`: the `Order` aggregate and its transitions, the payment-status rule, business dates.
- `application/`: use cases (create, update, delete, place, confirm, pack, complete, cancel,
  instant, get, list), the line preparation that reads catalog facts plus a quote, the discount
  approval gate, settings and the two scheduled jobs.
- `infrastructure/`: Mongo schema, mapper, order and monthly-counter repositories, model
  registration, and the catalog/contact/timezone adapters.
- `presentation/`: controller and tenant routes.

## Rules worth knowing

- Lines are PRODUCT offerings only; totals come from `PriceQuoter.quote`, never from the client.
- The order number comes from the `ORDER` sequence at place; the invoice number from `INVOICE`
  at completion. A draft has neither.
- A reservation is keyed `(ORDER, orderId)` and lives inside the order's transaction.
- The monthly order counter counts placed and instant orders; cancelling gives nothing back.
- `paymentStatus` is derived; card 3.8 replaces the zero `PaymentSummaryReader` stub.
- Card 3.5a serves INSTANT and PICKUP only; COURIER, OWN_RIDER and the shipping statuses are
  declared and refused until Phase 5.
