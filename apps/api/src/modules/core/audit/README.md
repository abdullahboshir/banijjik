# core/audit: the append-only audit log

Who changed what, when, in which request. One entry per business change, written in the same
transaction as the change, so an entry exists exactly when its change does.

- **Entity:** `AuditLog` (09 section 5.8) in the tenant database, tenancy `ORGANIZATION`, registered `appendOnly`:
  inserts only, any update, replace or delete throws (ADR-014, ADR-089). Only `runAsSystem(MIGRATION)` may delete, for a future retention job.
- **Writing:** other modules receive the kernel port `AuditRecorder` (`kernel/audit`) from `routes/v1.ts` and call
  `record({ action, entityType, entityId, changes? })` inside their unit of work. The organization, actor user,
  actor member, request ID and system reason come from the request context: a caller cannot name them.
  Outside a transaction `record` throws (`errors.audit_needs_transaction`).
- **Vocabulary:** `AUDIT_ACTION` (`<module>.<entity>.<pastTenseVerb>`) and `AUDIT_ENTITY_TYPE` in `@banijjik/contracts`.
  A module card adds its actions there, add-only.
- **Safe fields only:** `changes` is `{ field: { from?, to? } }` with strings, numbers, booleans, null or string lists.
  Never record a password hash, token, secret or full card/phone number. Record what changed, not the whole row.
- **Endpoint:** `GET /api/v1/orgs/{organizationId}/audit-logs`, permission `audit.log.read` (sensitive).
  Filters `entityType`, `entityId`, `actorUserId`, `from`, `to`; `?page&limit` (limit at most 100); newest first.
  OWNER holds it, MANAGER holds it (READ row of the `audit` module in 10 section 10), the other roles do not.
- **Not here:** the platform-database copy for operator actions (card 1.8), the `audit.retentionDays` setting (settings module, 2.x), a UI (Phase 2).
