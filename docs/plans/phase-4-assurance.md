# Phase 4 assurance and implementation gates

Audit revision: 2026-10-28 · Author: Codex (original planner, self-audit) · Code inspected: 016bd228 · Plans inspected: 7a417775
This document owns the shared verification protocol. Card plans own their domain contracts; docs/04-DECISIONS.md owns ADRs. It is not an independent T1 approval.

## What reliability means

Do not promise zero outages or exactly-once networks. Required guarantee: committed business records, ledgers and outbox agree; rejected/aborted attempts cause no business damage; duplicate delivery/retry causes no duplicate economic effect; transient failure is observable and recoverable. Test both committed-response-lost and transaction-aborted cases. Accounting projections may lag; UI must not confuse lag with zero balance or silently mark a failed posting complete.

## Ownership and single sources of truth

| Concern | Authoritative owner | Consumers may do |
|---|---|---|
| vocabulary, limits, event/posting/audit keys | contracts owner subpath | import, never redeclare runtime enums |
| request validation / colour contrast | validation owner subpath / existing shared contrast helper | reuse same schemas on server/client |
| section availability | owning module manifests + resolver | intersect registered keys with effective capability data |
| section schemas and variants | contracts descriptor + validation registry | renderer/editor dispatch by descriptor, never duplicate allowed variant lists |
| React rendering | packages/ui/website | use pure renderer with sanitized view model; API/domain never import React |
| site lock policy / publication | website application commands | platform and tenant editors call same commands with trusted actor |
| templates and industry grouping | platform/industry | website consumes eligible keys/revisions, never reads industry |
| hostname identity | HostClaim platform routing record | SiteDomain exposes lifecycle; Site canonicalSiteDomainId is sole canonical pointer |
| prices, stock, capacity, requests | pricing/inventory/booking/enrollment/sales | checkout composes public command ports; no copied algorithms |
| collected money and refunds | payment; accounting posts journals | courier/rider records reference payments, never create parallel balances |
| request ownership | CheckoutAccess, separate from immutable request contact snapshots | tracking/claim/export/replay authorization use the same policy |
| execution ordering and unfinished gates | phase-4-lanes.md | cards reference it; future file expansion is planner work, not implementer discretion |

DRY means shared rules, not merging unrelated business aggregates into a generic mutable table. Do not create a second money type, custom-field validator, rate limiter, transaction wrapper, logger, file store, OTP system or approval-token implementation. New cross-module commands export factories/ports from index.ts, not persistence classes. New domain types import only contracts/ids.

## Transaction and replay protocol

1. Validate shape, authentic principal, entitlement, active location and ownership before any replay response. Principal is derived from a cookie, never body/contact ID. A disabled capability must not be bypassed by a stored response.
2. Kernel idempotency currently keys tenant requests by organization only and records the HTTP response outside the business transaction. 4.3 therefore MUST add the explicit storefront principal namespace and authorization-before-replay; this is not an optional task.
3. Each economic command stores a durable domain receipt/natural key in the same transaction as its effect. Store immutable operation input hash and result identifiers. Same key/different input is 422; same key after an uncertain HTTP outcome returns the original result. An HTTP replay cache is not the business uniqueness guard.
4. Checkout uses one outer withTransaction. All nested commands join it; a retry re-runs the whole callback. Do not continue writing on an aborted session, retry one nested group independently, or swallow a driver transaction error as an empty result.
5. Use one injected operation clock per transaction attempt. Every calculation/final command runs on that attempt's session and clock. Compare persisted owner-produced totals with the accepted quote **before commit**; if any differs, abort everything and request a fresh quote. No second website implementation of pricing.
6. Snapshot isolation is not a concurrency lock for a read-only precondition. Every conflicting write must share a CAS/unique claim/fence document with the operation it can invalidate. Specify the exact document for stock/capacity, payment-versus-expiry, settlement-versus-reversal, and canonical-domain switches.
7. Outbox events carry IDs and typed contracts, with source facts sufficient to replay after subsequent state changes. A delayed handler must not reconstruct the first shipment from a later mutated status. Retain immutable posting snapshots and stable posting keys.
8. Sequential processing per transaction; no Promise.all database writes on a shared Mongo session. Parallelize independent reads only when they do not violate session/consistency rules.

## Bounded work and capacity

- Validate finite safe-integer minor amounts, same currency, bounded decimal quantity rules from catalog; reject arithmetic overflow before persistence.
- Lists page/limit <=100, deterministic tie-breaker and compound index. Jobs use keyset batches <=100 with a persisted/resumable cursor; catch/report per record, retry transient failures, continue unrelated records. One failed organization must not stop reconciliation for others.
- Public page loader deduplicates section dependencies per request, batches IDs through owner ports, caps total loaded business rows at 100/page and 20 distinct source queries/page. Content requiring more is paginated or lazy-loaded explicitly. No per-card stock/price/file call.
- Every tenant query uses lean + projection where appropriate; explain/index evidence accompanies new hot list queries. Prefix-search input is escaped/anchored; no arbitrary regex or arbitrary sort field.
- Domain verification/reconciliation has bounded concurrency and provider timeouts, retry backoff, retry budget and DLQ/operator recovery. Repeated verify clicks coalesce one outstanding job per domain/generation.
- Shared cache limits are byte-aware and bounded, keys include normalized dimensions and version. Security gates remain authoritative; no negative-cache entry from an upstream error.
- Planning values are safety limits registered in contracts/config, not invented subscription pricing. Do not add a dependency merely to implement a small bounded mapper.

## Privacy, security and lifecycle

Public projection and private snapshot are separate types. Filter disabled sections/fields before serialization, not only in JSX. Invalid/private file references cannot become public through a cache. No source JSON includes internal policy, operator identity, unpublished pages, private directory fields or recipient snapshots.

Customer export/erasure must include newly introduced website checkout/access/snapshot data through existing contact participant ports. Guest requests use the original guest session and the same ownership evaluator. Revocation invalidates tracking and replay authorization immediately. Financial ledger retention is preserved: access/identity may be erased without deleting economic evidence. Retention durations follow the approved 6.3 policy, never an invented legal duration; before pilot the policy must be recorded for checkout PII and static content history too. Session TTL is credential expiry, not automatic erasure of all associated PII.

User-authored static content can contain personal data. Retained immutable versions are administrative/private; public responses expose only the current eligible projection. If lawful redaction is required, use an explicit audited redaction/tombstone overlay and current visibility gate; do not silently rewrite financial history or expose the old content through a version URL.

Host/cookie tests cover sibling subdomains, custom hosts, forwarded-header spoofing and direct API calls. Existing host-only OTP cookies are unchanged. Preview components disable links/forms/network mutations centrally; each section cannot invent its own preview-security behavior.

## Release and rollback

- Additive schemas first, build/sync indexes with an idempotent dry-run/report, then backfill in bounded batches, then activate affected routes. No uniqueness index is assumed to exist because the schema declares it.
- Do not publish a capability until its real adapter, index, jobs, API permission/entitlement guards and tests are present. Isolated part tests may fake ports; production wiring may not.
- For deployment rollback keep snapshot schema readers compatible with current and previous released schema version. Unknown future schema fails closed with a diagnosable response, never renders unchecked JSON. Rollback a site through a new publication, not by changing the release/schema migration history.
- Provider credentials and real DNS/TLS tests remain staging/deployment gates. Reconcile unfinished domain operations on worker restart.
- Financial reconciliation compares durable source records with journals, stock and collection claims in bounded jobs. It alerts on discrepancy; it does not synthesize balancing entries or auto-delete records.
- Observability: structured logs with requestId/organizationId/source IDs, no cookies/OTP/recipient data; counters for retries, exhausted jobs, stale domain state, oldest unposted event and reconciliation discrepancies. Operations lists are paginated and permission-protected.
- Operational runbooks specify rollback, DLQ replay, index/backfill restart and restoring database/outbox together. A restored consumer cursor cannot skip restored source events.

## Required invariant tests

These are required implementation tests, not tests claimed to pass in this docs audit. Every part maps applicable IDs to actual test files/names in its handoff.

| ID | Behavioral assertion | Owner |
|---|---|---|
| P4-01 | revoked/foreign principal cannot read stored replay response | 4.3 A0/A4/A5 |
| P4-02 | same command after commit-before-response crash has one business effect | every mutating API part |
| P4-03 | quote expires or final owner prices differ: all business writes abort | 4.3 A4 |
| P4-04 | last capacity/stock race and outer transaction retry cannot duplicate another group | 4.3 A3/A4 |
| P4-05 | deposit payment vs hold expiry has exactly one valid winner or compensating settlement | 4.3 A3B/P |
| P4-06 | claimed guest checkout is readable by claimant and unreadable by revoked guest | 4.3 A5 |
| P4-07 | draft import preserves unpublished content and old public pages until first publish | 4.1 C |
| P4-08 | any alternate edit/adopt/restore route enforces same current policy | 4.1/4.4/4.5 |
| P4-09 | public image purpose accepts website images but cannot reveal protected photos | 4.1 F |
| P4-10 | late provider-create result after deletion is reconciled before claim release | 4.2 A3 |
| P4-11 | authoritative host checks survive cache hits; cache failure is not tenant-not-found | 4.2 C |
| P4-12 | immutable version URL never exposes disabled/private/unpublished content | 4.1 A3/4.2 C |
| P4-13 | redelivery event cannot repost first-shipment revenue or original COGS | COD J1 |
| P4-14 | settled collection cannot be reversed behind an active settlement | COD P/C/R |
| P4-15 | reversing settlement after reassignment/re-settlement cannot release newer claim | COD C/R |
| P4-16 | cross-stream delayed original posting/reversal converges without double reversal | COD J1/J2 |
| P4-17 | checkout/account/guest erasure and export include snapshots and access grants | 4.3 A5 |
| P4-18 | section rendering query count and response-size stay bounded at maximum design | 4.1 B/4.3 A1 |
| P4-19 | ordered projection duplicate/out-of-order events and rebuild yield same summary | 4.4 A2/COD I |
| P4-20 | jobs resume after restart and one corrupt record does not starve later records | all worker parts |
| P4-21 | production route disabled until full dependency wiring/index readiness | every composition part |
| P4-22 | source/ledger reconciliation catches a missing event without fabricating money | COD V |
| P4-23 | stale editor restores preserve locks, static content and immutable versions | 4.5 B2 |
| P4-24 | same engine serves salon/gym/coaching/retail/directory through config only | phase review |
| P4-25 | lost goods close only after full quantity reconciliation; no second stock write-off | COD S3/J1/V |
| P4-26 | late loss recovery/correction preserves original costs and cannot over-recover | COD S3/J1/V |

Part aliases in this matrix: A5 means A5A/A5B, A3B/P means A3B/A3P, 4.1 C means C1/C2, 4.2 C means C1/C2 and COD I means I0–I3. Their exact split and gates live in the owning card, not a second task registry here.

## Implementation-ready checklist

A plan is implementation-ready only after exact files, exported signatures, runtime vocabulary/permission/audit/event/settings entries, model registration/index deployment, per-part tests and real dependency versions are frozen. Folder-only file families are **design blueprints**, not permission to start coding. The planner expands them just in time as project rules require. A passing Markdown/syntax check cannot substitute for this gate, independent T1 review or runtime tests.
