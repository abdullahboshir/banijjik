# Target Architecture

Style: **modular monolith with DDD-lite**. One deployable API. Modules are isolated by folders, public `index.ts` files and lint rules, not by network calls.

## 1. Repository layout (target, built in Phase 0)

```
banijjik/
├── AGENTS.md  CLAUDE.md  .cursor/rules/
├── apps/
│   ├── api/          Express 5 API + worker entry (same codebase, ROLE=api|worker)
│   ├── admin/        Next.js: tenant dashboard + /pos (PWA)
│   ├── platform/     Next.js: platform panel
│   └── storefront/   Next.js: tenant public website (domain/slug → org)
├── packages/
│   ├── contracts/    constants, DTO types, error codes, permission keys, module keys, event names
│   ├── ids/          newId() (UUID v7) + branded ID types; the only ID generator, pure and isomorphic
│   ├── validation/   Zod schemas (+ runtime custom-field schema builder)
│   ├── i18n/         BN/EN message catalogs, keys only in code
│   ├── ui/           shared React components (shadcn-based), created in Phase 0.5
│   ├── web-client/   shared API client and the app pieces both web apps use (session, locale, proxy)
│   └── config/       shared tsconfig presets (the ESLint config is `eslint.config.mjs` + `eslint/*.mjs` at the root)
├── tools/            repo tooling, e.g. `lint-tests/` (fixtures that prove each custom lint rule)
├── scripts/          git and agent hooks (`scripts/hooks/`)
├── infra/            docker-compose (mongo replica set, redis), deploy files
└── docs/             00-VISION, 01-ARCHITECTURE, 02-FEATURES, 03-ROADMAP, 04-DECISIONS, 05-CONVENTIONS, STATUS
```

Rule: **no empty package, app, lib or folder.** A folder is created in the session that puts real code in it.

## 2. API layout

```
apps/api/src/
├── main.ts                 starts api or worker by ROLE
├── app.ts                  builds the Express app
├── config/                 Zod-validated env → typed config (only place that reads process.env)
├── kernel/                 technical only, no business rules
│   ├── http/               response envelope, error handler, validate(), async handler
│   ├── db/                 mongoose connection, tenant plugin, withTransaction()
│   ├── context/            AsyncLocalStorage request context (user, org, allowed locations, requestId)
│   ├── auth/               cookie/JWT verify, permission cache
│   ├── idempotency/        Idempotency-Key middleware + store
│   ├── sequence/           per-org atomic document numbers (INV-…, ORD-…)
│   ├── events/             in-process event bus + outbox + BullMQ dispatch
│   ├── access/             permission and entitlement ports, tenant caller
│   ├── audit/              audit entry shape
│   ├── logger/             the logger
│   ├── modules/            module registry
│   ├── rate-limit/         rate-limit ports
│   ├── redis/              Redis clients and readiness
│   ├── tenancy/            tenant context and plugins
│   ├── time/               the clock
│   ├── observability/      reportError (central error capture)
│   ├── lifecycle/          registerShutdown (ordered shutdown tasks)
├── modules/
│   ├── platform/           industry, package, entitlement, saas-billing, tenant-admin, ai
│   ├── core/               iam, organization (org, location, member), custom-field, settings, audit, notification, file
│   ├── commerce/           contact, catalog, inventory, pricing, sales, booking, enrollment, payment, accounting, expense, bookkeeping, pos, report, delivery
│   ├── channel/            website, messaging (channels, inbox), bot, social                   (ADR-052)
│   ├── capability/         academic, clinical, kitchen-display, …                          (Phase 7)
│   ├── integration/        courier, sms, payment-gateway (third-party providers)            (Phase 5)
│   └── automation/         workflow, risk                                                   (Phase 5)
└── routes/             v1.ts mounts the tenant pipeline; platform.ts mounts the platform API
```
Full module list, classes (PLATFORM / SYSTEM / CORE / OPTIONAL) and manifests: `10-MODULE-CATALOG.md`.

### Module anatomy
```
modules/<group>/<module>/
├── domain/          entities (behavior-rich), value objects, domain errors, repository ports, domain events
├── application/     use cases, ports for other modules/integrations
├── infrastructure/  mongoose models, mappers, repository impls, adapters
├── presentation/    router, controllers, response transformers
└── index.ts         public API: the only file other modules may import
```
- A simple configuration module with no business rules may keep `domain/` thin, but the folder set stays the same.
- Cross-module calls go through the other module's `index.ts` (sync read) or domain events (side effects, preferred).
- Dependency direction: presentation → application → domain. Infrastructure implements domain/application ports.

## 3. Request pipeline

Transport middleware (request id, access log, CORS, body parser) is mounted in `app.ts`. Rate limits are per route, not one global limiter. The tenant pipeline in `routes/v1.ts` is:

```
authenticate (cookie) → tenantContext (org from the URL, never from the body)
→ locationAccess (filter/validate locationId against assignments)
→ entitlement (module enabled for this org and plan?) → permission (role allows the action?)
→ validate(schema) → controller
```
Public routes (`/public/*`, storefront, webhooks) use their own small pipelines: webhook signature verification, slug → org resolution.

## 4. Tenancy & location
- Session is per user. The active org comes from the URL `/[orgSlug]` (validated against the user's memberships on every request; there is no membership cache, ADR-087). One login covers all of a user's organizations (ADR-022).
- Models are obtained via `models(ctx)` so a dedicated-DB tenant can be added later without touching business code (ADR-023, `06-AUTOMATION-AND-ACCOUNTS.md §3`).
- `organizationId` on every tenant-owned document. A Mongoose plugin injects it into every query and write from the request context and **throws** when the context is missing. Cross-tenant jobs must opt out explicitly via `runAsSystem()`.
- Location-scoped collections also get `locationId`. Queries are filtered to `allowedLocationIds` (ALL for owners). Writes are rejected when the location is outside the user's assignments.
- One org with one location shows no location UI.
- Indexes start with `organizationId` (then `locationId`, then the sort key).

## 5. Configuration engine (the core purpose)

```
Industry (platform)
  ├── default modules     ← Module catalog (code-registered keys, DB-stored enablement)
  ├── entity field sets   ← CustomFieldDefinition { scope: industry|org, entityType, key, label(i18n), type, required, options, validation, visibility, order, searchable }
  ├── settings defaults   ← Settings registry (code keys + DB values per level)
  └── website components  ← Storefront section catalog filtered by enabled modules
Tenant (org) overrides → Location overrides (settings only)
```
- **Code registers what can exist** (module keys, entity types that accept custom fields, setting keys). **DB decides what is enabled and how it is configured.** This keeps configuration safe and type-checked.
- Field types: TEXT, LONG_TEXT, NUMBER, DECIMAL, BOOLEAN, DATE, DATETIME, SELECT, MULTI_SELECT, PHONE, EMAIL, URL, CURRENCY, FILE, IMAGE, REFERENCE.
- One builder in `@banijjik/validation` turns definitions into a Zod schema. The API and the dynamic form renderer use the same builder.
- The resolved config (modules, fields, settings, menu) is computed per org and kept in an in-process LRU, invalidated by version bump on change. It is not stored in Redis.

## 6. Reliability ("no-damage failure")
- Multi-document writes (sale + stock + journal) run inside `withTransaction()`.
- POST/PUT that create money or stock effects require an `Idempotency-Key`.
- Side effects (SMS, courier booking, webhooks out) go through the outbox → BullMQ with retry and backoff. They never run inline in the request.
- Append-only ledgers for stock and accounting. Corrections are reversing entries.
- Audit log for every state change on money, stock, permissions and settings.
- Backups with a tested restore (Phase 6). Sentry + structured logs.

## 7. Frontend
Full UX rules, screen patterns, tokens and components: `13-UX.md`.

- One route tree per app, for example `apps/admin/app/[orgSlug]/(app)/sales/orders`. The layout is persistent and server-rendered. Location is `?location=`.
- The menu comes from the API's resolved config (entitlement × permission), fetched once per session.
- TanStack Query cache + hover prefetch + optimistic updates. Lists are paginated (max 100) and virtualized when long.
- Mobile-first: on small screens tables become cards, filters move to a bottom sheet, navigation moves to a bottom nav, touch targets are at least 44 px.
- Dynamic form renderer for custom fields (shared in `packages/ui`).

## 8. Porting from manoxen
Port **logic and tests**, not structure. For each module:
1. Read the manoxen module and its tests.
2. Map its `organizationId/businessUnitId/outletId` usage to `organizationId/locationId`.
3. Rebuild it in the target anatomy.
4. Port the tests and make them pass.
5. Record known gaps in `docs/STATUS.md`.
