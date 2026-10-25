# Enrollment

Owns PLAN enrollments, billing periods, capacity seats and append-only staff check-ins.
The manifest provides PLAN and declares routes, permissions, settings, events and sequence.
All writes use the tenant/location plugins, version checks and a MongoDB transaction.
Fees come from the pricing quoter; admission fees apply only to the first period.
Renewals append periods. Unfreeze alone extends the latest end; the original end stays recorded.
Booking owns open-ended bed holds; terminal transitions close them without deleting history.
Three hourly jobs catch up using organization-local business dates: renew/expire, mark overdue, and remind once per period through the outbox.
Manual renewal creates an advance period without changing the current period; the renew job promotes it at the boundary without a second renewed event. Freeze is refused while an advance period waits.
The yearly freeze allowance caps credited extension days, never the ability to unfreeze; the renew job ends a limited freeze when its allowance is reached.
Unavailable plans expire at automatic renewal; billing cadence, session limits and fixed terms come from the stored snapshot. Each failed job item is logged and the next member still runs.
Bed hold ends are exclusive: expiry/completion release on the last period end plus one day; cancellation releases on the later of today and the hold start.
Run `npm run db:sync-indexes -w @banijjik/api` on deploy to add `{ organizationId: 1, status: 1, enrollmentId: 1 }` for the nonterminal job scan.
Contact bill-to links come from effective custom fields, never an industry branch.
Payments allocate to periods (ADR-139): `requestType ENROLLMENT`, `requestId enrollmentPeriodId`, one summary per period with `total` equal to its fee. The `enrollment.syncPayments` event handler derives `OPEN | PARTIAL | PAID` from net paid, and activation and the jobs sync the period they check, so payment-driven activation never waits for the worker. An overdue enrollment returns to ACTIVE when its current period is paid; a refund never de-activates — the overdue job decides later from the period status. Enrollment payments are held as advances (`BEFORE_REVENUE`) until card 3.31 posts period revenue; refund execution on cancellation is card 3.32.
Cancellation snapshots refundableOnCancel and refundedAtCancel per period in its transaction (ADR-143). PRORATED includes paid future periods. The standard refund endpoint checks the remaining limit in its transaction; closed summaries lower their totals so refunds do not recreate dues. revenueClosedAs records the retained income account. Detail periods expose refundRemaining using the same helper as the payment reader; summary reads are batched.
