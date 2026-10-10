# Module Catalog & Packages

Card D2 · Status: **approved by owner 2026-10-09** · Written 2026-10-09 · Based on commit `f80d9ef`

This doc fixes every module the product will have, what each one declares in its manifest, how packages are built from modules, and how `resolveOrgConfig` decides what an organization gets. Card 1.6 implements the registry and resolver from this doc. Every later card adds its module's real manifest by copying its row here and filling the details. If a card needs a new module, permission, setting key, bot tool, section or event that is not here, the PLAN session adds it here first.

Inputs: `07` (capability model), `09` (entities, ownership map §6, config entities §4.6), `06`, `08`, `02`, `00` (packaging), ADR-030 to ADR-048. Owner answers are recorded in §12 (ADR-050, ADR-051). New decisions: §12 (ADR-049 to ADR-054).

---

## 1. Module classes

Every module has exactly one class. The class decides how the resolver treats it.

| Class | Meaning | In packages? | Tenant can disable? | Template can exclude? | Examples |
|---|---|---|---|---|---|
| `PLATFORM` | Serves the platform panel only. Never part of an org's config. | No | No | No | `industry`, `package`, `entitlement`, `saas-billing`, `tenant-admin` |
| `SYSTEM` | Infrastructure every org needs to work. Always on. | No (implicit) | No | No | `iam`, `organization`, `settings`, `audit`, `accounting` |
| `CORE` | Business basics every base package includes. | Yes: every base package must contain all CORE modules (validated on save) | No | Yes (via `allowedModuleKeys` and kinds) | `contact`, `catalog`, `sales`, `booking`, `expense` |
| `OPTIONAL` | Sold through a package or add-on, or granted by the platform. | Yes | Only if the manifest says `tenantCanDisable: true` | Yes | `pos`, `website`, `bot`, `bookkeeping` |

Why CORE is a class and not just "a module that is in every package": a new base package can never forget a basic module, and the generated tests can assert that.

## 2. Manifest schema (final shape for card 1.6)

```ts
type ModuleClass = "PLATFORM" | "SYSTEM" | "CORE" | "OPTIONAL";
type Surface = "ADMIN" | "POS" | "RIDER" | "PLATFORM" | "STOREFRONT";

interface ModuleManifest {
  key: ModuleKey;                         // contracts MODULE_KEYS, kebab-case
  path: string;                           // "commerce/sales"
  moduleClass: ModuleClass;
  dependsOn: ModuleKey[];                 // must all be effective, or this module is dropped
  providesKinds: OfferingKind[];          // kinds this module makes sellable
  requiresAnyKind: OfferingKind[];        // dropped unless one of these kinds is effective ([] = no requirement)
  tenantCanDisable: boolean;              // OPTIONAL only
  permissions: PermissionDefinition[];    // { permissionKey, labelKey, isSensitive?, surface }
  routes: { admin?: string[]; storefront?: string[]; platform?: string[]; webhook?: string[] };
  menu: MenuEntry[];                      // see §6
  settingKeys: SettingKey[];              // definitions live in the module, registered via the manifest
  customFieldEntities: EntityType[];      // entityType values that accept custom fields
  botTools: BotToolKey[];
  storefrontSections: SectionKey[];
  events: { emits: EventType[]; consumes: EventType[] };
  limitKeys: LimitKey[];                  // limits this module enforces
  sequenceKeys: SequenceKey[];            // document number sequences it uses
}
```

Rules:
- The manifest is the **only** place these lists live. The API gate, menu, bot tool list, storefront section catalog, settings registry, custom-field entity registry and permission catalog are all built from manifests at startup.
- `registryHash` = hash of all manifests. It is part of the resolver cache key, so a deploy that changes a manifest invalidates every cached config.
- Event consumers of a module run for an org only when the module is effective for that org. SYSTEM modules always consume. This is why ledger posting lives in the SYSTEM module `accounting` (ADR-051).
- PLATFORM modules declare only `platform` routes and `PLATFORM` menu entries.
- `routes.*` entries are full v1 paths (`/orgs/:organizationId/roles`, `/me/orgs`); a `:param` matches one path segment and the longest matching prefix owns a request path (ADR-091).

## 3. Resolver (`resolveOrgConfig`, owned by `platform/entitlement`)

Inputs: the org's `PlatformSubscription`, its base and add-on `Package`s, its `ModuleOverride`s, its `IndustryTemplate`, the manifest registry, and org/location settings and terms.

```
1. purchased   = modules(basePackage) ∪ modules(addOns) ∪ PLATFORM_GRANT
                 − PLATFORM_REVOKE − TENANT_DISABLE (only where tenantCanDisable)
2. candidates  = SYSTEM ∪ ((CORE ∪ purchased) ∩ template.allowedModuleKeys)
3. kinds       = template.enabledKinds ∩ ⋃ providesKinds(candidates)
4. drop every module whose requiresAnyKind is non-empty and does not intersect kinds
5. repeat until stable: drop every module with a dependsOn key that is not in the set
   (log config.module.droppedMissingDependency; never auto-enable a paid module)
6. limits      = basePackage.limits + Σ addOn.limitIncrements   (null = unlimited and wins)
7. accessMode  = from subscription status (§8)
8. menu, botTools, storefrontSections, settings, fields, terms = from the manifests of the
   final set, filtered by kinds; menu and tools are filtered again per user by permission
```

- Output `ResolvedOrgConfig`: `{ organizationId, configVersion, registryHash, accessMode, modules, kinds, limits, menu, botTools, storefrontSections, settings, fields, terms }` (adds `registryHash` and `accessMode` to `09 §4.6`).
- Cache key: `org:{organizationId}:config:{configVersion}:{registryHash}:{packageVersions}:{templateVersion}`. Editing a package or a template therefore changes the key for every org that uses it, without a fan-out job.
- Platform invariant on save (not at resolve time): a base package's modules, plus SYSTEM and CORE, must be closed under `dependsOn`. A package that would ship a module without its dependency cannot be saved.

## 4. Module groups (folder paths)

| Group | Contains | Note |
|---|---|---|
| `platform/` | Platform panel modules + `ai` | |
| `core/` | Identity, organization, configuration, audit, files, notifications | |
| `commerce/` | Selling, money, stock, people the business deals with | |
| `channel/` | Customer-facing channels: website, messaging inbox, bot, social | New group (ADR-052). Replaces "integration/channel" and "integration/inbox" in `09 §5.7`. |
| `integration/` | Third-party providers with their own business records | courier, sms, payment-gateway |
| `automation/` | Workflow engine, risk scoring | |
| `capability/` | Optional industry behaviours reusable by any template | Phase 7 |

## 5. The catalog

`Card` = where the module is first built. Kinds: P = PRODUCT, S = SERVICE, L = PLAN, R = RENTAL, E = EVENT.

| Key | Path | Class | Card | dependsOn | Provides kinds | Requires any kind | Tenant can disable | Owns (from `09 §6`) |
|---|---|---|---|---|---|---|---|---|
| `industry` | platform/industry | PLATFORM | 2.1 | `package` | | | | IndustryTemplate |
| `package` | platform/package | PLATFORM | 1.6 | | | | | Package |
| `entitlement` | platform/entitlement | PLATFORM | 1.6 | `package` | | | | ModuleOverride, resolver |
| `saas-billing` | platform/saas-billing | PLATFORM | 1.6 / 6.2 | `package` | | | | PlatformSubscription, platform invoices |
| `tenant-admin` | platform/tenant-admin | PLATFORM | 1.8 | `organization` | | | | — (uses other modules' APIs) |
| `ai` | platform/ai | SYSTEM | 5.7 | | | | | — (LLM gateway, no routes, no menu) |
| `iam` | core/iam | SYSTEM | 1.1 / 1.4 | | | | | User, RefreshSession, PlatformOperator, Role |
| `organization` | core/organization | SYSTEM | 1.2 | `iam` | | | | Organization, slug history, Location, Member, Invitation |
| `custom-field` | core/custom-field | SYSTEM | 2.3 | | | | | CustomFieldDefinition |
| `settings` | core/settings | SYSTEM | 2.4 | | | | | SettingValue, TermOverride |
| `audit` | core/audit | SYSTEM | 1.5 | | | | | AuditLog |
| `file` | core/file | SYSTEM | 3.2 | | | | | FileAsset |
| `notification` | core/notification | SYSTEM | 5.13 | | | | | in-app notifications, email sending |
| `accounting` | commerce/accounting | SYSTEM | 3.8 | | | | | Account, JournalEntry (posting engine, no menu) |
| `contact` | commerce/contact | CORE | 3.1 | | | | | Contact, CustomerAccount, CustomerSession |
| `catalog` | commerce/catalog | CORE | 3.2 | `file` | P | | | Offering, OfferingLocation, Category, SearchSynonym, OfferingSocialLink |
| `inventory` | commerce/inventory | CORE | 3.3 | `catalog` | | P | | StockMovement, InventoryLevel |
| `pricing` | commerce/pricing | CORE | 3.4 | `catalog` | | | | Promotion, TaxClass (defined in card 3.4) |
| `sales` | commerce/sales | CORE | 3.5 | `catalog`, `contact`, `pricing` | | | | Order |
| `booking` | commerce/booking | CORE | 3.6 | `catalog`, `contact`, `pricing` | S, R, E | | | Resource, ResourceTimeOff, Booking |
| `enrollment` | commerce/enrollment | CORE | 3.7 | `catalog`, `contact`, `pricing` | L | | | Enrollment, CheckIn |
| `payment` | commerce/payment | CORE | 3.8 | `contact` | | | | Payment |
| `expense` | commerce/expense | CORE | 3.8 | | | | | Expense, ExpenseCategory (added to `09` by this card) |
| `report` | commerce/report | CORE | 3.10 | | | | | daily summaries (projections) |
| `delivery` | commerce/delivery | CORE | 5.3 | `sales` | | P | | rider assignments (own rider) |
| `courier` | integration/courier | CORE | 5.2 | `sales` | | P | yes | Consignment, courier credentials |
| `sms` | integration/sms | CORE | 5.13 | | | | | SMS log (usage-limited by `smsPerMonth`) |
| `risk` | automation/risk | CORE | 5.15 | `sales` | | P | yes | COD risk scores |
| `pos` | commerce/pos | OPTIONAL | 3.9 | `sales`, `payment` | | | no | POS devices, shifts, registers, Z-reports |
| `bookkeeping` | commerce/bookkeeping | OPTIONAL | 3.8b | | | | no | — (UI over `accounting`: chart of accounts, journals, manual entries, statements) |
| `website` | channel/website | OPTIONAL | 4.1–4.5 | `catalog`, `contact` | | | no | Site, Page, Theme, Domain, WebsiteTemplate (platform-scoped records) |
| `payment-gateway` | integration/payment-gateway | OPTIONAL | 5.17 (new) | `payment` | | | yes | gateway credentials, gateway transactions |
| `messaging` | channel/messaging | OPTIONAL | 5.4 / 5.5 / 5.12 | `contact` | | | no | Channel, Conversation, Message |
| `bot` | channel/bot | OPTIONAL | 5.6–5.9 | `messaging`, `catalog`, `ai` | | | yes | KnowledgeEntry (added to `09`), bot settings, eval runs |
| `social` | channel/social | OPTIONAL | 5.10 | `messaging`, `catalog` | | | yes | — (writes OfferingSocialLink through `catalog`) |
| `workflow` | automation/workflow | OPTIONAL | 5.14 | | | | yes | Workflow, WorkflowRun |
| `academic` | capability/academic | OPTIONAL | 7 | `enrollment` | | L | yes | exams, results |
| `clinical` | capability/clinical | OPTIONAL | 7 | `booking` | | S | yes | clinical notes, prescriptions |
| `kitchen-display` | capability/kitchen-display | OPTIONAL | 7 | `sales` | | P | yes | kitchen tickets |

Notes:
- `sales` provides no kind of its own: PRODUCT comes from `catalog`. Order lines may hold any effective kind (ADR-044).
- `courier`, `delivery`, `inventory`, `risk` need PRODUCT: a salon-only template never shows them.
- The website chat widget is a `messaging` channel type (`WEB_WIDGET`), not a module.
- `pricing` owns promotions and tax classes. These entities are named here and defined in `09` by card 3.4.

## 6. Menu, surfaces and labels

`MenuEntry = { menuKey, surface, groupKey, labelTermKey, path, iconKey, permissionKey, order, requiresKind?, visibility? }`. `visibility` is `ALWAYS` (default) or `MULTIPLE_ACTIVE_LOCATIONS`; `/me/config` evaluates it on the server (the location create and archive use cases bump `configVersion`), so the app never counts locations.

Admin groups (order): `home`, `sales`, `bookings`, `enrollments`, `catalog`, `contacts`, `inbox`, `website`, `money`, `reports`, `settings`. Labels come from terms (`term.contact.plural` → "Customers" / "Students" / "Patients"), never literals.

| Module | Menu entries (surface ADMIN unless noted) |
|---|---|
| `organization` | settings › Business profile, Locations (hidden while 1 location), Staff & roles |
| `settings` / `custom-field` | settings › Settings, Fields & forms |
| `contact` | contacts › Contacts (term) |
| `catalog` | catalog › Offerings (term), Categories |
| `inventory` | catalog › Stock, Transfers, Adjustments |
| `pricing` | catalog › Promotions |
| `sales` | sales › Orders (term) |
| `booking` | bookings › Calendar, Bookings (term), Resources (term) |
| `enrollment` | enrollments › Enrollments (term), Check-ins |
| `payment` | money › Payments, Dues |
| `expense` | money › Expenses |
| `bookkeeping` | money › Accounts, Journal, Statements |
| `report` | home › Dashboard; reports › Reports |
| `delivery` | sales › Deliveries · **RIDER** surface › My deliveries |
| `courier` | sales › Consignments; settings › Couriers |
| `pos` | **POS** surface (whole app); settings › POS devices |
| `website` | website › Site, Pages, Theme, Domain |
| `messaging` | inbox › Inbox; settings › Channels |
| `bot` | inbox › Bot, Knowledge |
| `social` | catalog › Import from Facebook |
| `workflow` | settings › Automations |
| `iam`, `audit` | settings › Activity log |
| PLATFORM modules | **PLATFORM** surface: Tenants, Packages, Industries, Fields, Billing |

Dashboard home is package-aware (ADR-032): the `report` module picks home widgets from the effective modules (inbox-first when `messaging` is on and `website`/`pos` are off, and so on). No package names in code.

## 7. Per-module manifest details

Permission keys follow `<moduleKey>.<entity>.<action>` (ADR-054). Standard actions: `read`, `create`, `update`, `archive`. Extra verbs are listed. `*` marks sensitive permissions (shown separately in the role editor).

| Module | Permissions | Settings keys (first set) | Custom-field entities | Bot tools | Storefront sections | Emits (consumes) | Limits | Sequences |
|---|---|---|---|---|---|---|---|---|
| `organization` | `organization.profile.update`, `organization.location.{read,create,update,archive}`, `organization.member.{read,invite,update,remove}`, `organization.member.readSensitive`*, `organization.ownership.transfer`* | `organization.defaultLocale`, `organization.sequenceFormats` | `organization`, `member` | — | `about`, `contact-info` | `organization.*` events of `09 §4` | `locations`, `members` | `MEMBER` |
| `iam` | `iam.role.{read,create,update,archive}` | `iam.sessionTimeoutMinutes` | — | — | — | `iam.*` | — | — |
| `settings` / `custom-field` | `settings.setting.{read,update}`, `settings.term.update`, `custom-field.definition.{read,create,update,archive}` | — | — | — | — | `settings.setting.changed`, `custom-field.definition.changed` | — | — |
| `audit` | `audit.log.read`* | `audit.retentionDays` | — | — | — | — | — | — |
| `contact` | `contact.contact.{read,create,update,archive,merge,export*,anonymize*}`, `contact.customerAccount.{read,block}` | `contact.dedupeOn` | `contact` | — | `customer-login`, `customer-account` | `contact.contact.{created,updated,merged,anonymized}` | — | — |
| `catalog` | `catalog.offering.{read,create,update,archive,publish}`, `catalog.category.{…}`, `catalog.modifierGroup.{read,create,update,archive}`, `catalog.synonym.update` | `catalog.defaultUnitKey`, `catalog.defaultStockTracked` | `offering`, `category` | `search_offerings`, `get_offering` | `offering-grid`, `category-strip`, `offering-detail`, `search` | `catalog.offering.{created,updated,published,archived,priceChanged}` | `offerings` | — |
| `inventory` | `inventory.stock.read`, `inventory.adjustment.create`, `inventory.transfer.create`, `inventory.movement.read` | `inventory.allowNegativeStock`, `inventory.lowStockDefault` | — | `check_stock` | (stock badge in `offering-detail`) | `inventory.stock.{changed,low}` (consumes `sales.order.*`) | — | `TRANSFER` |
| `pricing` | `pricing.promotion.{read,create,update,archive}`, `pricing.taxClass.update` | `pricing.taxInclusive`, `pricing.rounding` | — | `quote` | `promotions-banner` | `pricing.promotion.changed` | — | — |
| `sales` | `sales.order.{read,create,update,confirm,cancel,refund*,export*}`, `sales.order.discountOverride*` | `sales.autoConfirm`, `sales.fulfillmentLocationId`, `sales.deliveryCharges` | `order` | `create_request(ORDER)`, `get_request_status(ORDER)` | `cart`, `checkout`, `order-tracking` | `sales.order.{created,confirmed,cancelled,completed,returned}` | `ordersPerMonth` | `ORDER`, `INVOICE` |
| `booking` | `booking.booking.{read,create,update,reschedule,cancel}`, `booking.resource.{read,create,update,archive}` | `booking.slotStepMinutes`, `booking.minNoticeMinutes`, `booking.reminderLeadMinutes` | `booking`, `resource` | `check_availability`, `create_request(BOOKING)`, `get_request_status(BOOKING)` | `slot-picker`, `resource-list` | `booking.booking.{created,confirmed,rescheduled,cancelled,completed,noShow}` | — | `BOOKING` |
| `enrollment` | `enrollment.enrollment.{read,create,update,renew,cancel}`, `enrollment.checkIn.create` | `enrollment.graceDays`, `enrollment.renewalReminderDays` | `enrollment` | `get_plan_terms`, `create_request(ENROLLMENT)`, `get_request_status(ENROLLMENT)` | `plan-list`, `enroll-form` | `enrollment.enrollment.{created,renewed,expired,cancelled}`, `enrollment.checkIn.recorded` | — | `ENROLLMENT` |
| `payment` | `payment.payment.{read,receive,refund*}`, `payment.due.read` | `payment.methods` | — | — | (payment step in `checkout`) | `payment.payment.{received,refunded}` | — | `PAYMENT` |
| `expense` | `expense.expense.{read,create,void}`, `expense.category.update` | `expense.requireAttachmentAbove` | `expense` | — | — | `expense.expense.{posted,voided}` | — | `EXPENSE` |
| `accounting` (SYSTEM) | `accounting.ledger.read`* (used by `report` and `bookkeeping`) | `accounting.fiscalYearStart` | — | — | — | `accounting.journal.posted` (consumes `sales.*`, `payment.*`, `expense.*`, `inventory.*`) | — | `JOURNAL` |
| `bookkeeping` | `bookkeeping.account.{read,create,update}`, `bookkeeping.journal.{read,createManual*}`, `bookkeeping.statement.read` | — | — | — | — | — | — | — |
| `report` | `report.dashboard.read`, `report.sales.read`, `report.stock.read`, `report.profit.read`* | `report.dayCloseTime` | — | — | — | (consumes request, payment, expense, stock events) | — | — |
| `delivery` | `delivery.assignment.{read,assign}`, `delivery.assignment.complete` (rider), `delivery.cash.handover` | `delivery.codHandoverRequired` | — | — | — | `delivery.assignment.{assigned,delivered,failed}` | — | — |
| `courier` | `courier.consignment.{read,create,cancel}`, `courier.credential.update`* | `courier.autoBookOnConfirm`, `courier.defaultCourierKey` | — | — | — | `courier.consignment.{created,statusChanged}` (consumes `sales.order.confirmed`) | — | — |
| `sms` | `sms.log.read` | `sms.senderId` | — | — | — | — (consumes notification requests) | `smsPerMonth` | — |
| `risk` | `risk.score.read` | `risk.holdThreshold` | — | — | — | `risk.order.flagged` (consumes `sales.order.created`) | — | — |
| `pos` | `pos.session.open`, `pos.sale.create`, `pos.register.close`, `pos.device.manage`, `pos.priceOverride`* | `pos.receiptFooter`, `pos.requireShift` | — | — | — | `pos.register.closed` | `posDevices` | `ZREPORT` |
| `website` | `website.site.{read,update,publish}`, `website.domain.manage` | `website.seo`, `website.checkoutEnabled` | — | — | `hero`, `about`, `faq`, `testimonials`, `rich-text`, `contact-form`, `footer` | `website.site.published` | — | — |
| `payment-gateway` | `payment-gateway.credential.update`*, `payment-gateway.transaction.read` | `payment-gateway.provider` | — | — | (online payment option in `checkout`) | `payment-gateway.transaction.{succeeded,failed}` | — | — |
| `messaging` | `messaging.channel.{read,connect,disconnect}`, `messaging.conversation.{read,reply,assign}` | `messaging.businessHours`, `messaging.autoAssign` | — | `handoff` | `chat-widget` | `messaging.message.received`, `messaging.conversation.assigned` | `channels` | — |
| `bot` | `bot.settings.update`, `bot.knowledge.{read,create,update,archive}`, `bot.eval.run` | `bot.enabled`, `bot.tone`, `bot.languageMode`, `bot.autoConfirmOrders` | — | `get_policy` (+ hosts all tools in the agent loop) | — | `bot.turn.completed`, `bot.handoff.requested` (consumes `messaging.message.received`) | `aiMessagesPerMonth` | — |
| `social` | `social.post.import`, `social.post.publish` | `social.autoDraftFromPosts` | — | — | — | `social.post.imported` | — | — |
| `workflow` | `workflow.workflow.{read,create,update,archive}`, `workflow.run.read` | — | — | — | — | `workflow.run.completed` (consumes any allow-listed event) | `workflowRunsPerMonth` | — |
| PLATFORM modules | platform permissions are `platform.<module>.<action>` and are granted through `PlatformOperator.platformRoles` (ADR-048), never through org Roles | | | | | | | |

**Additions from D3** (`11-OFFERINGS-AND-REQUESTS.md`; cards copy them into the manifests):
- `sales`:
  - permissions `sales.return.{read,create,reverse*}`, `sales.approval.grant`*
  - settings `sales.draftExpiryHours`, `sales.placedAutoCancelHours`, `sales.usePacking`, `sales.customerCanCancel`, `sales.returnWindowDays`, `sales.advance.required`, `sales.advance.value`
  - events `sales.order.{drafted,placed,updated,packed,shipped,delivered,deliveryFailed,returnedToSender}`, `sales.return.{created,reversed}`
  - sequence `RETURN`
- `booking`:
  - permissions `booking.booking.checkIn`, `booking.eventSession.{read,create,update,cancel}`
  - settings `booking.holdMinutes`, `booking.requireApproval`, `booking.noShowAfterMinutes`, `booking.deposit.required`, `booking.deposit.value`, `booking.freeCancelHours`, `booking.lateCancelFee`, `booking.noShowFee`
  - events `booking.booking.{held,requested,checkedIn}`
- `enrollment`:
  - permissions `enrollment.enrollment.{freeze,refund*}`
  - settings `enrollment.requirePaymentToActivate`, `enrollment.blockCheckInWhenOverdue`, `enrollment.lockPriceOnRenewal`, `enrollment.refundPolicy`
  - events `enrollment.enrollment.{activated,frozen,unfrozen,overdue,completed}`, `enrollment.period.started`
- `payment`:
  - permissions `payment.payment.reverse*`, `payment.storeCredit.{read,adjust*}`
  - settings `payment.storeCreditExpiryDays`
  - events `payment.payment.reversed`, `payment.storeCredit.changed`
- `pricing`: settings `pricing.approval.discountPercentAbove`, `pricing.approval.discountAmountAbove`
- `pos`: setting `pos.allowCreditSale`
- `courier`: permission `courier.settlement.record`, event `courier.settlement.recorded`
- `delivery`: event `delivery.cash.handedOver`
- `accounting`: system account codes and the posting matrix (`11 §10`)

Bot tool mapping follows `08 §2`. `create_request` and `get_request_status` are single tools whose handlers are contributed by `sales`, `booking` and `enrollment`, so the tool appears only with the effective request types.

## 8. Subscription status → access mode (ADR-053)

| PlatformSubscription status | `accessMode` | Effect |
|---|---|---|
| `TRIALING` | `FULL` | Bundle trial, 14 days (owner decision) |
| `ACTIVE` | `FULL` | |
| `PAST_DUE` (within grace, 7 days) | `FULL` + banner | |
| `PAST_DUE` (after grace) or `CANCELLED` | `READ_ONLY` | Every write route returns `ORG_READ_ONLY`, except billing, export and login. Bot and website switch to "temporarily unavailable" replies. Nothing is deleted. |

The entitlement gate checks `accessMode` before the module check. A trial that ends without a purchase becomes `PAST_DUE`, and then `READ_ONLY`. Card 6.2 implements payment collection; card 1.6 implements the modes.

## 9. Packages (seed data, editable in the platform panel)

All numbers are **seed proposals** stored in the DB. Changing them needs no code (P2 sets prices). `null` = unlimited. Every base package also includes all CORE modules (§1).

**Base packages**

| packageKey | Name (i18n) | Extra modules beyond CORE | locations | members | offerings | ordersPerMonth | aiMessagesPerMonth | smsPerMonth | channels | posDevices |
|---|---|---|---|---|---|---|---|---|---|---|
| `STORE` | Banijjik Store (website) | `website` | 1 | 3 | 500 | 1,000 | 0 | 100 | 0 | 0 |
| `CHAT` | Banijjik Chat (chatbot) | `messaging`, `bot`, `social` | 1 | 3 | 500 | 1,000 | 1,000 | 100 | 2 | 0 |
| `SHOP` | Banijjik Shop (POS) | `pos` | 1 | 5 | 2,000 | 5,000 | 0 | 100 | 0 | 1 |
| `BUNDLE` | Banijjik Bundle | `website`, `messaging`, `bot`, `social`, `pos`, `workflow` | 2 | 10 | 5,000 | 10,000 | 3,000 | 300 | 3 | 2 |

**Add-ons** (`isAddOn: true`; module add-ons and limit packs)

| packageKey | Adds |
|---|---|
| `ADDON_BOOKKEEPING` | module `bookkeeping` |
| `ADDON_PAYMENT_GATEWAY` | module `payment-gateway` (also included free in STORE and BUNDLE once card 5.17 ships; decided in P2) |
| `ADDON_AUTOMATION` | module `workflow` (already in BUNDLE) |
| `ADDON_WEBSITE`, `ADDON_CHAT`, `ADDON_POS` | upgrade path: the other base package's extra modules, for orgs that want two of three without the full bundle |
| `ADDON_CAPABILITY_ACADEMIC`, `_CLINICAL`, `_KITCHEN` | capability modules (Phase 7; template-filtered) |
| `PACK_LOCATION` | `locations +1` |
| `PACK_MEMBERS_5` | `members +5` |
| `PACK_AI_1000` | `aiMessagesPerMonth +1000` |
| `PACK_SMS_500` | `smsPerMonth +500` |

**Limit semantics**
- Monthly limits count by `businessDate` in the org timezone and reset on the 1st.
- Over limit: creating the counted thing is refused with `LIMIT_REACHED` (and a clear upgrade message), **except**:
  - AI: over quota → rules-only mode (ADR-030)
  - SMS: over quota → message skipped, owner notified
  - Orders: over quota → POS and storefront keep working, with a banner, for 5% headroom, so a shop never stops selling mid-day
- `locations`, `members`, `offerings`, `channels`, `posDevices` are counts of ACTIVE records.

**Trial:** a new org gets `PlatformSubscription { status: TRIALING, basePackageId: BUNDLE, trialEndsAt: +14 days }` (owner decision).

## 10. Default role grants (system roles; code templates, ADR-054)

`F` = all permissions of the module · `R` = read permissions · `—` = none · named = only those.

| Module | OWNER | MANAGER | CASHIER | STAFF | RIDER | VIEWER |
|---|---|---|---|---|---|---|
| organization | F | F except `ownership.transfer`, `member.readSensitive` | — | — | — | R (profile, locations) |
| iam (roles) | F | R | — | — | — | — |
| settings / custom-field | F | F | — | — | — | R |
| audit | F | R | — | — | — | — |
| contact | F | F except `anonymize` | read, create, update | read, create, update | read | R |
| catalog / pricing | F | F | R | R | — | R |
| inventory | F | F | read | read, adjustment.create | — | R |
| sales | F | F | read, create, confirm, cancel | read, create | read (assigned) | R |
| booking | F | F | read, create, reschedule, cancel | read, create, reschedule | — | R |
| enrollment | F | F | read, create, renew, checkIn.create | read, checkIn.create | — | R |
| payment | F | F | read, receive | — | receive (COD) | R |
| expense | F | F | create | — | — | R |
| bookkeeping | F | R | — | — | — | — |
| report | F | F except `profit.read` | dashboard.read | dashboard.read | — | dashboard.read, sales.read |
| delivery / courier | F | F | read | read | `delivery.assignment.complete`, `delivery.cash.handover` | R |
| pos | F | F | session.open, sale.create, register.close | — | — | — |
| website | F | F | — | — | — | R |
| messaging / bot / social | F | F | conversation.read, conversation.reply | conversation.read, conversation.reply | — | R |
| workflow | F | F | — | — | — | R |

Permissions of modules that are off have no effect, because the entitlement gate runs first.

## 11. Generated contract tests (card 1.6, then automatic for every module)

For every non-SYSTEM module M, the suite builds an org where M is effective, then turns M off by each possible path (not in package, `PLATFORM_REVOKE`, `TENANT_DISABLE` when allowed, template excludes it, required kind missing, dependency missing). For each path it asserts:
1. every route in `M.routes` returns `403 MODULE_DISABLED`
2. `menu` has no entry of M
3. `botTools` has no tool contributed by M
4. `storefrontSections` has no section of M
5. M's setting keys and custom-field entities are absent from the resolved config
6. M's event consumers do not run for that org
7. M's data is untouched (count before = count after)

Plus registry tests:
- every manifest key is in contracts `MODULE_KEYS`
- `dependsOn` has no cycles
- every permission, setting, event and section key is unique and declared in contracts
- every seed base package contains all CORE modules and is closed under `dependsOn`
- PLATFORM modules declare no tenant routes

## 12. Decisions made in this card

| ADR | Decision | Status |
|---|---|---|
| ADR-049 | Module classes `PLATFORM \| SYSTEM \| CORE \| OPTIONAL`, the manifest schema in §2, and the resolver algorithm in §3. Never auto-enable a paid dependency: a module with a missing dependency is dropped. Event consumers run only for orgs where the module is effective (SYSTEM always). The cache key includes `registryHash`, package versions and template version. | Accepted (proposed) |
| ADR-050 | Packages: base `STORE`, `CHAT`, `SHOP` (POS is its own base package, owner decision) and `BUNDLE`, plus module add-ons and limit packs (§9). Every base package includes all CORE modules. Limits add up across add-ons; `null` = unlimited. AI, SMS and order quotas degrade softly instead of stopping sales. Trial = 14 days of BUNDLE (owner decision). | Accepted (owner: Shop package, 14-day Bundle trial) + proposed (rest) |
| ADR-051 | Accounting split: `accounting` is SYSTEM (chart seeding and journal posting from events, always on, no menu); `expense` is CORE (everyone records expenses, owner decision); `bookkeeping` is an OPTIONAL add-on UI (chart of accounts, journal, manual entries, statements). Ledgers stay correct whatever the org bought. | Accepted (owner) |
| ADR-052 | Module groups `platform/ core/ commerce/ channel/ integration/ automation/ capability/`. The new `channel/` group holds `website`, `messaging` (Channel, Conversation, Message, inbox), `bot` and `social`. `integration/` holds third-party providers: `courier`, `sms`, `payment-gateway`. Own-rider is `commerce/delivery`. | Accepted (proposed) |
| ADR-053 | Subscription status maps to `accessMode`: TRIALING/ACTIVE/PAST_DUE-in-grace = FULL; after a 7-day grace or CANCELLED = READ_ONLY (writes refused except billing/export/login; bot and website show "temporarily unavailable"). Data is never deleted for non-payment. | Accepted (proposed) |
| ADR-054 | Permission keys are `<moduleKey>.<entity>.<action>`, declared in manifests and contracts. System role grants are code templates (§10) that update with releases. Platform permissions are `platform.<module>.<action>` and come only from `PlatformOperator` roles. | Accepted (proposed) |

## 13. Docs to sync (done in this card's branch)
- `09`: adds Expense, ExpenseCategory and KnowledgeEntry. Moves Channel/Conversation/Message to `channel/messaging`. Adds `channel/*`, `commerce/expense`, `commerce/delivery` to the ownership map. Adds sequences `EXPENSE`, `TRANSFER`, `ZREPORT`. Adds `registryHash` and `accessMode` to `ResolvedOrgConfig`.
- `01 §2`: module groups per ADR-052.
- `07 §1`: "Package / Plan" → "Package". `07 §3`: points to this doc for the exact formula.
- `03`: card 1.6 references §2/§3/§8/§11 here. New cards 3.8b (bookkeeping UI) and 5.17 (tenant payment gateway).

## 14. Open questions (not blocking approval; for the owner later)
- **Q1.** Payment gateway for storefront checkout: include it free in STORE/BUNDLE, or keep it as an add-on? (Decided in P2 with pricing.)
