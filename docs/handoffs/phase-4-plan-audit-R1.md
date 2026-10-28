# Phase 4 plan audit R1 — original planner self-audit

Date: 2026-10-28 · Author: Codex · Branch: s/docs-plan-phase-4
Code baseline: 016bd228ec92a40d65179dc8db1132184adab983 · Previous plans: 7a417775
Scope: review and correct Phase 4 planning documents under the owner's explicit whole-phase request. No application implementation. This is not the independent T1 plan check or a Phase 4 completion review.

## Outcome

The previous plans had material gaps. This revision corrects the design in the owning cards, adds a single [assurance protocol](../plans/phase-4-assurance.md), and aligns the [execution map](../plans/phase-4-lanes.md), roadmap, Phase 4 STATUS entries and provisional ADRs. The owner explicitly approved including loss reconciliation on 2026-10-28. Architecture mechanics remain proposed for independent checking.

## Findings and corrections

| Finding | Evidence / risk | Correction and implementation evidence required |
|---|---|---|
| P1 principal collision in replay | kernel/idempotency/idempotency.middleware.ts resolves organization before user; original plan made extension optional | 4.3 A0 is mandatory; trusted principal namespace and authorization before cached response; P4-01/02 |
| P1 commit-before-response retry | HTTP completion is outside the domain transaction; TTL is not durable business uniqueness | transactional receipt/input hash, unique checkout quote and command keys; original acknowledgement separated from live state; P4-02/03 |
| P1 guest claim becomes unreadable | original plan required canonical contact link AND ownership after claim without merging contacts | CheckoutAccess is the single authority; immutable original contact/economic identity retained; revocation also gates replay; P4-06 |
| P1 booking receipt versus expiry | hold-booking-persist.ts does not initialize payment summary; expire-holds.job.ts lacks deposit settlement; booking-request-reader.ts accepts all statuses | A3B/A3P initialize summary, share booking fence, request inside receipt transaction, settle partial advances at expiry; P4-05 |
| P1 mixed checkout pricing/retry | separate pricing and final owner commands could disagree; inner retry can continue an aborted outer session | one session/clock, compare final owner totals before commit, retry entire outer transaction; P4-03/04 |
| P1 settlement versus reversal | original per-owner claim and generic payment reversal had no shared concurrency fence | payment-owned CollectionClaim generations, dependent corrections and COD-specific reverse/replace commands; P4-14/15 |
| P1 cross-stream posting order | order and paymentAccount streams are separate; delayed handlers may read changed source state | immutable shipment/correction facts, explicit prerequisite journals, bounded retry/DLQ, stable posting keys; P4-13/16/22 |
| P1 no terminal path for missing goods | RTS originally only RESTOCK/DAMAGED; failed order could remain open forever | owner-approved S3 loss closure, full quantity reconciliation, original-cost loss/recovery/correction, no phantom stock; P4-25/26 |
| P1 migration loses drafts / edit race | original migration imported only published static pages and lacked shared migration fence | import all pages plus includeInPublication; freeze legacy live view until first publish; serialize import/edit/adopt; P4-07/23 |
| P1 policy bypass outside sections | page metadata/path/order, navigation and static inclusion not fully modeled | shared pageRules, variant palette and full-document policy; every save/adopt/restore route validates same rules; P4-08 |
| P1 stale public payload leaks | hiding disabled sections in JSX alone leaves payload/cache readable | separate public projection before serialization; current capability/file gate; no public historical snapshots; P4-12 |
| P1 uncertain provider create/delete | late create after deletion can orphan/reassign domain; no explicit suspended recovery | durable DomainOperation, quarantine until uncertain operations resolve, generation CAS, fresh verification; P4-10/20 |
| P2 canonical domain duplicated | stored isCanonical alongside site pointer can diverge | Site.canonicalSiteDomainId sole selector; select/delete/suspend share CAS; DTO derives boolean; P4-11 |
| P2 outage handling on host resolution | provider outage could be confused with proof loss; repeated loader checks hurt latency | no provider API on reads; local authoritative lookup once/request, bounded negative cache, 503 distinct from 404 |
| P2 public website image purpose missing | file-purpose.ts only LOGO/OFFERING_IMAGE are public; protected photos must stay private | 4.1 F adds WEBSITE_IMAGE through existing upload/quota/processing/permission paths; P4-09 |
| P2 privacy lifecycle incomplete | new checkout snapshots/access were absent from account export/erasure plan | reuse contact participant ports, revoke access, bounded export, redaction/retention policy gate; P4-17 |
| P2 unbounded comparisons / DTO drift | candidate organization arrays could grow; catalog signature returned full snapshots despite summary prose | platform/industry indexed grouping projection, keyset pages, separate summary/detail contracts, versioned rebuild; P4-19 |
| P2 hidden N+1 / worker starvation | per-section calls and large reconciliation jobs lacked explicit caps | per-page batching/query/row bounds, resumable batches, bounded caches/retries and per-record failure handling; P4-18/20 |
| P2 preview and unpublish incomplete | inert behavior was UI-only; unpublish could reactivate legacy fallback | PREVIEW mode disables handlers; shared unpublish command + hasPublishedOnce; current authoritative read gate; P4-12/23 |
| P2 duplicate decisions / readiness drift | map repeated ADR prose; map parts/tiers differed from card files; some families lacked exact files | ADR text lives only in 04-DECISIONS; part sequence/tier corrected, owner-specific integration splits and JIT checklist; P4-21 |

Code evidence paths above are relative to apps/api/src unless named as contracts. Verified exact booking job path is modules/commerce/booking/application/jobs/expire-holds.job.ts. The original summary/receive/termination/reversal source files were inspected along with tenant indexes, file purposes, customer privacy ports and accounting event sources. No legacy source beyond the already authorized Phase 4 port row was imported.

## Mission and rules assessment

One codebase and Offering kinds remain the foundation. Only platform/industry and resolver read industry; business differences remain template/config data. Customer UI stays mobile-first, BN/EN, manifest-driven and tied to actual APIs. The existing storefront, file service, identity system, command ports, ledgers, approval service and rendering library remain authoritative. No new parallel money/stock/contact engine is authorized.

Security gates cover permission, entitlement, organization/location, current principal, privacy and safe projections. No-damage failure means atomic business state, durable effects, idempotent retries, bounded recovery and observable accounting lag. It does not promise zero downtime or exactly-once external networks. Shared assurance requires safe-integer money, UUID v7, tenant plugin/models(ctx), contracts-first vocabulary, validation/i18n, outbox and indexed bounded reads throughout.

## Remaining implementation gates

1. Lead reconciles Phase 3 closure from actual merged review evidence; current state documents disagree on blockers. This docs session does not override that gate or edit lead ownership.
2. JIT planner refreshes each part against merged dependencies and freezes exact <=15 T1 / <=25 T2 production file lists, complete exported signatures, vocabulary, indexes/migrations and actual test names. Future families are blueprints, not ready-to-code instructions. Large C/R/S3/I and cross-module registration seams must split by owner before implementation.
3. A different tool performs the required T1 plan check; architecture proposals receive the normal owner/lead decision and numeric ADR allocation. This author's self-audit cannot supply that approval.
4. Implementers run the named failure/concurrency/security/day-scenario tests and appropriate local/CI/browser gates. Domain production readiness additionally needs real Cloudflare account/DNS/TLS/removal evidence. Retention/exit policy is finalized under Phase 6.3 before launch.
5. Phase 4 reviewer checks actual code, accounting reconciliation, mobile/performance budgets, manifest-off behavior and Track M regressions before pilot acceptance. No runtime reliability claim is made from Markdown.

## Verification

Documentation validator passed: 6 active plans × 11 required sections, 8 TypeScript snippets syntax-parsed, 23 relative Markdown links, 14 verified existing code anchors, 26 distinct invariant specifications, 5 unique provisional ADR entries and 6 Phase 4 STATUS rows; errors: []. git diff --check exited 0. Tracked diff is confined to docs; two new docs are this audit and the assurance protocol. Stale optional-namespace/duplicated-access/canonical-field contract text was removed. STATUS edits are confined to the Phase 4 planning section.

Snippet parsing is syntax validation, not application typechecking or proof that planned interfaces already exist. Application typecheck/lint/test/build/browser suites are not run for this docs-only revision; no application files changed. Required implementation test cases are specifications, not claimed passing tests. Historical checks in phase-4-planning.md remain historical. Normal commit hooks remain enabled; no runtime CI pass is claimed for this planning revision.

## Handoff

Continue from the refreshed phase map, assurance protocol and owning card. Keep changes on s/docs-plan-phase-4 for lead review; no main merge/push or unrelated worktree changes. The owner can inspect every correction before implementation begins.
