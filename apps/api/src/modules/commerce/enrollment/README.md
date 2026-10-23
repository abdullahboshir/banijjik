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
Payment allocation, activation from payment and payment refunds are a follow-up to the merged payment module. Until then, default payment-required activation is unavailable, and unpaid ACTIVE enrollments become OVERDUE after grace and are blocked from check-in by default.
