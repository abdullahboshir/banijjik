# Offerings & Request Lifecycles

Card D3 · Status: **approved by owner 2026-10-09** · Written 2026-10-09 · Based on `main` at `b596e0f`

This doc fixes the core schema of each offering kind and the full lifecycle of every request: states, who may move them, and what each move does to stock, money, ledgers, notifications and the bot. It is the contract for cards 3.2–3.10, 4.3 and 5.7–5.8. Any state, transition or side effect not listed here does not exist. A PLAN session that needs one adds it here first.

Inputs:
- `09` (entities §5, invariants §7), `10` (modules, permissions, settings, events)
- `13 §8.2` (status tones), `08` (bot tools)
- ADR-013 (money), ADR-014 (ledgers), ADR-026, ADR-044, ADR-047, ADR-051
- Proven manoxen rules, adapted: guide 15 (airtight sales return), guide 16 (discount hierarchy), guide 21 (sell → deliver flow)

Owner answers (2026-10-09):
- Store credit and exchange at launch.
- Manager PIN for refunds and large discounts.
- COD advance is an org setting, default off.

New decisions: §15 (ADR-061 to ADR-068).

---

## 1. Principles for every lifecycle
1. **State changes are use cases.** Every transition is one explicit use case (`ConfirmOrderUseCase`), never a generic `updateStatus(newStatus)`. An illegal transition throws `INVALID_TRANSITION` with the current state.
2. **One transaction per transition.** The request, its stock movements, payments, store-credit entries and outbox events are written in one `withTransaction()`. Journal entries are posted by the SYSTEM `accounting` module from outbox events, idempotently, keyed by `(sourceType, sourceId, postingKey)` (§10).
3. **Snapshot at creation, recompute on edit.** Names, prices, taxes and addresses are copied into the request. Totals are recomputed server-side on every change (never trusted from the client). Catalog edits never touch existing requests.
4. **Money is allocated once, at the line.** Order-level discounts and taxes are allocated to lines when the order is priced (largest-remainder method, minor units). The result is stored as `lineNetTotal`. Returns and refunds later read these stored numbers and never re-derive them (manoxen guide 15 lesson).
5. **Fulfillment, payment and return are three separate dimensions.** `status` (fulfillment/lifecycle), `paymentStatus` (derived from allocations), `returnStatus` (derived from returns). Never encode payment in the lifecycle status.
6. **Version check on every transition** (`version`). Concurrent edits get `CONFLICT`, never a silent overwrite.
7. **Every transition emits an event** named `<module>.<entity>.<pastTenseVerb>`. Notifications, bot replies, reports and journals react to events. They never live inside the use case.

## 2. Offering kinds: core schemas (`Offering.kindDetails`)

Variant `price` means something different per kind:
- PRODUCT: per unit
- SERVICE: per booking
- PLAN: per period
- RENTAL: per rate unit
- EVENT: per seat

| Kind | `kindDetails` fields (all validated by Zod per kind) | Variant may override |
|---|---|---|
| `PRODUCT` | `requiresShipping` (bool, default true), `weightGrams?`, `dimensionsCm? {l,w,h}` | `weightGrams` |
| `SERVICE` | `durationMinutes` (5–1440), `bufferAfterMinutes` (default 0), `requiresResource` (bool), `resourceTypeKeys[]`, `bookingMode` (`SLOT` \| `WALK_IN_ONLY`), `maxAdvanceDays` (default 60), `depositRule?` (§5.4) | `durationMinutes` (short/long hair) |
| `PLAN` | `billingPeriod { unit: DAY\|WEEK\|MONTH\|YEAR, count }`, `admissionFee?: Money`, `sessionLimitPerPeriod?`, `capacity?` (max ACTIVE enrollments: batch seats), `startRule` (`ANY_DATE` \| `FIXED_DATES`), `startDates?[]` (business dates, with FIXED_DATES), `fixedTermPeriods?` (course length; null = open-ended), `autoRenewDefault` (bool), `freezeAllowed` (bool), `maxFreezeDaysPerYear?`, `securityDeposit?: Money` (refundable, ADR-074) | `billingPeriod` (1-month vs 3-month), `sessionLimitPerPeriod` |
| `RENTAL` | `rateUnit` (`HOUR` \| `DAY` \| `NIGHT`), `minUnits` (default 1), `maxUnits?`, `resourceTypeKeys[]`, `checkInTime?`, `checkOutTime?` (for NIGHT), `depositAmount?: Money` | — |
| `EVENT` | `salesCloseMinutesBefore` (default 0), `allowWaitlist` (bool, default false). Sessions are separate `EventSession` records (§5.5). | — |

- `kind` is immutable. A kind-specific field on the wrong kind is a validation error.
- `depositRule` (SERVICE) is `{ required: NONE | FIXED | PERCENT | FULL, value? }` like the `booking.deposit.*` settings of section 5.4: `value` is minor units for FIXED and a whole percent (1 to 100) for PERCENT, absent otherwise. Card 3.2a stores it; booking (3.6) interprets it.
- Long stays (hostel monthly rent) are `PLAN` (enrollment with a bed resource), not `RENTAL`. RENTAL is for short, priced-per-unit-of-time stays.
- New `EventSession` entity (booking module, location scope): `eventSessionId`, `offeringId`, `startsAt`, `endsAt`, `capacity`, `resourceIds[]`, `status` (`SCHEDULED \| CANCELLED \| COMPLETED`).

## 3. Pricing pipeline (owned by `pricing`, used by every request)

```
unit price = (OfferingLocation.priceOverride ?? variant.price) + Σ chosen modifier priceDeltas   (per location; ADR-072)
line gross = unit price × quantity   (quantity in unit precision → integer math, round half-up to minor units)
line promotions  = automatic promotions in priority order (card 3.4: one best promotion per line unless stackable)
manual discount  = line-level, then order-level; above threshold needs approval (§9)
order discount   → allocated to lines proportionally by line gross (largest remainder) → lineDiscount
tax              = per line from taxClassKey on (gross − discount), inclusive or exclusive per setting pricing.taxInclusive
lineNetTotal     = gross − lineDiscount (+ tax if exclusive)
delivery charge  = from sales.deliveryCharges (by area/weight), its own total, never allocated to lines
grandTotal       = Σ lineNetTotal + deliveryCharge − store-credit is NOT a discount (it is a payment)
```
- Every number above is stored on the line (`unitPrice`, `lineGross`, `lineDiscount`, `lineTax`, `lineNetTotal`) and on totals. The bot's `quote` tool and storefront checkout call this same pipeline (one implementation).
- Price changes after creation never affect the request. Re-pricing happens only on an explicit edit while the request is still editable (§4).
- **Card 3.4 / ADR-120:** `POST /quotes` (permission `catalog.offering.read`) runs this pipeline. An unknown or archived `taxClassKey` (on the offering or `pricing.defaultTaxClassKey`) is `422 TAX_CLASS_UNKNOWN`. Empty default class means 0%. Cash rounding (`pricing.rounding`) returns `roundingAdjustment`. Manual discounts above `pricing.approval.discountPercentAbove` or above `pricing.approval.discountAmountAbove` (0 = amount threshold off) populate `approvalsRequired` (PIN/token in 3.4b).

## 4. Order (module `sales`)

### 4.1 States
```
                ┌──────────── cancel ─────────────┐
                │                                 ▼
DRAFT ──place──► PLACED ──confirm──► CONFIRMED ──pack──► PACKED ──ship──► SHIPPED ──deliver──► DELIVERED
  │               │  ▲                  │  ▲                 │                │
  │               └──┘ (edit)           │  └ (edit, re-price)│                ├─fail─► DELIVERY_FAILED ──reship──► SHIPPED
  │                                     │                    │                │                 └─rts──► RETURNED_TO_SENDER
  └──── discard (deleted, never numbered) │                  │
                                        └──handover (PICKUP)─┴──────► COMPLETED
INSTANT (POS / walk-in): created directly as COMPLETED in one transaction.
CANCELLED: from DRAFT, PLACED, CONFIRMED, PACKED.
```
- `DRAFT`: a bot draft, an admin cart, a quick-add in progress. **No number, no stock effect, not visible in fulfillment queues.** Expires after `sales.draftExpiryHours` (default 48).
- `PLACED`: the customer committed (storefront checkout, chat confirmation, admin "place"). Number assigned. **Stock reserved.** Waits for seller confirmation, unless auto-confirm applies.
- `CONFIRMED`: the seller accepted it, or auto-confirm did (`sales.autoConfirm`, and the advance rule satisfied, §4.4). Lines and address are still editable (re-price + version).
- `PACKED`: optional step (`sales.usePacking`, default off). For PICKUP it means "ready for pickup" (term).
- `SHIPPED`: handed to a courier or rider. **Stock committed** (sale movement), revenue recognized. Lines are frozen from here.
- `DELIVERED` / `COMPLETED`: success terminals (COURIER/OWN_RIDER vs INSTANT/PICKUP).
- `DELIVERY_FAILED`: the courier or rider could not deliver. It can be re-shipped, or returned to sender.
- `RETURNED_TO_SENDER` (RTS): goods back at the location. Restock, revenue reversed, delivery cost stays an expense. Terminal.
- `CANCELLED`: terminal. Reservation released. Any advance is refunded or converted to store credit (§7).

### 4.2 Transitions

| Transition | Use case | Who (permission) | Preconditions | Effects in the same transaction | Event |
|---|---|---|---|---|---|
| create draft | `CreateDraftOrder` | `sales.order.create`, bot (`create_request`) | — | order (DRAFT) | `sales.order.drafted` |
| place | `PlaceOrder` | `sales.order.create`, storefront customer, bot after customer confirms | ≥ 1 line; contact with phone; address when COURIER/OWN_RIDER; stock available for tracked lines | number (`ORDER`), reservation per tracked line, totals frozen to the quote | `sales.order.placed` |
| confirm | `ConfirmOrder` | `sales.order.confirm` or auto | PLACED; advance satisfied (§4.4); risk not on hold (`risk.holdThreshold`) | — | `sales.order.confirmed` |
| edit | `EditOrder` | `sales.order.update` | PLACED or CONFIRMED | re-price, adjust reservations, `version`+1 | `sales.order.updated` |
| pack | `PackOrder` | `sales.order.update` | CONFIRMED, packing on | — | `sales.order.packed` |
| ship | `ShipOrder` (called by courier booking or rider assignment) | `courier.consignment.create` / `delivery.assignment.assign` | CONFIRMED or PACKED; method COURIER/OWN_RIDER | stock commit (SALE movement, reservation released), consignment/assignment link | `sales.order.shipped` |
| deliver | `MarkDelivered` | courier webhook (`runAsSystem(WEBHOOK_ROUTING)`), rider `delivery.assignment.complete`, `sales.order.update` | SHIPPED | COD capture (§7.3) | `sales.order.delivered` |
| fail delivery | `MarkDeliveryFailed` | same as deliver | SHIPPED | reason recorded | `sales.order.deliveryFailed` |
| reship | `ReshipOrder` | `sales.order.update` | DELIVERY_FAILED | new consignment/assignment | `sales.order.shipped` |
| return to sender | `ReceiveReturnToSender` | `sales.order.update` | DELIVERY_FAILED (goods physically back) | RETURN movement (restock, per-line disposition §6), revenue reversal | `sales.order.returnedToSender` |
| complete | `CompleteOrder` | `sales.order.update`, POS `pos.sale.create` | CONFIRMED/PACKED with PICKUP, or INSTANT create | stock commit; POS: payments in same txn | `sales.order.completed` |
| cancel | `CancelOrder` | `sales.order.cancel`; customer self-cancel only in PLACED when `sales.customerCanCancel` | DRAFT, PLACED, CONFIRMED, PACKED | release reservations; advance → refund or store credit (§7) | `sales.order.cancelled` |

- **POS sale:** `CreatePosSale` = create + complete + payments (+ store credit use) in **one** transaction. On a payment shortfall, the order completes with `paymentStatus` PARTIAL/UNPAID (a due), only if `pos.allowCreditSale` and a contact is attached.
- **Reservation:** for every stock component of a line's variant (ADR-098), `InventoryLevel.reserved` of that inventory item += line quantity × component quantity, in base units, at PLACED. All components of an order are reserved in one transaction. `available = onHand − reserved − damaged`. Placing an order that exceeds `available` is refused unless `inventory.allowNegativeStock`. Reservations are released at cancel/expiry and consumed at commit.
- **Auto-cancel:** PLACED orders not confirmed within `sales.placedAutoCancelHours` (default off/null) are cancelled by a scheduled job.
- **What card 3.5a (ADR-131) ships:** create, place, edit, confirm, pack, complete, cancel and the instant sale, with the reservation rules above and `403 APPROVAL_REQUIRED` for a discount over `pricing.approval.discountPercentAbove` without an ADR-121 token. Still open: ship / deliver / fail / reship / return-to-sender (Phase 5 fulfillment), the advance rule of §4.4 and any refund (§7, card 3.8), the POS payment and credit lines of a `CreatePosSale` (3.9), `risk.holdThreshold` (risk card) and returns (§6, 3.5b).

### 4.3 Payment status (derived, never set by hand)
`UNPAID` → `PARTIAL` → `PAID` from Σ allocations vs `grandTotal`; `REFUNDED` / `PARTIALLY_REFUNDED` when refunds exist. A request is **closed** when its status is terminal and its payment status is `PAID`, `REFUNDED` or zero-total. Dues reports list unclosed requests with a due.

### 4.4 Order advance (owner decision: setting, default off)
- `sales.advance.required`: `NONE` (default) | `FIXED` | `PERCENT` | `FULL`. `DELIVERY_CHARGE` waits for Phase 5 delivery charges.
- `sales.advance.value`: integer ≥ 0, default 0. FIXED is minor units in the organization currency, capped at `grandTotal`; PERCENT is clamped to 0–100 and rounded up in minor units; FULL requires `grandTotal`; NONE requires zero.
- PLACED → CONFIRMED checks net allocated payments (allocated minus refunded) against the required advance inside the confirm transaction. Zero required confirms without payment.
- Auto-confirm at place applies only to NONE. Auto-confirm after a payment, and the bot/storefront advance prompt, are follow-ups.
- The advance is a liability until completion (shipping recognition follows in Phase 5); see the journal matrix (§10).

## 5. Booking (module `booking`)

### 5.1 States
```
HELD ──request──► REQUESTED ──confirm──► CONFIRMED ──check in──► CHECKED_IN ──complete──► COMPLETED
  │                  │                      │  ▲                     
  └─expire           ├─reject/cancel        ├─reschedule (stays CONFIRMED, new times, history kept)
                     ▼                      ├─cancel ──► CANCELLED
                 CANCELLED                  └─no-show job ──► NO_SHOW
(HELD also goes straight to CONFIRMED when booking.requireApproval = false)
```
- `HELD`: a temporary capacity hold while the customer finishes checkout or chat. Expires after `booking.holdMinutes` (default 10). No number.
- `REQUESTED`: numbered (`BOOKING`). Waits for business approval (`booking.requireApproval`, default false).
- `CONFIRMED` → `CHECKED_IN` (arrived / occupancy started) → `COMPLETED` (service done / check-out / event ended).
- `NO_SHOW`: set by a job `booking.noShowAfterMinutes` (default 30) after start without check-in, or manually.
- **Capacity counts** HELD + REQUESTED + CONFIRMED + CHECKED_IN. Card 3.6 picks the concurrency mechanism, with this invariant: two concurrent requests for the last unit can never both succeed.

### 5.2 Transitions (summary)

| Transition | Who | Preconditions | Effects | Event |
|---|---|---|---|---|
| hold | customer (storefront/bot), `booking.booking.create` | slot free within schedule, outside time-off, `maxAdvanceDays`, `minNoticeMinutes` | capacity hold | `booking.booking.held` |
| request / confirm | same, or auto | hold valid; deposit satisfied if required (§5.4) | number; confirmation notification | `booking.booking.requested` / `.confirmed` |
| reschedule | `booking.booking.reschedule`, customer within policy | new slot free | old capacity released, new taken (one txn); history entry | `booking.booking.rescheduled` |
| check in | `booking.booking.update` | CONFIRMED, within the check-in window | — | `booking.booking.checkedIn` |
| complete | `booking.booking.update` or auto at `endsAt` + grace for EVENT/RENTAL check-out | CHECKED_IN (SERVICE/RENTAL) or CONFIRMED (EVENT after end) | revenue recognized; any unpaid remainder becomes a due | `booking.booking.completed` |
| cancel | `booking.booking.cancel`; customer within policy | not terminal | capacity released; deposit per policy (§5.4) | `booking.booking.cancelled` |
| no-show | job / `booking.booking.update` | CONFIRMED past window | deposit per policy | `booking.booking.noShow` |

### 5.3 Walk-in services
A SERVICE sold on the spot without a slot (`bookingMode: WALK_IN_ONLY`, or a stylist's free walk-in) is an **Order line** (ADR-044), with `performedByMemberId`. No booking.

### 5.4 Deposits and cancellation policy (settings, per org, overridable per offering via `depositRule`)
- `booking.deposit.required` (`NONE` default \| `FIXED` \| `PERCENT` \| `FULL`), `booking.deposit.value`
- `booking.freeCancelHours` (default 24)
- `booking.lateCancelFee` (`NONE` default \| `DEPOSIT` \| `PERCENT`)
- `booking.noShowFee` (same options)

Deposits are payments allocated to the booking. They are a liability until completion. A cancellation within the free window refunds or credits the deposit (§7). A late cancellation or no-show retains the fee as revenue (journal §10), and the rest is refunded/credited.

### 5.5 Events (EVENT kind)
Seats per `EventSession.capacity`. A booking of an EVENT references `eventSessionId` (added to Booking in `09`). Sales close `salesCloseMinutesBefore` start. A cancelled session cancels its bookings, with a full deposit refund/credit and a notification. Waitlist is out of scope at launch (`allowWaitlist` reserved).

**Implemented (3.6b A2/A3, 3.33).** Sessions are location-scoped `EventSession` records with a `version`; an EVENT booking copies the session times and holds seats on its `seatsSold` counter instead of taking `resource_slot_usages` capacity. A no-show keeps the seat; expiry, hold cancel and booking cancel release it, each in the same transaction as the booking's versioned status write, so a seat is never handed back twice. A reschedule moves the booking to another session of the same offering, seat class and location. A session's named resources occupy whole-resource `resource_slot_usages` buckets for its window, blocking rentals, services and other sessions; cancel and move release exactly the stored holds, and completion leaves past counters intact. `POST /event-sessions/:id/cancel` only marks the session CANCELLED; the `booking.cancelEventSession` job then cancels its bookings (full refund, `CANCEL_FEE_MODE.NONE`) and sets `bookingsSettledAt` once none is open. Notifications are not part of this card.

## 6. Returns & exchanges (module `sales`, owner decision: launch)

New aggregate **SalesReturn** (sales, location scope, append-only):
`salesReturnId`, `salesReturnNumber` (sequence `RETURN`), `orderId`, `contactId?`, `lines[{ orderLineId, quantity, disposition: RESTOCK | DAMAGED | NOT_RECEIVED, refundAmount: Money }]`, `refundDeliveryCharge: Money` (default 0), `refund { method, amount: Money }`, `reasonKey`, `approval?` (§9), `status` (`ACTIVE \| REVERSED`), `reversedBySalesReturnId?`, `exchangeOrderId?`, `businessDate`, STF.

- **Allowed only on** `DELIVERED` or `COMPLETED` orders, within `sales.returnWindowDays` (default 7; null = no limit). Goods that never reached the customer use return-to-sender (§4.2), not a return.
- **Quantity cap:** per line, Σ returned ≤ sold quantity.
- **Refund amount per line** = `lineNetTotal × returnedQty / soldQty` (integer, largest remainder across the return's lines), minus amounts already refunded for that line. The server computes it; the client sends quantities and dispositions only.
- **Unpaid or partly paid orders:** the refund first reduces the order's due. Cash/credit goes out only for the paid portion (manoxen guide 15 rule).
- **Refund methods:** `CASH`, `BKASH`, `NAGAD`, `BANK`, `CARD`, `GATEWAY` (to the original transaction), `STORE_CREDIT`.
- **Stock:** RESTOCK → RETURN movement into `onHand`. DAMAGED → RETURN movement into `damaged` (`InventoryLevel.damaged`, `StockMovement.stockState = DAMAGED`). NOT_RECEIVED → no stock movement (refund without goods; needs approval).
- **Effects in one transaction:**
  1. return record
  2. stock movements
  3. refund Payment (direction REFUND) **or** StoreCreditEntry (+)
  4. order projections (`lines[].returnedQuantity`, `returnStatus`)
  5. POS register expected cash when CASH at POS (via the payment's `posSessionId`)
  6. outbox events
  - Journal by `accounting` from the events (§10). Commission/loyalty effects are future modules reacting to `sales.return.created`.
- **Reverse** (`ReverseSalesReturn`, approval required): writes the opposite movements, payment/credit, and events. The original stays, with status `REVERSED`. Never edited, never deleted.
- **Exchange** (`ExchangeOrder` use case, one transaction): a SalesReturn with refund method `STORE_CREDIT` + a new Order (INSTANT or PLACED) paid first with that credit. The difference is paid or credited. Both are linked (`exchangeOrderId`, same `checkoutId`).

**Bookings and enrollments** don't use SalesReturn. Their refunds are Payment REFUND (or store credit) through cancellation policy (§5.4) or `CancelEnrollment` (§8.4).

## 7. Payments & store credit (module `payment`)

### 7.1 Payment (ADR-123)
- `direction`: `IN` \| `REFUND` \| `REVERSAL` (REVERSAL undoes a mistaken entry, references `reversesPaymentId` with a unique partial index per org, always needs `PAYMENT_REVERSAL` approval, refuses with 422 if any allocated request has a refund or if an overpayment credit has already been spent, and reverses all accounting journals of the original payment).
- Reversal of a payment whose request was closed at a lower total (cancel, no-show): by default (`payment.reversal.closedRequest` = `REOPEN_DUE`) the kept amount is owed again; `WRITE_OFF` forgives it and records `writeOffs` on the reversal (ADR-140).
- `method`: `CASH`, `BKASH`, `NAGAD`, `BANK`, `CARD`, `GATEWAY`, `STORE_CREDIT`, `COD_COURIER`, `RIDER_CASH` (`GATEWAY`, `COD_COURIER` and `RIDER_CASH` refused until Phase 5).
- **Allocations** go to requests of the same org: `{ requestType, requestId, enrollmentPeriodId?, amount, revenueState }`. `revenueState` (`BEFORE_REVENUE` \| `AFTER_REVENUE`) is captured on each allocation when the payment is recorded. Σ allocations ≤ amount, enforced atomically per request on `PaymentSummary` (`ORGANIZATION_AND_LOCATION` tenancy). An IN payment above the allocations is overpayment: it becomes store credit (contact required) or POS change (cash only, not stored). For ENROLLMENT the `requestId` is the `enrollmentPeriodId` itself (ADR-139); the optional `enrollmentPeriodId` field is not used.
- **Refunds** (`POST /refunds`) allocate to the refunded requests (`refunded + amount ≤ allocated`) and require `REFUND` approval unless the caller holds `payment.payment.refundWithoutApproval` at the location and `payment.refund.managerWithoutApproval` is true.
- **Manual mobile-money verification:** `externalReference` (bKash/Nagad trxID) is unique per `(organizationId, method, externalReference)`, which prevents recording the same transfer twice (`409` with `paymentId`).
- **Immutable:** corrections are REFUND or REVERSAL. Every payment requires `Idempotency-Key`. `businessDate` is derived in the organization timezone.
- POS payments carry `posSessionId`. Rider payments carry `receivedByMemberId` (the rider).

### 7.2 Store credit (owner decision: launch, ADR-123)
New append-only **StoreCreditEntry** (payment module, org scope):
`storeCreditEntryId`, `contactId`, `kind` (`PAYMENT_OVERPAYMENT`, `PAYMENT_USE`, `PAYMENT_REFUND`, `PAYMENT_REVERSAL`, `CANCELLATION`, `MANUAL_ADJUSTMENT`, `EXPIRY`), `direction` (`CREDIT \| DEBIT`), `amount: Money`, `balanceAfterMinor`, `paymentId?`, `approvalId?` (`approvalTokenId`), `expiresAt?`, `expiresStoreCreditEntryId?` (unique per org), `businessDate`.
- Balance = Σ entries (projection `Contact.summary.storeCreditBalance`). It never goes below 0, enforced with the version check on the contact summary inside the transaction (`409` on conflict).
- Using credit = a Payment `IN` with method `STORE_CREDIT` + a `PAYMENT_USE` DEBIT entry in the same transaction.
- `MANUAL_ADJUSTMENT` needs approval (§9). Expiry: `payment.storeCreditExpiryDays` (null = never; the daily job `payment.expireStoreCredit` writes one `EXPIRY` entry per expired credit entry via `expiresStoreCreditEntryId`).
- Accounting: store credit is a liability (`STORE_CREDIT_LIABILITY`). Every entry publishes `payment.storeCredit.changed` (`orderingKey: paymentAccount:<organizationId>`); accounting posts a journal from `payment.storeCredit.changed` only for `EXPIRY` (overpayment and refund-to-credit are posted from the payment event).

### 7.3 COD settlement
- **Courier COD:** at DELIVERED, a Payment `IN` method `COD_COURIER` (the money is with the courier) is allocated to the order. When the courier pays out, a `CourierSettlement` record (courier module: `courierSettlementId`, `courierKey`, `paymentIds[]`, `grossAmount`, `courierCharges`, `netReceived`, `receivedVia`, `businessDate`) clears the courier receivable and books the courier fees.
- **Own rider COD:** at DELIVERED, a Payment `IN` method `RIDER_CASH` (`receivedByMemberId` = rider). `delivery.cash.handover` moves it from rider cash to the register/cash account (a `RiderCashHandover` record in the delivery module).

## 8. Enrollment (module `enrollment`)

### 8.1 States
```
PENDING ──activate──► ACTIVE ──freeze──► FROZEN ──unfreeze──► ACTIVE
   │                    │ ▲
   └─cancel             │ └─ pay overdue
                        ├─ period unpaid past grace ──► OVERDUE
                        ├─ fixed term done ──► COMPLETED
                        ├─ no renewal at period end ──► EXPIRED
                        └─ cancel ──► CANCELLED
```
- `PENDING`: created, waiting for the first payment when `enrollment.requirePaymentToActivate` (default true), or for a FIXED_DATES start.
- `ACTIVE`: access allowed (check-in, sessions). `FROZEN`: paused; the period end moves by the frozen days (≤ `maxFreezeDaysPerYear`).
- `OVERDUE`: the current period is unpaid past `enrollment.graceDays` (default 5). Check-in is blocked when `enrollment.blockCheckInWhenOverdue` (default true). Paying returns it to ACTIVE.
- `EXPIRED` (not renewed), `COMPLETED` (fixed term finished), `CANCELLED`: terminal.

### 8.2 Periods
New append-only-by-period **EnrollmentPeriod** (enrollment, location scope): `enrollmentPeriodId`, `enrollmentId`, `periodNumber`, `periodStartsOn`, `periodEndsOn`, `fee: Money` (admission fee added to period 1), `sessionsAllowed?`, `sessionsUsed`, `status` (`OPEN \| PAID \| PARTIAL \| WAIVED`). Replaces `Enrollment.currentPeriod` in `09` (which becomes `currentEnrollmentPeriodId`).
- Manual renewal while ACTIVE/OVERDUE, on or before the current end, creates one advance period without moving the current pointer. The hourly renewal job on or after `periodEndsOn + 1` promotes an existing advance (audit only), otherwise auto-renews a sellable plan or expires the enrollment. Renewal cadence/session/fixed-term rules use the stored snapshot; fees use the current quote or locked recurring fee. Reminders fire once per period anywhere inside the configured window.
- Revenue is recognized once per period, when the period is in service (ADR-142): at creation as ACTIVE, at activation, or at the renewal that makes it current (its start date, not the run date). A PENDING enrollment has no revenue. Payments allocate to a period (`enrollmentPeriodId`).
- Each period is a payment request (`requestType ENROLLMENT`, `requestId enrollmentPeriodId`, ADR-139). Create and renewal initialize its summary at the fee; `OPEN | PARTIAL | PAID` is derived from net paid by the `enrollment.syncPayments` handler and by activation and the jobs reading the period; `WAIVED` is never changed. Cancellation caps every non-waived period's summary at its net paid. Period revenue posting and the settlement of held advances are card 3.31 (ADR-142); cancellation closes each period at the kept amount.
- Capacity: ACTIVE + FROZEN + OVERDUE + PENDING enrollments of a PLAN ≤ `capacity`.

### 8.3 Check-in
`CheckIn` (append-only) needs an ACTIVE enrollment, or a CONFIRMED booking for the same contact. It increments `sessionsUsed` on the open period and is refused at `sessionsAllowed`, unless approved (§9). Method `STAFF \| QR \| DEVICE`.

### 8.4 Cancellation & refunds
`CancelEnrollment`: `enrollment.refundPolicy` = `NONE` (default) \| `UNUSED_PERIODS` (refund paid future periods) \| `PRORATED` (current period by unused days). A refund is a Payment REFUND or store credit; any refund needs approval (§9).

## 9. Approvals: manager PIN (owner decision)

- **Where needed:**
  - refunds and return reversals (cashier/staff always; settings can exempt MANAGER)
  - manual discounts above `pricing.approval.discountPercentAbove` (default 10%) or `pricing.approval.discountAmountAbove` (default 0 = off; any value above 0 is the threshold in minor units)
  - price override at POS
  - store-credit manual adjustment
  - NOT_RECEIVED returns
  - payment REVERSAL
  - session-limit override
  - enrollment refund
- **How:** the approver enters their PIN on the same device. Approvers are members with permission `iam.approval.grant` (OWNER, MANAGER by default; renamed from `sales.approval.grant` in ADR-121 because iam exists first). `Member.approvalPinHash` (hashed like passwords), `approvalPinFailedCount`, `approvalPinLockedUntil` (5 failures → 15 min lock).
- The server issues a short-lived (2 min), single-use **approval token** bound to `{ action, subjectKey, amount }` (card 3.4b). The use case verifies and consumes it via `ApprovalVerifier`. The request records `approval { approverMemberId, approvedAt, action }`. An audit log entry is written in the same transaction.
- Remote approval (push to the owner's phone) is a later card. The data shape above already supports it.

## 10. Journal posting matrix (module `accounting`, from events)

System accounts are seeded per org with fixed `accountCode`s (contracts enum `SYSTEM_ACCOUNT_CODE`): `CASH`, `BKASH`, `NAGAD`, `BANK`, `CARD_CLEARING`, `GATEWAY_CLEARING`, `COURIER_RECEIVABLE`, `RIDER_CASH`, `ACCOUNTS_RECEIVABLE`, `INVENTORY`, `INVENTORY_DAMAGED`, `CUSTOMER_ADVANCES`, `STORE_CREDIT_LIABILITY`, `TAX_PAYABLE`, `REVENUE_PRODUCT`, `REVENUE_SERVICE`, `REVENUE_PLAN`, `REVENUE_RENTAL`, `REVENUE_EVENT`, `DELIVERY_INCOME`, `CANCELLATION_FEE_INCOME`, `OTHER_INCOME`, `SALES_DISCOUNTS` (contra), `SALES_RETURNS` (contra), `COGS`, `DAMAGE_LOSS`, `DELIVERY_EXPENSE`, `COURIER_FEES`, `ROUNDING`, `OWNER_EQUITY`, `OPENING_BALANCE`. Expense categories map to their own EXPENSE accounts (`09` ExpenseCategory).

| Event (posting key) | Debit | Credit |
|---|---|---|
| Payment IN before fulfillment (advance/deposit) | method account (CASH/BKASH/… ) | CUSTOMER_ADVANCES |
| Payment IN after revenue recognized | method account | ACCOUNTS_RECEIVABLE |
| Payment IN method STORE_CREDIT | STORE_CREDIT_LIABILITY | ACCOUNTS_RECEIVABLE or CUSTOMER_ADVANCES |
| Order revenue recognized (`shipped` / `completed`) | ACCOUNTS_RECEIVABLE (grandTotal); SALES_DISCOUNTS (discounts) | REVENUE_<kind> per line gross **excluding tax** (tax-inclusive prices are split first); TAX_PAYABLE; DELIVERY_INCOME |
| … same event, advances held | CUSTOMER_ADVANCES | ACCOUNTS_RECEIVABLE (move advance to settle AR) |
| Order stock commit (cost) | COGS | INVENTORY (at unit cost) |
| COD delivered via courier (Payment COD_COURIER) | COURIER_RECEIVABLE | ACCOUNTS_RECEIVABLE |
| Courier settlement | BANK/BKASH (net), COURIER_FEES (charges) | COURIER_RECEIVABLE (gross) |
| Rider COD (Payment RIDER_CASH) / handover | RIDER_CASH / then CASH | ACCOUNTS_RECEIVABLE / then RIDER_CASH |
| Sales return | SALES_RETURNS (net excl. tax), TAX_PAYABLE | refund method account, or STORE_CREDIT_LIABILITY, or ACCOUNTS_RECEIVABLE (reduces due) |
| Return stock (RESTOCK / DAMAGED) | INVENTORY / INVENTORY_DAMAGED (original unit cost) | COGS |
| Damaged write-off | DAMAGE_LOSS | INVENTORY_DAMAGED |
| Return to sender | reversal of the order revenue + cost entries | (mirror) |
| Booking completed / enrollment period started | ACCOUNTS_RECEIVABLE | REVENUE_SERVICE/RENTAL/EVENT/PLAN, TAX_PAYABLE |
| Cancellation fee retained | CUSTOMER_ADVANCES | CANCELLATION_FEE_INCOME |
| Refund of advance / deposit | CUSTOMER_ADVANCES | method account or STORE_CREDIT_LIABILITY |
| Store credit expiry | STORE_CREDIT_LIABILITY | OTHER_INCOME |
| Expense posted | expense category account | method account |
| Stock purchase (card 3.3) | INVENTORY | method account or a supplier payable (later) |
| Rounding difference | ROUNDING | (or reverse) |

- Every posting is idempotent: a unique index on `(organizationId, sourceType, sourceId, postingKey)`. A reversal posts the mirrored lines with `reversesJournalEntryId`.
- Debits = credits is asserted before insert. A failed posting retries via the outbox, and after N attempts raises an alert. It never silently skips.
- Card 3.8c owns the built rows of the matrix (payments, bookings, expenses, store-credit expiry, rounding) and the full-day trial balance; order, stock, return and COD rows come with their cards (ADR-124).
- Card 3.24 (ADR-138) implemented the order rows (revenue recognition, advance settle from RequestAdvanceReader, cost of goods sold from SALE movements) and stock rows (receipt funding via CASH/BKASH/NAGAD/BANK/ACCOUNTS_PAYABLE, opening stock, adjustments, and damage write-offs) via handlers `accounting.postOrders` and `accounting.postStock`.

## 11. Scheduled jobs (all `runAsSystem(SCHEDULED_JOB)`, idempotent, per org timezone)

| Job | When | Does |
|---|---|---|
| Draft expiry | hourly | deletes DRAFT orders older than `sales.draftExpiryHours` |
| Placed auto-cancel | hourly | cancels PLACED orders past `sales.placedAutoCancelHours` (if set) |
| Booking hold expiry | every minute | expires HELD bookings past `booking.holdMinutes` |
| No-show | every 5 min | CONFIRMED bookings past start + `booking.noShowAfterMinutes` → NO_SHOW |
| Auto-complete | every 5 min | EVENT bookings after session end; RENTAL past check-out + grace |
| Enrollment renewal / overdue / expiry | hourly, org-local business dates | creates periods, marks OVERDUE/EXPIRED/COMPLETED, sends reminders |
| Store credit expiry | daily | writes EXPIRY entries |
| Courier status poll | every 15 min (webhook fallback) | updates consignments → order transitions |

## 12. Status tones (fills `13 §8.2`)

| Request | success | info | warning | danger | neutral |
|---|---|---|---|---|---|
| Order | DELIVERED, COMPLETED | CONFIRMED, PACKED, SHIPPED | PLACED, DELIVERY_FAILED | CANCELLED, RETURNED_TO_SENDER | DRAFT |
| Booking | COMPLETED, CHECKED_IN | CONFIRMED | HELD, REQUESTED | CANCELLED, NO_SHOW | — |
| Enrollment | ACTIVE, COMPLETED | — | PENDING, FROZEN, OVERDUE | CANCELLED | EXPIRED |
| Payment status | PAID | — | PARTIAL, UNPAID | — | REFUNDED, PARTIALLY_REFUNDED |
| SalesReturn | — | ACTIVE | — | — | REVERSED |
| Member (staff) | ACTIVE | INVITED | SUSPENDED | — | REMOVED |
| Invitation | ACCEPTED | PENDING | — | — | REVOKED, EXPIRED |
| Location | ACTIVE | — | — | — | ARCHIVED |
| Role | ACTIVE | — | — | — | ARCHIVED |

## 13. Bot behaviour per request type (`08` tools)
- `create_request(ORDER)` creates a DRAFT, then PLACED after the customer says yes in chat (explicit confirmation message with items, total, delivery charge, address). When an advance is required, the bot gives payment instructions and records the trxID as "pending verification" (a note on the order). It never records a payment itself.
- `create_request(BOOKING)` creates a HELD booking during the chat, then REQUESTED/CONFIRMED on the customer's yes.
- `create_request(ENROLLMENT)` creates PENDING with intake fields (`botAsk`).
- `get_request_status` reads status + tracking + due, in customer terms.
- The bot never cancels, refunds or edits after PLACED. It hands off.

## 14. Additions to other docs (synced in this branch)
- **`09`:**
  - New entities: SalesReturn, StoreCreditEntry, EnrollmentPeriod, EventSession, CourierSettlement, RiderCashHandover.
  - Fields:
    - `Member.approvalPinHash`
    - `InventoryLevel.damaged`
    - `StockMovement.stockState` (+ reasons `RETURN_DAMAGED`, `DAMAGE_WRITE_OFF`)
    - `Booking.eventSessionId?` and `Booking.depositRequired`
    - `Order.status` values; line money fields (`lineGross`, `lineDiscount`, `lineTax`, `lineNetTotal`, `returnedQuantity`); `Order.returnStatus`
    - `Payment.direction` REVERSAL, methods STORE_CREDIT/COD_COURIER/RIDER_CASH, `posSessionId`, `allocations[].enrollmentPeriodId`
    - `Contact.summary.storeCreditBalance`
  - `Enrollment.currentPeriod` → `currentEnrollmentPeriodId`.
  - Sequence `RETURN`.
- **`10`:**
  - Permissions: `sales.return.{read,create,reverse}`, `sales.approval.grant`, `payment.storeCredit.{read,adjust*}`, `booking.booking.checkIn`, `enrollment.enrollment.{freeze,refund*}`
  - New settings keys from §4, §5, §8, §9
  - Events listed in this doc

## 15. Decisions made in this card

| ADR | Decision | Status |
|---|---|---|
| ADR-061 | Every request transition is its own use case in one transaction. Request status, payment status and return status are separate (payment/return derived). Order-level discounts and taxes are allocated to lines at pricing time and stored (`lineNetTotal`); refunds use stored numbers only. | Accepted (proposed) |
| ADR-062 | Order lifecycle `DRAFT → PLACED → CONFIRMED → (PACKED) → SHIPPED → DELIVERED`, with PICKUP/INSTANT → `COMPLETED`, plus `DELIVERY_FAILED`, `RETURNED_TO_SENDER`, `CANCELLED`. Stock is **reserved at PLACED** and **committed at SHIPPED/COMPLETED**. Revenue is recognized at commit. Drafts have no number and no stock effect. | Accepted (proposed) |
| ADR-063 | Returns are a separate append-only `SalesReturn` aggregate on DELIVERED/COMPLETED orders within a return window. Server-computed refunds, capped per line. Dispositions RESTOCK/DAMAGED/NOT_RECEIVED, with damaged stock tracked separately. Reversal by a mirrored record, never an edit. Exchange = return to store credit + new order in one transaction. | Accepted (owner: store credit & exchange at launch) + proposed (rest) |
| ADR-064 | Store credit is an append-only `StoreCreditEntry` ledger per contact (liability account), never negative. It is used as a payment method `STORE_CREDIT`, and it expires per setting. | Accepted (owner) |
| ADR-065 | Booking lifecycle `HELD → REQUESTED → CONFIRMED → CHECKED_IN → COMPLETED` (+ CANCELLED, NO_SHOW). HELD capacity holds expire. Deposits and cancellation fees by settings. Walk-in services are order lines. Event seats via `EventSession`. | Accepted (proposed) |
| ADR-066 | Enrollment lifecycle `PENDING → ACTIVE ↔ FROZEN`, `OVERDUE`, terminals `EXPIRED/COMPLETED/CANCELLED`. Billing via append-only-by-period `EnrollmentPeriod`. Revenue per period at start. Long stays (hostel) are PLAN, not RENTAL. | Accepted (proposed) |
| ADR-067 | Manager PIN approvals: single-use, 2-minute approval tokens bound to `{action, requestId, amount}`, issued after a PIN check of a member with `sales.approval.grant`. Required for refunds, reversals, discounts above thresholds, POS price overrides, manual credit adjustments and session overrides. Recorded on the request and in the audit log. | Accepted (owner: manager PIN) + proposed (mechanism) |
| ADR-068 | COD: optional advance rule per org (`sales.advance.required`, default NONE) gating CONFIRMED. Courier COD is a `COD_COURIER` payment cleared by `CourierSettlement`; own-rider COD is `RIDER_CASH`, cleared by `RiderCashHandover`. Journal postings follow the matrix in §10, idempotent per `(sourceType, sourceId, postingKey)`. | Accepted (owner: advance as setting, default off) + proposed (rest) |

### Card 3.7 part A implementation note (2026-10-22)
The first freeze preserves the latest period's `originalEndsOn`; only unfreeze extends its end, while earlier periods remain unchanged. Overdue skips FROZEN; the renew job first unfreezes limited freezes whose yearly credit allowance is exhausted. Unfreeze always succeeds with real freeze days recorded and credited extension capped; unlimited freezes remain untouched. Freeze is refused while an advance period waits. Beds remain held open-ended until cancellation, expiry or completion; renewal, freeze and unfreeze never change the hold (ADR-126).
The PLAN provider, periods, recurring-price lock, capacity counter, staff check-in and reminder events are implemented. Payment allocation, payment-triggered activation/reactivation and payment refunds are deferred to 3.8 or a follow-up. Cancellation returns the calculated `refundableAmount`; no refund is executed here.
