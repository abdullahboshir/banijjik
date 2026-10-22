# Enrollment

Owns PLAN enrollments, billing periods, capacity seats and append-only staff check-ins.
The manifest provides PLAN and declares routes, permissions, settings, events and sequence.
All writes use the tenant/location plugins, version checks and a MongoDB transaction.
Fees come from the pricing quoter; admission fees apply only to the first period.
Renewals append periods. Unfreeze alone extends the latest end; the original end stays recorded.
Booking owns open-ended bed holds; terminal transitions close them without deleting history.
Three midnight jobs renew/expire, mark overdue and emit renewal reminders through the outbox.
Contact bill-to links come from effective custom fields, never an industry branch.
Payment allocation, activation from payment and payment refunds are deferred to card 3.8.
