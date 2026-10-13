# AGENTS.md: rules for every AI session (Claude Code, Cursor, others)

banijjik = multi-tenant, multi-industry business SaaS (clean successor of manoxen). Vision: `docs/00-VISION.md`. Target design: `docs/01-ARCHITECTURE.md`. Decisions: `docs/04-DECISIONS.md`. Conventions: `docs/05-CONVENTIONS.md`. Accounts, tenancy modes, channels, chatbot, product source, courier/rider, website design control: `docs/06-AUTOMATION-AND-ACCOUNTS.md`. Modules/packages/industries/offering kinds: `docs/07-CAPABILITY-MODEL.md`. Chatbot: `docs/08-UNIVERSAL-BOT.md`. Phase D design docs (`09`–`15`) are binding once approved.

## Session protocol (mandatory)
1. **Read first:** this file, `docs/STATUS.md`, your card in `docs/03-ROADMAP.md`, and only the doc sections the card needs.
2. **One card per session.** Do not start, "quickly fix" or refactor anything outside the card. Write unrelated problems you notice into the STATUS.md handoff instead.
3. **Plan before code.** Post a short plan (files to create/change, tests). If the card is ambiguous, conflicts with a doc, or needs a product decision: **stop and ask**. Never guess.
4. **Verify:** run typecheck, lint, test and build (the commands defined in Phase 0.2). Report real output. Never claim a pass you did not see.
5. **Finish:** write `docs/handoffs/<card>.md`, update only your card row in `docs/STATUS.md`, and commit on branch `s/<card-id>-<slug>`. An architectural choice not covered by an ADR → add an ADR, marked "Accepted (proposed)", and tell the owner.
6. If context is running low, stop at a clean point and write the handoff. Do not leave half-written files.

## Session types & model roles
Each card has a tier in `docs/03-ROADMAP.md` (T1 = risky core, T2 = standard, T3 = simple, following an established pattern).

| Session | Who | Output |
|---|---|---|
| **PLAN** | Opus for T1/T2; Sonnet allowed for T3 | `docs/plans/<card>.md` from `docs/plans/_TEMPLATE.md`. No application code. |
| **IMPLEMENT** | Sonnet | Code + tests exactly as the plan says, then a STATUS.md handoff |
| **REVIEW** | Opus, mandatory for T1 | Review of the branch against plan, AGENTS.md and DoD; findings fixed before merge |
| **MERGE CHECK** | The planner or the owner, every T2/T3 card | Before merge: rerun typecheck/lint/test/build without cache, read the diff against the plan, check deviations in the handoff |
| **PHASE REVIEW** | Opus, at the end of every phase | Whole-phase review: cross-card consistency (names, contracts, ports), the roadmap "Phase done" criteria, doc vs code drift, open gaps in STATUS.md. The next phase starts only after it passes. Written to `docs/handoffs/phase-<n>-review.md` |

- Plans are written **just in time** (rolling wave): only for the next few cards, based on the code as it is now. Never plan a whole phase in advance.
- An implementer who finds a gap, contradiction or missing decision in the plan **stops and asks**. They do not invent design. Small mechanical choices (local variable names, private helpers) are fine.
- A plan older than the code it depends on (code changed since `Based on commit`) must be refreshed by a PLAN session before implementing.
- Design phase (D cards) is always Opus.
- Foundation first: a card that later cards build on (kernel, tenancy, auth, RBAC, module registry, ledgers) is never merged with a known defect. Fix it before the next card starts, because every defect there spreads into all later code.

## Definition of Done (a feature is not done until all of these hold)
- API + validation + permission + entitlement + tenant/location enforcement.
- Tests: happy path, validation error, permission denied, cross-org denied (+ cross-location where relevant).
- UI wired to the real API, mobile layout checked, BN/EN keys added.
- No TODO, stub, mock data or commented-out code presented as finished. A known gap must be written in STATUS.md.

## Hard rules (violations = reject the change)
**Architecture**
- No "scope" concept. `Organization → Location` only. Location is a page filter (`?location=`) or form field. **Never** a global header switcher, a scope context, or a route group per level (ADR-004).
- **Feature code never reads `industry`.** It asks `resolveOrgConfig` for modules, kinds, fields, settings and terms (ADR-033). Only `modules/platform/industry` and the resolver may read the industry key. Never hardcode industry-specific fields, nouns ("Student", "Patient") or `if (industry === ...)`.
- A new industry is **data** (template). If it seems to need code, it is a new offering kind or a capability module with its own manifest. Stop and propose an ADR (ADR-034).
- Every module ships a `module.manifest.ts`. Its routes, menu, settings, bot tools and storefront sections come only from the manifest, and its generated "module off" tests must pass.
- Products, services, plans, rentals and events are all **Offerings** with a kind. Do not create parallel product-only and service-only models.

**Chatbot (ADR-035)**
- No per-industry, per-product or phrase/regex/keyword code for understanding messages. Behaviour comes from generic tools, the state machine, config and data (synonyms, policies).
- Every bot bug fix starts with a failing golden conversation in `bot-evals/`, then a fix in the generic layer. The eval suite must pass in CI.
- Every price, stock, availability, date or fee in a bot reply must come from a tool result in the same turn (grounding guard).
- Import another module only through its `index.ts`. Layers: presentation → application → domain. Domain imports nothing but `@banijjik/contracts` constants/types and `@banijjik/ids` (ADR-011a).

**Identifiers & data (ADR-036, details in `05-CONVENTIONS.md`)**
- Every entity ID is a **UUID v7** from `newId()` in `@banijjik/ids`. No `crypto.randomUUID`, `uuid` v4, `nanoid` or other generators.
- ID field = `<entityName>Id` everywhere: domain, DB, API, frontend, events (`userId`, `contactId`, `offeringId`, `orderId`). No bare `id`, `orgId`, `tenantId`, `branchId`, `outletId`, `customerId`.
- Mongo `_id` is infrastructure-only. It never appears in entities, use cases, API responses, events or references. References always use the domain ID. Embedded docs use `_id: false`.
- Customer-facing numbers (invoice/order/booking no.) come from the per-org atomic sequence, never `count() + 1`, never the UUID.
- Mutable aggregates carry `version` (optimistic concurrency). Audit fields `createdAt/updatedAt/createdByUserId/updatedByUserId` on every tenant document. Phones are stored as E.164.
- Tenant filtering is skipped only via `runAsSystem(reason, fn)` with an enum reason. Never inside module repositories, use cases or controllers.
- No empty `catch`, no `console.*`. Use the logger and the central error capture.
- Transport middleware (request id, access log, CORS, body parser) is mounted once in `app.ts`. Auth, tenant, entitlement and permission middleware for tenant routes are mounted once in `routes/v1.ts`. `routes/platform.ts` mounts `authenticatePlatform` for the platform API, and `runInOrganizationContext` is also used from `routes/platform.ts` and `routes/organization-config-ports.ts`. Module routers never re-mount them.
- No empty folders, packages or placeholder files. Add a new dependency, package or app only when the card requires it.

**Tenancy & security**
- Every tenant-owned model uses the tenant plugin. Never accept `organizationId` from the request body or query. The active org comes from the URL path `/[orgSlug]` and is validated against the user's memberships (ADR-022). Business code gets models through the kernel `models(ctx)` accessor, never by direct import (ADR-023).
- Location-scoped writes validate `locationId` against the user's assignments.
- Secrets only via validated config. Never commit `.env`. Never log tokens, passwords or credentials.
- Auth uses httpOnly cookies. No tokens in localStorage. No `ssr:false` on app shells (ADR-010).
- Enforce permissions in the API. Hiding UI is never the protection.

**Correctness ("no-damage failure")**
- Money = integer minor units + currency. No float math on money (ADR-013).
- Stock and accounting are append-only ledgers. Fix mistakes with reversing entries (ADR-014).
- Multi-document writes use `withTransaction()`. Money/stock-creating endpoints require `Idempotency-Key`.
- External side effects (SMS, courier, webhooks out, AI) go through the outbox/queue, never inline.

**Single source of truth**
- New enum, status, permission key, module key, error code or event name: add it to `packages/contracts` first.
- Request schemas live in `packages/validation`. No user-facing literal strings (use i18n keys).

**Performance & mobile**
- Every list endpoint is paginated (limit ≤ 100) and backed by a compound index starting with `organizationId`. No N+1 queries. `lean()` + projection on reads.
- Dashboards and reports read pre-aggregated summaries, not full scans.
- Build mobile-first: card layout on small screens, touch targets ≥ 44 px, no horizontal scroll.

**Readable code (ADR-041, full rules in `05-CONVENTIONS.md`)**
- Write for a human reader:
  - full-word names that say what it is
  - small single-purpose functions (≤ 60 lines, complexity ≤ 10, depth ≤ 3)
  - guard clauses, not nested `if/else`
  - no nested ternaries, no magic values, no `any`, no clever one-liners
- Comments explain *why* (rule, edge case, ADR), never restate *what*. No commented-out code.
- Every module keeps a short `README.md`. Tests are named as behaviour specs.
- Follow the existing module template and the style of neighbouring code. Do not invent new patterns.

## Parallel sessions
- Two sessions may run at the same time **only** on cards listed as a pair in `03-ROADMAP.md` "Parallel lanes" (no dependency between them, mostly separate files).
- Each session works in its **own git worktree and branch** (`git worktree add ../banijjik-<card> -b s/<card>-<slug>`). Never two sessions in the same folder.
- Shared hot files (`packages/contracts` index files, root `package.json`, `routes/v1.ts`, module registry): add lines only, never reorder or reformat. The second branch to merge rebases and resolves.
- Handoffs go to `docs/handoffs/<card>.md` (one file per card). In STATUS.md, edit **only your own card's row**.

## Porting from manoxen
Source: `E:\WEB-DEVELOPMENT\PROJECTS\business-platform\manoxen`. **Read only your card's row in `docs/15-PORT-MAP.md`**, then the files it lists (ADR-070). Port **logic and tests**, never structure. Map `businessUnitId`/`outletId` → `locationId`. **Never copy:** frontend shell/layouts, `(organization)/(business-unit)/(outlet)` routes, scope-sync/active-scope code, watchdogs, SafeDom/commit-crash guards, `queryContext` scope modes, per-industry capability flags (`industry-capabilities.ts`), retail-specific or phrase-specific chatbot libs (see `08-UNIVERSAL-BOT.md §8`). The manoxen `.agent/` docs are reference only, not rules for this repo.

## Legacy
Anything on branch `archive/v0` and any `.agent/` folder is legacy. Do not follow its rules. `docs/PROJECT-OVERVIEW.md` is a historical analysis (2026-10-08), not current rules.
