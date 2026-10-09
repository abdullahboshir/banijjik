# Banijjik: Project Overview Note

> **HISTORICAL (2026-10-08).** এটা পুরনো code-এর বিশ্লেষণ আর আলোচনার রেকর্ড। বর্তমান নিয়ম আর সিদ্ধান্ত: `AGENTS.md`, `docs/00-VISION.md` … `docs/05-CONVENTIONS.md`, `docs/STATUS.md`। দুটোর মধ্যে অমিল হলে নতুন doc-গুলোই ঠিক।

> Source: `.agent/*` rules, `docs/architecture/*`, backend code (checked 2026-10-08), ar business-configuration niye design discussion.
> Status tag: **[DECIDED]** = doc/discussion-e final, **[BUILT]** = code-e ache, **[PLANNED]** = ekhono code nei, **[CONFLICT]** = nijeder moddhe mile na.

---

## 1. Mission / Vision

- Ekta **multi-tenant SaaS product**, ek codebase theke onek industry-ke serve kore: Coaching, Gym, Clinic, Hostel, Salon, Restaurant, Retail, etc. **[DECIDED]**
- Mental model: **"Product, not Service"** ar **"Organization is root"**.
- Business model: subscription-based, long-term scalable.
- Industry **dynamic**: Gym/Coaching code noy, configuration. Platform theke notun business add hobe, code deploy lagbe na. **[DECIDED, kintu code-e ekhono static, dekho §8]**
- Non-negotiable: extremely fast performance, Bangla (BN) + English (EN) i18n, financial calculation-e zero error.
- Product name: repo/package `banijjik`. Discussion-e "OmniFlow" naam ache, mone hoy same product-er alternate naam. **Confirm kora dorkar.**

## 2. Tin ta surface (final decision from discussion)

| Surface | Kar jonno | Kaj |
|---|---|---|
| **Platform Panel** (`apps/platform-frontend`) | Developer / SaaS owner | Organization, tenant, subscription, plan, feature catalog manage. Business type onujayi module / entity / field / validation / visibility / permission configure. |
| **Tenant Admin Dashboard** (`apps/frontend`) | Organization owner/staff | Shudhu oi business-er enabled ar proyojoniyo feature dekhabe. |
| **Tenant Website** (storefront) | Tenant-er customer | Public website. Enabled capability onujayi component (Gym hole Membership Plans/Trainer, Restaurant hole Menu/Reservation). |
| Mobile (`apps/mobile`) | pore | ekhono khali |

## 3. Business-specific configuration: final decision **[DECIDED in discussion]**

Prothome AI "hybrid (core fixed + tenant custom fields)" bolechilo. Apni sudhrate bolen: core/common noy, **business wise ja lage** seta Platform Panel theke control hobe. Final shape:

- **Platform Admin = full control:** module add/remove, entity add/remove, custom field add, field type/required/validation/visibility/permission, feature on/off.
- **Tenant Admin = limited:** custom field add, optional field hide, reorder, label change, required/optional, custom form. Core entity (Order, Payment, Customer) delete ba core workflow change **korte parbe na**.
- **Dashboard = Subscription + Business Type + Tenant config-er combination:** `Tenant → Business → Subscription → Plan → Entitlements → Enabled Modules → Dashboard/Website`.
- **Sudhu UI hide noy.** Request chain: `Auth → Tenant Context → Subscription Entitlement → Business Capability → Permission → Module Access → Controller`. Courier OFF hole UI-te nei + API access nei + automation-e nei.
- **DB schema dynamic hobe na.** Application-level metadata hobe: `CustomFieldDefinition { businessId, entityType, key, label, dataType, required, defaultValue, options, validation, displayOrder, isActive }` + validated value. Arbitrary `ALTER TABLE` / column creation forbidden.
- **Field types:** TEXT, LONG_TEXT, NUMBER, DECIMAL, BOOLEAN, DATE, DATETIME, SELECT, MULTI_SELECT, RADIO, PHONE, EMAIL, URL, CURRENCY, FILE, IMAGE, REFERENCE.
- **Fixed rakhbo (code):** order status machine, payment validation, stock calculation, tenant isolation, RBAC, subscription, courier integration, audit log, financial calculation. Business-specific module-er actual logic code-e thakbe; kon tenant-er jonno kon module/entity/field active seta config-driven.
- Concept naam: **Business Capability & Schema Configuration** (Business Profile → Enabled Modules → Entities → Custom Fields → Forms → Validation → Dashboard Navigation → Website Components → Permissions → Feature Entitlements).

## 4. Architecture

**Style:** Clean Modular Monolith, pure DDD. Entity = logic-rich class (anemic interface-only forbidden).

**Monorepo (npm workspaces + Turborepo):**
- `apps/`: backend, frontend, platform-frontend, mobile
- `packages/`: contracts, validation, i18n, shared-kernel, permission-schema, event-schemas, billing-contracts, config-client, theme, ui-kit
- `libs/`: technical utility (logger, cache, db-utils, event-bus, auth-utils)
- `infra/`: docker, kubernetes, terraform, monitoring. `scripts/`, `tests/`, `docs/`

**Backend (`apps/backend/src`):** `bootstrap/` (config, database, DI, events, modules, server), `config/`, `domains/`, `events/`, `infrastructure/`, `routes/v1`, `shared/` (technical only, `KERNEL.md`), `migrations/`, `monitoring/`, `scripts/`.

**Domains:**
- `core/`: iam, organization, person, billing, subscription, payment, notification, audit, reporting, storage, storefront
- `platform/` (SaaS owner): PlatformSettings, SystemSettings, billing, entitlement, feature-catalog, plan, pricing, subscription, tenant, usage
- `capabilities/` (industry-specific): academic, accommodation, appointment, inventory, ordering

**Prottek context-e 4 folder:** `domain/` → `application/` → `infrastructure/` → `presentation/`. Dependency shudhu inward, Domain kono technology import kore na.

**Naming:**
- Business logic-e **Organization**; infrastructure-e **Tenant** (`TenantMiddleware`). "You manage Organizations, isolate by Tenants."
- Settings tin dhoroner: **SystemSettings** (developer), **PlatformSettings** (SaaS owner), **BusinessSettings** (organization owner).
- Export naming: `Backend[Domain][Layer][Type]`, `Frontend[...]`, `Shared[...]`. Path alias: `@iam/...`, `@person/...`.

**Single Source of Truth:**
- `@banijjik/contracts`: constants (Array → Type → Object pattern, `X_ENUM` / `X` / `XType`), API interfaces, error codes
- `@banijjik/validation`: Zod schema, request DTO
- `@banijjik/i18n`: BN/EN message key. Hardcoded error string forbidden.
- Config: `.env` Zod-validate kore, `process.env` direct use forbidden.

**Layer rules (summary):** Domain depends on nothing. Application → Domain + contracts. Infrastructure → all. Explicit mapper (DTO ↔ Entity ↔ Model). Cross-domain deep import banned, shudhu public `index.ts` ba event bus (async preferred). Circular dependency forbidden. No `export *`. `shared/` te entity/use case/business logic forbidden ("Shared Hell").

**Hybrid ID strategy:** Domain-e UUID string (`crypto.randomUUID()`), Mongoose-e UUID string field + native `_id` retained. Uddessho: pore PostgreSQL/Prisma-te jawa shohoj.

**Multi-tenancy:**
- *Shared:* ek DB, prottek query-te `organization_id`.
- *Dedicated:* database-per-tenant, request context theke connection switch.
- File path: `/storage/{tenant_id}/{file_id}`. Cross-tenant leak = critical failure.
- Platform DB (tenant, plan, business type config) alada Product DB (business data).

**IAM:** Global unique identity, membership organization-specific (`OrganizationMembership`, ekjon user onek org-e). RBAC + ABAC, sob check `organization_id` context-e. Permission cache (Redis/memory), JWT-te `organization_id`. Roles: SUPER_ADMIN, OWNER, ADMIN, STAFF, VIEWER.

**Seeding (idempotent):** System-level: roles, feature catalog, business types (default feature mapping), default packages (Trial/Basic/Premium), super-admin. Tenant-level: org profile, role instances, initial admin, defaults (currency, language, timezone).

**Context map:** Organization ← Person (conformist), Billing ← Subscription (customer-supplier), all domain ← Identity, Reporting ← all.

## 5. Ekhon code-e ki ache (2026-10-08)

| Area | Status |
|---|---|
| IAM (user, role, permission, membership, login, JWT, bcrypt, seeders, authenticate/authorize middleware) | **[BUILT]**, sobcheye boro (74 file) |
| Organization (entity, ownership, industry/legal-type/nature/deployment VO, create use-case, routes, DI) | **[BUILT]**, kaj cholchhe (uncommitted change ache) |
| Person (profile + `profileAttributes`, industry-blueprint VO) | **[BUILT]** |
| Storefront (entity, setup/get/update use-case, routes) | **[BUILT]** kintu `v1.routes.ts`-e mount kora nei |
| Billing | Shudhu domain entity (invoice, payment, transaction, account), kono use-case/infra nei |
| `platform/*` (entitlement, feature-catalog, plan, tenant, etc.) | **Sob empty folder** |
| `capabilities/*` (academic, inventory, ordering, etc.) | **Sob empty folder** |
| subscription, payment, notification, audit, reporting, storage | **Empty** |
| Frontend / platform-frontend / mobile | Code nei (frontend-e shudhu README, baki folder khali) |
| Routes `/api/v1` | `/auth`, `/people`, `/platform`, `/organization` |
| Industry config | `INDUSTRY_BLUEPRINTS` (contracts-e hardcoded Coaching/Gym/Hostel/Clinic...) → Zod schema dynamically generate hoy (`industry-profile.validator.ts`) |
| Latest commit | "organization ownership + dynamic metadata according to industry, UUID hybrid approach" |

## 6. Discussion vs current code: gap **[CONFLICT / PLANNED]**

1. **Industry statically hardcoded.** `ORGANIZATION_INDUSTRY_ENUM` (10 ta value) ar `INDUSTRY_BLUEPRINTS` contracts package-e. Notun industry/field-er jonno code change + deploy lage. Vision ("platform theke dynamic, code noy") ar discussion-er decision-er shathe mile na. Next step: blueprint ke DB-driven `BusinessType` / `CustomFieldDefinition` (PlatformSettings / feature-catalog) e niye jawa; contracts-er blueprint default seed hishebe thakte pare.
2. **Request chain adhura.** Ekhon shudhu `authenticate` + `authorize`. Tenant context, entitlement, capability/module gate nei, karon `platform/entitlement`, `feature-catalog`, `tenant` empty.
3. **Field-type set choto.** Blueprint type: string, number, date, enum, boolean. Discussion-er type list (SELECT, MULTI_SELECT, REFERENCE, FILE, ...) onek boro.
4. **Entity scope nei.** Blueprint ekhon industry → fields. Discussion bole `Business → Entity → Field` (Customer / Order / Product / Membership alada). Blueprint-er scope ekhon shudhu Person (profile) level-e.
5. **Website components capability-driven** hobe, kintu storefront `sections` ekhono capability-er sathe linked noy.

## 7. Doc-er nijeder moddhe inconsistency **[CONFLICT]**

1. **Domain contracts import:** `rules/ddd_architecture.md` + `ANTI-PATTERNS.md` bole Domain **kono vabe** `@banijjik/contracts` import korbe na (Twin Enum). Kintu `instructions.md` bole VO `@banijjik/contracts` theke import korbe, ar actual `storefront.entity.ts` directly contracts import kore. Ekta rule choose kora dorkar.
2. **Validation kothay:** ddd rule bole shudhu controller-e `Schema.parse`; instructions bole `validateRequest` middleware route-e.
3. **Role name:** `OWNER` (instructions) vs `ORGANIZATION_OWNER` (iam-strategy).
4. **Stale path:** `.agent/workflows/*` `apps/backend/src/core/` bole, actual `src/domains/`. `docs/domain`, `docs/api`, `docs/deployment` khali; rules shob `.agent/`-e.
5. **`manoxen` reference:** primary dir `banijjik`, kintu workspace-e `manoxen` project-er path-o ache. Duto alada project, mix korbo na.
6. `Domain MUST NOT import node_modules` rule-e ekdike `zod` allowed, onnodike "never use Zod in domain".

## 8. Open decisions (apnar kache jante chai)

1. "OmniFlow" ki ei project-er notun naam, na alada project?
2. Domain-e contracts import: allowed (instructions) na forbidden (ddd rule)?
3. Business configuration kon domain-e thakbe: `platform/feature-catalog` + `PlatformSettings`, na notun `business-configuration` context?
4. Custom field value kothay store: entity-r embedded `customFields` map, na alada `CustomFieldValue` collection?
5. Rolls: `OWNER` na `ORGANIZATION_OWNER`?

---

## 9. Manoxen-এর সাথে সম্পর্ক **[DECIDED 2026-10-08]**

- Banijjik = manoxen-এর পরিষ্কার নতুন সংস্করণ। Manoxen-এর পরীক্ষিত business logic module ধরে ধরে আনা হবে: accounting, sales/refund-এর হিসাব, Messenger/Instagram automation, chat থেকে order, Steadfast, entitlement, queue। আনার সময় সাথে test-ও আনা হবে।
- **যা আনা হবে না:** frontend shell, `(organization)/(business-unit)/(outlet)` route group, scope-sync plumbing, watchdog/guard, double `auth()`/`queryContext()` mount।
- Manoxen-এর মূল সমস্যা (guide 24/27/28): ৩টা scope মানে ৩টা আলাদা app (৭০১ page, একই module বারবার)। Scope-এর source of truth প্রায় ১০টা। `ssr:false` shell, যা থেকে `removeChild` crash আর তার patch। Scope switch করলে layout remount।

## 10. Location model **[DECIDED 2026-10-08]**

**মূল নীতি: কোনো "scope" নেই।** Data-তে `Organization → Location` (২ স্তর)। UI-তে location শুধু page-এর filter বা form-এর field। Header-এ কোনো location switcher নেই।

- প্রতিটা Organization = একটা business (একটা industry)। Organization তৈরি হলে একটা default Location নিজে থেকেই তৈরি হয় (লুকানো)। একজন মালিকের একাধিক business থাকলে সেগুলো একাধিক Organization, account menu থেকে switch হয় (full reload ঠিক আছে)।
- Branch একটা হলে location-এর কোনো UI দেখা যাবে না। একাধিক branch হলে dashboard/report/list-এ default থাকবে "সব branch", page filter bar-এ বাছাই করা যাবে। Filter-এর মান URL-এ থাকবে (`?location=`)।
- Staff permission অনুযায়ী নির্দিষ্ট location-এ আটকে থাকবে। POS device একটা location-এ বাঁধা। Profile-এ "default branch" শুধু filter আর form-এ আগে থেকে মান বসায়।

### Location অনুযায়ী data, setting, staff: সব সম্ভব

নিয়ম: **Organization-এ একবার সংজ্ঞা, Location-এ শুধু override।**

| বিষয় | Organization স্তর (একবার) | Location স্তর (override/আলাদা) |
|---|---|---|
| **Catalog** | Product: নাম, SKU, category, ছবি, base price, tax class | `ProductLocation { productId, locationId, isAvailable, priceOverride?, reorderLevel? }` |
| **Stock** | — | `StockMovement` (append-only ledger) → `InventoryLevel { productId, locationId, qty }` (projection) |
| **Settings** | Org default | Location override, যেমন opening hours, receipt header, printer, pickup ঠিকানা, courier pickup point |
| **Staff** | `Membership { userId, organizationId }` | `assignments: [{ locationId \| ALL, roleId }]`, মানে A branch-এ manager আর B branch-এ cashier হওয়া সম্ভব |
| **Operational data** | — | order (কোন branch fulfil করছে), POS sale, cash shift, expense, attendance, stock transfer: সবকিছুতে `locationId` |

- **Settings resolution:** `System default → Business type (Platform) → Organization → Location`। সবচেয়ে নিচের স্তরের মানটাই কার্যকর। প্রতিটা setting key-র জন্য settings registry-তে (single source of truth) লেখা থাকবে সেটা location-এ override করা যায় কিনা। Currency বা legal info শুধু org-level।
- **Backend enforcement:** read করার সময় query-তে নিজে থেকেই `locationId ∈ allowedLocationIds` যোগ হবে। Write করার সময় যাচাই হবে locationId-টা user-এর অনুমতিপ্রাপ্ত কিনা। শুধু UI-তে লুকানো যথেষ্ট নয়।
- **UI:** Product page-এ "Locations" tab (প্রতি branch-এ available/দাম/stock, bulk edit সহ)। Settings page-এ "Org default" আর পাশে "এই branch-এ override"। Staff page-এ branch আর role assignment।

## 11. গতি (fast response) **[DECIDED]**

**মাপার লক্ষ্য:** API p95 < ২০০ms, page navigation < ৩০০ms, mobile 4G-তে LCP < ২.৫s, INP < ২০০ms। CI আর monitoring-এ মাপা হবে।

- **Frontend:**
  - একটাই route tree, persistent layout (কখনো remount হবে না)
  - httpOnly cookie + server-rendered shell (`ssr:false` থাকবে না)
  - Menu login-এ একবার হিসাব হয়ে cache থাকবে
  - TanStack/RTK Query cache, hover-এ prefetch, optimistic update
  - বড় list-এ pagination/virtualization, route-ভিত্তিক code-split
- **Backend:**
  - Middleware একবার mount
  - JWT-তে `organizationId` আর role। Permission Redis/memory cache-এ, পরিবর্তনে version দিয়ে invalidate।
  - Compound index `{organizationId, locationId, createdAt}`, `lean()` আর projection। `$lookup` pagination-এর পরে।
  - Dashboard/report আগে থেকে হিসাব করা summary থেকে (দিন × location)
  - ভারী কাজ queue-তে (BullMQ)
- **Infra:** কাছের region (Singapore), CDN, compression।

## 12. Mobile friendly **[DECIDED]**

- **Mobile-first design:** ছোট screen-এ table card হয়ে যাবে, নিচে bottom navigation, বড় touch target (≥ ৪৪px), filter আলাদা bottom sheet-এ।
- **PWA:** install করা যাবে, static asset cache হবে। POS-এ offline sale queue (IndexedDB) পরে যোগ করা হবে, idempotency key দিয়ে।
- **হালকা রাখা:** JS bundle budget, ছবি CDN থেকে resize/WebP, বাংলা font subset।
- Native mobile app পরে। শুরুতে PWA-ই যথেষ্ট।

## 13. Quality বৈশিষ্ট্য: কীভাবে অর্জন হবে

| বৈশিষ্ট্য | কীভাবে | বাকি ঝুঁকি |
|---|---|---|
| **Scalable** | Modular monolith; stateless API + worker আলাদা; shared tenant দিয়ে শুরু, পরে dedicated; UUID দিয়ে SQL-এ যাওয়ার পথ খোলা; summary/projection | Mongo-র বড় aggregation, তাই report আগে থেকে হিসাব করে রাখতে হবে |
| **Single source of truth** | contracts/validation/i18n; settings registry; stock = movement ledger; permission = membership assignment; active location = URL | Domain-এ contracts import নিয়ে doc-এর বিরোধ মেটাতে হবে (§7.1) |
| **Dynamic** | Business type → module/entity/custom field DB-তে, Platform Panel থেকে; location override | `INDUSTRY_BLUEPRINTS` এখনো hardcoded (§6.1) |
| **Secure** | Server-side tenant + location filter; httpOnly cookie; permission check backend-এ; integration token encrypted; rate limit; audit log; `.env` git-এর বাইরে | Repo-তে আগে ফাঁস হওয়া secret বদলাতে হবে |
| **"0 failure"** (বাস্তবে: failure হলেও ক্ষতি নেই) | Financial ও stock কাজ MongoDB transaction-এ (replica set লাগবে); idempotency key; outbox + retry; double-entry ledger; append-only stock; backup + restore পরীক্ষা; Sentry/monitoring; tenant isolation test | ১০০% uptime কোনো system-এর হয় না, তাই লক্ষ্য SLO (যেমন ৯৯.৯%) |
| **Best architecture** | ছোট team-এর জন্য উপযুক্ত: monolith + DDD, জটিল module-এ পূর্ণ layer, সাধারণ CRUD-এ হালকা layer, খালি package থাকবে না | Over-engineering, তাই দরকার হলে তখনই package/layer যোগ হবে |
