# API Surface

Card D7 · Status: **approved by owner 2026-10-09** · Written 2026-10-09 · Based on `s/D4-industry-templates` (`35582a0`)

This doc fixes how the API is shaped and lists every launch endpoint per module, with its permission, idempotency and contract names. PLAN sessions copy their module's rows into the plan. An endpoint not listed here is added here first. Field-level request/response shapes are written as Zod schemas in `@banijjik/validation` and types in `@banijjik/contracts` by the card that builds the endpoint, using the contract names below.

Inputs:
- `05` (API conventions, IDs), `09` (entities), `10` (modules, permissions), `11` (transitions), `13` (UI needs)
- ADR-022 (org from URL), ADR-045 (customer accounts), ADR-048 (platform operators), ADR-053 (access modes)

New decisions: §9 (ADR-077 to ADR-081).

---

## 1. Shape of the API (ADR-077)

| Surface | Base path | Auth | Org resolution |
|---|---|---|---|
| Auth & account | `/api/v1/auth/*`, `/api/v1/me/*` | admin cookie (access + refresh), none for login/OTP | none (user-level) |
| Tenant (admin, POS, rider) | `/api/v1/orgs/{organizationId}/…` | admin cookie | **path param**, validated against the user's memberships (cached) |
| Storefront & customer portal | `/api/v1/storefront/orgs/{organizationId}/…` | storefront cookie (audience `storefront`, ADR-045), optional for browsing | path param. The storefront app resolves host/slug → `organizationId` via `GET /api/v1/storefront/resolve?host=` (cached at the edge). |
| Platform panel | `/api/v1/platform/…` | platform cookie (audience `platform`, ADR-048) | `{organizationId}` appears only as a resource id |
| Webhooks | `/api/v1/webhooks/{provider}[/…]` | provider signature | from the payload (page id, phone number id, consignment id) → org (`runAsSystem(WEBHOOK_ROUTING)`) |
| Health | `/health`, `/ready` | none | — |

Why a path param, not a header: the org is visible in every log line, cache key and URL. A request can never "forget" its org (manoxen used `x-organization-id` headers next to scope modes, and drift came from there). The frontend's `/[orgSlug]` URL maps to the id once per session through `/me/orgs`.

**Path parameters are domain IDs with their full names**: `/orders/{orderId}/confirm`, never `/:id`.

## 2. Conventions (extends `05` "API")

- **Envelope:** success `{ data, meta? }` · error `{ error: { code, messageKey, details?, requestId } }`.
- **Methods:**
  - `GET` reads
  - `POST /things` creates
  - `PATCH /things/{thingId}` edits fields (body carries `version`)
  - `POST /things/{thingId}/{verb}` for every state transition (`11`)
  - `DELETE` only for true removals of non-ledger data (drafts, definitions in DRAFT status). Archive is `POST …/archive`.
- **Optimistic concurrency:** `PATCH` and transition bodies include `version`. A mismatch → `409 CONFLICT` with the current `version` in `details`. Every response that returns an aggregate includes `version`.
- **Idempotency:** routes marked **I** require the `Idempotency-Key` header (UUID). The same key with a different body → `422 IDEMPOTENCY_MISMATCH`; with the same body → the stored response (manoxen rule).
- **Approval:** routes marked **A** may need `X-Approval-Token` (`11 §9`). Without it, when one is required → `403 APPROVAL_REQUIRED` with `details.action`.
- **Lists:** `?page=&limit=` (limit ≤ 100, default 20), `?sort=` (allow-listed fields), `?q=` (search), `?location={locationId}` (only on location-scoped resources), filters as named params (`?status=PLACED,CONFIRMED`). `meta { page, limit, hasNext, total? }`. `total` only when `?includeTotal=true` (counting large collections is expensive).
- **Field selection:** none at launch. Each list endpoint returns a fixed **summary** shape (what `DataList` needs). Detail endpoints return the full shape.
- **Money / quantity / dates:** Money `{ amount, currency }` in minor units. Quantity integer in unit precision plus `unitKey`. Timestamps ISO 8601 UTC. Business dates `YYYY-MM-DD`.
- **Contract names:** `<Entity><Action>Request` / `<Entity>Response` / `<Entity>Summary` (lists), in `@banijjik/contracts`. Zod schemas with the same names + `Schema` in `@banijjik/validation`.
- **Rate limits:**
  - auth/OTP: per IP + per identifier
  - storefront: per IP
  - webhooks: per provider account
  - tenant API: per user (generous)
  - Limits return `429 RATE_LIMITED` with `Retry-After`.

## 3. Error codes (contracts `ERROR_CODE`; each has an i18n `messageKey`)

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | schema failure; `details.fields[{ path, messageKey }]` |
| 401 | `UNAUTHENTICATED` | no or expired session |
| 403 | `FORBIDDEN` | permission missing |
| 403 | `MODULE_DISABLED` | module not effective for the org (`10 §11`) |
| 403 | `ORG_READ_ONLY` | `accessMode = READ_ONLY` (ADR-053) |
| 403 | `ORG_SUSPENDED` | org suspended by the platform |
| 403 | `LOCATION_FORBIDDEN` | location outside the member's assignments |
| 403 | `APPROVAL_REQUIRED` | approval token missing or invalid |
| 404 | `NOT_FOUND` | also for resources of another org (never reveal existence) |
| 409 | `CONFLICT` | version mismatch |
| 409 | `INVALID_TRANSITION` | transition not allowed from the current state; `details.currentStatus` |
| 409 | `DUPLICATE` | unique key clash (phone, SKU, slug, trxID) with `details.existingId` where safe |
| 409 | `INSUFFICIENT_STOCK` / `SLOT_UNAVAILABLE` / `CAPACITY_FULL` | stock or capacity checks |
| 422 | `IDEMPOTENCY_MISMATCH` | same key, different body |
| 422 | `LIMIT_REACHED` | package limit; `details.limitKey`, `details.limit` |
| 422 | `BUSINESS_RULE` | a named domain rule failed; `details.ruleKey` (e.g. `RETURN_WINDOW_EXPIRED`) |
| 429 | `RATE_LIMITED` | |
| 500 | `INTERNAL` | unexpected; `requestId` for support |
| 503 | `INTERNAL` | only `GET /ready` when the database does not answer (`errors.not_ready`); the one deliberate exception to "`INTERNAL` is 500" |
| 503 | `RETRY_LATER` | a transaction kept conflicting; safe to retry; sent with `Retry-After: 1` |

## 4. Auth, account and org entry

| Method & path | Who | I | Contract |
|---|---|---|---|
| `POST /auth/register` | public | | `UserRegisterRequest` (phone/email + password or OTP) |
| `POST /auth/otp/send` · `POST /auth/otp/verify` | public | | `OtpSendRequest`, `OtpVerifyRequest` |
| `POST /auth/login` · `POST /auth/logout` · `POST /auth/refresh` | public / session | | `LoginRequest` → sets cookies |
| `POST /auth/logout-all` | user | | revokes every ADMIN session of the user, clears cookies, `204` (card 1.1; per audience since 1.9a) |
| `POST /auth/password/forgot` · `POST /auth/password/reset` | public | | token from email/SMS (random secret) |
| `GET /me` · `PATCH /me` | user | | `MeResponse` (user, preferredLocale) |
| `GET /me/orgs` | user | | `MyOrganizationSummary[]` (id, slug, name, role keys, status) |
| `POST /me/orgs` | user (verified identifier) | I | `OrganizationCreateRequest` (name, slug, industryTemplateKey, packageKey/trial, district) → org + location + roles + owner member + trial subscription (card 1.2 / 1.6 / 6.1) |
| `GET /orgs/{organizationId}/me/config` | member | | `ResolvedOrgConfigResponse` (modules, kinds, menu, terms, settings subset, limits, accessMode, permissions at each location) |
| `POST /orgs/{organizationId}/me/approval-pin` | member with `sales.approval.grant` | | set/change own PIN |
| `POST /orgs/{organizationId}/approvals` | member with `sales.approval.grant` (PIN on the same device) | | `ApprovalGrantRequest { action, requestId, amount, pin }` → `{ approvalToken, expiresAt }` |
| `GET /invitations/{token}` · `POST /invitations/{token}/accept` | public (rate limited per IP) / user | | the preview returns `InvitationPreviewResponse` (organization name, inviter, masked identifier); accept answers `MyOrganizationSummary`. The token is a random secret, masked in logs. An unknown, expired, revoked or used token is 404; a signed-in user whose email or phone differs from the invited one gets 403 `errors.invitation_identifier_mismatch` (ADR-092) |

## 5. Tenant endpoints (prefix `/api/v1/orgs/{organizationId}`)

Permissions are from `10 §7` + `11` additions. `L` = location-scoped (supports `?location=`, writes need an allowed `locationId`).

### 5.1 organization, iam, settings, custom-field, audit, file
| Method & path | Permission | Flags | Contract / notes |
|---|---|---|---|
| `GET /profile` · `PATCH /profile` | `organization.profile.update` (PATCH) | | `OrganizationProfile…` |
| `GET /locations` · `POST /locations` · `PATCH /locations/{locationId}` · `POST /locations/{locationId}/archive` | `organization.location.*` | I (POST) | archive refused with stock/open requests (`BUSINESS_RULE`) |
| `GET /members` · `GET /members/{memberId}` · `PATCH /members/{memberId}` · `POST /members/{memberId}/suspend` · `POST /members/{memberId}/reactivate` · `POST /members/{memberId}/remove` | `organization.member.*` (`remove` for remove, `update` for the rest) | | assignments edit via PATCH under the rules of ADR-092; sensitive custom fields need `readSensitive` (card 2.3) |
| `POST /invitations` · `GET /invitations` · `POST /invitations/{invitationId}/revoke` | `organization.member.invite` | I (POST) | lists and revokes only invitations within the caller's locations (outside: 404; roles above the caller: `422 ROLE_NOT_GRANTABLE`); a member who loses access (suspend, remove, assignments changed) takes their pending invitations with them; the create response carries `inviteUrlPath` once; a replay of the same key returns the invitation without it (ADR-092) |
| `POST /ownership/transfer` | `organization.ownership.transfer` | A | target must be an active member |
| `GET /roles` · `POST /roles` · `PATCH /roles/{roleId}` · `POST /roles/{roleId}/archive` | `iam.role.*` | | system roles read-only; writes need the permission at ALL locations and every key added or removed held by the caller at ALL (`422 ROLE_NOT_GRANTABLE`, `details.permissionKeys`) |
| `GET /settings?keys=` · `PATCH /settings` | `settings.setting.*` | | batch update `{ key, value, locationId? }[]` with versions |
| `GET /terms` · `PATCH /terms` | `settings.term.update` | | |
| `GET /custom-fields?entityType=` · `POST /custom-fields` · `PATCH /custom-fields/{customFieldDefinitionId}` · `POST /custom-fields/{customFieldDefinitionId}/archive` | `custom-field.definition.*` | | org-scope definitions only; industry ones read-only |
| `GET /audit-logs` | `audit.log.read` | | filters: entityType, entityId, actor, date |
| `POST /files` (multipart or signed upload) · `GET /files/{fileId}` | any member with a write permission on the owner entity | I | returns `FileResponse`; storage path `org/{organizationId}/…` |

### 5.2 contact
| Method & path | Permission | Flags | Notes |
|---|---|---|---|
| `GET /contacts` · `GET /contacts/{contactId}` | `contact.contact.read` | | `?role=&tag=&q=` (phone/name) |
| `POST /contacts` | `contact.contact.create` | I | dedupe: returns `409 DUPLICATE` with `existingId`, or links when `?linkIfExists=true` |
| `PATCH /contacts/{contactId}` · `POST /contacts/{contactId}/archive` | `contact.contact.update/archive` | | |
| `POST /contacts/{contactId}/merge` | `contact.contact.merge` | I | `{ mergeIntoContactId }` |
| `POST /contacts/{contactId}/anonymize` | `contact.contact.anonymize` | A | |
| `POST /contacts/import` · `GET /contacts/import/{importJobId}` | `contact.contact.create` | I | async job: upload → preview rows → commit |
| `GET /contacts/{contactId}/store-credit` | `payment.storeCredit.read` | | balance + entries |

### 5.3 catalog, inventory, pricing
| Method & path | Permission | Flags | Notes |
|---|---|---|---|
| `GET /offerings` · `GET /offerings/{offeringId}` | `catalog.offering.read` | | `?kind=&status=&categoryId=&q=` |
| `POST /offerings` · `PATCH /offerings/{offeringId}` | `catalog.offering.create/update` | I (POST) | kind-specific `kindDetails` validated per kind |
| `POST /offerings/{offeringId}/publish` · `/archive` | `catalog.offering.publish/archive` | | DRAFT → ACTIVE (`11`, ADR-026) |
| `PUT /offerings/{offeringId}/locations/{locationId}` | `catalog.offering.update` | L | availability / price override per variant |
| `GET/POST/PATCH /categories[/{categoryId}]` | `catalog.category.*` | | |
| `GET/POST/PATCH /modifier-groups[/{modifierGroupId}]` | `catalog.modifierGroup.*` | | ADR-072 |
| `GET/PUT /search-synonyms` | `catalog.synonym.update` | | |
| `POST /offerings/import` · `GET /offerings/import/{importJobId}` · `POST /offerings/import/{importJobId}/commit` | `catalog.offering.create` | I | CSV/Excel/photo/PDF → drafts → review → commit (card 5.11) |
| `GET /stock?location=` · `GET /stock/{offeringId}/{variantId}` | `inventory.stock.read` | L | levels incl. reserved/damaged/average cost (cost needs `report.profit.read`) |
| `GET /stock-movements` | `inventory.movement.read` | L | |
| `POST /stock-receipts` | `inventory.adjustment.create` | I L | purchase/receive: lines with quantity + unit cost → PURCHASE movements + average cost update (ADR-069) |
| `POST /stock-adjustments` | `inventory.adjustment.create` | I L A* | reason required; large negative adjustments need approval (setting) |
| `POST /stock-transfers` · `POST /stock-transfers/{stockTransferId}/receive` · `/cancel` | `inventory.transfer.create` | I L | two movements per leg, one txn each |
| `POST /stock/damaged/write-off` | `inventory.adjustment.create` | I L A | DAMAGE_WRITE_OFF |
| `GET/POST/PATCH /promotions[/{promotionId}]` · `POST /promotions/{promotionId}/archive` | `pricing.promotion.*` | | |
| `GET/PATCH /tax-classes` | `pricing.taxClass.update` | | |
| `POST /quotes` | any request-create permission | | `QuoteRequest` (lines/bookings/enrollments, delivery zone, promo code) → priced lines; the same pipeline the bot uses (`11 §3`) |

### 5.4 sales (orders, returns)
| Method & path | Permission | Flags | Notes |
|---|---|---|---|
| `GET /orders` · `GET /orders/{orderId}` | `sales.order.read` | L | `?status=&paymentStatus=&source=&from=&to=&contactId=` |
| `POST /orders` | `sales.order.create` | I L | creates DRAFT (or `?place=true` → PLACED) |
| `PATCH /orders/{orderId}` | `sales.order.update` | L A* | edit in DRAFT/PLACED/CONFIRMED; discounts over threshold need approval |
| `POST /orders/{orderId}/place` · `/confirm` · `/pack` · `/complete` · `/cancel` · `/mark-delivered` · `/mark-delivery-failed` · `/reship` · `/receive-return-to-sender` | per `11 §4.2` | I L | body `{ version, … }` |
| `DELETE /orders/{orderId}` | `sales.order.update` | L | DRAFT only |
| `POST /orders/{orderId}/receipt` | `sales.order.read` | | printable receipt payload (POS/thermal) |
| `GET /returns` · `GET /returns/{salesReturnId}` | `sales.return.read` | L | |
| `POST /orders/{orderId}/returns` | `sales.return.create` | I L A | `SalesReturnCreateRequest { lines[{ orderLineId, quantity, disposition }], refund { method }, reasonKey }` (server computes amounts) |
| `POST /returns/{salesReturnId}/reverse` | `sales.return.reverse` | I A | |
| `POST /orders/{orderId}/exchange` | `sales.return.create` + `sales.order.create` | I L A | `ExchangeRequest` (return lines + new lines) |

### 5.5 booking, enrollment
| Method & path | Permission | Flags | Notes |
|---|---|---|---|
| `GET /availability?offeringId=&variantId=&from=&to=&resourceId=` | `booking.booking.read` | L | free slots/ranges/seats |
| `GET /bookings` · `GET /bookings/{bookingId}` | `booking.booking.read` | L | calendar views use `?from=&to=&resourceId=` |
| `POST /bookings` | `booking.booking.create` | I L | creates HELD or CONFIRMED (`?confirm=true`) |
| `POST /bookings/{bookingId}/request` · `/confirm` · `/reschedule` · `/check-in` · `/complete` · `/cancel` · `/no-show` | per `11 §5.2` | I L | |
| `GET/POST/PATCH /resources[/{resourceId}]` · `POST /resources/{resourceId}/time-off` | `booking.resource.*` | L | |
| `GET/POST/PATCH /event-sessions[/{eventSessionId}]` · `POST /event-sessions/{eventSessionId}/cancel` | `booking.eventSession.*` | L | cancel cascades to bookings |
| `GET /enrollments` · `GET /enrollments/{enrollmentId}` | `enrollment.enrollment.read` | L | `?status=&offeringId=&overdue=true` |
| `POST /enrollments` | `enrollment.enrollment.create` | I L | PENDING/ACTIVE |
| `POST /enrollments/{enrollmentId}/activate` · `/freeze` · `/unfreeze` · `/renew` · `/cancel` | per `11 §8` | I L A* | refund on cancel needs approval |
| `GET /enrollments/{enrollmentId}/periods` | `enrollment.enrollment.read` | L | |
| `POST /check-ins` · `GET /check-ins` | `enrollment.checkIn.create` / read | I L A* | session-limit override needs approval |

### 5.6 payment, expense, accounting, bookkeeping, report
| Method & path | Permission | Flags | Notes |
|---|---|---|---|
| `GET /payments` · `GET /payments/{paymentId}` | `payment.payment.read` | L | |
| `POST /payments` | `payment.payment.receive` | I L | `PaymentReceiveRequest { method, amount, externalReference?, allocations[] }` |
| `POST /payments/{paymentId}/refund` | `payment.payment.refund` | I L A | |
| `POST /payments/{paymentId}/reverse` | `payment.payment.reverse` | I L A | |
| `GET /dues` | `payment.due.read` | L | open requests with due, by contact |
| `POST /contacts/{contactId}/store-credit/adjust` | `payment.storeCredit.adjust` | I A | |
| `GET /expenses` · `POST /expenses` · `POST /expenses/{expenseId}/void` | `expense.expense.*` | I L A* (void) | |
| `GET/POST/PATCH /expense-categories[/{expenseCategoryId}]` | `expense.category.update` | | |
| `GET /accounts` · `POST /accounts` · `PATCH /accounts/{accountId}` | `bookkeeping.account.*` | | system accounts read-only |
| `GET /journal-entries` · `POST /journal-entries` (manual) · `POST /journal-entries/{journalEntryId}/reverse` | `bookkeeping.journal.*` | I A (manual, reverse) | |
| `GET /statements/{trial-balance\|profit-and-loss\|balance-sheet}?from=&to=` | `bookkeeping.statement.read` | | |
| `GET /reports/dashboard?location=&date=` | `report.dashboard.read` | L | package-aware widgets (`13 §3`) |
| `GET /reports/{sales\|stock\|profit\|bookings\|enrollments\|dues}?from=&to=&location=&groupBy=` | `report.*.read` | L | reads daily summaries only |
| `POST /reports/{reportKey}/export` | same + `*.export` | I | async CSV/XLSX job → file |

### 5.7 pos, delivery, courier, risk
| Method & path | Permission | Flags | Notes |
|---|---|---|---|
| `GET /pos/devices` · `POST /pos/devices` (pairing code) · `POST /pos/devices/{posDeviceId}/revoke` | `pos.device.manage` | I | device ↔ location binding |
| `POST /pos/sessions` (open register) · `POST /pos/sessions/{posSessionId}/close` · `GET /pos/sessions/{posSessionId}/z-report` | `pos.session.open` / `pos.register.close` | I L | |
| `POST /pos/sales` | `pos.sale.create` | I L A* | `PosSaleCreateRequest` (lines + payments + store credit) → COMPLETED order in one txn |
| `GET /pos/catalog-snapshot?location=&since=` | `pos.sale.create` | L | compact, cacheable catalog for fast local search (`13 §6.5`) |
| `GET /deliveries` (rider: own only) · `POST /deliveries` (assign) · `POST /deliveries/{deliveryAssignmentId}/complete` · `/fail` | `delivery.assignment.*` | I L | |
| `POST /rider-cash-handovers` | `delivery.cash.handover` | I L | |
| `GET/PUT /couriers/{courierKey}/credentials` · `POST /couriers/{courierKey}/test` | `courier.credential.update` | | credentials write-only (never returned) |
| `POST /orders/{orderId}/consignments` · `GET /consignments` · `POST /consignments/{consignmentId}/cancel` | `courier.consignment.*` | I L | |
| `POST /courier-settlements` · `GET /courier-settlements` | `courier.settlement.record` | I | |
| `GET /risk/contacts/{contactId}` | `risk.score.read` | | COD risk summary |

### 5.8 website, messaging, bot, social, workflow, sms, payment-gateway (Phases 4–5; paths fixed now, details in their cards)
| Prefix | Main endpoints |
|---|---|
| `/website` | `GET/PATCH /website/site`, `GET/POST/PATCH /website/pages[/{pageId}]`, `PUT /website/theme`, `POST /website/publish`, `GET /website/versions`, `POST /website/versions/{websiteVersionId}/restore`, `POST /website/domains`, `POST /website/domains/{domainId}/verify` |
| `/channels` | `GET /channels`, `POST /channels/facebook/connect` (OAuth start) → `GET /channels/facebook/callback`, `POST /channels/whatsapp/embedded-signup`, `POST /channels/{channelId}/disconnect`, `PATCH /channels/{channelId}` (botEnabled) |
| `/conversations` | `GET /conversations?status=&assigned=&channelId=`, `GET /conversations/{conversationId}/messages`, `POST /conversations/{conversationId}/messages` (I), `POST /conversations/{conversationId}/take-over`, `/release-to-bot`, `/assign` |
| `/bot` | `GET/PATCH /bot/settings`, `GET/POST/PATCH /bot/knowledge[/{knowledgeEntryId}]`, `POST /bot/test` (sandbox chat), `POST /bot/evals/run` (permission `bot.eval.run`) |
| `/social` | `GET /social/posts?channelId=`, `POST /social/posts/{externalPostId}/import` (I), `POST /social/posts/import-recent` (I, async), `POST /offerings/{offeringId}/publish-to-facebook` (I) |
| `/workflows` | CRUD `/workflows[/{workflowId}]`, `GET /workflows/{workflowId}/runs` |
| `/sms` | `GET /sms/logs`, `PUT /sms/sender` |
| `/payment-gateway` | `PUT /payment-gateway/credentials`, `GET /payment-gateway/transactions` |

## 6. Storefront & customer portal (`/api/v1/storefront/orgs/{organizationId}`)
Public reads are cacheable (`Cache-Control` + CDN). Writes need the storefront cookie, except checkout as guest when `website.guestCheckout` is true.

| Method & path | Auth | Flags | Notes |
|---|---|---|---|
| `GET /api/v1/storefront/resolve?host=` | public | | host/slug → `{ organizationId, siteVersion }` |
| `GET /site` · `GET /pages/{pageSlug}` | public | cache | published version only |
| `GET /offerings?category=&q=&kind=` · `GET /offerings/{offeringSlug}` · `GET /categories` | public | cache | ACTIVE offerings, storefront-visible fields only |
| `GET /availability?offeringSlug=&from=&to=` | public | | |
| `POST /quotes` | public | | server pricing (manoxen `resolve-public-order-line-items` rule: never trust client prices) |
| `POST /auth/otp/send` · `POST /auth/otp/verify` · `POST /auth/logout` | public | rate | CustomerAccount login (ADR-045) |
| `POST /checkout` | customer or guest | I | `CheckoutRequest` (cart lines/bookings/enrollments, contact, address, payment choice) → PLACED order / HELD→REQUESTED booking / PENDING enrollment, shared `checkoutId` |
| `POST /checkout/{checkoutId}/pay` | customer or guest | I | gateway redirect (card 5.17) |
| `GET /me/requests` · `GET /me/requests/{requestType}/{requestId}` | customer | | order tracking, bookings, enrollments, dues |
| `POST /me/requests/{requestType}/{requestId}/cancel` | customer | I | only where `11` allows customer cancel |
| `GET /me/store-credit` | customer | | |
| `POST /chat-widget/sessions` · `POST /chat-widget/messages` | public | rate | `WEB_WIDGET` channel (card 5.16) |

## 7. Platform panel (`/api/v1/platform`)
Permissions `platform.<module>.<action>` from `PlatformOperator.platformRoles` (ADR-048, ADR-054). Every write is audited in the platform audit log.

| Area | Endpoints |
|---|---|
| Auth | `POST /platform/auth/login` · `/logout` · `/logout-all` (platform sessions only, needs a platform session) · `/refresh` (separate cookie), `GET /platform/me` (`{ platformOperatorId, userId, name, platformRoles, permissions }`, for the panel after a reload) |
| Tenants | `GET /platform/organizations?status=&q=`, `GET /platform/organizations/{organizationId}`, `POST …/{organizationId}/suspend` · `/reactivate` · `/change-industry-template` (additive, ADR-046), `POST …/{organizationId}/impersonate` (time-boxed, reason required, audited) |
| Entitlements | `GET/POST /platform/organizations/{organizationId}/module-overrides`, `DELETE …/module-overrides/{moduleOverrideId}` |
| Packages | CRUD `/platform/packages[/{packageId}]` (save-time closure validation, `10 §3`) |
| Subscriptions | `GET /platform/organizations/{organizationId}/subscription`, `POST …/subscription/change-package`, `POST …/subscription/extend-trial` |
| Industry templates | CRUD `/platform/industry-templates[/{industryTemplateId}]`, `POST …/publish` · `/retire`, field definitions (scope INDUSTRY) under `…/{industryTemplateId}/custom-fields` |
| Website templates | CRUD `/platform/website-templates[/{websiteTemplateId}]`, `POST …/publish` |
| Operators | CRUD `/platform/operators[/{platformOperatorId}]` (SUPER_ADMIN only) |
| Health & ops | `GET /platform/system/health`, `GET /platform/system/queues`, `GET /platform/system/errors` |

Details built in card 1.8a (ADR-093):
- Cookies `platform_access_token` and `platform_refresh_token`; login gives the same `401 errors.invalid_credentials` to a non-operator. `GET /platform/audit-logs?targetType=&organizationId=&actorPlatformOperatorId=&from=&to=` (permission `platform.audit.read`, SUPER_ADMIN only).
- Packages carry `nameKey` (seed) or `name` (operator-made, 2 to 60 characters, required on create, changeable only for operator-made ones); the response has both, one null.
- `suspend`, `reactivate`, `extend-trial` take a mandatory `reason`; module overrides take `{ moduleKey, effect PLATFORM_GRANT|PLATFORM_REVOKE, reason, expiresAt? }`; package `PATCH` and `…/archive` carry `version` (409 when stale).
- Business-rule keys (`422 BUSINESS_RULE` `details.ruleKey`): `PACKAGE_NOT_CLOSED`, `PACKAGE_IN_USE`, `MODULE_NOT_REGISTERED`, `MODULE_CLASS_FIXED`, `TRIAL_NOT_ACTIVE`, `PACKAGE_KIND_MISMATCH`. The tenant list rows carry `templateKey`, `subscriptionStatus` and `memberCount`; the detail masks the owner identifier.

## 8. Webhooks (`/api/v1/webhooks`)

| Path | Provider check | Routes to |
|---|---|---|
| `GET/POST /webhooks/meta` | `hub.verify_token` (GET), `X-Hub-Signature-256` (POST) | Messenger/Instagram messages, Page feed (auto drafts) → org by page id |
| `POST /webhooks/whatsapp` | Meta signature | WhatsApp Cloud messages/status → org by phone number id |
| `POST /webhooks/courier/{courierKey}` | provider secret/signature per courier | consignment status → order transitions |
| `POST /webhooks/payment-gateway/{provider}` | provider signature + server-side validation call | payment success/failure → Payment (I by provider transaction id) |
| `POST /webhooks/saas-billing/{provider}` | provider signature | platform subscription payments (card 6.2) |

Webhook rules:
- Verify the signature, then persist the raw event (dedupe by the provider event id), then return `200` fast.
- Process asynchronously through the queue. A failure retries; it never blocks the provider.

## 9. Decisions made in this card

| ADR | Decision | Status |
|---|---|---|
| ADR-077 | Five API surfaces: `/auth` + `/me` (user), `/orgs/{organizationId}` (tenant; org in the **path**, validated against memberships), `/storefront/orgs/{organizationId}` (customer audience), `/platform` (operator audience), `/webhooks/{provider}`. No org headers. Path params are full domain ID names (`{orderId}`). | Accepted (proposed) |
| ADR-078 | REST conventions: `PATCH` for edits with `version` in the body (409 on mismatch), `POST …/{verb}` for every state transition, archive instead of delete for business records, `DELETE` only for drafts and non-ledger data. | Accepted (proposed) |
| ADR-079 | Lists use fixed summary shapes, `page/limit ≤ 100`, `hasNext`, and `total` only on request (`includeTotal=true`). Detail endpoints return full shapes. No generic field selection at launch. | Accepted (proposed) |
| ADR-080 | Error model: fixed `ERROR_CODE` set (§3) with i18n `messageKey` and `requestId`. Resources of another org return 404, never 403. Approvals via `X-Approval-Token` (`APPROVAL_REQUIRED`). | Accepted (proposed) |
| ADR-081 | Webhooks verify the signature, store the raw event deduped by the provider event id, reply 200 fast and process via the queue. Storefront pricing is always server-side (`POST /quotes`, `POST /checkout`). | Accepted (proposed) |
