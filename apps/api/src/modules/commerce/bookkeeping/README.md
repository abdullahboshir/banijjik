# Bookkeeping

Optional bookkeeping UI and tenant routes over the accounting module (ADR-128).
This module owns no models or collections. It imports account, journal and statement operations
only through accounting/index.ts. Accounting continues posting when this module is disabled.

All routes are declared in the manifest, protected by the tenant pipeline and permission guards.
Account maintenance and organization-wide reads require grants at ALL locations. Location writes
validate active organization locations and caller assignments. Manual entries and reversals require
Idempotency-Key and share one transaction with approval consumption, audit and outbox publication.

System account codes and types remain fixed; display names can change. Custom accounts use C-n,
version checks, optional same-type parents and archival. Historical reports include archived accounts.
See docs/handoffs/3.8b.md for verification and index deployment/recovery requirements.
