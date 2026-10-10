# Roadmap

**How to use:** one session = one card. Do the next card that is `todo` in `docs/STATUS.md` and has no unfinished dependencies. If a card is too big to finish in one session, split it in STATUS.md (`3.2a`, `3.2b`) before you start coding.

`M:` = manoxen source to port from (`manoxen/apps/backend/src/contexts/...`). Every card's Definition of Done also includes the global DoD in `AGENTS.md`.

**Tiers** (who plans/reviews, see AGENTS.md "Session types"): unless marked otherwise, cards are **T2**.
- **T1** (Opus plan + Opus review): 0.2a, 0.4, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.2, 2.3, 2.4, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.3, 5.1, 5.7, 5.8, 5.9, 5.17, 6.2, 6.3, 8.2.
- **T3** (Sonnet may plan): 0.3 (planned by Opus anyway), 1.7, 1.8, 2.6, 2.7, 3.10, 4.5, 5.11, 5.13, 5.16, 7.x new industry templates.
- Phase D cards: always Opus.

**Order:** P (owner, in parallel) → **D (design, docs only)** → 0 → 1 → 2 → 3 → 4/5 → 6 → 7 → 8.
Phase 0 may start once D1 is approved. Card 1.6 and later need D1–D4 approved by the owner.

---

## Parallel lanes (two sessions at once)
Phases are sequential: a later phase depends on the earlier one, so two **phases** never run in parallel. Two **cards** can, when they do not depend on each other. Allowed pairs:

| Step | Session A | Session B | Note |
|---|---|---|---|
| 1 | D1 domain model | — | Everything depends on D1 |
| 2 | D2 module catalog | D6 UX & design system | |
| 3 | D3 offerings & lifecycles | D8 manoxen port map | |
| 4 | D4 industry templates | D7 API surface | D7 after D2 |
| 5 | 0.1 archive & skeleton | D5 bot goldens (needs P3 chats) | |
| 6 | 0.2a lint, format, hooks | 0.3 API package, config & local infra | Both touch root `package.json`/`tsconfig.json`: add-only. 0.2b follows after both. |
| 7 | 0.4 API kernel | 0.5 admin skeleton | |
| 8 | 1.1 IAM auth | 1.5 reliability kernel | |
| 9 | 1.2 org/location/membership | 1.4 RBAC | 1.3 after both |
| 10 | 1.3 tenant enforcement | 1.8 platform skeleton | |
| 11 | 1.6 module registry | 1.7 admin shell | 1.7 can mock `/me/config` until 1.6 merges |

From Phase 2 on, pairs are chosen when planning (the PLAN session lists the next safe pair). **A PLAN session may plan both cards of a pair** in one sitting, writing two plan files, so both implement sessions can start at once.

---

## Phase P: Owner preparation (non-code, run in parallel by the owner)
These have long external lead times. Start them now.
- **P1** Rotate every secret leaked in the public repo: DB password, JWT secrets, super-admin password, Cloudinary, SMTP. Remove `.env` from git.
- **P2** Confirm brand "Banijjik" (ADR-021): check domain availability (.com / .com.bd / .app) and run a trademark search (BD DPDT) before launch; then decide domain and pricing per package (Store / Chat / Shop / Bundle / add-ons, ADR-050).
- **P3** Find 5–10 pilot sellers (mostly F-commerce/retail, plus 1–2 service businesses). Write down their top 10 daily pains and 10 real customer chats each (input for D5).
- **P4** Meta: developer app + **Business Verification** + App Review for Messenger/Instagram (takes weeks).
- **P5** Merchant/API accounts: Steadfast, Pathao, RedX, bKash/SSLCommerz, SMS gateway, LLM provider.
- **P6** Hosting plan: VPS/region (Singapore), MongoDB Atlas (replica set) or self-hosted replica set, Redis, backups.

---

## Phase D: Design before code (docs only, no application code)
Each card produces a doc. The owner reviews and approves it (status `done` only after approval). These docs are what stop agents from guessing.

**D1 Glossary & domain model** → `docs/09-DOMAIN-MODEL.md`
- Ubiquitous language: Organization, Location, Member, Contact, Offering, kind, Request (Order/Booking/Enrollment/Reservation/Ticket), Resource, Module, Package, Industry template, terms.
- Every core entity: fields, invariants, relationships, owning module, tenant/location scoping, indexes, events.

**D2 Module catalog** → `docs/10-MODULE-CATALOG.md`
- Every module's draft manifest (`07-CAPABILITY-MODEL.md §2`): key, dependsOn, permissions, menu, settings, custom-field entities, kinds, bot tools, storefront sections, events.
- Package definitions (Store / Chat / Shop / Bundle / add-ons) as module sets + limits.

**D3 Offering kinds & request lifecycles** → `docs/11-OFFERINGS-AND-REQUESTS.md`
- Core schema per kind. State machine per request type (who can move each state, side effects, stock/ledger/journal effects, cancellation/refund rules).

**D4 Industry templates** → `docs/12-INDUSTRY-TEMPLATES.md`
- 8 seed templates (FCOMMERCE, RETAIL, SALON, CLINIC, GYM, COACHING, RESTAURANT, HOSTEL): kinds, modules, custom fields (with `botAsk`/visibility), terms, settings defaults, website template list, bot persona and intake.
- Proof: none of them needs code beyond the kinds, otherwise flag a capability module.

**D5 Bot tool schemas & golden conversations** → `docs/08-UNIVERSAL-BOT.md` appendix + `bot-evals/`
- Final tool list and JSON schemas. At least 20 golden conversations for FCOMMERCE and 5 for each other template, using P3's real chats (anonymized).

**D6 UX & design system** → `docs/13-UX.md`
- Mobile-first wireframes (text or images) for: onboarding, add product (form / from post / bulk), order list + detail, inbox, POS, booking calendar, settings, website editor. Navigation model. Design tokens.

**D7 API surface** → `docs/14-API.md`
- Endpoint list per module (method, path, permission, idempotency, request/response contract names).

**D8 Manoxen port map** → `docs/15-PORT-MAP.md`
- For each module: manoxen files and tests to port, mapping to the new model (BU/outlet → location, product → offering), and what to drop.

---

## Phase 0: Clean foundation (no business features)

**0.1 Archive & fresh skeleton**
- Do: create branch `archive/v0` from current `main`. On `main`, remove the old code (`apps/*`, `packages/*`, `libs/*`, `.agent/`, `docs/architecture`, `docs/my-reminder`, committed `dist/.turbo/logs/.env`). Keep `docs/` new files, `AGENTS.md`, `CLAUDE.md`, `.cursor/`, `.gitignore`. Create the workspace skeleton from `01-ARCHITECTURE.md §1`: only `packages/contracts`, `packages/ids` (`newId()` UUID v7 + branded types, with tests for v7 format and ordering), `packages/validation`, `packages/config` (`apps/api` and `infra/` are created in 0.3, owner decision 2026-10-09).
- Done: `npm install` and `npm run build` pass. Nothing that is out of the card's scope is created.

**0.2a Lint rules, formatting and local git hooks** (plan: `docs/plans/0.2a.md`)
- Do: ESLint 10 flat config with rules R1–R22 of the plan (architecture, ID, readability, naming), each proven by pass/fail fixtures in the test suite; Prettier, `.editorconfig`, `.gitattributes` (LF); husky `pre-commit` (lint-staged + `.env` commit block) and `commit-msg` (commitlint); vitest upgrade; root `packageManager`/`engines` fixes.
- Done: every rule has a failing and a passing fixture; both hooks reject bad input; lint/format/typecheck/test/build pass from a clean install.

**0.2b CI, secret scan, PR template, Claude hook** (plan: `docs/plans/0.2b.md`; after 0.2a and 0.3)
- Do: GitHub Actions `ci.yml` (verify + gitleaks, actions pinned by SHA), `.gitleaks.toml`, PR template with the DoD checklist, `.claude/settings.json` hook blocking `.env*` edits, `docs/ops/github-setup.md` (branch protection steps for the owner).
- Done: local `npm run ci` passes; the hook and gitleaks config are tested; the first GitHub run is reported by the owner.

**0.2 (original text, superseded by 0.2a/0.2b; the module template moved to card 1.6)**
- Do:
  - TypeScript strict, Prettier, Vitest, husky + lint-staged, commitlint
  - ESLint with:
    - `eslint-plugin-boundaries` encoding the module-import rules
    - a **no-industry-branching rule** (no reading `industry` outside `modules/platform/industry` and the resolver)
    - a **no-direct-model-import rule** (use `models(ctx)`)
    - ID rules: ban `crypto.randomUUID`, `uuid`, `nanoid` outside `packages/ids`; ban identifiers `orgId`, `tenantId`, `branchId`, `outletId`, `customerId`, `supplierId`, `studentId`, `patientId`; ban the literal brand name in UI strings (ADR-038); ban `_id` outside `infrastructure/`
    - `no-console` and `no-empty` (catch)
    - readability limits (ADR-041): `max-lines-per-function` 60, `max-lines` 300, `complexity` 10, `max-depth` 3, `max-params` 3, `no-nested-ternary`, `no-explicit-any`, `no-floating-promises`, explicit return types on exports, `naming-convention`
  - A module template (`scripts/new-module`) that generates the 4 folders, `index.ts`, `module.manifest.ts`, `README.md` and a sample test, so every module starts with the same shape
  - GitHub Actions running `typecheck/lint/test/build`
  - Secret scan (gitleaks) and a `.env` commit block
  - PR template with the DoD checklist
  - Claude Code hook (`.claude/settings.json`) blocking edits to `.env*`
- Done: CI is green. Deliberate violations (a deep cross-module import, `if (industry === "GYM")`, a direct model import) each fail lint.

**0.3 Config & local infra**
- Do: Create `apps/api` (package + `src/config`) and `infra/`. `infra/docker-compose.yml` (Mongo **replica set**, Redis). `apps/api/src/config` with a Zod-validated env. `.env.example`.
- Done: the API refuses to start with a missing or invalid env and logs which key is wrong.

**0.4 API kernel**
- Do: `kernel/http` (envelope, error handler, `validate()`), `kernel/logger` (pino + requestId), `kernel/db` (platform + tenant connections, `models(ctx)` accessor, `withTransaction()`), `kernel/context` (AsyncLocalStorage), `kernel/sequence` (per-org atomic counters), base mapper that strips `_id`, optimistic `version` helper, `runAsSystem(reason, fn)`, `/health`, `routes/v1.ts`, `main.ts` with ROLE=api|worker, graceful shutdown.
- Done: tests for the error envelope, validation error, and transaction rollback.

**0.5 Frontend skeleton (`apps/admin`)**
- Do: Next.js App Router, Tailwind + shadcn in `packages/ui` with the tokens of `13-UX.md §8` (light + dark values, light only exposed) and the ★ components of `13 §9`, fonts per `13 §7`, `packages/i18n` (BN/EN + `terms` overrides), persistent server-rendered shell per `13 §3` (sidebar on desktop, 5-slot bottom nav + Quick create on mobile), TanStack Query provider, API client with cookie credentials.
- Done: Lighthouse mobile ≥ 90 on an empty page. No `ssr:false` on the shell.

---

## Phase 1: Identity, tenancy, access, packaging

**1.1 IAM: users & auth.** M: `core/iam`
- Do: user entity, password hashing, login/logout/refresh with httpOnly cookies, `/auth/me`, rate limit on auth, platform super-admin seed (idempotent, from env).
- Done: auth API tests, including expired/rotated refresh tokens.

**1.2 Organization, Location, Membership.** M: `core/organization`
- Do: Organization (industry template key, locale, currency, timezone, deployment), auto-created default Location, Membership with `assignments[{locationId|ALL, roleId}]`, create-org use case (owner membership in the same transaction). One user may own or join many orgs (ADR-022).
- Done: creating an org yields exactly 1 org + 1 location + 1 owner membership, atomically. One login lists all of a user's orgs.

**1.3 Tenant & location enforcement.**
- Do: `tenantContext` middleware (org from URL `/[org]`, validated against memberships), tenant Mongoose plugin (throws without context), location plugin/filter, `runAsSystem()`, a test helper that creates two orgs.
- Done: an isolation test suite proves org A can never read or write org B data, and a location-limited staff member cannot touch another location.

**1.4 RBAC & permission cache.** M: `core/iam` permissions
- Do: permission keys in contracts, role templates (OWNER, MANAGER, CASHIER, STAFF, RIDER, VIEWER), custom roles per org, `permission()` middleware, Redis cache with version invalidation.
- Done: permission-denied tests. Permission check is p95 < 5 ms on a cache hit.

**1.5 Reliability kernel.**
- Do: audit log module, Idempotency-Key middleware, in-process events + outbox collection + BullMQ dispatcher, worker process.
- Done: replaying the same idempotent request returns the original response. An outbox job retries after failure.

**1.6 Module registry, packages, resolver (ADR-033, ADR-049) + module template script.** Needs D2 (`10-MODULE-CATALOG.md`).
- Do: `defineModule()` with the manifest schema of `10 §2`, registry + `registryHash`, manifests for modules that exist so far, Package + PlatformSubscription models, seed packages of `10 §9` (incl. 14-day BUNDLE trial), `resolveOrgConfig()` with the algorithm of `10 §3` (cached, versioned), access modes of `10 §8`, auto entitlement gate from manifests, `/me/config` (modules, permissions, menu, terms, limits, accessMode), system role grant templates of `10 §10`, `scripts/new-module` (moved here from 0.2: generates the 4 layer folders with real starter files, `index.ts`, `module.manifest.ts` using `defineModule`, `README.md`, a sample test), **generated contract tests of `10 §11`**.
- Done: turning any module off makes all its routes 403, removes it from menu and config, and the generated tests cover every manifest automatically.

**1.7 Admin app: auth & org shell.**
- Do: login, org switcher (account menu), menu from `/me/config`, package-aware home placeholder, staff list + invite + assignments UI, locations UI (hidden while there is 1 location).
- Done: switching org does a full reload. Navigation inside an org never remounts the shell (verified).

**1.8 Platform app skeleton** (`apps/platform`)
- Do: super-admin login, tenant list/detail/suspend, package CRUD, per-org module grant/revoke.
- Done: a suspended org's users get a clear "suspended" error. Granting a module to an org shows it in that org within one config refresh.

---

## Phase 2: Configuration engine (multi-industry core). Needs D3, D4.

**2.1 Industry templates.** Template model (kinds, default modules, terms, settings defaults, bot defaults), platform CRUD, seed the 8 templates from D4 as data.
**2.2 Resolver: industry + org overrides.** Extend `resolveOrgConfig` with template defaults, platform overrides and tenant-disabled optional modules. Dependency resolution.
**2.3 Custom field engine (API).** `CustomFieldDefinition` (scope, entityType, kind, visibility admin/storefront/bot, `botAsk`), entity registry from manifests, shared Zod builder in `@banijjik/validation`, values in `customFields`, indexes for `searchable`.
**2.4 Settings engine.** Registry from manifests, System → Industry → Org → Location resolution, settings API.
**2.5 Dynamic form renderer** (`packages/ui`). Core + custom fields from definitions, mobile-first, the same Zod builder on the client, `terms` for labels.
**2.6 Platform UI: template, module and field builders.**
**2.7 Tenant UI: settings + tenant-level custom fields** (within platform limits).
- Phase done: a **new industry** with new fields and new terms is created **from the Platform Panel alone**, and its tenants see the right menu, labels and forms with server-side validation. No deploy is needed. CI proves no code reads `industry` outside the resolver.

---

## Phase 3: Core business (port from manoxen; all kinds). Needs D3, D8.
Each card ports logic and tests (`01-ARCHITECTURE.md §8`) and builds both API and admin UI.

**3.1 Contacts** (customers/suppliers/students/patients via `terms`; tags; custom fields). M: `modules/contacts`
**3.2 Offerings catalog** (all kinds, variants, categories, units, images, per-location availability/price, synonyms per org for search). M: `modules/catalog`
**3.3 Inventory ledger** (PRODUCT kind: StockMovement, InventoryLevel projection, adjustment, transfer, low stock). M: `modules/supply`, `modules/inventory`
**3.4 Pricing & tax** (price resolution for all kinds, promotions as rules, tax classes; money in minor units). M: `modules/pricing`
**3.5 Orders** (PRODUCT requests: state machine from D3, invoice, returns/refunds, COD; one transaction for order + stock + journal). M: `modules/sales` + guides 15, 16, 21
**3.6 Booking core** (Resources: staff/room/seat/table/vehicle; availability rules; bookings for SERVICE/RENTAL/EVENT; no double-booking under concurrency; reminders via outbox).
**3.7 Enrollment core** (PLAN kind: enrollments, periods, renewals, dues, attendance/check-in as a generic capability). M: `modules/membership`
**3.8 Payments, accounting engine & expenses** (cash/bKash/Nagad manual, dues for all request types; SYSTEM `accounting` posts double-entry journals from events; CORE `expense` with categories; ADR-051). M: `modules/finance`, `modules/accounting`
**3.8b Bookkeeping add-on UI** (OPTIONAL `bookkeeping`: chart of accounts, journal view, manual entries, trial balance, P&L, balance sheet; reads the `accounting` ledger; ADR-051).
**3.9 POS** (`/pos` PWA, device ↔ location binding, shift/register, Z-report, receipt print, fast search; sells products and services). M: `modules/pos`
**3.10 Reports & dashboard** (daily summaries per location via events, for orders, bookings and enrollments; package-aware home). M: `modules/analytics`
- Phase done: a product seller runs a full day (stock in → POS + online orders → returns → day close), **and** a salon and a gym from templates take bookings/enrollments and payments, with correct numbers in reports. No industry-specific code.

---

## Phase 4: Tenant website (design: `06-AUTOMATION-AND-ACCOUNTS.md §8`)
**4.1 Theme engine** (design tokens, theme model, section library with variants, page JSON schema, region lock levels; sections declared in manifests).
**4.2 Storefront app** (subdomain + custom domain via edge custom hostnames → org (ADR-031), render page JSON + tokens server-side, SEO, CDN cache). M: `modules/storefront`, guide 38
**4.3 Shop & booking flow** (browse offerings of all kinds, cart/checkout COD for products, slot booking for services/rentals, plan enrollment, server-side re-pricing, order/booking tracking).
**4.4 Platform template builder** (`apps/platform`: build/publish templates per industry, set lock levels).
**4.5 Tenant website editor** (`apps/admin`: choose template, edit within limits, mobile/desktop preview, publish, version rollback).

---

## Phase 5: Automation, channels, universal bot (design: `06`, `08`). Needs D5.
Before each card here: verify the provider's current docs and rules, then record the findings in STATUS.md.
**5.1 Integration framework** (encrypted credentials per org, webhook intake + signature, retry, logs, token-health monitor + reconnect banner).
**5.2 Courier** (`CourierProvider` port; Steadfast → Pathao → RedX; address validation + area mapping; setup wizard + test connection; one-click/auto consignment, label, status webhooks → order status; COD settlement reconcile). M: steadfast handoff doc, `modules/logistics`
**5.3 Own rider** (rider role, rider mobile view, assign, deliver/fail, COD collection + handover, rider report).
**5.4 Channel connect: Facebook/Instagram** (one-click Page OAuth, webhook subscription, pageId → org). M: messenger docs, `platform/communication`
**5.5 Unified inbox** (Channel → Conversation → Message abstraction, 24-hour window rules, human handoff, mobile-first).
**5.6 Bot eval harness first** (golden-conversation runner over `bot-evals/`, scoring tool calls, states and grounded claims; runs in CI; D5 conversations loaded, initially failing).
**5.7 Bot tool layer** (generic tools generated from `resolveOrgConfig` + kind schemas + custom fields; hybrid search with transliteration normalizer and per-org synonyms; image search). M: semantic retrieval, transliteration libs
**5.8 Bot agent & state machine** (structured state, tool-calling turn, `create_request` for any kind with `botAsk` intake, handoff, language/tone/terms).
**5.9 Grounding guard & cost ladder** (claim-vs-tool-fact check, rules/cache tier, small/large model routing, prompt caching, per-org quota + rules-only fallback). Phase gate: D5 golden sets pass for all 8 templates.
**5.10 Product ↔ Facebook** (list Page posts → "import as offering" draft; feed webhook → auto draft + one-tap approve; "import last N posts"; "publish to Facebook"; `OfferingSocialLink` (ADR-047 naming), referral → offering in bot context).
**5.11 Bulk import** (CSV/Excel template; photo/PDF price list → reviewed drafts).
**5.12 WhatsApp channel** (Cloud API + Embedded Signup, templates, service window; plugs into inbox + bot unchanged).
**5.13 Notifications** (SMS, WhatsApp templates, email; lifecycle messages for orders, bookings, renewals).
**5.14 Workflow engine** (trigger → condition → action, tenant toggles, run history).
**5.15 COD risk score.**
**5.16 Website chat widget** (one-line script channel; optional).
**5.17 Tenant payment gateway** (OPTIONAL `payment-gateway`: SSLCommerz/bKash online payment in storefront checkout, webhooks, reconciliation into `payment`; packaging decided in P2).
- Phase done:
  - A pilot seller connects their Page in under 2 minutes without help.
  - A customer message becomes a confirmed order with a courier consignment, and the status updates on its own.
  - A salon customer books a slot through chat.
  - The same bot code serves every template.

---

## Phase 6: SaaS go-live
**6.1 Signup + onboarding wizard** (package choice: Store / Chat / Shop / Bundle (14-day Bundle trial by default), and industry → defaults → package-specific first steps → first sale; package-aware dashboard home, ADR-032).
**6.2 SaaS billing** (subscriptions, trial, invoices, gateway, dunning, limits). M: platform billing, guide 45
**6.3 Hardening** (security review, rate limits, CSP, audit viewer, impersonation audit).
**6.4 Performance** (load test, budgets in CI, index review, report pre-aggregation check).
**6.5 Ops** (staging, backups + restore drill, Sentry, uptime alerts, runbooks).
**6.6 Pilot launch** with P3 customers, then a feedback loop.

---

## Phase 7: More industries (mostly data)
- **7.x New industry template** (one card each, platform panel only): pharmacy, car rental, coaching variants, etc. Done when it works with zero code changes.
- **Capability modules** (code, only when a real new behaviour is needed; each has its own manifest and is reusable by any industry):
  - kitchen display/KOT (M: `industry/restaurant`, guide 46)
  - academic results/exams
  - clinical notes/prescription
  - table management UI

## Phase 8: Later
- **8.1 Ads: boost product post** (seller's own ad account, preview + explicit approval, campaign → order attribution in reports).
- **8.2 Dedicated-DB tenants** (connection registry, shared → dedicated migration tool, per-DB migrations/backups). The accessor already exists from Phase 0/1.
- **8.3 Website connectors** (WooCommerce/Shopify read-only mirror, API-key product push).
- **8.4 Consolidated billing** across a user's organizations.
- Native mobile app, HRM/payroll, marketplace.
