# SMS

Core integration: one active organization gateway overrides the platform default.
Credentials use kernel AES-256-GCM with owner and field bindings; views and audit changes never contain values.
Only Bangladesh E.164 numbers are submitted. Permanent refusals resolve; transient faults retry the event.
Daily caps cover both sources; monthly package limits cover platform-paid sends only.
Counts are not reservations: concurrent sends may exceed a cap by the in-flight count (ADR-147).
Gateway tests are explicit inline sends with independent hourly limits.
SmsLog is append-only with last-three-digit phone privacy and 180-day retention.
Drivers use configured URLs and local HTTP stubs in tests.
BulkSMSBD Unicode flag is unverified against the live provider; the owner sends a real Bangla test SMS during the M.9 B pilot before launch.
