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
| Tenant (admin, POS, rider) | `/api/v1/orgs/{organizationId}/…` | admin cookie | **path param**, validated against the user's memberships on every request (not cached) |
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
  - Sign-in counts **failed** attempts only (ADR-096): per identifier + IP (5 per 15 min) and per identifier (50 per 15 min), for the admin and the platform sign-in separately, plus the per-IP bucket.
  - Signed-in users: 600 requests per 60 s per user on the admin API (`/me`, `/me/orgs`, `/orgs/{organizationId}/…`) and per platform operator on `/platform/…` (ADR-090). The public auth routes and `logout-all` are not counted. If Redis is down the limit is skipped (fail open) and a `warn` is logged at most once a minute.
- **Readiness:** `GET /ready` answers `200 { "status": "ready", "details": { "redis": "ok" | "degraded" } }` when MongoDB answers, and `503` only when it does not. A Redis outage shows as `degraded` and does not fail readiness (ADR-088, ADR-090).

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
| 403 | `APPROVAL_REQUIRED` | approval token missing or invalid when consuming |
| 400 | `APPROVAL_INVALID` | wrong PIN, unknown approver, or no grant at the location (no hint which) |
| 423 | `APPROVAL_PIN_LOCKED` | five wrong PINs; retry after `Retry-After` |
| 404 | `NOT_FOUND` | also for resources of another org (never reveal existence) |
| 409 | `CONFLICT` | version mismatch, or `errors.idempotency_in_progress` with `Retry-After` while the same key is still running |
| 409 | `INVALID_TRANSITION` | transition not allowed from the current state; `details.currentStatus` |
| 409 | `DUPLICATE` | unique key clash (phone, SKU, slug, trxID) with `details.existingId` where safe |
| 409 | `INSUFFICIENT_STOCK` / `SLOT_UNAVAILABLE` / `CAPACITY_FULL` | stock or capacity checks |
| 422 | `IDEMPOTENCY_MISMATCH` | same key, different body |
| 422 | `LIMIT_REACHED` | package limit; `details.limitKey`, `details.limit` |
| 422 | `SYSTEM_ACCOUNT_LOCKED` | system account status/type is fixed; display rename is allowed (3.8b) |
| 422 | `BUSINESS_RULE` | a named domain rule failed; `details.ruleKey` (e.g. `RETURN_WINDOW_EXPIRED`) |
| 422 | `CREDITS_INSUFFICIENT` | an unlock costs more than the customer's balance; `details.balance`, `details.cost` (ADR-130) |
| 400 | `CANNOT_UNLOCK_OWN_LISTING` | a customer may not spend credits on their own listing |
| 404 | `LISTING_NOT_APPROVED` | an unlock of a listing that is not APPROVED |
| 429 | `UNLOCKS_PER_DAY_EXCEEDED` | the account reached `credit.unlocksPerDay` for the business day |
| 413 | `PAYLOAD_TOO_LARGE` | an upload over its size limit (`errors.file_too_large`), aborted while streaming |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | an upload whose content is not an accepted type, checked by magic bytes (`errors.file_type_not_allowed`) |
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
| `GET /me/orgs` | user | | `MyOrganizationSummary[]` (id, slug, name, role keys, status, `logoUrl?`: the thumbnail path of the business logo, card 3.12) |
| `POST /me/orgs` | user (verified identifier) | I | `OrganizationCreateRequest` (name, slug, industryTemplateKey, packageKey/trial, district) → org + location + roles + owner member + trial subscription (card 1.2 / 1.6 / 6.1). A well-formed key that is unknown, DRAFT or RETIRED is `422 INDUSTRY_TEMPLATE_NOT_AVAILABLE` (card 2.1a) |
| `GET /industry-templates` | signed-in admin user | | Published templates only, ordered by key, both languages, hard cap 100 (card 2.1a). Not in the tenant pipeline. A platform-operator cookie is 401 |
| `GET /orgs/{organizationId}/me/config` | member | | `ResolvedOrgConfigResponse`: modules, kinds, menu, limits, accessMode, permissions at each location. `terms` is `{ bn, en }` per template key (override or template text). `settings` is the client-visible organization-level values. `fields` is the effective custom fields per declared entity type (ADR-104) |
| `PUT /orgs/{organizationId}/me/approval-pin` | member with `iam.approval.grant` | | `ApprovalPinSetRequest { currentPassword, pin }` → `204`; re-checks the account password (ADR-121) |
| `DELETE /orgs/{organizationId}/me/approval-pin` | member with `iam.approval.grant` | | removes the caller's PIN |
| `GET /orgs/{organizationId}/approvers?locationId=` | any member | | `ApproverSummary[]` who hold `iam.approval.grant` at that location |
| `POST /orgs/{organizationId}/approvals` | any member (approver's PIN) | | `ApprovalGrantRequest { action, subjectKey, amount?, locationId, approverMemberId, pin }` → `ApprovalGrantResponse`; rate-limited per IP and organization (ADR-121) |
| `GET /invitations/{token}` · `POST /invitations/{token}/accept` | public (rate limited per IP) / user | | the preview returns `InvitationPreviewResponse` (organization name, inviter, masked identifier); accept answers `MyOrganizationSummary`. The token is a random secret, masked in logs. An unknown, expired, revoked or used token is 404; a signed-in user whose email or phone differs from the invited one gets 403 `errors.invitation_identifier_mismatch` (ADR-092) |

## 5. Tenant endpoints (prefix `/api/v1/orgs/{organizationId}`)

Permissions are from `10 §7` + `11` additions. `L` = location-scoped (supports `?location=`, writes need an allowed `locationId`).

### 5.1 organization, iam, settings, custom-field, audit, file
| Method & path | Permission | Flags | Contract / notes |
|---|---|---|---|
| `GET /profile` · `PATCH /profile` | `organization.profile.update` (PATCH) | | `OrganizationProfile…`; PATCH needs the permission at ALL locations (else `403`); optional fields: a value sets, `null` clears, an absent key leaves it unchanged, required fields reject `null` (`400`); `customFields` (ADR-107): the response carries the values of the organization's effective fields, sensitive ones only for a caller holding `organization.profile.update` at ALL locations; the body takes `customFields` with the same set, `null` clears and absent keeps rules, checked against the organization's fields (`400` at `customFields.<key>`), a sensitive value is never written to the audit log (`[redacted]`); `branding` (card 3.12, ADR-114): the response carries `branding` (`logoFileId?`, `logoUrl?` the public `medium` path, `primaryColor?`, `accentColor?`, `tagline?`), the body takes `branding` with the same set, `null` clears and absent keeps rules; colours `#RRGGBB` (stored lower-case), the primary 4.5:1 and the accent 3:1 against white or `400` at `branding.<key>` with `validation.color_low_contrast`, tagline 1 to 80 characters, `logoFileId` an active LOGO file of this organization or `400` with `errors.file_reference_invalid`; the audit entry names each `branding.<key>` that changed |
| `GET /locations` · `POST /locations` · `PATCH /locations/{locationId}` · `POST /locations/{locationId}/archive` | `organization.location.*` | I (POST) | archive refused with stock/open requests (`BUSINESS_RULE`); PATCH: optional fields (address, phone, timezone) take `null` to clear, required ones reject it (`400`) |
| `GET /members` · `GET /members/{memberId}` · `PATCH /members/{memberId}` · `POST /members/{memberId}/suspend` · `POST /members/{memberId}/reactivate` · `POST /members/{memberId}/remove` | `organization.member.*` (`remove` for remove, `update` for the rest) | | list, read and every change are limited to members whose assignments all lie within the caller's locations for that permission (outside: `404`), and new assignments must lie within them too (`422 ROLE_NOT_GRANTABLE`); assignments edit via PATCH under the rules of ADR-092; `customFields` (ADR-107): `GET /members/{memberId}` and the PATCH answer carry the member's values (the list never does), sensitive ones only for a caller holding `organization.member.readSensitive` at ALL locations, the PATCH body takes `customFields` under the same rules as the profile, editing only custom fields needs `organization.member.update` for that member's reach |
| `POST /invitations` · `GET /invitations` · `POST /invitations/{invitationId}/revoke` | `organization.member.invite` | I (POST) | lists and revokes only invitations within the caller's locations (outside: 404; roles above the caller: `422 ROLE_NOT_GRANTABLE`); a member who loses access (suspend, remove, assignments changed) takes their pending invitations with them; the create response carries `inviteUrlPath` once; a replay of the same key returns the invitation without it (ADR-092) |
| `POST /ownership/transfer` | `organization.ownership.transfer` | A | target must be an active member |
| `GET /roles` · `POST /roles` · `PATCH /roles/{roleId}` · `POST /roles/{roleId}/archive` | `iam.role.*` | | system roles read-only; writes need the permission at ALL locations and every key added or removed held by the caller at ALL (`422 ROLE_NOT_GRANTABLE`, `details.permissionKeys`) |
| `GET /settings?keys=&location=` · `PATCH /settings` | `settings.setting.read` / `settings.setting.update` | | keyed read (at most 100 keys; omitted keys means every effective setting), sorted by key. PATCH is one batch of at most 50 `{ settingKey, value, locationId?, version? }`. `value: null` deletes the stored row. An organization-level item needs the permission at every location; a location item needs it at that location (`403`). A location on a key that cannot vary by location is `422` `SETTING_NOT_LOCATION_SCOPED`. A missing or stale version is `409` with `currentVersion`. An unknown or ineffective key is `404` `errors.setting_not_available`. The answer is the resolved values of the touched keys (ADR-103); both answers also carry `definitions` per returned key: `{ value: SettingValueSpec, allowsLocationOverride }` (ADR-108) |
| `GET /terms` · `PATCH /terms` | `settings.setting.read` / `settings.term.update` | | keyed read of every template term key (not a page), ordered by key: `{ termKey, bn, en }` each with `text`, `source` (`INDUSTRY` or `ORGANIZATION`) and `version` when the organization owns that language. PATCH needs the permission at every location and takes at most 50 `{ termKey, locale, text, version? }`. `text: null` deletes the override. An unknown key is `404` `errors.term_not_available`. A missing or stale version is `409` with `currentVersion`. A batch that changes nothing writes nothing (ADR-104) |
| `GET /modules` · `POST /modules/{moduleKey}/disable` · `POST /modules/{moduleKey}/enable` | `settings.setting.read` / `settings.module.update` | | paged catalogue of CORE and OPTIONAL modules the package and template offer (`page`, `limit`, `hasNext`). Disable and enable need the permission at every location and a `reason` (1 to 200). A module the tenant cannot disable, or one not in the catalogue, is `422` `MODULE_NOT_TENANT_DISABLABLE`. Disabling one that an effective module depends on is `422` `MODULE_REQUIRED_BY` with `details.requiredBy`. Already in that state is 200 with no write (ADR-104) |
| `GET /custom-fields?entityType=&offeringKind=&page=&limit=` · `POST /custom-fields` · `PATCH /custom-fields/{customFieldDefinitionId}` · `POST /custom-fields/{customFieldDefinitionId}/archive` · `PATCH /custom-fields/preferences` | `custom-field.definition.*` | | effective list: industry fields (read-only) then active organization fields; an entity no effective module declares is `404`; writes need the permission at ALL locations; duplicate key `409`; 51st active organization field `422 CUSTOM_FIELD_LIMIT`; hiding a required industry field `422 CUSTOM_FIELD_REQUIRED`; an organization contact field may carry `appliesToContactRoles` (create, and update where `null` goes back to every role), on any other entity `400`; the effective field carries it too (`/me/config.fields.contact`), and `/me/config.contactRoleKeys` lists the template's roles (ADR-113); the list also returns template fields the business hid, marked `isHidden: true`, so they can be shown again with `PATCH /custom-fields/preferences` (`isHidden: false`) (ADR-108); `/me/config.fields` never carries them |
| `GET /audit-logs` | `audit.log.read` | | needs the permission at ALL locations (else `403`); filters: entityType, entityId, actor, date |
| `POST /files` (multipart: field `purpose`, then one `file`) | `file.asset.create` | | `201 FileAssetResponse`. Type is read from the content (JPEG, PNG, WebP up to 8 MB; PDF up to 10 MB for `CUSTOM_FIELD_FILE` and `ATTACHMENT` only), SVG and HTML are `415`, too large `413`, a second file or an unknown purpose `400`, over the organization quota `422 FILE_QUOTA_EXCEEDED`. Images are re-encoded to WebP `thumb`, `medium` and `large` without metadata. `Idempotency-Key` is optional (no money or stock) |
| `GET /files/{fileId}` | `file.asset.read` | | `FileAssetResponse` (`url` only for PUBLIC files); another organization's id is `404` |
| `GET /files/{fileId}/content?variant=` | `file.asset.read` | | streams the bytes with `nosniff`, `Cache-Control: private`; PDFs are `Content-Disposition: attachment` |
| `DELETE /files/{fileId}` | `file.asset.delete` | | `204`; marks DELETED, removes the stored objects, gives the bytes back to the quota. A field that still names the file is the caller's problem until reference tracking exists |

`GET /api/v1/public/files/{fileId}/{variant}` (outside the tenant pipeline, no session) serves only PUBLIC, ACTIVE files (logos, offering images) with a long cache and `nosniff`. A PRIVATE, deleted or unknown id is `404`, never `403`.

### 5.2 contact
| Method & path | Permission | Flags | Notes |
|---|---|---|---|
| `GET /contacts` · `GET /contacts/{contactId}` | `contact.contact.read` | | `?q=&role=&tag=&status=&page=&limit=` (`role=RELATED` lists guardians and similar contacts); `q` = name prefix (Bangla-folded), phone in any typed form, or a searchable custom field value. Detail shows sensitive custom fields only with `contact.contact.readSensitive` (ADR-110) |
| `POST /contacts` | `contact.contact.create` | I | dedupe: `409 CONFLICT` `errors.contact_duplicate` with `details.contactId` of the existing contact (ADR-110). A contact-link custom field may carry `{ create: { name, phone } }`; the linked contact is created as `RELATED`. `contactRoles` must be in the template's list (`400` at `contactRoles`); a custom field limited to other roles is not required and a value for it is `400` `validation.not_applicable` at `customFields.<key>` (ADR-113) |
| `PATCH /contacts/{contactId}` · `POST /contacts/{contactId}/archive` | `contact.contact.update/archive` | | body has `version`; a sensitive custom field key without `readSensitive` is `403` |
| `POST /contacts/{contactId}/merge` | `contact.contact.merge` | I | `{ mergeIntoContactId }` |
| `POST /contacts/{contactId}/anonymize` | `contact.contact.anonymize` | A | `{ version, reason }`; irreversible (ADR-110) |
| `POST /contacts/import` · `GET /contacts/import/{importJobId}` | `contact.contact.create` | I | async job: upload → preview rows → commit |
| `GET /contacts/{contactId}/store-credit` | `payment.storeCredit.read` | | balance + entries |

### 5.3 catalog, inventory, pricing
| Method & path | Permission | Flags | Notes |
|---|---|---|---|
| `GET /offerings` · `GET /offerings/{offeringId}` | `catalog.offering.read` | | `?q=&kind=&status=&categoryId=&location=&page=&limit=`; without `status`: DRAFT and ACTIVE. Lean rows `{ offeringId, kind, name, slug, status, firstImageUrl, priceFrom, variantCount, categoryIds, isAvailable (with `location`), updatedAt }`. `q` = folded name prefix, offering synonyms, organization synonyms (both ways), exact SKU, exact barcode |
| `POST /offerings` · `PATCH /offerings/{offeringId}` | `catalog.offering.create/update` | I (POST) | kind-specific `kindDetails` validated per kind (a field of another kind is `400`); `variants` is the full list (ids kept, a missing one archived); no `variants` + `price` (+ `unitKey`) = one "Default" variant; `kind` is not editable; `409` for a taken SKU (`details.offeringId`) or slug; `422 LIMIT_REACHED` past the package limit; `422 STOCK_COMPONENTS_NEED_INVENTORY` for any stock component until card 3.3 |
| `POST /offerings/{offeringId}/publish` · `/archive` | `catalog.offering.publish/archive` | | body `{ version }`; DRAFT → ACTIVE (`11`, ADR-026), publishing an ACTIVE one is `200` with no write |
| `GET /offerings/{offeringId}/locations` | `catalog.offering.read` | | `?locationId=&page=&limit=` (limit ≤ 100); the per-location rows `{ offeringId, variantId (null = offering-wide), locationId, isAvailable, priceOverride }` of the locations the caller reaches; a `locationId` outside the reach is `403`; the editor asks one location at a time (card 3.2b) |
| `PUT` · `DELETE /offerings/{offeringId}/locations/{locationId}` | `catalog.offering.update` | L | body `{ variantId?, isAvailable, priceOverride? }`; a price override needs `variantId`; `DELETE ?variantId=` returns to the defaults (`204`); a location outside the caller's reach is `403` |
| `GET/POST/PATCH /categories[/{categoryId}]` · `POST /categories/{categoryId}/archive` | `catalog.category.*` | | flat list sorted by `sortOrder`; at most 3 levels, no cycle; archive refused (`422 CATEGORY_IN_USE` with counts) while ACTIVE offerings or child categories use it |
| `GET/POST/PATCH /modifier-groups[/{modifierGroupId}]` · `POST /modifier-groups/{modifierGroupId}/archive` | `catalog.modifierGroup.*` | | ADR-072; `options` is the full list on PATCH (a missing option is archived) |
| `GET/PUT /catalog/synonyms` | read: `catalog.offering.read`; `PUT`: `catalog.synonym.update` | | `{ entries[{ term, synonyms[] }], version }` (at most 200 terms; `version` 0 when none yet; `409` when stale) |
| `POST /offerings/import` · `GET /offerings/import/{importJobId}` · `POST /offerings/import/{importJobId}/commit` | `catalog.offering.create` | I | CSV/Excel/photo/PDF → drafts → review → commit (card 5.11) |
| `GET/POST /inventory-items` · `GET/PATCH /inventory-items/{inventoryItemId}` · `POST …/archive` | read: `inventory.stock.read`; writes: `inventory.item.update` | I (POST) | list `?q=&status=&page=&limit` (≤ 100); archive refused while on-hand anywhere (`422 INVENTORY_ITEM_HAS_STOCK`) or an ACTIVE variant lists it (`422 INVENTORY_ITEM_IN_USE`) (ADR-125) |
| `GET /stock/levels?locationId=&q=&lowOnly=&page=&limit=` | `inventory.stock.read` | L | on hand, reserved, damaged, available, average cost, low badge |
| `GET /stock/movements?inventoryItemId=&locationId=&from=&to=&page=&limit=` | `inventory.movement.read` | L | index `{ organizationId, locationId, inventoryItemId, occurredAt }` |
| `POST /stock/receipts` | `inventory.adjustment.create` | I L | lines with quantity + unit cost → PURCHASE movements + moving average (ADR-069, ADR-125) |
| `POST /stock/adjustments` | `inventory.adjustment.create` | I L A* | `ADJUSTMENT` or `DAMAGE_WRITE_OFF`; large negative above `inventory.adjustment.approvalAbove` needs approval token (`STOCK_ADJUSTMENT`) |
| `POST /stock/transfers` | `inventory.transfer.create` | I L | one-step: TRANSFER_OUT + TRANSFER_IN in one transaction at the source average cost; both locations in the caller's reach (ADR-125) |
| `GET /offerings/{offeringId}/availability?locationId=` | `inventory.stock.read` | L | per variant `floor(available / quantity)` over stock components |
| `POST /inventory/levels/rebuild` | `inventory.item.update` at ALL locations | | `{ locationId?, fix }` (default report-only); rate-limited 1/org/minute; never touches movements (ADR-125) |
| `GET/POST/PATCH /promotions[/{promotionId}]` · `POST /promotions/{promotionId}/archive` | `pricing.promotion.{read,create,update,archive}` | I* | create needs Idempotency-Key; list filter `?status=`; activate via PATCH `status` |
| `GET /tax-classes` · `GET /tax-classes/{taxClassId}` | `catalog.offering.read` | | ACTIVE by default; `?status=` for archived (catalog editor and quote screens) |
| `POST/PATCH /tax-classes[/{taxClassId}]` · `POST /tax-classes/{taxClassId}/archive` | `pricing.taxClass.update` | I* | create needs Idempotency-Key; OWNER/MANAGER; not in `/me/config` |
| `POST /quotes` | `catalog.offering.read` | | `QuoteRequest` → priced lines (`11 §3` / ADR-120); unknown/archived tax class → `422 TAX_CLASS_UNKNOWN`; read-only |

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
| `GET /expenses` · `POST /expenses` · `POST /expenses/{expenseId}/void` | `expense.expense.*` | I L A* (void) | card 3.8c |
| `GET/POST/PATCH /expense-categories[/{expenseCategoryId}]` | `expense.category.update` (reads with `expense.expense.read`) | | card 3.8c |
| `GET /accounting/accounts` · `GET /accounting/journal` · `GET /accounting/trial-balance?asOf=` | `accounting.ledger.read` | | card 3.8c; no writes (manual entries are 3.8b) |
| `GET /bookkeeping/accounts` · `POST /bookkeeping/accounts` · `PATCH /bookkeeping/accounts/{accountId}` | `bookkeeping.account.*` | | 3.8b; list `page/limit` (≤100), optional `accountId` lookup, type/code order with balances; version-checked rename, custom-account archive; system code/type fixed |
| `GET /bookkeeping/journal` · `POST /bookkeeping/journal/manual` · `POST /bookkeeping/journal/{journalEntryId}/reverse` | `bookkeeping.journal.read` / `bookkeeping.journal.createManual` | I A (manual, reverse) | 3.8b; journal filters `from/to/sourceType/accountId/page/limit`; manual body `{businessDate, locationId?, memo, lines, approvalToken?}`; reverse `{businessDate, approvalToken?}` |
| `GET /bookkeeping/trial-balance?asOf=` · `GET /bookkeeping/statements/profit-and-loss?from=&to=&locationId=` · `GET /bookkeeping/statements/balance-sheet?asOf=` | `bookkeeping.statement.read` | | 3.8b; retained earnings = income − expense through asOf; organization-wide reads require ALL-location grants |
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
| `GET /api/v1/storefront/resolve?host=` | public | rate | `<slug>.<STOREFRONT_BASE_DOMAIN>` → `{ organizationId }` (ADR-119; `siteVersion` comes with the site cards) |
| `GET /site` · `GET /pages/{pageSlug}` | public | cache | published version only |
| `GET /offerings?category=&q=&kind=` · `GET /offerings/{offeringSlug}` · `GET /categories` | public | cache | ACTIVE offerings, storefront-visible fields only |
| `GET /availability?offeringSlug=&from=&to=` | public | | |
| `POST /quotes` | public | | server pricing (manoxen `resolve-public-order-line-items` rule: never trust client prices) |
| `POST /auth/otp/send` | public | rate | `{ phone }` → always `202 { expiresInSeconds }`; 3 per phone per 15 min, 10 per address per hour (ADR-119) |
| `POST /auth/otp/verify` | public | rate | `{ phone, code }` → sets `sf_access` and `sf_refresh`, returns `StorefrontMeResponse`; wrong, expired or used code `400 errors.otp_invalid`; blocked `403`; 20 per address per hour |
| `POST /auth/refresh` · `POST /auth/logout` | refresh cookie | | rotate the session; end it |
| `GET /me` | customer | | `StorefrontMeResponse` |
| `GET /my/listing` · `PUT /my/listing` · `POST /my/listing/submit` · `DELETE /my/listing` | customer | | own listing (all tiers); create/replace draft data; submit with consents; archive (ADR-127) |
| `POST /my/listing/photos` | customer | | multipart upload, purpose `LISTING_PHOTO`; refused when `directory.photoPolicy` is `NONE` |
| `GET /listings` · `GET /listings/{listingNumber}` | public / optional customer | rate | APPROVED only; PUBLIC fields always, MEMBERS when signed in; filters `f.<fieldKey>…`; UNLOCKED only for the account that unlocked it (ADR-130); PRIVATE never |
| `POST /listings/{listingNumber}/unlock` | customer | rate I | spends `credit.unlockCost`; idempotent per account and listing; `Idempotency-Key` header required; 422 when the balance is short, 429 at the daily limit, 400 for the customer's own listing |
| `GET /my/credits` · `GET /my/unlocks` | customer | | balance with paged entries / unlocked listings with their UNLOCKED fields, paged |
| `GET /credit-packs` | public / optional customer | cache | ACTIVE packs only (sold in M.5) |

Staff (tenant, module `directory`, permissions `directory.listing.{read,review,hide}`):

| Method & path | Permission | Notes |
|---|---|---|
| `GET /directory/config` | read | template `directory` block for screens: `sections`, `rejectionReasons` (with `isFinal`), `consents` (ADR-129); empty arrays when the template has no block |
| `GET /directory/queue?status=&page&limit` | read | review queue; default SUBMITTED, oldest first; `total` for the menu badge |
| `GET /directory/listings?status=&listingNumber=&from=&to=&page&limit` | read | all listings; limit ≤ 50; newest first by `submittedAt` (or `publishedAt` when status is APPROVED); rows carry first-section PUBLIC fields only and `editedAfterApproval` (ADR-129) |
| `GET /directory/listings/{listingId}` | read | every tier (staff projection); rejection checklist comes from config, not this body |
| `POST …/approve` · `…/reject` | review | body includes `version`; reject needs `reasonKeys` from the template |
| `POST …/hide` · `…/unhide` | hide | published listings only |
Staff (tenant, module `credit`): `GET/POST /credit/packs`, `PATCH /credit/packs/{creditPackId}`, `POST …/archive` with `credit.pack.{read,update}` (writes carry `Idempotency-Key`); `GET /credit/accounts/{customerAccountId}` (`credit.account.read`); `POST …/adjust` (`credit.account.adjust`, `Idempotency-Key`, approval token unless OWNER). `GET /directory/listings/{listingId}/unlock-count` returns a count only (`directory.listing.read`, ADR-130).

Every customer route answers `404 errors.storefront_not_available` while the business has `contact.customerLogin` off.
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
| Failed events (card 3.8a, ADR-115) | `GET /platform/event-dead-letters` (paged, optional `status` FAILED/REPLAY_REQUESTED/REPLAYED/SKIPPED; `platform.events.read`), `POST …/{eventDeadLetterId}/replay` (`platform.events.replay`, SUPER_ADMIN; `422 EVENT_DEAD_LETTER_NOT_FAILED` when it is not FAILED any more), `POST …/{eventDeadLetterId}/skip` (body `reason`, required; `422 EVENT_STREAM_NOT_AT_EVENT` when earlier events of an ORDERED stream are unhandled), `GET /platform/dead-outbox-events` (paged) and `POST …/{eventId}/replay` (`422 OUTBOX_EVENT_NOT_DEAD`). Every action is audited |
| Industry templates | `GET /platform/industry-templates` (paged, optional `status`, ordered by key) and `GET …/{industryTemplateId}` (`platform.industry.read`: SUPER_ADMIN, SUPPORT, BILLING). Writes (`platform.industry.write`, SUPER_ADMIN, mandatory `reason`): `POST /platform/industry-templates` (201 DRAFT, or clone any status), `PATCH …/{industryTemplateId}` (`version`; 409 when stale), `POST …/publish`, `POST …/retire`, and `POST /platform/organizations/{organizationId}/change-industry-template` (ADR-101). Every detail answer carries `isInUse`: true when an organization already uses the template key (card 3.13, ADR-112) |
| Website templates | CRUD `/platform/website-templates[/{websiteTemplateId}]`, `POST …/publish` |
| Operators | `GET /platform/operators` (optional `status`), `GET /platform/operators/{platformOperatorId}`, `POST /platform/operators` `{ identifier, platformRoles, reason }`, `PATCH …/{platformOperatorId}` `{ platformRoles, version, reason }`, `POST …/disable` and `POST …/enable` `{ version, reason }`. SUPER_ADMIN only. No delete: disable keeps the row. |
| Health & ops | `GET /platform/system/health`, `GET /platform/system/queues`, `GET /platform/system/errors` |

Details built in card 1.8a (ADR-093):
- Cookies `platform_access_token` and `platform_refresh_token`; login gives the same `401 errors.invalid_credentials` to a non-operator. `GET /platform/audit-logs?targetType=&organizationId=&actorPlatformOperatorId=&from=&to=` (permission `platform.audit.read`, SUPER_ADMIN only).
- Packages carry `nameKey` (seed) or `name` (operator-made, 2 to 60 characters, required on create, changeable only for operator-made ones); the response has both, one null.
- `suspend`, `reactivate`, `extend-trial` take a mandatory `reason`; module overrides take `{ moduleKey, effect PLATFORM_GRANT|PLATFORM_REVOKE, reason, expiresAt? }`; package `PATCH` and `…/archive` carry `version` (409 when stale).
- Business-rule keys (`422 BUSINESS_RULE` `details.ruleKey`): `PACKAGE_NOT_CLOSED`, `PACKAGE_IN_USE`, `MODULE_NOT_REGISTERED`, `MODULE_CLASS_FIXED`, `TRIAL_NOT_ACTIVE`, `PACKAGE_KIND_MISMATCH`. The tenant list rows carry `templateKey`, `subscriptionStatus` and `memberCount`; the detail masks the owner identifier.
- `GET /platform/setting-definitions` (`platform.industry.read`, card 2.6, ADR-106) lists every setting on a registered manifest, ordered by key. It is a keyed read of the code registry, not a page. A create or PATCH whose registered `settingsDefaults` fail their specs is `422 INDUSTRY_TEMPLATE_SETTING_INVALID` with `details.settingKeys`. Keys no module has registered stay allowed and are returned on the template detail as `pendingSettingKeys` (computed, not stored).
- Industry template writes (card 2.1b, ADR-101): a taken key is `409 errors.industry_template_key_taken`. A locked template (published, retired, or a draft an organization already uses) refuses a removal with `422 INDUSTRY_TEMPLATE_CHANGE_NOT_ADDITIVE` and `details.removed`. Publish accepts DRAFT or RETIRED; retire accepts PUBLISHED; the same status is 200 with no audit; anything else is `422 INDUSTRY_TEMPLATE_STATUS_INVALID`. Changing an organization's template: an unknown key is 404, a RETIRED target is `422 INDUSTRY_TEMPLATE_STATUS_INVALID`, a target that drops a kind or module is `422 INDUSTRY_TEMPLATE_CHANGE_NOT_ADDITIVE`, and the same key is 200 with no audit. A configuration edit is audited as `{ configuration: { to: true } }`. Signup and retire of the same template cannot both commit: the signup transaction reserves the published row (`referenceVersion`).

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
