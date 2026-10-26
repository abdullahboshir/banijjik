# Phase 3 review · 2026-10-26 · PASS WITH FIXES

Reviewer: Claude (Opus 5.5), lead `banijjik-fa`. Scope: every Phase 3 card on `main` (tip `89710a41`), 3.0 to 3.37 with all their parts. 3.38 and 3.39 were planned after the last Phase 3 merge and are still open. Every card had its own T1 review or merge check with a green CI run. This review looks across the cards. Track M is a separate track and not part of this review.

## Phase done criterion (`03-ROADMAP.md`)
> A salon, a gym and a coaching centre from templates take bookings and enrollments, sell services and products at the counter, collect fees and dues, and pay staff commission, with correct numbers in reports; **and** a product seller runs a full day (stock in → POS + online orders → returns → day close), including loose and packed sale from one stock. No industry-specific code.

| Part | Evidence | Holds? |
|---|---|---|
| Templates | `salon.json` (SERVICE, PRODUCT; booking, commission, pos, sales), `gym.json` (PLAN, SERVICE, PRODUCT; enrollment as well), `coaching.json` (PLAN, EVENT; no pos, no sales). Keys are data (ADR-097). | **Yes** |
| Bookings | 3.6, 3.6b, 3.33: API suites on SALON and GYM worlds (availability, concurrency, transitions, events, sessions with resources); admin `booking-screens` and `event-session-screens` browser tests | **Yes** |
| Enrollments, check-in | 3.7, 3.27, 3.31, 3.32: `enrollment-api`, `enrollment-payment-api`, `check-in-api`, `enrollment-jobs`; GYM browser flow (3.36). COACHING's guardian through the contact link (`contact-link-api`) | **Yes** |
| **Sell services at the counter** | The till sells products only. `sales-line-preparation.ts` refuses every non-PRODUCT line with `KIND_NEEDS_BOOKING`, and booking refuses a `WALK_IN_ONLY` service (`staff-booking-quote.ts`). So a walk-in haircut can only be sold by booking it first, and a `WALK_IN_ONLY` service cannot be sold at all. `11 §5.3` says a walk-in service is an **order line** with `performedByMemberId`. Plan 3.5a moved it to POS (3.9); plan 3.9 did not take it. | **No: finding F1** |
| Sell products at the counter, day close | 3.9: one-transaction sale, register, Z-report (`pos-screens` browser test: pair, open, sell, receipt, close with the Z-report numbers) | **Yes** |
| Collect fees and dues | 3.8, 3.23, 3.27: payment and dues suites; POS collections (3.9 A2); admin `payment-screens` | **Yes** |
| Staff commission | 3.11 A–C: rules, accruals from bookings and order lines, payouts posted through `accounting`; returns reconcile by units (ADR-135 note); `commission-screens` browser test | **Yes** |
| **Correct numbers in reports** | 3.10: each increment is unit-tested (`summarize-event.test.ts`) and exactly-once is proven for one completed order through the outbox (`report-exactly-once-api.test.ts`). **No test runs a day of real business and reads the home or daily report.** `report-api.test.ts` seeds rows; the 3.10 B browser test checks only the empty note and the 7-row table (handoff gap). | **Not proven: finding F2** |
| Product seller: stock in → POS + orders → returns → day close | 3.3 receipts, 3.24 posting, 3.5a orders, 3.5b returns and exchanges, 3.9 POS returns and Z-report. Each step is tested on its own; not one run in a row. | **Yes per step** (F2 adds the run) |
| Loose and packed from one stock | `order-stock-api.test.ts` › "sells loose rice and a packed bag from the one item"; POS uses the same line preparation and has a weight keypad (3.9 B) | **Yes** |
| No industry-specific code | Lint R16 on CI; no template key or industry noun outside seeds, tests and `platform/industry` (grep this review) | **Yes** |

## Findings
**F1 · MAJOR · walk-in services cannot be sold.**
- **Fix:** card **3.40** (T1, needs a plan).
  - An order line may be a SERVICE: no stock, no booking, `performedByMemberId` as for products (3.11 C accrues it already).
  - Admin instant orders and POS sales accept it; the till's search shows services.
  - Order posting credits `REVENUE_SERVICE` for service lines (the account exists, ADR-124); returns of a service line follow ADR-145 without stock.
  - Plan question for the owner: does a walk-in on a SLOT service hold the performer's calendar? Recommended default: no (as Fresha and Square: a walk-in checkout does not touch appointments).

**F2 · MAJOR (evidence) · no test reads reports after a real day.**
- **Fix:** card **3.41** (T2): API scenario tests that run through the real outbox and worker, one per world:
  - SALON: a booking with a performer, a walk-in service (after 3.40), a product at the till, a payment.
  - GYM: an enrollment, its payment, two check-ins, a renewal.
  - COACHING: an enrollment with a guardian, a partial fee, the due.
  - RETAIL: a stock receipt, a POS sale (loose and packed), an admin order, a return, the register close.
- Each test asserts the report home and daily figures, the Z-report, a balanced trial balance and the commission payable. The 3.10 B browser gap ("after a seeded sale and a payment") is closed by the same seed.

**F3 · MINOR · POS till leftovers (3.9 B handoff).** Held carts, till returns and the price-override screen are built in the API but have no till UI; the credit-sale refusal has no browser test. Card **3.42** (T2, UI).

**F4 · MINOR · API correctness leftovers.** Card **3.43** (T1 for item 1, the rest small):
1. A till cash payment reversed (3.34 `REVERSAL`) before the close still counts in expected cash: the reversal row has no `posSessionId` (3.9 A1 review F3).
2. The cashier role holds `contact.contact.create` and `update` (`CONTACT_DAILY_KEYS`); remove them and add a denied test.
3. `PaymentApprovalSnapshot.approverUserId` holds a member id: rename to `approverMemberId` (ADR-036 naming).
4. `as unknown as` casts in the six accounting event handlers, `booking.controller.ts`, `order.controller.ts` and the inventory repositories: give the event payloads and queries real types.
5. 3.5a B: `placeOrder` makes a new idempotency key per call, so a retry after a lost response shows a conflict instead of the replayed success.

## Consistency across the cards (checked, no action)
- **Every module** under `apps/api/src/modules` has a `module.manifest.ts` and a `README.md` (29 modules).
- **Identifiers and data:** no `randomUUID`, `nanoid` or `uuid` import; no `orgId`, `tenantId`, `branchId`, `outletId`, `customerId` or `businessUnitId`; no `count() + 1`; no `parseFloat` or `toFixed` on money; no `console.*`, no empty `catch`, no `any`, no TODO (grep of `apps` and `packages`, tests excluded).
- **Events:** every event type comes from a `*_EVENT_TYPE` constant in `packages/contracts`.
- **Customer-facing numbers** use sequences (`ORDER`, `PAYMENT`, `RETURN`, `ZREPORT` GAPLESS, …).
- **Accounting:** one revenue account per kind (`REVENUE_PRODUCT` … `REVENUE_EVENT`), so 3.40 needs no new account.
- **ADR numbers** 109–148 are unique. 111 and 117 were reserved and not used. ADR-135 has two add-only notes (3.11 C, 3.5b A1) as rows of their own; that is the agreed pattern for amendments.
- **Route budgets:** every admin, platform and storefront budget test passed on `main` CI 40279558277. The largest known: `/pos` 166.8 KiB of 180 (3.9 B), categories 169.0 of 170 (3.2b).

## Doc drift (fixed in this review's commit)
- `09-DOMAIN-MODEL.md §6` ownership map had no row for `commerce/pos`, `commerce/report`, `commerce/commission`, `commerce/pricing`, `commerce/credit` or `commerce/directory`, missed `ResourceSlotUsage` (booking) and `ApprovalToken` (iam), and named the website module `channel/website` (the code is `commerce/website`; site pages only, the rest comes with Phase 4). Added and corrected.
- `commerce/report/README.md` said the owner and manager grants were not done; they are (`report-role-grants.ts`). Corrected.
- `03-ROADMAP.md`: cards 3.40 to 3.43 added.

## STATUS gap notes that are now closed (rows left as history)
- 3.5a: `PaymentSummaryReader` is no longer a zero stub in `routes/`.
- 3.8a: production ORDERED handlers exist (accounting, 3.8 on).
- 3.8c: the payment and booking posting sources are real (3.8, 3.6).
- 3.6: deposit enforcement (3.8). 3.23: posting (3.24) and screens (3.5a B). 3.27: revenue (3.31) and refunds (3.32). 3.2b: SERVICE and PLAN browser scenarios (3.6, 3.7).

## Open items carried forward (not blocking Phase 4)
- 3.10: the report rebuild command (decision 6) needs `voidedAt` on expenses and per-transition timestamps on bookings and enrollments.
- 3.0: no virus scan, no reference tracking or garbage collection, the public file route has no rate limit.
- 3.32: a booking cancellation-fee refund does not lower `CANCELLATION_FEE_INCOME`. 3.34: one bad-debt journal per reversal, not per request; a cross-location reversal answers 404 where the plan said 403.
- 3.33: bookings and sessions do not see enrollment `ResourceExclusiveHold` rows; time-off does not check existing bookings (product decision).
- 3.9: posting the cash variance to the books; offline selling (online only at launch).
- 3.11: no payout void (a wrong payout is fixed with a manual journal entry).
- Flaky or slow tests: `sync-indexes.test.ts` and `main.test.ts` (both spawn processes) timed out on CI; `ordered-event-worker.test.ts` › "runs a replayed event again…"; admin `auth-flow` › "shows how long to wait…". A small test-stability card when one fails again.
- Two patterns for client text in admin screens (`screen-text.tsx` label props and a nested `I18nProvider`): pick one in `05-CONVENTIONS.md` before Phase 4 screens.

## For the owner
- **3.40 question:** does a walk-in on a bookable service block the stylist's calendar? Recommended: no.
- **ADRs 109–148 are "Accepted (proposed)"** except the owner decisions recorded in them. The ones that shape later phases: 115 (ordered event streams), 123 (payments), 124 (accounting), 137 (orders as payment requests), 146 (POS), 148 (reports).
- Open product decisions from earlier remain: time-off against existing bookings (3.33), POS offline selling, the storefront `noindex` switch (M.6).

## Verdict
**PASS WITH FIXES.** Phase 4 code merges when:
1. 3.40 (walk-in services) is merged
2. 3.41 (day scenarios with report numbers) is merged and green on `main`

3.42 and 3.43 may run beside Phase 4. 3.38 and 3.39 are already planned and running. Track M is not blocked by this review.
