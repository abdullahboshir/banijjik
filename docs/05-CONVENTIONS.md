# Conventions

## Naming
- Files: kebab-case with role suffix: `create-order.use-case.ts`, `order.entity.ts`, `order.model.ts`, `order.mapper.ts`, `order.router.ts`, `order.controller.ts`.
- Classes: PascalCase, specific (`CreateOrderUseCase`, `MongoOrderRepository`). Never bare `Service`/`Manager`.
- Business language: **Organization** (never "tenant" in business code), **Location** (never outlet/branch/BU/scope in code), **Member** = staff membership, **Contact** = customer/supplier.
- "Tenant" is allowed only in technical kernel code (`tenantContext`).

## Readable code (ADR-041)
Code is written for the next human reader first and the compiler second. If a reviewer needs to ask "what does this do?", the code is not done.

**Names**
- Full words that say what it is or does: `confirmedOrders`, `calculateDeliveryCharge()`, `isWithinBusinessHours`. No abbreviations except an allow-list: `id`-suffixes, `url`, `api`, `dto`, `ctx`, `db`, `i18n`, `sku`, `cod`.
- Functions are verbs (`reserveStock`). Booleans read as questions (`isPaid`, `hasStock`, `canCancel`). Collections are plurals. Units go in the name when not obvious (`amountMinor`, `timeoutMs`, `durationMinutes`).
- No `data`, `info`, `item`, `temp`, `obj`, `res2`, `handleStuff`, `utils.ts` dumping grounds. Name the domain thing.

**Shape**
- A function does one thing. Aim for ≤ 40 lines; the lint limit is 60. Cyclomatic complexity ≤ 10. Nesting depth ≤ 3.
- **Early returns / guard clauses** instead of nested `if/else`. No nested ternaries.
- More than 3 parameters → one typed object parameter.
- Files ≤ 300 lines (lint). One exported concept per file.
- No magic numbers or strings. Use named constants, contracts enums or settings.
- No clever one-liners, chained `reduce` puzzles or regex where plain code is clearer. Readability beats brevity.
- Explicit return types on all exported functions, ports and use cases. No `any` (use `unknown` + narrowing). `as` casts need a one-line comment explaining why they are safe.
- `async/await` only. No `.then` chains, no floating promises (lint).
- Same structure everywhere: use cases look alike, controllers look alike, repositories look alike. Create modules with `npm run new-module -- <group>/<module-key>` (the module template); do not invent a new style.

**Comments**
- Comments explain **why** (business rule, edge case, link to ADR/issue). They never restate **what** the code says.
- Every module's public `index.ts` export has a one-line JSDoc. Every non-obvious business rule gets a comment with its source (`// ADR-013: money in minor units`).
- No commented-out code. No `TODO` without a STATUS.md handoff entry.
- Language: English in code, comments and commit messages.

**Module README**
- Every module has a short `README.md` (≤ 30 lines): purpose, main entities, public API, events emitted/consumed, permissions. Updated in the same PR as the change.

**Tests read like specs**
- Test names state behaviour: `it("rejects confirming an order when stock is insufficient")`.
- Arrange / Act / Assert blocks. Test data builders (`anOrder().withItems(2).build()`), no giant inline fixtures.

**Enforced by:** Prettier (formatting is never debated), ESLint (`max-lines-per-function`, `max-lines`, `complexity`, `max-depth`, `max-params`, `no-nested-ternary`, `@typescript-eslint/no-explicit-any`, `no-floating-promises`, `explicit-function-return-type` on exports, `naming-convention`), and the REVIEW checklist.

## Identifiers: hybrid UUID v7 (ADR-036)

**Generation**
- Every entity and aggregate gets a **UUID v7** (time-ordered, so it is index-friendly in Mongo and SQL). It is created by `newId()` from `@banijjik/ids`, lowercase canonical string `0199a3b2-…`. No other ID generator anywhere (no `uuid` v4, no `crypto.randomUUID()`, no `nanoid`).
- The entity creates its own ID when none is given: `constructor(props) { this.productId = props.productId ?? newId(); }`.

**Naming**
- Domain ID field = `<entityName>Id` in camelCase, identical in domain, DB, API, frontend and events: `userId`, `organizationId`, `locationId`, `memberId`, `contactId`, `offeringId`, `orderId`, `bookingId`.
- References use the target's ID name, with an optional role prefix: `contactId`, `fulfillmentLocationId`, `createdByUserId`, `assignedMemberId`. Lists use the plural: `offeringIds`.
- **Role-prefixed contact references** (ADR-039): `supplierContactId`, `billToContactId`, `guardianContactId`. The buyer on an order or booking is plain `contactId`.
- **Forbidden aliases:** a bare `id` in domain/API payloads, `supplierId`, `studentId`, `patientId`, `orgId`, `tenantId`, `org_id`, `branchId`, `outletId`, `storeId`, `buId`, `uid`, `user_id`, `customerId`. (A customer is a Contact → `contactId`.)

**Types**
- Branded types in `@banijjik/ids` (`type OfferingId = Brand<string, "OfferingId">`) so a `contactId` cannot be passed where an `offeringId` is expected.
- Zod `uuidV7Schema` (`@banijjik/validation`) for every ID in request schemas.

**Mongo `_id` (the hybrid part)**
- `_id` stays Mongo's internal `ObjectId`, used only for Mongo's own needs: the default clustered order, internal tooling, and the cursor tiebreak where a repository needs it.
- `_id` **never** appears in domain entities, use cases, API responses, events, URLs, logs meant for users, or references between documents. Mappers strip it.
- Every model stores its domain ID as a string field with a **unique index**, compound with `organizationId` for tenant data (`{ organizationId: 1, offeringId: 1 }` unique).
- Embedded sub-documents use `_id: false`. If a line item needs identity, it gets its own UUID v7 (`orderLineId`).
- Mongoose `populate` uses virtuals over domain ID fields (`localField: "contactId", foreignField: "contactId"`), never `_id` refs.
- Cost of hybrid: one extra unique index per collection. Accepted for DB portability (ADR-036).

**What UUIDs are not**
- Not secrets. UUID v7 reveals creation time and is guessable in order. Access is always checked by tenant + permission, never by "nobody knows the ID". Tokens, invite links and reset links use separate random secrets.
- Not human numbers. Customer-facing numbers (`INV-2026-000123`, `ORD-000045`, `BK-…`) come from a per-org atomic counter (`kernel/sequence`, `findOneAndUpdate $inc` inside the same transaction), formatted from settings. Never `count() + 1`.

**Slug vs ID** (adapted from manoxen rule 13)
- Slugs appear **only** in human URLs: the org path segment `/[orgSlug]` and storefront URLs (shop slug, product slug).
- Every payload, header, query param, job, event and cache key uses UUIDs.
- Responses for slugged entities return both `organizationId` and `slug`. Slug changes keep a redirect history. An unknown slug → 404, never a fallback to another org.

## Common fields & data rules
- **Audit fields** on every tenant document: `createdAt`, `updatedAt` (UTC), `createdByUserId`, `updatedByUserId` (null for system).
- **Lineage** on records that can come from many channels (contacts, offerings, orders, bookings): `source` (`ADMIN | POS | STOREFRONT | CHAT | IMPORT | API | SYSTEM`), plus `channelId`/`conversationId` when relevant.
- **Optimistic concurrency:** mutable aggregates (order, booking, enrollment, offering, settings) carry `version`. Updates use `{ <entity>Id, version }` and fail with a conflict error if the version changed. Lost updates are never silent.
- **Soft delete:** `deletedAt`, `deletedByUserId`, only where restore is a business need. Ledgers and audit logs are never deleted.
- **Phone:** stored canonical E.164 (`+8801…`) in `phoneE164`; the raw input is kept only if needed for display. **Email:** trimmed + lowercased.
- **Contact master** (adapted from manoxen rule 11):
  - One Contact per person per organization. Never module-specific customer tables.
  - Duplicate check on create/import: canonical phone first, then email. A match links to the existing Contact, it does not create a second one.
  - A global `User` (login identity) is separate from a per-org `Contact`. A contact never links a `userId`; a storefront/portal login is a per-org `CustomerAccount` linked to the contact (ADR-045).
- **Business date vs timestamp:** events store UTC timestamps. Day-based reports and day close use a `businessDate` computed in the org/location timezone.
- **Enums** are stored as the uppercase string from contracts. Never numbers, never localized text.
- **Collections:** plural snake_case (`offerings`, `stock_movements`). **Fields:** camelCase.
- **Events:** name `<module>.<entity>.<pastTenseVerb>` (`sales.order.confirmed`). Envelope `{ eventId (uuid v7), type, version, occurredAt, organizationId, actorUserId, payload }`; `organizationId` and `actorUserId` are null only for user-level events such as `iam.user.registered` (card 1.5b).
- **Tenant prefix everywhere outside the DB:** cache keys `org:{organizationId}:…`, file paths `org/{organizationId}/…`, queue job data always carries `organizationId`.

## System access (bypass), adapted from manoxen rule 9
- Tenant filtering can only be skipped via `runAsSystem(reason, fn)`. `reason` is a closed contracts enum: `AUTH_LOOKUP`, `PERMISSION_RESOLUTION`, `CONTEXT_SETUP`, `SEED`, `PLATFORM_ADMIN`, `MIGRATION`, `WEBHOOK_ROUTING`, `SCHEDULED_JOB`.
- Every call is logged with its reason. It is forbidden in module repositories, use cases and controllers, except platform-admin use cases with an audit entry.

## Errors & observability, adapted from manoxen rule 19
- No empty `catch {}`. No `catch (e) { console.log(e) }`. Either handle the error meaningfully, rethrow it, or report it through the central error reporter.
- `console.*` is forbidden in app code. Use the logger.
- Every log line carries `requestId`, `organizationId`, `userId` when known. Phone, email and address are masked in logs.
- Queue workers and event handlers use the shared wrappers that capture failures, retry, and dead-letter. No module-specific error tables.

## AI boundary, adapted from manoxen rule 22
- LLM providers live behind `LlmGatewayPort` in `modules/platform/ai` (or the kernel). Provider keys are resolved through one resolver port, never inside an adapter.
- Business tools (`search_offerings`, `create_request` …) live in their modules and are passed into the agent loop. The AI package never imports business modules or knows what an offering is.
- No LangChain/LangGraph to replace a working loop. No separate AI service until a second real consumer exists.

## Contracts (single source of truth)
Constant pattern in `packages/contracts`:
```ts
export const ORDER_STATUS = defineEnum(["DRAFT", "CONFIRMED", "SHIPPED"]);
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
```
New enum, permission key, module key, error code or event name: add it to contracts first, then use it.

## API
- Base path `/api/v1`. Tenant routes are `/api/v1/orgs/{organizationId}/…` (org in the path, ADR-077). Resource names are plural nouns; path params use full domain ID names: `/orders/{orderId}/confirm` for state transitions. Full surface: `14-API.md`.
- Success: `{ data, meta? }`. Error: `{ error: { code, messageKey, details? } }`. `code` comes from contracts. `messageKey` comes from i18n.
- List: `?page=&limit=` (limit ≤ 100, default 20), `?sort=-createdAt`, `?location=`. The response `meta` has `{ page, limit, hasNext, total? }` (`total` only with `includeTotal=true`, ADR-079).
- Money in JSON: `{ amount: 125050, currency: "BDT" }` in minor units.
- Dates: ISO 8601 UTC. Display timezone comes from settings.
- `Idempotency-Key` header is required on money/stock-creating endpoints.

## Errors & i18n
- No user-facing literal strings in API or UI code. Use i18n keys: `sales.order.not_found`.
- Domain errors are typed classes that carry a contracts error code.

## Data
- Every tenant model applies the tenant plugin. Location-scoped models also apply the location plugin.
- First index field is `organizationId`. Add a compound index for every list query you write.
- `lean()` + projection for reads. `$lookup` only after `$match` + pagination. No N+1 queries (batch-load).
- Soft delete (`deletedAt`) only where the business needs restore. Ledgers are never deleted.

## Testing (Definition of Done needs these)
- Unit tests for domain entities and use cases (Vitest).
- An API test for every endpoint: happy path, validation error, permission denied, **cross-org access denied**.
- Ported manoxen logic must keep its original test cases.

## Git
- One session = one branch `s/<card-id>-<slug>` (e.g. `s/1.2-org-location`) = one PR into `main`.
- Conventional commits: `feat(sales): ...`, `fix(...)`, `chore(...)`, `docs(...)`.
- Never commit `.env`, `dist`, `.turbo`, logs, CSV or customer data.
